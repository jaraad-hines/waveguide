// Utility functions for importing YouTube playlists and tagging to bristles

import { TaggingService } from '../services/taggingService'
import { TaggedContent } from '../types/tensol'
import { fetchYouTubePlaylist, convertYouTubeItem, extractPlaylistId } from '../services/youtubeApi'

export async function importYouTubePlaylistToDome(
  playlistUrl: string,
  taggingService: TaggingService,
  apiKey?: string
): Promise<TaggedContent[]> {
  // Extract playlist ID from URL
  const playlistId = extractPlaylistId(playlistUrl)
  if (!playlistId) {
    throw new Error('Invalid YouTube playlist URL')
  }

  // Fetch playlist items (this will need actual API implementation)
  // For now, we'll create a structure that can be populated
  const playlistItems = await fetchYouTubePlaylist(playlistId, apiKey, 100)

  // Convert to tagged content format
  const contentsToTag = playlistItems.map((item, index) => {
    const converted = convertYouTubeItem(item)
    return {
      id: `youtube-${converted.videoId}-${Date.now()}-${index}`,
      contentType: 'youtube' as const,
      title: converted.title,
      description: converted.description,
      thumbnail: converted.thumbnail,
      url: `https://www.youtube.com/watch?v=${converted.videoId}`,
      apiEndpoint: `https://www.youtube.com/watch?v=${converted.videoId}`,
      metadata: {
        channelTitle: converted.channelTitle,
        publishedAt: converted.publishedAt,
        videoId: converted.videoId,
      },
    }
  })

  // Batch tag all contents
  return taggingService.batchTagContents(contentsToTag)
}

// Helper to create mock YouTube content for testing (when API is not available)
export function createMockYouTubeContent(count: number): Omit<TaggedContent, 'bristleIndex' | 'taggedAt' | 'order'>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-youtube-${i}-${Date.now()}`,
    contentType: 'youtube' as const,
    title: `YouTube Video ${i + 1}`,
    description: `Description for video ${i + 1}`,
    thumbnail: `https://via.placeholder.com/320x180?text=Video+${i + 1}`,
    url: `https://www.youtube.com/watch?v=mock${i}`,
    apiEndpoint: `https://www.youtube.com/watch?v=mock${i}`,
    metadata: {
      channelTitle: 'Mock Channel',
      publishedAt: new Date().toISOString(),
      videoId: `mock${i}`,
    },
  }))
}

