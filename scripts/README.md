# YouTube Plasticity Engine Scripts

## Quick Start

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

Place the generated JSON file in your `public/` directory or load via API, then:

```typescript
import { PlasticityService } from '../services/plasticityService'

const service = new PlasticityService()
await service.loadArtifact('/plasticity_artifact.json')
const nodes = service.getNodesBySalience()
```

## Customization

Edit `youtube_plasticity.py` to adjust:
- Embedding model (line ~150)
- Plasticity parameters (decay, diffuse, reinforce, novelty_boost)
- Attention event simulation
- Output format

