// Hook for handling music file uploads to tensor system (tensols)

import { useState, useCallback } from 'react'
import { TensorService } from '../services/tensorService'
import { TensorContent } from '../types/tensor'
import { validateMusicFile, extractMusicMetadata } from '../services/musicFileUtils'

interface UseTensorUploadOptions {
  tensorService: TensorService
  onUploadComplete?: (contents: TensorContent[]) => void
  onUploadError?: (error: Error) => void
}

export function useTensorUpload({ 
  tensorService, 
  onUploadComplete,
  onUploadError 
}: UseTensorUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map())

  const uploadMusicFile = useCallback(async (
    file: File, 
    tensolIndex?: number
  ): Promise<TensorContent> => {
    setIsUploading(true)
    
    try {
      // Validate file
      const validation = validateMusicFile(file)
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid music file')
      }

      // Extract metadata (async operation)
      setUploadProgress(prev => new Map(prev).set(file.name, 0.3))
      const metadata = await extractMusicMetadata(file)
      
      setUploadProgress(prev => new Map(prev).set(file.name, 0.7))
      
      // Tag to tensor service
      const tensorContent = tensorService.tagMusicFile(file, tensolIndex, metadata)
      
      setUploadProgress(prev => {
        const next = new Map(prev)
        next.set(file.name, 1.0)
        return next
      })

      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const next = new Map(prev)
          next.delete(file.name)
          return next
        })
      }, 1000)

      setIsUploading(false)
      
      if (onUploadComplete) {
        onUploadComplete([tensorContent])
      }

      return tensorContent
    } catch (error) {
      setIsUploading(false)
      setUploadProgress(prev => {
        const next = new Map(prev)
        next.delete(file.name)
        return next
      })

      const err = error instanceof Error ? error : new Error('Unknown upload error')
      if (onUploadError) {
        onUploadError(err)
      }
      throw err
    }
  }, [tensorService, onUploadComplete, onUploadError])

  const uploadMusicFiles = useCallback(async (
    files: File[], 
    tensolIndex?: number
  ): Promise<TensorContent[]> => {
    setIsUploading(true)
    const results: TensorContent[] = []
    const errors: Error[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const progress = (i + 1) / files.length
      
      try {
        setUploadProgress(prev => new Map(prev).set(file.name, progress * 0.8))
        
        const validation = validateMusicFile(file)
        if (!validation.valid) {
          throw new Error(validation.error || `Invalid music file: ${file.name}`)
        }

        const metadata = await extractMusicMetadata(file)
        const tensorContent = tensorService.tagMusicFile(file, tensolIndex, metadata)
        results.push(tensorContent)
        
        setUploadProgress(prev => new Map(prev).set(file.name, 1.0))
      } catch (error) {
        const err = error instanceof Error ? error : new Error(`Error uploading ${file.name}`)
        errors.push(err)
        setUploadProgress(prev => {
          const next = new Map(prev)
          next.delete(file.name)
          return next
        })
        console.error(`Error uploading file ${file.name}:`, error)
      }
    }

    // Clear all progress after delay
    setTimeout(() => {
      setUploadProgress(new Map())
    }, 1000)

    setIsUploading(false)

    if (errors.length > 0 && onUploadError) {
      onUploadError(new Error(`Failed to upload ${errors.length} file(s)`))
    }

    if (results.length > 0 && onUploadComplete) {
      onUploadComplete(results)
    }

    return results
  }, [tensorService, onUploadComplete, onUploadError])

  const handleDrop = useCallback(async (
    e: React.DragEvent,
    tensolIndex?: number
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const validation = validateMusicFile(file)
      return validation.valid
    })

    if (files.length > 0) {
      await uploadMusicFiles(files, tensolIndex)
    }
  }, [uploadMusicFiles])

  const handleFileInput = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    tensolIndex?: number
  ) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files).filter(file => {
        const validation = validateMusicFile(file)
        return validation.valid
      })
      
      if (fileArray.length > 0) {
        await uploadMusicFiles(fileArray, tensolIndex)
      }
      
      // Reset input
      e.target.value = ''
    }
  }, [uploadMusicFiles])

  return {
    isUploading,
    uploadProgress,
    uploadMusicFile,
    uploadMusicFiles,
    handleDrop,
    handleFileInput,
  }
}

