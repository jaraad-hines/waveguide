// YouTube API service for fetching playlist data

export interface YouTubePlaylistResponse {
  items: YouTubePlaylistItem[]
  nextPageToken?: string
  totalResults?: number
}

export interface YouTubePlaylistItem {
  id: string
  snippet: {
    title: string
    description: string
    thumbnails: {
      default?: { url: string }
      medium?: { url: string }
      high?: { url: string }
    }
    channelTitle: string
    publishedAt: string
  }
  contentDetails: {
    videoId: string
    videoPublishedAt: string
  }
}

// Note: This requires YouTube Data API v3
// You'll need to set up API key in environment variables
export async function fetchYouTubePlaylist(
  playlistId: string,
  apiKey?: string,
  maxResults: number = 50
): Promise<YouTubePlaylistItem[]> {
  // For now, return mock data structure
  // In production, you'd make actual API calls:
  // const response = await fetch(
  //   `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`
  // )
  
  console.warn('YouTube API integration requires API key setup. Using mock data structure.')
  
  // Return empty array - will be populated when API is configured
  return []
}

// Extract playlist ID from YouTube URL
export function extractPlaylistId(url: string): string | null {
  // Handle various YouTube playlist URL formats
  const patterns = [
    /[?&]list=([a-zA-Z0-9_-]+)/,
    /\/playlist\?list=([a-zA-Z0-9_-]+)/,
    /\/feed\/playlists/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1] || 'default'
    }
  }
  
  return null
}

// Convert YouTube API response to our format
export function convertYouTubeItem(item: YouTubePlaylistItem): {
  videoId: string
  title: string
  description: string
  thumbnail?: string
  channelTitle: string
  publishedAt: string
} {
  return {
    videoId: item.contentDetails.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
  }
}

