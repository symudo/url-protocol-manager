import React, { useEffect, useRef, useState } from 'react'
import {
  CheckSquare,
  ChevronDown,
  Download,
  FileDown,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Upload,
  X,
} from 'lucide-react'

export type FilterTab = 'all' | 'hkcu' | 'hklm' | 'missing' | 'empty' | 'system'

interface FilterCounts {
  all: number
  hkcu: number
  hklm: number
  missing: number
  empty: number
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
  selectMode: boolean
  selectedExportCount: number
  filteredCount: number
  allFilteredChecked: boolean
  onRefresh: () => void
  onCreate: () => void
  onImport: () => void
  onExportAll: () => void
  onEnterSelectExport: () => void
  onExitSelectExport: () => void
  onToggleSelectAllFiltered: () => void
  onClearSelectExport: () => void
  onExportSelected: () => void
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
  selectMode,
  selectedExportCount,
  filteredCount,
  allFilteredChecked,
  onRefresh,
  onCreate,
  onImport,
  onExportAll,
  onEnterSelectExport,
  onExitSelectExport,
  onToggleSelectAllFiltered,
  onClearSelectExport,
  onExportSelected,
  onOpenBatchClean,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setExportMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [exportMenuOpen])

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
    ...(counts.empty > 0 || activeTab === 'empty'
      ? [{ id: 'empty' as FilterTab, label: '空命令', count: counts.empty }]
      : []),
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

          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={counts.all === 0}
              className={`h-10 px-3.5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-medium border shadow-soft disabled:opacity-45 transition-all ${
                selectMode || exportMenuOpen
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                  : 'bg-white dark:bg-[#161B22] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/70'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>导出 .reg</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  exportMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {exportMenuOpen && (
              <div className="animate-modal absolute right-0 mt-1.5 w-52 rounded-xl bg-white dark:bg-[#161B22] border border-slate-200/90 dark:border-slate-700/80 shadow-lg p-1.5 z-40">
                <button
                  onClick={() => {
                    setExportMenuOpen(false)
                    onExportAll()
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <div className="font-medium leading-tight">全部导出 (.reg)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      导出全部 {counts.all} 项协议
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setExportMenuOpen(false)
                    onEnterSelectExport()
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ListChecks className="w-4 h-4 text-sky-500 shrink-0" />
                  <div>
                    <div className="font-medium leading-tight">勾选后导出 (.reg)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      按需多选或筛选全选导出
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

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
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono leading-none ${
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

        {counts.cleanable > 0 && !selectMode && (
          <button
            onClick={onOpenBatchClean}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>批量清理 {counts.cleanable} 项失效协议</span>
          </button>
        )}
      </div>

      {/* Multi-select Export Action Bar */}
      {selectMode && (
        <div className="animate-modal px-4 py-2.5 rounded-xl bg-indigo-50/85 dark:bg-indigo-500/10 border border-indigo-200/90 dark:border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-3 text-[12.5px]">
            <button
              type="button"
              disabled={filteredCount === 0}
              onClick={onToggleSelectAllFiltered}
              className="inline-flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-300 hover:underline disabled:opacity-40"
            >
              {allFilteredChecked && filteredCount > 0 ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                {allFilteredChecked && filteredCount > 0
                  ? `取消当前列表 (${filteredCount})`
                  : `全选当前列表 (${filteredCount})`}
              </span>
            </button>

            <span className="text-slate-500 dark:text-slate-400">
              已勾选{' '}
              <strong className="font-mono text-indigo-700 dark:text-indigo-300">
                {selectedExportCount}
              </strong>{' '}
              项
            </span>

            {selectedExportCount > 0 && (
              <button
                type="button"
                onClick={onClearSelectExport}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline-offset-2 hover:underline"
              >
                清空已选
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExitSelectExport}
              className="h-8 px-3 rounded-lg text-[12.5px] font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-100/80 dark:hover:bg-slate-800 transition-colors"
            >
              退出多选
            </button>
            <button
              type="button"
              disabled={selectedExportCount === 0}
              onClick={onExportSelected}
              className="h-8 px-3.5 rounded-lg inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 disabled:opacity-40 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出已选 ({selectedExportCount}) 为 .reg</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
