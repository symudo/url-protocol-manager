import React, { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FolderOpen,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import type { ProtocolItem, ProtocolPayload } from '../types'
import { ProtocolAvatar } from './ProtocolAvatar'

interface DetailDrawerProps {
  item: ProtocolItem | null
  isAdmin: boolean
  onClose: () => void
  onSave: (payload: ProtocolPayload) => Promise<void>
  onDelete: (item: ProtocolItem) => void
  onExport: (item: ProtocolItem) => void
  onBrowseExe: () => Promise<string>
  onTestLaunch: (uri: string) => Promise<void>
  onOpenFolder: (path: string) => Promise<void>
  onRequestAdmin: () => void
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  item,
  isAdmin,
  onClose,
  onSave,
  onDelete,
  onExport,
  onBrowseExe,
  onTestLaunch,
  onOpenFolder,
  onRequestAdmin,
}) => {
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [iconPath, setIconPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)
  const [showTestBox, setShowTestBox] = useState(false)
  const [testUri, setTestUri] = useState('')
  const [testing, setTesting] = useState(false)
  const [discardWarn, setDiscardWarn] = useState(false)

  const prevIdRef = useRef<string | null>(null)
  const justSavedRef = useRef(false)

  useEffect(() => {
    if (!item) {
      prevIdRef.current = null
      setDiscardWarn(false)
      return
    }
    const switchedItem = prevIdRef.current !== item.id
    if (switchedItem || justSavedRef.current) {
      prevIdRef.current = item.id
      justSavedRef.current = false
      setDescription(item.description)
      setCommand(item.command)
      setIconPath(item.iconPath)
      setDiscardWarn(false)
      if (switchedItem) {
        setShowTestBox(false)
        setTestUri(`${item.name}://test`)
      }
    }
  }, [item])

  if (!item) return null

  const needsAdmin = item.scope === 'HKLM' && !isAdmin
  const isDirty =
    description !== item.description ||
    command !== item.command ||
    iconPath !== item.iconPath

  const handleRequestClose = () => {
    if (isDirty && !discardWarn) {
      setDiscardWarn(true)
      return
    }
    setDiscardWarn(false)
    onClose()
  }

  const handleCopyRegPath = async () => {
    try {
      await navigator.clipboard.writeText(item.registryPath)
      setCopiedPath(true)
      setTimeout(() => setCopiedPath(false), 1600)
    } catch {
      // ignore
    }
  }

  const handleBrowse = async () => {
    const selected = await onBrowseExe()
    if (!selected) return
    setCommand(`"${selected}" "%1"`)
    if (!iconPath.trim()) {
      setIconPath(`"${selected}",0`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (needsAdmin || !isDirty || saving) return
    setSaving(true)
    try {
      justSavedRef.current = true
      await onSave({
        name: item.name,
        scope: item.scope,
        description,
        command,
        iconPath,
      })
      setDiscardWarn(false)
    } catch {
      justSavedRef.current = false
    } finally {
      setSaving(false)
    }
  }

  const handleRunTest = async () => {
    if (!testUri.trim() || testing) return
    setTesting(true)
    try {
      await onTestLaunch(testUri.trim())
    } finally {
      setTesting(false)
    }
  }

  return (
    <aside className="animate-drawer w-[460px] shrink-0 h-full bg-white dark:bg-[#161B22] border-l border-slate-200/85 dark:border-slate-800 shadow-drawer flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-200/75 dark:border-slate-800/90">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <ProtocolAvatar name={item.name} iconData={item.iconData} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-[17px] font-bold text-slate-900 dark:text-slate-100 truncate">
                  {item.name}://
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
                    item.scope === 'HKCU'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25'
                      : 'bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {item.scope}
                </span>
              </div>
              <button
                onClick={handleCopyRegPath}
                title="点击复制完整注册表路径"
                className="mt-1 inline-flex items-center gap-1 max-w-full text-[11.5px] font-mono text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors"
              >
                <span className="truncate">{item.registryPath}</span>
                {copiedPath ? (
                  <Check className="w-3 h-3 shrink-0 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 shrink-0" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={isDirty ? '存在未保存修改，点击确认放弃' : '关闭详情 (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {discardWarn && isDirty && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30 flex items-center justify-between gap-2 text-[12px] text-amber-800 dark:text-amber-200">
            <span>当前有未保存的修改，确定放弃并关闭吗？</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setDiscardWarn(false)}
                className="px-2 py-0.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-500/20 font-medium"
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscardWarn(false)
                  onClose()
                }}
                className="px-2 py-0.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 font-medium"
              >
                放弃关闭
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTestBox((v) => !v)}
            className={`flex-1 h-9 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium border transition-colors ${
              showTestBox
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/80'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>测试唤起</span>
          </button>

          <button
            type="button"
            disabled={!item.executablePath}
            onClick={() => onOpenFolder(item.executablePath)}
            title={item.executablePath ? `打开所在位置：${item.executablePath}` : '无有效程序路径'}
            className="flex-1 h-9 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/80 disabled:opacity-40 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>打开目录</span>
          </button>

          <button
            type="button"
            onClick={() => onExport(item)}
            title="导出此协议为 .reg 文件"
            className="h-9 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-800/70 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(item)}
            title="删除或停用此协议"
            className="h-9 w-9 rounded-xl inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200 dark:text-rose-400 dark:hover:bg-rose-500/15 dark:border-slate-700/80 dark:hover:border-rose-500/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Test URI Panel */}
        {showTestBox && (
          <div className="mt-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/25 space-y-2">
            <div className="text-[11.5px] font-medium text-indigo-700 dark:text-indigo-300">
              通过 Windows Shell 测试唤起此协议
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={testUri}
                onChange={(e) => setTestUri(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRunTest()
                  }
                }}
                className="flex-1 h-8 px-2.5 rounded-lg text-[12.5px] font-mono bg-white dark:bg-[#0D1117] text-slate-800 dark:text-slate-100 border border-indigo-200 dark:border-indigo-500/35 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
              />
              <button
                type="button"
                disabled={testing}
                onClick={handleRunTest}
                className="h-8 px-3 rounded-lg text-[12px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
              >
                {testing ? '唤起中...' : '立即唤起'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Context Alerts */}
          {needsAdmin && (
            <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-[12.5px] text-amber-800 dark:text-amber-200 leading-relaxed">
                此协议属于系统级 <span className="font-mono font-semibold">HKLM</span>，修改或删除需要管理员权限。
                <button
                  type="button"
                  onClick={onRequestAdmin}
                  className="ml-1.5 underline font-semibold hover:text-amber-950 dark:hover:text-white"
                >
                  立即提权重启
                </button>
              </div>
            </div>
          )}

          {item.health === 'missing' && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/25 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[12.5px] text-amber-800 dark:text-amber-200 leading-relaxed">
                <span className="font-medium">目标程序不存在：</span>
                <span className="font-mono break-all text-[12px]">{item.executablePath || item.command}</span>
                <div className="mt-0.5 text-[11.5px] opacity-80">
                  软件可能已被卸载但未清理注册表，可重新指定程序路径或直接删除。
                </div>
              </div>
            </div>
          )}

          {(item.isShadowed || item.shadowsSystem) && (
            <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/25 text-[12px] text-violet-800 dark:text-violet-200 leading-relaxed">
              {item.shadowsSystem
                ? '此用户级 (HKCU) 协议与系统级 (HKLM) 同名，Windows 将优先使用当前这一项。'
                : '当前用户 (HKCU) 中存在同名协议，此系统级 (HKLM) 配置目前被覆盖，修改它不会对当前用户生效。'}
            </div>
          )}

          {item.isComposite && (
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
              检测到复合注册表子键（<span className="font-mono">{item.compositeKeys?.join(', ')}</span>）。保存修改时不会触碰这些子键，删除时可选择“安全停用”。
            </div>
          )}

          {/* Editable Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                协议描述 <span className="text-slate-400 font-normal">(默认值)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={needsAdmin}
                placeholder={`URL:${item.name} Protocol`}
                className="w-full h-10 px-3.5 rounded-xl text-[13px] bg-slate-50/70 dark:bg-[#0D1117] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
                  启动命令 <span className="text-slate-400 font-normal">(shell\open\command)</span>
                </label>
                {!needsAdmin && (
                  <button
                    type="button"
                    onClick={handleBrowse}
                    className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    选择程序...
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={needsAdmin}
                placeholder={`"C:\\Path\\To\\App.exe" "%1"`}
                className="w-full p-3 rounded-xl text-[12.5px] font-mono leading-relaxed bg-slate-50/70 dark:bg-[#0D1117] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 resize-none transition-all"
              />
              {item.executablePath && (
                <p className="mt-1.5 text-[11.5px] text-slate-400 dark:text-slate-500 font-mono truncate" title={item.executablePath}>
                  解析程序：{item.executablePath}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
                  图标路径 <span className="text-slate-400 font-normal">(DefaultIcon，可选)</span>
                </label>
                {!needsAdmin && item.executablePath && (
                  <button
                    type="button"
                    onClick={() => setIconPath(`"${item.executablePath}",0`)}
                    className="text-[12px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                  >
                    同步程序图标
                  </button>
                )}
              </div>
              <input
                type="text"
                value={iconPath}
                onChange={(e) => setIconPath(e.target.value)}
                disabled={needsAdmin}
                placeholder={`"C:\\Path\\To\\App.exe",0`}
                className="w-full h-10 px-3.5 rounded-xl text-[12.5px] font-mono bg-slate-50/70 dark:bg-[#0D1117] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 transition-all"
              />
            </div>

            {/* Metadata summary */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-[12px]">
              <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#0D1117]/70 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 dark:text-slate-500 text-[11px]">检测状态</div>
                <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                  {item.healthNote}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#0D1117]/70 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 dark:text-slate-500 text-[11px]">协议类型</div>
                <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                  {item.isUwp ? '系统 / UWP 协议' : '标准自定义协议'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0D1117]/60 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={!isDirty || saving}
            onClick={() => {
              setDescription(item.description)
              setCommand(item.command)
              setIconPath(item.iconPath)
            }}
            className="h-9 px-3.5 rounded-xl inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-35 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>还原</span>
          </button>

          <button
            type="submit"
            disabled={needsAdmin || !isDirty || saving}
            className="h-9 px-5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 disabled:opacity-40 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? '保存中...' : '保存修改'}</span>
          </button>
        </div>
      </form>
    </aside>
  )
}
