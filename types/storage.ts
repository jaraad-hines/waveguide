export type FileType = 'Link' | 'Audio' | 'Image' | 'Video' | 'Document' | 'Other'

export interface StoredFile {
  id: string
  name: string
  type: FileType
  url?: string // For links
  file?: File // For uploaded files
  thumbnail?: string // Base64 or URL for preview
  size?: number
  mimeType?: string
  uploadedAt: Date
  bristleIndex?: number // Index of bristle this file is assigned to (0-1279)
  fieldIndex: number // Which field this file belongs to (0-4)
  requiresAuth?: boolean
  authProvider?: string // e.g., 'google', 'dropbox', etc.
  authData?: Record<string, any> // Store authentication tokens/credentials
}

export interface AuthSession {
  provider: string
  token?: string
  refreshToken?: string
  expiresAt?: Date
  userInfo?: Record<string, any>
}

export interface FileSystemState {
  files: StoredFile[]
  authSessions: AuthSession[]
  addFile: (file: StoredFile) => void
  removeFile: (fileId: string) => void
  addAuthSession: (session: AuthSession) => void
  removeAuthSession: (provider: string) => void
  getFilesByField: (fieldIndex: number) => StoredFile[]
}

