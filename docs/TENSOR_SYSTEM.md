# Tensor System Documentation

## Overview

The Tensor system enables uploading and managing music files (mp3, mp4, etc.) in tensol quadrants around the dome object. Similar to the TaggingService architecture, but maps music files to tensols (4 quadrants) instead of content to bristles (1280 bristles).

## Key Concepts

### Tensols (Quadrants)
- The dome is divided into 4 quadrants (tensols) positioned at 0°, 90°, 180°, 270°
- Each tensol can hold multiple music files
- Files are distributed using FIFO ordering within each tensol
- When a tensol reaches capacity, oldest files are evicted (FIFO)

### Music Files
- Supported formats: mp3, mp4, m4a, wav, ogg, webm
- File types: `audio` or `video`
- Each file is tagged to a specific tensol quadrant
- Files are stored with metadata (duration, artist, title, etc.)

### Tensor Service
- Manages music file distribution across tensols
- Handles file validation, metadata extraction, and storage
- Provides FIFO ordering and capacity management
- Similar architecture to TaggingService but for tensols

## Usage

### Basic Usage in Dome Scene

```typescript
import DomeScene from '../components/dome_scene'
import { TensorService } from '../services/tensorService'

// The tensor service is automatically initialized in DomeScene
// Access it via ref or use the exposed methods
```

### Uploading Music Files

```typescript
// In your component
const tensorServiceRef = useRef<TensorService | null>(null)

// Pass ref to DomeScene
<DomeScene 
  tensorServiceRef={tensorServiceRef}
  // ... other props
/>

// Upload a single file
const handleFileUpload = async (file: File) => {
  if (tensorServiceRef.current) {
    try {
      const tensorContent = await tagMusicFile(file) // Auto-assigns to next available tensol
      // or specify tensol:
      const tensorContent = await tagMusicFile(file, 0) // Assign to tensol 0
      console.log('File uploaded:', tensorContent)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }
}
```

### Using TensorUploadHandler Component

```typescript
import TensorUploadHandler from '../components/TensorUploadHandler'
import { TensorService } from '../services/tensorService'

const tensorService = new TensorService()

<TensorUploadHandler
  tensorService={tensorService}
  tensolIndex={0} // Optional: target specific tensol
  onUploadComplete={(contents) => {
    console.log('Uploaded:', contents)
  }}
  onUploadError={(error) => {
    console.error('Error:', error)
  }}
>
  <button>Upload Music Files</button>
</TensorUploadHandler>
```

### Using useTensorUpload Hook

```typescript
import { useTensorUpload } from '../hooks/useTensorUpload'
import { TensorService } from '../services/tensorService'

const tensorService = new TensorService()

const {
  isUploading,
  uploadProgress,
  uploadMusicFile,
  uploadMusicFiles,
  handleDrop,
  handleFileInput,
} = useTensorUpload({
  tensorService,
  onUploadComplete: (contents) => {
    console.log('Uploaded:', contents)
  },
  onUploadError: (error) => {
    console.error('Error:', error)
  },
})

// Upload single file
await uploadMusicFile(file, 0) // tensol 0

// Upload multiple files
await uploadMusicFiles([file1, file2, file3], 1) // tensol 1

// Handle drag and drop
<div onDrop={handleDrop}>
  Drop music files here
</div>

// Handle file input
<input 
  type="file" 
  accept="audio/*,video/mp4" 
  multiple 
  onChange={handleFileInput} 
/>
```

### Direct TensorService Usage

```typescript
import { TensorService } from '../services/tensorService'
import { extractMusicMetadata } from '../services/musicFileUtils'

const tensorService = new TensorService()

// Tag a music file
const metadata = await extractMusicMetadata(file)
const tensorContent = tensorService.tagMusicFile(file, 0, metadata) // tensol 0

// Get all files in a tensol
const files = tensorService.getContentsByTensol(0)

// Get file by ID
const file = tensorService.getContentById('tensor-123')

// Untag a file
tensorService.untagMusicFile('tensor-123')

// Batch upload
const files = [file1, file2, file3]
const contents = tensorService.batchTagMusicFiles(files, 1) // tensol 1

// Set tensol capacity
tensorService.setTensolCapacity(0, 10) // Max 10 files in tensol 0

// Clear a tensol
tensorService.clearTensol(0)

// Clear all tensols
tensorService.clearAll()
```

## File Validation

Files are automatically validated before upload:
- Maximum size: 500MB
- Allowed types: mp3, mp4, m4a, wav, ogg, webm
- Invalid files are rejected with error messages

## Metadata Extraction

The system automatically extracts:
- Duration (from media element)
- Artist and title (from filename if formatted as "Artist - Title")
- File size and MIME type
- Custom metadata can be provided

## Architecture Comparison

### TaggingService (Content → Bristles)
- Maps content (YouTube, browser, API) to 1280 bristles
- 1:1 mapping (one content per bristle)
- FIFO eviction when all bristles full

### TensorService (Music Files → Tensols)
- Maps music files to 4 tensol quadrants
- 1:Many mapping (multiple files per tensol)
- FIFO eviction when tensol reaches capacity
- Round-robin distribution when tensol not specified

## Integration with Dome Scene

The tensor service is automatically integrated into `DomeScene`:
- Tensols are visualized as spheres (red = empty, green = has music)
- Music file count is indicated by a cylinder above the tensol
- Files can be uploaded via drag-and-drop or file input
- Tensor service methods are exposed via ref

## Future Enhancements

- Audio playback controls per tensol
- Playlist management within tensols
- Waveform visualization
- Audio analysis and visualization
- Cross-tensol audio mixing
- Real-time audio effects

