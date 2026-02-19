import { canonTheta, type BristleMetaContext } from "../components/bristleLayout"

type SalienceLevel = "low" | "medium" | "high"

export type RotaryBandSnapshot = {
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

export type RotarySquadSnapshot = {
  squadId: number
  score: number
  level: SalienceLevel
  miniObjId: number
  anchorBristleId: number
}

export type RotaryCounts = {
  high: number
  medium: number
  low: number
}

export type RotaryRoutingTable = {
  byBandMiniObjId: number[]
  bySquadMiniObjId: Map<number, number>
  byBristleMiniObjId: Map<number, number>
}

export type RotaryEncoderFrame = {
  bandSnapshots: RotaryBandSnapshot[]
  squadSnapshots: RotarySquadSnapshot[]
  miniObjectSalience: number[]
  bandCounts: RotaryCounts
  squadCounts: RotaryCounts
  routing: RotaryRoutingTable
}

export type RotaryEncoderParams = {
  field: Float32Array
  bandCount: number
  miniObjectCount: number
  miniObjectThetas?: number[]
  plasticThetaBins: number
  plasticRBins: number
  bristleMeta: BristleMetaContext
  scoreWeights?: {
    energy: number
    peak: number
    anchor: number
  }
}

export type RotaryTargetMode = "bristle" | "squad" | "band"

export type RotaryMotionIntent = {
  direction: 1 | -1
  velocityScale: number
  targetMode: RotaryTargetMode
  coarseSteps: number
  fineSteps: number
}

export type RotaryMotionParams = {
  deltaTheta: number
  omega: number
  targetMode: RotaryTargetMode
}

export type RotaryFrameSample = {
  t: number
  bandCounts: RotaryCounts
  squadCounts: RotaryCounts
  miniObjectSalience: number[]
}

export type RotaryFrameStore = {
  push: (sample: RotaryFrameSample) => void
  latest: () => RotaryFrameSample | null
  range: (limit?: number) => RotaryFrameSample[]
  count: () => number
  clear: () => void
}

export type RotaryArchitectureTier = "core" | "sub" | "detail"

export type RotaryArchitectureSimulationId = "isp_3d_hybrid_reference" | "native_rotary_projection"

export type RotaryArchitectureTemplate = {
  id: string
  label: string
  tier: RotaryArchitectureTier
  weight: number
  description: string
}

export type RotaryArchitectureNode = RotaryArchitectureTemplate & {
  salience: number
  miniObjId: number
  bandIndices: number[]
  bristleIds: number[]
}

export type RotaryArchitectureSimulation = {
  id: RotaryArchitectureSimulationId
  title: string
  problem: string
  reasoning: string
  budgets: { core: number; sub: number; detail: number }
  nodes: RotaryArchitectureNode[]
}

export const ROTARY_ARCHITECTURE_TEMPLATE_LIBRARY: Record<RotaryArchitectureSimulationId, RotaryArchitectureTemplate[]> = {
  isp_3d_hybrid_reference: [
    { id: "isp_logic_core", label: "ISP Logic Core", tier: "core", weight: 0.26, description: "Primary pixel pipeline compute plane" },
    { id: "dram_3d_stack", label: "3D-DRAM Stack", tier: "core", weight: 0.3, description: "High-capacity, low-access-energy local stack" },
    { id: "sram_3d_slice", label: "3D-SRAM Slice", tier: "core", weight: 0.2, description: "Low-latency hot-set cache tier" },
    { id: "hybrid_arbiter", label: "Hybrid Arbiter", tier: "core", weight: 0.24, description: "Partition controller across SRAM/DRAM tiers" },
    { id: "lpddr_spill", label: "LPDDR Spill", tier: "sub", weight: 0.22, description: "Off-chip fallback traffic lane" },
    { id: "snapshot_buffer", label: "Snapshot Buffer", tier: "sub", weight: 0.18, description: "Burst frame staging for 2MP/12MP capture" },
    { id: "compressor_frontend", label: "Compression Frontend", tier: "sub", weight: 0.17, description: "Compression path to reduce footprint" },
    { id: "tsv_fabric", label: "TSV Fabric", tier: "sub", weight: 0.23, description: "Vertical interconnect transport mesh" },
    { id: "dram_scheduler", label: "DRAM Scheduler", tier: "sub", weight: 0.2, description: "Access ordering and burst packing control" },
    { id: "leakage_guard", label: "Leakage Guard", tier: "detail", weight: 0.34, description: "SRAM leakage mitigation policy" },
    { id: "bandwidth_qos", label: "Bandwidth QoS", tier: "detail", weight: 0.33, description: "QoS shaping for ISP/CV/ML contention" },
    { id: "power_budget_gate", label: "Power Budget Gate", tier: "detail", weight: 0.33, description: "Budget lock for wearable thermal envelope" },
  ],
  native_rotary_projection: [
    { id: "rotary_router_core", label: "Rotary Router Core", tier: "core", weight: 0.28, description: "Encoder-driven routing kernel" },
    { id: "band_beamformer", label: "Band Beamformer", tier: "core", weight: 0.24, description: "Directional lobe synthesis from theta bands" },
    { id: "miniobj_splitter_bank", label: "Mini-Object Splitter Bank", tier: "core", weight: 0.24, description: "Distributed splitter/output bank" },
    { id: "salience_allocator", label: "Salience Allocator", tier: "core", weight: 0.24, description: "Core/sub/detail resource budget allocator" },
    { id: "squad_router", label: "Squad Router", tier: "sub", weight: 0.2, description: "4-bristle squad switching and fanout" },
    { id: "bristle_router", label: "Bristle Router", tier: "sub", weight: 0.2, description: "Fine-grain bristle endpoint control" },
    { id: "interstitial_coupler", label: "Interstitial Coupler", tier: "sub", weight: 0.2, description: "Gap-coupled adjacent port handoff" },
    { id: "substrate_bias_controller", label: "Substrate Bias Controller", tier: "sub", weight: 0.2, description: "Local bias actuation for regional routing" },
    { id: "reflective_projector_bus", label: "Projector Mirror Bus", tier: "sub", weight: 0.2, description: "Mini-object beam projection mirror plane" },
    { id: "fps_frame_store", label: "FPS Frame Store", tier: "detail", weight: 0.34, description: "Frame sample storage/retrieval" },
    { id: "native_qos_scheduler", label: "Native QoS Scheduler", tier: "detail", weight: 0.33, description: "Priority shaping across target modes" },
    { id: "jitter_damper", label: "Jitter Damper", tier: "detail", weight: 0.33, description: "Stability policy for smooth directional control" },
  ],
}

function tierBudgetsForSimulation(simulationId: RotaryArchitectureSimulationId) {
  if (simulationId === "isp_3d_hybrid_reference") {
    return { core: 0.64, sub: 0.24, detail: 0.12 }
  }
  return { core: 0.56, sub: 0.3, detail: 0.14 }
}

function simulationMetadata(simulationId: RotaryArchitectureSimulationId) {
  if (simulationId === "isp_3d_hybrid_reference") {
    return {
      title: "3D-Stacked ISP Hybrid Projection",
      problem: "ISP memory wall dominated by expensive off-chip DRAM dynamic power and large footprint demands.",
      reasoning:
        "Projects a reference 3D-SRAM/3D-DRAM hybrid hierarchy where core salience is concentrated on local stacked memory and hybrid arbitration.",
    }
  }
  return {
    title: "Native Rotary Waveguide Projection",
    problem: "Need a memoryless, encoder-driven routing architecture that remains stable while allocating directional resources.",
    reasoning:
      "Projects native splitter/beamforming architecture where mini objects act as addressable routing endpoints and bias actuators for bristle/squad/band control.",
  }
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

function classifyPercentiles(scores: number[]): { levels: SalienceLevel[]; counts: RotaryCounts } {
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
    if (i < highCountTarget) levels[index] = "high"
    else if (i < highCountTarget + mediumCountTarget) levels[index] = "medium"
    else levels[index] = "low"
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

function thetaToBin(theta: number, plasticThetaBins: number) {
  const normalized = canonTheta(theta)
  return Math.max(0, Math.min(plasticThetaBins - 1, Math.floor((normalized / (Math.PI * 2)) * plasticThetaBins)))
}

function nearestBristleByTheta(bristleMeta: BristleMetaContext, theta: number) {
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
  const right = ordered[wrap(low)]
  const left = ordered[wrap(low - 1)]
  const circularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
  return circularDistance(theta, right.theta) <= circularDistance(theta, left.theta) ? right : left
}

function nearestMiniObjectByTheta(theta: number, miniObjectThetas: number[]) {
  if (miniObjectThetas.length === 0) return -1
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < miniObjectThetas.length; index += 1) {
    const distance = Math.abs(Math.atan2(Math.sin(theta - miniObjectThetas[index]), Math.cos(theta - miniObjectThetas[index])))
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function resolveMiniObjectIndexByTheta(
  theta: number,
  miniObjectThetas: number[],
  fallbackIndex: number,
  miniObjectCount: number
) {
  if (miniObjectThetas.length > 0) {
    const nearest = nearestMiniObjectByTheta(theta, miniObjectThetas)
    if (nearest >= 0) return nearest
  }
  return ((fallbackIndex % miniObjectCount) + miniObjectCount) % miniObjectCount
}

export function computeRotaryEncoderFrame(params: RotaryEncoderParams): RotaryEncoderFrame {
  const {
    field,
    bandCount,
    miniObjectCount,
    miniObjectThetas = [],
    plasticThetaBins,
    plasticRBins,
    bristleMeta,
    scoreWeights = { energy: 0.55, peak: 0.3, anchor: 0.15 },
  } = params

  const ordered = bristleMeta.ordered
  if (ordered.length === 0 || bandCount <= 0 || miniObjectCount <= 0) {
    return {
      bandSnapshots: [],
      squadSnapshots: [],
      miniObjectSalience: [],
      bandCounts: { high: 0, medium: 0, low: 0 },
      squadCounts: { high: 0, medium: 0, low: 0 },
      routing: {
        byBandMiniObjId: [],
        bySquadMiniObjId: new Map(),
        byBristleMiniObjId: new Map(),
      },
    }
  }

  const normalizedMiniObjectThetas = miniObjectThetas
    .slice(0, miniObjectCount)
    .map((theta) => canonTheta(theta))

  const squads = Array.from(bristleMeta.tensolMembersById.entries()).sort((a, b) => a[0] - b[0])
  const squadEnergy: number[] = []
  const squadPeak: number[] = []
  const squadAnchor: number[] = []
  const squadAnchorBristles: number[] = []

  for (const [, members] of squads) {
    let energy = 0
    let peak = 0
    const anchorBristleId = members[0] ?? (bristleMeta.idByRingIndex[0] ?? 0)
    for (const bristleId of members) {
      const meta = bristleMeta.byId.get(bristleId)
      const theta = meta?.theta ?? 0
      const thetaBin = thetaToBin(theta, plasticThetaBins)
      let bristleEnergy = 0
      let bristlePeak = 0
      for (let r = 0; r < plasticRBins; r += 1) {
        const value = Math.max(0, field[r * plasticThetaBins + thetaBin])
        bristleEnergy += value
        if (value > bristlePeak) bristlePeak = value
      }
      energy += bristleEnergy
      if (bristlePeak > peak) peak = bristlePeak
    }
    const anchorTheta = bristleMeta.byId.get(anchorBristleId)?.theta ?? 0
    const anchorThetaBin = thetaToBin(anchorTheta, plasticThetaBins)
    let anchor = 0
    for (let r = 0; r < plasticRBins; r += 1) {
      anchor += Math.max(0, field[r * plasticThetaBins + anchorThetaBin])
    }
    squadEnergy.push(energy)
    squadPeak.push(peak)
    squadAnchor.push(anchor)
    squadAnchorBristles.push(anchorBristleId)
  }

  const eNorm = normalizeMetric(squadEnergy)
  const pNorm = normalizeMetric(squadPeak)
  const anchorNorm = normalizeMetric(squadAnchor)
  const squadScores = squads.map(
    (_, index) =>
      scoreWeights.energy * eNorm[index] +
      scoreWeights.peak * pNorm[index] +
      scoreWeights.anchor * anchorNorm[index]
  )

  const squadClassification = classifyPercentiles(squadScores)
  const squadSnapshots: RotarySquadSnapshot[] = squads.map(([squadId], index) => {
    const anchorTheta = bristleMeta.byId.get(squadAnchorBristles[index])?.theta ?? 0
    const fallbackMiniObjId = squadId % miniObjectCount
    const miniObjId = resolveMiniObjectIndexByTheta(
      anchorTheta,
      normalizedMiniObjectThetas,
      fallbackMiniObjId,
      miniObjectCount
    )
    return {
      squadId,
      score: squadScores[index],
      level: squadClassification.levels[index],
      miniObjId,
      anchorBristleId: squadAnchorBristles[index],
    }
  })

  const squadById = new Map<number, RotarySquadSnapshot>()
  const bySquadMiniObjId = new Map<number, number>()
  const byBristleMiniObjId = new Map<number, number>()
  for (const snapshot of squadSnapshots) {
    squadById.set(snapshot.squadId, snapshot)
    bySquadMiniObjId.set(snapshot.squadId, snapshot.miniObjId)
    const bristles = bristleMeta.tensolMembersById.get(snapshot.squadId) ?? []
    for (const bristleId of bristles) {
      byBristleMiniObjId.set(bristleId, snapshot.miniObjId)
    }
  }

  const miniTotals = Array.from({ length: miniObjectCount }, () => 0)
  const bandSnapshots: RotaryBandSnapshot[] = []
  const byBandMiniObjId: number[] = []
  let totalScore = 0
  const squadCount = squadSnapshots.length

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const thetaStart = (bandIndex / bandCount) * Math.PI * 2
    const thetaEnd = ((bandIndex + 1) / bandCount) * Math.PI * 2
    const thetaCenter = canonTheta((thetaStart + thetaEnd) * 0.5)
    const nearest = nearestBristleByTheta(bristleMeta, thetaCenter) ?? ordered[0]
    const nearestSquadId = nearest.tensolId
    const bandSquadStart = Math.floor((bandIndex * squadCount) / bandCount)
    const bandSquadEnd = Math.max(bandSquadStart + 1, Math.floor(((bandIndex + 1) * squadCount) / bandCount))
    const nearestBandSquadOffset = Math.max(
      0,
      Math.min(bandSquadEnd - bandSquadStart - 1, nearestSquadId - bandSquadStart)
    )

    let score = 0
    let scoreCount = 0
    let anchorBristleId = nearest.id
    for (let squadCursor = bandSquadStart; squadCursor < bandSquadEnd; squadCursor += 1) {
      const squad = squadById.get(squadCursor)
      if (!squad) continue
      score += squad.score
      scoreCount += 1
      if (squadCursor === bandSquadStart + nearestBandSquadOffset) {
        anchorBristleId = squad.anchorBristleId
      }
    }
    if (scoreCount > 0) score /= scoreCount
    const fallbackMiniObjId = squadById.get(nearestSquadId)?.miniObjId ?? (nearestSquadId % miniObjectCount)
    const miniObjId = resolveMiniObjectIndexByTheta(
      thetaCenter,
      normalizedMiniObjectThetas,
      fallbackMiniObjId,
      miniObjectCount
    )
    totalScore += score
    miniTotals[miniObjId] += score
    byBandMiniObjId[bandIndex] = miniObjId
    bandSnapshots.push({
      bandIndex,
      thetaStart,
      thetaEnd,
      thetaCenter,
      score,
      level: "low",
      miniObjId,
      quadrantId: miniObjId,
      squadId: nearestSquadId,
      anchorBristleId,
    })
  }

  const bandScores = bandSnapshots.map((snapshot) => snapshot.score)
  const bandClassification = classifyPercentiles(bandScores)
  for (let i = 0; i < bandSnapshots.length; i += 1) {
    bandSnapshots[i].level = bandClassification.levels[i]
  }

  const miniObjectSalience =
    totalScore > 1e-9
      ? miniTotals.map((value) => value / totalScore)
      : Array.from({ length: miniObjectCount }, () => 1 / miniObjectCount)

  return {
    bandSnapshots,
    squadSnapshots,
    miniObjectSalience,
    bandCounts: bandClassification.counts,
    squadCounts: squadClassification.counts,
    routing: {
      byBandMiniObjId,
      bySquadMiniObjId,
      byBristleMiniObjId,
    },
  }
}

export function simulateRotaryArchitecture(
  frame: RotaryEncoderFrame,
  simulationId: RotaryArchitectureSimulationId
): RotaryArchitectureSimulation {
  const templates = ROTARY_ARCHITECTURE_TEMPLATE_LIBRARY[simulationId]
  const budgets = tierBudgetsForSimulation(simulationId)
  const meta = simulationMetadata(simulationId)
  const miniObjectCount = Math.max(1, frame.miniObjectSalience.length || 1)
  const bandIndicesByPort = Array.from({ length: miniObjectCount }, () => [] as number[])
  const bristleIdsByPort = Array.from({ length: miniObjectCount }, () => [] as number[])
  for (const snapshot of frame.bandSnapshots) {
    const port = snapshot.miniObjId % miniObjectCount
    bandIndicesByPort[port].push(snapshot.bandIndex)
    if (!bristleIdsByPort[port].includes(snapshot.anchorBristleId)) {
      bristleIdsByPort[port].push(snapshot.anchorBristleId)
    }
  }

  const tierTotals: Record<RotaryArchitectureTier, number> = { core: 0, sub: 0, detail: 0 }
  for (const template of templates) {
    tierTotals[template.tier] += template.weight
  }

  const budgetByTier: Record<RotaryArchitectureTier, number> = {
    core: budgets.core,
    sub: budgets.sub,
    detail: budgets.detail,
  }

  const nodesDraft = templates.map((template) => {
    const tierTotal = Math.max(1e-9, tierTotals[template.tier])
    const salience = budgetByTier[template.tier] * (template.weight / tierTotal)
    return {
      ...template,
      salience,
      miniObjId: 0,
      bandIndices: [] as number[],
      bristleIds: [] as number[],
    }
  })

  const portRemaining = (frame.miniObjectSalience.length > 0 ? frame.miniObjectSalience : [1]).map(
    (value) => Math.max(0.08, value)
  )
  const nodesSorted = [...nodesDraft].sort((a, b) => b.salience - a.salience)
  for (const node of nodesSorted) {
    let bestPort = 0
    let bestRemaining = Number.NEGATIVE_INFINITY
    for (let port = 0; port < portRemaining.length; port += 1) {
      if (portRemaining[port] > bestRemaining) {
        bestRemaining = portRemaining[port]
        bestPort = port
      }
    }
    node.miniObjId = bestPort
    portRemaining[bestPort] -= node.salience * 0.85
  }

  for (let port = 0; port < miniObjectCount; port += 1) {
    const nodesOnPort = nodesDraft.filter((node) => node.miniObjId === port)
    if (nodesOnPort.length === 0) continue
    const totalWeight = nodesOnPort.reduce((sum, node) => sum + node.salience, 0)
    const bandList = bandIndicesByPort[port]
    const bristleList = bristleIdsByPort[port]
    let bandCursor = 0
    let bristleCursor = 0
    for (let i = 0; i < nodesOnPort.length; i += 1) {
      const node = nodesOnPort[i]
      const fraction = totalWeight > 1e-9 ? node.salience / totalWeight : 1 / nodesOnPort.length
      const bandTake =
        i === nodesOnPort.length - 1
          ? Math.max(0, bandList.length - bandCursor)
          : Math.max(1, Math.round(bandList.length * fraction))
      const bristleTake =
        i === nodesOnPort.length - 1
          ? Math.max(0, bristleList.length - bristleCursor)
          : Math.max(1, Math.round(bristleList.length * fraction))
      node.bandIndices = bandList.slice(bandCursor, bandCursor + bandTake)
      node.bristleIds = bristleList.slice(bristleCursor, bristleCursor + bristleTake)
      bandCursor += bandTake
      bristleCursor += bristleTake
    }
  }

  return {
    id: simulationId,
    title: meta.title,
    problem: meta.problem,
    reasoning: meta.reasoning,
    budgets,
    nodes: nodesDraft,
  }
}

export function interpretRotaryMotion(params: RotaryMotionParams): RotaryMotionIntent {
  const { deltaTheta, omega, targetMode } = params
  const direction: 1 | -1 = deltaTheta >= 0 ? 1 : -1
  const absOmega = Math.abs(omega)
  const velocityScale = absOmega < 0.25 ? 1 : absOmega < 1 ? 1.5 : absOmega < 2 ? 2.25 : 3
  const coarseSteps = Math.max(1, Math.round(Math.abs(deltaTheta) / (Math.PI / 12)))
  const fineSteps = Math.max(1, Math.round(coarseSteps * velocityScale))
  return {
    direction,
    velocityScale,
    targetMode,
    coarseSteps,
    fineSteps,
  }
}

export function createRotaryFrameStore(maxFrames = 900): RotaryFrameStore {
  const frames: RotaryFrameSample[] = []
  return {
    push(sample) {
      frames.push(sample)
      if (frames.length > maxFrames) {
        frames.splice(0, frames.length - maxFrames)
      }
    },
    latest() {
      return frames.length > 0 ? frames[frames.length - 1] : null
    },
    range(limit = frames.length) {
      if (limit <= 0) return []
      return frames.slice(Math.max(0, frames.length - limit))
    },
    count() {
      return frames.length
    },
    clear() {
      frames.splice(0, frames.length)
    },
  }
}
