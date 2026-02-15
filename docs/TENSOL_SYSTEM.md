# Tensol System Documentation

## Overview

The Tensol system enables tagging content (videos, APIs, browser endpoints) to bristles in the dome object using a FIFO (First In, First Out) ordering system. Each tagged content can be accessed via window players that overlay the dome when you interact with the corresponding bristle.

## Key Concepts

### Tensols (Quadrants)
- The dome is divided into 4 quadrants (tensols)
- Each tensol represents a section of the dome for organizing content
- Tensols are visualized as red spheres positioned around the dome

### Tagged Content
- Content can be tagged to specific bristles (0-1279)
- Content types: `youtube`, `browser`, `api`, `other`
- Each content has a FIFO order number
- When all bristles are full, oldest content is removed (FIFO)

### Window Players
- Overlay components that display content when a bristle is clicked
- Support YouTube embeds, browser iframes, and API endpoints
- Can be minimized, closed, and positioned in 3D space

## Usage

### Importing YouTube Playlist

```typescript
import { importYouTubePlaylistToDome } from '../utils/youtubeImport'
import { TaggingService } from '../services/taggingService'

// Initialize tagging service
const taggingService = new TaggingService()

// Import playlist (requires YouTube API key)
const taggedContents = await importYouTubePlaylistToDome(
  'https://www.youtube.com/feed/playlists',
  taggingService,
  'YOUR_YOUTUBE_API_KEY'
)
```

### Tagging Content Manually

```typescript
const content = taggingService.tagContent({
  id: 'unique-id',
  contentType: 'youtube',
  title: 'Video Title',
  url: 'https://www.youtube.com/watch?v=...',
  thumbnail: 'https://...',
  apiEndpoint: 'https://www.youtube.com/watch?v=...',
})
```

### Accessing Tagged Content

```typescript
// Get content by bristle index
const content = taggingService.getContentByBristle(bristleIndex)

// Get all tagged contents (sorted by FIFO order)
const allContents = taggingService.getAllTaggedContents()
```

## Integration with Dome Scene

The dome scene automatically:
1. Detects clicks on bristles with tagged content
2. Opens window players for the corresponding content
3. Displays tensol quadrant markers
4. Manages window player lifecycle (open/close/minimize)

## YouTube API Setup

To use YouTube playlist import, you need:
1. YouTube Data API v3 key
2. Set it in environment variables or pass directly
3. The API endpoint: `https://www.googleapis.com/youtube/v3/playlistItems`

## Future Enhancements

- Multiple dome objects in a grid
- Reordering of tagged content
- Custom API endpoint configurations
- Browser endpoint integrations
- Content search and filtering

