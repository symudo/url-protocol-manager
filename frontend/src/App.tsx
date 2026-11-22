import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileCode2 } from 'lucide-react'
import { api, formatError, windowControls } from './api'
import { useTheme } from './hooks/useTheme'
import { TitleBar } from './components/TitleBar'
import { Toolbar, type FilterTab } from './components/Toolbar'
import { ProtocolList } from './components/ProtocolList'
import { DetailDrawer } from './components/DetailDrawer'
import { CreateModal } from './components/CreateModal'
import { DeleteModal } from './components/DeleteModal'
import { ImportModal } from './components/ImportModal'
import { BatchCleanModal } from './components/BatchCleanModal'
import { ToastStack } from './components/Toast'
import type {
  AppInfo,
  DeleteMode,
  ImportPreviewResult,
  ProtocolItem,
  ProtocolPayload,
  ProtocolRef,
  Scope,
  ToastMessage,
} from './types'

export default function App() {
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  const [appInfo, setAppInfo] = useState<AppInfo>({ version: '1.1.0', isAdmin: false })
  const [protocols, setProtocols] = useState<ProtocolItem[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [checkedExportIds, setCheckedExportIds] = useState<Set<string>>(new Set())

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProtocolItem | null>(null)
  const [batchCleanOpen, setBatchCleanOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  const [hkcrFallback, setHkcrFallback] = useState<Scope>('HKCU')
  const [draggingFile, setDraggingFile] = useState(false)

  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toastIdRef = useRef(1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  const notify = useCallback((type: ToastMessage['type'], text: string) => {
    const id = toastIdRef.current++
    setToasts((prev) => [...prev.slice(-2), { id, type, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3600)
  }, [])

  const loadProtocols = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listProtocols()
      setProtocols(list || [])
    } catch (err) {
      notify('error', `扫描注册表失败：${formatError(err)}`)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    api
      .getAppInfo()
      .then((info) => {
        setAppInfo(info)
        if (info.isAdmin) setHkcrFallback('HKLM')
      })
      .catch(() => {})
    loadProtocols()
  }, [loadProtocols])

  // Drag-and-drop .reg file directly onto window to trigger import preview
  useEffect(() => {
    windowControls.onFileDrop((_x, _y, paths) => {
      dragDepthRef.current = 0
      setDraggingFile(false)
      if (!paths || paths.length === 0) return
      const regFile = paths.find((p) => p.toLowerCase().endsWith('.reg'))
      if (!regFile) {
        notify('info', '请拖入 .reg 格式的 Windows 注册表文件')
        return
      }
      api
        .rePreviewRegFile(regFile, hkcrFallback)
        .then((preview) => {
          if (preview && preview.filePath) {
            setImportPreview(preview)
          }
        })
        .catch((err) => {
          notify('error', `解析拖入文件失败：${formatError(err)}`)
        })
    })

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        dragDepthRef.current++
        setDraggingFile(true)
      }
    }
    const onDragLeave = () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDraggingFile(false)
    }
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      dragDepthRef.current = 0
      setDraggingFile(false)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      windowControls.offFileDrop()
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [hkcrFallback, notify])

  const counts = useMemo(() => {
    let hkcu = 0
    let hklm = 0
    let missing = 0
    let empty = 0
    let system = 0
    let cleanable = 0
    for (const p of protocols) {
      if (p.scope === 'HKCU') hkcu++
      else hklm++
      if (p.health === 'missing') missing++
      if (p.health === 'empty') empty++
      if (p.health === 'system') system++
      if (p.cleanable) cleanable++
    }
    return { all: protocols.length, hkcu, hklm, missing, empty, system, cleanable }
  }, [protocols])

  const cleanableItems = useMemo(
    () => protocols.filter((p) => p.cleanable),
    [protocols],
  )

  const filteredProtocols = useMemo(() => {
    const q = query.trim().toLowerCase()
    return protocols.filter((p) => {
      if (activeTab === 'hkcu' && p.scope !== 'HKCU') return false
      if (activeTab === 'hklm' && p.scope !== 'HKLM') return false
      if (activeTab === 'missing' && p.health !== 'missing') return false
      if (activeTab === 'empty' && p.health !== 'empty') return false
      if (activeTab === 'system' && p.health !== 'system') return false

      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q) ||
        p.executableName.toLowerCase().includes(q) ||
        p.executablePath.toLowerCase().includes(q)
      )
    })
  }, [protocols, activeTab, query])

  const hasModalOpen = Boolean(deleteTarget || createOpen || importPreview || batchCleanOpen)

  // Global keyboard shortcuts: Ctrl+K focuses search, Esc closes overlays, ArrowUp/Down navigates list
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null)
        else if (createOpen) setCreateOpen(false)
        else if (importPreview) setImportPreview(null)
        else if (batchCleanOpen) setBatchCleanOpen(false)
        else if (selectMode) {
          setSelectMode(false)
          setCheckedExportIds(new Set())
        } else if (selectedId) setSelectedId(null)
      } else if (
        (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        !hasModalOpen &&
        !selectMode &&
        filteredProtocols.length > 0
      ) {
        const tag = (document.activeElement?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        e.preventDefault()
        const curIdx = filteredProtocols.findIndex((p) => p.id === selectedId)
        let nextIdx = 0
        if (e.key === 'ArrowDown') {
          nextIdx = curIdx < 0 ? 0 : Math.min(filteredProtocols.length - 1, curIdx + 1)
        } else {
          nextIdx = curIdx <= 0 ? 0 : curIdx - 1
        }
        const nextId = filteredProtocols[nextIdx].id
        setSelectedId(nextId)
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-protocol-id="${CSS.escape(nextId)}"]`)
          el?.scrollIntoView({ block: 'nearest' })
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteTarget, createOpen, importPreview, batchCleanOpen, selectMode, selectedId, hasModalOpen, filteredProtocols])

  const selectedItem = useMemo(
    () => protocols.find((p) => p.id === selectedId) || null,
    [protocols, selectedId],
  )

  const selectedExportItems = useMemo(
    () => protocols.filter((p) => checkedExportIds.has(p.id)),
    [protocols, checkedExportIds],
  )

  const allFilteredChecked = useMemo(
    () =>
      filteredProtocols.length > 0 &&
      filteredProtocols.every((p) => checkedExportIds.has(p.id)),
    [filteredProtocols, checkedExportIds],
  )

  const handleRequestAdmin = async () => {
    try {
      await api.restartAsAdmin()
    } catch (err) {
      notify('error', formatError(err))
    }
  }

  const handleCreate = async (payload: ProtocolPayload) => {
    try {
      await api.createProtocol(payload)
      notify('success', `已创建协议 ${payload.name}:// (${payload.scope})`)
      setSelectMode(false)
      setCheckedExportIds(new Set())
      await loadProtocols()
      setSelectedId(`${payload.scope}:${payload.name.trim()}`)
    } catch (err) {
      notify('error', formatError(err))
      throw err
    }
  }

  const handleSaveUpdate = async (payload: ProtocolPayload) => {
    try {
      await api.updateProtocol(payload)
      notify('success', `已保存 ${payload.name}:// 的修改`)
      await loadProtocols()
    } catch (err) {
      notify('error', formatError(err))
      throw err
    }
  }

  const handleConfirmDelete = async (item: ProtocolItem, mode: DeleteMode) => {
    try {
      await api.deleteProtocol(item.scope, item.name, mode)
      notify(
        'success',
        mode === 'full'
          ? `已彻底删除 ${item.name}:// (${item.scope})`
          : `已安全停用 ${item.name}:// (${item.scope})`,
      )
      if (selectedId === item.id) {
        setSelectedId(null)
      }
      await loadProtocols()
    } catch (err) {
      notify('error', formatError(err))
      throw err
    }
  }

  const handleExportOne = async (item: ProtocolItem) => {
    try {
      const saved = await api.exportProtocols(
        [{ scope: item.scope, name: item.name }],
        `${item.name}-${item.scope}.reg`,
      )
      if (saved) notify('success', `已导出至 ${saved}`)
    } catch (err) {
      notify('error', `导出失败：${formatError(err)}`)
    }
  }

  const handleExportAll = async () => {
    if (protocols.length === 0) return
    try {
      const refs: ProtocolRef[] = protocols.map((p) => ({
        scope: p.scope,
        name: p.name,
      }))
      const saved = await api.exportProtocols(refs, 'all-url-protocols-backup.reg')
      if (saved) notify('success', `已导出全部 ${refs.length} 项协议至 ${saved}`)
    } catch (err) {
      notify('error', `导出失败：${formatError(err)}`)
    }
  }

  const handleEnterSelectExport = () => {
    setSelectedId(null)
    setSelectMode(true)
    setCheckedExportIds(new Set())
  }

  const handleExitSelectExport = () => {
    setSelectMode(false)
    setCheckedExportIds(new Set())
  }

  const handleToggleCheckExport = (id: string) => {
    setCheckedExportIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleSelectAllFiltered = () => {
    setCheckedExportIds((prev) => {
      const next = new Set(prev)
      if (allFilteredChecked) {
        for (const p of filteredProtocols) {
          next.delete(p.id)
        }
      } else {
        for (const p of filteredProtocols) {
          next.add(p.id)
        }
      }
      return next
    })
  }

  const handleExportSelected = async () => {
    if (selectedExportItems.length === 0) return
    try {
      const refs: ProtocolRef[] = selectedExportItems.map((p) => ({
        scope: p.scope,
        name: p.name,
      }))
      const suggestedName =
        refs.length === 1
          ? `${refs[0].name}-${refs[0].scope}.reg`
          : `selected-url-protocols-${refs.length}.reg`
      const saved = await api.exportProtocols(refs, suggestedName)
      if (saved) {
        notify('success', `已导出勾选的 ${refs.length} 项协议至 ${saved}`)
        handleExitSelectExport()
      }
    } catch (err) {
      notify('error', `导出失败：${formatError(err)}`)
    }
  }

  const handleOpenImport = async () => {
    try {
      const preview = await api.selectAndPreviewRegFile(hkcrFallback)
      if (preview && preview.filePath) {
        setImportPreview(preview)
      }
    } catch (err) {
      notify('error', `解析 .reg 文件失败：${formatError(err)}`)
    }
  }

  const handleChangeImportFallback = async (scope: Scope) => {
    setHkcrFallback(scope)
    if (!importPreview) return
    try {
      const updated = await api.rePreviewRegFile(importPreview.filePath, scope)
      setImportPreview(updated)
    } catch (err) {
      notify('error', formatError(err))
    }
  }

  const handleConfirmImport = async (selectedIds: string[]) => {
    if (!importPreview) return
    try {
      const res = await api.applyRegImport(
        importPreview.filePath,
        selectedIds,
        hkcrFallback,
      )
      if (res.failed > 0) {
        notify(
          'error',
          `导入完成：成功 ${res.imported} 项，失败 ${res.failed} 项 (${res.errors[0] || ''})`,
        )
      } else {
        notify('success', `已成功导入 ${res.imported} 项自定义 URL 协议`)
      }
      await loadProtocols()
    } catch (err) {
      notify('error', formatError(err))
      throw err
    }
  }

  const handleConfirmBatchClean = async (refs: ProtocolRef[], backupFirst: boolean) => {
    try {
      const resp = await api.batchClean(refs, backupFirst)
      if (resp.cancelled) {
        notify('info', '已取消备份保存，批量清理已安全中止')
        return
      }
      const { succeeded, failed } = resp.result
      if (failed > 0) {
        notify('error', `清理完成：成功 ${succeeded} 项，失败 ${failed} 项`)
      } else {
        notify(
          'success',
          resp.backupPath
            ? `已备份并彻底清理 ${succeeded} 项失效协议`
            : `已彻底清理 ${succeeded} 项失效协议`,
        )
      }
      if (selectedItem && refs.some((r) => r.scope === selectedItem.scope && r.name === selectedItem.name)) {
        setSelectedId(null)
      }
      await loadProtocols()
    } catch (err) {
      notify('error', formatError(err))
      throw err
    }
  }

  const handleBrowseExe = async (): Promise<string> => {
    try {
      return (await api.browseExecutable()) || ''
    } catch (err) {
      notify('error', formatError(err))
      return ''
    }
  }

  const handleTestLaunch = async (uri: string) => {
    try {
      await api.testProtocol(uri)
      notify('success', `已请求系统唤起 ${uri}`)
    } catch (err) {
      notify('error', formatError(err))
    }
  }

  const handleOpenFolder = async (path: string) => {
    try {
      await api.openProgramFolder(path)
    } catch (err) {
      notify('error', formatError(err))
    }
  }

  const handleOpenRegedit = async (registryPath: string) => {
    try {
      await api.openInRegedit(registryPath)
      notify('info', '正在打开注册表编辑器并定位至该协议项')
    } catch (err) {
      notify('error', formatError(err))
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 border border-slate-300/70 dark:border-slate-800 overflow-hidden">
      <TitleBar
        version={appInfo.version}
        isAdmin={appInfo.isAdmin}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        onRequestAdmin={handleRequestAdmin}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Column */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Toolbar
            searchInputRef={searchInputRef}
            query={query}
            onQueryChange={setQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={counts}
            loading={loading}
            selectMode={selectMode}
            selectedExportCount={selectedExportItems.length}
            filteredCount={filteredProtocols.length}
            allFilteredChecked={allFilteredChecked}
            onRefresh={loadProtocols}
            onCreate={() => setCreateOpen(true)}
            onImport={handleOpenImport}
            onExportAll={handleExportAll}
            onEnterSelectExport={handleEnterSelectExport}
            onExitSelectExport={handleExitSelectExport}
            onToggleSelectAllFiltered={handleToggleSelectAllFiltered}
            onClearSelectExport={() => setCheckedExportIds(new Set())}
            onExportSelected={handleExportSelected}
            onOpenBatchClean={() => setBatchCleanOpen(true)}
          />

          <ProtocolList
            items={filteredProtocols}
            selectedId={selectedId}
            loading={loading}
            hasQuery={query.trim() !== '' || activeTab !== 'all'}
            selectMode={selectMode}
            checkedIds={checkedExportIds}
            onSelect={(item) => setSelectedId(item.id)}
            onToggleCheck={handleToggleCheckExport}
            onResetFilter={() => {
              setQuery('')
              setActiveTab('all')
            }}
          />
        </main>

        {/* Right Detail / Edit Drawer */}
        <DetailDrawer
          item={selectedItem}
          isAdmin={appInfo.isAdmin}
          hasModalOpen={hasModalOpen}
          onClose={() => setSelectedId(null)}
          onSave={handleSaveUpdate}
          onDelete={(item) => setDeleteTarget(item)}
          onExport={handleExportOne}
          onBrowseExe={handleBrowseExe}
          onTestLaunch={handleTestLaunch}
          onOpenFolder={handleOpenFolder}
          onOpenRegedit={handleOpenRegedit}
          onRequestAdmin={handleRequestAdmin}
        />
      </div>

      {/* Drag & Drop .reg Overlay */}
      {draggingFile && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-6 bg-indigo-500/10 dark:bg-indigo-500/15 backdrop-blur-[2px]">
          <div className="animate-modal px-8 py-6 rounded-2xl bg-white/95 dark:bg-[#161B22]/95 border-2 border-dashed border-indigo-400 dark:border-indigo-500 shadow-modal flex flex-col items-center gap-2.5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              松开鼠标，立即预览导入 .reg 文件
            </div>
            <div className="text-[12.5px] text-slate-500 dark:text-slate-400">
              导入前将展示全部检测到的自定义 URL 协议供您勾选确认
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateModal
        open={createOpen}
        isAdmin={appInfo.isAdmin}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        onBrowseExe={handleBrowseExe}
        onRequestAdmin={handleRequestAdmin}
      />

      <DeleteModal
        item={deleteTarget}
        isAdmin={appInfo.isAdmin}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        onRequestAdmin={handleRequestAdmin}
      />

      <ImportModal
        preview={importPreview}
        hkcrFallback={hkcrFallback}
        isAdmin={appInfo.isAdmin}
        onChangeHkcrFallback={handleChangeImportFallback}
        onClose={() => setImportPreview(null)}
        onConfirm={handleConfirmImport}
        onRequestAdmin={handleRequestAdmin}
      />

      <BatchCleanModal
        open={batchCleanOpen}
        items={cleanableItems}
        isAdmin={appInfo.isAdmin}
        onClose={() => setBatchCleanOpen(false)}
        onConfirm={handleConfirmBatchClean}
        onRequestAdmin={handleRequestAdmin}
      />

      <ToastStack toasts={toasts} />
    </div>
  )
}
