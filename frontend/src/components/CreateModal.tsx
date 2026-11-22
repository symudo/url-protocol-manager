import React, { useEffect, useState } from 'react'
import { FolderSearch, Plus, ShieldAlert, X } from 'lucide-react'
import type { ProtocolPayload, Scope } from '../types'

interface CreateModalProps {
  open: boolean
  isAdmin: boolean
  onClose: () => void
  onSubmit: (payload: ProtocolPayload) => Promise<void>
  onBrowseExe: () => Promise<string>
  onRequestAdmin: () => void
}

const SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]{0,63}$/

export const CreateModal: React.FC<CreateModalProps> = ({
  open,
  isAdmin,
  onClose,
  onSubmit,
  onBrowseExe,
  onRequestAdmin,
}) => {
  const [name, setName] = useState('')
  const [scope, setScope] = useState<Scope>('HKCU')
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [iconPath, setIconPath] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setScope('HKCU')
      setDescription('')
      setCommand('')
      setIconPath('')
    }
  }, [open])

  if (!open) return null

  const trimmedName = name.trim()
  const nameValid = trimmedName !== '' && SCHEME_REGEX.test(trimmedName)
  const needsAdmin = scope === 'HKLM' && !isAdmin
  const canSubmit = nameValid && command.trim() !== '' && !needsAdmin && !submitting

  const handleBrowse = async () => {
    const selected = await onBrowseExe()
    if (!selected) return
    setCommand(`"${selected}" "%1"`)
    setIconPath(`"${selected}",0`)
    if (!description.trim() && trimmedName) {
      setDescription(`URL:${trimmedName} Protocol`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        name: trimmedName,
        scope,
        description: description.trim() || `URL:${trimmedName} Protocol`,
        command: command.trim(),
        iconPath: iconPath.trim(),
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const regPrefix =
    scope === 'HKCU'
      ? 'HKEY_CURRENT_USER\\Software\\Classes'
      : 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Classes'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]">
      <div className="animate-modal w-full max-w-[540px] rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/90 dark:border-slate-800 shadow-modal overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
              新建自定义 URL 协议
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              自动在注册表中创建标准 4 层协议结构，并即时在 HKEY_CLASSES_ROOT 生效
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Scope & Scheme Name */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-3">
              <label className="block text-[12.5px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                协议名称 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如 myapp"
                  className="w-full h-10 pl-3.5 pr-10 rounded-xl text-[13.5px] font-mono bg-slate-50/70 dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12.5px] text-slate-400">
                  ://
                </span>
              </div>
              {trimmedName && !nameValid && (
                <p className="mt-1 text-[11.5px] text-rose-500">
                  须以英文字母开头，仅支持字母、数字、+、-、.
                </p>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-[12.5px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                注册表作用域
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800 h-10">
                {(['HKCU', 'HKLM'] as Scope[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`rounded-lg text-[12px] font-mono font-medium transition-all ${
                      scope === s
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {needsAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                写入系统级 HKLM 需要管理员权限（推荐选 HKCU 免提权，或
                <button
                  type="button"
                  onClick={onRequestAdmin}
                  className="ml-1 underline font-semibold"
                >
                  以管理员重启
                </button>
                ）。
              </span>
            </div>
          )}

          {/* Command + Browse Exe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
                启动命令 <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleBrowse}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <FolderSearch className="w-3.5 h-3.5" />
                <span>浏览选择 .exe 程序</span>
              </button>
            </div>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={`"C:\\Path\\To\\App.exe" "%1"`}
              className="w-full h-10 px-3.5 rounded-xl text-[12.5px] font-mono bg-slate-50/70 dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          {/* Description & Icon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                协议描述 <span className="text-slate-400 font-normal">(可选)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={trimmedName ? `URL:${trimmedName} Protocol` : 'URL:MyApp Protocol'}
                className="w-full h-10 px-3.5 rounded-xl text-[13px] bg-slate-50/70 dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                图标路径 <span className="text-slate-400 font-normal">(可选)</span>
              </label>
              <input
                type="text"
                value={iconPath}
                onChange={(e) => setIconPath(e.target.value)}
                placeholder={`"C:\\Path\\To\\App.exe",0`}
                className="w-full h-10 px-3.5 rounded-xl text-[12.5px] font-mono bg-slate-50/70 dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 focus:bg-white dark:focus:bg-[#0D1117] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          {/* Live Registry Path Preview */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0D1117] border border-slate-200/75 dark:border-slate-800 text-[11.5px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
            <div className="text-[11px] font-sans font-medium text-slate-400 dark:text-slate-500 mb-1">
              写入注册表路径预览
            </div>
            <div className="truncate text-slate-700 dark:text-slate-300">
              {regPrefix}\{trimmedName || '<协议名>'}\shell\open\command
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 px-5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/25 disabled:opacity-40 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? '创建中...' : '创建协议'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
