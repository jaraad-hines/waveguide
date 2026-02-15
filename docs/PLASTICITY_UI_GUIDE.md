# Plasticity Link Panel Usage Guide

## Overview
The Plasticity Link Panel is a UI component integrated into the Waveguide dome scene that allows you to add and manage links to YouTube playlists, which can then be processed through the Python Plasticity Engine to generate semantic field artifacts for visualization.

## Location
The Plasticity Link Panel appears in the bottom-left of the dome scene, opposite the Facets display. It shows the current number of active links: **Plasticity (N)**

## How to Use

### Adding a New Plasticity Link

1. Click the **"Plasticity (0)"** button to expand the panel
2. Click **"Add Link"** button
3. Fill in the required fields:
   - **Link name**: A descriptive name for this playlist (e.g., "Summer Jazz 2025")
   - **YouTube API Key**: Your YouTube Data API key with quota for playlist operations
   - **Playlist ID**: The ID of the YouTube playlist to process

4. Click **"Add"** to save the link

### Running a Plasticity Script

1. Locate the link in the panel list
2. Click the green **play button (▶)** icon next to the link
3. The status will change to "Running..."
4. Once complete, it will show:
   - **✓ Ready** (success) - The artifact has been generated
   - **✗ Error message** (failure) - Check the error and try again

### Managing Links

- **Remove a link**: Click the red **trash icon** (🗑) next to any link
- **View status**: Each link shows its current status:
  - **Pending** - Waiting to be run
  - **Running...** - Currently processing
  - **✓ Ready** - Successfully generated
  - **✗ Error** - Failed with error message

### Collapsing the Panel

Click the **X** button in the top-right corner of the panel to collapse it. The button will return to showing **"Plasticity (N)"**

## Backend API

### Endpoint
```
POST /api/plasticity/generate
```

### Request Body
```json
{
  "apiKey": "YOUR_YOUTUBE_API_KEY",
  "playlistId": "PLAYLIST_ID_HERE"
}
```

### Response (Success)
```json
{
  "success": true,
  "artifact": { /* plasticity artifact JSON */ },
  "url": "/plasticity_artifact_1234567890.json",
  "message": "Plasticity artifact generated successfully"
}
```

### Response (Error)
```json
{
  "error": "Failed to generate plasticity artifact",
  "details": "Error message here"
}
```

## Requirements

### YouTube API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the YouTube Data API v3
4. Create an API Key credential
5. Note your API Key and Playlist ID

### Python Environment (Server-side)
The backend automatically executes `scripts/youtube_plasticity.py` with:
- Python 3.7+
- Dependencies from `scripts/requirements.txt` installed

### Installation
```bash
cd scripts
pip install -r requirements.txt
```

## Generated Artifacts

Each successful run generates a JSON artifact containing:
- **nodes**: Plasticity nodes with semantic embeddings
- **metadata**: Playlist information and generation timestamp
- **salience**: Computed salience values for each node
- **positions**: 2D projections for spatial visualization

These artifacts are automatically saved to `/public/` and can be:
1. Loaded into the dome scene for visualization
2. Exported for analysis
3. Used with the Waveguide integration utilities

## Workflow Example

```
1. Create YouTube playlist with curated content
2. Add Plasticity Link: "My Semantic Collection"
   - API Key: [your key]
   - Playlist ID: PLxxxx...
3. Click play button in Plasticity Panel
4. Wait for "✓ Ready" status
5. Artifact auto-loads and visualizes in dome
6. Interact with bristles using standard Grip Modes
```

## Troubleshooting

### "API error: 403"
- Check API Key is valid and has YouTube Data API enabled
- Verify quota hasn't been exceeded

### "API error: 404"
- Verify Playlist ID is correct
- Ensure playlist is public or you have access

### "Artifact generation failed"
- Check Python environment has required dependencies
- Review server logs for details
- Ensure write permissions to `/public/` directory

### Panel not visible
- Expand by clicking "Plasticity (0)" button
- Check browser console for errors
- Verify component imported in dome_scene.tsx

## Advanced: Manual Artifact Generation

You can also generate artifacts directly via Python script:

```bash
cd scripts
python youtube_plasticity.py YOUR_API_KEY PLAYLIST_ID output.json
```

Then load the JSON into Waveguide using integration utilities:

```typescript
import { loadPlasticityArtifactToDome } from '../utils/plasticityIntegration'

const { nodes, taggedContents } = await loadPlasticityArtifactToDome(
  'output.json',
  taggingService
)
```

## Related Documentation

- **Plasticity System**: See `docs/PLASTICITY_SYSTEM.md` for technical architecture
- **Integration Guide**: See `utils/plasticityIntegration.ts` for utility functions
- **Service Methods**: See `services/plasticityService.ts` for core functionality
