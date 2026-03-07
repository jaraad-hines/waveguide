"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import WaveguideField from "../components/waveguide_field"
import DomeScene from "../components/dome_scene"
import AnalysisWorkbench from "../components/analysis_workbench"
import { createWaveguideBristles } from "../components/bristleLayout"
import * as THREE from "three"

function CircularRedX({ centerPosition }: { centerPosition: THREE.Vector3 }) {
  const radius = 5.5 // Radius of the circular X ring
  const thickness = 0.15
  const segments = 128 // Number of segments for smooth curve

  // Create a curved path along the circle (each diagonal spans the full 360°)
  const createCurvedPath = (startAngle: number) => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      // Each diagonal goes the full 360° (2π radians) around the circle
      const angle = startAngle + Math.PI * 2 * t
      
      // Position along the circle
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      points.push(new THREE.Vector3(x, 0, z))
    }
    return new THREE.CatmullRomCurve3(points)
  }

  // First diagonal: starts at π/4 (45°), goes full 360° around - top-left to bottom-right and back
  const firstDiagonalPath = createCurvedPath(Math.PI * 0.25)
  
  // Second diagonal: starts at 3π/4 (135°), goes full 360° around - top-right to bottom-left and back
  const secondDiagonalPath = createCurvedPath(Math.PI * 0.75)

  return (
    <group position={centerPosition}>
      {/* First diagonal line of the X */}
      <mesh>
        <tubeGeometry args={[firstDiagonalPath, segments, thickness, 8, true]} />
        <meshBasicMaterial color="red" />
      </mesh>
      {/* Second diagonal line of the X */}
      <mesh>
        <tubeGeometry args={[secondDiagonalPath, segments, thickness, 8, true]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
  )
}

function CircularImageOverlay({ centerPosition, imagePath }: { centerPosition: THREE.Vector3; imagePath: string }) {
  const radius = 6.3 // Slightly bigger radius
  const height = 5 // Height to match the field object (beams extend roughly -3 to +3)
  const radialSegments = 64 // Number of segments around the circle
  const heightSegments = 32 // Number of segments along the height
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(
      imagePath,
      (loadedTexture) => {
        // Repeat texture to wrap around the cylinder
        loadedTexture.wrapS = THREE.RepeatWrapping
        loadedTexture.wrapT = THREE.RepeatWrapping
        setTexture(loadedTexture)
      },
      undefined,
      (error) => {
        console.warn("Could not load texture:", error)
        setHasError(true)
      }
    )
  }, [imagePath])

  // Create geometry without top and bottom caps
  const geometry = useMemo(() => {
    const geom = new THREE.CylinderGeometry(radius, radius, height, radialSegments, heightSegments, false)
    // Remove top and bottom faces
    const positions = geom.attributes.position.array
    const indices = geom.index?.array || []
    const newIndices: number[] = []
    
    // Only keep side faces (exclude faces where all vertices are on top or bottom)
    const halfHeight = height / 2
    const epsilon = 0.01
    
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3
      const i1 = indices[i + 1] * 3
      const i2 = indices[i + 2] * 3
      
      const y0 = positions[i0 + 1]
      const y1 = positions[i1 + 1]
      const y2 = positions[i2 + 1]
      
      // Check if all vertices are on top cap
      const allOnTop = Math.abs(y0 - halfHeight) < epsilon && Math.abs(y1 - halfHeight) < epsilon && Math.abs(y2 - halfHeight) < epsilon
      // Check if all vertices are on bottom cap
      const allOnBottom = Math.abs(y0 + halfHeight) < epsilon && Math.abs(y1 + halfHeight) < epsilon && Math.abs(y2 + halfHeight) < epsilon
      
      // Only keep faces that are not on top or bottom caps
      if (!allOnTop && !allOnBottom) {
        newIndices.push(indices[i], indices[i + 1], indices[i + 2])
      }
    }
    
    geom.setIndex(newIndices)
    geom.computeVertexNormals()
    return geom
  }, [radius, height, radialSegments, heightSegments])

  // Fallback to red X if texture fails to load
  if (hasError || !texture) {
    return <CircularRedX centerPosition={centerPosition} />
  }

  return (
    <group position={centerPosition}>
      <mesh geometry={geometry} rotation={[0, Math.PI * 0.5, Math.PI / 2]}>
        <meshBasicMaterial map={texture} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function ImageOverlay({ 
  position, 
  baseAngle,
  texture, 
  width, 
  height 
}: { 
  position: [number, number, number]
  baseAngle: number
  texture: THREE.Texture
  width: number
  height: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  useFrame(() => {
    if (meshRef.current) {
      const dx = camera.position.x - meshRef.current.position.x
      const dz = camera.position.z - meshRef.current.position.z
      const angle = Math.atan2(dx, dz)
      // Set rotation to face camera horizontally while staying perfectly vertical
      meshRef.current.rotation.set(0, angle, 0)
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent opacity={0.8} />
    </mesh>
  )
}

function CameraController({ 
  selectedFieldX, 
  insideViewIndex, 
  fields 
}: { 
  selectedFieldX: number
  insideViewIndex: number | null
  fields: Array<{ position: THREE.Vector3 }>
}) {
  const { camera, size } = useThree()
  const fixedRotationRef = useRef<THREE.Euler | null>(null)
  const initializedRef = useRef(false)
  const previousCameraStateRef = useRef<{ position: THREE.Vector3; rotation: THREE.Euler } | null>(null)
  const hasSetInitialRotationRef = useRef(false)
  const targetCameraStateRef = useRef<{ position: THREE.Vector3; rotation: THREE.Euler } | null>(null)

  useFrame((state, delta) => {
    // Initialize camera rotation once to look straight ahead
    if (!initializedRef.current) {
      camera.lookAt(0, 0, 0)
      fixedRotationRef.current = camera.rotation.clone()
      initializedRef.current = true
    }

    if (insideViewIndex !== null) {
      // Fullscreen view mode - position camera in front of the filter object
      const field = fields[insideViewIndex]
      
      // Calculate field bounding box
      // From WaveguideField: radius ranges from 2.5 to 4.5, beams extend upward 2.5-4.0 units
      const maxRadius = 4.5
      const maxBeamLength = 4.0
      const fieldWidth = maxRadius * 2 // 9 units (diameter of circular field)
      const fieldHeight = maxBeamLength + 0.3 // ~4.3 units (accounting for base Y variation)
      
      // Field center (bristles are arranged in a circle, center at field position, Y around 0-2)
      const fieldCenter = new THREE.Vector3(field.position.x, 1.5, field.position.z)
      
      // Calculate camera distance to frame the field so bristle ends are at screen edges
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
      const aspect = size.width / size.height
      
      // Calculate distance needed to fit the field horizontally (circular field diameter)
      // We want the full width (diameter) to fit in the viewport
      const distanceHorizontal = (fieldWidth / 2) / Math.tan(fov / 2) / aspect
      // Calculate distance needed to fit the field vertically (including beam height)
      const distanceVertical = (fieldHeight / 2) / Math.tan(fov / 2)
      
      // Use the larger distance to ensure everything fits, with some padding
      const distance = Math.max(distanceHorizontal, distanceVertical) * 1.1
      
      // Position camera directly in front of the field (positive Z direction)
      // Keep camera at same X and Y as field center, but move forward along Z axis
      const targetPosition = new THREE.Vector3(
        fieldCenter.x,
        fieldCenter.y,
        fieldCenter.z + distance // Position camera in front (positive Z)
      )
      
      // Calculate rotation to look directly at field center (front-facing view)
      const direction = fieldCenter.clone().sub(targetPosition).normalize()
      const targetRotation = new THREE.Euler(
        Math.asin(-direction.y),
        Math.atan2(direction.x, direction.z),
        0
      )
      
      // Store target state if not already set
      if (!targetCameraStateRef.current) {
        targetCameraStateRef.current = {
          position: targetPosition.clone(),
          rotation: targetRotation.clone()
        }
      }
      
      // Smoothly move camera to target position
      camera.position.lerp(targetCameraStateRef.current.position, delta * 3)
      
      // Smoothly rotate camera to target rotation
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, targetCameraStateRef.current.rotation.x, delta * 3)
      camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, targetCameraStateRef.current.rotation.y, delta * 3)
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, targetCameraStateRef.current.rotation.z, delta * 3)
      
      // Once close enough, set exact state
      if (camera.position.distanceTo(targetCameraStateRef.current.position) < 0.01) {
        camera.position.copy(targetCameraStateRef.current.position)
        camera.rotation.copy(targetCameraStateRef.current.rotation)
      }
    } else {
      // Reset flag when exiting inside view
      hasSetInitialRotationRef.current = false
      // Normal view mode - restore previous camera state if coming from inside view
      if (previousCameraStateRef.current) {
        camera.position.lerp(previousCameraStateRef.current.position, delta * 2)
        
        // Manually interpolate rotation components
        camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, previousCameraStateRef.current.rotation.x, delta * 2)
        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, previousCameraStateRef.current.rotation.y, delta * 2)
        camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, previousCameraStateRef.current.rotation.z, delta * 2)
        
        // If close enough, restore exact state
        if (camera.position.distanceTo(previousCameraStateRef.current.position) < 0.1) {
          camera.position.copy(previousCameraStateRef.current.position)
          camera.rotation.copy(previousCameraStateRef.current.rotation)
          previousCameraStateRef.current = null
        }
      } else {
        // Smoothly shift camera horizontally to center on selected field
        const targetX = selectedFieldX
        const currentX = camera.position.x
        const newX = THREE.MathUtils.lerp(currentX, targetX, 0.6)
        
        // Pure horizontal translation - keep Y and Z fixed
        camera.position.x = newX
        camera.position.y = 1
        camera.position.z = 20
        
        // Lock rotation completely - no rotation changes, just pure translation
        // This creates the "going down the line" effect
        if (fixedRotationRef.current) {
          camera.rotation.copy(fixedRotationRef.current)
        }
      }
    }
  })

  // Store camera state when entering inside view and calculate target camera position
  useEffect(() => {
    if (insideViewIndex !== null) {
      if (previousCameraStateRef.current === null) {
        previousCameraStateRef.current = {
          position: camera.position.clone(),
          rotation: camera.rotation.clone()
        }
      }
      
      // Reset target camera state so it gets recalculated in useFrame
      targetCameraStateRef.current = null
      
      // Reset the initial rotation flag when entering a new field
      hasSetInitialRotationRef.current = false
    } else {
      // Reset when exiting inside view
      hasSetInitialRotationRef.current = false
      targetCameraStateRef.current = null
    }
  }, [insideViewIndex, camera, fields])

  return null
}


function HUDOverlay({ fieldPosition, text, isActive }: { fieldPosition: THREE.Vector3; text: string; isActive: boolean }) {
  return (
    <Html
      position={[fieldPosition.x, -9, fieldPosition.z]}
      center
      transform
      occlude={false}
      distanceFactor={10}
      style={{ 
        pointerEvents: isActive ? 'auto' : 'none',
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'scale(1)' : 'scale(0.9)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(200, 200, 200, 0.9)',
          borderRadius: '24px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          minWidth: '300px',
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#000000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {/* Text input area */}
        <div style={{ 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          backgroundColor: 'rgba(150, 150, 150, 0.5)',
          borderRadius: '12px',
          padding: '8px 12px',
          color: '#ffffff',
        }}>
          {text}
        </div>
        
        {/* Control buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Play/Pause button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add play/pause functionality
            }}
          >
            {/* Pause icon: two vertical bars */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="6" y="4" width="3" height="12" />
              <rect x="11" y="4" width="3" height="12" />
            </svg>
          </button>
          
          {/* Skip forward button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add skip functionality
            }}
          >
            {/* Skip forward icon: triangle + vertical line */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 4 L14 10 L6 16 Z" />
              <rect x="14" y="4" width="2" height="12" />
            </svg>
          </button>
        </div>
      </div>
    </Html>
  )
}

function HUDOverlayAttachments({ fieldPosition, text, isActive }: { fieldPosition: THREE.Vector3; text: string; isActive: boolean }) {
  return (
    <Html
      position={[fieldPosition.x, -9, fieldPosition.z]}
      center
      transform
      occlude={false}
      distanceFactor={10}
      style={{ 
        pointerEvents: isActive ? 'auto' : 'none',
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'scale(1)' : 'scale(0.9)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(200, 200, 200, 0.9)',
          borderRadius: '24px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          minWidth: '300px',
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#000000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {/* Text input area */}
        <div style={{ 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          backgroundColor: 'rgba(150, 150, 150, 0.5)',
          borderRadius: '12px',
          padding: '8px 12px',
          color: '#ffffff',
        }}>
          {text}
        </div>
        
        {/* Control buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Plus/Attachments button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add attachment functionality
            }}
          >
            {/* Plus icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 4 L10 16 M4 10 L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          
          {/* Skip forward button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add skip functionality
            }}
          >
            {/* Skip forward icon: triangle + vertical line */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 4 L14 10 L6 16 Z" />
              <rect x="14" y="4" width="2" height="12" />
            </svg>
          </button>
        </div>
      </div>
    </Html>
  )
}

function HUDOverlayPhone({ fieldPosition, text, isActive }: { fieldPosition: THREE.Vector3; text: string; isActive: boolean }) {
  return (
    <Html
      position={[fieldPosition.x, -9, fieldPosition.z]}
      center
      transform
      occlude={false}
      distanceFactor={10}
      style={{ 
        pointerEvents: isActive ? 'auto' : 'none',
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'scale(1)' : 'scale(0.9)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(200, 200, 200, 0.9)',
          borderRadius: '24px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          minWidth: '300px',
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#000000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {/* Text input area */}
        <div style={{ 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          backgroundColor: 'rgba(150, 150, 150, 0.5)',
          borderRadius: '12px',
          padding: '8px 12px',
          color: '#ffffff',
        }}>
          {text}
        </div>
        
        {/* Control buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Phone button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add phone functionality
            }}
          >
            {/* Phone icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 2 C3 2 2 3 2 4 L2 16 C2 17 3 18 4 18 L6 18 L6 16 L4 16 L4 4 L16 4 L16 16 L14 16 L14 18 L16 18 C17 18 18 17 18 16 L18 4 C18 3 17 2 16 2 Z" />
              <path d="M10 14 C10.5 14 11 14.5 11 15 C11 15.5 10.5 16 10 16 C9.5 16 9 15.5 9 15 C9 14.5 9.5 14 10 14 Z" />
            </svg>
          </button>
          
          {/* Skip forward button */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add skip functionality
            }}
          >
            {/* Skip forward icon: triangle + vertical line */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 4 L14 10 L6 16 Z" />
              <rect x="14" y="4" width="2" height="12" />
            </svg>
          </button>
        </div>
      </div>
    </Html>
  )
}

export default function Page() {
  const [appMode, setAppMode] = useState<"spatial" | "workbench">("workbench")
  const [selectedIndex, setSelectedIndex] = useState(2) // 0: green, 1: purple, 2: center, 3: blue, 4: orange
  const [insideViewIndex, setInsideViewIndex] = useState<number | null>(null) // Track which field is in inside view mode
  const [hudText, setHudText] = useState("") // Text displayed in HUD
  const [hudText2, setHudText2] = useState("") // Text displayed in second HUD
  const [activeHudIndex, setActiveHudIndex] = useState(0) // 0: first HUD, 1: second HUD
  const [isDomeScene, setIsDomeScene] = useState(true) // Start with dome scene instead of waveguide scene

  // Generate bristles once - shared across WaveguideField and DomeScene
  const bristles = useMemo(() => createWaveguideBristles(), [])

  // Color palettes for each field
  // Far Left: Green gradient (warmer, reduced brightness solid green tone)
  const greenPalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.50, 0.65, 0.35), // Warm medium green
    new THREE.Vector3(0.45, 0.58, 0.32), // Warm olive-green
    new THREE.Vector3(0.40, 0.52, 0.30), // Rich warm green
    new THREE.Vector3(0.35, 0.48, 0.28), // Deep warm olive green
  ]

  // Left: Purple (#6A66A8 and variations)
  const purplePalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.65, 0.55, 0.75), // Lighter purple-peach
    new THREE.Vector3(0.55, 0.50, 0.70), // Medium purple
    new THREE.Vector3(0.50, 0.45, 0.65), // Medium-dark purple
    new THREE.Vector3(0.42, 0.40, 0.66), // Base purple (#6A66A8 ≈ 0.416, 0.400, 0.659)
  ]

  // Center: Default colors (existing palette)
  const defaultPalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.75, 0.55, 0.45), // color1 - peachy
    new THREE.Vector3(0.65, 0.50, 0.60), // color2 - pink-lavender
    new THREE.Vector3(0.50, 0.45, 0.60), // color3 - lavender
    new THREE.Vector3(0.35, 0.40, 0.55), // color4 - blue-lavender
  ]

  // Right: Blue - reduced brightness periwinkle blue gradient (#C0C8E8 and darker variations)
  const bluePalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.60, 0.65, 0.75), // Medium periwinkle blue (reduced from 0.85, 0.88, 0.95)
    new THREE.Vector3(0.55, 0.60, 0.72), // Medium-dark periwinkle blue (reduced from 0.80, 0.82, 0.93)
    new THREE.Vector3(0.50, 0.55, 0.70), // Dark periwinkle blue (reduced from 0.77, 0.79, 0.92)
    new THREE.Vector3(0.45, 0.50, 0.68), // Darkest periwinkle blue - base (#C0C8E8 reduced brightness)
  ]

  // Far Right: Orange gradient (inspired by uploaded image)
  const orangePalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(1.0, 0.65, 0.45), // Light coral/orange
    new THREE.Vector3(0.90, 0.55, 0.35), // Medium orange
    new THREE.Vector3(0.80, 0.45, 0.25), // Reddish orange
    new THREE.Vector3(0.70, 0.35, 0.20), // Dark reddish orange
  ]

  const fields = [
    { position: new THREE.Vector3(-30, 0, 0), colorPalette: greenPalette },
    { position: new THREE.Vector3(-15, 0, 0), colorPalette: purplePalette },
    { position: new THREE.Vector3(0, 0, 0), colorPalette: defaultPalette },
    { position: new THREE.Vector3(15, 0, 0), colorPalette: bluePalette },
    { position: new THREE.Vector3(30, 0, 0), colorPalette: orangePalette },
  ]

  useEffect(() => {
    let wheelTimeout: NodeJS.Timeout | null = null
    let accumulatedDeltaX = 0
    const threshold = 50 // Minimum accumulated scroll to trigger field change

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't capture typing if user is in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if (event.key === "Escape") {
        if (isDomeScene) {
          setIsDomeScene(false)
        } else {
          // Exit inside view mode or clear HUD text
          if (insideViewIndex !== null) {
            setInsideViewIndex(null)
          } else {
            // Clear active HUD text
            if (activeHudIndex === 0) {
              setHudText("")
            } else {
              setHudText2("")
            }
          }
        }
      } else if (event.key === "ArrowLeft") {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else if (event.key === "ArrowRight") {
        setSelectedIndex((prev) => Math.min(fields.length - 1, prev + 1))
      } else if (event.key === "ArrowDown") {
        // Navigate to next HUD (or wrap to first)
        setActiveHudIndex((prev) => (prev + 1) % 2)
      } else if (event.key === "ArrowUp") {
        // Navigate to previous HUD (or wrap to last)
        setActiveHudIndex((prev) => (prev - 1 + 2) % 2)
      } else if (event.key === "Backspace") {
        // Handle backspace for active HUD
        if (activeHudIndex === 0) {
          setHudText((prev) => prev.slice(0, -1))
        } else {
          setHudText2((prev) => prev.slice(0, -1))
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        // Capture regular character input for active HUD
        if (activeHudIndex === 0) {
          setHudText((prev) => prev + event.key)
        } else {
          setHudText2((prev) => prev + event.key)
        }
      }
    }

    const handleWheel = (event: WheelEvent) => {
      // Only handle horizontal scrolling (touchpad two-finger horizontal scroll)
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault()
        
        accumulatedDeltaX += event.deltaX
        
        // Clear existing timeout
        if (wheelTimeout) {
          clearTimeout(wheelTimeout)
        }
        
        // Debounce and check threshold
        wheelTimeout = setTimeout(() => {
          if (Math.abs(accumulatedDeltaX) >= threshold) {
            if (accumulatedDeltaX > 0) {
              // Swiped right - move to next field
              setSelectedIndex((prev) => Math.min(fields.length - 1, prev + 1))
            } else {
              // Swiped left - move to previous field
              setSelectedIndex((prev) => Math.max(0, prev - 1))
            }
            accumulatedDeltaX = 0
          }
        }, 50)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("wheel", handleWheel, { passive: false })
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("wheel", handleWheel)
      if (wheelTimeout) {
        clearTimeout(wheelTimeout)
      }
    }
  }, [fields.length, insideViewIndex, selectedIndex, activeHudIndex, isDomeScene])

  const selectedFieldX = fields[selectedIndex].position.x
  // Calculate offset for HUD positioning (same logic as menu bar)
  const normalizedPosition = selectedFieldX / 30 // -1 to 1
  const hudOffsetX = normalizedPosition * 30 // Scale to percentage offset

  if (appMode === "workbench") {
    return (
      <AnalysisWorkbench
        onOpenSpatial={() => {
          setAppMode("spatial")
          setIsDomeScene(true)
        }}
      />
    )
  }

  return (
    <div className="w-full h-screen bg-black" style={{ position: "relative" }}>
      <div
        style={{
          position: "fixed",
          top: "14px",
          left: "14px",
          zIndex: 20,
          display: "flex",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setAppMode("workbench")}
          style={{
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(11,15,22,0.76)",
            color: "rgba(245,245,245,0.95)",
            padding: "10px 14px",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          Analysis Workbench
        </button>
      </div>
      <Canvas camera={{ position: [0, 1, 20], fov: 60, near: 0.1, far: 200 }} gl={{ antialias: true, alpha: false }}>
        {/* Ambient light for HUD ridge */}
        <ambientLight intensity={0.5} />
        <OrbitControls 
          enabled={!isDomeScene}
          enableDamping 
          dampingFactor={0.05} 
          rotateSpeed={0.5} 
          minDistance={3} 
          maxDistance={50}
          enableRotate={true}
          enablePan={false}
          enableZoom={true}
          target={insideViewIndex !== null ? [fields[insideViewIndex].position.x, 0, fields[insideViewIndex].position.z] : [0, 0, 0]}
        />
        {!isDomeScene && (
          <>
            <CameraController 
              selectedFieldX={selectedFieldX} 
              insideViewIndex={insideViewIndex}
              fields={fields}
            />
            {fields.map((field, index) => {
              if (index === 0) {
                return (
                  <Suspense 
                    key={`overlay-${index}`}
                    fallback={
                      <CircularRedX centerPosition={field.position} />
                    }
                  >
                    <CircularImageOverlay centerPosition={field.position} imagePath="/images/time-up-green.png" />
                  </Suspense>
                )
              } else if (index === 1) {
                return (
                  <Suspense 
                    key={`overlay-${index}`}
                    fallback={
                      <CircularRedX centerPosition={field.position} />
                    }
                  >
                    <CircularImageOverlay centerPosition={field.position} imagePath="/images/time-up-purple.png" />
                  </Suspense>
                )
              } else if (index === 2) {
                return (
                  <Suspense 
                    key={`overlay-${index}`}
                    fallback={
                      <CircularRedX centerPosition={field.position} />
                    }
                  >
                    <CircularImageOverlay centerPosition={field.position} imagePath="/images/time-up-brown.png" />
                  </Suspense>
                )
              } else if (index === 3) {
                return (
                  <Suspense 
                    key={`overlay-${index}`}
                    fallback={
                      <CircularRedX centerPosition={field.position} />
                    }
                  >
                    <CircularImageOverlay centerPosition={field.position} imagePath="/images/time-up-blue.png" />
                  </Suspense>
                )
              } else if (index === 4) {
                return (
                  <Suspense 
                    key={`overlay-${index}`}
                    fallback={
                      <CircularRedX centerPosition={field.position} />
                    }
                  >
                    <CircularImageOverlay centerPosition={field.position} imagePath="/images/time-up-tangerine.png" />
                  </Suspense>
                )
              } else {
                return (
                  <CircularRedX key={`x-${index}`} centerPosition={field.position} />
                )
              }
            })}
            {fields.map((field, index) => {
              const shouldShow = insideViewIndex === null || insideViewIndex === index
              if (!shouldShow) return null

              return (
                <WaveguideField
                  key={index}
                  position={field.position}
                  colorPalette={field.colorPalette}
                  isSelected={index === selectedIndex}
                  bristles={bristles}
                  onDoubleClick={
                    index === selectedIndex
                      ? () => {
                          setIsDomeScene(true)
                        }
                      : undefined
                  }
                />
              )
            })}
            
            {insideViewIndex === null && (
              <>
                <HUDOverlay fieldPosition={fields[selectedIndex].position} text={hudText} isActive={activeHudIndex === 0} />
                <HUDOverlayAttachments fieldPosition={fields[selectedIndex].position} text={hudText2} isActive={activeHudIndex === 1} />
              </>
            )}
          </>
        )}
        {isDomeScene && (
          <DomeScene
            bristles={bristles}
            colorPalette={fields[selectedIndex]?.colorPalette}
            onExit={() => {
              setIsDomeScene(false)
            }}
          />
        )}
      </Canvas>
    </div>
  )
}
