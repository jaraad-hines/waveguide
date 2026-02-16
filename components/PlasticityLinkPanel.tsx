"use client"

import { useState } from "react"
import { X, Plus, Play, Trash2 } from "lucide-react"
import { Html } from "@react-three/drei"

interface PlasticityLink {
  id: string
  label: string
  url: string
  apiKey: string
  playlistId: string
  status: "idle" | "running" | "success" | "error"
  error?: string
}

interface PlasticityLinkPanelProps {
  domeRadius: number
  onArtifactGenerated?: (artifact: any) => void
  verticalDirection?: 1 | -1
  playlistControls?: {
    mode: "fifo" | "lifo"
    onModeChange: (mode: "fifo" | "lifo") => void
    onStepForward: () => void
    onStepBackward: () => void
    visibleIndices: number[]
    playlistId?: string
  }
}

export default function PlasticityLinkPanel({
  domeRadius,
  onArtifactGenerated,
  verticalDirection = -1,
  playlistControls,
}: PlasticityLinkPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [links, setLinks] = useState<PlasticityLink[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [newApiKey, setNewApiKey] = useState("")
  const [newPlaylistId, setNewPlaylistId] = useState("")
  const [isAddingLink, setIsAddingLink] = useState(false)

  const handleAddLink = () => {
    if (newLabel.trim() && newApiKey.trim() && newPlaylistId.trim()) {
      const newLink: PlasticityLink = {
        id: Date.now().toString(),
        label: newLabel,
        url: "", // This would be populated after generation
        apiKey: newApiKey,
        playlistId: newPlaylistId,
        status: "idle",
      }
      setLinks([...links, newLink])
      setNewLabel("")
      setNewApiKey("")
      setNewPlaylistId("")
      setIsAddingLink(false)
    }
  }

  const handleRemoveLink = (id: string) => {
    setLinks(links.filter((link) => link.id !== id))
  }

  const handleRunScript = async (id: string) => {
    const link = links.find((l) => l.id === id)
    if (!link) return

    const updatedLinks = links.map((l) =>
      l.id === id ? { ...l, status: "running" as const } : l
    )
    setLinks(updatedLinks)

    try {
      // Call the backend API to run the Python script
      const response = await fetch("/api/plasticity/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: link.apiKey,
          playlistId: link.playlistId,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const artifact = await response.json()

      // Update link with success status
      setLinks((prevLinks) =>
        prevLinks.map((l) =>
          l.id === id
            ? {
                ...l,
                status: "success" as const,
                url: artifact.url || "",
              }
            : l
        )
      )

      // Notify parent component of successful generation
      if (onArtifactGenerated) {
        onArtifactGenerated(artifact)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setLinks((prevLinks) =>
        prevLinks.map((l) =>
          l.id === id
            ? {
                ...l,
                status: "error" as const,
                error: errorMessage,
              }
            : l
        )
      )
    }
  }

  const getStatusColor = (status: PlasticityLink["status"]) => {
    switch (status) {
      case "running":
        return "text-blue-400"
      case "success":
        return "text-green-400"
      case "error":
        return "text-red-400"
      default:
        return "text-gray-400"
    }
  }

  return (
    <Html position={[-domeRadius * 0.7, domeRadius * 0.6 * verticalDirection, 0]}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "8px",
          pointerEvents: "auto",
          userSelect: "none",
          zIndex: 1000,
        }}
      >
        {/* Collapsed button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 bg-purple-900/60 hover:bg-purple-800/60 border border-purple-700 rounded text-white text-sm font-medium transition-colors"
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
            }}
          >
            Plasticity ({links.length})
          </button>
        )}

        {/* Expanded panel */}
        {isOpen && (
          <div
            className="bg-gray-900/95 border border-gray-700 rounded-lg p-4 w-80 max-h-96 overflow-y-auto"
            style={{
              pointerEvents: "auto",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Plasticity Links</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Playlist controls */}
            {playlistControls && (
              <div className="mb-4 p-3 bg-gray-800/60 border border-gray-700 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">Quadrant Playlist</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => playlistControls.onModeChange("fifo")}
                      className={`px-2 py-1 text-[10px] rounded border ${
                        playlistControls.mode === "fifo"
                          ? "bg-blue-900/60 border-blue-600 text-blue-200"
                          : "bg-gray-900/50 border-gray-700 text-gray-400"
                      }`}
                    >
                      FIFO
                    </button>
                    <button
                      onClick={() => playlistControls.onModeChange("lifo")}
                      className={`px-2 py-1 text-[10px] rounded border ${
                        playlistControls.mode === "lifo"
                          ? "bg-amber-900/60 border-amber-600 text-amber-200"
                          : "bg-gray-900/50 border-gray-700 text-gray-400"
                      }`}
                    >
                      LIFO
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-gray-400">
                  Showing videos: {playlistControls.visibleIndices.map((idx) => idx + 1).join(", ")}
                </div>
                {playlistControls.playlistId && (
                  <div className="text-[10px] text-gray-500 truncate">Playlist: {playlistControls.playlistId}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={playlistControls.onStepBackward}
                    className="flex-1 px-2 py-1 text-xs bg-gray-700/60 hover:bg-gray-600/60 rounded text-white transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={playlistControls.onStepForward}
                    className="flex-1 px-2 py-1 text-xs bg-blue-900/60 hover:bg-blue-800/60 rounded text-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Links list */}
            <div className="space-y-3 mb-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="p-3 bg-gray-800/50 rounded border border-gray-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium truncate">
                        {link.label}
                      </div>
                      <div className={`text-xs mt-1 ${getStatusColor(link.status)}`}>
                        {link.status === "running" && "Running..."}
                        {link.status === "success" && "✓ Ready"}
                        {link.status === "error" && `✗ ${link.error}`}
                        {link.status === "idle" && "Pending"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRunScript(link.id)}
                        disabled={link.status === "running"}
                        className="p-1 bg-green-900/50 hover:bg-green-800/50 disabled:opacity-50 rounded transition-colors"
                        title="Run script"
                      >
                        <Play className="w-3 h-3 text-green-300" />
                      </button>
                      <button
                        onClick={() => handleRemoveLink(link.id)}
                        className="p-1 bg-red-900/50 hover:bg-red-800/50 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3 text-red-300" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new link form */}
            <div className="border-t border-gray-700 pt-3 space-y-2">
              {!isAddingLink ? (
                <button
                  onClick={() => setIsAddingLink(true)}
                  className="w-full px-3 py-2 text-sm bg-purple-900/50 hover:bg-purple-800/50 border border-purple-700 rounded text-white transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Link
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Link name"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
                  />
                  <input
                    type="password"
                    placeholder="YouTube API Key"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
                  />
                  <input
                    type="text"
                    placeholder="Playlist ID"
                    value={newPlaylistId}
                    onChange={(e) => setNewPlaylistId(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddLink}
                      className="flex-1 px-2 py-1 text-xs bg-green-900/50 hover:bg-green-800/50 rounded text-white transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setIsAddingLink(false)}
                      className="flex-1 px-2 py-1 text-xs bg-gray-800/50 hover:bg-gray-700/50 rounded text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Html>
  )
}
