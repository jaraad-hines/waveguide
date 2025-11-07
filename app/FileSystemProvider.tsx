"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { StoredFile, AuthSession, FileSystemState } from "../types/storage"

const FileSystemContext = createContext<FileSystemState | undefined>(undefined)

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<StoredFile[]>([])
  const [authSessions, setAuthSessions] = useState<AuthSession[]>([])

  const addFile = useCallback((file: StoredFile) => {
    setFiles((prev) => [...prev, file])
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const addAuthSession = useCallback((session: AuthSession) => {
    setAuthSessions((prev) => [
      ...prev.filter((s) => s.provider !== session.provider),
      session,
    ])
  }, [])

  const removeAuthSession = useCallback((provider: string) => {
    setAuthSessions((prev) => prev.filter((s) => s.provider !== provider))
  }, [])

  const getFilesByField = useCallback(
    (fieldIndex: number) => {
      return files.filter((f) => f.fieldIndex === fieldIndex)
    },
    [files]
  )

  const value: FileSystemState = {
    files,
    authSessions,
    addFile,
    removeFile,
    addAuthSession,
    removeAuthSession,
    getFilesByField,
  }

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  )
}

export function useFileSystem() {
  const context = useContext(FileSystemContext)
  if (context === undefined) {
    throw new Error("useFileSystem must be used within a FileSystemProvider")
  }
  return context
}

