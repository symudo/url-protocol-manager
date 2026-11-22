import React, { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert, Trash2, X } from 'lucide-react'
import type { DeleteMode, ProtocolItem } from '../types'

interface DeleteModalProps {
  item: ProtocolItem | null
  isAdmin: boolean
  onClose: () => void
  onConfirm: (item: ProtocolItem, mode: DeleteMode) => Promise<void>
  onRequestAdmin: () => void
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  item,
  isAdmin,
  onClose,
  onConfirm,
  onRequestAdmin,
}) => {
  const [mode, setMode] = useState<DeleteMode>('full')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (item) {
      // Default to safe disable mode for composite or system/UWP protocols
      setMode(item.isComposite || item.isUwp ? 'disable' : 'full')
    }
  }, [item])

  if (!item) return null

  const needsAdmin = item.scope === 'HKLM' && !isAdmin
  const isProtected = item.isComposite || item.isUwp

  const handleConfirm = async () => {
    if (needsAdmin || deleting) return
    setDeleting(true)
    try {
      await onConfirm(item, mode)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]">
      <div className="animate-modal w-full max-w-[490px] rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/90 dark:border-slate-800 shadow-modal overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-[15.5px] font-semibold text-slate-900 dark:text-slate-100">
              删除自定义 URL 协议
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[14.5px] font-bold text-slate-900 dark:text-slate-100">
                {item.name}://
              </span>
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {item.scope}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11.5px] text-slate-500 dark:text-slate-400 break-all">
              {item.registryPath}
            </div>
          </div>

          {item.hasSameInOtherScope && (
            <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200/70 dark:border-sky-500/25 text-[12px] text-sky-800 dark:text-sky-200">
              提示：另一作用域（{item.scope === 'HKCU' ? 'HKLM' : 'HKCU'}）也存在同名协议，本次操作仅影响当前选中的{' '}
              <span className="font-mono font-semibold">{item.scope}</span>。
            </div>
          )}

          {isProtected && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 flex items-start gap-2.5 text-[12.5px] text-amber-800 dark:text-amber-200 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                检测到此协议属于{' '}
                <strong>
                  {item.isUwp ? '系统 / UWP 组件' : `复合注册表项 (${item.compositeKeys?.join(', ')})`}
                </strong>
                ，直接递归删除整棵树可能影响关联组件，建议选择「安全停用」。
              </div>
            </div>
          )}

          {/* Strategy Selector */}
          <div className="space-y-2.5">
            <div className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
              选择删除策略
            </div>

            <label
              className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                mode === 'full'
                  ? 'border-rose-400 bg-rose-50/50 dark:border-rose-500/60 dark:bg-rose-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={mode === 'full'}
                  onChange={() => setMode('full')}
                  className="mt-1 accent-rose-600"
                />
                <div>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    彻底递归删除整棵注册表树 {!isProtected && <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400 ml-1">推荐</span>}
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    连同根节点及 DefaultIcon、shell\open\command 等所有子文件夹一并清空，不留空壳残留。
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                mode === 'disable'
                  ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-500/60 dark:bg-indigo-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={mode === 'disable'}
                  onChange={() => setMode('disable')}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    安全停用（仅移除 URL Protocol 标志） {isProtected && <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 ml-1">推荐</span>}
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    使其不再作为 URL 协议被唤起，同时完整保留所有子键和其他系统关联。
                  </p>
                </div>
              </div>
            </label>
          </div>

          {needsAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 flex items-center gap-2 text-[12px] text-amber-800 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                删除系统级 HKLM 协议需要管理员权限。
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
        </div>

        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0D1117]/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={needsAdmin || deleting}
            onClick={handleConfirm}
            className={`h-9 px-5 rounded-xl text-[13px] font-medium text-white shadow-sm disabled:opacity-40 transition-all ${
              mode === 'full'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
            }`}
          >
            {deleting ? '执行中...' : mode === 'full' ? '确认彻底删除' : '确认安全停用'}
          </button>
        </div>
      </div>
    </div>
  )
}
