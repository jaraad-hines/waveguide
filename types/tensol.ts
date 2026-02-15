// Types for tensol (quadrant) system and tagged content

export interface TaggedContent {
  id: string
  bristleIndex: number // Index of the bristle this content is tagged to
  contentType: 'youtube' | 'browser' | 'api' | 'other'
  apiEndpoint?: string
  title: string
  description?: string
  thumbnail?: string
  url?: string
  metadata?: Record<string, any>
  taggedAt: Date
  order: number // FIFO order
}

export interface TensolQuadrant {
  id: string
  quadrantIndex: number // 0-3 (4 quadrants)
  position: [number, number, number] // 3D position in dome
  taggedContents: TaggedContent[]
  isActive: boolean
}

export interface WindowPlayer {
  id: string
  contentId: string
  position: [number, number, number] // 3D position for overlay
  size: [number, number] // width, height
  isVisible: boolean
  apiEndpoint: string
  contentType: 'youtube' | 'browser' | 'api'
}

export interface YouTubePlaylistItem {
  videoId: string
  title: string
  description?: string
  thumbnail?: string
  channelTitle?: string
  duration?: string
  publishedAt?: string
}

export interface DomeTaggingState {
  taggedContents: TaggedContent[]
  nextOrder: number
  availableBristles: Set<number>
  tensols: TensolQuadrant[]
}

