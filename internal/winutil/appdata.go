//go:build windows

package winutil

import (
	"os"
	"path/filepath"
)

const appDataFolderName = "UrlProtocolManager"

// ResolveWebviewDataPath returns a stable WebView2 user data directory:
//  1. Portable mode: if a writable "data" directory exists next to the executable, use it.
//  2. Standard mode: use %LOCALAPPDATA%\UrlProtocolManager so upgrades/renames share one folder.
func ResolveWebviewDataPath() string {
	exeDir := ""
	if exe, err := os.Executable(); err == nil {
		exeDir = filepath.Dir(exe)
	}
	localAppData, _ := os.UserCacheDir()
	return resolveWebviewDataPath(exeDir, localAppData)
}

func resolveWebviewDataPath(exeDir, localAppData string) string {
	if exeDir != "" {
		portableDir := filepath.Join(exeDir, "data")
		if info, err := os.Stat(portableDir); err == nil && info.IsDir() && isDirWritable(portableDir) {
			return portableDir
		}
	}

	if localAppData != "" {
		target := filepath.Join(localAppData, appDataFolderName)
		if err := os.MkdirAll(target, 0755); err == nil {
			return target
		}
	}

	return ""
}

func isDirWritable(dir string) bool {
	probe, err := os.CreateTemp(dir, ".upm-write-probe-*")
	if err != nil {
		return false
	}
	name := probe.Name()
	_ = probe.Close()
	_ = os.Remove(name)
	return true
}
