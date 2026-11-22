//go:build windows

package registry

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"golang.org/x/sys/windows/registry"

	"url-protocol-manager/internal/winutil"
)

const (
	hkcuClassesPath = `Software\Classes`
	hklmClassesPath = `SOFTWARE\Classes`
)

// Known subkeys indicating a registry key is shared with COM/Shell/File associations.
var compositeSubkeySet = map[string]bool{
	"clsid":        true,
	"curver":       true,
	"shellex":      true,
	"typelib":      true,
	"progid":       true,
	"insertable":   true,
	"protocol":     true,
	"persistenthandler": true,
}

func rootForScope(scope Scope) (registry.Key, string, string, error) {
	switch scope {
	case ScopeHKCU:
		return registry.CURRENT_USER, hkcuClassesPath, `HKEY_CURRENT_USER\Software\Classes`, nil
	case ScopeHKLM:
		return registry.LOCAL_MACHINE, hklmClassesPath, `HKEY_LOCAL_MACHINE\SOFTWARE\Classes`, nil
	default:
		return 0, "", "", fmt.Errorf("不支持的注册表作用域: %s", scope)
	}
}

// ScanAll scans both HKCU and HKLM Classes hives for custom URL protocols.
func ScanAll() ([]ProtocolItem, error) {
	hkcuItems, hkcuErr := scanScope(ScopeHKCU)
	hklmItems, hklmErr := scanScope(ScopeHKLM)
	if hkcuErr != nil && hklmErr != nil {
		return nil, fmt.Errorf("读取注册表失败: HKCU(%v), HKLM(%v)", hkcuErr, hklmErr)
	}

	items := make([]ProtocolItem, 0, len(hkcuItems)+len(hklmItems))
	items = append(items, hkcuItems...)
	items = append(items, hklmItems...)

	// Cross-reference HKCU and HKLM to detect shadowing
	hkcuNames := make(map[string]bool, len(hkcuItems))
	hklmNames := make(map[string]bool, len(hklmItems))
	for _, it := range hkcuItems {
		hkcuNames[strings.ToLower(it.Name)] = true
	}
	for _, it := range hklmItems {
		hklmNames[strings.ToLower(it.Name)] = true
	}

	for i := range items {
		lower := strings.ToLower(items[i].Name)
		if items[i].Scope == ScopeHKCU && hklmNames[lower] {
			items[i].HasSameInOtherScope = true
			items[i].ShadowsSystem = true
		} else if items[i].Scope == ScopeHKLM && hkcuNames[lower] {
			items[i].HasSameInOtherScope = true
			items[i].IsShadowed = true
		}
	}

	// Sort alphabetically by protocol name, HKCU before HKLM on ties
	sort.Slice(items, func(i, j int) bool {
		li := strings.ToLower(items[i].Name)
		lj := strings.ToLower(items[j].Name)
		if li != lj {
			return li < lj
		}
		return items[i].Scope == ScopeHKCU && items[j].Scope == ScopeHKLM
	})

	// Extract icons concurrently with bounded parallelism
	populateIcons(items)

	return items, nil
}

func scanScope(scope Scope) ([]ProtocolItem, error) {
	root, basePath, displayBase, err := rootForScope(scope)
	if err != nil {
		return nil, err
	}

	baseKey, err := registry.OpenKey(root, basePath, registry.ENUMERATE_SUB_KEYS|registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return nil, nil
		}
		return nil, err
	}
	defer baseKey.Close()

	subKeys, err := baseKey.ReadSubKeyNames(-1)
	if err != nil {
		return nil, err
	}

	var result []ProtocolItem
	for _, name := range subKeys {
		// File extensions start with '.' and are never URL schemes
		if name == "" || strings.HasPrefix(name, ".") {
			continue
		}
		item, ok := readProtocolItem(root, basePath, displayBase, scope, name)
		if ok {
			result = append(result, item)
		}
	}
	return result, nil
}

func readProtocolItem(root registry.Key, basePath, displayBase string, scope Scope, name string) (ProtocolItem, bool) {
	keyPath := basePath + `\` + name
	k, err := registry.OpenKey(root, keyPath, registry.QUERY_VALUE|registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return ProtocolItem{}, false
	}
	defer k.Close()

	// Must have the "URL Protocol" value to be recognized as a URL protocol handler
	if _, _, err := k.GetValue("URL Protocol", nil); err != nil {
		return ProtocolItem{}, false
	}

	desc := readDefaultString(k)

	// Detect composite subkeys (COM/ShellEx/etc.)
	var compositeKeys []string
	if children, err := k.ReadSubKeyNames(-1); err == nil {
		for _, child := range children {
			if compositeSubkeySet[strings.ToLower(child)] {
				compositeKeys = append(compositeKeys, child)
			}
		}
	}
	sort.Strings(compositeKeys)

	// Read DefaultIcon
	var iconPath string
	if iconKey, err := registry.OpenKey(k, "DefaultIcon", registry.QUERY_VALUE); err == nil {
		iconPath = readDefaultString(iconKey)
		iconKey.Close()
	}

	// Read shell\open\command and DelegateExecute
	var command string
	var isUWP bool
	if cmdKey, err := registry.OpenKey(k, `shell\open\command`, registry.QUERY_VALUE); err == nil {
		command = readDefaultString(cmdKey)
		if _, _, err := cmdKey.GetValue("DelegateExecute", nil); err == nil {
			isUWP = true
		}
		cmdKey.Close()
	}
	// Also check shell\open for DelegateExecute or Application subkey (AppX/UWP patterns)
	if !isUWP {
		if openKey, err := registry.OpenKey(k, `shell\open`, registry.QUERY_VALUE); err == nil {
			if _, _, err := openKey.GetValue("DelegateExecute", nil); err == nil {
				isUWP = true
			}
			openKey.Close()
		}
	}
	if !isUWP {
		if appKey, err := registry.OpenKey(k, "Application", registry.QUERY_VALUE); err == nil {
			isUWP = true
			appKey.Close()
		}
	}

	exePath := winutil.ExtractExecutablePath(command)
	exeName := ""
	if exePath != "" {
		exeName = filepath.Base(exePath)
	}

	health, healthNote := evaluateHealth(command, exePath, isUWP)
	isComposite := len(compositeKeys) > 0

	item := ProtocolItem{
		ID:             fmt.Sprintf("%s:%s", scope, name),
		Name:           name,
		Scope:          scope,
		RegistryPath:   displayBase + `\` + name,
		Description:    desc,
		Command:        command,
		ExecutablePath: exePath,
		ExecutableName: exeName,
		IconPath:       iconPath,
		Health:         health,
		HealthNote:     healthNote,
		IsUWP:          isUWP,
		IsComposite:    isComposite,
		CompositeKeys:  compositeKeys,
		Cleanable:      health == HealthMissing && !isUWP && !isComposite,
	}
	return item, true
}

func readDefaultString(k registry.Key) string {
	val, _, err := k.GetStringValue("")
	if err != nil {
		return ""
	}
	return val
}

func evaluateHealth(command, exePath string, isUWP bool) (HealthStatus, string) {
	if isUWP {
		if exePath != "" && winutil.FileExists(exePath) {
			return HealthSystem, "系统/应用商店协议（DelegateExecute）"
		}
		return HealthSystem, "系统/UWP 协议组件"
	}
	if strings.TrimSpace(command) == "" {
		return HealthEmpty, "未配置启动命令"
	}
	if exePath != "" && winutil.FileExists(exePath) {
		return HealthOK, "目标程序存在且有效"
	}
	return HealthMissing, "目标程序文件不存在（可能为卸载残留）"
}

func populateIcons(items []ProtocolItem) {
	const workers = 8
	ch := make(chan int, len(items))
	for i := range items {
		ch <- i
	}
	close(ch)

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cleanup := winutil.InitCOMThread()
			defer cleanup()
			for idx := range ch {
				items[idx].IconData = winutil.ExtractIconDataURL(
					items[idx].IconPath,
					items[idx].ExecutablePath,
				)
			}
		}()
	}
	wg.Wait()
}
