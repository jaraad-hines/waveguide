"use client"

import { useRef, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { BristleSpec } from "./bristleLayout"

const WAVEGUIDE_BRISTLE_NEGATIVE_HORIZONTAL_ROT_Z = Math.PI * 0.5

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    
    // Subtle wave motion
    vec3 pos = position;
    pos.x += sin(position.y * 2.0 + uTime * 0.5) * 0.05;
    pos.z += cos(position.y * 1.5 + uTime * 0.3) * 0.03;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uIndex;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  
  void main() {
    // Vertical gradient along the beam length
    float gradientMix = vUv.y;
    vec3 color = mix(uColor4, uColor1, gradientMix);
    
    // Add some variation per beam
    float variation = sin(uIndex * 0.5 + uTime * 0.2) * 0.5 + 0.5;
    color = mix(color, uColor2, variation * 0.3);
    
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float rimLight = 1.0 - abs(dot(viewDirection, vNormal));
    rimLight = pow(rimLight, 2.0); // Increased power for softer rim (was 1.5)
    
    float circumferentialGlow = abs(sin(vUv.x * 3.14159));
    circumferentialGlow = pow(circumferentialGlow, 1.2); // Softer glow (was 0.8)
    
    float lighting = mix(0.5, 0.9, circumferentialGlow) * (0.7 + rimLight * 0.3);
    
    float pulse = sin(uTime * 0.5 + uIndex * 0.3) * 0.1 + 0.9; // Reduced variation (was 0.15 + 0.85)
    float intensity = lighting * pulse;
    
    // Add some noise/texture
    float noise = fract(sin(dot(vUv * 10.0, vec2(12.9898, 78.233))) * 43758.5453);
    intensity *= (0.9 + noise * 0.1);
    
    gl_FragColor = vec4(color * intensity, intensity * 0.4);
  }
`

interface WaveguideFieldProps {
  position?: THREE.Vector3
  colorPalette?: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  isSelected?: boolean
  concaveDownFactor?: number
  onDoubleClick?: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  bristles: BristleSpec[]
}

export default function WaveguideField({ 
  position = new THREE.Vector3(0, 0, 0),
  colorPalette,
  isSelected = true,
  concaveDownFactor = 0,
  onDoubleClick,
  onPointerEnter,
  onPointerLeave,
  bristles
}: WaveguideFieldProps) {
  const groupRef = useRef<THREE.Group>(null)
  const transitionProgress = useRef(0)
  
  // Default color palette (current default colors)
  const defaultColors: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = useMemo(() => [
    new THREE.Vector3(0.75, 0.55, 0.45), // color1 - peachy
    new THREE.Vector3(0.65, 0.50, 0.60), // color2 - pink-lavender
    new THREE.Vector3(0.50, 0.45, 0.60), // color3 - lavender
    new THREE.Vector3(0.35, 0.40, 0.55), // color4 - blue-lavender
  ], [])
  
  const colors = colorPalette || defaultColors

  const beams = bristles

  const handleDoubleClick = () => {
    // Call the parent's onDoubleClick callback to trigger inside view
    if (onDoubleClick) {
      onDoubleClick()
    }
  }

  useFrame((state, delta) => {
    // Apply position to group
    if (groupRef.current) {
      groupRef.current.position.copy(position)
    }

    // Keep transition progress at 0 (circular view only)
    transitionProgress.current = 0

    if (isSelected) {
      // NO rotation for selected field - wave animation will be applied instead
    } else {
      // Continuous circular rotation for non-selected fields
      if (groupRef.current) {
        groupRef.current.rotation.y += delta * 0.1
      }
    }
  })

  return (
    <>
      {isSelected && (
        <>
          <ambientLight intensity={0.1} />
          <pointLight position={[position.x, position.y + 5, position.z + 5]} intensity={0.3} color="#ffd4c8" />
          <pointLight position={[position.x, position.y - 3, position.z - 5]} intensity={0.2} color="#b8a8d0" />
        </>
      )}
      <group 
        ref={groupRef} 
        onDoubleClick={isSelected ? handleDoubleClick : undefined}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {beams.map((beam, idx) => (
          <AnimatedBeam 
            key={idx} 
            beam={beam} 
            transitionProgress={transitionProgress.current}
            colors={colors}
            isSelected={isSelected}
            concaveDownFactor={concaveDownFactor}
          />
        ))}
        <BeamAnimator />
      </group>
    </>
  )
}

function AnimatedBeam({ 
  beam, 
  transitionProgress,
  colors,
  isSelected,
  concaveDownFactor
}: { 
  beam: BristleSpec
  transitionProgress: number
  colors: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  isSelected: boolean
  concaveDownFactor: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      
      // Apply wave animation only when selected
      let rotationAngle = 0
      if (isSelected) {
        const normalizedAngle = ((beam.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const cycleDuration = 12.0
        const cycleTime = time % cycleDuration
        const startAngle = Math.PI * 0.75 + Math.PI * 0.25
        const animationProgress = cycleTime / cycleDuration
        const currentAnimationAngle = (startAngle + animationProgress * Math.PI * 2) % (Math.PI * 2)

        let bristleAngle = normalizedAngle
        let animAngle = currentAnimationAngle

        if (startAngle + animationProgress * Math.PI * 2 > Math.PI * 2) {
          if (bristleAngle < startAngle && bristleAngle < Math.PI) {
            bristleAngle += Math.PI * 2
          }
          animAngle = startAngle + animationProgress * Math.PI * 2
        }

        let shouldAnimate = false
        if (animAngle >= startAngle) {
          if (bristleAngle >= startAngle && bristleAngle <= animAngle) {
            shouldAnimate = true
          }
        }

        if (shouldAnimate) {
          const angleDiff = bristleAngle - startAngle
          const triggerProgress = angleDiff / (Math.PI * 2)
          const triggerTime = triggerProgress * cycleDuration
          const timeSinceTrigger = cycleTime - triggerTime
          const easeDuration = 1.5 // Last 1.5 seconds of cycle will ease out
          const timeUntilRestart = cycleDuration - cycleTime
          let speedMultiplier = 1.0
          
          if (timeUntilRestart < easeDuration) {
            // Ease out cubic: smooth deceleration
            const easeProgress = timeUntilRestart / easeDuration
            speedMultiplier = easeProgress * easeProgress * easeProgress
          }
          
          const rotationSpeed = 0.5 * speedMultiplier
          rotationAngle = timeSinceTrigger * Math.PI * 2 * rotationSpeed
        }
      }

      const pos = new THREE.Vector3().lerpVectors(
        new THREE.Vector3(...beam.circularPosition),
        new THREE.Vector3(...beam.flatPosition),
        transitionProgress,
      )
      if (concaveDownFactor > 0) {
        const radialSq = pos.x * pos.x + pos.z * pos.z
        pos.y -= radialSq * concaveDownFactor
      }
      meshRef.current.position.copy(pos)

      // Apply wave rotation when selected, otherwise use base rotation
      const baseRotation = new THREE.Euler(...beam.rotation)
      const swingRotation = new THREE.Euler(baseRotation.x, baseRotation.y + rotationAngle, baseRotation.z)
      const flatRotation = new THREE.Euler(...beam.flatRotation)
      
      const finalRotation = new THREE.Euler(
        THREE.MathUtils.lerp(swingRotation.x, flatRotation.x, transitionProgress),
        THREE.MathUtils.lerp(swingRotation.y, flatRotation.y, transitionProgress),
        THREE.MathUtils.lerp(swingRotation.z, flatRotation.z, transitionProgress) +
          WAVEGUIDE_BRISTLE_NEGATIVE_HORIZONTAL_ROT_Z,
      )
      meshRef.current.rotation.copy(finalRotation)
    }
  })

  return (
    <mesh ref={meshRef} scale={beam.scale}>
      <cylinderGeometry args={[1, 1, 1, 16, 8]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uIndex: { value: beam.index },
          uColor1: { value: colors[0] },
          uColor2: { value: colors[1] },
          uColor3: { value: colors[2] },
          uColor4: { value: colors[3] },
        }}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function BeamAnimator() {
  useFrame((state) => {
    state.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
        child.material.uniforms.uTime.value = state.clock.elapsedTime
      }
    })
  })

  return null
}
