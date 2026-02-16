"use client"

import { useMemo, useRef, useState, useEffect, Suspense, type CSSProperties } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import { Menu, Grid2X2, Gauge, Link2 } from "lucide-react"
import { BristleSpec } from "./bristleLayout"
import WaveguideField from "./waveguide_field"
import WindowPlayer from "./WindowPlayer"
import PlasticityLinkPanel from "./PlasticityLinkPanel"
import QuadrantBorders from "./QuadrantBorders"
import { TaggingService } from "../services/taggingService"
import { TaggedContent, WindowPlayer as WindowPlayerType } from "../types/tensol"
import { TensorService } from "../services/tensorService"
import { TensorContent } from "../types/tensor"
import { extractMusicMetadata, validateMusicFile } from "../services/musicFileUtils"
import { extractPlaylistId } from "../services/youtubeApi"

// Grip mode types
export type GripMode = "orbit_scan" | "meridian_dive" | "helical_descent" | "event_lensing" | "tensol_jump"

interface GripModeConfig {
  name: string
  shortName: string
  weights: { topic: number; novelty: number; habit: number; goal: number }
}

const GRIP_MODES: Record<GripMode, GripModeConfig> = {
  orbit_scan: {
    name: "Orbit Scan",
    shortName: "Orbit",
    weights: { topic: 0.20, novelty: 0.45, habit: 0.15, goal: 0.20 },
  },
  meridian_dive: {
    name: "Meridian Dive",
    shortName: "Dive",
    weights: { topic: 0.55, novelty: 0.08, habit: 0.10, goal: 0.27 },
  },
  helical_descent: {
    name: "Helical Descent",
    shortName: "Helix",
    weights: { topic: 0.40, novelty: 0.20, habit: 0.10, goal: 0.30 },
  },
  event_lensing: {
    name: "Event Lensing",
    shortName: "Lens",
    weights: { topic: 0.30, novelty: 0.10, habit: 0.30, goal: 0.30 },
  },
  tensol_jump: {
    name: "Tensol Quadrant Jump",
    shortName: "Jump",
    weights: { topic: 0.10, novelty: 0.65, habit: 0.05, goal: 0.20 },
  },
}

const GRIP_MODE_ORDER: GripMode[] = ["orbit_scan", "meridian_dive", "helical_descent", "event_lensing", "tensol_jump"]
const PLAYLIST_URL = "https://youtube.com/playlist?list=PLEyw_05gE1Q-8ZLM7Jkb45ynL8F9Xv1tB&si=gEq8TbEcHM-3SK12"
const PLAYLIST_LIST_ID = extractPlaylistId(PLAYLIST_URL) ?? ""
const PLAYLIST_VISIBLE_COUNT = 4
const PLAYLIST_MAX_INDEX = 200
const QUADRANT_OUTER_RADIUS_FACTOR = 0.995
const QUADRANT_INNER_CLEARANCE = 1

interface DomeSceneProps {
  onExit: () => void
  bristles: BristleSpec[]
  colorPalette?: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  // Expose tensor service methods via ref (optional)
  tensorServiceRef?: React.MutableRefObject<TensorService | null>
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

function buildDonutSectorClipPath({
  startDeg,
  endDeg,
  innerRadiusPct,
  outerRadiusPct,
  gapDeg = 0.8,
  arcSteps = 18,
}: {
  startDeg: number
  endDeg: number
  innerRadiusPct: number
  outerRadiusPct: number
  gapDeg?: number
  arcSteps?: number
}) {
  const points: Array<{ x: number; y: number }> = []

  const normalizedEnd = endDeg <= startDeg ? endDeg + 360 : endDeg
  const start = startDeg + gapDeg * 0.5
  const end = normalizedEnd - gapDeg * 0.5

  const toPoint = (deg: number, radiusPct: number) => {
    const rad = (deg * Math.PI) / 180
    return {
      x: 50 + Math.cos(rad) * radiusPct,
      y: 50 + Math.sin(rad) * radiusPct,
    }
  }

  for (let i = 0; i <= arcSteps; i += 1) {
    const t = i / arcSteps
    const deg = start + (end - start) * t
    points.push(toPoint(deg, outerRadiusPct))
  }

  for (let i = arcSteps; i >= 0; i -= 1) {
    const t = i / arcSteps
    const deg = start + (end - start) * t
    points.push(toPoint(deg, innerRadiusPct))
  }

  return `polygon(${points.map((p) => `${p.x.toFixed(3)}% ${p.y.toFixed(3)}%`).join(", ")})`
}

// Mode Ring HUD Component
function ModeRingHUD({
  activeMode,
  modes,
  domeRadius,
  verticalDirection,
}: {
  activeMode: GripMode
  modes: GripMode[]
  domeRadius: number
  verticalDirection: 1 | -1
}) {
  const activeIndex = modes.indexOf(activeMode)
  
  return (
    <Html position={[0, domeRadius * 0.6 * verticalDirection, 0]} center>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {/* Mode name */}
        <div
          style={{
            color: "rgba(255, 255, 255, 0.9)",
            fontSize: "14px",
            fontWeight: "500",
            textShadow: "0 0 8px rgba(255, 255, 255, 0.5)",
          }}
        >
          {GRIP_MODES[activeMode].name}
        </div>
        
        {/* Ring indicator */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}
        >
          {modes.map((mode, index) => (
            <div
              key={mode}
              style={{
                width: index === activeIndex ? "12px" : "8px",
                height: index === activeIndex ? "12px" : "8px",
                borderRadius: "50%",
                backgroundColor: index === activeIndex 
                  ? "rgba(255, 255, 255, 0.9)" 
                  : "rgba(255, 255, 255, 0.3)",
                border: index === activeIndex 
                  ? "2px solid rgba(255, 255, 255, 1)" 
                  : "1px solid rgba(255, 255, 255, 0.5)",
                boxShadow: index === activeIndex 
                  ? "0 0 12px rgba(255, 255, 255, 0.6)" 
                  : "none",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>
    </Html>
  )
}

// Conflict/Facet Meter HUD Component
function ConflictMeterHUD({
  conflict,
  facets,
  domeRadius,
  verticalDirection,
}: {
  conflict: number
  facets: number
  domeRadius: number
  verticalDirection: 1 | -1
}) {
  // conflict: 0-1 (0.9-0.98 typical range from sim)
  // facets: 1-4 (number of walker disagreements)
  
  const normalizedConflict = Math.max(0, Math.min(1, (conflict - 0.9) / 0.08)) // Map 0.9-0.98 to 0-1
  
  return (
    <Html position={[domeRadius * 0.7, domeRadius * 0.6 * verticalDirection, 0]}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "4px",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "11px",
            fontWeight: "400",
          }}
        >
          Conflict: {(conflict * 100).toFixed(1)}%
        </div>
        <div
          style={{
            width: "60px",
            height: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${normalizedConflict * 100}%`,
              height: "100%",
              backgroundColor: `rgba(${255 * normalizedConflict}, ${255 * (1 - normalizedConflict)}, 0, 0.8)`,
              transition: "all 0.3s ease",
            }}
          />
        </div>
        <div
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "11px",
            fontWeight: "400",
            marginTop: "4px",
          }}
        >
          Facets: {facets}
        </div>
        <div
          style={{
            display: "flex",
            gap: "3px",
            marginTop: "2px",
          }}
        >
          {[1, 2, 3, 4].map((f) => (
            <div
              key={f}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "2px",
                backgroundColor: f <= facets 
                  ? "rgba(255, 255, 255, 0.8)" 
                  : "rgba(255, 255, 255, 0.2)",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>
    </Html>
  )
}

function SceneToolbar({
  isOpen,
  setIsOpen,
  showQuadrantViewport,
  setShowQuadrantViewport,
  showConflictMeter,
  setShowConflictMeter,
  showPlasticity,
  setShowPlasticity,
}: {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  showQuadrantViewport: boolean
  setShowQuadrantViewport: (show: boolean) => void
  showConflictMeter: boolean
  setShowConflictMeter: (show: boolean) => void
  showPlasticity: boolean
  setShowPlasticity: (show: boolean) => void
}) {
  const toggleButtonStyle = (active: boolean): CSSProperties => ({
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    border: active ? "1px solid rgba(125, 180, 255, 0.95)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(72, 114, 171, 0.72)" : "rgba(20,22,28,0.82)",
    color: "rgba(245,245,245,0.96)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  })

  return (
    <Html
      fullscreen
      style={{
        pointerEvents: "none",
        position: "absolute",
        inset: 0,
      }}
    >
      <div
        style={{
          position: "fixed",
          right: "-580px",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "flex-end",
          pointerEvents: "auto",
          userSelect: "none",
          zIndex: 1200,
        }}
      >
        {isOpen && (
          <div
            style={{
              padding: "8px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(9, 11, 16, 0.88)",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <button
              type="button"
              title="Quadrant Viewport"
              onClick={() => setShowQuadrantViewport(!showQuadrantViewport)}
              style={toggleButtonStyle(showQuadrantViewport)}
            >
              <Grid2X2 size={18} />
            </button>
            <button
              type="button"
              title="Conflict / Facets"
              onClick={() => setShowConflictMeter(!showConflictMeter)}
              style={toggleButtonStyle(showConflictMeter)}
            >
              <Gauge size={18} />
            </button>
            <button
              type="button"
              title="Plasticity"
              onClick={() => setShowPlasticity(!showPlasticity)}
              style={toggleButtonStyle(showPlasticity)}
            >
              <Link2 size={18} />
            </button>
          </div>
        )}
        <button
          type="button"
          title={isOpen ? "Close Toolbar" : "Open Toolbar"}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(11, 13, 20, 0.95)",
            color: "rgba(245,245,245,0.96)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          }}
        >
          <Menu size={20} />
        </button>
      </div>
    </Html>
  )
}

export default function DomeScene({ onExit, bristles, colorPalette, tensorServiceRef: externalTensorServiceRef }: DomeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bristleGroupRef = useRef<THREE.Group>(null)
  const centerBristleRef = useRef<THREE.Mesh>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(2) // Start at center field (index 2)
  const [cameraMode, setCameraMode] = useState<"rim" | "top" | "bottom">("bottom")
  const [quadrantOrientation, setQuadrantOrientation] = useState<"top" | "bottom">("bottom")
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const [showQuadrantViewport, setShowQuadrantViewport] = useState(false)
  const [showConflictMeter, setShowConflictMeter] = useState(false)
  const [showPlasticityPanel, setShowPlasticityPanel] = useState(false)
  const [playlistMode, setPlaylistMode] = useState<"fifo" | "lifo">("fifo")
  const [playlistWindowStart, setPlaylistWindowStart] = useState(0)
  
  // Grip mode state
  const [gripMode, setGripMode] = useState<GripMode>("orbit_scan")
  const [conflict, setConflict] = useState(0.935) // Default conflict value (from sim)
  const [facets, setFacets] = useState(2) // Default facets (1-4)
  
  // Camera operator state for grip modes (will be initialized after domeRadius is computed)
  const orbitAngleRef = useRef(0)
  const orbitRadiusRef = useRef(25) // Default view distance for Orbit Scan (will be updated when domeRadius is available)
  const meridianAngleRef = useRef(0)
  const meridianDepthRef = useRef(0.5) // 0 = center, 1 = rim
  const helixAngleRef = useRef(0)
  const helixDepthRef = useRef(0.5)
  const helixHeightRef = useRef(0)
  const lensActiveRef = useRef(false)
  const lensRadiusRef = useRef(2.0)
  const jumpTargetRef = useRef<THREE.Vector3 | null>(null)
  const jumpProgressRef = useRef(0)
  
  const { camera, size } = useThree()
  const [quadrantViewportMetrics, setQuadrantViewportMetrics] = useState({
    diameterPx: 620,
    innerRadiusPct: 26,
  })

  const handlePlaylistStepForward = () => {
    setPlaylistWindowStart((prev) => Math.min(prev + 1, PLAYLIST_MAX_INDEX - PLAYLIST_VISIBLE_COUNT))
  }

  const handlePlaylistStepBackward = () => {
    setPlaylistWindowStart((prev) => Math.max(prev - 1, 0))
  }

  // Tagging system state
  const taggingServiceRef = useRef<TaggingService>(new TaggingService())
  const [taggedContents, setTaggedContents] = useState<TaggedContent[]>([])
  const [windowPlayers, setWindowPlayers] = useState<Map<string, WindowPlayerType>>(new Map())

  // Tensor system state (for music files in tensols)
  const tensorServiceRef = useRef<TensorService>(new TensorService())
  const [tensorContents, setTensorContents] = useState<TensorContent[]>([])

  // Sync tagging service state with React state
  useEffect(() => {
    const updateTaggedContents = () => {
      setTaggedContents(taggingServiceRef.current.getAllTaggedContents())
    }
    updateTaggedContents()
  }, [])

  // Expose tagging service methods (can be called from parent or via props)
  const tagContent = (content: Omit<TaggedContent, 'bristleIndex' | 'taggedAt' | 'order'>) => {
    const tagged = taggingServiceRef.current.tagContent(content)
    setTaggedContents(taggingServiceRef.current.getAllTaggedContents())
    return tagged
  }

  const importYouTubePlaylist = async (playlistUrl: string, apiKey?: string) => {
    const { importYouTubePlaylistToDome } = await import('../utils/youtubeImport')
    const tagged = await importYouTubePlaylistToDome(playlistUrl, taggingServiceRef.current, apiKey)
    setTaggedContents(taggingServiceRef.current.getAllTaggedContents())
    return tagged
  }

  // Tensor service methods (for music files)
  const tagMusicFile = async (file: File, tensolIndex?: number) => {
    // Validate file
    const validation = validateMusicFile(file)
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid music file')
    }

    // Extract metadata
    const metadata = await extractMusicMetadata(file)
    
    // Tag to tensor service
    const tensorContent = tensorServiceRef.current.tagMusicFile(file, tensolIndex, metadata)
    setTensorContents(tensorServiceRef.current.getAllContents())
    return tensorContent
  }

  const batchTagMusicFiles = async (files: File[], tensolIndex?: number) => {
    const results: TensorContent[] = []
    for (const file of files) {
      try {
        const validation = validateMusicFile(file)
        if (!validation.valid) {
          console.warn(`Skipping invalid file: ${file.name} - ${validation.error}`)
          continue
        }
        const metadata = await extractMusicMetadata(file)
        const tensorContent = tensorServiceRef.current.tagMusicFile(file, tensolIndex, metadata)
        results.push(tensorContent)
      } catch (error) {
        console.error(`Error tagging file ${file.name}:`, error)
      }
    }
    setTensorContents(tensorServiceRef.current.getAllContents())
    return results
  }

  const untagMusicFile = (contentId: string) => {
    const success = tensorServiceRef.current.untagMusicFile(contentId)
    if (success) {
      setTensorContents(tensorServiceRef.current.getAllContents())
    }
    return success
  }

  // Sync tensor contents state
  useEffect(() => {
    const updateTensorContents = () => {
      setTensorContents(tensorServiceRef.current.getAllContents())
    }
    updateTensorContents()
  }, [])

  // Expose tensor service to parent component via ref
  useEffect(() => {
    if (externalTensorServiceRef) {
      externalTensorServiceRef.current = tensorServiceRef.current
    }
  }, [externalTensorServiceRef])

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

  // Center waveguide is rendered at scale [2,2,2], so derive true outer radius from actual bristle geometry.
  const baleenOuterRadius = useMemo(() => {
    if (bristles.length === 0) return 9
    let maxRenderedRadius = 0

    // Shader displaces local X/Z up to about sqrt(0.05^2 + 0.03^2); include scaled safety.
    const shaderDisplacementPadding = 0.12

    for (const bristle of bristles) {
      const [cx, cy, cz] = bristle.circularPosition
      const thickness = bristle.scale[0]
      const halfLength = bristle.scale[1] * 0.5
      const rotation = new THREE.Euler(bristle.rotation[0], bristle.rotation[1], bristle.rotation[2])

      // Sample top/bottom rings of the cylinder to capture tilt-driven radial overshoot.
      for (const y of [-halfLength, halfLength]) {
        for (let i = 0; i < 8; i += 1) {
          const theta = (i / 8) * Math.PI * 2
          const local = new THREE.Vector3(Math.cos(theta) * thickness, y, Math.sin(theta) * thickness)
          local.applyEuler(rotation)
          const worldX = cx + local.x
          const worldZ = cz + local.z
          const radial = Math.hypot(worldX, worldZ)
          if (radial > maxRenderedRadius) {
            maxRenderedRadius = radial
          }
        }
      }
    }

    return maxRenderedRadius * 2 + shaderDisplacementPadding
  }, [bristles])
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

  // Initialize orbit radius when domeRadius is available
  useEffect(() => {
    // Set default view distance for Orbit Scan (full centered view)
    orbitRadiusRef.current = domeRadius * 2.5
  }, [domeRadius])

  // Mouse and scroll controls for grip modes
  useEffect(() => {
    let isDragging = false
    let lastMouseX = 0
    let lastMouseY = 0

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left mouse button
        isDragging = true
        lastMouseX = e.clientX
        lastMouseY = e.clientY
        
        // Event Lensing: activate on hold
        if (gripMode === "event_lensing") {
          lensActiveRef.current = true
        }
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = false
        
        // Event Lensing: deactivate on release
        if (gripMode === "event_lensing") {
          lensActiveRef.current = false
        }
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.clientX - lastMouseX
      const deltaY = e.clientY - lastMouseY
      const sensitivity = 0.01

      if (gripMode === "orbit_scan") {
        // Orbit Scan: drag can adjust view (optional, for future enhancement)
        // Currently using full centered view, so no orbit adjustment needed
      } else if (gripMode === "meridian_dive") {
        // Meridian Dive: drag adjusts meridian angle
        meridianAngleRef.current += deltaX * sensitivity
      } else if (gripMode === "helical_descent") {
        // Helical Descent: drag adjusts helix angle
        helixAngleRef.current += deltaX * sensitivity
      }

      lastMouseX = e.clientX
      lastMouseY = e.clientY
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY * 0.001

      if (gripMode === "orbit_scan") {
        // Orbit Scan: scroll adjusts zoom (view distance)
        orbitRadiusRef.current = Math.max(domeRadius * 1.8, Math.min(domeRadius * 4, orbitRadiusRef.current - delta * 5))
      } else if (gripMode === "meridian_dive") {
        // Meridian Dive: scroll adjusts depth (0 = center, 1 = rim)
        meridianDepthRef.current = Math.max(0, Math.min(1, meridianDepthRef.current + delta))
      } else if (gripMode === "helical_descent") {
        // Helical Descent: scroll advances the helix
        helixDepthRef.current = Math.max(0, Math.min(1, helixDepthRef.current + delta * 0.5))
      } else if (gripMode === "event_lensing") {
        // Event Lensing: scroll changes lens radius
        lensRadiusRef.current = Math.max(1.0, Math.min(5.0, lensRadiusRef.current + delta * 2))
      }
    }

    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("wheel", handleWheel)
    }
  }, [gripMode, domeRadius])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't capture typing if user is in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === "Escape") {
        onExit()
      } else if (event.key === "ArrowLeft") {
        // Cycle to previous grip mode
        setGripMode((prev) => {
          const currentIndex = GRIP_MODE_ORDER.indexOf(prev)
          const newIndex = currentIndex > 0 ? currentIndex - 1 : GRIP_MODE_ORDER.length - 1
          return GRIP_MODE_ORDER[newIndex]
        })
      } else if (event.key === "ArrowRight") {
        // Cycle to next grip mode
        setGripMode((prev) => {
          const currentIndex = GRIP_MODE_ORDER.indexOf(prev)
          const newIndex = (currentIndex + 1) % GRIP_MODE_ORDER.length
          return GRIP_MODE_ORDER[newIndex]
        })
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
      } else if (event.key >= "1" && event.key <= "5") {
        // Number keys 1-5 control waveguide field/color selection
        const fieldIndex = parseInt(event.key) - 1
        if (fieldIndex >= 0 && fieldIndex < fields.length) {
          setSelectedFieldIndex(fieldIndex)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onExit, fields.length, fields])

  // Quadrant viewport orientation only updates at the extreme camera positions.
  // `rim` keeps the last extreme orientation instead of flipping mid-transition.
  useEffect(() => {
    if (cameraMode === "top") {
      setQuadrantOrientation("top")
    } else if (cameraMode === "bottom") {
      setQuadrantOrientation("bottom")
    }
  }, [cameraMode])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    if (groupRef.current) {
      // Consistent rotation speed for all modes (Event Lensing style)
      const rotationSpeed = 0.01
      groupRef.current.rotation.y += delta * rotationSpeed
    }

    const target = new THREE.Vector3(0, 0, 0)
    const baseRadius = domeRadius * 2

    // Base camera position from cameraMode (Up/Down view switching)
    let basePosition: THREE.Vector3
    if (cameraMode === "rim") {
      basePosition = new THREE.Vector3(0, 0, baseRadius)
    } else if (cameraMode === "top") {
      basePosition = new THREE.Vector3(0, baseRadius, 0.001)
    } else {
      basePosition = new THREE.Vector3(0, -baseRadius, 0.001)
    }

    // Apply grip mode camera operators
    // All modes now use Event Lensing camera behavior as default (basePosition from cameraMode)
    let finalPosition = basePosition.clone()

    // Event Lensing style: local zoom bubble (subtle position adjustment when active)
    // This behavior is now applied to all modes
    const lensOffset = (gripMode === "event_lensing" && lensActiveRef.current) ? 1.5 : 0
    finalPosition = basePosition.clone().add(
      new THREE.Vector3(0, 0, -lensOffset)
    )

    // Smoothly lerp camera to final position
    camera.position.lerp(finalPosition, delta * 2)
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

    // Derive viewport sizing from projected inner/outer quadrant radii.
    // Middle camera mode should stay on low/bottom viewport profile.
    const effectiveViewportMode: "top" | "bottom" = cameraMode === "rim" ? "bottom" : cameraMode
    const projectionCamera =
      effectiveViewportMode === cameraMode
        ? camera
        : new THREE.PerspectiveCamera(
            camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
            camera instanceof THREE.PerspectiveCamera ? camera.aspect : size.width / Math.max(1, size.height),
            camera.near,
            camera.far
          )

    if (projectionCamera !== camera) {
      projectionCamera.position.set(
        0,
        effectiveViewportMode === "top" ? domeRadius * 2 : -domeRadius * 2,
        0.001
      )
      projectionCamera.lookAt(0, 0, 0)
      projectionCamera.updateProjectionMatrix()
      projectionCamera.updateMatrixWorld(true)
    }

    const planeY = Y_RIM + 0.02
    const centerWorld = new THREE.Vector3(0, planeY, 0)
    const outerWorld = new THREE.Vector3(quadrantSectionOuterRadius, planeY, 0)
    const innerWorld = new THREE.Vector3(quadrantSectionInnerRadius, planeY, 0)

    const toScreen = (point: THREE.Vector3) => {
      const projected = point.clone().project(projectionCamera)
      return {
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
      }
    }

    const c = toScreen(centerWorld)
    const o = toScreen(outerWorld)
    const i = toScreen(innerWorld)
    const domeEdge = toScreen(new THREE.Vector3(domeRadius * 0.98, planeY, 0))

    const outerPx = Math.max(1, Math.hypot(o.x - c.x, o.y - c.y))
    const innerPx = Math.max(0, Math.hypot(i.x - c.x, i.y - c.y))
    const domePx = Math.max(1, Math.hypot(domeEdge.x - c.x, domeEdge.y - c.y))

    const nextDiameter = Math.max(260, Math.min(domePx * 2, size.width * 0.86, outerPx * 2))
    const nextInnerPct = Math.max(0, Math.min(49.5, (innerPx / outerPx) * 50))

    if (
      Math.abs(nextDiameter - quadrantViewportMetrics.diameterPx) > 0.75 ||
      Math.abs(nextInnerPct - quadrantViewportMetrics.innerRadiusPct) > 0.25
    ) {
      setQuadrantViewportMetrics({
        diameterPx: nextDiameter,
        innerRadiusPct: nextInnerPct,
      })
    }
  })

  const handleRimClick = () => {
    onExit()
  }

  const handleBristleClick = (rimIndex: number, event: any) => {
    event.stopPropagation()
    setSelectedIndex((prev) => (prev === rimIndex ? null : rimIndex))
    
    // Check if this bristle has tagged content
    const content = taggingServiceRef.current.getContentByBristle(rimIndex)
    if (content) {
      openWindowPlayer(content)
    }
  }

  const openWindowPlayer = (content: TaggedContent) => {
    // Calculate position for window player (in front of the bristle)
    const rimStrip = rimStrips.find(s => s.rimIndex === content.bristleIndex)
    if (!rimStrip) return

    const position: [number, number, number] = [
      rimStrip.position.x * 1.5,
      rimStrip.position.y + 2,
      rimStrip.position.z * 1.5,
    ]

    const player: WindowPlayerType = {
      id: `player-${content.id}`,
      contentId: content.id,
      position,
      size: [400, 300],
      isVisible: true,
      apiEndpoint: content.apiEndpoint || content.url || '',
      contentType: content.contentType === 'other' ? 'api' : content.contentType,
    }

    setWindowPlayers(prev => new Map(prev).set(player.id, player))
  }

  const closeWindowPlayer = (playerId: string) => {
    setWindowPlayers(prev => {
      const next = new Map(prev)
      next.delete(playerId)
      return next
    })
  }

  const basePlaylistIndices = useMemo(
    () => Array.from({ length: PLAYLIST_VISIBLE_COUNT }, (_, index) => playlistWindowStart + index),
    [playlistWindowStart]
  )

  const visiblePlaylistIndices = useMemo(
    () => (playlistMode === "fifo" ? basePlaylistIndices : [...basePlaylistIndices].reverse()),
    [playlistMode, basePlaylistIndices]
  )

  const quadrantOuterRadius = useMemo(() => domeRadius * QUADRANT_OUTER_RADIUS_FACTOR, [domeRadius])
  const quadrantInnerRadius = useMemo(
    () => Math.min(baleenOuterRadius + QUADRANT_INNER_CLEARANCE, quadrantOuterRadius - 0.05),
    [baleenOuterRadius, quadrantOuterRadius]
  )
  // Expanded quadrant section edges for dome-scale partitioning.
  // These become the single source of truth for both edges and viewport shaping.
  const quadrantSectionOuterRadius = useMemo(
    () => Math.min(domeRadius * QUADRANT_OUTER_RADIUS_FACTOR, domeRadius * 0.98),
    [domeRadius]
  )
  const quadrantSectionInnerRadius = useMemo(
    () => Math.max(domeRadius * 0.11, quadrantInnerRadius * 0.38),
    [domeRadius, quadrantInnerRadius]
  )
  const quadrantSectors = useMemo(() => {
    const gapDeg = 0.9
    // Middle camera mode should stay on low/bottom sector orientation/mapping.
    const effectiveQuadrantOrientation = cameraMode === "rim" ? "bottom" : quadrantOrientation
    const indexOffset = effectiveQuadrantOrientation === "top" ? 2 : 0
    const innerRadiusPct = quadrantViewportMetrics.innerRadiusPct
    const outerRadiusPct = 50
    const base = [
      // These angular boundaries match the 4 radial edge lines in QuadrantBorders.
      { id: "quadrant-ne", startDeg: -90, endDeg: 0, slot: 0 },
      { id: "quadrant-nw", startDeg: -180, endDeg: -90, slot: 1 },
      { id: "quadrant-sw", startDeg: 90, endDeg: 180, slot: 2 },
      { id: "quadrant-se", startDeg: 0, endDeg: 90, slot: 3 },
    ]

    return base.map((sector) => {
      const rotatedStart = sector.startDeg + (effectiveQuadrantOrientation === "top" ? 180 : 0)
      const rotatedEnd = sector.endDeg + (effectiveQuadrantOrientation === "top" ? 180 : 0)
      return {
        ...sector,
        clipPath: buildDonutSectorClipPath({
          startDeg: rotatedStart,
          endDeg: rotatedEnd,
          innerRadiusPct,
          outerRadiusPct,
          gapDeg,
        }),
        playlistIndex: visiblePlaylistIndices[(sector.slot + indexOffset) % 4] ?? sector.slot,
      }
    })
  }, [visiblePlaylistIndices, quadrantOrientation, quadrantViewportMetrics.innerRadiusPct, cameraMode])
  const verticalDirection: 1 | -1 = cameraMode === "top" ? 1 : -1
  const isRimMiddleView = cameraMode === "rim"

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

      {/* Inner/outer borders and quadrant edge lines */}
      <QuadrantBorders
        y={Y_RIM + 0.02}
        innerRadius={quadrantSectionInnerRadius}
        outerRadius={quadrantSectionOuterRadius}
        color={new THREE.Color(0.85, 0.38, 0.26)}
        opacity={0.92}
      />

      {showQuadrantViewport && (
        <>
          {/* Quadrant object as a 4-part viewport (absorbs per-quadrant viewport behavior) */}
          <Html
            position={[0, Y_RIM + 0.02, 0]}
            center
            occlude={false}
            style={{ pointerEvents: "auto" }}
          >
            <div
              style={{
                position: "relative",
                width: `${quadrantViewportMetrics.diameterPx}px`,
                height: `${quadrantViewportMetrics.diameterPx}px`,
                borderRadius: "50%",
                overflow: "hidden",
                transform: isRimMiddleView
                  ? "perspective(1600px) rotateX(78deg) scale(1.28, 0.4) translateY(-46%)"
                  : "none",
                transformOrigin: "center center",
              }}
            >
              {quadrantSectors.map((sector) => {
                const embedSrc = PLAYLIST_LIST_ID
                  ? `https://www.youtube.com/embed/videoseries?list=${PLAYLIST_LIST_ID}&index=${sector.playlistIndex}`
                  : ""

                return (
                  <div
                    key={sector.id}
                    style={{
                      position: "absolute",
                      inset: 0,
                      clipPath: sector.clipPath,
                      border: "1px solid rgba(219, 138, 103, 0.85)",
                      background: "rgba(8, 8, 10, 0.75)",
                      boxShadow: "0 0 14px rgba(219, 138, 103, 0.2)",
                      overflow: "hidden",
                    }}
                  >
                    {embedSrc ? (
                      <iframe
                        width={quadrantViewportMetrics.diameterPx}
                        height={quadrantViewportMetrics.diameterPx}
                        src={embedSrc}
                        title={`Quadrant video ${sector.playlistIndex + 1}`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ border: "none" }}
                      />
                    ) : (
                      <div
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          fontSize: "12px",
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          padding: "12px",
                        }}
                      >
                        Playlist ID not found in URL.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Html>
        </>
      )}

      {/* Window players */}
      {Array.from(windowPlayers.values()).map((player) => {
        const content = taggedContents.find(c => c.id === player.contentId)
        if (!content) return null

        // Map 'other' to 'api' for WindowPlayer compatibility
        const contentType = content.contentType === 'other' ? 'api' : content.contentType

        return (
          <WindowPlayer
            key={player.id}
            position={player.position}
            content={{
              id: content.id,
              title: content.title,
              url: content.url,
              thumbnail: content.thumbnail,
              contentType: contentType as 'youtube' | 'browser' | 'api',
              apiEndpoint: content.apiEndpoint,
            }}
            isVisible={player.isVisible}
            onClose={() => closeWindowPlayer(player.id)}
            size={player.size}
          />
        )
      })}

      {/* Grip Mode HUD - Mode Ring */}
      <ModeRingHUD
        activeMode={gripMode}
        modes={GRIP_MODE_ORDER}
        domeRadius={domeRadius}
        verticalDirection={verticalDirection}
      />

      {/* Grip Mode HUD - Conflict/Facet Meter */}
      {showConflictMeter && (
        <ConflictMeterHUD
          conflict={conflict}
          facets={facets}
          domeRadius={domeRadius}
          verticalDirection={verticalDirection}
        />
      )}

      {/* Plasticity Link Panel - Script Runner */}
      {showPlasticityPanel && (
        <PlasticityLinkPanel
          domeRadius={domeRadius}
          verticalDirection={verticalDirection}
          playlistControls={{
            mode: playlistMode,
            onModeChange: setPlaylistMode,
            onStepForward: handlePlaylistStepForward,
            onStepBackward: handlePlaylistStepBackward,
            visibleIndices: visiblePlaylistIndices,
            playlistId: PLAYLIST_LIST_ID,
          }}
        />
      )}

      <SceneToolbar
        isOpen={isToolbarOpen}
        setIsOpen={setIsToolbarOpen}
        showQuadrantViewport={showQuadrantViewport}
        setShowQuadrantViewport={setShowQuadrantViewport}
        showConflictMeter={showConflictMeter}
        setShowConflictMeter={setShowConflictMeter}
        showPlasticity={showPlasticityPanel}
        setShowPlasticity={setShowPlasticityPanel}
      />

      {/* Visual feedback: Grip mode indicators */}
      {gripMode === "event_lensing" && lensActiveRef.current && (
        <mesh position={[0, Y_RIM, 0]}>
          <sphereGeometry args={[lensRadiusRef.current, 32, 32]} />
          <meshBasicMaterial
            color={new THREE.Color(1, 1, 0.8)}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}
