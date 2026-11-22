package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"url-protocol-manager/internal/registry"
	"url-protocol-manager/internal/winutil"
)

// AppVersion can be overridden at build time via -ldflags "-X main.AppVersion=x.y.z".
var AppVersion = "1.1.0"

// AppInfo exposes application metadata and current privilege status.
type AppInfo struct {
	Version string `json:"version"`
	IsAdmin bool   `json:"isAdmin"`
}

// BatchCleanResponse wraps batch cleanup results together with an optional backup path.
type BatchCleanResponse struct {
	Cancelled  bool                      `json:"cancelled"`
	BackupPath string                    `json:"backupPath"`
	Result     registry.BatchCleanResult `json:"result"`
}

// App binds backend capabilities to the Wails frontend.
type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetAppInfo() AppInfo {
	return AppInfo{
		Version: AppVersion,
		IsAdmin: winutil.IsAdmin(),
	}
}

func (a *App) ListProtocols() ([]registry.ProtocolItem, error) {
	return registry.ScanAll()
}

func (a *App) CreateProtocol(payload registry.ProtocolPayload) error {
	return registry.CreateProtocol(payload)
}

func (a *App) UpdateProtocol(payload registry.ProtocolPayload) error {
	return registry.UpdateProtocol(payload)
}

func (a *App) DeleteProtocol(scope string, name string, mode string) error {
	return registry.DeleteProtocol(registry.Scope(scope), name, registry.DeleteMode(mode))
}

func (a *App) BatchClean(refs []registry.ProtocolRef, backupFirst bool) (BatchCleanResponse, error) {
	if len(refs) == 0 {
		return BatchCleanResponse{}, fmt.Errorf("未选择需要清理的协议")
	}

	var backupPath string
	if backupFirst {
		defaultName := fmt.Sprintf("url-protocols-backup-%s.reg", time.Now().Format("20060102-150405"))
		savedPath, err := a.ExportProtocols(refs, defaultName)
		if err != nil {
			return BatchCleanResponse{}, fmt.Errorf("清理前备份失败，已中止清理: %w", err)
		}
		if savedPath == "" {
			// User cancelled the save dialog — abort cleanup safely
			return BatchCleanResponse{Cancelled: true}, nil
		}
		backupPath = savedPath
	}

	result := registry.BatchClean(refs)
	return BatchCleanResponse{
		Cancelled:  false,
		BackupPath: backupPath,
		Result:     result,
	}, nil
}

func (a *App) ExportProtocols(refs []registry.ProtocolRef, suggestedName string) (string, error) {
	if len(refs) == 0 {
		return "", fmt.Errorf("没有可导出的协议")
	}
	if strings.TrimSpace(suggestedName) == "" {
		suggestedName = fmt.Sprintf("url-protocols-%s.reg", time.Now().Format("20060102-150405"))
	}
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出自定义 URL 协议 (.reg)",
		DefaultFilename: suggestedName,
		Filters: []runtime.FileFilter{
			{DisplayName: "Windows 注册表文件 (*.reg)", Pattern: "*.reg"},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil
	}

	data, err := registry.ExportProtocolsToReg(refs)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(savePath, data, 0644); err != nil {
		return "", fmt.Errorf("写入导出文件失败: %w", err)
	}
	return savePath, nil
}

func (a *App) SelectAndPreviewRegFile(hkcrFallback string) (registry.ImportPreviewResult, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择要导入的注册表文件 (.reg)",
		Filters: []runtime.FileFilter{
			{DisplayName: "Windows 注册表文件 (*.reg)", Pattern: "*.reg"},
			{DisplayName: "所有文件 (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil {
		return registry.ImportPreviewResult{}, err
	}
	if filePath == "" {
		return registry.ImportPreviewResult{}, nil
	}
	return a.RePreviewRegFile(filePath, hkcrFallback)
}

func (a *App) RePreviewRegFile(filePath string, hkcrFallback string) (registry.ImportPreviewResult, error) {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return registry.ImportPreviewResult{}, fmt.Errorf("读取文件失败: %w", err)
	}
	fallback := registry.Scope(hkcrFallback)
	if fallback != registry.ScopeHKCU && fallback != registry.ScopeHKLM {
		fallback = registry.ScopeHKCU
	}
	return registry.PreviewRegImport(filePath, raw, fallback)
}

func (a *App) ApplyRegImport(filePath string, selectedIDs []string, hkcrFallback string) (registry.ImportApplyResult, error) {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return registry.ImportApplyResult{}, fmt.Errorf("读取导入文件失败: %w", err)
	}
	fallback := registry.Scope(hkcrFallback)
	if fallback != registry.ScopeHKCU && fallback != registry.ScopeHKLM {
		fallback = registry.ScopeHKCU
	}
	return registry.ApplyRegImport(raw, selectedIDs, fallback)
}

func (a *App) BrowseExecutable() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择目标可执行程序",
		Filters: []runtime.FileFilter{
			{DisplayName: "可执行程序 (*.exe;*.bat;*.cmd)", Pattern: "*.exe;*.bat;*.cmd"},
			{DisplayName: "所有文件 (*.*)", Pattern: "*.*"},
		},
	})
}

func (a *App) TestProtocol(uri string) error {
	return winutil.TestLaunchURI(uri)
}

func (a *App) OpenProgramFolder(filePath string) error {
	return winutil.RevealInExplorer(filePath)
}

func (a *App) OpenInRegedit(registryPath string) error {
	return winutil.OpenInRegedit(registryPath)
}

func (a *App) RestartAsAdmin() error {
	if err := winutil.RelaunchAsAdmin(); err != nil {
		return err
	}
	runtime.Quit(a.ctx)
	return nil
}
