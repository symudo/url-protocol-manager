//go:build windows

package registry

import (
	"fmt"
	"regexp"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"

	"url-protocol-manager/internal/winutil"
)

var (
	modAdvapi32       = windows.NewLazySystemDLL("advapi32.dll")
	procRegDeleteTree = modAdvapi32.NewProc("RegDeleteTreeW")
	schemePattern     = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]{0,63}$`)
)

// ValidateProtocolName ensures a protocol scheme adheres to RFC 3986 and is safe as a registry key name.
func ValidateProtocolName(name string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fmt.Errorf("协议名称不能为空")
	}
	if !schemePattern.MatchString(trimmed) {
		return fmt.Errorf("协议名称须以英文字母开头，仅支持字母、数字、+、-、.（最长 64 字符）")
	}
	return nil
}

func checkWritePermission(scope Scope) error {
	if scope == ScopeHKLM && !winutil.IsAdmin() {
		return fmt.Errorf("ADMIN_REQUIRED: 修改或删除系统级 (HKLM) 协议需要管理员权限，请点击右上角以管理员身份重启")
	}
	return nil
}

// ProtocolExists checks if a given protocol exists in the specified scope.
func ProtocolExists(scope Scope, name string) bool {
	root, basePath, _, err := rootForScope(scope)
	if err != nil {
		return false
	}
	k, err := registry.OpenKey(root, basePath+`\`+name, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	_, _, err = k.GetValue("URL Protocol", nil)
	return err == nil
}

// CreateProtocol creates a new 4-level custom URL protocol structure in the target scope.
func CreateProtocol(payload ProtocolPayload) error {
	payload.Name = strings.TrimSpace(payload.Name)
	if err := ValidateProtocolName(payload.Name); err != nil {
		return err
	}
	if err := checkWritePermission(payload.Scope); err != nil {
		return err
	}
	if strings.TrimSpace(payload.Command) == "" {
		return fmt.Errorf("启动命令不能为空")
	}

	root, basePath, _, err := rootForScope(payload.Scope)
	if err != nil {
		return err
	}

	keyPath := basePath + `\` + payload.Name

	// Prevent silently overwriting an existing URL protocol
	if existing, err := registry.OpenKey(root, keyPath, registry.QUERY_VALUE); err == nil {
		_, _, hasProtoErr := existing.GetValue("URL Protocol", nil)
		existing.Close()
		if hasProtoErr == nil {
			return fmt.Errorf("协议 \"%s\" 在 %s 中已存在，请直接编辑或更换名称", payload.Name, payload.Scope)
		}
	}

	desc := strings.TrimSpace(payload.Description)
	if desc == "" {
		desc = fmt.Sprintf("URL:%s Protocol", payload.Name)
	}

	k, _, err := registry.CreateKey(root, keyPath, registry.SET_VALUE|registry.CREATE_SUB_KEY)
	if err != nil {
		return fmt.Errorf("创建协议主键失败: %w", err)
	}
	defer k.Close()

	if err := k.SetStringValue("", desc); err != nil {
		return fmt.Errorf("写入协议描述失败: %w", err)
	}
	if err := k.SetStringValue("URL Protocol", ""); err != nil {
		return fmt.Errorf("写入 URL Protocol 标志失败: %w", err)
	}

	// Optional DefaultIcon subkey
	iconPath := strings.TrimSpace(payload.IconPath)
	if iconPath != "" {
		iconKey, _, err := registry.CreateKey(k, "DefaultIcon", registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("创建 DefaultIcon 子键失败: %w", err)
		}
		err = iconKey.SetStringValue("", iconPath)
		iconKey.Close()
		if err != nil {
			return fmt.Errorf("写入图标路径失败: %w", err)
		}
	}

	// shell\open\command subkey hierarchy
	cmdKey, _, err := registry.CreateKey(k, `shell\open\command`, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("创建 shell\\open\\command 子键失败: %w", err)
	}
	defer cmdKey.Close()
	if err := cmdKey.SetStringValue("", strings.TrimSpace(payload.Command)); err != nil {
		return fmt.Errorf("写入启动命令失败: %w", err)
	}

	winutil.ClearIconCache()
	return nil
}

// UpdateProtocol updates description, icon, and command without touching unrelated keys or values.
func UpdateProtocol(payload ProtocolPayload) error {
	payload.Name = strings.TrimSpace(payload.Name)
	if err := ValidateProtocolName(payload.Name); err != nil {
		return err
	}
	if err := checkWritePermission(payload.Scope); err != nil {
		return err
	}

	root, basePath, _, err := rootForScope(payload.Scope)
	if err != nil {
		return err
	}
	keyPath := basePath + `\` + payload.Name

	k, err := registry.OpenKey(root, keyPath, registry.QUERY_VALUE|registry.SET_VALUE|registry.CREATE_SUB_KEY)
	if err != nil {
		return fmt.Errorf("打开协议键失败（可能已被删除）: %w", err)
	}
	defer k.Close()

	if err := k.SetStringValue("", strings.TrimSpace(payload.Description)); err != nil {
		return fmt.Errorf("更新协议描述失败: %w", err)
	}
	// Preserve existing URL Protocol marker if missing
	if _, _, err := k.GetValue("URL Protocol", nil); err != nil {
		if err := k.SetStringValue("URL Protocol", ""); err != nil {
			return fmt.Errorf("更新 URL Protocol 标志失败: %w", err)
		}
	}

	// Update or clear DefaultIcon
	iconPath := strings.TrimSpace(payload.IconPath)
	if iconPath != "" {
		iconKey, _, err := registry.CreateKey(k, "DefaultIcon", registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("更新 DefaultIcon 失败: %w", err)
		}
		err = iconKey.SetStringValue("", iconPath)
		iconKey.Close()
		if err != nil {
			return fmt.Errorf("写入图标路径失败: %w", err)
		}
	} else {
		if iconKey, err := registry.OpenKey(k, "DefaultIcon", registry.SET_VALUE|registry.QUERY_VALUE); err == nil {
			_ = iconKey.DeleteValue("")
			iconKey.Close()
		}
	}

	// Update shell\open\command
	cmdStr := strings.TrimSpace(payload.Command)
	if cmdStr != "" {
		cmdKey, _, err := registry.CreateKey(k, `shell\open\command`, registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("更新启动命令子键失败: %w", err)
		}
		err = cmdKey.SetStringValue("", cmdStr)
		cmdKey.Close()
		if err != nil {
			return fmt.Errorf("写入启动命令失败: %w", err)
		}
	}

	winutil.ClearIconCache()
	return nil
}

// DeleteProtocol deletes a URL protocol using the specified strategy:
//   - DeleteModeFull: recursively deletes the entire `<name>` registry tree via RegDeleteTreeW.
//   - DeleteModeDisable: safely removes only the "URL Protocol" value, leaving other keys intact.
func DeleteProtocol(scope Scope, name string, mode DeleteMode) error {
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsAny(name, `\/`) {
		return fmt.Errorf("无效的协议名称")
	}
	if err := checkWritePermission(scope); err != nil {
		return err
	}

	root, basePath, _, err := rootForScope(scope)
	if err != nil {
		return err
	}
	keyPath := basePath + `\` + name

	switch mode {
	case DeleteModeDisable:
		k, err := registry.OpenKey(root, keyPath, registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("打开协议键失败: %w", err)
		}
		defer k.Close()
		if err := k.DeleteValue("URL Protocol"); err != nil && err != registry.ErrNotExist {
			return fmt.Errorf("停用协议失败: %w", err)
		}
		return nil

	case DeleteModeFull, "":
		if err := deleteRegistryTree(root, keyPath); err != nil {
			return fmt.Errorf("递归删除注册表树失败: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("不支持的删除模式: %s", mode)
	}
}

// deleteRegistryTree calls Win32 RegDeleteTreeW to cleanly remove a key and all nested subkeys.
func deleteRegistryTree(root registry.Key, subKey string) error {
	subKeyPtr, err := syscall.UTF16PtrFromString(subKey)
	if err != nil {
		return err
	}
	ret, _, _ := procRegDeleteTree.Call(
		uintptr(root),
		uintptr(unsafe.Pointer(subKeyPtr)),
	)
	if ret != 0 {
		errno := syscall.Errno(ret)
		if errno == windows.ERROR_FILE_NOT_FOUND {
			return nil
		}
		return errno
	}
	return nil
}

// BatchClean deletes a list of confirmed stale protocols cleanly and reports per-item outcomes.
func BatchClean(refs []ProtocolRef) BatchCleanResult {
	res := BatchCleanResult{
		Items: make([]BatchCleanItemResult, 0, len(refs)),
	}
	for _, ref := range refs {
		itemRes := BatchCleanItemResult{
			Scope: ref.Scope,
			Name:  ref.Name,
		}
		if err := DeleteProtocol(ref.Scope, ref.Name, DeleteModeFull); err != nil {
			itemRes.Success = false
			itemRes.Error = err.Error()
			res.Failed++
		} else {
			itemRes.Success = true
			res.Succeeded++
		}
		res.Items = append(res.Items, itemRes)
	}
	return res
}
