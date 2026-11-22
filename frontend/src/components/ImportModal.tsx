import React, { useEffect, useState } from 'react'
import { CheckSquare, FileCode2, ShieldAlert, Square, Upload, X } from 'lucide-react'
import type { ImportPreviewResult, Scope } from '../types'

interface ImportModalProps {
  preview: ImportPreviewResult | null
  hkcrFallback: Scope
  isAdmin: boolean
  onChangeHkcrFallback: (scope: Scope) => Promise<void>
  onClose: () => void
  onConfirm: (selectedIds: string[]) => Promise<void>
  onRequestAdmin: () => void
}

export const ImportModal: React.FC<ImportModalProps> = ({
  preview,
  hkcrFallback,
  isAdmin,
  onChangeHkcrFallback,
  onClose,
  onConfirm,
  onRequestAdmin,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (preview) {
      // Pre-select all items that do not require elevation (or all if admin)
      const initial = new Set<string>()
      for (const it of preview.items) {
        if (!it.needsAdmin) {
          initial.add(it.id)
        }
      }
      setSelectedIds(initial)
    }
  }, [preview])

  if (!preview) return null

  const hasHkcrItems = preview.items.some((i) => i.fromHkcr)
  const selectedItems = preview.items.filter((i) => selectedIds.has(i.id))
  const selectedNeedsAdmin = selectedItems.some((i) => i.needsAdmin)

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === preview.items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(preview.items.map((i) => i.id)))
    }
  }

  const handleImport = async () => {
    if (selectedIds.size === 0 || selectedNeedsAdmin || importing) return
    setImporting(true)
    try {
      await onConfirm(Array.from(selectedIds))
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]">
      <div className="animate-modal w-full max-w-[600px] max-h-[82vh] flex flex-col rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/90 dark:border-slate-800 shadow-modal overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15.5px] font-semibold text-slate-900 dark:text-slate-100">
                导入 .reg 注册表文件预览
              </h3>
              <p className="text-[11.5px] font-mono text-slate-400 truncate" title={preview.filePath}>
                {preview.filePath}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {preview.items.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-[14.5px] font-medium text-slate-700 dark:text-slate-200">
                未在此文件中检测到有效的自定义 URL 协议
              </p>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                仅解析包含 <code className="font-mono">"URL Protocol"</code> 标志的协议注册表项（已忽略 {preview.skippedKeys} 个非协议节）。
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {selectedIds.size === preview.items.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>
                      已选 {selectedIds.size} / {preview.items.length} 项
                    </span>
                  </button>
                  {preview.skippedKeys > 0 && (
                    <span className="text-slate-400">
                      · 自动过滤 {preview.skippedKeys} 个非协议节
                    </span>
                  )}
                </div>

                {hasHkcrItems && (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                      HKCR 目标作用域:
                    </span>
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-700">
                      {(['HKCU', 'HKLM'] as Scope[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onChangeHkcrFallback(s)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium transition-colors ${
                            hkcrFallback === s
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                              : 'text-slate-500'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedNeedsAdmin && !isAdmin && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    勾选的条目中包含系统级 HKLM 协议，需管理员权限导入。
                    <button
                      type="button"
                      onClick={onRequestAdmin}
                      className="ml-1 underline font-semibold"
                    >
                      立即提权重启
                    </button>
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {preview.items.map((item) => {
                  const checked = selectedIds.has(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        checked
                          ? 'bg-indigo-50/45 dark:bg-indigo-500/10 border-indigo-300/80 dark:border-indigo-500/40'
                          : 'bg-slate-50/50 dark:bg-[#0D1117]/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item.id)}
                        className="mt-1 accent-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-mono text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
                            {item.name}://
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.scope}
                          </span>
                          {item.fromHkcr && (
                            <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                              源自 HKCR
                            </span>
                          )}
                          {item.exists && (
                            <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                              已存在 · 将覆盖
                            </span>
                          )}
                          {item.needsAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                              需管理员权限
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] font-mono text-slate-500 dark:text-slate-400 truncate mt-1" title={item.command}>
                          {item.command || item.description || '(无启动命令)'}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0D1117]/60 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            取消
          </button>
          {preview.items.length > 0 && (
            <button
              type="button"
              disabled={selectedIds.size === 0 || selectedNeedsAdmin || importing}
              onClick={handleImport}
              className="h-9 px-5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 disabled:opacity-40 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{importing ? '导入中...' : `确认导入 (${selectedIds.size})`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
