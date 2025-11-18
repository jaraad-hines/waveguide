"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { BristleSpec } from "./bristleLayout"

interface DomeSceneProps {
  onExit: () => void
  bristles: BristleSpec[]
}

function createBristleGeometry() {
  // Base cylinder of height 1; we'll scale it per bristle
  const radiusTop = 0.03
  const radiusBottom = 0.03
  const height = 1
  const radialSegments = 8
  const heightSegments = 1
  const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments)
  geom.translate(0, height / 2, 0)
  return geom
}

export default function DomeScene({ onExit, bristles }: DomeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bristleGroupRef = useRef<THREE.Group>(null)
  const centerBristleRef = useRef<THREE.Mesh>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
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

  // Palette echoing the Waveguide field (peachy → lavender → blue)
  const palette = useMemo(
    () => [
      new THREE.Color(0.75, 0.55, 0.45), // color1 - peachy
      new THREE.Color(0.65, 0.5, 0.6),   // pink-lavender
      new THREE.Color(0.5, 0.45, 0.6),   // lavender
      new THREE.Color(0.35, 0.4, 0.55),  // blue-lavender
    ],
    [],
  )

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
        setSelectedIndex((prev) => {
          if (prev === null) return 0
          return (prev - 1 + N_BRISTLES) % N_BRISTLES
        })
      } else if (event.key === "ArrowRight") {
        setSelectedIndex((prev) => {
          if (prev === null) return 0
          return (prev + 1) % N_BRISTLES
        })
      } else if (event.key === "ArrowUp") {
        setCameraMode("top")
      } else if (event.key === "ArrowDown") {
        setCameraMode("bottom")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onExit, N_BRISTLES])

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
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[domeRadius, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial
          color={new THREE.Color(0.05, 0.05, 0.1)}
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
