"use client"

import { StoredFile } from "../../types/storage"

interface HoverPreviewProps {
  file: StoredFile | null
  mousePosition: { x: number; y: number } | null
}

export default function HoverPreview({ file, mousePosition }: HoverPreviewProps) {
  if (!file || !mousePosition) return null

  return (
    <div
      className="fixed pointer-events-none z-50 bg-gray-900/95 border border-gray-700 rounded-lg p-4 shadow-xl max-w-xs"
      style={{
        left: `${mousePosition.x + 20}px`,
        top: `${mousePosition.y + 20}px`,
        transform: 'translateY(-50%)'
      }}
    >
      {file.thumbnail && (
        <img
          src={file.thumbnail}
          alt={file.name}
          className="w-full h-32 object-cover rounded mb-3"
        />
      )}
      <div className="text-white font-medium text-sm mb-1 truncate">{file.name}</div>
      <div className="text-gray-400 text-xs mb-2">{file.type}</div>
      {file.size && (
        <div className="text-gray-500 text-xs">
          {(file.size / 1024).toFixed(1)} KB
        </div>
      )}
      {file.uploadedAt && (
        <div className="text-gray-500 text-xs mt-1">
          {new Date(file.uploadedAt).toLocaleDateString()}
        </div>
      )}
      {file.requiresAuth && (
        <div className="mt-2 text-xs text-yellow-400">
          Requires authentication
        </div>
      )}
    </div>
  )
}

