#!/usr/bin/env python3
"""
YouTube Playlist Plasticity Engine
End-to-end implementation for loading playlists, generating embeddings,
and running plasticity dynamics to produce Waveguide/Proto artifacts.
"""

from dataclasses import dataclass
from typing import Optional, Dict, List
import numpy as np
import json
import sys
from pathlib import Path

# YouTube API
try:
    from googleapiclient.discovery import build
    YOUTUBE_API_AVAILABLE = True
except ImportError:
    YOUTUBE_API_AVAILABLE = False
    print("Warning: google-api-python-client not installed. Install with: pip install google-api-python-client")

# Embeddings
try:
    from sentence_transformers import SentenceTransformer
    EMBEDDING_AVAILABLE = True
except ImportError:
    EMBEDDING_AVAILABLE = False
    print("Warning: sentence-transformers not installed. Install with: pip install sentence-transformers")


@dataclass
class Video:
    video_id: str
    playlist_pos: int
    title: str
    description: str
    channel_title: str
    published_at: str
    duration_seconds: Optional[int] = None
    thumbnail_url: Optional[str] = None
    
    # semantic
    emb: Optional[np.ndarray] = None
    
    # plastic state
    salience: float = 0.0      # long-term
    habit: float = 0.0         # long-term prior (optional)
    last_seen_t: Optional[int] = None


@dataclass
class AttentionEvent:
    t: int                 # timestep
    video_id: str
    watch_frac: float      # 0..1
    rewatch: float = 0.0   # 0..1 (optional)
    seek_count: int = 0    # optional
    like: bool = False
    note_chars: int = 0    # if writing notes while watching


def fetch_playlist_videos(api_key: str, playlist_id: str, max_pages: int = 50) -> List[Video]:
    """Fetch playlist items from YouTube API."""
    if not YOUTUBE_API_AVAILABLE:
        raise ImportError("google-api-python-client not installed")
    
    yt = build("youtube", "v3", developerKey=api_key)
    
    videos: List[Video] = []
    page_token = None
    pages = 0
    
    while pages < max_pages:
        req = yt.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=playlist_id,
            maxResults=50,
            pageToken=page_token
        )
        resp = req.execute()
        
        for item in resp.get("items", []):
            sn = item["snippet"]
            cd = item["contentDetails"]
            vid = cd["videoId"]
            
            thumbnails = sn.get("thumbnails", {})
            thumbnail_url = None
            if thumbnails.get("medium"):
                thumbnail_url = thumbnails["medium"].get("url")
            elif thumbnails.get("default"):
                thumbnail_url = thumbnails["default"].get("url")
            
            videos.append(Video(
                video_id=vid,
                playlist_pos=int(sn.get("position", 0)),
                title=sn.get("title", ""),
                description=sn.get("description", ""),
                channel_title=sn.get("videoOwnerChannelTitle", sn.get("channelTitle", "")),
                published_at=sn.get("publishedAt", ""),
                thumbnail_url=thumbnail_url
            ))
        
        page_token = resp.get("nextPageToken")
        pages += 1
        if not page_token:
            break
    
    videos.sort(key=lambda v: v.playlist_pos)
    return videos


def embed_texts_local(texts: List[str]) -> np.ndarray:
    """Embed texts using local sentence-transformers model."""
    if not EMBEDDING_AVAILABLE:
        raise ImportError("sentence-transformers not installed")
    
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embs = model.encode(texts, normalize_embeddings=True)
    return np.array(embs, dtype=np.float32)


def attach_embeddings(videos: List[Video], embed_fn) -> None:
    """Attach embeddings to videos."""
    texts = [f"{v.title}\n{v.channel_title}\n{v.description[:600]}" for v in videos]
    embs = embed_fn(texts)  # shape (N, D), normalized
    for v, e in zip(videos, embs):
        v.emb = e


class PlasticityEngine:
    """Core plasticity engine for attention field dynamics."""
    
    def __init__(
        self,
        videos: List[Video],
        k_neighbors: int = 12,
        decay: float = 0.994,
        diffuse: float = 0.06,
        reinforce: float = 0.22,
        novelty_boost: float = 0.25,
    ):
        self.videos = videos
        self.idx = {v.video_id: i for i, v in enumerate(videos)}
        self.decay = decay
        self.diffuse = diffuse
        self.reinforce = reinforce
        self.novelty_boost = novelty_boost
        
        self.emb = np.stack([v.emb for v in videos]).astype(np.float32)  # (N,D)
        self.N = self.emb.shape[0]
        
        # kNN graph in embedding space for diffusion
        sim = self.emb @ self.emb.T
        np.fill_diagonal(sim, -np.inf)
        self.knn = np.argsort(sim, axis=1)[:, ::-1][:, :k_neighbors]  # top-k by cosine similarity
        
        self.sal = np.zeros(self.N, dtype=np.float32)
        self.habit = np.array([v.habit for v in videos], dtype=np.float32)
        
        # user "mean" embedding for novelty comparison
        self.user_mean = self.emb.mean(axis=0)
    
    def _diffuse_salience(self):
        """Diffuse salience to neighbors."""
        nbr_mean = self.sal[self.knn].mean(axis=1)
        self.sal = (1 - self.diffuse) * self.sal + self.diffuse * nbr_mean
    
    def _novelty(self, i: int) -> float:
        """Higher novelty if far from user's mean and not in habit basin."""
        e = self.emb[i]
        cos_to_mean = float(e @ self.user_mean)
        dist = 1.0 - cos_to_mean  # 0..2
        anti_habit = 1.0 - float(self.habit[i])
        return float(np.clip(0.65 * dist + 0.35 * anti_habit, 0.0, 1.0))
    
    def step(self, ev: AttentionEvent):
        """Process an attention event and update plasticity."""
        # 1) decay + diffusion each step
        self.sal *= self.decay
        self._diffuse_salience()
        
        i = self.idx[ev.video_id]
        
        # 2) compute "attention energy"
        attn = (
            0.70 * np.clip(ev.watch_frac, 0, 1)
            + 0.15 * np.clip(ev.rewatch, 0, 1)
            + 0.10 * np.tanh(ev.seek_count / 5.0)
            + 0.05 * np.tanh(ev.note_chars / 400.0)
        )
        if ev.like:
            attn = min(1.0, attn + 0.10)
        
        # 3) novelty shaping
        nov = self._novelty(i)
        gain = self.reinforce * (attn + self.novelty_boost * nov)
        
        # 4) apply reinforcement
        self.sal[i] += gain
        
        # 5) update user mean toward what they actually consumed
        lr = 0.03 * attn
        self.user_mean = (1 - lr) * self.user_mean + lr * self.emb[i]
        self.user_mean /= (np.linalg.norm(self.user_mean) + 1e-9)
    
    def export_field(self) -> List[dict]:
        """Export field state as JSON-serializable format."""
        # Normalize salience to 0..1 for rendering
        s = self.sal.copy()
        if s.max() > s.min():
            s = (s - s.min()) / (s.max() - s.min())
        else:
            s = np.zeros_like(s)
        
        out = []
        for i, v in enumerate(self.videos):
            out.append({
                "video_id": v.video_id,
                "playlist_pos": v.playlist_pos,
                "title": v.title,
                "channel": v.channel_title,
                "thumbnail": v.thumbnail_url,
                "description": v.description,
                "published_at": v.published_at,
                "salience": float(s[i]),
                "habit": float(self.habit[i]),
                "embedding": v.emb.tolist(),  # full embedding for spatial placement
            })
        return out


def simulate_playlist_session(videos: List[Video]) -> List[AttentionEvent]:
    """Simulate a playlist viewing session for testing."""
    events = []
    t = 0
    for v in videos:
        # pretend: early items watched more, later some skipping
        watch_frac = float(np.clip(np.random.normal(loc=0.8, scale=0.25), 0, 1))
        like = watch_frac > 0.85 and (np.random.rand() < 0.25)
        note_chars = int(max(0, np.random.normal(120, 90))) if watch_frac > 0.6 else 0
        events.append(AttentionEvent(
            t=t, video_id=v.video_id, watch_frac=watch_frac,
            rewatch=0.0, seek_count=int(np.random.poisson(1)), like=like, note_chars=note_chars
        ))
        t += 1
    return events


def build_plasticity_artifact(
    api_key: str,
    playlist_id: str,
    output_path: str = "plasticity_artifact.json",
    simulate: bool = True
) -> dict:
    """Main function to build plasticity artifact from playlist."""
    print(f"Fetching playlist: {playlist_id}")
    videos = fetch_playlist_videos(api_key, playlist_id)
    print(f"Loaded {len(videos)} videos")
    if not videos:
        raise ValueError("No videos found in playlist")
    
    print(f"First video: {videos[0].title}")
    
    # Embeddings
    print("Generating embeddings...")
    attach_embeddings(videos, embed_texts_local)
    print("Embeddings complete")
    
    # Initialize engine
    engine = PlasticityEngine(videos)
    
    # Simulated or real attention events
    if simulate:
        print("Simulating playlist session...")
        events = simulate_playlist_session(videos)
        for ev in events:
            engine.step(ev)
        print(f"Processed {len(events)} attention events")
    
    # Export artifact
    artifact = {
        "playlist_id": playlist_id,
        "nodes": engine.export_field(),
        "meta": {
            "decay": engine.decay,
            "diffuse": engine.diffuse,
            "reinforce": engine.reinforce,
            "novelty_boost": engine.novelty_boost,
            "total_videos": len(videos),
        }
    }
    
    # Save to file
    output_file = Path(output_path)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(artifact, f, ensure_ascii=False, indent=2)
    
    print(f"Artifact saved to: {output_file.absolute()}")
    return artifact


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python youtube_plasticity.py <API_KEY> <PLAYLIST_ID> [OUTPUT_PATH]")
        print("\nExample:")
        print("  python youtube_plasticity.py YOUR_API_KEY PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB output.json")
        sys.exit(1)
    
    api_key = sys.argv[1]
    playlist_id = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else "plasticity_artifact.json"
    
    try:
        artifact = build_plasticity_artifact(api_key, playlist_id, output_path)
        print(f"\nSuccess! Generated artifact with {len(artifact['nodes'])} nodes")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

