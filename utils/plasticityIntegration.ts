// Integration utilities for loading plasticity artifacts into dome scene

import { PlasticityService } from '../services/plasticityService'
import { PlasticityNode } from '../types/plasticity'
import { TaggingService } from '../services/taggingService'
import { TaggedContent } from '../types/tensol'

/**
 * Load plasticity artifact and convert nodes to tagged content for dome visualization
 */
export async function loadPlasticityArtifactToDome(
  artifactSource: string | File,
  taggingService: TaggingService
): Promise<{ nodes: PlasticityNode[]; taggedContents: TaggedContent[] }> {
  const plasticityService = new PlasticityService()
  await plasticityService.loadArtifact(artifactSource)
  
  const nodes = plasticityService.getNodesBySalience()
  
  // Convert plasticity nodes to tagged content
  const contentsToTag = nodes.map((node, index) => ({
    id: `plasticity-${node.video_id}-${index}`,
    contentType: 'youtube' as const,
    title: node.title,
    description: node.description,
    thumbnail: node.thumbnail,
    url: `https://www.youtube.com/watch?v=${node.video_id}`,
    apiEndpoint: `https://www.youtube.com/watch?v=${node.video_id}`,
    metadata: {
      channelTitle: node.channel,
      publishedAt: node.published_at,
      videoId: node.video_id,
      playlistPos: node.playlist_pos,
      salience: node.salience,
      habit: node.habit,
      embedding: node.embedding,
    },
  }))
  
  // Tag all contents
  const taggedContents = taggingService.batchTagContents(contentsToTag)
  
  return {
    nodes,
    taggedContents,
  }
}

/**
 * Map plasticity nodes to bristle positions based on salience and playlist position
 */
export function mapPlasticityNodesToBristles(
  nodes: PlasticityNode[],
  bristleCount: number
): Map<number, PlasticityNode> {
  const mapping = new Map<number, PlasticityNode>()
  
  // Sort by playlist position for sequential placement
  const sortedNodes = [...nodes].sort((a, b) => a.playlist_pos - b.playlist_pos)
  
  // Distribute nodes across bristles
  // Higher salience nodes get more bristle space
  const totalSalience = sortedNodes.reduce((sum, n) => sum + n.salience, 0)
  
  let currentBristle = 0
  for (const node of sortedNodes) {
    if (currentBristle >= bristleCount) break
    
    // Weight by salience - higher salience gets more bristle space
    const weight = totalSalience > 0 ? node.salience / totalSalience : 1 / sortedNodes.length
    const bristlesForNode = Math.max(1, Math.floor(weight * bristleCount * 0.3))
    
    for (let i = 0; i < bristlesForNode && currentBristle < bristleCount; i++) {
      mapping.set(currentBristle, node)
      currentBristle++
    }
  }
  
  return mapping
}

/**
 * Get salience-based color intensity for visualization
 */
export function getSalienceColor(salience: number): { r: number; g: number; b: number } {
  // Map salience (0..1) to color intensity
  // Higher salience = brighter/more saturated
  const intensity = Math.pow(salience, 0.7) // Gamma correction for better visual distribution
  
  // Use warm colors for high salience, cooler for low
  if (salience > 0.7) {
    // High salience: warm yellow/orange
    return {
      r: 1.0,
      g: 0.7 + intensity * 0.3,
      b: 0.3 + intensity * 0.2,
    }
  } else if (salience > 0.4) {
    // Medium salience: neutral white
    return {
      r: 0.7 + intensity * 0.3,
      g: 0.7 + intensity * 0.3,
      b: 0.7 + intensity * 0.3,
    }
  } else {
    // Low salience: cool blue/purple
    return {
      r: 0.3 + intensity * 0.4,
      g: 0.4 + intensity * 0.3,
      b: 0.6 + intensity * 0.4,
    }
  }
}

/**
 * Compute helical position for playlist visualization
 */
export function computeHelicalPosition(
  playlistPos: number,
  totalVideos: number,
  radius: number
): { x: number; y: number; z: number } {
  // Map playlist position to helical coordinates
  const t = playlistPos / Math.max(1, totalVideos - 1) // 0..1
  const angle = t * Math.PI * 2 * 3 // 3 full rotations
  const height = t * 10 - 5 // -5 to 5
  
  return {
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius,
  }
}

