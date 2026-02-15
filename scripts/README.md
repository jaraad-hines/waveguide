# YouTube Plasticity Engine Scripts

## Quick Start

### Option 1: Direct Command Line

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Get YouTube API key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable "YouTube Data API v3"
   - Create API key

3. **Run the engine:**
   ```bash
   python youtube_plasticity.py YOUR_API_KEY PLAYLIST_ID output.json
   ```

### Option 2: Waveguide UI (Recommended)

1. Load Waveguide in your browser
2. Look for the **"Plasticity (0)"** panel in the bottom-left of the dome scene
3. Click to expand and select **"Add Link"**
4. Enter your API Key and Playlist ID
5. Click the **▶ play button** to start generation
6. Watch for **✓ Ready** status when complete

See `docs/PLASTICITY_UI_GUIDE.md` for detailed UI instructions.

## Example

```bash
# Extract playlist ID from URL
# https://youtube.com/playlist?list=PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB
# Playlist ID: PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB

python youtube_plasticity.py YOUR_KEY PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB artifact.json
```

## Output

The script generates a JSON file with:
- Video metadata (title, channel, thumbnail, etc.)
- Semantic embeddings (for spatial placement)
- Salience values (for visualization brightness)
- Habit scores (for preference modeling)

## Loading in Waveguide

### Via UI (Easiest)
Use the Plasticity Link Panel - automatic loading when artifacts are generated.

### Programmatically

Place the generated JSON file in your `public/` directory or load via API:

```typescript
import { PlasticityService } from '../services/plasticityService'

const service = new PlasticityService()
await service.loadArtifact('/plasticity_artifact.json')
const nodes = service.getNodesBySalience()
```

## Backend API Endpoint

The Waveguide server provides an automated endpoint for artifact generation:

```
POST /api/plasticity/generate
Content-Type: application/json

{
  "apiKey": "YOUR_YOUTUBE_API_KEY",
  "playlistId": "PLAYLIST_ID_HERE"
}
```

Response:
```json
{
  "success": true,
  "artifact": { /* ... */ },
  "url": "/plasticity_artifact_1234567890.json",
  "message": "Plasticity artifact generated successfully"
}
```

## Customization

Edit `youtube_plasticity.py` to adjust:
- Embedding model (line ~150)
- Plasticity parameters (decay, diffuse, reinforce, novelty_boost)
- Attention event simulation
- Output format

