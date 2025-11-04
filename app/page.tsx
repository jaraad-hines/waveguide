"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import WaveguideField from "../components/waveguide_field"
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

function CameraController({ selectedFieldX }: { selectedFieldX: number }) {
  const { camera } = useThree()
  const fixedRotationRef = useRef<THREE.Euler | null>(null)
  const initializedRef = useRef(false)

  useFrame(() => {
    // Initialize camera rotation once to look straight ahead
    if (!initializedRef.current) {
      camera.lookAt(0, 0, 0)
      fixedRotationRef.current = camera.rotation.clone()
      initializedRef.current = true
    }

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
  })

  return null
}

export default function Page() {
  const [selectedIndex, setSelectedIndex] = useState(2) // 0: green, 1: purple, 2: center, 3: blue, 4: orange
  const [doubleClickedIndex, setDoubleClickedIndex] = useState<number | null>(null) // Track which field is double-clicked

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
      if (event.key === "ArrowLeft") {
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else if (event.key === "ArrowRight") {
        setSelectedIndex((prev) => Math.min(fields.length - 1, prev + 1))
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
  }, [fields.length])

  const selectedFieldX = fields[selectedIndex].position.x

  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={{ position: [0, 1, 20], fov: 60, near: 0.1, far: 200 }} gl={{ antialias: true, alpha: false }}>
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          rotateSpeed={0.5} 
          minDistance={3} 
          maxDistance={50}
          enableRotate={true}
          enablePan={false}
          enableZoom={true}
        />
        <CameraController selectedFieldX={selectedFieldX} />
        {fields.map((field, index) => {
          if (index === 0) {
            // Leftmost field (green) - use green image
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
            // Purple field - use purple image
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
            // Center field - use brown image
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
            // Blue field - use blue image
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
            // Rightmost field (orange) - use tangerine image
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
            // Other fields - use red X (shouldn't happen with 5 fields)
            return (
              <CircularRedX key={`x-${index}`} centerPosition={field.position} />
            )
          }
        })}
        {fields.map((field, index) => (
          <WaveguideField
            key={index}
            position={field.position}
            colorPalette={field.colorPalette}
            isSelected={index === selectedIndex}
          />
        ))}
      </Canvas>
    </div>
  )
}
