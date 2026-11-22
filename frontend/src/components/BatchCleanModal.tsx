import React, { useEffect, useState } from 'react'
import { CheckSquare, ShieldAlert, Sparkles, Square, X } from 'lucide-react'
import type { ProtocolItem, ProtocolRef } from '../types'

interface BatchCleanModalProps {
  open: boolean
  items: ProtocolItem[]
  isAdmin: boolean
  onClose: () => void
  onConfirm: (refs: ProtocolRef[], backupFirst: boolean) => Promise<void>
  onRequestAdmin: () => void
}

export const BatchCleanModal: React.FC<BatchCleanModalProps> = ({
  open,
  items,
  isAdmin,
  onClose,
  onConfirm,
  onRequestAdmin,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [backupFirst, setBackupFirst] = useState(true)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    if (open) {
      const initial = new Set<string>()
      for (const it of items) {
        if (it.scope === 'HKCU' || isAdmin) {
          initial.add(it.id)
        }
      }
      setSelectedIds(initial)
      setBackupFirst(true)
    }
  }, [open, items, isAdmin])

  if (!open) return null

  const selectedItems = items.filter((i) => selectedIds.has(i.id))
  const needsAdmin = selectedItems.some((i) => i.scope === 'HKLM' && !isAdmin)

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  const handleClean = async () => {
    if (selectedItems.length === 0 || needsAdmin || cleaning) return
    setCleaning(true)
    try {
      const refs: ProtocolRef[] = selectedItems.map((i) => ({
        scope: i.scope,
        name: i.name,
      }))
      await onConfirm(refs, backupFirst)
      onClose()
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]">
      <div className="animate-modal w-full max-w-[580px] max-h-[82vh] flex flex-col rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/90 dark:border-slate-800 shadow-modal overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15.5px] font-semibold text-slate-900 dark:text-slate-100">
                批量清理失效协议
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                已自动排除系统/UWP 组件及复合注册表键，仅列出确认程序缺失的残留项
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
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {selectedIds.size === items.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                已选 {selectedIds.size} / {items.length} 项失效残留
              </span>
            </button>
          </div>

          {needsAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                已勾选项中包含系统级 HKLM 协议，清理需管理员权限。
                <button
                  type="button"
                  onClick={onRequestAdmin}
                  className="ml-1 underline font-semibold"
                >
                  以管理员身份重启
                </button>
              </span>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item) => {
              const checked = selectedIds.has(item.id)
              const hklmLocked = item.scope === 'HKLM' && !isAdmin
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-amber-50/60 dark:bg-amber-500/10 border-amber-300/80 dark:border-amber-500/40'
                      : 'bg-slate-50/50 dark:bg-[#0D1117]/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item.id)}
                    className="mt-1 accent-amber-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}://
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.scope}
                      </span>
                      {hklmLocked && (
                        <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                          需管理员权限
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[11.5px] font-mono text-slate-500 dark:text-slate-400 truncate mt-1"
                      title={item.executablePath || item.command}
                    >
                      缺失路径：{item.executablePath || item.command}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0D1117]/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={backupFirst}
              onChange={(e) => setBackupFirst(e.target.checked)}
              className="accent-indigo-600"
            />
            <span>清理前先导出 .reg 备份（推荐）</span>
          </label>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              disabled={selectedItems.length === 0 || needsAdmin || cleaning}
              onClick={handleClean}
              className="h-9 px-5 rounded-xl text-[13px] font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 disabled:opacity-40 transition-all"
            >
              {cleaning ? '清理中...' : `彻底清理 (${selectedItems.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
