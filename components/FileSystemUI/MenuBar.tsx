"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { StoredFile, FileType, AuthSession } from "../../types/storage"
import { useFileSystem } from "../../app/FileSystemProvider"

interface MenuBarProps {
  fieldIndex: number
  fieldPositionX: number
}

export default function MenuBar({ fieldIndex, fieldPositionX }: MenuBarProps) {
  const { files, authSessions, getFilesByField, removeAuthSession, addAuthSession } = useFileSystem()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fieldFiles = getFilesByField(fieldIndex)

  // Convert field X position to screen position
  // Fields are at: -30, -15, 0, 15, 30 in 3D space
  // Center field (0) should be at 0% offset, others offset proportionally
  const normalizedPosition = fieldPositionX / 30 // -1 to 1
  const offsetX = normalizedPosition * 30 // Scale to percentage offset

  // Organize files by type
  const filesByType: Record<FileType, StoredFile[]> = {
    Link: [],
    Audio: [],
    Image: [],
    Video: [],
    Document: [],
    Other: [],
  }

  fieldFiles.forEach((file) => {
    filesByType[file.type].push(file)
  })

  const handleAuthAdd = () => {
    const provider = prompt("Enter provider name (e.g., google, dropbox):")
    if (provider) {
      // In a real implementation, this would trigger OAuth flow
      // For now, we'll add a placeholder session
      addAuthSession({
        provider: provider.toLowerCase(),
        userInfo: { name: `User ${provider}` },
      })
    }
  }

  const handleFileSelect = (file: StoredFile) => {
    if (file.url) {
      window.open(file.url, '_blank')
    } else if (file.file) {
      const url = URL.createObjectURL(file.file)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  return (
    <>
      {/* Menu Bar with Ridges - simplified for testing */}
      <div
        className="fixed bottom-0 left-1/2 h-16 bg-black/80 backdrop-blur-sm border-t border-gray-800 z-50 transition-all duration-300 menu-bar pointer-events-none"
        style={{
          transform: `translateX(calc(${offsetX}% - 50%))`,
          width: '400px',
        }}
      >
        <div className="max-w-md mx-auto h-full flex items-center justify-center relative">
          {/* Ridges */}
          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-30">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="h-full w-px bg-gray-600"
                style={{
                  height: '60%',
                  marginTop: '20%'
                }}
              />
            ))}
          </div>
          
          {/* Menu Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="relative z-10 px-6 py-2 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-700 rounded-lg transition-colors text-white text-sm font-medium pointer-events-auto"
          >
            Files & Auth ({fieldFiles.length})
          </button>
        </div>
      </div>

      {/* Simple Modal without Radix UI for testing */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-lg w-[90vw] max-w-4xl max-h-[85vh] z-[101] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">
                Field {fieldIndex + 1} - Files & Authentication
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Authentication Section */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-white mb-4">Authentication</h3>
                <div className="space-y-2">
                  {authSessions.map((session) => (
                    <div
                      key={session.provider}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700"
                    >
                      <span className="text-white capitalize">{session.provider}</span>
                      <button
                        onClick={() => removeAuthSession(session.provider)}
                        className="px-3 py-1 text-sm bg-red-900/50 hover:bg-red-800/50 text-red-200 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAuthAdd}
                    className="w-full p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded text-white text-sm transition-colors"
                  >
                    + Add Authentication
                  </button>
                </div>
              </div>

              {/* Files by Type */}
              <div className="space-y-6">
                {Object.entries(filesByType).map(([type, typeFiles]) => {
                  if (typeFiles.length === 0) return null
                  
                  return (
                    <div key={type}>
                      <h3 className="text-lg font-medium text-white mb-3">{type}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {typeFiles.map((file) => (
                          <div
                            key={file.id}
                            onClick={() => handleFileSelect(file)}
                            className="p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded cursor-pointer transition-colors"
                          >
                            {file.thumbnail ? (
                              <img
                                src={file.thumbnail}
                                alt={file.name}
                                className="w-full h-24 object-cover rounded mb-2"
                              />
                            ) : (
                              <div className="w-full h-24 bg-gray-700 rounded mb-2 flex items-center justify-center text-gray-400 text-xs">
                                {file.type}
                              </div>
                            )}
                            <div className="text-white text-xs truncate">{file.name}</div>
                            {file.size && (
                              <div className="text-gray-400 text-xs">
                                {(file.size / 1024).toFixed(1)} KB
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {fieldFiles.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No files uploaded yet. Drop files or paste links on the field.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

