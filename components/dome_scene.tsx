"use client"

import { useMemo, useRef, useState, useEffect, Suspense } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { BristleSpec } from "./bristleLayout"
import WaveguideField from "./waveguide_field"

interface DomeSceneProps {
  onExit: () => void
  bristles: BristleSpec[]
  colorPalette?: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
}

function CircularRedX({ centerPosition }: { centerPosition: THREE.Vector3 }) {
  const radius = 5.5
  const thickness = 0.15
  const segments = 128

  const createCurvedPath = (startAngle: number) => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = startAngle + Math.PI * 2 * t
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      points.push(new THREE.Vector3(x, 0, z))
    }
    return new THREE.CatmullRomCurve3(points)
  }

  const firstDiagonalPath = createCurvedPath(Math.PI * 0.25)
  const secondDiagonalPath = createCurvedPath(Math.PI * 0.75)

  return (
    <group position={centerPosition}>
      <mesh>
        <tubeGeometry args={[firstDiagonalPath, segments, thickness, 8, true]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh>
        <tubeGeometry args={[secondDiagonalPath, segments, thickness, 8, true]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
  )
}

function CircularImageOverlay({ centerPosition, imagePath }: { centerPosition: THREE.Vector3; imagePath: string }) {
  const radius = 15.4
  const height = 9.3
  const radialSegments = 64
  const heightSegments = 32
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(
      imagePath,
      (loadedTexture) => {
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

  const geometry = useMemo(() => {
    const geom = new THREE.CylinderGeometry(radius, radius, height, radialSegments, heightSegments, false)
    const positions = geom.attributes.position.array
    const indices = geom.index?.array || []
    const newIndices: number[] = []
    
    const halfHeight = height / 2
    const epsilon = 0.01
    
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3
      const i1 = indices[i + 1] * 3
      const i2 = indices[i + 2] * 3
      
      const y0 = positions[i0 + 1]
      const y1 = positions[i1 + 1]
      const y2 = positions[i2 + 1]
      
      const allOnTop = Math.abs(y0 - halfHeight) < epsilon && Math.abs(y1 - halfHeight) < epsilon && Math.abs(y2 - halfHeight) < epsilon
      const allOnBottom = Math.abs(y0 + halfHeight) < epsilon && Math.abs(y1 + halfHeight) < epsilon && Math.abs(y2 + halfHeight) < epsilon
      
      if (!allOnTop && !allOnBottom) {
        newIndices.push(indices[i], indices[i + 1], indices[i + 2])
      }
    }
    
    geom.setIndex(newIndices)
    geom.computeVertexNormals()
    return geom
  }, [radius, height, radialSegments, heightSegments])

  if (hasError || !texture) {
    return <CircularRedX centerPosition={centerPosition} />
  }

  // For 0-degree orientation - cylinder matches the field rotation
  return (
    <group position={centerPosition}>
      <mesh geometry={geometry} rotation={[0, 0, 0]}>
        <meshBasicMaterial map={texture} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function createBristleGeometry() {
  // Base cylinder of height 1; we'll scale it per bristle
  const radiusTop = 0.03
  const radiusBottom = 0.03
  const height = 1.5
  const radialSegments = 8
  const heightSegments = 1
  const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments)
  geom.translate(0, height / 2, 0)
  return geom
}

export default function DomeScene({ onExit, bristles, colorPalette }: DomeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bristleGroupRef = useRef<THREE.Group>(null)
  const centerBristleRef = useRef<THREE.Mesh>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(2) // Start at center field (index 2)
  const [cameraMode, setCameraMode] = useState<"rim" | "top" | "bottom">("rim")
  const { camera } = useThree()

  const N_BRISTLES = bristles.length

  const bristleGeometry = useMemo(() => createBristleGeometry(), [])

  // Film strip plane
  const stripGeometry = useMemo(
    () => new THREE.PlaneGeometry(0.18, 0.08),
    [],
  )

  const stripMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.05, 0.05, 0.12),
        side: THREE.DoubleSide,
      }),
    [],
  )

  // Default palette if none provided
  const defaultPalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.75, 0.55, 0.45), // color1 - peachy
    new THREE.Vector3(0.65, 0.5, 0.6),   // pink-lavender
    new THREE.Vector3(0.5, 0.45, 0.6),   // lavender
    new THREE.Vector3(0.35, 0.4, 0.55),  // blue-lavender
  ]

  // Convert Vector3 palette to Color palette for use in dome
  const palette = useMemo(
    () => {
      const sourcePalette = colorPalette || defaultPalette
      return sourcePalette.map(v => new THREE.Color(v.x, v.y, v.z))
    },
    [colorPalette],
  )

  // Color palettes for each waveguide field (matching page.tsx)
  const greenPalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.50, 0.65, 0.35), // Warm medium green
    new THREE.Vector3(0.45, 0.58, 0.32), // Warm olive-green
    new THREE.Vector3(0.40, 0.52, 0.30), // Rich warm green
    new THREE.Vector3(0.35, 0.48, 0.28), // Deep warm olive green
  ]

  const purplePalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.65, 0.55, 0.75), // Lighter purple-peach
    new THREE.Vector3(0.55, 0.50, 0.70), // Medium purple
    new THREE.Vector3(0.50, 0.45, 0.65), // Medium-dark purple
    new THREE.Vector3(0.42, 0.40, 0.66), // Base purple (#6A66A8)
  ]

  const bluePalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.60, 0.65, 0.75), // Medium periwinkle blue
    new THREE.Vector3(0.55, 0.60, 0.72), // Medium-dark periwinkle blue
    new THREE.Vector3(0.50, 0.55, 0.70), // Dark periwinkle blue
    new THREE.Vector3(0.45, 0.50, 0.68), // Darkest periwinkle blue
  ]

  const orangePalette: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(1.0, 0.65, 0.45), // Light coral/orange
    new THREE.Vector3(0.90, 0.55, 0.35), // Medium orange
    new THREE.Vector3(0.80, 0.45, 0.25), // Reddish orange
    new THREE.Vector3(0.70, 0.35, 0.20), // Dark reddish orange
  ]

  // Precompute global min/max for thickness & length so we can normalize
  const bristleMetrics = useMemo(() => {
    if (bristles.length === 0) {
      return {
        minThickness: 1,
        maxThickness: 1,
        minLength: 1,
        maxLength: 1,
      }
    }

    let minThickness = Infinity
    let maxThickness = -Infinity
    let minLength = Infinity
    let maxLength = -Infinity

    for (const b of bristles) {
      const thickness = b.scale[0]
      const length = b.scale[1]
      if (thickness < minThickness) minThickness = thickness
      if (thickness > maxThickness) maxThickness = thickness
      if (length < minLength) minLength = length
      if (length > maxLength) maxLength = length
    }

    // Avoid division by zero later
    if (minThickness === maxThickness) {
      minThickness = maxThickness - 0.0001
    }
    if (minLength === maxLength) {
      minLength = maxLength - 0.0001
    }

    return { minThickness, maxThickness, minLength, maxLength }
  }, [bristles])

  const R_rim = useMemo(() => {
    // Use approximate base width derived from thickness range
    const baseWidth = 0.12
    const spacingFactor = 1.2
    const circumference = N_BRISTLES * baseWidth * spacingFactor
    return circumference / (Math.PI * 2)
  }, [N_BRISTLES])

  const domeRadius = useMemo(() => R_rim * 1.05, [R_rim])
  const Y_RIM = useMemo(() => -domeRadius * 0.3, [domeRadius])

  // Waveguide field definitions - positions are calculated dynamically based on selection
  // The waveguide field has a max radius of about 4.5 units
  const waveguideFieldRadius = 4.5
  // Calculate the gap between outer rim and dome object
  const rimToDomeGap = useMemo(() => domeRadius - R_rim, [domeRadius, R_rim])
  // Spacing between fields: base spacing + 1.0 times the gap between rim and dome (0.5 + 0.5)
  const fieldSpacing = useMemo(() => domeRadius * 1.8 + rimToDomeGap * 1.0, [domeRadius, rimToDomeGap]) // Spacing between fields, outside dome
  const fields = useMemo(() => [
    { 
      colorPalette: greenPalette,
      index: 0,
      imagePath: "/images/time-up-green.png"
    },
    { 
      colorPalette: purplePalette,
      index: 1,
      imagePath: "/images/time-up-purple.png"
    },
    { 
      colorPalette: colorPalette || defaultPalette,
      index: 2,
      imagePath: "/images/time-up-brown.png"
    },
    { 
      colorPalette: bluePalette,
      index: 3,
      imagePath: "/images/time-up-blue.png"
    },
    { 
      colorPalette: orangePalette,
      index: 4,
      imagePath: "/images/time-up-tangerine.png"
    },
  ], [domeRadius, colorPalette, defaultPalette, greenPalette, purplePalette, bluePalette, orangePalette])

  // Compute dome color from palette - use color4 (the darkest color, like the bottom of waveguide gradient)
  // and darken it further for the dome background
  // Use the selected field's color palette to match the cylinder object
  const domeColor = useMemo(() => {
    const selectedField = fields[selectedFieldIndex]
    const sourcePalette = selectedField ? selectedField.colorPalette : (colorPalette || defaultPalette)
    // Use color4 (index 3) which is the darkest color in the palette, matching the bottom of the waveguide gradient
    const baseColor = new THREE.Color(sourcePalette[3].x, sourcePalette[3].y, sourcePalette[3].z)
    // Darken the color for the dome background while preserving the color theme
    return baseColor.multiplyScalar(0.25) // Darken but keep the color character
  }, [fields, selectedFieldIndex, colorPalette, defaultPalette])

  // Map shared bristles -> rim strips with derived scale + color
  const rimStrips = useMemo(
    () =>
      bristles.map((b, i) => {
        const theta = (i / N_BRISTLES) * Math.PI * 2
        const x = R_rim * Math.cos(theta)
        const z = R_rim * Math.sin(theta)
        const position = new THREE.Vector3(x, Y_RIM, z)

        // Direction from strip to center
        const dir = new THREE.Vector3(0, 0, 0).sub(position).normalize()
        // PlaneGeometry faces +Z by default, so rotate Y so +Z points along dir
        const rotationY = Math.atan2(dir.x, dir.z)

        // Normalize thickness & length from Waveguide
        const thickness = b.scale[0]
        const length = b.scale[1]
        const {
          minThickness,
          maxThickness,
          minLength,
          maxLength,
        } = bristleMetrics

        const tNorm = (thickness - minThickness) / (maxThickness - minThickness)
        const lNorm = (length - minLength) / (maxLength - minLength)

        // Map to dome scales (slightly compressed vs Waveguide)
        const thicknessScale = THREE.MathUtils.lerp(0.6, 1.4, tNorm)
        const lengthScale = THREE.MathUtils.lerp(0.7, 1.4, lNorm)

        // Color from angle along palette gradient
        const normalizedAngle = ((b.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const u = normalizedAngle / (Math.PI * 2) // 0–1
        const seg = u * (palette.length - 1)
        const idxA = Math.floor(seg)
        const idxB = Math.min(palette.length - 1, idxA + 1)
        const lerpT = seg - idxA

        const color = palette[idxA].clone().lerp(palette[idxB], lerpT)

        return {
          rimIndex: i,      // index on the rim
          sourceIndex: b.index, // original Waveguide index (for future syncing)
          theta,
          position,
          rotationY,
          thicknessScale,
          lengthScale,
          color,
        }
      }),
    [bristles, N_BRISTLES, R_rim, Y_RIM, bristleMetrics, palette],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExit()
      } else if (event.key === "ArrowLeft") {
        // Navigate to previous waveguide field
        setSelectedFieldIndex((prev) => Math.max(0, prev - 1))
      } else if (event.key === "ArrowRight") {
        // Navigate to next waveguide field
        setSelectedFieldIndex((prev) => Math.min(fields.length - 1, prev + 1))
      } else if (event.key === "ArrowUp") {
        // Move up through views: bottom -> rim -> top (stays at top)
        setCameraMode((prev) => {
          if (prev === "bottom") return "rim"
          if (prev === "rim") return "top"
          return "top" // Stay at top if already there
        })
      } else if (event.key === "ArrowDown") {
        // Move down through views: top -> rim -> bottom (stays at bottom)
        setCameraMode((prev) => {
          if (prev === "top") return "rim"
          if (prev === "rim") return "bottom"
          return "bottom" // Stay at bottom if already there
        })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onExit, fields.length])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02
    }

    const target = new THREE.Vector3(0, 0, 0)
    const radius = domeRadius * 2

    if (cameraMode === "rim") {
      camera.position.lerp(new THREE.Vector3(0, 0, radius), delta * 2)
    } else if (cameraMode === "top") {
      camera.position.lerp(new THREE.Vector3(0, radius, 0.001), delta * 2)
    } else if (cameraMode === "bottom") {
      camera.position.lerp(new THREE.Vector3(0, -radius, 0.001), delta * 2)
    }
    camera.lookAt(target)

    if (selectedIndex !== null && bristleGroupRef.current && centerBristleRef.current) {
      const stripGroup = bristleGroupRef.current.children[selectedIndex] as THREE.Group
      const bristleMesh = stripGroup.children.find(
        (child): child is THREE.Mesh =>
          child instanceof THREE.Mesh && child.geometry === bristleGeometry,
      )

      if (bristleMesh && centerBristleRef.current) {
        centerBristleRef.current.visible = true
        stripGroup.visible = false

        // Copy color from rim bristle
        const centerMat = centerBristleRef.current.material as THREE.MeshBasicMaterial
        const sourceMat = bristleMesh.material as THREE.MeshBasicMaterial
        if (centerMat && sourceMat && sourceMat.color) {
          centerMat.color.copy(sourceMat.color)
        }

        const pulse = 1 + Math.sin(t * 2) * 0.2
        centerBristleRef.current.scale.set(pulse, pulse, pulse)
      }
    } else if (centerBristleRef.current) {
      centerBristleRef.current.visible = false

      if (bristleGroupRef.current) {
        bristleGroupRef.current.children.forEach((child) => {
          child.visible = true
        })
      }
    }
  })

  const handleRimClick = () => {
    onExit()
  }

  const handleBristleClick = (rimIndex: number, event: any) => {
    event.stopPropagation()
    setSelectedIndex((prev) => (prev === rimIndex ? null : rimIndex))
  }

  return (
    <group ref={groupRef}>
      {/* Dome hemisphere */}
      <mesh position={[0, Y_RIM - domeRadius * 0.8, 0]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[domeRadius, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial
          color={domeColor}
          side={THREE.BackSide}
          wireframe={false}
        />
      </mesh>

      {/* Film-strip rim on lower-inner band */}
      <group ref={bristleGroupRef} onDoubleClick={handleRimClick}>
        {rimStrips.map((s) => (
          <group
            key={s.sourceIndex}
            position={s.position}
            rotation={[0, s.rotationY, 0]}
            onClick={(e) => handleBristleClick(s.rimIndex, e)}
          >
            {/* Strip plane */}
            <mesh geometry={stripGeometry} material={stripMaterial} />

            {/* Bristle centered on strip, with scale + color from BristleSpec */}
            <mesh
              geometry={bristleGeometry}
              position={[0, 0.05, 0]}
              scale={[s.thicknessScale, s.lengthScale, s.thicknessScale]}
            >
              <meshBasicMaterial color={s.color} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Calculate which fields to show based on selected field index */}
      {(() => {
        const centerField = fields[selectedFieldIndex]
        const leftField = selectedFieldIndex > 0 ? fields[selectedFieldIndex - 1] : null
        const rightField = selectedFieldIndex < fields.length - 1 ? fields[selectedFieldIndex + 1] : null

        return (
          <>
            {/* Waveguide Fields - Center field, vertical/upright orientation, 2x bigger */}
            {centerField && (
              <group position={[0, Y_RIM, 0]} scale={[2, 2, 2]}>
                <Suspense fallback={<CircularRedX centerPosition={new THREE.Vector3(0, 0, 0)} />}>
                  <CircularImageOverlay centerPosition={new THREE.Vector3(0, 0, 0)} imagePath={centerField.imagePath} />
                </Suspense>
                <WaveguideField
                  position={new THREE.Vector3(0, 0, 0)}
                  colorPalette={centerField.colorPalette}
                  isSelected={true}
                  bristles={bristles}
                  // No onDoubleClick - we're already in the dome scene
                />
              </group>
            )}

            {/* Left and right fields are hidden but functionality is maintained via field swapping */}
          </>
        )
      })()}

      {/* Center bristle (selected Nebula) */}
      <mesh
        ref={centerBristleRef}
        position={[0, 0, 0]}
        geometry={bristleGeometry}
        scale={[1, 1, 1]}
      >
        <meshBasicMaterial color={new THREE.Color(1.0, 0.9, 0.8)} />
      </mesh>
    </group>
  )
}
