import React from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ToastMessage } from '../types'

interface ToastProps {
  toasts: ToastMessage[]
}

export const ToastStack: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none max-w-[400px]">
      {toasts.map((t) => {
        const style =
          t.type === 'success'
            ? 'bg-slate-900 dark:bg-emerald-950/95 text-white border-emerald-500/30'
            : t.type === 'error'
              ? 'bg-rose-600 text-white border-rose-400/40'
              : 'bg-slate-800 dark:bg-slate-700 text-white border-slate-600/40'

        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'error'
              ? AlertCircle
              : Info

        return (
          <div
            key={t.id}
            className={`animate-modal pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg text-[13px] font-medium leading-snug ${style}`}
          >
            <Icon className="w-4 h-4 shrink-0 opacity-90" />
            <span className="break-words">{t.text}</span>
          </div>
        )
      })}
    </div>
  )
}
