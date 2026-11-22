//go:build windows

package registry

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"

	"golang.org/x/sys/windows/registry"

	"url-protocol-manager/internal/winutil"
)

// ExportProtocolsToReg serializes one or more URL protocols into a standard Windows .reg file (UTF-16LE with BOM).
func ExportProtocolsToReg(refs []ProtocolRef) ([]byte, error) {
	if len(refs) == 0 {
		return nil, fmt.Errorf("没有需要导出的协议")
	}

	var sb strings.Builder
	sb.WriteString("Windows Registry Editor Version 5.00\r\n")

	exportedCount := 0
	for _, ref := range refs {
		name := strings.TrimSpace(ref.Name)
		if name == "" || strings.ContainsAny(name, `\/`) {
			continue
		}
		root, basePath, displayBase, err := rootForScope(ref.Scope)
		if err != nil {
			continue
		}
		subPath := basePath + `\` + name
		fullDisplay := displayBase + `\` + name
		if err := dumpKeyRecursive(&sb, root, subPath, fullDisplay); err != nil {
			continue
		}
		exportedCount++
	}

	if exportedCount == 0 {
		return nil, fmt.Errorf("未找到可导出的注册表项")
	}

	return encodeUTF16LEWithBOM(sb.String()), nil
}

func dumpKeyRecursive(sb *strings.Builder, root registry.Key, subPath, fullDisplay string) error {
	k, err := registry.OpenKey(root, subPath, registry.QUERY_VALUE|registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return err
	}
	defer k.Close()

	sb.WriteString("\r\n[")
	sb.WriteString(fullDisplay)
	sb.WriteString("]\r\n")

	valueNames, err := k.ReadValueNames(-1)
	if err == nil {
		sort.Slice(valueNames, func(i, j int) bool {
			if valueNames[i] == "" {
				return true
			}
			if valueNames[j] == "" {
				return false
			}
			return strings.ToLower(valueNames[i]) < strings.ToLower(valueNames[j])
		})
		for _, vName := range valueNames {
			line, ok := formatRegValueLine(k, vName)
			if ok {
				sb.WriteString(line)
				sb.WriteString("\r\n")
			}
		}
	}

	subKeys, err := k.ReadSubKeyNames(-1)
	if err == nil {
		sort.Strings(subKeys)
		for _, child := range subKeys {
			_ = dumpKeyRecursive(sb, root, subPath+`\`+child, fullDisplay+`\`+child)
		}
	}
	return nil
}

func formatRegValueLine(k registry.Key, name string) (string, bool) {
	n, valType, err := k.GetValue(name, nil)
	if err != nil {
		return "", false
	}
	buf := make([]byte, n)
	if n > 0 {
		if _, valType, err = k.GetValue(name, buf); err != nil {
			return "", false
		}
	}

	var keyLabel string
	if name == "" {
		keyLabel = "@"
	} else {
		keyLabel = `"` + escapeRegString(name) + `"`
	}

	switch valType {
	case registry.SZ:
		s := decodeUTF16Z(buf)
		return fmt.Sprintf(`%s="%s"`, keyLabel, escapeRegString(s)), true
	case registry.DWORD:
		if len(buf) >= 4 {
			v := binary.LittleEndian.Uint32(buf[:4])
			return fmt.Sprintf(`%s=dword:%08x`, keyLabel, v), true
		}
		return "", false
	case registry.BINARY:
		return fmt.Sprintf(`%s=hex:%s`, keyLabel, formatHexBytes(buf)), true
	case registry.EXPAND_SZ:
		return fmt.Sprintf(`%s=hex(2):%s`, keyLabel, formatHexBytes(buf)), true
	case registry.MULTI_SZ:
		return fmt.Sprintf(`%s=hex(7):%s`, keyLabel, formatHexBytes(buf)), true
	case registry.QWORD:
		return fmt.Sprintf(`%s=hex(b):%s`, keyLabel, formatHexBytes(buf)), true
	default:
		return fmt.Sprintf(`%s=hex(%x):%s`, keyLabel, valType, formatHexBytes(buf)), true
	}
}

func escapeRegString(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return s
}

func unescapeRegString(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			i++
			b.WriteByte(s[i])
		} else {
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

func formatHexBytes(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	parts := make([]string, len(data))
	for i, b := range data {
		parts[i] = fmt.Sprintf("%02x", b)
	}
	return strings.Join(parts, ",")
}

func decodeUTF16Z(b []byte) string {
	if len(b) < 2 {
		return ""
	}
	u16 := make([]uint16, len(b)/2)
	for i := range u16 {
		u16[i] = binary.LittleEndian.Uint16(b[i*2 : i*2+2])
	}
	for len(u16) > 0 && u16[len(u16)-1] == 0 {
		u16 = u16[:len(u16)-1]
	}
	return string(utf16.Decode(u16))
}

func encodeUTF16LEWithBOM(s string) []byte {
	runes := utf16.Encode([]rune(s))
	out := make([]byte, 2+len(runes)*2)
	out[0] = 0xFF
	out[1] = 0xFE
	for i, r := range runes {
		binary.LittleEndian.PutUint16(out[2+i*2:], r)
	}
	return out
}

func decodeRegFileText(raw []byte) string {
	if len(raw) >= 2 && raw[0] == 0xFF && raw[1] == 0xFE {
		u16 := make([]uint16, (len(raw)-2)/2)
		for i := range u16 {
			u16[i] = binary.LittleEndian.Uint16(raw[2+i*2 : 4+i*2])
		}
		return string(utf16.Decode(u16))
	}
	if len(raw) >= 2 && raw[0] == 0xFE && raw[1] == 0xFF {
		u16 := make([]uint16, (len(raw)-2)/2)
		for i := range u16 {
			u16[i] = binary.BigEndian.Uint16(raw[2+i*2 : 4+i*2])
		}
		return string(utf16.Decode(u16))
	}
	// Strip optional UTF-8 BOM
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	return string(raw)
}

// --- .reg File Parser & Importer ---

type parsedRegValue struct {
	Name    string
	ValType uint32
	StrVal  string
	Uint32  uint32
	Raw     []byte
}

type parsedRegSection struct {
	OriginalPath string
	Scope        Scope
	FromHKCR     bool
	SchemeName   string
	RelSubPath   string // "" for scheme root, e.g. "DefaultIcon" or "shell\open\command"
	Values       []parsedRegValue
}

type parsedProtocolGroup struct {
	ID          string
	Scope       Scope
	FromHKCR    bool
	Name        string
	HasMarker   bool
	Description string
	Command     string
	IconPath    string
	Sections    []parsedRegSection
}

// ParseRegContent parses a .reg file into grouped URL protocol definitions.
func ParseRegContent(raw []byte, hkcrFallback Scope) ([]parsedProtocolGroup, int, error) {
	text := decodeRegFileText(raw)
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	rawLines := strings.Split(text, "\n")

	// Join backslash-continued lines (common in hex(...) values)
	var lines []string
	var pending string
	for _, line := range rawLines {
		trimmedRight := strings.TrimRight(line, " \t")
		if pending != "" {
			line = strings.TrimLeft(line, " \t")
			trimmedRight = strings.TrimRight(line, " \t")
		}
		if strings.HasSuffix(trimmedRight, `\`) && !strings.HasPrefix(strings.TrimSpace(line), "[") && !strings.HasPrefix(strings.TrimSpace(line), ";") {
			pending += strings.TrimSuffix(trimmedRight, `\`)
			continue
		}
		if pending != "" {
			lines = append(lines, pending+line)
			pending = ""
		} else {
			lines = append(lines, line)
		}
	}
	if pending != "" {
		lines = append(lines, pending)
	}

	var sections []parsedRegSection
	var current *parsedRegSection
	skipped := 0

	for _, line := range lines {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, ";") || strings.HasPrefix(strings.ToUpper(t), "WINDOWS REGISTRY EDITOR") || strings.EqualFold(t, "REGEDIT4") {
			continue
		}
		if strings.HasPrefix(t, "[") && strings.HasSuffix(t, "]") {
			secPath := strings.TrimSpace(t[1 : len(t)-1])
			// Skip deletion markers [-HKEY_...]
			if strings.HasPrefix(secPath, "-") {
				current = nil
				skipped++
				continue
			}
			sec, ok := classifyRegSectionPath(secPath, hkcrFallback)
			if !ok {
				current = nil
				skipped++
				continue
			}
			sections = append(sections, sec)
			current = &sections[len(sections)-1]
			continue
		}
		if current == nil {
			continue
		}
		if val, ok := parseRegValueAssignment(t); ok {
			current.Values = append(current.Values, val)
		}
	}

	groupMap := make(map[string]*parsedProtocolGroup)
	var order []string

	for _, sec := range sections {
		id := fmt.Sprintf("%s:%s", sec.Scope, sec.SchemeName)
		key := strings.ToLower(id)
		grp, exists := groupMap[key]
		if !exists {
			grp = &parsedProtocolGroup{
				ID:       id,
				Scope:    sec.Scope,
				FromHKCR: sec.FromHKCR,
				Name:     sec.SchemeName,
			}
			groupMap[key] = grp
			order = append(order, key)
		}
		grp.Sections = append(grp.Sections, sec)

		relLower := strings.ToLower(sec.RelSubPath)
		for _, v := range sec.Values {
			switch relLower {
			case "":
				if strings.EqualFold(v.Name, "URL Protocol") {
					grp.HasMarker = true
				} else if v.Name == "" && v.ValType == registry.SZ {
					grp.Description = v.StrVal
				}
			case "defaulticon":
				if v.Name == "" && (v.ValType == registry.SZ || v.ValType == registry.EXPAND_SZ) {
					grp.IconPath = v.StrVal
				}
			case `shell\open\command`:
				if v.Name == "" && (v.ValType == registry.SZ || v.ValType == registry.EXPAND_SZ) {
					grp.Command = v.StrVal
				}
			}
		}
	}

	var groups []parsedProtocolGroup
	for _, key := range order {
		g := groupMap[key]
		// Only keep entries that actually declare a URL Protocol
		if !g.HasMarker {
			skipped += len(g.Sections)
			continue
		}
		groups = append(groups, *g)
	}

	return groups, skipped, nil
}

func classifyRegSectionPath(secPath string, hkcrFallback Scope) (parsedRegSection, bool) {
	upper := strings.ToUpper(secPath)
	var (
		scope    Scope
		fromHKCR bool
		rest     string
	)

	switch {
	case strings.HasPrefix(upper, `HKEY_CURRENT_USER\SOFTWARE\CLASSES\`):
		scope = ScopeHKCU
		rest = secPath[len(`HKEY_CURRENT_USER\SOFTWARE\CLASSES\`):]
	case strings.HasPrefix(upper, `HKEY_LOCAL_MACHINE\SOFTWARE\CLASSES\`):
		scope = ScopeHKLM
		rest = secPath[len(`HKEY_LOCAL_MACHINE\SOFTWARE\CLASSES\`):]
	case strings.HasPrefix(upper, `HKEY_CLASSES_ROOT\`):
		scope = hkcrFallback
		if scope != ScopeHKCU && scope != ScopeHKLM {
			scope = ScopeHKCU
		}
		fromHKCR = true
		rest = secPath[len(`HKEY_CLASSES_ROOT\`):]
	default:
		return parsedRegSection{}, false
	}

	rest = strings.Trim(rest, `\`)
	if rest == "" {
		return parsedRegSection{}, false
	}

	scheme := rest
	rel := ""
	if idx := strings.Index(rest, `\`); idx >= 0 {
		scheme = rest[:idx]
		rel = rest[idx+1:]
	}
	if strings.HasPrefix(scheme, ".") || ValidateProtocolName(scheme) != nil {
		return parsedRegSection{}, false
	}

	return parsedRegSection{
		OriginalPath: secPath,
		Scope:        scope,
		FromHKCR:     fromHKCR,
		SchemeName:   scheme,
		RelSubPath:   rel,
	}, true
}

func parseRegValueAssignment(line string) (parsedRegValue, bool) {
	var name string
	var rhs string

	if strings.HasPrefix(line, "@=") {
		name = ""
		rhs = strings.TrimSpace(line[2:])
	} else if strings.HasPrefix(line, `"`) {
		// Find unescaped closing quote
		endIdx := -1
		for i := 1; i < len(line); i++ {
			if line[i] == '\\' {
				i++
				continue
			}
			if line[i] == '"' {
				endIdx = i
				break
			}
		}
		if endIdx < 0 {
			return parsedRegValue{}, false
		}
		name = unescapeRegString(line[1:endIdx])
		after := strings.TrimSpace(line[endIdx+1:])
		if !strings.HasPrefix(after, "=") {
			return parsedRegValue{}, false
		}
		rhs = strings.TrimSpace(after[1:])
	} else {
		return parsedRegValue{}, false
	}

	if rhs == "-" {
		return parsedRegValue{}, false
	}

	// String value: "..."
	if strings.HasPrefix(rhs, `"`) && strings.HasSuffix(rhs, `"`) && len(rhs) >= 2 {
		return parsedRegValue{
			Name:    name,
			ValType: registry.SZ,
			StrVal:  unescapeRegString(rhs[1 : len(rhs)-1]),
		}, true
	}

	lowerRHS := strings.ToLower(rhs)
	if strings.HasPrefix(lowerRHS, "dword:") {
		v, err := strconv.ParseUint(strings.TrimSpace(lowerRHS[len("dword:"):]), 16, 32)
		if err != nil {
			return parsedRegValue{}, false
		}
		return parsedRegValue{
			Name:    name,
			ValType: registry.DWORD,
			Uint32:  uint32(v),
		}, true
	}

	if strings.HasPrefix(lowerRHS, "hex:") {
		raw, err := parseCommaHex(lowerRHS[len("hex:"):])
		if err != nil {
			return parsedRegValue{}, false
		}
		return parsedRegValue{
			Name:    name,
			ValType: registry.BINARY,
			Raw:     raw,
		}, true
	}

	if strings.HasPrefix(lowerRHS, "hex(") {
		closeIdx := strings.Index(lowerRHS, "):")
		if closeIdx > 4 {
			typeHex := lowerRHS[4:closeIdx]
			tVal, err := strconv.ParseUint(typeHex, 16, 32)
			if err != nil {
				return parsedRegValue{}, false
			}
			raw, err := parseCommaHex(lowerRHS[closeIdx+2:])
			if err != nil {
				return parsedRegValue{}, false
			}
			v := parsedRegValue{
				Name:    name,
				ValType: uint32(tVal),
				Raw:     raw,
			}
			if uint32(tVal) == registry.EXPAND_SZ {
				v.StrVal = decodeUTF16Z(raw)
			}
			return v, true
		}
	}

	return parsedRegValue{}, false
}

func parseCommaHex(s string) ([]byte, error) {
	cleaned := strings.ReplaceAll(s, ",", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	cleaned = strings.ReplaceAll(cleaned, "\t", "")
	if cleaned == "" {
		return []byte{}, nil
	}
	return hex.DecodeString(cleaned)
}

// PreviewRegImport parses a .reg payload and returns structured preview items.
func PreviewRegImport(filePath string, raw []byte, hkcrFallback Scope) (ImportPreviewResult, error) {
	groups, skipped, err := ParseRegContent(raw, hkcrFallback)
	if err != nil {
		return ImportPreviewResult{}, err
	}
	isAdmin := winutil.IsAdmin()

	res := ImportPreviewResult{
		FilePath:    filePath,
		Items:       make([]ImportPreviewItem, 0, len(groups)),
		SkippedKeys: skipped,
	}

	for _, g := range groups {
		needsAdmin := g.Scope == ScopeHKLM && !isAdmin
		if needsAdmin {
			res.RequiresAdmin = true
		}
		res.Items = append(res.Items, ImportPreviewItem{
			ID:           g.ID,
			Name:         g.Name,
			Scope:        g.Scope,
			FromHKCR:     g.FromHKCR,
			Description:  g.Description,
			Command:      g.Command,
			IconPath:     g.IconPath,
			Exists:       ProtocolExists(g.Scope, g.Name),
			NeedsAdmin:   needsAdmin,
			SectionCount: len(g.Sections),
		})
	}
	return res, nil
}

// ApplyRegImport writes the user-selected protocols from a .reg file into Windows Registry.
func ApplyRegImport(raw []byte, selectedIDs []string, hkcrFallback Scope) (ImportApplyResult, error) {
	if len(selectedIDs) == 0 {
		return ImportApplyResult{Errors: []string{}}, fmt.Errorf("未选择要导入的协议")
	}

	groups, _, err := ParseRegContent(raw, hkcrFallback)
	if err != nil {
		return ImportApplyResult{}, err
	}

	selected := make(map[string]bool, len(selectedIDs))
	for _, id := range selectedIDs {
		selected[strings.ToLower(id)] = true
	}

	res := ImportApplyResult{
		Errors: []string{},
	}

	for _, g := range groups {
		if !selected[strings.ToLower(g.ID)] {
			continue
		}
		if err := writeProtocolGroup(g); err != nil {
			res.Failed++
			res.Errors = append(res.Errors, fmt.Sprintf("%s (%s): %v", g.Name, g.Scope, err))
		} else {
			res.Imported++
		}
	}

	winutil.ClearIconCache()
	return res, nil
}

func writeProtocolGroup(g parsedProtocolGroup) error {
	if err := checkWritePermission(g.Scope); err != nil {
		return err
	}
	root, basePath, _, err := rootForScope(g.Scope)
	if err != nil {
		return err
	}

	for _, sec := range g.Sections {
		targetPath := basePath + `\` + g.Name
		if sec.RelSubPath != "" {
			targetPath += `\` + sec.RelSubPath
		}
		k, _, err := registry.CreateKey(root, targetPath, registry.SET_VALUE|registry.CREATE_SUB_KEY)
		if err != nil {
			return err
		}
		for _, v := range sec.Values {
			var writeErr error
			switch v.ValType {
			case registry.SZ:
				writeErr = k.SetStringValue(v.Name, v.StrVal)
			case registry.EXPAND_SZ:
				writeErr = k.SetExpandStringValue(v.Name, v.StrVal)
			case registry.DWORD:
				writeErr = k.SetDWordValue(v.Name, v.Uint32)
			case registry.BINARY:
				writeErr = k.SetBinaryValue(v.Name, v.Raw)
			case registry.QWORD:
				if len(v.Raw) >= 8 {
					writeErr = k.SetQWordValue(v.Name, binary.LittleEndian.Uint64(v.Raw[:8]))
				}
			case registry.MULTI_SZ:
				writeErr = k.SetStringsValue(v.Name, decodeUTF16MultiSZ(v.Raw))
			default:
				writeErr = k.SetBinaryValue(v.Name, v.Raw)
			}
			if writeErr != nil {
				k.Close()
				return writeErr
			}
		}
		k.Close()
	}
	return nil
}

func decodeUTF16MultiSZ(b []byte) []string {
	if len(b) < 2 {
		return nil
	}
	u16 := make([]uint16, len(b)/2)
	for i := range u16 {
		u16[i] = binary.LittleEndian.Uint16(b[i*2 : i*2+2])
	}
	var out []string
	start := 0
	for i, c := range u16 {
		if c == 0 {
			if i > start {
				out = append(out, string(utf16.Decode(u16[start:i])))
			}
			start = i + 1
		}
	}
	return out
}
