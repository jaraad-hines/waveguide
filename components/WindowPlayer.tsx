"use client"

import { useState, useRef, useEffect } from "react"
import { Html } from "@react-three/drei"
import * as THREE from "three"

interface WindowPlayerProps {
  position: [number, number, number]
  content: {
    id: string
    title: string
    url?: string
    thumbnail?: string
    contentType: 'youtube' | 'browser' | 'api'
    apiEndpoint?: string
  }
  isVisible: boolean
  onClose: () => void
  size?: [number, number] // width, height
}

export default function WindowPlayer({
  position,
  content,
  isVisible,
  onClose,
  size = [400, 300],
}: WindowPlayerProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!isVisible) return null

  const renderContent = () => {
    switch (content.contentType) {
      case 'youtube':
        if (content.url) {
          // Extract video ID from YouTube URL
          const videoId = extractYouTubeVideoId(content.url)
          if (videoId) {
            return (
              <iframe
                width={size[0]}
                height={size[1]}
                src={`https://www.youtube.com/embed/${videoId}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none' }}
              />
            )
          }
        }
        return (
          <div style={{ width: size[0], height: size[1], background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <p>YouTube video: {content.title}</p>
          </div>
        )

      case 'browser':
        return (
          <iframe
            width={size[0]}
            height={size[1]}
            src={content.url || content.apiEndpoint}
            frameBorder="0"
            style={{ border: 'none' }}
          />
        )

      case 'api':
        return (
          <div style={{ width: size[0], height: size[1], background: '#1a1a1a', color: '#fff', padding: '10px', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>{content.title}</h3>
            <p style={{ fontSize: '12px', color: '#aaa' }}>API Endpoint: {content.apiEndpoint}</p>
          </div>
        )

      default:
        return (
          <div style={{ width: size[0], height: size[1], background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>{content.title}</p>
          </div>
        )
    }
  }

  return (
    <Html
      position={position}
      center
      transform
      occlude
      distanceFactor={10}
      style={{
        pointerEvents: 'auto',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          width: size[0],
          height: isMinimized ? 40 : size[1] + 40,
          background: '#2a2a2a',
          border: '2px solid #444',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 0.3s ease',
        }}
      >
        {/* Window header */}
        <div
          style={{
            height: '40px',
            background: '#1a1a1a',
            borderBottom: '1px solid #444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            cursor: 'move',
          }}
        >
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
            {content.title}
          </span>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                background: '#444',
                border: 'none',
                color: '#fff',
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {isMinimized ? '□' : '_'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#d32f2f',
                border: 'none',
                color: '#fff',
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Window content */}
        {!isMinimized && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderContent()}
          </div>
        )}
      </div>
    </Html>
  )
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

