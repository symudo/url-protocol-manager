//go:build windows

package winutil

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"unicode/utf16"

	"golang.org/x/sys/windows"
)

var (
	modKernel32                 = windows.NewLazySystemDLL("kernel32.dll")
	procExpandEnvironmentString = modKernel32.NewProc("ExpandEnvironmentStringsW")
	// Require at least 2 characters in scheme so single-letter Windows drive paths (e.g. C:\...) are rejected.
	uriSchemePrefixPattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]+:`)
)

// ExpandEnvVars expands Windows environment variables such as %SystemRoot% or %LocalAppData%.
func ExpandEnvVars(input string) string {
	if input == "" || !strings.Contains(input, "%") {
		return input
	}
	src, err := syscall.UTF16PtrFromString(input)
	if err != nil {
		return input
	}
	// First call to get required buffer size (in UTF-16 code units including null terminator).
	n, _, _ := procExpandEnvironmentString.Call(
		uintptr(unsafePointer(src)),
		0,
		0,
	)
	if n == 0 {
		return input
	}
	buf := make([]uint16, n)
	r, _, _ := procExpandEnvironmentString.Call(
		uintptr(unsafePointer(src)),
		uintptr(unsafePointer(&buf[0])),
		n,
	)
	if r == 0 || r > n {
		return input
	}
	return string(utf16.Decode(buf[:r-1]))
}

// FileExists returns true if path exists and is not a directory.
func FileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

// ExtractExecutablePath parses a Windows shell command line and extracts the target executable path.
func ExtractExecutablePath(command string) string {
	cmd := strings.TrimSpace(command)
	if cmd == "" {
		return ""
	}
	expanded := strings.TrimSpace(ExpandEnvVars(cmd))
	if expanded == "" {
		return ""
	}

	// Case 1: Leading double-quoted path: "C:\Path With Spaces\app.exe" "%1"
	if strings.HasPrefix(expanded, "\"") {
		if end := strings.Index(expanded[1:], "\""); end >= 0 {
			candidate := strings.TrimSpace(expanded[1 : end+1])
			return resolveIfBareCommand(candidate)
		}
	}

	// Case 2: Unquoted path, possibly with spaces (e.g., C:\Program Files\App\app.exe %1)
	// Try matching progressively longer space-delimited prefixes against existing files or known executable suffixes.
	fields := strings.Fields(expanded)
	if len(fields) == 0 {
		return ""
	}

	// Direct check for first token if it is a known PATH command or existing file.
	if resolved := resolveIfBareCommand(fields[0]); FileExists(resolved) {
		return resolved
	}

	var acc string
	for i, part := range fields {
		if i == 0 {
			acc = part
		} else {
			acc += " " + part
		}
		cleaned := strings.Trim(acc, "\"")
		if FileExists(cleaned) {
			return cleaned
		}
		lower := strings.ToLower(cleaned)
		if strings.HasSuffix(lower, ".exe") ||
			strings.HasSuffix(lower, ".bat") ||
			strings.HasSuffix(lower, ".cmd") ||
			strings.HasSuffix(lower, ".com") ||
			strings.HasSuffix(lower, ".msc") {
			return cleaned
		}
	}

	return resolveIfBareCommand(strings.Trim(fields[0], "\""))
}

func resolveIfBareCommand(candidate string) string {
	if candidate == "" {
		return ""
	}
	if FileExists(candidate) {
		return candidate
	}
	// If it has no directory separator, attempt PATH lookup (e.g., rundll32.exe, cmd.exe, explorer.exe)
	if !strings.ContainsAny(candidate, `\/`) {
		if found, err := exec.LookPath(candidate); err == nil {
			return found
		}
	}
	return candidate
}

// ParseIconLocation parses a registry DefaultIcon value like `"C:\App\app.exe",0` or `C:\App\app.exe,-101`.
func ParseIconLocation(spec string) (path string, index int) {
	s := strings.TrimSpace(spec)
	if s == "" {
		return "", 0
	}
	s = ExpandEnvVars(s)

	// Handle quoted path with optional ",index"
	if strings.HasPrefix(s, "\"") {
		if end := strings.Index(s[1:], "\""); end >= 0 {
			path = strings.TrimSpace(s[1 : end+1])
			rest := strings.TrimSpace(s[end+2:])
			if strings.HasPrefix(rest, ",") {
				fmt.Sscanf(strings.TrimSpace(rest[1:]), "%d", &index)
			}
			return path, index
		}
	}

	// Unquoted: check last comma for numeric index
	if comma := strings.LastIndex(s, ","); comma > 0 {
		var idx int
		if _, err := fmt.Sscanf(strings.TrimSpace(s[comma+1:]), "%d", &idx); err == nil {
			return strings.Trim(strings.TrimSpace(s[:comma]), "\""), idx
		}
	}

	return strings.Trim(s, "\""), 0
}

// TestLaunchURI asks Windows Shell to launch a custom URI such as `myapp://test`.
func TestLaunchURI(uri string) error {
	trimmed := strings.TrimSpace(uri)
	if !uriSchemePrefixPattern.MatchString(trimmed) {
		return fmt.Errorf("请输入有效的 URL 协议链接（例如 myapp://test），不支持本地文件路径")
	}
	verbPtr, err := syscall.UTF16PtrFromString("open")
	if err != nil {
		return err
	}
	uriPtr, err := syscall.UTF16PtrFromString(trimmed)
	if err != nil {
		return err
	}
	if err := windows.ShellExecute(0, verbPtr, uriPtr, nil, nil, windows.SW_SHOWNORMAL); err != nil {
		return fmt.Errorf("唤起协议失败: %w", err)
	}
	return nil
}

// RevealInExplorer opens Windows Explorer and selects the target file (or opens its parent folder).
func RevealInExplorer(filePath string) error {
	target := strings.TrimSpace(ExpandEnvVars(filePath))
	if target == "" {
		return fmt.Errorf("未找到有效路径")
	}
	if FileExists(target) {
		// Use raw Windows CmdLine so paths containing spaces or commas are quoted cleanly after /select,
		safeTarget := strings.ReplaceAll(target, `"`, "")
		cmd := exec.Command("explorer.exe")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CmdLine: fmt.Sprintf(`explorer.exe /select,"%s"`, safeTarget),
		}
		return cmd.Start()
	}
	dir := filepath.Dir(target)
	if info, err := os.Stat(dir); err == nil && info.IsDir() {
		cmd := exec.Command("explorer.exe", dir)
		return cmd.Start()
	}
	return fmt.Errorf("目标文件及其所在目录均不存在: %s", target)
}
