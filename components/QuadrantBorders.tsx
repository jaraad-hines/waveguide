"use client"

import { useMemo } from "react"
import * as THREE from "three"

interface QuadrantBordersProps {
  y: number
  innerRadius: number
  outerRadius: number
  color?: THREE.ColorRepresentation
  opacity?: number
}

export default function QuadrantBorders({
  y,
  innerRadius,
  outerRadius,
  color = "#d86a4a",
  opacity = 0.9,
}: QuadrantBordersProps) {
  const curveSegments = 192
  const radialTubeRadius = 0.03
  const ringTubeRadius = 0.025
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]

  const innerCurve = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= curveSegments; i += 1) {
      const t = i / curveSegments
      const angle = t * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * innerRadius, y, Math.sin(angle) * innerRadius))
    }
    return new THREE.CatmullRomCurve3(points, true)
  }, [curveSegments, innerRadius, y])

  const outerCurve = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= curveSegments; i += 1) {
      const t = i / curveSegments
      const angle = t * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * outerRadius, y, Math.sin(angle) * outerRadius))
    }
    return new THREE.CatmullRomCurve3(points, true)
  }, [curveSegments, outerRadius, y])

  const radialCurves = useMemo(
    () =>
      angles.map((angle) => {
        const start = new THREE.Vector3(Math.cos(angle) * innerRadius, y, Math.sin(angle) * innerRadius)
        const end = new THREE.Vector3(Math.cos(angle) * outerRadius, y, Math.sin(angle) * outerRadius)
        return new THREE.LineCurve3(start, end)
      }),
    [angles, innerRadius, outerRadius, y]
  )

  return (
    <group>
      <mesh>
        <tubeGeometry args={[innerCurve, curveSegments, ringTubeRadius, 12, true]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh>
        <tubeGeometry args={[outerCurve, curveSegments, ringTubeRadius, 12, true]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {radialCurves.map((curve, index) => {
        const angle = angles[index]
        return (
          <group key={`quadrant-edge-${index}`}>
            <mesh>
              <tubeGeometry args={[curve, 1, radialTubeRadius, 10, false]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <mesh position={[Math.cos(angle) * outerRadius, y, Math.sin(angle) * outerRadius]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={Math.min(1, opacity + 0.05)} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
