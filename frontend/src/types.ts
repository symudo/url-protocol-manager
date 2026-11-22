export type Scope = 'HKCU' | 'HKLM'

export type HealthStatus = 'ok' | 'missing' | 'system' | 'empty'

export type DeleteMode = 'full' | 'disable'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface AppInfo {
  version: string
  isAdmin: boolean
}

export interface ProtocolItem {
  id: string
  name: string
  scope: Scope
  registryPath: string
  description: string
  command: string
  executablePath: string
  executableName: string
  iconPath: string
  iconData: string
  health: HealthStatus
  healthNote: string
  isUwp: boolean
  isComposite: boolean
  compositeKeys?: string[]
  isShadowed: boolean
  shadowsSystem: boolean
  hasSameInOtherScope: boolean
  cleanable: boolean
}

export interface ProtocolPayload {
  name: string
  scope: Scope
  description: string
  command: string
  iconPath: string
}

export interface ProtocolRef {
  scope: Scope
  name: string
}

export interface BatchCleanItemResult {
  scope: Scope
  name: string
  success: boolean
  error?: string
}

export interface BatchCleanResult {
  succeeded: number
  failed: number
  items: BatchCleanItemResult[]
}

export interface BatchCleanResponse {
  cancelled: boolean
  backupPath: string
  result: BatchCleanResult
}

export interface ImportPreviewItem {
  id: string
  name: string
  scope: Scope
  fromHkcr: boolean
  description: string
  command: string
  iconPath: string
  exists: boolean
  needsAdmin: boolean
  sectionCount: number
}

export interface ImportPreviewResult {
  filePath: string
  items: ImportPreviewItem[]
  skippedKeys: number
  requiresAdmin: boolean
}

export interface ImportApplyResult {
  imported: number
  failed: number
  errors: string[]
}

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'info'
  text: string
}
