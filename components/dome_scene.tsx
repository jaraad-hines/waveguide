"use client"

import { memo, useMemo, useRef, useState, useEffect, useCallback, Suspense, type CSSProperties } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html, Text } from "@react-three/drei"
import * as THREE from "three"
import { Menu, Grid2X2, Gauge, Link2, FileText } from "lucide-react"
import { BristleSpec, buildBristleMeta, canonTheta } from "./bristleLayout"
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
import {
  computeRotaryEncoderFrame,
  createRotaryFrameStore,
  ROTARY_ARCHITECTURE_TEMPLATE_LIBRARY,
  simulateRotaryArchitecture,
  type RotaryArchitectureSimulation,
  type RotaryArchitectureSimulationId,
} from "../utils/rotaryEncoder"

function isPerfDiagEnabled() {
  if (typeof window === "undefined") return false
  return (window as any).__WG_PERF_DIAG === true || window.localStorage.getItem("__WG_PERF_DIAG") === "1"
}

function sameArchitectureSummary(a: ArchitectureSummary, b: ArchitectureSummary) {
  return (
    a.bandHigh === b.bandHigh &&
    a.bandMedium === b.bandMedium &&
    a.bandLow === b.bandLow &&
    a.dominantPort === b.dominantPort &&
    a.spillActive === b.spillActive &&
    a.policyOverride === b.policyOverride &&
    Math.abs(a.confidence - b.confidence) < 0.015
  )
}

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
const SUBSTRATE_RING_LEVELS = [0.28, 0.48, 0.72]
const CYLINDER_RING_TARGET_COUNT = 32
const FPS_THETA_BAND_COUNT = 32
const MINI_OBJECT_COUNT = 6
const PLASTIC_THETA_BINS = 256
const PLASTIC_R_BINS = 8
const BRISTLES_PER_QUADRANT = 4
const TWO_PI = Math.PI * 2
const PROJECTOR_LAYOUT_VERTICAL_GAIN_RIG = 0.9
const PROJECTOR_LAYOUT_VERTICAL_GAIN_PROJECTION = 0.28
const DOME_CAP_ZERO_Y = 0
const DOME_RIM_OVERFILL_SCALE = 1.3 // +2% circumference in X/Z (1.42 * 1.02)
const RIM_RING_PLANE_OFFSET_FACTOR = 1.6
const RIM_RING_INVERT_X = Math.PI
const TOOLBAR_HUD_VIEW_X = 0.86
const TOOLBAR_HUD_VIEW_Y = -0.92
const TOOLBAR_HUD_DISTANCE = 1.9
const TOOLBAR_HUD_SCALE = 1.12
const MODE_SWITCHER_BOTTOM_PX = 24
const MINI_OBJECT_LAYER_Y_LIFT = -4
const ENABLE_SCENE_IDLE_SPIN = false
const CAMERA_LERP_GAIN = 2
const CAMERA_SNAP_EPS = 0.0006
const SALIENCE_UI_COMMIT_INTERVAL_SEC = 0.75
const LOG_STORAGE_ACTIVE_SESSION_KEY = "plasticity_active_session_id"
const LOG_STORAGE_PREFIX = "plasticity_logs_"
const LOG_PERSIST_INTERVAL_SEC = 1
const LOG_API_FLUSH_INTERVAL_SEC = 3

type HandPoint2D = [number, number]
type LayoutPoint3D = [number, number, number]
type ProjectorLayoutProfileId = "circular" | "hand" | "stacked_sculpture"
type LayoutSlice = {
  yNorm: number
  outline: HandPoint2D[]
}
type LayoutProfile = {
  id: ProjectorLayoutProfileId
  ports?: LayoutPoint3D[]
  slices?: LayoutSlice[]
}

const HAND_PORT_LAYOUT_6: LayoutPoint3D[] = [
  [-0.92, 0.05, -0.14], // thumb
  [-0.44, 0.25, 0.54],  // index
  [0.0, 0.32, 0.78],    // middle
  [0.38, 0.2, 0.62],    // ring
  [0.72, 0.12, 0.34],   // pinky
  [0.02, -0.28, -0.64], // palm/wrist anchor
]

const HAND_OUTLINE: HandPoint2D[] = [
  [-0.72, -0.74],
  [-1.0, -0.28],
  [-0.92, 0.08],
  [-0.64, 0.44],
  [-0.42, 0.8],
  [-0.08, 1.0],
  [0.2, 0.9],
  [0.48, 0.72],
  [0.76, 0.48],
  [0.92, 0.18],
  [0.84, -0.24],
  [0.54, -0.62],
  [0.2, -0.84],
  [-0.2, -0.88],
]

function toCircularXZ(index: number, count: number): HandPoint2D {
  const angle = (index / Math.max(1, count)) * TWO_PI
  return [Math.cos(angle), Math.sin(angle)]
}

function sampleClosedOutline(points: HandPoint2D[], t: number): HandPoint2D {
  if (points.length === 0) return [0, 0]
  if (points.length === 1) return points[0]
  const segments: number[] = []
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    segments.push(len)
    total += len
  }
  const target = ((t % 1) + 1) % 1 * total
  let acc = 0
  for (let i = 0; i < points.length; i += 1) {
    const segLen = segments[i]
    const next = acc + segLen
    if (target <= next || i === points.length - 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const local = segLen > 1e-9 ? (target - acc) / segLen : 0
      return [THREE.MathUtils.lerp(a[0], b[0], local), THREE.MathUtils.lerp(a[1], b[1], local)]
    }
    acc = next
  }
  return points[0]
}

const PROJECTOR_LAYOUT_PROFILES: Record<LayoutProfile["id"], LayoutProfile> = {
  circular: {
    id: "circular",
  },
  hand: {
    id: "hand",
    ports: HAND_PORT_LAYOUT_6,
    slices: [{ yNorm: 0, outline: HAND_OUTLINE }],
  },
  // Example volumetric sculpt built from multiple XZ slices.
  stacked_sculpture: {
    id: "stacked_sculpture",
    slices: [
      {
        yNorm: -0.28,
        outline: [
          [-0.9, -0.45], [-0.32, -0.92], [0.32, -0.92], [0.9, -0.45],
          [0.98, 0.18], [0.48, 0.84], [-0.48, 0.84], [-0.98, 0.18],
        ],
      },
      {
        yNorm: 0.0,
        outline: [
          [-0.72, -0.38], [-0.18, -0.66], [0.24, -0.62], [0.68, -0.28],
          [0.74, 0.26], [0.2, 0.64], [-0.36, 0.58], [-0.74, 0.2],
        ],
      },
      {
        yNorm: 0.26,
        outline: [
          [-0.5, -0.18], [-0.12, -0.42], [0.24, -0.34], [0.46, -0.06],
          [0.42, 0.3], [0.08, 0.48], [-0.28, 0.42], [-0.48, 0.12],
        ],
      },
    ],
  },
}

function sampleProjectorPortPoint(index: number, count: number, profileId: ProjectorLayoutProfileId): LayoutPoint3D {
  const profile = PROJECTOR_LAYOUT_PROFILES[profileId] ?? PROJECTOR_LAYOUT_PROFILES.circular
  if (profile.ports && profile.ports.length === count) {
    return profile.ports[index] ?? [0, 0, 0]
  }
  const [x, z] = toCircularXZ(index, count)
  return [x, 0, z]
}

function sampleProjectorOutlinePoint(index: number, count: number, profileId: ProjectorLayoutProfileId): LayoutPoint3D {
  const profile = PROJECTOR_LAYOUT_PROFILES[profileId] ?? PROJECTOR_LAYOUT_PROFILES.circular
  const slices = profile.slices ?? []
  if (slices.length > 0) {
    if (slices.length === 1) {
      const [x, z] = sampleClosedOutline(slices[0].outline, index / Math.max(1, count))
      return [x, slices[0].yNorm, z]
    }
    const u = index / Math.max(1, count)
    const sliceFloat = u * slices.length
    const sliceIndex = Math.floor(sliceFloat) % slices.length
    const localT = sliceFloat - Math.floor(sliceFloat)
    const slice = slices[sliceIndex]
    const [x, z] = sampleClosedOutline(slice.outline, localT)
    return [x, slice.yNorm, z]
  }
  const [x, z] = toCircularXZ(index, count)
  return [x, 0, z]
}

type FpsMiniObjConfig = {
  bgHoverDeposit: number
  bgHoverThrottleMs: number
  bgHoverRepeatGuardMs: number
  bgHoverR: number
  bgClickDeposit: number
  bgClickR: number
  bandHoverDeposit: number
  bandHoverThrottleMs: number
  bandClickDeposit: number
  bandR: number
}

const FPS_MINI_OBJ_CONFIG: FpsMiniObjConfig = {
  bgHoverDeposit: 0.06,
  bgHoverThrottleMs: 120,
  bgHoverRepeatGuardMs: 220,
  bgHoverR: 1.0,
  bgClickDeposit: 0.5,
  bgClickR: 1.0,
  bandHoverDeposit: 0.09,
  bandHoverThrottleMs: 80,
  bandClickDeposit: 0.9,
  bandR: 0.88,
}

type SceneRegime = "orbit" | "dock"
type SceneId = "A_waveguide" | "B_grid"
type InteractionType = "enter" | "leave" | "click" | "doubleClick" | "dwell" | "fixation"
type HitTarget = "bristle" | "quadrant" | "surfaceCell" | "background" | "cylinderTarget" | "thetaBand"

type InteractionEventLog = {
  t: number
  sessionId: string
  sceneId: SceneId
  mode: GripMode
  type: InteractionType
  hitTarget: HitTarget
  bristleId: number
  quadrantId: number
  theta: number
  r: number
  weight: number
  dwellMs?: number
}

type PlasticDepositLog = {
  t: number
  sessionId: string
  sceneId: SceneId
  mode: GripMode
  bristleId: number
  quadrantId: number
  gridCoord: { rBin: number; thetaBin: number }
  weight: number
  kernel: "K3" | "K5"
}

type FieldStateLog = {
  t: number
  sessionId: string
  sceneId: SceneId
  mode: GripMode
  focus: {
    bristleId?: number
    quadrantId?: number
    theta?: number
    r?: number
  }
  field: {
    lambda: number
    alpha: number
    kTheta: number
    kRad: number
    energyTotal: number
    energyPeak: number
    entropy: number
  }
}

type QuadrantSummaryLog = {
  t: number
  sessionId: string
  sceneId: SceneId
  quadrantId: number
  bristleIds: [number, number, number, number]
  activity: {
    hits: number
    dwellTotalMs: number
    depositTotal: number
  }
  plasticity: {
    energy: number
    peak: number
  }
}

type SceneTransitionLog = {
  t: number
  sessionId: string
  type: "scene_enter" | "scene_exit"
  from: SceneId
  to: SceneId
  bristleId?: number
  quadrantId?: number
}

type ThetaBandSummaryLog = {
  t: number
  sessionId: string
  sceneId: SceneId
  mode: GripMode
  bandCount: number
  high: number
  medium: number
  low: number
  band_count_high: number
  band_count_medium: number
  band_count_low: number
  squad_count_high: number
  squad_count_medium: number
  squad_count_low: number
  miniObjSalience: number[]
}

type PlasticLogEntry =
  | InteractionEventLog
  | PlasticDepositLog
  | FieldStateLog
  | SceneTransitionLog
  | QuadrantSummaryLog
  | ThetaBandSummaryLog

type QuadrantSubstrateTarget = {
  quadrantId: number
  thetaRange: [number, number]
  thetaCenter: number
  substrateIndex: number
  substrateRNorm: number
  meshTag: string
  worldPosition: THREE.Vector3
  worldQuaternion: THREE.Quaternion
}

type QuadrantInterstitialTarget = {
  leftQuadrantId: number
  rightQuadrantId: number
  thetaCenter: number
  meshTag: string
  worldPosition: THREE.Vector3
  worldQuaternion: THREE.Quaternion
}

type SalienceLevel = "low" | "medium" | "high"

type ThetaBandSnapshot = {
  bandIndex: number
  thetaStart: number
  thetaEnd: number
  thetaCenter: number
  score: number
  level: SalienceLevel
  miniObjId: number
  quadrantId: number
  squadId: number
  anchorBristleId: number
}

type SquadSalienceSnapshot = {
  squadId: number
  score: number
  level: SalienceLevel
  miniObjId: number
  anchorBristleId: number
}

const KERNEL_3X3 = [
  [0.05, 0.1, 0.05],
  [0.1, 0.4, 0.1],
  [0.05, 0.1, 0.05],
]

function normAngle(angle: number) {
  return canonTheta(angle)
}

function thetaToBin(theta: number) {
  const normalized = normAngle(theta)
  return Math.max(0, Math.min(PLASTIC_THETA_BINS - 1, Math.floor((normalized / TWO_PI) * PLASTIC_THETA_BINS)))
}

function rToBin(r: number) {
  const clamped = Math.max(0, Math.min(1, r))
  return Math.max(0, Math.min(PLASTIC_R_BINS - 1, Math.floor(clamped * (PLASTIC_R_BINS - 1))))
}

function blurTheta(src: Float32Array, dst: Float32Array) {
  for (let r = 0; r < PLASTIC_R_BINS; r += 1) {
    const row = r * PLASTIC_THETA_BINS
    for (let t = 0; t < PLASTIC_THETA_BINS; t += 1) {
      const tL = (t - 1 + PLASTIC_THETA_BINS) % PLASTIC_THETA_BINS
      const tR = (t + 1) % PLASTIC_THETA_BINS
      dst[row + t] = 0.25 * src[row + tL] + 0.5 * src[row + t] + 0.25 * src[row + tR]
    }
  }
}

function blurRadial(src: Float32Array, dst: Float32Array) {
  for (let r = 0; r < PLASTIC_R_BINS; r += 1) {
    const rU = Math.max(0, r - 1)
    const rD = Math.min(PLASTIC_R_BINS - 1, r + 1)
    for (let t = 0; t < PLASTIC_THETA_BINS; t += 1) {
      dst[r * PLASTIC_THETA_BINS + t] =
        0.25 * src[rU * PLASTIC_THETA_BINS + t] +
        0.5 * src[r * PLASTIC_THETA_BINS + t] +
        0.25 * src[rD * PLASTIC_THETA_BINS + t]
    }
  }
}

function getModeDiffusion(gripMode: GripMode) {
  if (gripMode === "orbit_scan") return { alpha: 0.15, kTheta: 0.9, kRad: 0.1 }
  if (gripMode === "meridian_dive") return { alpha: 0.15, kTheta: 0.2, kRad: 0.8 }
  if (gripMode === "helical_descent") return { alpha: 0.15, kTheta: 0.5, kRad: 0.5 }
  if (gripMode === "tensol_jump") return { alpha: 0.05, kTheta: 0.4, kRad: 0.6 }
  return { alpha: 0.12, kTheta: 0.85, kRad: 0.15 }
}

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

function thetaFromPoint(x: number, z: number) {
  return normAngle(Math.atan2(z, x))
}

function salienceToSubstrateIndex(score: number) {
  if (score >= 0.66) return 2
  if (score >= 0.33) return 1
  return 0
}

function normalizeMetric(values: number[]) {
  if (values.length === 0) return []
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-9) {
    return values.map(() => 0)
  }
  const range = max - min
  return values.map((value) => (value - min) / range)
}

function classifyPercentiles(scores: number[]) {
  const levels: SalienceLevel[] = Array.from({ length: scores.length }, () => "low")
  const n = scores.length
  if (n === 0) return { levels, counts: { high: 0, medium: 0, low: 0 } }

  const highCountTarget = Math.ceil(n * 0.15)
  const mediumCountTarget = Math.ceil(n * 0.25)
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))

  for (let i = 0; i < ranked.length; i += 1) {
    const { index } = ranked[i]
    if (i < highCountTarget) {
      levels[index] = "high"
    } else if (i < highCountTarget + mediumCountTarget) {
      levels[index] = "medium"
    } else {
      levels[index] = "low"
    }
  }

  return {
    levels,
    counts: {
      high: highCountTarget,
      medium: Math.min(mediumCountTarget, Math.max(0, n - highCountTarget)),
      low: Math.max(0, n - highCountTarget - mediumCountTarget),
    },
  }
}

type MutableRef<T> = { current: T }

type CylinderRigProps = {
  imagePath: string
  yOffset: number
  rotatorYOffset: number
  rigScale: number
  tetherRadius: number
  tetherGap: number
  ringTargetCount: number
  thetaBandSnapshotsRef: MutableRef<ThetaBandSnapshot[]>
  miniObjSalienceRef: MutableRef<number[]>
  activeBandIndexRef: MutableRef<number | null>
  onRingTargetEnterRef: MutableRef<(bandIndex: number, event: any) => void>
  onRingTargetClickRef: MutableRef<(bandIndex: number, event: any) => void>
  onRingTargetLeaveRef: MutableRef<(bandIndex: number, event: any) => void>
  projectorLayoutProfile: ProjectorLayoutProfileId
}

function CylinderRig({
  imagePath,
  yOffset,
  rotatorYOffset,
  rigScale,
  tetherRadius,
  tetherGap,
  ringTargetCount,
  thetaBandSnapshotsRef,
  miniObjSalienceRef,
  activeBandIndexRef,
  onRingTargetEnterRef,
  onRingTargetClickRef,
  onRingTargetLeaveRef,
  projectorLayoutProfile,
}: CylinderRigProps) {
  const rotatorRef = useRef<THREE.Group>(null)
  const coreMeshRefs = useRef<Array<THREE.Mesh | null>>([])
  const coreMaterialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const glowMaterialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const tetherPositions = useMemo(
    () =>
      Array.from({ length: MINI_OBJECT_COUNT }, (_, index) => {
        const [xNorm, yNorm, zNorm] = sampleProjectorPortPoint(index, MINI_OBJECT_COUNT, projectorLayoutProfile)
        return [
          xNorm * tetherRadius,
          yOffset + tetherGap * 0.5 + yNorm * tetherGap * PROJECTOR_LAYOUT_VERTICAL_GAIN_RIG,
          zNorm * tetherRadius,
        ] as [number, number, number]
      }),
    [tetherRadius, yOffset, tetherGap, projectorLayoutProfile]
  )
  const ringTargetPositions = useMemo(
    () =>
      Array.from({ length: ringTargetCount }, (_, index) => {
        const [xNorm, yNorm, zNorm] = sampleProjectorOutlinePoint(index, ringTargetCount, projectorLayoutProfile)
        return [xNorm * tetherRadius, yNorm * tetherGap * PROJECTOR_LAYOUT_VERTICAL_GAIN_RIG, zNorm * tetherRadius] as [number, number, number]
      }),
    [ringTargetCount, tetherRadius, tetherGap, projectorLayoutProfile]
  )

  useFrame((_, delta) => {
    if (rotatorRef.current) {
      // Keep target surface static (no continuous azimuth spin).
      rotatorRef.current.rotation.y = 0
    }
    const snapshots = thetaBandSnapshotsRef.current
    const salience = miniObjSalienceRef.current
    const activeBandIndex = activeBandIndexRef.current
    for (let index = 0; index < ringTargetCount; index += 1) {
      const snapshot = snapshots[index]
      const miniObjId = snapshot?.miniObjId ?? (index % MINI_OBJECT_COUNT)
      const salienceValue = salience[miniObjId] ?? (1 / MINI_OBJECT_COUNT)
      const highlight = snapshot?.level === "high"
      const isActive = activeBandIndex === index
      const coreMaterial = coreMaterialRefs.current[index]
      if (coreMaterial) {
        coreMaterial.color.setRGB(highlight ? 1.0 : 0.95, highlight ? 0.48 : 0.9, highlight ? 0.32 : 0.86)
        coreMaterial.opacity = highlight ? 0.95 : 0.76
      }
      const coreMesh = coreMeshRefs.current[index]
      if (coreMesh) {
        const gain = highlight ? 1.35 : 1
        coreMesh.scale.set(gain, gain, gain)
      }
      const glowMaterial = glowMaterialRefs.current[index]
      if (glowMaterial) {
        glowMaterial.color.setRGB(isActive ? 1.0 : 0.98, isActive ? 0.45 : 0.92, isActive ? 0.26 : 0.86)
        glowMaterial.opacity = 0.1 + salienceValue * 0.45 + (isActive ? 0.28 : 0)
      }
    }
  })

  return (
    <group>
      <group position={[0, yOffset, 0]} scale={[rigScale, rigScale, rigScale]}>
        <Suspense fallback={<CircularRedX centerPosition={new THREE.Vector3(0, 0, 0)} />}>
          <CircularImageOverlay centerPosition={new THREE.Vector3(0, 0, 0)} imagePath={imagePath} />
        </Suspense>
      </group>

      {tetherPositions.map((position, index) => {
        return (
          <mesh key={`cyl-rig-tether-${index}`} position={position}>
            <cylinderGeometry args={[0.08, 0.08, tetherGap, 10]} />
            <meshBasicMaterial
              color={new THREE.Color(0.88, 0.83, 0.78)}
              transparent
              opacity={0.38}
            />
          </mesh>
        )
      })}

      <group ref={rotatorRef} position={[0, rotatorYOffset, 0]}>
        <mesh rotation={[Math.PI * 0.5, 0, 0]}>
          <torusGeometry args={[tetherRadius, 0.16, 12, 96]} />
          <meshBasicMaterial
            color={new THREE.Color(0.9, 0.88, 0.86)}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[tetherRadius * 0.4, tetherRadius * 0.7, 72]} />
          <meshBasicMaterial
            color={new THREE.Color(0.72, 0.75, 0.84)}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
          />
        </mesh>
        {ringTargetPositions.map((position, index) => {
          return (
            <group key={`cyl-ring-target-${index}`} position={position}>
              <mesh
                position={[0, 0.08, 0]}
                ref={(mesh) => {
                  coreMeshRefs.current[index] = mesh
                }}
              >
                <sphereGeometry args={[0.085, 12, 12]} />
                <meshBasicMaterial
                  ref={(material) => {
                    coreMaterialRefs.current[index] = material
                  }}
                  color={new THREE.Color(0.95, 0.9, 0.86)}
                  transparent
                  opacity={0.76}
                />
              </mesh>
              <mesh position={[0, -0.01, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.2, 10]} />
                <meshBasicMaterial
                  color={new THREE.Color(0.9, 0.88, 0.86)}
                  transparent
                  opacity={0.45}
                />
              </mesh>
              {/* Interactive overlay: sits on top of display-only target markers. */}
              <mesh
                position={[0, 0.19, 0]}
                onPointerEnter={(event) => onRingTargetEnterRef.current(index, event)}
                onPointerLeave={(event) => onRingTargetLeaveRef.current(index, event)}
                onClick={(event) => onRingTargetClickRef.current(index, event)}
              >
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshBasicMaterial
                  ref={(material) => {
                    glowMaterialRefs.current[index] = material
                  }}
                  color={new THREE.Color(0.98, 0.92, 0.86)}
                  transparent
                  opacity={0.2}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}

const MemoCylinderRig = memo(
  CylinderRig,
  (prev, next) =>
    prev.imagePath === next.imagePath &&
    prev.yOffset === next.yOffset &&
    prev.rotatorYOffset === next.rotatorYOffset &&
    prev.rigScale === next.rigScale &&
    prev.tetherRadius === next.tetherRadius &&
    prev.tetherGap === next.tetherGap &&
    prev.ringTargetCount === next.ringTargetCount &&
    prev.projectorLayoutProfile === next.projectorLayoutProfile
)

type ArchitectureSimulationBundle = {
  reference: RotaryArchitectureSimulation | null
  native: RotaryArchitectureSimulation | null
}

type ArchitectureDisplayMode = "solution1" | "solution2" | "all"
type ArchitectureFocusMode = "normal" | "delta"

type ArchitectureRenderOptions = {
  topKBeams: number
  focusMode: ArchitectureFocusMode
  lockDominantPort: boolean
  showDiffOverlay: boolean
}

type ArchitectureSummary = {
  bandHigh: number
  bandMedium: number
  bandLow: number
  dominantPort: number
  spillActive: boolean
  policyOverride: boolean
  confidence: number
}

type BristleGlyphPoint = {
  x: number
  y: number
  z: number
  h: number
}

function BristleTextPanel({
  text,
  width = 0.96,
  height = 0.96,
  color = new THREE.Color(0.94, 0.9, 0.86),
}: {
  text: string
  width?: number
  height?: number
  color?: THREE.Color
}) {
  const geometry = useMemo(() => {
    const geom = new THREE.CylinderGeometry(0.0038, 0.0038, 1, 6, 1)
    geom.translate(0, 0.5, 0)
    return geom
  }, [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88,
      }),
    [color]
  )
  const points = useMemo<BristleGlyphPoint[]>(() => {
    const trimmed = text.trim()
    if (!trimmed) return []
    const canvas = document.createElement("canvas")
    canvas.width = 700
    canvas.height = 460
    const ctx = canvas.getContext("2d")
    if (!ctx) return []
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "white"
    ctx.textBaseline = "top"
    ctx.font = "600 18px 'Consolas', 'Courier New', monospace"
    const lines = text.split("\n")
    const lineHeight = 24
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], 16, 16 + i * lineHeight)
    }
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const result: BristleGlyphPoint[] = []
    const step = 4
    for (let py = 0; py < canvas.height; py += step) {
      for (let px = 0; px < canvas.width; px += step) {
        const idx = (py * canvas.width + px) * 4
        const alpha = image[idx + 3]
        if (alpha < 80) continue
        const nx = (px / canvas.width - 0.5) * width
        const ny = (0.5 - py / canvas.height) * height
        const jitter = (((px * 73856093) ^ (py * 19349663)) & 0xff) / 255
        result.push({
          x: nx,
          y: ny,
          z: 0.004 + jitter * 0.012,
          h: 0.008 + jitter * 0.012,
        })
      }
    }
    if (result.length > 5200) return result.slice(0, 5200)
    return result
  }, [text, width, height])
  const instRef = useRef<THREE.InstancedMesh>(null)
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (!instRef.current) return
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]
      tempObj.position.set(point.x, point.y, point.z)
      tempObj.scale.set(1, point.h, 1)
      tempObj.rotation.set(0, 0, 0)
      tempObj.updateMatrix()
      instRef.current.setMatrixAt(i, tempObj.matrix)
    }
    instRef.current.count = points.length
    instRef.current.instanceMatrix.needsUpdate = true
  }, [points, tempObj])

  if (points.length === 0) return null

  return <instancedMesh ref={instRef} args={[geometry, material, points.length]} />
}

function tierColor(tier: "core" | "sub" | "detail") {
  if (tier === "core") return new THREE.Color(1.0, 0.54, 0.34)
  if (tier === "sub") return new THREE.Color(0.94, 0.8, 0.52)
  return new THREE.Color(0.82, 0.86, 0.92)
}

function ArchitectureProjectionSpace({
  simulationRef,
  miniObjSalienceRef,
  thetaBandSnapshotsRef,
  simEnabled,
  displayMode,
  renderOptions,
  summaryRef,
  onSummaryUi,
  yCenter,
  layerGap,
  tetherRadius,
  miniObjectCount,
  projectorY,
  projectorRadius,
  projectorThetas,
  projectorLayoutProfile,
}: {
  simulationRef: MutableRef<ArchitectureSimulationBundle>
  miniObjSalienceRef: MutableRef<number[]>
  thetaBandSnapshotsRef: MutableRef<ThetaBandSnapshot[]>
  simEnabled: boolean
  displayMode: ArchitectureDisplayMode
  renderOptions: ArchitectureRenderOptions
  summaryRef: MutableRef<ArchitectureSummary>
  onSummaryUi?: (summary: ArchitectureSummary) => void
  yCenter: number
  layerGap: number
  tetherRadius: number
  miniObjectCount: number
  projectorY: number
  projectorRadius: number
  projectorThetas?: number[]
  projectorLayoutProfile: ProjectorLayoutProfileId
}) {
  const nodeMeshRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const nodeMaterialRefs = useRef<Record<string, THREE.MeshBasicMaterial | null>>({})
  const beamMeshRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const beamMaterialRefs = useRef<Record<string, THREE.MeshBasicMaterial | null>>({})
  const projectorMeshRefs = useRef<Array<THREE.Mesh | null>>([])
  const projectorMaterialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const diffBeamMeshRefs = useRef<Array<THREE.Mesh | null>>([])
  const diffBeamMaterialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const upAxisRef = useRef(new THREE.Vector3(0, 1, 0))
  const dirRef = useRef(new THREE.Vector3())
  const midRef = useRef(new THREE.Vector3())
  const nodeHistoryRef = useRef<Map<string, Array<{ t: number; v: number }>>>(new Map())
  const summaryCommitAccumulatorRef = useRef(0)
  const lastSummaryUiRef = useRef<ArchitectureSummary | null>(null)

  const modePalette = useMemo(
    () => ({
      solution1: {
        core: new THREE.Color(0.99, 0.52, 0.22),
        sub: new THREE.Color(1.0, 0.78, 0.34),
        detail: new THREE.Color(0.98, 0.92, 0.64),
      },
      solution2: {
        core: new THREE.Color(0.3, 0.78, 1.0),
        sub: new THREE.Color(0.22, 0.56, 0.95),
        detail: new THREE.Color(0.58, 0.88, 1.0),
      },
    }),
    []
  )

  const profileSpecs = useMemo(() => {
    const allSpecs = [
      {
        id: "isp_3d_hybrid_reference" as RotaryArchitectureSimulationId,
        key: "reference" as const,
      },
      {
        id: "native_rotary_projection" as RotaryArchitectureSimulationId,
        key: "native" as const,
      },
    ]

    const selected =
      displayMode === "solution1"
        ? [allSpecs[0]]
        : displayMode === "solution2"
          ? [allSpecs[1]]
          : allSpecs

    if (selected.length === 1) {
      return [{ ...selected[0], xOffset: 0, yOffset: 0 }]
    }

    // All solutions: hierarchical vertical order, top-down by solution index.
    // solution 1 at top, solution n at bottom.
    return selected.map((spec, index) => ({
      ...spec,
      xOffset: 0,
      yOffset: layerGap * ((selected.length - 1) / 2 - index),
    }))
  }, [displayMode, layerGap])

  const projectorPositions = useMemo(
    () =>
      Array.from({ length: miniObjectCount }, (_, index) => {
        const [xNorm, yNorm, zNorm] = sampleProjectorPortPoint(index, miniObjectCount, projectorLayoutProfile)
        const fallbackAngle = projectorThetas?.[index] ?? ((index / miniObjectCount) * TWO_PI)
        const fallbackX = Math.cos(fallbackAngle)
        const fallbackZ = Math.sin(fallbackAngle)
        const x = projectorLayoutProfile === "circular" ? fallbackX : xNorm
        const z = projectorLayoutProfile === "circular" ? fallbackZ : zNorm
        const y = projectorY + yNorm * projectorRadius * PROJECTOR_LAYOUT_VERTICAL_GAIN_PROJECTION
        return new THREE.Vector3(x * projectorRadius, y, z * projectorRadius)
      }),
    [miniObjectCount, projectorRadius, projectorY, projectorThetas, projectorLayoutProfile]
  )

  const nodeLayouts = useMemo(() => {
    const tierRadius: Record<"core" | "sub" | "detail", number> = {
      core: tetherRadius * 0.2,
      sub: tetherRadius * 0.32,
      detail: tetherRadius * 0.44,
    }
    const layouts: Array<{
      key: string
      profileId: RotaryArchitectureSimulationId
      profileKey: "reference" | "native"
      nodeId: string
      tier: "core" | "sub" | "detail"
      position: THREE.Vector3
    }> = []

    for (const spec of profileSpecs) {
      const templates = ROTARY_ARCHITECTURE_TEMPLATE_LIBRARY[spec.id]
      for (const tier of ["core", "sub", "detail"] as const) {
        const tierTemplates = templates.filter((template) => template.tier === tier)
        const count = Math.max(1, tierTemplates.length)
        for (let index = 0; index < tierTemplates.length; index += 1) {
          const template = tierTemplates[index]
          const angle = -Math.PI * 0.5 + (index / count) * TWO_PI
          const radius = tierRadius[tier]
          const position = new THREE.Vector3(
            spec.xOffset + Math.cos(angle) * radius,
            yCenter + spec.yOffset,
            Math.sin(angle) * radius
          )
          layouts.push({
            key: `${spec.id}:${template.id}`,
            profileId: spec.id,
            profileKey: spec.key,
            nodeId: template.id,
            tier,
            position,
          })
        }
      }
    }
    return layouts
  }, [profileSpecs, tetherRadius, yCenter])

  useFrame((_, delta) => {
    const now = performance.now()
    const pulseHz = 4
    const phase = ((now / 1000) * pulseHz) % 1
    const pulseEnvelope = phase < 0.24 ? 1 : THREE.MathUtils.lerp(1, 0.36, (phase - 0.24) / 0.76)
    const simulationsByKey: Record<"reference" | "native", RotaryArchitectureSimulation | null> = {
      reference: simulationRef.current.reference,
      native: simulationRef.current.native,
    }

    const miniValues = miniObjSalienceRef.current
    let dominantPort = 0
    let dominantPortValue = -1
    for (let i = 0; i < miniObjectCount; i += 1) {
      const value = miniValues[i] ?? 0
      if (value > dominantPortValue) {
        dominantPortValue = value
        dominantPort = i
      }
    }

    type RuntimeLayout = {
      layoutKey: string
      profileKey: "reference" | "native"
      profileId: RotaryArchitectureSimulationId
      tier: "core" | "sub" | "detail"
      nodeId: string
      position: THREE.Vector3
      runtimeNode: RotaryArchitectureSimulation["nodes"][number]
      salience: number
      delta1s: number
    }
    const runtimeLayouts: RuntimeLayout[] = []
    for (const layout of nodeLayouts) {
      const simulation = simulationsByKey[layout.profileKey]
      const runtimeNode = simulation?.nodes.find((node) => node.id === layout.nodeId)
      if (!runtimeNode) continue
      const history = nodeHistoryRef.current.get(layout.key) ?? []
      history.push({ t: now, v: runtimeNode.salience })
      while (history.length > 0 && now - history[0].t > 1200) history.shift()
      nodeHistoryRef.current.set(layout.key, history)
      const baseline = history.length > 0 ? history[0].v : runtimeNode.salience
      runtimeLayouts.push({
        layoutKey: layout.key,
        profileKey: layout.profileKey,
        profileId: layout.profileId,
        tier: layout.tier,
        nodeId: layout.nodeId,
        position: layout.position,
        runtimeNode,
        salience: runtimeNode.salience,
        delta1s: runtimeNode.salience - baseline,
      })
    }

    const averageAbsDelta =
      runtimeLayouts.length > 0
        ? runtimeLayouts.reduce((sum, entry) => sum + Math.abs(entry.delta1s), 0) / runtimeLayouts.length
        : 0
    const confidence = THREE.MathUtils.clamp(1 - averageAbsDelta * 5, 0.08, 0.98)
    const bandSnapshots = thetaBandSnapshotsRef.current
    const bandHigh = bandSnapshots.filter((snapshot) => snapshot.level === "high").length
    const bandMedium = bandSnapshots.filter((snapshot) => snapshot.level === "medium").length
    const bandLow = Math.max(0, bandSnapshots.length - bandHigh - bandMedium)
    const referenceNodes = simulationsByKey.reference?.nodes ?? []
    const nativeNodes = simulationsByKey.native?.nodes ?? []
    const spillActive = (referenceNodes.find((node) => node.id === "lpddr_spill")?.salience ?? 0) >= 0.07
    const policyOverride =
      (referenceNodes.find((node) => node.id === "power_budget_gate")?.salience ?? 0) >= 0.11 ||
      (nativeNodes.find((node) => node.id === "jitter_damper")?.salience ?? 0) >= 0.11
    summaryRef.current = {
      bandHigh,
      bandMedium,
      bandLow,
      dominantPort,
      spillActive,
      policyOverride,
      confidence,
    }

    const topKeys = new Set<string>()
    const levelByKey = new Map<string, "high" | "medium" | "low">()
    const byProfile: Array<"reference" | "native"> = ["reference", "native"]
    for (const profileKey of byProfile) {
      const profileNodes = runtimeLayouts.filter((entry) => entry.profileKey === profileKey)
      profileNodes.sort((a, b) => b.salience - a.salience)
      for (let i = 0; i < profileNodes.length; i += 1) {
        if (i < Math.max(1, renderOptions.topKBeams)) topKeys.add(profileNodes[i].layoutKey)
        const ratio = i / Math.max(1, profileNodes.length)
        const level = ratio < 0.15 ? "high" : ratio < 0.4 ? "medium" : "low"
        levelByKey.set(profileNodes[i].layoutKey, level)
      }
    }

    for (let index = 0; index < projectorPositions.length; index += 1) {
      const projector = projectorMeshRefs.current[index]
      const material = projectorMaterialRefs.current[index]
      if (!projector || !material) continue
      if (!simEnabled) {
        projector.visible = false
        continue
      }
      projector.visible = true
      const salience = miniObjSalienceRef.current[index] ?? (1 / Math.max(1, miniObjectCount))
      const isDominant = index === dominantPort
      projector.position.copy(projectorPositions[index])
      const gain = (0.68 + salience * 1.8) * (isDominant ? 1.14 : 1) * (0.9 + 0.1 * pulseEnvelope)
      projector.scale.set(gain, gain, gain)
      material.opacity = renderOptions.lockDominantPort && !isDominant ? 0.12 : 0.28 + Math.min(0.6, salience * 1.05)
      material.color.setRGB(0.92, 0.82 + salience * 0.16, 0.7 + salience * 0.26)
    }

    for (const layout of nodeLayouts) {
      const nodeMesh = nodeMeshRefs.current[layout.key]
      const nodeMaterial = nodeMaterialRefs.current[layout.key]
      const beamMesh = beamMeshRefs.current[layout.key]
      const beamMaterial = beamMaterialRefs.current[layout.key]
      if (!nodeMesh || !nodeMaterial || !beamMesh || !beamMaterial) continue
      const entry = runtimeLayouts.find((runtime) => runtime.layoutKey === layout.key)
      if (!entry) {
        nodeMesh.visible = false
        beamMesh.visible = false
        continue
      }

      const onDominantPort = entry.runtimeNode.miniObjId % Math.max(1, miniObjectCount) === dominantPort
      const deltaStrong = simEnabled ? Math.abs(entry.delta1s) > 0.012 : false
      const isTop = simEnabled ? topKeys.has(entry.layoutKey) : true
      // Always render all solution beams/nodes in active modes; keep lock as an optional narrow override.
      const visible = simEnabled
        ? (!renderOptions.lockDominantPort || onDominantPort || entry.profileKey === "reference")
        : true
      nodeMesh.visible = visible
      beamMesh.visible = simEnabled && visible
      if (!visible) continue

      const modeKey = entry.profileId === "isp_3d_hybrid_reference" ? "solution1" : "solution2"
      const baseColor = modePalette[modeKey][entry.tier].clone()
      const level = levelByKey.get(entry.layoutKey) ?? "low"
      if (level === "high") baseColor.offsetHSL(0, 0.18, 0.12)
      else if (level === "medium") baseColor.offsetHSL(0, 0.06, 0.03)
      else baseColor.offsetHSL(0, -0.1, -0.08)

      if (entry.profileId === "isp_3d_hybrid_reference" && entry.nodeId === "lpddr_spill" && spillActive) {
        baseColor.setRGB(1.0, 0.25, 0.18)
      }

      const salience = entry.salience
      const deltaScale = simEnabled ? THREE.MathUtils.clamp(Math.abs(entry.delta1s) * 9, 0, 1) : 0
      const confidenceBoost = 0.78 + confidence * 0.32
      const activeScale = simEnabled ? 1 : 1
      const pulseScale = simEnabled ? (deltaStrong ? (0.76 + pulseEnvelope * 0.42) : 0.9) : 1
      nodeMesh.position.copy(entry.position)
      const nodeScale = (0.62 + salience * 2.8) * activeScale * pulseScale
      nodeMesh.scale.set(nodeScale, nodeScale, nodeScale)
      nodeMaterial.color.copy(baseColor)
      nodeMaterial.opacity = simEnabled
        ? THREE.MathUtils.clamp((0.34 + salience * 0.9) * confidenceBoost, 0.18, 0.98)
        : THREE.MathUtils.clamp((0.34 + salience * 0.62) * confidenceBoost, 0.12, 0.96)

      if (simEnabled) {
        const from = projectorPositions[entry.runtimeNode.miniObjId % projectorPositions.length]
        dirRef.current.subVectors(entry.position, from)
        const length = Math.max(0.001, dirRef.current.length())
        midRef.current.copy(from).addScaledVector(dirRef.current, 0.5)
        beamMesh.position.copy(midRef.current)
        beamMesh.quaternion.setFromUnitVectors(upAxisRef.current, dirRef.current.normalize())
        const radius = THREE.MathUtils.clamp(0.5 + salience * 2.6 + deltaScale, 0.35, 3.4)
        beamMesh.scale.set(radius, length, radius)
        beamMaterial.color.copy(baseColor)
        beamMaterial.opacity = THREE.MathUtils.clamp((isTop ? 0.52 : 0.34) + salience * 0.42 + deltaScale * 0.2, 0.18, 0.96)
      }
    }

    const showDiff = simEnabled && renderOptions.showDiffOverlay && simulationsByKey.reference && simulationsByKey.native
    const portTotalsReference = Array.from({ length: miniObjectCount }, () => 0)
    const portTotalsNative = Array.from({ length: miniObjectCount }, () => 0)
    for (const node of referenceNodes) portTotalsReference[node.miniObjId % miniObjectCount] += node.salience
    for (const node of nativeNodes) portTotalsNative[node.miniObjId % miniObjectCount] += node.salience
    for (let port = 0; port < miniObjectCount; port += 1) {
      const diffMesh = diffBeamMeshRefs.current[port]
      const diffMaterial = diffBeamMaterialRefs.current[port]
      if (!diffMesh || !diffMaterial) continue
      if (!showDiff) {
        diffMesh.visible = false
        continue
      }
      const diff = portTotalsReference[port] - portTotalsNative[port]
      const magnitude = Math.abs(diff)
      const from = projectorPositions[port]
      const to = new THREE.Vector3(0, yCenter, 0)
      dirRef.current.subVectors(to, from)
      const length = Math.max(0.001, dirRef.current.length())
      midRef.current.copy(from).addScaledVector(dirRef.current, 0.5)
      diffMesh.visible = magnitude >= 0.015
      diffMesh.position.copy(midRef.current)
      diffMesh.quaternion.setFromUnitVectors(upAxisRef.current, dirRef.current.normalize())
      const width = THREE.MathUtils.clamp(0.3 + magnitude * 8, 0.2, 1.7)
      diffMesh.scale.set(width, length, width)
      if (diff >= 0) diffMaterial.color.setRGB(1.0, 0.34, 0.25)
      else diffMaterial.color.setRGB(0.28, 0.7, 1.0)
      diffMaterial.opacity = THREE.MathUtils.clamp(0.12 + magnitude * 1.9, 0.08, 0.82)
    }

    summaryCommitAccumulatorRef.current += delta
    if (summaryCommitAccumulatorRef.current >= 0.75) {
      summaryCommitAccumulatorRef.current = 0
      const nextSummary = { ...summaryRef.current }
      const prevSummary = lastSummaryUiRef.current
      if (!prevSummary || !sameArchitectureSummary(prevSummary, nextSummary)) {
        lastSummaryUiRef.current = nextSummary
        onSummaryUi?.(nextSummary)
      }
    }
  })

  return (
    <group>
      {projectorPositions.map((position, index) => (
        <mesh
          key={`arch-projector-${index}`}
          position={position}
          ref={(mesh) => {
            projectorMeshRefs.current[index] = mesh
          }}
        >
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshBasicMaterial
            ref={(material) => {
              projectorMaterialRefs.current[index] = material
            }}
            color={new THREE.Color(0.95, 0.84, 0.72)}
            transparent
            opacity={0.4}
          />
        </mesh>
      ))}
      {Array.from({ length: miniObjectCount }, (_, index) => (
        <mesh
          key={`arch-diff-beam-${index}`}
          ref={(mesh) => {
            diffBeamMeshRefs.current[index] = mesh
          }}
        >
          <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
          <meshBasicMaterial
            ref={(material) => {
              diffBeamMaterialRefs.current[index] = material
            }}
            color={new THREE.Color(0.8, 0.82, 0.86)}
            transparent
            opacity={0.16}
            depthWrite={false}
          />
        </mesh>
      ))}
      {nodeLayouts.map((layout) => (
        <group key={`arch-node-group-${layout.key}`}>
          <mesh
            ref={(mesh) => {
              beamMeshRefs.current[layout.key] = mesh
            }}
          >
            <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
            <meshBasicMaterial
              ref={(material) => {
                beamMaterialRefs.current[layout.key] = material
              }}
              color={tierColor(layout.tier)}
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={layout.position}
            ref={(mesh) => {
              nodeMeshRefs.current[layout.key] = mesh
            }}
          >
            {layout.profileId === "isp_3d_hybrid_reference" ? (
              <boxGeometry args={[0.13, 0.09, 0.09]} />
            ) : (
              <sphereGeometry args={[0.06, 10, 10]} />
            )}
            <meshBasicMaterial
              ref={(material) => {
                nodeMaterialRefs.current[layout.key] = material
              }}
              color={tierColor(layout.tier)}
              transparent
              opacity={0.42}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
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
  domeRadius: _domeRadius,
  verticalDirection: _verticalDirection,
}: {
  activeMode: GripMode
  modes: GripMode[]
  domeRadius: number
  verticalDirection: 1 | -1
}) {
  const activeIndex = modes.indexOf(activeMode)
  
  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: `${MODE_SWITCHER_BOTTOM_PX}px`,
          transform: "translateX(-50%)",
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
  showQuadrantOutline,
  setShowQuadrantOutline,
  showConflictMeter,
  setShowConflictMeter,
  showPlasticity,
  setShowPlasticity,
  showLogStatus,
  setShowLogStatus,
  isDockMode,
  onToggleDockMode,
  architectureDisplayMode,
  setArchitectureDisplayMode,
  architectureRenderOptions,
  setArchitectureRenderOptions,
  architectureSummary,
  showBadges,
  setShowBadges,
}: {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  showQuadrantViewport: boolean
  setShowQuadrantViewport: (show: boolean) => void
  showQuadrantOutline: boolean
  setShowQuadrantOutline: (show: boolean) => void
  showConflictMeter: boolean
  setShowConflictMeter: (show: boolean) => void
  showPlasticity: boolean
  setShowPlasticity: (show: boolean) => void
  showLogStatus: boolean
  setShowLogStatus: (show: boolean) => void
  isDockMode: boolean
  onToggleDockMode: () => void
  architectureDisplayMode: ArchitectureDisplayMode
  setArchitectureDisplayMode: (mode: ArchitectureDisplayMode) => void
  architectureRenderOptions: ArchitectureRenderOptions
  setArchitectureRenderOptions: (next: ArchitectureRenderOptions) => void
  architectureSummary: ArchitectureSummary
  showBadges: boolean
  setShowBadges: (show: boolean) => void
}) {
  const toolbarPortalRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (typeof document !== "undefined") {
      toolbarPortalRef.current = document.body
    }
  }, [])
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
      portal={toolbarPortalRef as any}
      style={{
        pointerEvents: "none",
        position: "fixed",
        inset: 0,
      }}
    >
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: "calc(env(safe-area-inset-bottom) + 18px)",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "row",
          gap: "10px",
          alignItems: "center",
          pointerEvents: "auto",
          userSelect: "none",
          zIndex: 2200,
        }}
      >
        {isOpen && (
          <div
            style={{
              padding: "10px",
              borderRadius: "18px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "linear-gradient(180deg, rgba(88,151,255,0.72), rgba(26,60,116,0.9))",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "row",
              gap: "8px",
              alignItems: "center",
              maxWidth: "92vw",
              overflowX: "auto",
              boxShadow: "0 10px 24px rgba(0,0,0,0.34)",
            }}
          >
            {showBadges && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "linear-gradient(180deg, rgba(38,88,168,0.84), rgba(17,38,76,0.86))",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.24)",
                  color: "rgba(242,246,252,0.96)",
                  fontSize: "10px",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span>H/M/L {architectureSummary.bandHigh}/{architectureSummary.bandMedium}/{architectureSummary.bandLow}</span>
                <span>Port P{architectureSummary.dominantPort + 1}</span>
                <span style={{ color: architectureSummary.spillActive ? "rgba(255,185,170,1)" : "rgba(225,238,255,0.96)" }}>
                  Spill {architectureSummary.spillActive ? "ON" : "OFF"}
                </span>
                <span style={{ color: architectureSummary.policyOverride ? "rgba(255,225,138,0.98)" : "rgba(225,238,255,0.96)" }}>
                  Override {architectureSummary.policyOverride ? "ON" : "OFF"}
                </span>
                <span>Conf {(architectureSummary.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
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
              title={showQuadrantOutline ? "Archive Quadrant Outline" : "Retrieve Quadrant Outline"}
              onClick={() => setShowQuadrantOutline(!showQuadrantOutline)}
              style={toggleButtonStyle(showQuadrantOutline)}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>QO</span>
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
            <button
              type="button"
              title="Log Status"
              onClick={() => setShowLogStatus(!showLogStatus)}
              style={toggleButtonStyle(showLogStatus)}
            >
              <FileText size={18} />
            </button>
            <button
              type="button"
              title="Badges"
              onClick={() => setShowBadges(!showBadges)}
              style={toggleButtonStyle(showBadges)}
            >
              <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.03em" }}>BDG</span>
            </button>
            <button
              type="button"
              title="Dock Grid Scene"
              onClick={onToggleDockMode}
              style={toggleButtonStyle(isDockMode)}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>DG</span>
            </button>
            <button
              type="button"
              title="Display Solution 1"
              onClick={() => setArchitectureDisplayMode("solution1")}
              style={toggleButtonStyle(architectureDisplayMode === "solution1")}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>S1</span>
            </button>
            <button
              type="button"
              title="Display Solution 2"
              onClick={() => setArchitectureDisplayMode("solution2")}
              style={toggleButtonStyle(architectureDisplayMode === "solution2")}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>S2</span>
            </button>
            <button
              type="button"
              title="Display All Solutions"
              onClick={() => setArchitectureDisplayMode("all")}
              style={toggleButtonStyle(architectureDisplayMode === "all")}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>ALL</span>
            </button>
            <button
              type="button"
              title="Top-K Beam Density"
              onClick={() => {
                const nextTopK = architectureRenderOptions.topKBeams >= 10 ? 6 : architectureRenderOptions.topKBeams + 2
                setArchitectureRenderOptions({ ...architectureRenderOptions, topKBeams: nextTopK })
              }}
              style={toggleButtonStyle(true)}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>
                K{architectureRenderOptions.topKBeams}
              </span>
            </button>
            <button
              type="button"
              title="Show Only Delta Since Last Second"
              onClick={() =>
                setArchitectureRenderOptions({
                  ...architectureRenderOptions,
                  focusMode: architectureRenderOptions.focusMode === "normal" ? "delta" : "normal",
                })
              }
              style={toggleButtonStyle(architectureRenderOptions.focusMode === "delta")}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>DEL</span>
            </button>
            <button
              type="button"
              title="Lock On Dominant Port"
              onClick={() =>
                setArchitectureRenderOptions({
                  ...architectureRenderOptions,
                  lockDominantPort: !architectureRenderOptions.lockDominantPort,
                })
              }
              style={toggleButtonStyle(architectureRenderOptions.lockDominantPort)}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>LOCK</span>
            </button>
            <button
              type="button"
              title="A/B Diff Overlay"
              onClick={() =>
                setArchitectureRenderOptions({
                  ...architectureRenderOptions,
                  showDiffOverlay: !architectureRenderOptions.showDiffOverlay,
                })
              }
              style={toggleButtonStyle(architectureRenderOptions.showDiffOverlay)}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em" }}>DIFF</span>
            </button>
          </div>
        )}
        <button
          type="button"
          title={isOpen ? "Close Toolbar" : "Open Toolbar"}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "linear-gradient(180deg, rgba(64,122,225,0.94), rgba(28,58,112,0.95))",
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

type ToolbarHud3DProps = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  showQuadrantViewport: boolean
  setShowQuadrantViewport: (show: boolean) => void
  showQuadrantOutline: boolean
  setShowQuadrantOutline: (show: boolean) => void
  showConflictMeter: boolean
  setShowConflictMeter: (show: boolean) => void
  showPlasticity: boolean
  setShowPlasticity: (show: boolean) => void
  showLogStatus: boolean
  setShowLogStatus: (show: boolean) => void
  isDockMode: boolean
  onToggleDockMode: () => void
  architectureDisplayMode: ArchitectureDisplayMode
  setArchitectureDisplayMode: (mode: ArchitectureDisplayMode) => void
  projectorLayoutProfile: ProjectorLayoutProfileId
  setProjectorLayoutProfile: (profile: ProjectorLayoutProfileId) => void
  architectureSimEnabled: boolean
  setArchitectureSimEnabled: (enabled: boolean) => void
  architectureRenderOptions: ArchitectureRenderOptions
  setArchitectureRenderOptions: (next: ArchitectureRenderOptions) => void
  architectureSummary: ArchitectureSummary
  showBadges: boolean
  setShowBadges: (show: boolean) => void
}

function ToolbarHud3D({
  isOpen,
  setIsOpen,
  showQuadrantViewport,
  setShowQuadrantViewport,
  showQuadrantOutline,
  setShowQuadrantOutline,
  showConflictMeter,
  setShowConflictMeter,
  showPlasticity,
  setShowPlasticity,
  showLogStatus,
  setShowLogStatus,
  isDockMode,
  onToggleDockMode,
  architectureDisplayMode,
  setArchitectureDisplayMode,
  projectorLayoutProfile,
  setProjectorLayoutProfile,
  architectureSimEnabled,
  setArchitectureSimEnabled,
  architectureRenderOptions,
  setArchitectureRenderOptions,
  architectureSummary,
  showBadges,
  setShowBadges,
}: ToolbarHud3DProps) {
  const rootRef = useRef<THREE.Group>(null)
  const ndcAnchorRef = useRef(new THREE.Vector3(TOOLBAR_HUD_VIEW_X, TOOLBAR_HUD_VIEW_Y, 0))
  const worldAnchorRef = useRef(new THREE.Vector3())
  const viewDirRef = useRef(new THREE.Vector3())
  const { camera } = useThree()

  const buttons = useMemo(
    () => [
      { key: "QV", label: "QV", active: showQuadrantViewport, onClick: () => setShowQuadrantViewport(!showQuadrantViewport) },
      { key: "QO", label: "QO", active: showQuadrantOutline, onClick: () => setShowQuadrantOutline(!showQuadrantOutline) },
      { key: "CF", label: "CF", active: showConflictMeter, onClick: () => setShowConflictMeter(!showConflictMeter) },
      { key: "PL", label: "PL", active: showPlasticity, onClick: () => setShowPlasticity(!showPlasticity) },
      { key: "LOG", label: "LOG", active: showLogStatus, onClick: () => setShowLogStatus(!showLogStatus) },
      { key: "S4", label: "S4", active: projectorLayoutProfile === "stacked_sculpture", onClick: () => setProjectorLayoutProfile("stacked_sculpture") },
      { key: "S3", label: "S3", active: projectorLayoutProfile === "hand", onClick: () => setProjectorLayoutProfile("hand") },
      { key: "S2", label: "S2", active: architectureDisplayMode === "solution2", onClick: () => setArchitectureDisplayMode("solution2") },
      { key: "S1", label: "S1", active: architectureDisplayMode === "solution1", onClick: () => setArchitectureDisplayMode("solution1") },
      {
        key: "ALL",
        label: "ALL",
        active: architectureDisplayMode === "all" && projectorLayoutProfile === "circular",
        onClick: () => {
          setArchitectureDisplayMode("all")
          setProjectorLayoutProfile("circular")
        },
      },
      { key: "SIM", label: "SIM", active: architectureSimEnabled, onClick: () => setArchitectureSimEnabled(!architectureSimEnabled) },
      {
        key: "K",
        label: `K${architectureRenderOptions.topKBeams}`,
        active: true,
        onClick: () => {
          const nextTopK = architectureRenderOptions.topKBeams >= 10 ? 6 : architectureRenderOptions.topKBeams + 2
          setArchitectureRenderOptions({ ...architectureRenderOptions, topKBeams: nextTopK })
        },
      },
      { key: "DG", label: "DG", active: isDockMode, onClick: onToggleDockMode },
      { key: "BDG", label: "BDG", active: showBadges, onClick: () => setShowBadges(!showBadges) },
      {
        key: "DIFF",
        label: "DIFF",
        active: architectureRenderOptions.showDiffOverlay,
        onClick: () =>
          setArchitectureRenderOptions({
            ...architectureRenderOptions,
            showDiffOverlay: !architectureRenderOptions.showDiffOverlay,
          }),
      },
    ],
    [
      showQuadrantViewport,
      setShowQuadrantViewport,
      showQuadrantOutline,
      setShowQuadrantOutline,
      showConflictMeter,
      setShowConflictMeter,
      showPlasticity,
      setShowPlasticity,
      showLogStatus,
      setShowLogStatus,
      showBadges,
      setShowBadges,
      isDockMode,
      onToggleDockMode,
      architectureDisplayMode,
      setArchitectureDisplayMode,
      projectorLayoutProfile,
      setProjectorLayoutProfile,
      architectureSimEnabled,
      setArchitectureSimEnabled,
      architectureRenderOptions,
      setArchitectureRenderOptions,
    ]
  )

  const buttonWidth = 0.13
  const buttonGap = 0.02
  const dockPadding = 0.06
  const launcherRadius = 0.07
  const dockToLauncherGap = 0.04
  const buttonsWidth = buttons.length * buttonWidth + Math.max(0, buttons.length - 1) * buttonGap
  const badgeWidth = showBadges ? 1.12 : 0
  const badgeGap = showBadges ? 0.05 : 0
  const dockWidth = isOpen ? buttonsWidth + badgeWidth + badgeGap + dockPadding * 2 : 0
  const dockHeight = 0.12
  const dockCenterX = -(dockWidth * 0.5 + dockToLauncherGap + launcherRadius)

  useFrame(() => {
    if (!rootRef.current) return
    worldAnchorRef.current.copy(ndcAnchorRef.current).unproject(camera)
    viewDirRef.current.copy(worldAnchorRef.current).sub(camera.position).normalize()
    rootRef.current.position.copy(camera.position).addScaledVector(viewDirRef.current, TOOLBAR_HUD_DISTANCE)
    rootRef.current.quaternion.copy(camera.quaternion)
    rootRef.current.scale.setScalar(TOOLBAR_HUD_SCALE)
  })

  return (
    <group ref={rootRef} renderOrder={2500}>
      {isOpen && (
        <group position={[dockCenterX, 0, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[dockWidth, dockHeight, 0.02]} />
            <meshBasicMaterial color={new THREE.Color(0.11, 0.24, 0.5)} transparent opacity={0.88} depthTest={false} />
          </mesh>
          <mesh position={[0, 0.01, 0.012]}>
            <boxGeometry args={[dockWidth - 0.01, dockHeight - 0.018, 0.01]} />
            <meshBasicMaterial color={new THREE.Color(0.2, 0.39, 0.74)} transparent opacity={0.62} depthTest={false} />
          </mesh>

          {showBadges && (
            <group position={[-dockWidth * 0.5 + dockPadding + badgeWidth * 0.5, 0, 0.016]}>
              <mesh>
                <boxGeometry args={[badgeWidth, 0.09, 0.01]} />
                <meshBasicMaterial color={new THREE.Color(0.14, 0.28, 0.58)} transparent opacity={0.9} depthTest={false} />
              </mesh>
              <Text
                position={[0, 0, 0.008]}
                fontSize={0.025}
                color={"#f2f7ff"}
                anchorX="center"
                anchorY="middle"
                maxWidth={badgeWidth - 0.06}
              >
                {`H/M/L ${architectureSummary.bandHigh}/${architectureSummary.bandMedium}/${architectureSummary.bandLow}   Port P${architectureSummary.dominantPort + 1}   Spill ${architectureSummary.spillActive ? "ON" : "OFF"}   Override ${architectureSummary.policyOverride ? "ON" : "OFF"}   Conf ${(architectureSummary.confidence * 100).toFixed(0)}%`}
              </Text>
            </group>
          )}

          {buttons.map((button, index) => {
            const xStart = -dockWidth * 0.5 + dockPadding + (showBadges ? badgeWidth + badgeGap : 0)
            const x = xStart + index * (buttonWidth + buttonGap) + buttonWidth * 0.5
            return (
              <group key={button.key} position={[x, 0, 0.018]}>
                <mesh
                  onClick={(event) => {
                    event.stopPropagation()
                    button.onClick()
                  }}
                >
                  <boxGeometry args={[buttonWidth, 0.09, 0.018]} />
                  <meshBasicMaterial
                    color={button.active ? new THREE.Color(0.37, 0.58, 0.88) : new THREE.Color(0.13, 0.2, 0.36)}
                    transparent
                    opacity={button.active ? 0.95 : 0.9}
                    depthTest={false}
                  />
                </mesh>
                <Text position={[0, 0, 0.012]} fontSize={0.03} color={"#f5f7ff"} anchorX="center" anchorY="middle">
                  {button.label}
                </Text>
              </group>
            )
          })}
        </group>
      )}

      <group position={[0, 0, 0.015]}>
        <mesh
          onClick={(event) => {
            event.stopPropagation()
            setIsOpen(!isOpen)
          }}
        >
          <cylinderGeometry args={[0.039, 0.039, 0.013, 48]} />
          <meshBasicMaterial color={new THREE.Color(0.28, 0.3, 0.34)} transparent opacity={0.96} depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.008]}>
          <cylinderGeometry args={[0.031, 0.031, 0.006, 48]} />
          <meshBasicMaterial color={new THREE.Color(0.72, 0.74, 0.78)} transparent opacity={0.94} depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.011]}>
          <torusGeometry args={[0.0225, 0.00225, 10, 48]} />
          <meshBasicMaterial color={new THREE.Color(0.2, 0.21, 0.24)} transparent opacity={0.95} depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <sphereGeometry args={[0.0035, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color(0.16, 0.17, 0.2)} transparent opacity={0.98} depthTest={false} />
        </mesh>
        <mesh position={[0, 0.014, 0.0125]}>
          <planeGeometry args={[0.009, 0.002]} />
          <meshBasicMaterial color={new THREE.Color(0.2, 0.21, 0.24)} transparent opacity={0.95} depthTest={false} />
        </mesh>
        <mesh position={[0, -0.014, 0.0125]}>
          <planeGeometry args={[0.009, 0.002]} />
          <meshBasicMaterial color={new THREE.Color(0.2, 0.21, 0.24)} transparent opacity={0.95} depthTest={false} />
        </mesh>
      </group>
    </group>
  )
}

const MemoToolbarHud3D = memo(
  ToolbarHud3D,
  (prev, next) =>
    prev.isOpen === next.isOpen &&
    prev.showQuadrantViewport === next.showQuadrantViewport &&
    prev.showQuadrantOutline === next.showQuadrantOutline &&
    prev.showConflictMeter === next.showConflictMeter &&
    prev.showPlasticity === next.showPlasticity &&
    prev.showLogStatus === next.showLogStatus &&
    prev.isDockMode === next.isDockMode &&
    prev.architectureDisplayMode === next.architectureDisplayMode &&
    prev.projectorLayoutProfile === next.projectorLayoutProfile &&
    prev.architectureSimEnabled === next.architectureSimEnabled &&
    prev.showBadges === next.showBadges &&
    prev.architectureRenderOptions.topKBeams === next.architectureRenderOptions.topKBeams &&
    prev.architectureRenderOptions.focusMode === next.architectureRenderOptions.focusMode &&
    prev.architectureRenderOptions.lockDominantPort === next.architectureRenderOptions.lockDominantPort &&
    prev.architectureRenderOptions.showDiffOverlay === next.architectureRenderOptions.showDiffOverlay &&
    sameArchitectureSummary(prev.architectureSummary, next.architectureSummary)
)

export default function DomeScene({ onExit, bristles, colorPalette, tensorServiceRef: externalTensorServiceRef }: DomeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bristleGroupRef = useRef<THREE.Group>(null)
  const centerBristleRef = useRef<THREE.Mesh>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(2) // Start at center field (index 2)
  const [cameraMode, setCameraMode] = useState<"rim" | "top" | "bottom">("rim")
  const [quadrantOrientation, setQuadrantOrientation] = useState<"top" | "bottom">("bottom")
  const [isToolbarOpen, setIsToolbarOpen] = useState(true)
  const [showQuadrantViewport, setShowQuadrantViewport] = useState(false)
  const [showQuadrantOutline, setShowQuadrantOutline] = useState(false)
  const [showConflictMeter, setShowConflictMeter] = useState(false)
  const [showPlasticityPanel, setShowPlasticityPanel] = useState(false)
  const [showLogStatus, setShowLogStatus] = useState(false)
  // Archive substrate preview targets by default; keep feature available behind a flag.
  const [showSubstrateTargets] = useState(false)
  const [showToolbarBadges, setShowToolbarBadges] = useState(false)
  const [architectureDisplayMode, setArchitectureDisplayMode] = useState<ArchitectureDisplayMode>("all")
  const [projectorLayoutProfile, setProjectorLayoutProfile] = useState<ProjectorLayoutProfileId>("circular")
  const [architectureSimEnabled, setArchitectureSimEnabled] = useState(true)
  const [architectureRenderOptions, setArchitectureRenderOptions] = useState<ArchitectureRenderOptions>({
    topKBeams: 8,
    focusMode: "normal",
    lockDominantPort: false,
    showDiffOverlay: false,
  })
  const [architectureSummaryUi, setArchitectureSummaryUi] = useState<ArchitectureSummary>({
    bandHigh: 0,
    bandMedium: 0,
    bandLow: 0,
    dominantPort: 0,
    spillActive: false,
    policyOverride: false,
    confidence: 0.5,
  })
  const [playlistMode, setPlaylistMode] = useState<"fifo" | "lifo">("fifo")
  const [playlistWindowStart, setPlaylistWindowStart] = useState(0)
  const [quadrantSubstrateIndex, setQuadrantSubstrateIndex] = useState<number[]>(
    () => Array.from({ length: MINI_OBJECT_COUNT }, () => 0)
  )
  const [activeThetaBandIndex, setActiveThetaBandIndex] = useState<number | null>(null)
  const [sceneRegime, setSceneRegime] = useState<SceneRegime>("orbit")
  const [dockQuadrantId, setDockQuadrantId] = useState<number | null>(null)
  const [dockSelectedBristleId, setDockSelectedBristleId] = useState<number | null>(null)
  const [hoveredGridCell, setHoveredGridCell] = useState<number | null>(null)
  const [gridTexture, setGridTexture] = useState<THREE.Texture | null>(null)
  const [logFlushState, setLogFlushState] = useState<{
    status: "idle" | "syncing" | "ok" | "error"
    lastAt: number | null
    lastCount: number
    message?: string
  }>({
    status: "idle",
    lastAt: null,
    lastCount: 0,
  })
  
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
  const plasticityFieldRef = useRef(new Float32Array(PLASTIC_R_BINS * PLASTIC_THETA_BINS))
  const plasticityThetaRef = useRef(new Float32Array(PLASTIC_R_BINS * PLASTIC_THETA_BINS))
  const plasticityRadialRef = useRef(new Float32Array(PLASTIC_R_BINS * PLASTIC_THETA_BINS))
  const plasticityOutRef = useRef(new Float32Array(PLASTIC_R_BINS * PLASTIC_THETA_BINS))
  const plasticityTickAccumulatorRef = useRef(0)
  const fieldLogAccumulatorRef = useRef(0)
  const quadrantSummaryAccumulatorRef = useRef(0)
  const thetaBandUpdateAccumulatorRef = useRef(0)
  const thetaBandSummaryAccumulatorRef = useRef(0)
  const persistAccumulatorRef = useRef(0)
  const apiFlushAccumulatorRef = useRef(0)
  const lastPersistedCountRef = useRef(0)
  const lastApiSyncedCountRef = useRef(0)
  const viewportMetricsCommitAccumulatorRef = useRef(0)
  const sessionIdRef = useRef(`sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  const logBufferRef = useRef<Array<PlasticLogEntry>>([])
  const quadrantActivityRef = useRef<Map<number, { hits: number; dwellTotalMs: number; depositTotal: number }>>(new Map())
  const dwellAccumulatorRef = useRef(0)
  const lastFixationLogRef = useRef(0)
  const backgroundHoverThrottleRef = useRef(0)
  const bandHoverThrottleRef = useRef(0)
  const lastBackgroundHoverBristleRef = useRef<number | null>(null)
  const thetaBandSnapshotsRef = useRef<ThetaBandSnapshot[]>([])
  const squadSalienceSnapshotsRef = useRef<SquadSalienceSnapshot[]>([])
  const squadSalienceCountsRef = useRef<{ high: number; medium: number; low: number }>({
    high: 0,
    medium: 0,
    low: 0,
  })
  const miniObjSalienceRef = useRef<number[]>(
    Array.from({ length: MINI_OBJECT_COUNT }, () => 1 / MINI_OBJECT_COUNT)
  )
  const activeThetaBandIndexRef = useRef<number | null>(null)
  const onRingTargetEnterRef = useRef<(bandIndex: number, event: any) => void>(() => {})
  const onRingTargetClickRef = useRef<(bandIndex: number, event: any) => void>(() => {})
  const onRingTargetLeaveRef = useRef<(bandIndex: number, event: any) => void>(() => {})
  const salienceUiCommitAccumulatorRef = useRef(0)
  const uiMiniSalienceRef = useRef<number[]>(Array.from({ length: MINI_OBJECT_COUNT }, () => 1 / MINI_OBJECT_COUNT))
  const uiBandLevelSignatureRef = useRef("")
  const logFlushStateRef = useRef(logFlushState)
  const showLogStatusRef = useRef(showLogStatus)
  const frameTargetRef = useRef(new THREE.Vector3())
  const frameBasePositionRef = useRef(new THREE.Vector3())
  const frameFinalPositionRef = useRef(new THREE.Vector3())
  const perfFrameCountRef = useRef(0)
  const perfFrameTimeRef = useRef(0)
  const perfMaxDeltaRef = useRef(0)
  const rotaryFrameStoreRef = useRef(createRotaryFrameStore(1200))
  const architectureSimulationRef = useRef<ArchitectureSimulationBundle>({
    reference: null,
    native: null,
  })
  const architectureSummaryRef = useRef<ArchitectureSummary>({
    bandHigh: 0,
    bandMedium: 0,
    bandLow: 0,
    dominantPort: 0,
    spillActive: false,
    policyOverride: false,
    confidence: 0.5,
  })
  
  const { camera, size } = useThree()
  const [quadrantViewportMetrics, setQuadrantViewportMetrics] = useState({
    diameterPx: 620,
    innerRadiusPct: 26,
  })
  const quadrantViewportMetricsRef = useRef(quadrantViewportMetrics)
  useEffect(() => {
    quadrantViewportMetricsRef.current = quadrantViewportMetrics
  }, [quadrantViewportMetrics])
  const handleArchitectureSummaryUi = useCallback((next: ArchitectureSummary) => {
    setArchitectureSummaryUi((prev) => (sameArchitectureSummary(prev, next) ? prev : next))
  }, [])

  const handlePlaylistStepForward = () => {
    setPlaylistWindowStart((prev) => Math.min(prev + 1, PLAYLIST_MAX_INDEX - PLAYLIST_VISIBLE_COUNT))
  }

  const handlePlaylistStepBackward = () => {
    setPlaylistWindowStart((prev) => Math.max(prev - 1, 0))
  }

  useEffect(() => {
    if (!isPerfDiagEnabled()) return
    const intervalId = window.setInterval(() => {
      const frames = perfFrameCountRef.current
      const totalSec = perfFrameTimeRef.current
      const maxDeltaSec = perfMaxDeltaRef.current
      const fps = totalSec > 0 ? frames / totalSec : 0
      const avgDeltaMs = frames > 0 ? (totalSec / frames) * 1000 : 0
      console.info(
        `[perf/5s] dome fps=${fps.toFixed(1)} frames=${frames} avgDeltaMs=${avgDeltaMs.toFixed(2)} maxDeltaMs=${(maxDeltaSec * 1000).toFixed(2)}`
      )
      perfFrameCountRef.current = 0
      perfFrameTimeRef.current = 0
      perfMaxDeltaRef.current = 0
    }, 5000)
    return () => window.clearInterval(intervalId)
  }, [])

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
  const bristleMeta = useMemo(() => buildBristleMeta(bristles, BRISTLES_PER_QUADRANT), [bristles])

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
  // Cap/reference ring sits on the scene zero plane; dome + waveguide derive from this shared anchor.
  const Y_RIM = useMemo(() => DOME_CAP_ZERO_Y, [])
  const RIM_RING_Y = useMemo(
    () => Y_RIM - domeRadius * RIM_RING_PLANE_OFFSET_FACTOR,
    [Y_RIM, domeRadius]
  )
  // Align the waveguide field with the mini-object layer.
  // Position target surface above the dome apex, centered on azimuth.
  const CYLINDER_Y_OFFSET = useMemo(() => domeRadius * 0.32, [domeRadius])
  const CYLINDER_ROTATOR_GAP = useMemo(() => domeRadius * 0.09, [domeRadius])
  const CYLINDER_ROTATOR_Y_OFFSET = useMemo(
    () => CYLINDER_Y_OFFSET + CYLINDER_ROTATOR_GAP,
    [CYLINDER_Y_OFFSET, CYLINDER_ROTATOR_GAP]
  )
  const WAVEGUIDE_Y_OFFSET = useMemo(
    () => CYLINDER_Y_OFFSET + CYLINDER_ROTATOR_GAP * 0.5,
    [CYLINDER_Y_OFFSET, CYLINDER_ROTATOR_GAP]
  )
  const ARCH_PROJECTION_CENTER_Y = useMemo(
    () => (CYLINDER_Y_OFFSET + WAVEGUIDE_Y_OFFSET) * 0.5,
    [CYLINDER_Y_OFFSET, WAVEGUIDE_Y_OFFSET]
  )
  const ARCH_PROJECTION_LAYER_GAP = useMemo(() => domeRadius * 0.08, [domeRadius])
  const CYLINDER_TETHER_RADIUS = useMemo(() => domeRadius * 0.34, [domeRadius])
  const PROJECTOR_RING_RADIUS = useMemo(
    () => domeRadius * DOME_RIM_OVERFILL_SCALE * 0.49 * 1.28,
    [domeRadius]
  )
  const CYLINDER_RIG_SCALE = useMemo(() => 0.34, [])
  const domeCenterY = useMemo(() => WAVEGUIDE_Y_OFFSET + domeRadius * 0.35, [WAVEGUIDE_Y_OFFSET, domeRadius])
  // Raise quadrant edges relative to the rim plane
  const quadrantPlaneY = useMemo(() => Y_RIM + domeRadius * 0.15, [Y_RIM, domeRadius])
  const WAVEGUIDE_SCALE_Y = 2

  const waveguideNativeRadius = useMemo(() => {
    if (bristles.length === 0) return 4.6
    let maxRadius = 0
    for (const bristle of bristles) {
      const [x, , z] = bristle.circularPosition
      const radial = Math.hypot(x, z) + bristle.scale[0] * 1.5
      if (radial > maxRadius) maxRadius = radial
    }
    return Math.max(0.001, maxRadius + 0.12)
  }, [bristles])
  const waveguideTargetRadius = useMemo(
    () => domeRadius * DOME_RIM_OVERFILL_SCALE * 0.49,
    [domeRadius]
  )
  const WAVEGUIDE_SCALE_XZ = useMemo(
    () => waveguideTargetRadius / waveguideNativeRadius,
    [waveguideTargetRadius, waveguideNativeRadius]
  )
  const waveguideConcaveDownFactor = useMemo(
    () => ((WAVEGUIDE_SCALE_XZ * WAVEGUIDE_SCALE_XZ) / (2 * Math.max(0.001, waveguideTargetRadius) * WAVEGUIDE_SCALE_Y)) * 0.5,
    [WAVEGUIDE_SCALE_XZ, waveguideTargetRadius]
  )

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
        const position = new THREE.Vector3(x, RIM_RING_Y, z)

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
    [bristles, N_BRISTLES, R_rim, RIM_RING_Y, bristleMetrics, palette],
  )

  const getQuadrantIdForBristle = (bristleId: number) => {
    return bristleMeta.byId.get(bristleId)?.tensolId ?? 0
  }

  const getQuadrantBristles = (quadrantId: number): [number, number, number, number] => {
    const members = bristleMeta.tensolMembersById.get(Math.max(0, quadrantId)) ?? []
    const fallback = bristleMeta.idByRingIndex[0] ?? 0
    const padded = [
      members[0] ?? fallback,
      members[1] ?? members[0] ?? fallback,
      members[2] ?? members[1] ?? members[0] ?? fallback,
      members[3] ?? members[2] ?? members[1] ?? members[0] ?? fallback,
    ] as [number, number, number, number]
    return padded
  }

  const activeSceneId: SceneId = sceneRegime === "dock" ? "B_grid" : "A_waveguide"
  const activeSelectedBristleId = selectedIndex !== null ? (bristleMeta.idByRingIndex[selectedIndex] ?? 0) : null
  const activeDockQuadrantId = dockQuadrantId ?? (activeSelectedBristleId !== null ? getQuadrantIdForBristle(activeSelectedBristleId) : 0)
  const activeQuadrantBristles = getQuadrantBristles(activeDockQuadrantId)

  const centerField = fields[selectedFieldIndex]

  useEffect(() => {
    if (!centerField?.imagePath) {
      setGridTexture(null)
      return
    }
    const loader = new THREE.TextureLoader()
    loader.load(
      centerField.imagePath,
      (loadedTexture) => {
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping
        setGridTexture(loadedTexture)
      },
      undefined,
      () => setGridTexture(null)
    )
  }, [centerField?.imagePath])

  const dockAnchor = useMemo(() => {
    const bristleIds = getQuadrantBristles(activeDockQuadrantId)
    const thetas = bristleIds.map((id) => rimStrips[id]?.theta ?? ((id / Math.max(1, N_BRISTLES)) * TWO_PI))
    let sx = 0
    let sz = 0
    for (const theta of thetas) {
      sx += Math.cos(theta)
      sz += Math.sin(theta)
    }
    const thetaDock = normAngle(Math.atan2(sz, sx))
    const sideSign = thetaDock >= Math.PI * 0.5 && thetaDock <= Math.PI * 1.5 ? -1 : 1

    const anchor = new THREE.Vector3(R_rim * Math.cos(thetaDock), Y_RIM, R_rim * Math.sin(thetaDock))
    const forward = new THREE.Vector3(-Math.cos(thetaDock), 0, -Math.sin(thetaDock)).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(up, forward).normalize()
    const up2 = new THREE.Vector3().crossVectors(forward, right).normalize()
    const trayOffset = domeRadius * 0.22
    const lift = domeRadius * 0.06
    const sideOffset = domeRadius * 0.1 * sideSign
    const center = anchor.clone().add(forward.multiplyScalar(trayOffset)).add(up2.multiplyScalar(lift)).add(right.multiplyScalar(sideOffset))
    const basis = new THREE.Matrix4().makeBasis(right, forward, up2)
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis)
    return {
      center,
      quaternion,
      thetaDock,
      sideSign,
      bristleIds,
    }
  }, [activeDockQuadrantId, rimStrips, N_BRISTLES, R_rim, Y_RIM, domeRadius])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedSession = window.localStorage.getItem(LOG_STORAGE_ACTIVE_SESSION_KEY)
    const resolvedSession = storedSession || sessionIdRef.current
    sessionIdRef.current = resolvedSession
    if (!storedSession) {
      window.localStorage.setItem(LOG_STORAGE_ACTIVE_SESSION_KEY, resolvedSession)
    }

    const raw = window.localStorage.getItem(`${LOG_STORAGE_PREFIX}${resolvedSession}`)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        logBufferRef.current = parsed as PlasticLogEntry[]
        lastPersistedCountRef.current = parsed.length
        lastApiSyncedCountRef.current = 0
      }
    } catch (error) {
      console.warn("Could not restore persisted plasticity logs", error)
    }
  }, [])

  useEffect(() => {
    // Keep Log HUD opt-in only: it appears only after explicit toolbar toggle.
    setShowLogStatus(false)
  }, [])


  useEffect(() => {
    if (typeof window === "undefined") return
    const flushOnPageHide = () => {
      persistLogsToLocal()
      try {
        const pending = logBufferRef.current.slice(lastApiSyncedCountRef.current)
        if (pending.length === 0) return
        const payload = JSON.stringify({
          sessionId: sessionIdRef.current,
          events: pending,
          sentAt: Date.now(),
        })
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" })
          navigator.sendBeacon("/api/plasticity/log", blob)
        }
      } catch {
        // Best effort.
      }
    }

    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey)) return
      if (event.key.toLowerCase() === "e") {
        event.preventDefault()
        exportLogsAsJsonl()
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault()
        void flushLogsToApi()
      }
    }

    ;(window as any).__plasticityLogs = {
      exportJsonl: () => exportLogsAsJsonl(),
      flushApi: () => flushLogsToApi(true),
      getCount: () => logBufferRef.current.length,
      getSessionId: () => sessionIdRef.current,
      getRotaryFrameCount: () => rotaryFrameStoreRef.current.count(),
      getLatestRotaryFrame: () => rotaryFrameStoreRef.current.latest(),
      getRotaryFrameRange: (limit = 120) => rotaryFrameStoreRef.current.range(limit),
      getArchitectureSimulations: () => architectureSimulationRef.current,
      clearLocal: () => {
        const sessionId = sessionIdRef.current
        window.localStorage.removeItem(`${LOG_STORAGE_PREFIX}${sessionId}`)
      },
    }

    window.addEventListener("pagehide", flushOnPageHide)
    window.addEventListener("beforeunload", flushOnPageHide)
    window.addEventListener("keydown", handleShortcut)

    return () => {
      delete (window as any).__plasticityLogs
      window.removeEventListener("pagehide", flushOnPageHide)
      window.removeEventListener("beforeunload", flushOnPageHide)
      window.removeEventListener("keydown", handleShortcut)
    }
  }, [])

  const getBristleTheta = (bristleId: number) => {
    const meta = bristleMeta.byId.get(bristleId)
    if (meta) return meta.theta
    return normAngle((bristleId / Math.max(1, N_BRISTLES)) * TWO_PI)
  }

  const nearestBristleByTheta = (theta: number) => {
    const ordered = bristleMeta.ordered
    if (ordered.length === 0) return null
    let low = 0
    let high = ordered.length - 1
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (ordered[mid].theta < theta) low = mid + 1
      else high = mid - 1
    }

    const wrap = (index: number) => (index + ordered.length) % ordered.length
    const rightIndex = wrap(low)
    const leftIndex = wrap(low - 1)
    const right = ordered[rightIndex]
    const left = ordered[leftIndex]
    const circularDistance = (a: number, b: number) =>
      Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
    const pickRight = circularDistance(theta, right.theta) <= circularDistance(theta, left.theta)
    return pickRight ? right : left
  }

  useEffect(() => {
    const ordered = bristleMeta.ordered
    if (ordered.length === 0) {
      thetaBandSnapshotsRef.current = []
      uiBandLevelSignatureRef.current = ""
      return
    }
    const defaults: ThetaBandSnapshot[] = Array.from({ length: FPS_THETA_BAND_COUNT }, (_, bandIndex) => {
      const thetaStart = (bandIndex / FPS_THETA_BAND_COUNT) * TWO_PI
      const thetaEnd = ((bandIndex + 1) / FPS_THETA_BAND_COUNT) * TWO_PI
      const thetaCenter = normAngle((thetaStart + thetaEnd) * 0.5)
      const nearest = ordered[Math.floor((bandIndex / FPS_THETA_BAND_COUNT) * ordered.length)] ?? ordered[0]
      const squadId = nearest.tensolId
      return {
        bandIndex,
        thetaStart,
        thetaEnd,
        thetaCenter,
        score: 0,
        level: "low",
        miniObjId: squadId % MINI_OBJECT_COUNT,
        quadrantId: squadId % MINI_OBJECT_COUNT,
        squadId,
        anchorBristleId: nearest.id,
      }
    })
    thetaBandSnapshotsRef.current = defaults
    uiBandLevelSignatureRef.current = defaults.map((snapshot) => snapshot.level[0]).join("")
  }, [bristleMeta])

  useEffect(() => {
    activeThetaBandIndexRef.current = activeThetaBandIndex
  }, [activeThetaBandIndex])

  useEffect(() => {
    showLogStatusRef.current = showLogStatus
    if (showLogStatus) {
      setLogFlushState(logFlushStateRef.current)
    }
  }, [showLogStatus])

  const getBristleEnergy = (bristleId: number) => {
    const thetaBin = thetaToBin(getBristleTheta(bristleId))
    let sum = 0
    for (let r = 0; r < PLASTIC_R_BINS; r += 1) {
      sum += plasticityFieldRef.current[r * PLASTIC_THETA_BINS + thetaBin]
    }
    return sum
  }

  const appendLog = (entry: PlasticLogEntry) => {
    logBufferRef.current.push(entry)
    if (logBufferRef.current.length > 3000) {
      logBufferRef.current.splice(0, 500)
      lastPersistedCountRef.current = Math.min(lastPersistedCountRef.current, logBufferRef.current.length)
      lastApiSyncedCountRef.current = Math.min(lastApiSyncedCountRef.current, logBufferRef.current.length)
    }
    const plasticityDebugEnabled =
      typeof window !== "undefined" &&
      (((window as any).__WG_DEBUG_PLASTICITY === true) ||
        window.localStorage.getItem("__WG_DEBUG_PLASTICITY") === "1")
    if (process.env.NODE_ENV !== "production" && plasticityDebugEnabled) {
      console.debug("[plasticity-log]", entry)
    }
  }

  const persistLogsToLocal = () => {
    try {
      if (typeof window === "undefined") return
      const sessionId = sessionIdRef.current
      window.localStorage.setItem(LOG_STORAGE_ACTIVE_SESSION_KEY, sessionId)
      window.localStorage.setItem(`${LOG_STORAGE_PREFIX}${sessionId}`, JSON.stringify(logBufferRef.current))
      lastPersistedCountRef.current = logBufferRef.current.length
    } catch (error) {
      console.warn("Failed to persist plasticity logs locally", error)
    }
  }

  const updateLogFlushState = (next: {
    status: "idle" | "syncing" | "ok" | "error"
    lastAt: number | null
    lastCount: number
    message?: string
  }) => {
    logFlushStateRef.current = next
    if (showLogStatusRef.current) {
      setLogFlushState(next)
    }
  }

  const flushLogsToApi = async (force = false) => {
    const startIndex = force ? 0 : lastApiSyncedCountRef.current
    const pending = logBufferRef.current.slice(startIndex)
    if (pending.length === 0) return
    try {
      updateLogFlushState({
        ...logFlushStateRef.current,
        status: "syncing",
        message: `Flushing ${pending.length} logs`,
      })
      const response = await fetch("/api/plasticity/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          events: pending,
          sentAt: Date.now(),
        }),
      })
      if (response.ok) {
        lastApiSyncedCountRef.current = logBufferRef.current.length
        updateLogFlushState({
          status: "ok",
          lastAt: Date.now(),
          lastCount: pending.length,
          message: "Synced",
        })
      } else {
        updateLogFlushState({
          status: "error",
          lastAt: Date.now(),
          lastCount: 0,
          message: `HTTP ${response.status}`,
        })
      }
    } catch (error) {
      console.warn("Failed to flush plasticity logs to API sink", error)
      updateLogFlushState({
        status: "error",
        lastAt: Date.now(),
        lastCount: 0,
        message: error instanceof Error ? error.message : "Request failed",
      })
    }
  }

  const exportLogsAsJsonl = () => {
    if (typeof window === "undefined") return
    const lines = logBufferRef.current.map((entry) => JSON.stringify(entry))
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "application/x-ndjson;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `plasticity_${sessionIdRef.current}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  const trackQuadrantActivity = (quadrantId: number, next: Partial<{ hits: number; dwellTotalMs: number; depositTotal: number }>) => {
    const current = quadrantActivityRef.current.get(quadrantId) ?? { hits: 0, dwellTotalMs: 0, depositTotal: 0 }
    const merged = {
      hits: current.hits + (next.hits ?? 0),
      dwellTotalMs: current.dwellTotalMs + (next.dwellTotalMs ?? 0),
      depositTotal: current.depositTotal + (next.depositTotal ?? 0),
    }
    quadrantActivityRef.current.set(quadrantId, merged)
  }

  const logInteraction = (
    type: InteractionType,
    hitTarget: HitTarget,
    bristleId: number,
    weight: number,
    r = 1,
    dwellMs?: number
  ) => {
    const quadrantId = getQuadrantIdForBristle(bristleId)
    trackQuadrantActivity(quadrantId, {
      hits: type === "enter" || type === "click" || type === "doubleClick" ? 1 : 0,
      dwellTotalMs: dwellMs ?? 0,
    })
    appendLog({
      t: performance.now(),
      sessionId: sessionIdRef.current,
      sceneId: activeSceneId,
      mode: gripMode,
      type,
      hitTarget,
      bristleId,
      quadrantId,
      theta: getBristleTheta(bristleId),
      r,
      weight,
      dwellMs,
    })
  }

  const depositToPlasticity = (sceneId: SceneId, bristleId: number, r: number, weight: number) => {
    const field = plasticityFieldRef.current
    const theta = getBristleTheta(bristleId)
    const quadrantId = getQuadrantIdForBristle(bristleId)
    const rBinCenter = rToBin(r)
    const tBinCenter = thetaToBin(theta)
    for (let dr = -1; dr <= 1; dr += 1) {
      const rBin = Math.max(0, Math.min(PLASTIC_R_BINS - 1, rBinCenter + dr))
      for (let dt = -1; dt <= 1; dt += 1) {
        const tBin = (tBinCenter + dt + PLASTIC_THETA_BINS) % PLASTIC_THETA_BINS
        const stampWeight = weight * KERNEL_3X3[dr + 1][dt + 1]
        field[rBin * PLASTIC_THETA_BINS + tBin] += stampWeight
      }
    }

    trackQuadrantActivity(quadrantId, { depositTotal: weight })
    appendLog({
      t: performance.now(),
      sessionId: sessionIdRef.current,
      sceneId,
      mode: gripMode,
      bristleId,
      quadrantId,
      gridCoord: { rBin: rBinCenter, thetaBin: tBinCenter },
      weight,
      kernel: "K3",
    })
  }

  const enterDockRegime = (bristleId: number) => {
    const quadrantId = getQuadrantIdForBristle(bristleId)
    appendLog({
      t: performance.now(),
      sessionId: sessionIdRef.current,
      type: "scene_enter",
      from: "A_waveguide",
      to: "B_grid",
      bristleId,
      quadrantId,
    })
    setDockQuadrantId(quadrantId)
    setDockSelectedBristleId(bristleId)
    setShowQuadrantViewport(false)
    setSceneRegime("dock")
  }

  const exitDockRegime = () => {
    appendLog({
      t: performance.now(),
      sessionId: sessionIdRef.current,
      type: "scene_exit",
      from: "B_grid",
      to: "A_waveguide",
      bristleId: dockSelectedBristleId ?? undefined,
      quadrantId: dockQuadrantId ?? undefined,
    })
    setSceneRegime("orbit")
    setHoveredGridCell(null)
  }

  // Initialize orbit radius when domeRadius is available
  useEffect(() => {
    // Set default view distance for Orbit Scan (solution-display overview framing).
    orbitRadiusRef.current = domeRadius * 2.1
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
        // Orbit Scan restored: keep stable default framing.
      } else if (gripMode === "meridian_dive") {
        // Meridian Dive now uses former Orbit Scan navigation arc.
        orbitAngleRef.current += deltaX * sensitivity * 0.45
      } else if (gripMode === "helical_descent") {
        // Helical Descent now uses former Meridian Dive close-up orbiting.
        meridianAngleRef.current += deltaX * sensitivity * 0.9
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
        // Meridian Dive now uses former Orbit Scan zoom control.
        orbitRadiusRef.current = Math.max(domeRadius * 1.6, Math.min(domeRadius * 3.6, orbitRadiusRef.current - delta * 4.5))
      } else if (gripMode === "helical_descent") {
        // Helical Descent now uses former Meridian Dive depth control.
        meridianDepthRef.current = Math.max(0, Math.min(1, meridianDepthRef.current + delta))
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
        if (sceneRegime === "dock") {
          exitDockRegime()
          return
        }
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
  }, [onExit, fields.length, fields, sceneRegime, dockSelectedBristleId, dockQuadrantId])

  useEffect(() => {
    if (sceneRegime !== "orbit") return
    if (gripMode === "event_lensing") {
      setCameraMode("rim")
    }
  }, [gripMode, sceneRegime])

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
    perfFrameCountRef.current += 1
    perfFrameTimeRef.current += delta
    if (delta > perfMaxDeltaRef.current) perfMaxDeltaRef.current = delta

    const t = state.clock.elapsedTime

    if (groupRef.current && ENABLE_SCENE_IDLE_SPIN) {
      // Consistent rotation speed for all modes (Event Lensing style)
      const rotationSpeed = 0.01
      groupRef.current.rotation.y += delta * rotationSpeed
    }
    const target = frameTargetRef.current
    if (sceneRegime === "dock") target.copy(dockAnchor.center)
    else if (gripMode === "orbit_scan") target.set(0, 0, 0)
    else target.set(0, ARCH_PROJECTION_CENTER_Y, 0)
    const baseRadius = domeRadius * 2

    // Base camera position from grip mode + camera mode (when applicable).
    const basePosition = frameBasePositionRef.current
    if (sceneRegime === "dock") {
      // Dock mode still honors cameraMode so top/rim/bottom transitions stay available.
      const sideOffset = dockAnchor.sideSign * domeRadius * 0.16
      const dockLift = domeRadius * 0.92
      const dockBack = domeRadius * 0.58
      const dockSide = sideOffset * 0.36
      if (cameraMode === "top") {
        basePosition
          .copy(dockAnchor.center)
          .add(new THREE.Vector3(dockSide, dockLift, 0.001))
      } else if (cameraMode === "bottom") {
        basePosition
          .copy(dockAnchor.center)
          .add(new THREE.Vector3(dockSide, -dockLift, 0.001))
      } else {
        basePosition
          .copy(dockAnchor.center)
          .add(new THREE.Vector3(0, domeRadius * 0.8, dockBack))
          .add(new THREE.Vector3(sideOffset, 0, 0))
      }
    } else if (gripMode === "meridian_dive") {
      // Meridian Dive: former Orbit Scan stable overview framing.
      const targetY = ARCH_PROJECTION_CENTER_Y - ARCH_PROJECTION_LAYER_GAP * 0.15
      target.set(0, targetY, 0)
      const yaw = orbitAngleRef.current
      const distance = Math.max(domeRadius * 1.5, orbitRadiusRef.current)
      const side = Math.sin(yaw) * distance * 0.26
      const forward = Math.cos(yaw) * distance
      basePosition.set(side, targetY - domeRadius * 0.16, forward)
    } else if (gripMode === "helical_descent") {
      // Helical Descent: former Meridian Dive closer architecture-space inspection.
      const targetY = ARCH_PROJECTION_CENTER_Y + ARCH_PROJECTION_LAYER_GAP * 0.08
      target.set(0, targetY, 0)
      const depth = THREE.MathUtils.clamp(meridianDepthRef.current, 0, 1)
      const yaw = meridianAngleRef.current
      const distance = THREE.MathUtils.lerp(domeRadius * 1.22, domeRadius * 0.5, depth)
      const side = Math.sin(yaw) * distance * 0.44
      const forward = Math.cos(yaw) * distance
      const lift = THREE.MathUtils.lerp(-domeRadius * 0.09, domeRadius * 0.11, depth)
      basePosition.set(side, targetY + lift, forward)
    } else if (cameraMode === "rim") {
      basePosition.set(0, 0, baseRadius)
    } else if (cameraMode === "top") {
      basePosition.set(0, baseRadius, 0.001)
    } else {
      basePosition.set(0, -baseRadius, 0.001)
    }

    // Apply grip mode camera operators
    // All modes now use Event Lensing camera behavior as default (basePosition from cameraMode)
    const finalPosition = frameFinalPositionRef.current

    // Event Lensing style: local zoom bubble (subtle position adjustment when active)
    // This behavior is now applied to all modes
    const lensOffset = (gripMode === "event_lensing" && lensActiveRef.current) ? 1.5 : 0
    finalPosition.copy(basePosition).add(new THREE.Vector3(0, 0, -lensOffset))

    // Smoothly lerp camera to final position
    camera.position.lerp(finalPosition, delta * CAMERA_LERP_GAIN)
    if (camera.position.distanceToSquared(finalPosition) <= CAMERA_SNAP_EPS * CAMERA_SNAP_EPS) {
      camera.position.copy(finalPosition)
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

    if (showQuadrantViewport) {
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

      const planeY = quadrantPlaneY
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

      viewportMetricsCommitAccumulatorRef.current += delta
      if (viewportMetricsCommitAccumulatorRef.current >= 0.28) {
        viewportMetricsCommitAccumulatorRef.current = 0
        const prev = quadrantViewportMetricsRef.current
        const diameterChanged = Math.abs(nextDiameter - prev.diameterPx) > 2.5
        const innerChanged = Math.abs(nextInnerPct - prev.innerRadiusPct) > 0.75
        if (diameterChanged || innerChanged) {
          const nextMetrics = {
            diameterPx: nextDiameter,
            innerRadiusPct: nextInnerPct,
          }
          quadrantViewportMetricsRef.current = nextMetrics
          setQuadrantViewportMetrics((state) => {
            const stateDiameterChanged = Math.abs(nextMetrics.diameterPx - state.diameterPx) > 2.5
            const stateInnerChanged = Math.abs(nextMetrics.innerRadiusPct - state.innerRadiusPct) > 0.75
            return stateDiameterChanged || stateInnerChanged ? nextMetrics : state
          })
        }
      }
    } else {
      viewportMetricsCommitAccumulatorRef.current = 0
    }

    plasticityTickAccumulatorRef.current += delta
    fieldLogAccumulatorRef.current += delta
    quadrantSummaryAccumulatorRef.current += delta
    thetaBandUpdateAccumulatorRef.current += delta
    thetaBandSummaryAccumulatorRef.current += delta
    persistAccumulatorRef.current += delta
    apiFlushAccumulatorRef.current += delta
    salienceUiCommitAccumulatorRef.current += delta

    if (sceneRegime === "dock" && hoveredGridCell !== null) {
      const bristleId = activeQuadrantBristles[hoveredGridCell] ?? activeQuadrantBristles[0]
      const dwellWeight = 0.3 * delta
      depositToPlasticity("B_grid", bristleId, 0.6, dwellWeight)
      dwellAccumulatorRef.current += delta * 1000
      if (dwellAccumulatorRef.current >= 250) {
        logInteraction("dwell", "surfaceCell", bristleId, dwellWeight, 0.6, dwellAccumulatorRef.current)
        dwellAccumulatorRef.current = 0
      }
    }

    const diffusion = getModeDiffusion(gripMode)
    const lambda = 0.985
    while (plasticityTickAccumulatorRef.current >= 0.05) {
      plasticityTickAccumulatorRef.current -= 0.05
      const field = plasticityFieldRef.current
      const thetaBuffer = plasticityThetaRef.current
      const radialBuffer = plasticityRadialRef.current
      const out = plasticityOutRef.current
      const decayFactor = Math.pow(lambda, 0.05)
      for (let i = 0; i < field.length; i += 1) {
        field[i] *= decayFactor
      }
      blurTheta(field, thetaBuffer)
      blurRadial(field, radialBuffer)
      for (let i = 0; i < field.length; i += 1) {
        const smooth = diffusion.kTheta * thetaBuffer[i] + diffusion.kRad * radialBuffer[i]
        out[i] = (1 - diffusion.alpha) * field[i] + diffusion.alpha * smooth
      }
      field.set(out)
    }

    if (thetaBandUpdateAccumulatorRef.current >= 0.12) {
      thetaBandUpdateAccumulatorRef.current = 0
      const frame = computeRotaryEncoderFrame({
        field: plasticityFieldRef.current,
        bandCount: FPS_THETA_BAND_COUNT,
        miniObjectCount: MINI_OBJECT_COUNT,
        miniObjectThetas: miniObjectRoutingThetas,
        plasticThetaBins: PLASTIC_THETA_BINS,
        plasticRBins: PLASTIC_R_BINS,
        bristleMeta,
      })
      if (frame.bandSnapshots.length > 0) {
        thetaBandSnapshotsRef.current = frame.bandSnapshots as ThetaBandSnapshot[]
        squadSalienceSnapshotsRef.current = frame.squadSnapshots as SquadSalienceSnapshot[]
        squadSalienceCountsRef.current = frame.squadCounts
        miniObjSalienceRef.current = frame.miniObjectSalience
        architectureSimulationRef.current.reference = simulateRotaryArchitecture(frame, "isp_3d_hybrid_reference")
        architectureSimulationRef.current.native = simulateRotaryArchitecture(frame, "native_rotary_projection")
        rotaryFrameStoreRef.current.push({
          t: performance.now(),
          bandCounts: frame.bandCounts,
          squadCounts: frame.squadCounts,
          miniObjectSalience: frame.miniObjectSalience,
        })
        const bandLevelSignature = frame.bandSnapshots.map((snapshot) => snapshot.level[0]).join("")
        const bandShapeChanged = bandLevelSignature !== uiBandLevelSignatureRef.current
        const miniChanged = frame.miniObjectSalience.some(
          (value, index) => Math.abs(value - (uiMiniSalienceRef.current[index] ?? 0)) > 0.045
        )
        if (salienceUiCommitAccumulatorRef.current >= SALIENCE_UI_COMMIT_INTERVAL_SEC && (bandShapeChanged || miniChanged)) {
          salienceUiCommitAccumulatorRef.current = 0
          uiBandLevelSignatureRef.current = bandLevelSignature
          uiMiniSalienceRef.current = [...frame.miniObjectSalience]
        }
      }
    }

    if (thetaBandSummaryAccumulatorRef.current >= 1.0) {
      thetaBandSummaryAccumulatorRef.current = 0
      const snapshots = thetaBandSnapshotsRef.current
      if (snapshots.length > 0) {
        let bandHigh = 0
        let bandMedium = 0
        let bandLow = 0
        for (const snapshot of snapshots) {
          if (snapshot.level === "high") bandHigh += 1
          else if (snapshot.level === "medium") bandMedium += 1
          else bandLow += 1
        }
        const squadCounts = squadSalienceCountsRef.current
        appendLog({
          t: performance.now(),
          sessionId: sessionIdRef.current,
          sceneId: activeSceneId,
          mode: gripMode,
          bandCount: snapshots.length,
          high: bandHigh,
          medium: bandMedium,
          low: bandLow,
          band_count_high: bandHigh,
          band_count_medium: bandMedium,
          band_count_low: bandLow,
          squad_count_high: squadCounts.high,
          squad_count_medium: squadCounts.medium,
          squad_count_low: squadCounts.low,
          miniObjSalience: miniObjSalienceRef.current,
        })
      }
    }

    if (fieldLogAccumulatorRef.current >= 0.1) {
      fieldLogAccumulatorRef.current = 0
      let energyTotal = 0
      let energyPeak = 0
      let entropy = 0
      const field = plasticityFieldRef.current
      for (let i = 0; i < field.length; i += 1) {
        const value = Math.max(0, field[i])
        energyTotal += value
        if (value > energyPeak) energyPeak = value
      }
      if (energyTotal > 0) {
        for (let i = 0; i < field.length; i += 1) {
          const p = Math.max(0, field[i]) / energyTotal
          if (p > 1e-9) entropy += -p * Math.log(p)
        }
      }
      appendLog({
        t: performance.now(),
        sessionId: sessionIdRef.current,
        sceneId: activeSceneId,
        mode: gripMode,
        focus: {
          bristleId: dockSelectedBristleId ?? activeSelectedBristleId ?? undefined,
          quadrantId: dockQuadrantId ?? (activeSelectedBristleId !== null ? getQuadrantIdForBristle(activeSelectedBristleId) : undefined),
          theta: dockSelectedBristleId !== null ? getBristleTheta(dockSelectedBristleId) : undefined,
          r: sceneRegime === "dock" ? 0.6 : 1,
        },
        field: {
          lambda,
          alpha: diffusion.alpha,
          kTheta: diffusion.kTheta,
          kRad: diffusion.kRad,
          energyTotal,
          energyPeak,
          entropy,
        },
      })
    }

    if (quadrantSummaryAccumulatorRef.current >= 1.0) {
      quadrantSummaryAccumulatorRef.current = 0
      for (const [quadrantId, activity] of quadrantActivityRef.current.entries()) {
        if (activity.hits === 0 && activity.dwellTotalMs === 0 && activity.depositTotal === 0) continue
        const bristleIds = getQuadrantBristles(quadrantId)
        let energy = 0
        let peak = 0
        for (const bristleId of bristleIds) {
          const thetaBin = thetaToBin(getBristleTheta(bristleId))
          for (let r = 0; r < PLASTIC_R_BINS; r += 1) {
            const v = plasticityFieldRef.current[r * PLASTIC_THETA_BINS + thetaBin]
            energy += v
            if (v > peak) peak = v
          }
        }
        appendLog({
          t: performance.now(),
          sessionId: sessionIdRef.current,
          sceneId: activeSceneId,
          quadrantId,
          bristleIds,
          activity: { ...activity },
          plasticity: { energy, peak },
        })
        quadrantActivityRef.current.set(quadrantId, { hits: 0, dwellTotalMs: 0, depositTotal: 0 })
      }
    }

    if (
      persistAccumulatorRef.current >= LOG_PERSIST_INTERVAL_SEC &&
      logBufferRef.current.length > lastPersistedCountRef.current
    ) {
      persistAccumulatorRef.current = 0
      persistLogsToLocal()
    }

    if (apiFlushAccumulatorRef.current >= LOG_API_FLUSH_INTERVAL_SEC) {
      apiFlushAccumulatorRef.current = 0
      if (logBufferRef.current.length > lastApiSyncedCountRef.current) {
        void flushLogsToApi()
      }
    }
  })

  const handleRimClick = () => {
    if (sceneRegime === "dock") {
      exitDockRegime()
      return
    }
    onExit()
  }

  const handleBristleClick = (rimIndex: number, event: any) => {
    event.stopPropagation()
    setSelectedIndex((prev) => (prev === rimIndex ? null : rimIndex))
    const bristleId = bristleMeta.idByRingIndex[rimIndex] ?? rimIndex
    setDockSelectedBristleId(bristleId)
    logInteraction("click", "bristle", bristleId, 1.0, 1.0)
    depositToPlasticity("A_waveguide", bristleId, 1.0, 1.0)
    
    // Check if this bristle has tagged content
    const content = taggingServiceRef.current.getContentByBristle(rimIndex)
    if (content) {
      openWindowPlayer(content)
    }
  }

  const handleBristlePointerEnter = (rimIndex: number, event: any) => {
    event.stopPropagation()
    const bristleId = bristleMeta.idByRingIndex[rimIndex] ?? rimIndex
    logInteraction("enter", "bristle", bristleId, 0.2, 1.0)
    depositToPlasticity("A_waveguide", bristleId, 1.0, 0.2)
  }

  const handleBristlePointerLeave = (rimIndex: number, event: any) => {
    event.stopPropagation()
    const bristleId = bristleMeta.idByRingIndex[rimIndex] ?? rimIndex
    logInteraction("leave", "bristle", bristleId, 0, 1.0)
  }

  const handleScenePointerDown = (event: any) => {
    if (sceneRegime !== "orbit") return
    if (!event?.point) return
    const theta = thetaFromPoint(event.point.x, event.point.z)
    const nearest = nearestBristleByTheta(theta)
    if (!nearest) return

    const bristleId = nearest.id
    setSelectedIndex(nearest.ringIndex)
    setDockSelectedBristleId(bristleId)
    logInteraction("click", "background", bristleId, FPS_MINI_OBJ_CONFIG.bgClickDeposit, FPS_MINI_OBJ_CONFIG.bgClickR)
    depositToPlasticity("A_waveguide", bristleId, FPS_MINI_OBJ_CONFIG.bgClickR, FPS_MINI_OBJ_CONFIG.bgClickDeposit)
  }

  const handleScenePointerMove = (event: any) => {
    if (sceneRegime !== "orbit") return
    if (!event?.point) return

    // Only use fallback when a bristle mesh wasn't the active hit target.
    const firstHit = event?.intersections?.[0]?.object
    if (firstHit?.userData?.bristleId !== undefined) return

    const now = performance.now()
    if (now - backgroundHoverThrottleRef.current < FPS_MINI_OBJ_CONFIG.bgHoverThrottleMs) return
    backgroundHoverThrottleRef.current = now

    const theta = thetaFromPoint(event.point.x, event.point.z)
    const nearest = nearestBristleByTheta(theta)
    if (!nearest) return

    const bristleId = nearest.id
    if (
      lastBackgroundHoverBristleRef.current === bristleId &&
      now - lastFixationLogRef.current < FPS_MINI_OBJ_CONFIG.bgHoverRepeatGuardMs
    ) {
      return
    }
    lastBackgroundHoverBristleRef.current = bristleId
    lastFixationLogRef.current = now

    // Soft inductive coupling: low-weight deposit, no hard selection mutation.
    logInteraction("fixation", "background", bristleId, FPS_MINI_OBJ_CONFIG.bgHoverDeposit, FPS_MINI_OBJ_CONFIG.bgHoverR)
    depositToPlasticity("A_waveguide", bristleId, FPS_MINI_OBJ_CONFIG.bgHoverR, FPS_MINI_OBJ_CONFIG.bgHoverDeposit)
  }

  const handleScenePointerLeave = () => {
    lastBackgroundHoverBristleRef.current = null
  }

  const getThetaBandSnapshot = (bandIndex: number) => {
    const snapshots = thetaBandSnapshotsRef.current
    if (snapshots.length === 0) return null
    const normalized = ((bandIndex % snapshots.length) + snapshots.length) % snapshots.length
    return snapshots[normalized] ?? null
  }

  const handleCylinderRingTargetEnter = (bandIndex: number, event: any) => {
    if (sceneRegime !== "orbit") return
    event.stopPropagation()
    setActiveThetaBandIndex(bandIndex)

    const now = performance.now()
    if (now - bandHoverThrottleRef.current < FPS_MINI_OBJ_CONFIG.bandHoverThrottleMs) return
    bandHoverThrottleRef.current = now

    const snapshot = getThetaBandSnapshot(bandIndex)
    if (!snapshot) return
    const bristleId = snapshot.anchorBristleId
    logInteraction("fixation", "thetaBand", bristleId, FPS_MINI_OBJ_CONFIG.bandHoverDeposit, FPS_MINI_OBJ_CONFIG.bandR)
    depositToPlasticity("A_waveguide", bristleId, FPS_MINI_OBJ_CONFIG.bandR, FPS_MINI_OBJ_CONFIG.bandHoverDeposit)
  }

  const handleCylinderRingTargetLeave = (_bandIndex: number, event: any) => {
    event.stopPropagation()
    setActiveThetaBandIndex(null)
  }

  const handleCylinderRingTargetClick = (bandIndex: number, event: any) => {
    if (sceneRegime !== "orbit") return
    event.stopPropagation()
    const snapshot = getThetaBandSnapshot(bandIndex)
    if (!snapshot) return
    const bristleId = snapshot.anchorBristleId
    const bristle = bristleMeta.byId.get(bristleId)
    setDockSelectedBristleId(bristleId)
    if (bristle) {
      setSelectedIndex(bristle.ringIndex)
    }
    setActiveThetaBandIndex(bandIndex)
    logInteraction("click", "cylinderTarget", bristleId, FPS_MINI_OBJ_CONFIG.bandClickDeposit, FPS_MINI_OBJ_CONFIG.bandR)
    depositToPlasticity("A_waveguide", bristleId, FPS_MINI_OBJ_CONFIG.bandR, FPS_MINI_OBJ_CONFIG.bandClickDeposit)

    // Quadrant glyph toggle substrate state piping:
    // route band salience into the corresponding mini-object/quadrant substrate level.
    const salience = miniObjSalienceRef.current[snapshot.miniObjId] ?? (1 / MINI_OBJECT_COUNT)
    const nextSubstrateIndex = salienceToSubstrateIndex(salience)
    setQuadrantSubstrateIndex((prev) => {
      const next = [...prev]
      next[snapshot.miniObjId] = nextSubstrateIndex
      return next
    })
  }

  onRingTargetEnterRef.current = handleCylinderRingTargetEnter
  onRingTargetClickRef.current = handleCylinderRingTargetClick
  onRingTargetLeaveRef.current = handleCylinderRingTargetLeave

  const getCellBristleId = (cellIndex: number) => {
    return activeQuadrantBristles[Math.max(0, Math.min(3, cellIndex))] ?? activeQuadrantBristles[0]
  }

  const handleGridCellEnter = (cellIndex: number, event: any) => {
    event.stopPropagation()
    const bristleId = getCellBristleId(cellIndex)
    setHoveredGridCell(cellIndex)
    setDockSelectedBristleId(bristleId)
    logInteraction("enter", "surfaceCell", bristleId, 0.2, 0.6)
    depositToPlasticity("B_grid", bristleId, 0.6, 0.2)
  }

  const handleGridCellLeave = (cellIndex: number, event: any) => {
    event.stopPropagation()
    const bristleId = getCellBristleId(cellIndex)
    if (hoveredGridCell === cellIndex) {
      setHoveredGridCell(null)
      dwellAccumulatorRef.current = 0
    }
    logInteraction("leave", "surfaceCell", bristleId, 0, 0.6)
  }

  const handleGridCellMove = (cellIndex: number, event: any) => {
    event.stopPropagation()
    const now = performance.now()
    if (now - lastFixationLogRef.current < 80) {
      return
    }
    lastFixationLogRef.current = now
    const bristleId = getCellBristleId(cellIndex)
    logInteraction("fixation", "surfaceCell", bristleId, 0.06, 0.6)
    depositToPlasticity("B_grid", bristleId, 0.6, 0.06)
  }

  const handleGridCellClick = (cellIndex: number, event: any) => {
    event.stopPropagation()
    const bristleId = getCellBristleId(cellIndex)
    setDockSelectedBristleId(bristleId)
    logInteraction("click", "surfaceCell", bristleId, 1.0, 0.6)
    depositToPlasticity("B_grid", bristleId, 0.6, 1.0)
  }

  const handleQuadrantSubstrateToggle = (quadrantId: number, event?: any) => {
    if (event?.stopPropagation) {
      event.stopPropagation()
    }
    setQuadrantSubstrateIndex((prev) => {
      const next = [...prev]
      const current = next[quadrantId] ?? 0
      next[quadrantId] = (current + 1) % SUBSTRATE_RING_LEVELS.length
      return next
    })
  }

  const handleInterstitialSubstrateToggle = (leftQuadrantId: number, rightQuadrantId: number, event?: any) => {
    if (event?.stopPropagation) {
      event.stopPropagation()
    }
    setQuadrantSubstrateIndex((prev) => {
      const next = [...prev]
      const leftCurrent = next[leftQuadrantId] ?? 0
      const rightCurrent = next[rightQuadrantId] ?? 0
      next[leftQuadrantId] = (leftCurrent + 1) % SUBSTRATE_RING_LEVELS.length
      next[rightQuadrantId] = (rightCurrent + 1) % SUBSTRATE_RING_LEVELS.length
      return next
    })
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
  // Preserve current visual inner radius sizing, then lock it to a rim-relative ratio.
  // This keeps the same size while deriving/sticking from dome/rim radius math.
  const quadrantSectionInnerRadiusTarget = useMemo(
    () => Math.min(baleenOuterRadius + 0.5, quadrantSectionOuterRadius - 0.05),
    [baleenOuterRadius, quadrantSectionOuterRadius]
  )
  const quadrantSectionInnerRimRatio = useMemo(
    () => THREE.MathUtils.clamp(quadrantSectionInnerRadiusTarget / Math.max(domeRadius, 0.0001), 0, 0.98),
    [quadrantSectionInnerRadiusTarget, domeRadius]
  )
  const quadrantSectionInnerRadius = useMemo(
    () => Math.min(domeRadius * quadrantSectionInnerRimRatio, quadrantSectionOuterRadius - 0.05),
    [domeRadius, quadrantSectionInnerRimRatio, quadrantSectionOuterRadius]
  )
  // Middle camera mode should stay on low/bottom sector orientation/mapping.
  const effectiveQuadrantOrientation = cameraMode === "rim" ? "bottom" : quadrantOrientation
  const quadrantSectors = useMemo(() => {
    const gapDeg = 0.9
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
  }, [visiblePlaylistIndices, effectiveQuadrantOrientation, quadrantViewportMetrics.innerRadiusPct])
  const quadrantSubstrateTargets = useMemo<QuadrantSubstrateTarget[]>(() => {
    const orientationRotation = effectiveQuadrantOrientation === "top" ? Math.PI : 0
    const step = TWO_PI / MINI_OBJECT_COUNT
    const radialSpan = Math.max(0.01, quadrantSectionOuterRadius - quadrantSectionInnerRadius)
    const surfaceNormalAxis = new THREE.Vector3(0, 0, 1)
    const domeCenter = new THREE.Vector3(0, domeCenterY, 0)
    return Array.from({ length: MINI_OBJECT_COUNT }, (_, quadrantId) => {
      const startRad = -Math.PI + quadrantId * step
      const endRad = startRad + step
      const thetaStart = startRad + orientationRotation
      const thetaEnd = endRad + orientationRotation
      const thetaCenter = (thetaStart + thetaEnd) * 0.5
      const substrateIndex = quadrantSubstrateIndex[quadrantId] ?? 0
      const substrateRNorm = SUBSTRATE_RING_LEVELS[substrateIndex] ?? SUBSTRATE_RING_LEVELS[0]
      const radius = Math.min(domeRadius - 0.01, quadrantSectionInnerRadius + radialSpan * substrateRNorm)
      const surfaceY = domeCenterY + Math.sqrt(Math.max(0, domeRadius * domeRadius - radius * radius))
      const worldPosition = new THREE.Vector3(
        Math.cos(thetaCenter) * radius,
        surfaceY + 0.02,
        Math.sin(thetaCenter) * radius,
      )
      const normal = worldPosition.clone().sub(domeCenter).normalize()
      const worldQuaternion = new THREE.Quaternion().setFromUnitVectors(surfaceNormalAxis, normal)
      return {
        quadrantId,
        thetaRange: [thetaStart, thetaEnd],
        thetaCenter,
        substrateIndex,
        substrateRNorm,
        meshTag: `quadrant-substrate-q${quadrantId}`,
        worldPosition,
        worldQuaternion,
      }
    })
  }, [
    effectiveQuadrantOrientation,
    quadrantSubstrateIndex,
    quadrantSectionInnerRadius,
    quadrantSectionOuterRadius,
    quadrantPlaneY,
    domeCenterY,
    domeRadius,
  ])
  const quadrantInterstitialTargets = useMemo<QuadrantInterstitialTarget[]>(() => {
    const orientationRotation = effectiveQuadrantOrientation === "top" ? Math.PI : 0
    const step = TWO_PI / MINI_OBJECT_COUNT
    const radius = Math.min(domeRadius - 0.005, quadrantSectionOuterRadius - 0.01)
    const surfaceY = domeCenterY + Math.sqrt(Math.max(0, domeRadius * domeRadius - radius * radius))
    const surfaceNormalAxis = new THREE.Vector3(0, 0, 1)
    const domeCenter = new THREE.Vector3(0, domeCenterY, 0)
    return Array.from({ length: MINI_OBJECT_COUNT }, (_, index) => {
      const leftQuadrantId = index
      const rightQuadrantId = (index + 1) % MINI_OBJECT_COUNT
      const thetaCenter = -Math.PI + (index + 1) * step + orientationRotation
      const worldPosition = new THREE.Vector3(
        Math.cos(thetaCenter) * radius,
        surfaceY + 0.022,
        Math.sin(thetaCenter) * radius,
      )
      const normal = worldPosition.clone().sub(domeCenter).normalize()
      const worldQuaternion = new THREE.Quaternion().setFromUnitVectors(surfaceNormalAxis, normal)
      return {
        leftQuadrantId,
        rightQuadrantId,
        thetaCenter,
        meshTag: `quadrant-substrate-gap-${index}`,
        worldPosition,
        worldQuaternion,
      }
    })
  }, [effectiveQuadrantOrientation, quadrantSectionOuterRadius, domeCenterY, domeRadius])
  const miniObjectRoutingThetas = useMemo(() => {
    if (quadrantSubstrateTargets.length === 0) {
      return Array.from({ length: MINI_OBJECT_COUNT }, (_, index) => canonTheta((index / MINI_OBJECT_COUNT) * TWO_PI))
    }
    return quadrantSubstrateTargets.map((target) =>
      canonTheta(Math.atan2(target.worldPosition.z, target.worldPosition.x))
    )
  }, [quadrantSubstrateTargets])
  const solutionPanelText = useMemo(() => {
    const s1Grid1 = [
      "Summary:",
      "Title:: Solution 1: Stacked Hybrid Memory Projection (SHMP)",
      "Description:: Solution 1 (SHMP): Models a 3D-stacked hybrid memory ISP strategy;",
      "it shows how workload buffering/routing across 3D-SRAM + 3D-DRAM tiers",
      "reduces off-chip DRAM traffic and power, with bristle/band salience used",
      "to project and inspect those memory tradeoffs in the architecture display space.",
      "",
      "In conclusion: S1 visualizes a memory architecture decision system.",
    ].join("\n")
    const s1Grid2 =
      'Architecture simulation system reference:: s1: simulateRotaryArchitecture(..., "isp_3d_hybrid_reference")'
    const s2Grid1 = [
      "Summary:",
      "Title:: Solution 2: Native Rotary Beamforming Fabric (NRBF)",
      "Description:: Solution 2 (NRBF): models a native rotary waveguide control",
      "architecture: it treats the dome as a memoryless rotary encoder +",
      "beamforming/routing fabric, where mini objects act as controllable",
      "ports/mirrors to steer, split, and bias directional salience flow across",
      "bristles, squads, and theta bands.",
      "",
      "In conclusion:: S2 visualizes a directional control architecture decision",
      "system. Both use the same substrate (bristles/bands/squads) but project",
      "different design logics onto it.",
    ].join("\n")
    const s2Grid2 =
      'Architecture simulation system reference:: s2: simulateRotaryArchitecture(..., "native_rotary_projection")'
    const emptyGrid = ""

    if (architectureDisplayMode === "solution1") {
      return [s1Grid1, s1Grid2, emptyGrid, emptyGrid]
    }
    if (architectureDisplayMode === "solution2") {
      return [s2Grid1, s2Grid2, emptyGrid, emptyGrid]
    }
    return [s1Grid1, s1Grid2, s2Grid1, s2Grid2]
  }, [architectureDisplayMode])
  const verticalDirection: 1 | -1 = cameraMode === "top" ? 1 : -1
  const isRimMiddleView = cameraMode === "rim"
  const pendingLogCount = Math.max(0, logBufferRef.current.length - lastApiSyncedCountRef.current)
  const logFlushColor =
    logFlushState.status === "ok"
      ? "rgba(120, 255, 160, 0.95)"
      : logFlushState.status === "error"
        ? "rgba(255, 110, 110, 0.95)"
        : logFlushState.status === "syncing"
          ? "rgba(255, 220, 120, 0.95)"
          : "rgba(210, 210, 210, 0.95)"
  const logFlushLabel =
    logFlushState.lastAt !== null
      ? `${new Date(logFlushState.lastAt).toLocaleTimeString()}`
      : "never"

  return (
    <group
      ref={groupRef}
      onPointerDown={handleScenePointerDown}
      onPointerMove={handleScenePointerMove}
      onPointerLeave={handleScenePointerLeave}
    >
      {/* Inverted architecture stack: dome + cylinder rig + mini-object projection + waveguide */}
      <group position={[0, Y_RIM, 0]} rotation={[Math.PI, 0, 0]}>
        {/* Dome hemisphere */}
        <mesh
          position={[0, domeCenterY - Y_RIM, 0]}
          rotation={[0, 0, 0]}
          scale={[DOME_RIM_OVERFILL_SCALE, 1, DOME_RIM_OVERFILL_SCALE]}
        >
          <sphereGeometry args={[domeRadius, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial
            color={domeColor}
            side={THREE.BackSide}
            wireframe={false}
          />
        </mesh>

        {/* Waveguide Fields - Center field, vertical/upright orientation */}
        {centerField && (
          <group>
          <group rotation={[Math.PI, 0, 0]}>
            <MemoCylinderRig
              imagePath={centerField.imagePath}
              yOffset={CYLINDER_Y_OFFSET + MINI_OBJECT_LAYER_Y_LIFT}
              rotatorYOffset={CYLINDER_ROTATOR_Y_OFFSET + MINI_OBJECT_LAYER_Y_LIFT}
              rigScale={CYLINDER_RIG_SCALE}
              tetherRadius={PROJECTOR_RING_RADIUS}
              tetherGap={CYLINDER_ROTATOR_GAP}
              ringTargetCount={CYLINDER_RING_TARGET_COUNT}
              thetaBandSnapshotsRef={thetaBandSnapshotsRef}
              miniObjSalienceRef={miniObjSalienceRef}
              activeBandIndexRef={activeThetaBandIndexRef}
              onRingTargetEnterRef={onRingTargetEnterRef}
              onRingTargetClickRef={onRingTargetClickRef}
              onRingTargetLeaveRef={onRingTargetLeaveRef}
              projectorLayoutProfile={projectorLayoutProfile}
            />
          </group>
          <ArchitectureProjectionSpace
            simulationRef={architectureSimulationRef}
            miniObjSalienceRef={miniObjSalienceRef}
            thetaBandSnapshotsRef={thetaBandSnapshotsRef}
            simEnabled={architectureSimEnabled}
            displayMode={architectureDisplayMode}
            renderOptions={architectureRenderOptions}
            summaryRef={architectureSummaryRef}
            onSummaryUi={handleArchitectureSummaryUi}
            yCenter={ARCH_PROJECTION_CENTER_Y + MINI_OBJECT_LAYER_Y_LIFT}
            layerGap={ARCH_PROJECTION_LAYER_GAP}
            tetherRadius={CYLINDER_TETHER_RADIUS}
            miniObjectCount={MINI_OBJECT_COUNT}
            projectorY={CYLINDER_Y_OFFSET + CYLINDER_ROTATOR_GAP * 0.5 + MINI_OBJECT_LAYER_Y_LIFT}
            projectorRadius={PROJECTOR_RING_RADIUS}
            projectorThetas={miniObjectRoutingThetas}
            projectorLayoutProfile={projectorLayoutProfile}
          />
          <group scale={[WAVEGUIDE_SCALE_XZ, WAVEGUIDE_SCALE_Y, WAVEGUIDE_SCALE_XZ]}>
            <WaveguideField
              position={new THREE.Vector3(0, WAVEGUIDE_Y_OFFSET, 0)}
              colorPalette={centerField.colorPalette}
              isSelected={true}
              concaveDownFactor={waveguideConcaveDownFactor}
              bristles={bristles}
            />
          </group>
          </group>
        )}
      </group>

      {/* Film-strip rim on lower-inner band */}
      <group ref={bristleGroupRef} onDoubleClick={handleRimClick}>
        {rimStrips.map((s) => (
          <group
            key={s.sourceIndex}
            position={s.position}
            rotation={[RIM_RING_INVERT_X, s.rotationY, 0]}
            onClick={sceneRegime === "orbit" ? (e) => handleBristleClick(s.rimIndex, e) : undefined}
            onPointerEnter={sceneRegime === "orbit" ? (e) => handleBristlePointerEnter(s.rimIndex, e) : undefined}
            onPointerLeave={sceneRegime === "orbit" ? (e) => handleBristlePointerLeave(s.rimIndex, e) : undefined}
          >
            {/* Strip plane */}
            <mesh geometry={stripGeometry} material={stripMaterial} />

            {/* Bristle centered on strip, with scale + color from BristleSpec */}
            <mesh
              geometry={bristleGeometry}
              position={[0, 0.05, 0]}
              scale={[s.thicknessScale, s.lengthScale, s.thicknessScale]}
              userData={{
                bristleId: s.sourceIndex,
                ringIndex: s.rimIndex,
                theta: canonTheta(s.theta),
                tensolId: getQuadrantIdForBristle(s.sourceIndex),
              }}
            >
              <meshBasicMaterial color={s.color} />
            </mesh>
          </group>
        ))}
      </group>

      {sceneRegime === "dock" && (
        <group position={dockAnchor.center} quaternion={dockAnchor.quaternion}>
          {[
            { cellIndex: 0, local: [-0.62, 0.62] as [number, number] },
            { cellIndex: 1, local: [0.62, 0.62] as [number, number] },
            { cellIndex: 2, local: [-0.62, -0.62] as [number, number] },
            { cellIndex: 3, local: [0.62, -0.62] as [number, number] },
          ].map(({ cellIndex, local }) => {
            const bristleId = getCellBristleId(cellIndex)
            const cellPanelText = solutionPanelText[cellIndex] ?? ""
            const hasPanelText = cellPanelText.trim().length > 0
            const energy = getBristleEnergy(bristleId)
            const selected = dockSelectedBristleId === bristleId
            const energyGlow = Math.min(1, energy * 0.65)
            const pulse = selected ? 1.035 : 1
            const planeOpacity = selected ? 0.92 : 0.42
            const baseScale = selected ? 1.12 : 0.9
            const zOffset = selected ? 0.07 : -0.04
            return (
              <group key={`plastic-cell-${cellIndex}`} position={[local[0], local[1], zOffset]} scale={[baseScale * pulse, baseScale * pulse, 1]}>
                <mesh
                  onPointerEnter={(event) => handleGridCellEnter(cellIndex, event)}
                  onPointerLeave={(event) => handleGridCellLeave(cellIndex, event)}
                  onPointerMove={(event) => handleGridCellMove(cellIndex, event)}
                  onClick={(event) => handleGridCellClick(cellIndex, event)}
                >
                  <planeGeometry args={[1.1, 1.1]} />
                  <meshBasicMaterial
                    map={gridTexture ?? undefined}
                    color={new THREE.Color(0.85 + energyGlow * 0.15, 0.7 + energyGlow * 0.2, 0.45 + energyGlow * 0.25)}
                    transparent
                    opacity={planeOpacity}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh position={[0, 0, 0.01]}>
                  <planeGeometry args={[1.1, 1.1]} />
                  <meshBasicMaterial
                    color={new THREE.Color(1.0, 0.68 + energyGlow * 0.2, 0.28)}
                    transparent
                    opacity={Math.min(0.62, 0.12 + energyGlow * 0.4)}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh position={[0, 0, 0.08]} rotation={[0, 0, Math.PI * 0.25]} renderOrder={500}>
                  <planeGeometry args={[1.75, 0.2]} />
                  <meshBasicMaterial
                    color={new THREE.Color(1, 0, 0)}
                    transparent
                    opacity={hasPanelText ? 0.08 : 1}
                    depthTest={false}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh position={[0, 0, 0.08]} rotation={[0, 0, -Math.PI * 0.25]} renderOrder={500}>
                  <planeGeometry args={[1.75, 0.2]} />
                  <meshBasicMaterial
                    color={new THREE.Color(1, 0, 0)}
                    transparent
                    opacity={hasPanelText ? 0.08 : 1}
                    depthTest={false}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh position={[0, 0, 0.03]}>
                  <planeGeometry args={[1.04, 1.04]} />
                  <meshBasicMaterial
                    color={new THREE.Color(0.06, 0.07, 0.1)}
                    transparent
                    opacity={hasPanelText ? 0.72 : 0.24}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
                {hasPanelText && (
                  <group position={[0, 0, 0.04]}>
                    <BristleTextPanel
                      text={cellPanelText}
                      width={0.92}
                      height={0.92}
                      color={new THREE.Color(0.96, 0.93, 0.88)}
                    />
                  </group>
                )}
              </group>
            )
          })}
        </group>
      )}

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
      {showQuadrantOutline && (
        <QuadrantBorders
          y={quadrantPlaneY}
          innerRadius={quadrantSectionInnerRadius}
          outerRadius={quadrantSectionOuterRadius}
          domeRadius={domeRadius}
          domeCenterY={domeCenterY}
          surfaceOffset={0.03}
          color={new THREE.Color(0.85, 0.38, 0.26)}
          opacity={0.92}
        />
      )}

      {/* Quadrant substrate targets designated by angle space. */}
      {showSubstrateTargets && quadrantSubstrateTargets.map((target) => (
        <group
          key={target.meshTag}
          position={target.worldPosition}
          quaternion={target.worldQuaternion}
          scale={(() => {
            const salience = miniObjSalienceRef.current[target.quadrantId] ?? (1 / MINI_OBJECT_COUNT)
            const gain = 1 + salience * 0.28
            return [gain, gain, 1] as [number, number, number]
          })()}
          onClick={(event) => handleQuadrantSubstrateToggle(target.quadrantId, event)}
        >
          <mesh position={[0, 0, 0.005]} renderOrder={500}>
            <ringGeometry args={[0.2, 0.34, 32]} />
            <meshBasicMaterial
              color={new THREE.Color(0.93, 0.89, 0.84)}
              transparent
              opacity={0.58 + Math.min(0.34, (miniObjSalienceRef.current[target.quadrantId] ?? (1 / MINI_OBJECT_COUNT)) * 0.44)}
              depthTest={false}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[0, 1, 2, 3].map((segment) => (
            <mesh key={`${target.meshTag}-seg-${segment}`} position={[0, 0, 0.015]} renderOrder={540}>
              <ringGeometry args={[0.03, 0.18, 10, 1, segment * (Math.PI * 0.5), Math.PI * 0.5]} />
              <meshBasicMaterial
                color={
                  segment === target.substrateIndex
                    ? new THREE.Color(1.0, 0.38, 0.24)
                    : new THREE.Color(0.86, 0.8, 0.76)
                }
                transparent
                opacity={segment === target.substrateIndex ? 0.92 : 0.45}
                depthTest={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {Array.from({ length: 8 }).map((_, tickIndex) => {
            const a = (tickIndex / 8) * Math.PI * 2
            const x = Math.cos(a) * 0.26
            const y = Math.sin(a) * 0.26
            return (
              <mesh key={`${target.meshTag}-tick-${tickIndex}`} position={[x, y, 0.02]} rotation={[0, 0, a]}>
                <planeGeometry args={[0.08, 0.012]} />
                <meshBasicMaterial
                  color={new THREE.Color(0.95, 0.91, 0.86)}
                  transparent
                  opacity={0.62}
                  depthTest={false}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )
          })}
        </group>
      ))}
      {showSubstrateTargets && quadrantInterstitialTargets.map((target) => {
        const leftSalience = miniObjSalienceRef.current[target.leftQuadrantId] ?? (1 / MINI_OBJECT_COUNT)
        const rightSalience = miniObjSalienceRef.current[target.rightQuadrantId] ?? (1 / MINI_OBJECT_COUNT)
        const blendedSalience = (leftSalience + rightSalience) * 0.5
        return (
          <group
            key={target.meshTag}
            position={target.worldPosition}
            quaternion={target.worldQuaternion}
            scale={[1 + blendedSalience * 0.22, 1 + blendedSalience * 0.22, 1]}
            onClick={(event) =>
              handleInterstitialSubstrateToggle(target.leftQuadrantId, target.rightQuadrantId, event)
            }
          >
            <mesh position={[0, 0, 0.005]} renderOrder={498}>
              <ringGeometry args={[0.1, 0.2, 24]} />
              <meshBasicMaterial
                color={new THREE.Color(0.92, 0.87, 0.82)}
                transparent
                opacity={0.48 + Math.min(0.34, blendedSalience * 0.5)}
                depthTest={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0, 0.018]} renderOrder={499}>
              <ringGeometry args={[0.04, 0.09, 20]} />
              <meshBasicMaterial
                color={new THREE.Color(1.0, 0.4, 0.24)}
                transparent
                opacity={0.34 + Math.min(0.46, blendedSalience * 0.56)}
                depthTest={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}

      {showQuadrantViewport && (
        <>
          {/* Quadrant object as a 4-part viewport (absorbs per-quadrant viewport behavior) */}
          <Html
            position={[0, quadrantPlaneY, 0]}
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

      {/* Log Status HUD */}
      {showLogStatus && (
        <Html position={[-domeRadius * 0.7, domeRadius * 0.62 * verticalDirection, 0]}>
          <div
            style={{
              pointerEvents: "none",
              userSelect: "none",
              minWidth: "186px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(8, 10, 14, 0.84)",
              backdropFilter: "blur(4px)",
              padding: "8px 10px",
              color: "rgba(240,240,240,0.95)",
              fontSize: "11px",
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>Log Status</div>
            <div>Session: {sessionIdRef.current.slice(-8)}</div>
            <div>Buffered: {logBufferRef.current.length}</div>
            <div>Pending: {pendingLogCount}</div>
            <div style={{ color: logFlushColor }}>
              Flush: {logFlushState.status} ({logFlushState.lastCount}) @ {logFlushLabel}
            </div>
            {logFlushState.message && (
              <div style={{ color: "rgba(210,210,210,0.82)" }}>{logFlushState.message}</div>
            )}
          </div>
        </Html>
      )}

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

      <MemoToolbarHud3D
        isOpen={isToolbarOpen}
        setIsOpen={setIsToolbarOpen}
        showQuadrantViewport={showQuadrantViewport}
        setShowQuadrantViewport={setShowQuadrantViewport}
        showQuadrantOutline={showQuadrantOutline}
        setShowQuadrantOutline={setShowQuadrantOutline}
        showConflictMeter={showConflictMeter}
        setShowConflictMeter={setShowConflictMeter}
        showPlasticity={showPlasticityPanel}
        setShowPlasticity={setShowPlasticityPanel}
        showLogStatus={showLogStatus}
        setShowLogStatus={setShowLogStatus}
        isDockMode={sceneRegime === "dock"}
        onToggleDockMode={() => {
          if (sceneRegime === "dock") {
            exitDockRegime()
          } else {
            enterDockRegime(activeSelectedBristleId ?? 0)
          }
        }}
        architectureDisplayMode={architectureDisplayMode}
        setArchitectureDisplayMode={setArchitectureDisplayMode}
        projectorLayoutProfile={projectorLayoutProfile}
        setProjectorLayoutProfile={setProjectorLayoutProfile}
        architectureSimEnabled={architectureSimEnabled}
        setArchitectureSimEnabled={setArchitectureSimEnabled}
        architectureRenderOptions={architectureRenderOptions}
        setArchitectureRenderOptions={setArchitectureRenderOptions}
        architectureSummary={architectureSummaryUi}
        showBadges={showToolbarBadges}
        setShowBadges={setShowToolbarBadges}
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
