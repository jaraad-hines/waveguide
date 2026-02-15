// Utilities for processing music files (mp3/mp4) for tensor system

import { TensorContent, MusicFileType } from '../types/tensor'

/**
 * Extract metadata from audio/video file
 * This is a basic implementation - can be enhanced with libraries like music-metadata
 */
export async function extractMusicMetadata(file: File): Promise<Record<string, any>> {
  const metadata: Record<string, any> = {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  }

  // Try to extract duration from media element
  try {
    const duration = await getMediaDuration(file)
    if (duration) {
      metadata.duration = duration
    }
  } catch (error) {
    console.warn('Could not extract duration:', error)
  }

  // Extract basic info from filename
  const nameParts = file.name.replace(/\.[^/.]+$/, '').split(' - ')
  if (nameParts.length >= 2) {
    metadata.artist = nameParts[0].trim()
    metadata.title = nameParts.slice(1).join(' - ').trim()
  }

  return metadata
}

/**
 * Get duration of audio/video file using HTMLMediaElement
 */
export function getMediaDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio')
    
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(media.duration || null)
    }
    
    media.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    
    media.src = url
  })
}

/**
 * Generate thumbnail for video files
 */
export function generateVideoThumbnail(file: File, timeOffset: number = 1): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve(null)
      return
    }

    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      URL.revokeObjectURL(url)
      resolve(null)
      return
    }

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timeOffset, video.duration * 0.1)
    }

    video.onseeked = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
      URL.revokeObjectURL(url)
      resolve(thumbnail)
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    video.src = url
    video.load()
  })
}

/**
 * Generate waveform visualization for audio files
 * This is a placeholder - would need Web Audio API for full implementation
 */
export async function generateAudioWaveform(file: File): Promise<string | null> {
  // Placeholder - would use Web Audio API to analyze audio and generate waveform
  // For now, return null (can be enhanced later)
  return null
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Validate music file before processing
 */
export function validateMusicFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 500 * 1024 * 1024 // 500MB limit
  const allowedTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/webm',
  ]
  
  const allowedExtensions = ['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.webm']
  
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${formatFileSize(maxSize)} limit` }
  }
  
  const hasValidType = allowedTypes.some(type => file.type.includes(type.split('/')[1]))
  const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  
  if (!hasValidType && !hasValidExtension) {
    return { 
      valid: false, 
      error: `Invalid file type. Allowed: ${allowedExtensions.join(', ')}` 
    }
  }
  
  return { valid: true }
}

