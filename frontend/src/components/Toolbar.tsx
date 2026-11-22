import React from 'react'
import {
  Download,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

export type FilterTab = 'all' | 'hkcu' | 'hklm' | 'missing' | 'system'

interface FilterCounts {
  all: number
  hkcu: number
  hklm: number
  missing: number
  system: number
  cleanable: number
}

interface ToolbarProps {
  searchInputRef: React.RefObject<HTMLInputElement>
  query: string
  onQueryChange: (q: string) => void
  activeTab: FilterTab
  onTabChange: (tab: FilterTab) => void
  counts: FilterCounts
  loading: boolean
  onRefresh: () => void
  onCreate: () => void
  onImport: () => void
  onExportAll: () => void
  onOpenBatchClean: () => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchInputRef,
  query,
  onQueryChange,
  activeTab,
  onTabChange,
  counts,
  loading,
  onRefresh,
  onCreate,
  onImport,
  onExportAll,
  onOpenBatchClean,
}) => {
  const tabs: { id: FilterTab; label: string; count: number; accent?: string }[] = [
    { id: 'all', label: '全部协议', count: counts.all },
    { id: 'hkcu', label: '用户级 HKCU', count: counts.hkcu },
    { id: 'hklm', label: '系统级 HKLM', count: counts.hklm },
    {
      id: 'missing',
      label: '路径失效',
      count: counts.missing,
      accent: counts.missing > 0 ? 'amber' : undefined,
    },
    { id: 'system', label: '系统 / UWP', count: counts.system },
  ]

  return (
    <div className="shrink-0 px-6 pt-5 pb-4 bg-[#F8FAFC] dark:bg-[#0D1117] border-b border-slate-200/70 dark:border-slate-800/80 space-y-3.5">
      {/* Top Row: Search + Primary Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索协议名、描述或程序路径..."
            className="w-full h-10 pl-10 pr-20 rounded-xl text-[13.5px] bg-white dark:bg-[#161B22] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200/90 dark:border-slate-700/80 shadow-soft focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all"
          />
          {query ? (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="清空搜索"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              Ctrl K
            </kbd>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="h-10 px-3.5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium bg-white dark:bg-[#161B22] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/70 shadow-soft transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>导入 .reg</span>
          </button>

          <button
            onClick={onExportAll}
            disabled={counts.all === 0}
            className="h-10 px-3.5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium bg-white dark:bg-[#161B22] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/70 shadow-soft disabled:opacity-45 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>备份全部</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="重新扫描注册表"
            className="h-10 w-10 rounded-xl inline-flex items-center justify-center bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/70 shadow-soft transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          <button
            onClick={onCreate}
            className="h-10 px-4 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm shadow-indigo-600/25 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.3]" />
            <span>新建协议</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Filter Pills + Stale Cleanup Action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-indigo-500 dark:text-white shadow-sm'
                    : 'bg-white/80 dark:bg-[#161B22] text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                    active
                      ? 'bg-white/20 text-white'
                      : tab.accent === 'amber'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {counts.cleanable > 0 && (
          <button
            onClick={onOpenBatchClean}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>批量清理 {counts.cleanable} 项失效协议</span>
          </button>
        )}
      </div>
    </div>
  )
}
