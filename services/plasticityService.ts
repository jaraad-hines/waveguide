// Service for loading and managing plasticity artifacts

import { PlasticityArtifact, PlasticityNode } from '../types/plasticity'

export class PlasticityService {
  private artifact: PlasticityArtifact | null = null

  /**
   * Load plasticity artifact from JSON file or URL
   */
  async loadArtifact(source: string | File | PlasticityArtifact): Promise<PlasticityArtifact> {
    if (typeof source === 'object' && 'playlist_id' in source) {
      // Already a PlasticityArtifact
      this.artifact = source
      return this.artifact
    }

    let jsonData: string
    if (source instanceof File) {
      jsonData = await source.text()
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source)
      jsonData = await response.text()
    } else {
      // Assume it's a file path - try to fetch from public or API route
      const response = await fetch(`/api/plasticity/${source}`)
      if (!response.ok) {
        throw new Error(`Failed to load artifact: ${response.statusText}`)
      }
      jsonData = await response.text()
    }

    this.artifact = JSON.parse(jsonData) as PlasticityArtifact
    return this.artifact
  }

  /**
   * Get all nodes from the loaded artifact
   */
  getNodes(): PlasticityNode[] {
    if (!this.artifact) {
      throw new Error('No artifact loaded. Call loadArtifact() first.')
    }
    return this.artifact.nodes
  }

  /**
   * Get nodes sorted by salience (highest first)
   */
  getNodesBySalience(): PlasticityNode[] {
    return this.getNodes().sort((a, b) => b.salience - a.salience)
  }

  /**
   * Get nodes sorted by playlist position
   */
  getNodesByPosition(): PlasticityNode[] {
    return this.getNodes().sort((a, b) => a.playlist_pos - b.playlist_pos)
  }

  /**
   * Get node by video ID
   */
  getNodeByVideoId(videoId: string): PlasticityNode | undefined {
    return this.getNodes().find(n => n.video_id === videoId)
  }

  /**
   * Get metadata
   */
  getMeta() {
    if (!this.artifact) {
      throw new Error('No artifact loaded. Call loadArtifact() first.')
    }
    return this.artifact.meta
  }

  /**
   * Get playlist ID
   */
  getPlaylistId(): string {
    if (!this.artifact) {
      throw new Error('No artifact loaded. Call loadArtifact() first.')
    }
    return this.artifact.playlist_id
  }

  /**
   * Compute 2D projection of embeddings using PCA (simple version)
   * For production, consider using UMAP or t-SNE
   */
  compute2DProjection(): Array<{ node: PlasticityNode; x: number; y: number }> {
    const nodes = this.getNodes()
    if (nodes.length === 0) return []

    // Extract embeddings
    const embeddings = nodes.map(n => n.embedding)
    const dim = embeddings[0].length
    const n = embeddings.length

    // Compute mean
    const mean = new Array(dim).fill(0)
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        mean[i] += emb[i]
      }
    }
    for (let i = 0; i < dim; i++) {
      mean[i] /= n
    }

    // Center embeddings
    const centered = embeddings.map(emb => 
      emb.map((val, i) => val - mean[i])
    )

    // Compute covariance matrix (simplified - use first 2 principal components)
    // For better results, use a proper PCA library
    const cov: number[][] = []
    for (let i = 0; i < Math.min(2, dim); i++) {
      cov[i] = []
      for (let j = 0; j < Math.min(2, dim); j++) {
        let sum = 0
        for (let k = 0; k < n; k++) {
          sum += centered[k][i] * centered[k][j]
        }
        cov[i][j] = sum / (n - 1)
      }
    }

    // Simple projection: use first two dimensions (or first two PCA components)
    // For production, compute actual eigenvectors
    return nodes.map((node, idx) => ({
      node,
      x: node.embedding[0] * 10, // Scale for visualization
      y: node.embedding[1] * 10,
    }))
  }

  /**
   * Map nodes to bristle positions in dome
   * Uses helical placement based on playlist position and salience
   */
  mapToBristlePositions(bristleCount: number): Map<number, PlasticityNode> {
    const nodes = this.getNodesByPosition()
    const mapping = new Map<number, PlasticityNode>()

    // Distribute nodes across bristles based on salience-weighted positions
    const totalSalience = nodes.reduce((sum, n) => sum + n.salience, 0)
    
    let currentBristle = 0
    for (const node of nodes) {
      // Weight by salience - higher salience gets more bristle space
      const weight = node.salience / totalSalience
      const bristlesForNode = Math.max(1, Math.floor(weight * bristleCount * 0.5))
      
      for (let i = 0; i < bristlesForNode && currentBristle < bristleCount; i++) {
        mapping.set(currentBristle, node)
        currentBristle++
      }
    }

    return mapping
  }
}

