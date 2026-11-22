import React from 'react'
import { ChevronRight, Layers, SearchX } from 'lucide-react'
import type { ProtocolItem } from '../types'
import { ProtocolAvatar } from './ProtocolAvatar'

interface ProtocolListProps {
  items: ProtocolItem[]
  selectedId: string | null
  loading: boolean
  hasQuery: boolean
  onSelect: (item: ProtocolItem) => void
  onResetFilter: () => void
}

function HealthBadge({ item }: { item: ProtocolItem }) {
  switch (item.health) {
    case 'ok':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          正常
        </span>
      )
    case 'missing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          路径失效
        </span>
      )
    case 'system':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          系统组件
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          空命令
        </span>
      )
  }
}

export const ProtocolList: React.FC<ProtocolListProps> = ({
  items,
  selectedId,
  loading,
  hasQuery,
  onSelect,
  onResetFilter,
}) => {
  if (loading && items.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/70 dark:border-slate-800/80 px-4 flex items-center gap-3.5 animate-pulse"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-200/80 dark:bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 rounded bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-3 w-64 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3.5">
          <SearchX className="w-7 h-7" />
        </div>
        <p className="text-[15px] font-medium text-slate-700 dark:text-slate-200">
          {hasQuery ? '未找到匹配的自定义 URL 协议' : '当前分类下暂无协议'}
        </p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          {hasQuery ? '尝试更换关键词或清除筛选条件' : '可以点击右上角「新建协议」添加自定义协议'}
        </p>
        {hasQuery && (
          <button
            onClick={onResetFilter}
            className="mt-4 px-3.5 py-1.5 rounded-lg text-[13px] font-medium bg-white dark:bg-[#161B22] text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            清除搜索与筛选
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-2 pb-6">
        {items.map((item) => {
          const selected = item.id === selectedId
          const summaryParts: string[] = []
          if (item.description) summaryParts.push(item.description)
          if (item.executableName) summaryParts.push(item.executableName)
          const subtitle =
            summaryParts.join(' · ') || item.command || item.healthNote

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`w-full text-left group rounded-2xl px-4 py-3.5 flex items-center gap-3.5 border transition-all ${
                selected
                  ? 'bg-indigo-50/70 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/50 shadow-sm'
                  : 'bg-white dark:bg-[#161B22] border-slate-200/75 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-soft'
              }`}
            >
              <ProtocolAvatar name={item.name} iconData={item.iconData} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-mono text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                    {item.name}://
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-medium ${
                      item.scope === 'HKCU'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25'
                        : 'bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {item.scope}
                  </span>

                  {item.shadowsSystem && (
                    <span
                      title="此用户级 (HKCU) 协议优先于同名系统级 (HKLM) 协议生效"
                      className="px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-violet-50 text-violet-700 border border-violet-200/80 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25"
                    >
                      覆盖系统
                    </span>
                  )}

                  {item.isShadowed && (
                    <span
                      title="已被当前用户 (HKCU) 中的同名协议覆盖"
                      className="px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    >
                      已被覆盖
                    </span>
                  )}

                  {item.isComposite && (
                    <span
                      title={`包含其他注册表子键 (${item.compositeKeys?.join(', ')})，删除时受保护`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Layers className="w-3 h-3" />
                      复合键
                    </span>
                  )}
                </div>

                <p
                  title={item.executablePath || item.command || item.description}
                  className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate mt-1"
                >
                  {subtitle}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2.5">
                <HealthBadge item={item} />
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    selected
                      ? 'text-indigo-500 translate-x-0.5'
                      : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5'
                  }`}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
