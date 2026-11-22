import type {
  AppInfo,
  BatchCleanResponse,
  DeleteMode,
  ImportApplyResult,
  ImportPreviewResult,
  ProtocolItem,
  ProtocolPayload,
  ProtocolRef,
  Scope,
} from './types'

interface WailsAppBindings {
  GetAppInfo(): Promise<AppInfo>
  ListProtocols(): Promise<ProtocolItem[]>
  CreateProtocol(payload: ProtocolPayload): Promise<void>
  UpdateProtocol(payload: ProtocolPayload): Promise<void>
  DeleteProtocol(scope: string, name: string, mode: string): Promise<void>
  BatchClean(refs: ProtocolRef[], backupFirst: boolean): Promise<BatchCleanResponse>
  ExportProtocols(refs: ProtocolRef[], suggestedName: string): Promise<string>
  SelectAndPreviewRegFile(hkcrFallback: string): Promise<ImportPreviewResult>
  RePreviewRegFile(filePath: string, hkcrFallback: string): Promise<ImportPreviewResult>
  ApplyRegImport(filePath: string, selectedIDs: string[], hkcrFallback: string): Promise<ImportApplyResult>
  BrowseExecutable(): Promise<string>
  TestProtocol(uri: string): Promise<void>
  OpenProgramFolder(filePath: string): Promise<void>
  RestartAsAdmin(): Promise<void>
}

interface WailsRuntime {
  WindowMinimise(): void
  WindowToggleMaximise(): void
  Quit(): void
}

declare global {
  interface Window {
    go?: {
      main?: {
        App?: WailsAppBindings
      }
    }
    runtime?: WailsRuntime
  }
}

function getApp(): WailsAppBindings {
  const app = window.go?.main?.App
  if (!app) {
    throw new Error('Wails 后端运行时尚未就绪')
  }
  return app
}

export const api = {
  getAppInfo: () => getApp().GetAppInfo(),
  listProtocols: () => getApp().ListProtocols(),
  createProtocol: (payload: ProtocolPayload) => getApp().CreateProtocol(payload),
  updateProtocol: (payload: ProtocolPayload) => getApp().UpdateProtocol(payload),
  deleteProtocol: (scope: Scope, name: string, mode: DeleteMode) =>
    getApp().DeleteProtocol(scope, name, mode),
  batchClean: (refs: ProtocolRef[], backupFirst: boolean) =>
    getApp().BatchClean(refs, backupFirst),
  exportProtocols: (refs: ProtocolRef[], suggestedName: string) =>
    getApp().ExportProtocols(refs, suggestedName),
  selectAndPreviewRegFile: (hkcrFallback: Scope) =>
    getApp().SelectAndPreviewRegFile(hkcrFallback),
  rePreviewRegFile: (filePath: string, hkcrFallback: Scope) =>
    getApp().RePreviewRegFile(filePath, hkcrFallback),
  applyRegImport: (filePath: string, selectedIDs: string[], hkcrFallback: Scope) =>
    getApp().ApplyRegImport(filePath, selectedIDs, hkcrFallback),
  browseExecutable: () => getApp().BrowseExecutable(),
  testProtocol: (uri: string) => getApp().TestProtocol(uri),
  openProgramFolder: (filePath: string) => getApp().OpenProgramFolder(filePath),
  restartAsAdmin: () => getApp().RestartAsAdmin(),
}

export const windowControls = {
  minimise: () => window.runtime?.WindowMinimise(),
  toggleMaximise: () => window.runtime?.WindowToggleMaximise(),
  quit: () => window.runtime?.Quit(),
}

export function formatError(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  return String(err ?? '未知错误')
}
