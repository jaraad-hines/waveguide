# YouTube Playlist Plasticity System

End-to-end implementation for loading YouTube playlists, generating embeddings, and running plasticity dynamics to produce Waveguide/Proto artifacts.

## Overview

This system treats YouTube playlists as **attention trajectories** that shape a persistent semantic field. Instead of treating videos as discrete list items, the system models:

- **Salience fields** - Long-term memory traces that form "wells" around frequently engaged content
- **Decay** - Forgetting over time to prevent cognitive traps
- **Diffusion** - Nearby concepts inherit salience (semantic neighborhoods)
- **Novelty pressure** - Bias toward unexplored regions
- **Habit formation** - Stable preferences that shape future navigation

## Architecture

```
YouTube Playlist → Embeddings → Plasticity Engine → JSON Artifact → Waveguide Visualization
```

## Setup

### 1. Install Python Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 2. Get YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Save your API key securely

### 3. Run the Plasticity Engine

```bash
python scripts/youtube_plasticity.py YOUR_API_KEY PLAYLIST_ID [output.json]
```

Example:
```bash
python scripts/youtube_plasticity.py YOUR_KEY PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB plasticity_artifact.json
```

## Usage

### Basic Workflow

1. **Fetch Playlist**: The script uses YouTube Data API to fetch all videos in a playlist
2. **Generate Embeddings**: Each video (title + channel + description) is embedded using sentence-transformers
3. **Run Plasticity Simulation**: Simulated attention events shape the salience field
4. **Export Artifact**: JSON file ready for Waveguide visualization

### Loading in Waveguide

```typescript
import { PlasticityService } from '../services/plasticityService'

const service = new PlasticityService()
await service.loadArtifact('plasticity_artifact.json')

// Get nodes sorted by salience
const topNodes = service.getNodesBySalience().slice(0, 20)

// Map to bristle positions
const mapping = service.mapToBristlePositions(1280)
```

## Data Model

### Video Object
- `video_id`: YouTube video ID
- `playlist_pos`: Position in playlist
- `title`, `description`, `channel_title`: Metadata
- `emb`: Semantic embedding vector
- `salience`: Long-term attention trace (0..1)
- `habit`: Stable preference (0..1)

### Attention Event
- `t`: Timestep
- `video_id`: Which video was watched
- `watch_frac`: Fraction watched (0..1)
- `rewatch`, `seek_count`, `like`, `note_chars`: Engagement signals

## Plasticity Parameters

The engine uses tunable parameters:

- **decay** (0.994): How fast salience fades per timestep
- **diffuse** (0.06): How much salience spreads to neighbors
- **reinforce** (0.22): How much attention events boost salience
- **novelty_boost** (0.25): How much novelty amplifies reinforcement

Adjust these in `PlasticityEngine.__init__()` to tune behavior.

## Visualization Mapping

The artifact maps to Waveguide visualization:

- **Salience** → Bristle luminance/bloom
- **Playlist position** → Helical z-height or angular position
- **Embedding** → θ/r placement in cylinder (via PCA/UMAP)
- **Novelty** → Gradient orientation/shimmer
- **Conflict** → Facets count (when multi-walker arbitration is added)

## Milestone Approach

### Milestone A (Current)
- Title + channel embeddings
- Simulated attention events
- Basic salience field

### Milestone B (Next)
- Title + description embeddings
- Real watch telemetry integration
- Cross-domain plasticity (video + notes)

### Milestone C (Future)
- Transcript embeddings
- Multi-walker arbitration
- Real-time plasticity updates

## Testing Modes

### Test A: Single Playlist
Load playlist, render embeddings, track field reshaping as user interacts.

**Metrics:**
- Basin depth (stability of semantic clusters)
- Decay behavior over time
- User navigation preferences

### Test B: Playlist + Manual Exploration
Allow user to explore videos outside playlist.

**Metrics:**
- Playlist-driven vs user-driven basins
- Novelty vs repetition tension (conflict meter)

### Test C: Playlist + Document Reference
Combine video watching with note-taking.

**Metrics:**
- Cross-domain plasticity (video + text)
- Mixed media organization
- Cognitive coherence of transitions

## Why This Beats Traditional List UI

**Traditional:**
- Linear queue of discrete items
- Jump-focused interaction
- Weak implicit structure
- No memory persistence

**This System:**
- Continuous attention deformation in semantic field
- Smooth attention flow
- Persistent memory geometry
- Guided novelty scaffolding
- Reflected personal cognition

## API Reference

### PlasticityService

```typescript
class PlasticityService {
  loadArtifact(source: string | File | PlasticityArtifact): Promise<PlasticityArtifact>
  getNodes(): PlasticityNode[]
  getNodesBySalience(): PlasticityNode[]
  getNodesByPosition(): PlasticityNode[]
  getNodeByVideoId(videoId: string): PlasticityNode | undefined
  compute2DProjection(): Array<{ node: PlasticityNode; x: number; y: number }>
  mapToBristlePositions(bristleCount: number): Map<number, PlasticityNode>
}
```

## Example Output

The artifact JSON structure:

```json
{
  "playlist_id": "PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB",
  "nodes": [
    {
      "video_id": "abc123",
      "playlist_pos": 0,
      "title": "Video Title",
      "channel": "Channel Name",
      "thumbnail": "https://...",
      "salience": 0.85,
      "habit": 0.2,
      "embedding": [0.1, 0.2, ...]
    }
  ],
  "meta": {
    "decay": 0.994,
    "diffuse": 0.06,
    "reinforce": 0.22,
    "novelty_boost": 0.25,
    "total_videos": 50
  }
}
```

## Next Steps

1. Integrate real watch telemetry (YouTube API watch history)
2. Add multi-walker arbitration (Topic/Novelty/Habit/Goal)
3. Implement real-time plasticity updates during viewing
4. Add cross-domain plasticity (video + document embeddings)
5. Visualize field dynamics in real-time

