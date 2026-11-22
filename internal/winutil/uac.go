//go:build windows

package winutil

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"

	"golang.org/x/sys/windows"
)

// IsAdmin checks whether the current process is running with elevated privileges.
func IsAdmin() bool {
	return windows.GetCurrentProcessToken().IsElevated()
}

// RelaunchAsAdmin restarts the current executable with UAC elevation.
func RelaunchAsAdmin() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("无法获取当前程序路径: %w", err)
	}
	exePtr, err := syscall.UTF16PtrFromString(exe)
	if err != nil {
		return err
	}
	verbPtr, err := syscall.UTF16PtrFromString("runas")
	if err != nil {
		return err
	}
	cwdPtr, err := syscall.UTF16PtrFromString(filepath.Dir(exe))
	if err != nil {
		return err
	}
	if err := windows.ShellExecute(0, verbPtr, exePtr, nil, cwdPtr, windows.SW_SHOWNORMAL); err != nil {
		return fmt.Errorf("提权启动被取消或失败: %w", err)
	}
	return nil
}
