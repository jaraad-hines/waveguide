// Tagging service for managing FIFO-ordered content on bristles

import { TaggedContent, DomeTaggingState } from '../types/tensol'

const TOTAL_BRISTLES = 1280 // 16 rows × 80 beams per row

export class TaggingService {
  private state: DomeTaggingState

  constructor(initialState?: Partial<DomeTaggingState>) {
    this.state = {
      taggedContents: initialState?.taggedContents || [],
      nextOrder: initialState?.nextOrder || 0,
      availableBristles: initialState?.availableBristles || this.generateAvailableBristles(),
      tensols: initialState?.tensols || [],
    }
  }

  private generateAvailableBristles(): Set<number> {
    const available = new Set<number>()
    for (let i = 0; i < TOTAL_BRISTLES; i++) {
      available.add(i)
    }
    return available
  }

  // Tag content to next available bristle (FIFO)
  tagContent(content: Omit<TaggedContent, 'bristleIndex' | 'taggedAt' | 'order'>): TaggedContent {
    // Find next available bristle
    const bristleIndex = this.getNextAvailableBristle()
    
    if (bristleIndex === null) {
      // All bristles are full - remove oldest (FIFO)
      const oldest = this.state.taggedContents.reduce((oldest, current) => 
        current.order < oldest.order ? current : oldest
      )
      this.untagContent(oldest.id)
      return this.tagContent(content) // Retry with freed bristle
    }

    const taggedContent: TaggedContent = {
      ...content,
      bristleIndex,
      taggedAt: new Date(),
      order: this.state.nextOrder++,
    }

    this.state.taggedContents.push(taggedContent)
    this.state.availableBristles.delete(bristleIndex)

    return taggedContent
  }

  // Get next available bristle index
  private getNextAvailableBristle(): number | null {
    if (this.state.availableBristles.size === 0) {
      return null
    }
    return Array.from(this.state.availableBristles)[0]
  }

  // Untag content from a bristle
  untagContent(contentId: string): boolean {
    const index = this.state.taggedContents.findIndex(c => c.id === contentId)
    if (index === -1) return false

    const content = this.state.taggedContents[index]
    this.state.availableBristles.add(content.bristleIndex)
    this.state.taggedContents.splice(index, 1)

    return true
  }

  // Get content by bristle index
  getContentByBristle(bristleIndex: number): TaggedContent | null {
    return this.state.taggedContents.find(c => c.bristleIndex === bristleIndex) || null
  }

  // Get all tagged contents
  getAllTaggedContents(): TaggedContent[] {
    return [...this.state.taggedContents].sort((a, b) => a.order - b.order)
  }

  // Get state
  getState(): DomeTaggingState {
    return { ...this.state }
  }

  // Batch tag multiple contents (for playlist import)
  batchTagContents(contents: Omit<TaggedContent, 'bristleIndex' | 'taggedAt' | 'order'>[]): TaggedContent[] {
    return contents.map(content => this.tagContent(content))
  }

  // Reorder content (change FIFO order)
  reorderContent(contentId: string, newOrder: number): boolean {
    const content = this.state.taggedContents.find(c => c.id === contentId)
    if (!content) return false

    content.order = newOrder
    // Re-sort all contents by order
    this.state.taggedContents.sort((a, b) => a.order - b.order)
    return true
  }

  // Clear all tags
  clearAllTags(): void {
    this.state.taggedContents = []
    this.state.availableBristles = this.generateAvailableBristles()
    this.state.nextOrder = 0
  }
}

