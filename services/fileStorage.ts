import { StoredFile } from "../types/storage"
import { detectFileType, generateThumbnail, assignFileToBristle, isValidUrl } from "./fileUtils"

export async function processFileUpload(
  fileOrUrl: File | string,
  fieldIndex: number,
  existingFiles: StoredFile[]
): Promise<StoredFile> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  if (typeof fileOrUrl === 'string') {
    // It's a URL/link
    return {
      id: fileId,
      name: fileOrUrl,
      type: 'Link',
      url: fileOrUrl,
      uploadedAt: new Date(),
      fieldIndex,
      bristleIndex: assignFileToBristle(fieldIndex, existingFiles, fileId),
    }
  } else {
    // It's a File object
    const fileType = detectFileType(fileOrUrl)
    const thumbnail = fileType === 'Image' ? await generateThumbnail(fileOrUrl) : undefined

    return {
      id: fileId,
      name: fileOrUrl.name,
      type: fileType,
      file: fileOrUrl,
      thumbnail,
      size: fileOrUrl.size,
      mimeType: fileOrUrl.type,
      uploadedAt: new Date(),
      fieldIndex,
      bristleIndex: assignFileToBristle(fieldIndex, existingFiles, fileId),
      requiresAuth: fileOrUrl.name.toLowerCase().includes('google') || fileOrUrl.type.toLowerCase().includes('google'),
    }
  }
}

