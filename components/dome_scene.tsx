"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

interface DomeSceneProps {
  onExit: () => void
}

interface BristleData {
  index: number
  position: THREE.Vector3
}

const N_BRISTLES = 1280

function createBristleGeometry() {
  const radiusTop = 0.03
  const radiusBottom = 0.03
  const height = 0.6
  const radialSegments = 8
  const heightSegments = 1
  const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments)
  geom.translate(0, height / 2, 0)
  return geom
}

export default function DomeScene({ onExit }: DomeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bristleGroupRef = useRef<THREE.Group>(null)
  const centerBristleRef = useRef<THREE.Mesh>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [cameraMode, setCameraMode] = useState<"rim" | "top" | "bottom">("rim")
  const { camera } = useThree()

  const bristleGeometry = useMemo(() => createBristleGeometry(), [])
  const bristleMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.8, 0.8, 1.0),
      }),
    [],
  )

  const R_rim = useMemo(() => {
    const bristleWidth = 0.12
    const spacingFactor = 1.2
    const circumference = N_BRISTLES * bristleWidth * spacingFactor
    return circumference / (Math.PI * 2)
  }, [])

  const domeRadius = useMemo(() => R_rim * 1.05, [R_rim])

  const bristles = useMemo<BristleData[]>(() => {
    const arr: BristleData[] = []
    for (let i = 0; i < N_BRISTLES; i++) {
      const theta = (i / N_BRISTLES) * Math.PI * 2
      const x = R_rim * Math.cos(theta)
      const z = R_rim * Math.sin(theta)
      const pos = new THREE.Vector3(x, 0, z)
      arr.push({ index: i, position: pos })
    }
    return arr
  }, [R_rim])

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
  }, [onExit])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02
    }

    const target = new THREE.Vector3(0, 0, 0)
    if (cameraMode === "rim") {
      const radius = domeRadius * 2
      camera.position.lerp(new THREE.Vector3(0, 0, radius), delta * 2)
      camera.lookAt(target)
    } else if (cameraMode === "top") {
      const radius = domeRadius * 2
      camera.position.lerp(new THREE.Vector3(0, radius, 0.001), delta * 2)
      camera.lookAt(target)
    } else if (cameraMode === "bottom") {
      const radius = domeRadius * 2
      camera.position.lerp(new THREE.Vector3(0, -radius, 0.001), delta * 2)
      camera.lookAt(target)
    }

    if (selectedIndex !== null && bristleGroupRef.current && centerBristleRef.current) {
      const source = bristleGroupRef.current.children[selectedIndex] as THREE.Mesh
      centerBristleRef.current.visible = true
      source.visible = false
      centerBristleRef.current.material = source.material
      const pulse = 1 + Math.sin(t * 2) * 0.2
      centerBristleRef.current.scale.set(pulse, pulse, pulse)
    } else if (centerBristleRef.current) {
      centerBristleRef.current.visible = false
    }
  })

  const handleRimClick = () => {
    onExit()
  }

  const handleBristleClick = (index: number, event: any) => {
    event.stopPropagation()
    setSelectedIndex((prev) => (prev === index ? null : index))
  }

  return (
    <group ref={groupRef}>
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[domeRadius, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={new THREE.Color(0.05, 0.05, 0.1)} side={THREE.BackSide} wireframe={false} />
      </mesh>

      <group ref={bristleGroupRef} onDoubleClick={handleRimClick}>
        {bristles.map((b) => (
          <mesh
            key={b.index}
            geometry={bristleGeometry}
            material={bristleMaterial}
            position={b.position}
            onClick={(e) => handleBristleClick(b.index, e)}
          />
        ))}
      </group>

      <mesh ref={centerBristleRef} position={[0, 0, 0]} geometry={bristleGeometry} material={bristleMaterial}>
        <meshBasicMaterial color={new THREE.Color(1.0, 0.9, 0.8)} />
      </mesh>
    </group>
  )
}


