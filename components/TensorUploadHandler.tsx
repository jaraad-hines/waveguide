// Component for handling music file uploads to tensols
// Can be used in dome scene or as a standalone upload interface

"use client"

import { useRef, useEffect } from 'react'
import { TensorService } from '../services/tensorService'
import { useTensorUpload } from '../hooks/useTensorUpload'

interface TensorUploadHandlerProps {
  tensorService: TensorService
  tensolIndex?: number // Optional: target specific tensol, otherwise auto-assign
  onUploadComplete?: (contents: any[]) => void
  onUploadError?: (error: Error) => void
  children?: React.ReactNode
  className?: string
}

export default function TensorUploadHandler({
  tensorService,
  tensolIndex,
  onUploadComplete,
  onUploadError,
  children,
  className = '',
}: TensorUploadHandlerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isUploading,
    uploadProgress,
    uploadMusicFiles,
    handleDrop,
    handleFileInput,
  } = useTensorUpload({
    tensorService,
    onUploadComplete,
    onUploadError,
  })

  // Handle paste (Ctrl+V) for music files
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
            files.push(file)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        await uploadMusicFiles(files, tensolIndex)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [uploadMusicFiles, tensolIndex])

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const onDrop = async (e: React.DragEvent) => {
    await handleDrop(e, tensolIndex)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      className={className}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={onDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm,.mp3,.mp4,.m4a,.wav,.ogg,.webm"
        multiple
        onChange={(e) => handleFileInput(e, tensolIndex)}
        style={{ display: 'none' }}
      />

      {/* Upload indicator */}
      {isUploading && (
        <div className="fixed top-4 right-4 bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="text-sm font-medium">Uploading music files...</div>
          {uploadProgress.size > 0 && (
            <div className="mt-2 space-y-1">
              {Array.from(uploadProgress.entries()).map(([fileName, progress]) => (
                <div key={fileName} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="truncate max-w-[200px]">{fileName}</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-white h-1 rounded-full transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drag overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500 z-40 flex items-center justify-center pointer-events-none">
          <div className="text-blue-500 text-xl font-medium">Drop music files here</div>
        </div>
      )}

      {/* Children with upload trigger */}
      {children && (
        <div onClick={triggerFileInput} style={{ cursor: 'pointer' }}>
          {children}
        </div>
      )}
    </div>
  )
}

