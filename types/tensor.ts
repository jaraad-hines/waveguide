// Types for tensor (tensol-based music file) system

export type MusicFileType = 'audio' | 'video'

export interface TensorContent {
  id: string
  tensolIndex: number // 0-3 (4 quadrants/tensols)
  fileType: MusicFileType // 'audio' for mp3, 'video' for mp4
  title: string
  fileName: string
  file: File // The actual file object
  fileUrl?: string // Object URL for playback
  thumbnail?: string // Base64 or URL for preview
  size: number
  mimeType: string
  duration?: number // Duration in seconds (if available)
  uploadedAt: Date
  order: number // FIFO order within tensol
  metadata?: {
    artist?: string
    album?: string
    genre?: string
    bitrate?: number
    sampleRate?: number
    [key: string]: any
  }
}

export interface TensolState {
  id: string
  quadrantIndex: number // 0-3
  position: [number, number, number] // 3D position in dome
  tensorContents: TensorContent[]
  isActive: boolean
  capacity: number // Max files per tensol (default: unlimited or configurable)
}

export interface TensorSystemState {
  tensols: TensolState[]
  nextOrder: number
  availableTensols: Set<number> // Available tensol indices (0-3)
}

