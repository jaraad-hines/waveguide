"use client"

import { useEffect, useCallback, useState } from "react"
import { useFileSystem } from "../../app/FileSystemProvider"
import { processFileUpload } from "../../services/fileStorage"
import { isValidUrl } from "../../services/fileUtils"

interface FileInputHandlerProps {
  selectedFieldIndex: number
  insideViewIndex: number | null
}

export default function FileInputHandler({
  selectedFieldIndex,
  insideViewIndex,
}: FileInputHandlerProps) {
  const { files, addFile } = useFileSystem()
  const [isDragging, setIsDragging] = useState(false)

  const handleFileUpload = useCallback(
    async (fileOrUrl: File | string) => {
      const storedFile = await processFileUpload(fileOrUrl, selectedFieldIndex, files)
      addFile(storedFile)
    },
    [selectedFieldIndex, files, addFile]
  )

  // Handle paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (insideViewIndex !== null) return

      const items = event.clipboardData?.items
      if (!items) return

      // Check for files first
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            await handleFileUpload(file)
            return
          }
        }
      }

      // Check for text (URLs)
      const text = event.clipboardData?.getData('text')
      if (text && isValidUrl(text)) {
        event.preventDefault()
        await handleFileUpload(text)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [selectedFieldIndex, insideViewIndex, handleFileUpload])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (insideViewIndex !== null) return

      const droppedFiles = Array.from(e.dataTransfer.files)
      const droppedText = e.dataTransfer.getData('text/plain')

      if (droppedFiles.length > 0) {
        for (const file of droppedFiles) {
          await handleFileUpload(file)
        }
      } else if (droppedText && isValidUrl(droppedText)) {
        await handleFileUpload(droppedText)
      }
    },
    [insideViewIndex, handleFileUpload]
  )

  // Attach handlers to window/document level
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
    }

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
    }

    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('dragleave', handleWindowDragLeave)

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('dragleave', handleWindowDragLeave)
    }
  }, [])

  return (
    <>
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-blue-400 text-xl font-medium">Drop files here</div>
        </div>
      )}
    </>
  )
}

// Export handlers for use on the container
export function useFileInputHandlers(
  selectedFieldIndex: number,
  insideViewIndex: number | null,
  onFileUpload: (fileOrUrl: File | string) => Promise<void>
) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (insideViewIndex !== null) return

      const droppedFiles = Array.from(e.dataTransfer.files)
      const droppedText = e.dataTransfer.getData('text/plain')

      if (droppedFiles.length > 0) {
        for (const file of droppedFiles) {
          await onFileUpload(file)
        }
      } else if (droppedText && isValidUrl(droppedText)) {
        await onFileUpload(droppedText)
      }
    },
    [insideViewIndex, onFileUpload]
  )

  return { isDragging, handleDragOver, handleDragLeave, handleDrop }
}
