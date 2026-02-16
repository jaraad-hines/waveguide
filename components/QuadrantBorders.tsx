"use client"

import { useMemo } from "react"
import * as THREE from "three"

interface QuadrantBordersProps {
  y?: number
  innerRadius: number
  outerRadius: number
  domeRadius?: number
  domeCenterY?: number
  surfaceOffset?: number
  color?: THREE.ColorRepresentation
  opacity?: number
}

export default function QuadrantBorders({
  y,
  innerRadius,
  outerRadius,
  domeRadius,
  domeCenterY,
  surfaceOffset = 0.02,
  color = "#d86a4a",
  opacity = 0.9,
}: QuadrantBordersProps) {
  const curveSegments = 192
  const radialTubeRadius = 0.03
  const ringTubeRadius = 0.025
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
  const isDomeMode =
    typeof domeRadius === "number" &&
    domeRadius > 0 &&
    typeof domeCenterY === "number"

  const projectToDomeSurface = (angle: number, radialDistance: number) => {
    const R = Math.max(0.0001, domeRadius ?? 1)
    const r = THREE.MathUtils.clamp(radialDistance, 0, R * 0.9995)
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    const yOnSphere = (domeCenterY ?? 0) + Math.sqrt(Math.max(0, R * R - r * r))

    // Lift slightly along surface normal so tubes do not z-fight the dome.
    const normal = new THREE.Vector3(x, yOnSphere - (domeCenterY ?? 0), z).normalize()
    return new THREE.Vector3(x, yOnSphere, z).add(normal.multiplyScalar(surfaceOffset))
  }

  const innerCurve = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= curveSegments; i += 1) {
      const t = i / curveSegments
      const angle = t * Math.PI * 2
      if (isDomeMode) {
        points.push(projectToDomeSurface(angle, innerRadius))
      } else {
        points.push(new THREE.Vector3(Math.cos(angle) * innerRadius, y ?? 0, Math.sin(angle) * innerRadius))
      }
    }
    return new THREE.CatmullRomCurve3(points, true)
  }, [curveSegments, innerRadius, y, isDomeMode, domeRadius, domeCenterY, surfaceOffset])

  const outerCurve = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= curveSegments; i += 1) {
      const t = i / curveSegments
      const angle = t * Math.PI * 2
      if (isDomeMode) {
        points.push(projectToDomeSurface(angle, outerRadius))
      } else {
        points.push(new THREE.Vector3(Math.cos(angle) * outerRadius, y ?? 0, Math.sin(angle) * outerRadius))
      }
    }
    return new THREE.CatmullRomCurve3(points, true)
  }, [curveSegments, outerRadius, y, isDomeMode, domeRadius, domeCenterY, surfaceOffset])

  const radialCurves = useMemo(
    () =>
      angles.map((angle) => {
        if (!isDomeMode) {
          const start = new THREE.Vector3(Math.cos(angle) * innerRadius, y ?? 0, Math.sin(angle) * innerRadius)
          const end = new THREE.Vector3(Math.cos(angle) * outerRadius, y ?? 0, Math.sin(angle) * outerRadius)
          return new THREE.LineCurve3(start, end)
        }

        const radialSamples = 48
        const points: THREE.Vector3[] = []
        for (let i = 0; i <= radialSamples; i += 1) {
          const t = i / radialSamples
          const radiusAtSample = innerRadius + (outerRadius - innerRadius) * t
          points.push(projectToDomeSurface(angle, radiusAtSample))
        }
        return new THREE.CatmullRomCurve3(points)
      }),
    [angles, innerRadius, outerRadius, y, isDomeMode, domeRadius, domeCenterY, surfaceOffset]
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
        const outerVertex = isDomeMode
          ? projectToDomeSurface(angle, outerRadius)
          : new THREE.Vector3(Math.cos(angle) * outerRadius, y ?? 0, Math.sin(angle) * outerRadius)
        return (
          <group key={`quadrant-edge-${index}`}>
            <mesh>
              <tubeGeometry args={[curve, isDomeMode ? 48 : 1, radialTubeRadius, 10, false]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <mesh position={outerVertex}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={Math.min(1, opacity + 0.05)} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
