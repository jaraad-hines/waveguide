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

export function computeRotaryEncoderFrame(params: RotaryEncoderParams): RotaryEncoderFrame {
  const {
    field,
    bandCount,
    miniObjectCount,
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
  const squadSnapshots: RotarySquadSnapshot[] = squads.map(([squadId], index) => ({
    squadId,
    score: squadScores[index],
    level: squadClassification.levels[index],
    miniObjId: squadId % miniObjectCount,
    anchorBristleId: squadAnchorBristles[index],
  }))

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
    const miniObjId = squadById.get(nearestSquadId)?.miniObjId ?? (nearestSquadId % miniObjectCount)
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
