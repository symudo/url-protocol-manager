import React from 'react'
import {
  Link2,
  Minus,
  Monitor,
  Moon,
  Shield,
  ShieldCheck,
  Square,
  Sun,
  X,
} from 'lucide-react'
import type { ThemeMode } from '../types'
import { windowControls } from '../api'

interface TitleBarProps {
  version: string
  isAdmin: boolean
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  onRequestAdmin: () => void
}

export const TitleBar: React.FC<TitleBarProps> = ({
  version,
  isAdmin,
  themeMode,
  onThemeChange,
  onRequestAdmin,
}) => {
  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: '浅色', icon: <Sun className="w-3.5 h-3.5" /> },
    { value: 'dark', label: '深色', icon: <Moon className="w-3.5 h-3.5" /> },
    { value: 'system', label: '跟随系统', icon: <Monitor className="w-3.5 h-3.5" /> },
  ]

  return (
    <header className="wails-drag h-12 shrink-0 flex items-center justify-between px-4 bg-white/90 dark:bg-[#161B22]/95 border-b border-slate-200/80 dark:border-slate-800/90 backdrop-blur-md">
      {/* Left: App Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
          <Link2 className="w-4 h-4 stroke-[2.25]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            URL 协议管理器
          </span>
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            v{version}
          </span>
        </div>
      </div>

      {/* Right: UAC Status + Theme Switcher + Window Controls */}
      <div className="wails-nodrag flex items-center gap-2.5">
        {isAdmin ? (
          <div
            title="当前以管理员身份运行，可自由修改 HKCU 与 HKLM 协议"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>管理员权限</span>
          </div>
        ) : (
          <button
            onClick={onRequestAdmin}
            title="当前为标准用户权限（可读写 HKCU）。点击以管理员身份重启以修改系统级 HKLM 协议"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200/80 hover:border-amber-200 dark:bg-slate-800/80 dark:hover:bg-amber-500/15 dark:text-slate-300 dark:hover:text-amber-300 dark:border-slate-700/80 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>标准权限 · 提权</span>
          </button>
        )}

        {/* 3-State Theme Selector */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70">
          {themeOptions.map((opt) => {
            const active = themeMode === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onThemeChange(opt.value)}
                title={`主题：${opt.label}`}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  active
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            )
          })}
        </div>

        {/* Window Controls */}
        <div className="flex items-center ml-1 pl-2 border-l border-slate-200/80 dark:border-slate-800">
          <button
            onClick={() => windowControls.minimise()}
            title="最小化"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => windowControls.toggleMaximise()}
            title="最大化 / 还原"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => windowControls.quit()}
            title="关闭"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-rose-500 dark:text-slate-400 dark:hover:text-white dark:hover:bg-rose-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
