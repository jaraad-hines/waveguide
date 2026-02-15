// Tensor service for managing music files (mp3/mp4) in tensol quadrants
// Similar architecture to TaggingService but maps to tensols instead of bristles

import { TensorContent, TensolState, TensorSystemState, MusicFileType } from '../types/tensor'

const TOTAL_TENSOLS = 4 // 4 quadrants around the dome

export class TensorService {
  private state: TensorSystemState

  constructor(initialState?: Partial<TensorSystemState>) {
    this.state = {
      tensols: initialState?.tensols || this.initializeTensols(),
      nextOrder: initialState?.nextOrder || 0,
      availableTensols: initialState?.availableTensols || this.generateAvailableTensols(),
    }
  }

  private initializeTensols(): TensolState[] {
    const quadrantAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
    return quadrantAngles.map((angle, index) => ({
      id: `tensol-${index}`,
      quadrantIndex: index,
      position: [0, 0, 0] as [number, number, number], // Will be set by dome scene
      tensorContents: [],
      isActive: true,
      capacity: Infinity, // Unlimited capacity per tensol (can be configured)
    }))
  }

  private generateAvailableTensols(): Set<number> {
    const available = new Set<number>()
    for (let i = 0; i < TOTAL_TENSOLS; i++) {
      available.add(i)
    }
    return available
  }

  // Check if file is a valid music file (mp3, mp4, etc.)
  private isValidMusicFile(file: File): boolean {
    const mimeType = file.type.toLowerCase()
    const name = file.name.toLowerCase()
    
    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      name.endsWith('.mp3') ||
      name.endsWith('.mp4') ||
      name.endsWith('.m4a') ||
      name.endsWith('.wav') ||
      name.endsWith('.ogg') ||
      name.endsWith('.webm')
    )
  }

  // Determine file type (audio or video)
  private detectMusicFileType(file: File): MusicFileType {
    const mimeType = file.type.toLowerCase()
    const name = file.name.toLowerCase()
    
    if (mimeType.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.webm')) {
      return 'video'
    }
    return 'audio'
  }

  // Tag music file to a tensol (FIFO distribution)
  tagMusicFile(
    file: File,
    tensolIndex?: number, // Optional: specify tensol, otherwise auto-assign
    metadata?: Record<string, any>
  ): TensorContent {
    // Validate file type
    if (!this.isValidMusicFile(file)) {
      throw new Error(`Invalid music file type: ${file.type}. Expected audio or video file.`)
    }

    // Auto-assign tensol if not specified (round-robin or FIFO)
    const targetTensolIndex = tensolIndex !== undefined 
      ? tensolIndex 
      : this.getNextAvailableTensol()

    if (targetTensolIndex === null || targetTensolIndex < 0 || targetTensolIndex >= TOTAL_TENSOLS) {
      throw new Error(`Invalid tensol index: ${targetTensolIndex}. Must be 0-${TOTAL_TENSOLS - 1}`)
    }

    // Check capacity (if limited)
    const tensol = this.state.tensols[targetTensolIndex]
    if (tensol.tensorContents.length >= tensol.capacity) {
      // Remove oldest file from this tensol (FIFO eviction)
      const oldest = tensol.tensorContents.reduce((oldest, current) =>
        current.order < oldest.order ? current : oldest
      )
      this.untagMusicFile(oldest.id)
    }

    // Create object URL for playback
    const fileUrl = URL.createObjectURL(file)

    const tensorContent: TensorContent = {
      id: `tensor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tensolIndex: targetTensolIndex,
      fileType: this.detectMusicFileType(file),
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      fileName: file.name,
      file,
      fileUrl,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date(),
      order: this.state.nextOrder++,
      metadata: metadata || {},
    }

    // Add to tensol
    tensol.tensorContents.push(tensorContent)
    tensol.tensorContents.sort((a, b) => a.order - b.order) // Maintain FIFO order

    return tensorContent
  }

  // Get next available tensol (round-robin distribution)
  private getNextAvailableTensol(): number {
    if (this.state.availableTensols.size === 0) {
      // All tensols available, use round-robin
      const totalFiles = this.state.tensols.reduce((sum, t) => sum + t.tensorContents.length, 0)
      return totalFiles % TOTAL_TENSOLS
    }
    // Use first available tensol
    return Array.from(this.state.availableTensols)[0]
  }

  // Untag music file from tensol
  untagMusicFile(contentId: string): boolean {
    for (const tensol of this.state.tensols) {
      const index = tensol.tensorContents.findIndex(c => c.id === contentId)
      if (index !== -1) {
        const content = tensol.tensorContents[index]
        
        // Clean up object URL
        if (content.fileUrl) {
          URL.revokeObjectURL(content.fileUrl)
        }
        
        tensol.tensorContents.splice(index, 1)
        return true
      }
    }
    return false
  }

  // Get all music files for a specific tensol
  getContentsByTensol(tensolIndex: number): TensorContent[] {
    if (tensolIndex < 0 || tensolIndex >= TOTAL_TENSOLS) {
      return []
    }
    return [...this.state.tensols[tensolIndex].tensorContents].sort((a, b) => a.order - b.order)
  }

  // Get music file by ID
  getContentById(contentId: string): TensorContent | null {
    for (const tensol of this.state.tensols) {
      const content = tensol.tensorContents.find(c => c.id === contentId)
      if (content) return content
    }
    return null
  }

  // Get all tensor contents (across all tensols)
  getAllContents(): TensorContent[] {
    const allContents: TensorContent[] = []
    for (const tensol of this.state.tensols) {
      allContents.push(...tensol.tensorContents)
    }
    return allContents.sort((a, b) => a.order - b.order)
  }

  // Batch tag multiple music files
  batchTagMusicFiles(
    files: File[],
    tensolIndex?: number,
    metadataArray?: Record<string, any>[]
  ): TensorContent[] {
    return files.map((file, index) => {
      const metadata = metadataArray && metadataArray[index] ? metadataArray[index] : undefined
      return this.tagMusicFile(file, tensolIndex, metadata)
    })
  }

  // Get tensol state
  getTensol(tensolIndex: number): TensolState | null {
    if (tensolIndex < 0 || tensolIndex >= TOTAL_TENSOLS) {
      return null
    }
    return { ...this.state.tensols[tensolIndex] }
  }

  // Get all tensols
  getAllTensols(): TensolState[] {
    return this.state.tensols.map(t => ({ ...t }))
  }

  // Update tensol position (called by dome scene)
  updateTensolPosition(tensolIndex: number, position: [number, number, number]): boolean {
    if (tensolIndex < 0 || tensolIndex >= TOTAL_TENSOLS) {
      return false
    }
    this.state.tensols[tensolIndex].position = position
    return true
  }

  // Set tensol capacity
  setTensolCapacity(tensolIndex: number, capacity: number): boolean {
    if (tensolIndex < 0 || tensolIndex >= TOTAL_TENSOLS) {
      return false
    }
    this.state.tensols[tensolIndex].capacity = capacity
    
    // Evict excess files if over capacity
    const tensol = this.state.tensols[tensolIndex]
    while (tensol.tensorContents.length > capacity) {
      const oldest = tensol.tensorContents.reduce((oldest, current) =>
        current.order < oldest.order ? current : oldest
      )
      this.untagMusicFile(oldest.id)
    }
    
    return true
  }

  // Clear all music files from a tensol
  clearTensol(tensolIndex: number): boolean {
    if (tensolIndex < 0 || tensolIndex >= TOTAL_TENSOLS) {
      return false
    }
    
    const tensol = this.state.tensols[tensolIndex]
    // Clean up all object URLs
    tensol.tensorContents.forEach(content => {
      if (content.fileUrl) {
        URL.revokeObjectURL(content.fileUrl)
      }
    })
    
    tensol.tensorContents = []
    return true
  }

  // Clear all music files from all tensols
  clearAll(): void {
    for (let i = 0; i < TOTAL_TENSOLS; i++) {
      this.clearTensol(i)
    }
    this.state.nextOrder = 0
  }

  // Get state
  getState(): TensorSystemState {
    return {
      tensols: this.getAllTensols(),
      nextOrder: this.state.nextOrder,
      availableTensols: new Set(this.state.availableTensols),
    }
  }
}

