# URL 协议管理器 (URL Protocol Manager)

一款简约、美观、轻量级的 Windows 自定义 URL 协议注册表管理工具。基于 **Go + Wails v2 + React + Tailwind CSS** 构建，原生操作 Windows 注册表与 Win32 API，界面现代流畅，开箱即用。

## 核心特性

- **双源精准扫描**：独立扫描 `HKCU\Software\Classes`（当前用户）与 `HKLM\SOFTWARE\Classes`（系统全局），清晰呈现作用域归属与同名覆盖关系。
- **完整增删改查**：
  - **新建**：自动校验协议名规范，选取 `.exe` 自动生成标准 4 层注册表结构（含 `DefaultIcon` 与 `shell\open\command`）。
  - **编辑与验证**：增量更新不破坏无关注册表键值；内置**一键测试唤起**与**定位程序目录**。
  - **分级删除**：普通协议递归彻底清空（`RegDeleteTreeW`）；遇到含 `CLSID` / `shellex` 等复合键或系统 UWP 协议时自动保护，支持**安全停用**（仅移除 `URL Protocol` 标志）。
- **失效体检与批量清理**：自动展开环境变量并检测目标 `.exe` 存在性，一键批量清理卸载残留（自动排除系统/UWP 及复合键，清理前默认备份 `.reg`）。
- **标准 `.reg` 导入/导出**：导出原生兼容的 UTF-16LE `.reg` 文件；导入前支持逐条预览、冲突检测与 `HKCR` 目标作用域指定。
- **按需 UAC 提权**：默认普通权限静默启动，读写 HKCU 免打扰；操作 HKLM 时可一键以管理员身份重启。
- **三态现代主题**：默认浅色极简风，支持一键切换**浅色 / 深色 / 自动跟随系统**。

## 下载与版本说明

请前往本仓库的 **Releases** 页面按需下载：

| 形态 | 文件名示例 | 适用场景 |
| :--- | :--- | :--- |
| **单文件版** | `UrlProtocolManager-vX.Y.Z-windows-amd64-single.exe` | 双击即用，无任何外部依赖或配置文件残留 |
| **便携版** | `UrlProtocolManager-vX.Y.Z-windows-amd64-portable.zip` | 绿色解压包，适合放入便携工具目录 |
| **安装版** | `UrlProtocolManager-vX.Y.Z-windows-amd64-setup.exe` | 标准 Windows 安装程序，支持开始菜单与控制面板卸载 |

> 系统要求：Windows 10 / 11 (x64)，内置 Microsoft Edge WebView2 运行时即可运行。

## 本地开发与构建

```bash
# 安装 Wails v2 CLI
go install github.com/wailsapp/wails/v2/cmd/wails@v2.17.1

# 运行单元测试与注册表集成测试
go test -v ./...

# 生产构建单文件版
wails build -clean

# 生产构建 Windows 安装包（需安装 NSIS）
wails build -clean -nsis
```

## 开源协议

基于 [MIT License](./LICENSE) 开源。
