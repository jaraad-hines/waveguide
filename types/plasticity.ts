// TypeScript types for YouTube Playlist Plasticity Engine artifacts

export interface PlasticityNode {
  video_id: string
  playlist_pos: number
  title: string
  channel: string
  thumbnail?: string
  description: string
  published_at: string
  salience: number  // 0..1 normalized
  habit: number     // 0..1
  embedding: number[]  // D-dimensional embedding vector
}

export interface PlasticityArtifact {
  playlist_id: string
  nodes: PlasticityNode[]
  meta: {
    decay: number
    diffuse: number
    reinforce: number
    novelty_boost: number
    total_videos: number
  }
}

export interface AttentionEvent {
  t: number
  video_id: string
  watch_frac: number  // 0..1
  rewatch?: number    // 0..1
  seek_count?: number
  like?: boolean
  note_chars?: number
}

