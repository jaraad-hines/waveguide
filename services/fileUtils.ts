import { StoredFile, FileType } from "../types/storage"

const TOTAL_BRISTLES = 16 * 80 // 1280 bristles per field

export function detectFileType(file: File | string): FileType {
  if (typeof file === 'string') {
    // It's a URL/link
    return 'Link'
  }

  const mimeType = file.type.toLowerCase()
  const name = file.name.toLowerCase()

  if (mimeType.startsWith('image/')) {
    return 'Image'
  } else if (mimeType.startsWith('audio/')) {
    return 'Audio'
  } else if (mimeType.startsWith('video/')) {
    return 'Video'
  } else if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.txt') ||
    name.endsWith('.pdf')
  ) {
    return 'Document'
  }

  return 'Other'
}

export function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        resolve(e.target?.result as string)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    } else {
      // For non-image files, we could generate a placeholder
      resolve('')
    }
  })
}

export function assignFileToBristle(
  fieldIndex: number,
  existingFiles: StoredFile[],
  fileId: string
): number {
  // Find an available bristle index
  const usedBristles = new Set(
    existingFiles
      .filter(f => f.fieldIndex === fieldIndex && f.bristleIndex !== undefined)
      .map(f => f.bristleIndex!)
  )

  // Find first available bristle
  for (let i = 0; i < TOTAL_BRISTLES; i++) {
    if (!usedBristles.has(i)) {
      return i
    }
  }

  // If all bristles are used, wrap around
  return existingFiles.length % TOTAL_BRISTLES
}

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

