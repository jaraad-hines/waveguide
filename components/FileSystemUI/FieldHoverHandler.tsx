"use client"

import { useCallback, useState } from "react"
import { useFileSystem } from "../../app/FileSystemProvider"
import HoverPreview from "./HoverPreview"

interface FieldHoverHandlerProps {
  selectedFieldIndex: number
  insideViewIndex: number | null
}

export default function FieldHoverHandler({
  selectedFieldIndex,
  insideViewIndex,
}: FieldHoverHandlerProps) {
  const { getFilesByField } = useFileSystem()
  const [hoveredFile, setHoveredFile] = useState<any>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (insideViewIndex !== null) {
        setHoveredFile(null)
        setMousePosition(null)
        return
      }

      // Only show preview when hovering over canvas area (not menu bar)
      const target = e.target as HTMLElement
      if (target.closest('.menu-bar') || target.closest('[role="dialog"]')) {
        setHoveredFile(null)
        setMousePosition(null)
        return
      }

      setMousePosition({ x: e.clientX, y: e.clientY })

      // Find file at mouse position (simplified - in real implementation, you'd raycast to 3D objects)
      // For now, we'll show preview on hover over the selected field area
      const selectedFieldFiles = getFilesByField(selectedFieldIndex)
      if (selectedFieldFiles.length > 0) {
        // Show first file as preview (in real implementation, detect which bristle/file is under cursor)
        setHoveredFile(selectedFieldFiles[0])
      } else {
        setHoveredFile(null)
      }
    },
    [selectedFieldIndex, insideViewIndex, getFilesByField]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredFile(null)
    setMousePosition(null)
  }, [])

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none z-30"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      <HoverPreview file={hoveredFile} mousePosition={mousePosition} />
    </>
  )
}

