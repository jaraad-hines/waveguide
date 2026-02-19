// bristleLayout.ts
import * as THREE from "three"

export interface BristleSpec {
  circularPosition: [number, number, number]
  flatPosition: [number, number, number]
  rotation: [number, number, number]
  flatRotation: [number, number, number]
  scale: [number, number, number]
  index: number
  angle: number
  sequentialIndex: number
}

export const TAU = Math.PI * 2

export function canonTheta(theta: number) {
  return ((theta % TAU) + TAU) % TAU
}

export interface BristleMeta {
  id: number
  ringIndex: number
  theta: number
  tensolId: number
  tensolSlot: 0 | 1 | 2 | 3
  prev: number
  next: number
}

export interface BristleMetaContext {
  ordered: BristleMeta[]
  byId: Map<number, BristleMeta>
  idByRingIndex: number[]
  ringIndexById: Map<number, number>
  tensolMembersById: Map<number, number[]>
}

export function buildBristleMeta(
  bristles: BristleSpec[],
  tensolSize = 4
): BristleMetaContext {
  const sorted = bristles
    .map((b) => ({ id: b.index, theta: canonTheta(b.angle) }))
    .sort((a, b) => a.theta - b.theta)

  const ordered: BristleMeta[] = []
  const byId = new Map<number, BristleMeta>()
  const idByRingIndex: number[] = []
  const ringIndexById = new Map<number, number>()
  const tensolMembersById = new Map<number, number[]>()

  const total = sorted.length
  for (let ringIndex = 0; ringIndex < total; ringIndex += 1) {
    const source = sorted[ringIndex]
    const tensolId = Math.floor(ringIndex / tensolSize)
    const tensolSlot = (ringIndex % tensolSize) as 0 | 1 | 2 | 3
    const meta: BristleMeta = {
      id: source.id,
      ringIndex,
      theta: source.theta,
      tensolId,
      tensolSlot,
      prev: (ringIndex - 1 + total) % total,
      next: (ringIndex + 1) % total,
    }
    ordered.push(meta)
    byId.set(meta.id, meta)
    idByRingIndex[ringIndex] = meta.id
    ringIndexById.set(meta.id, ringIndex)
    const members = tensolMembersById.get(tensolId) ?? []
    members.push(meta.id)
    tensolMembersById.set(tensolId, members)
  }

  return {
    ordered,
    byId,
    idByRingIndex,
    ringIndexById,
    tensolMembersById,
  }
}

export function createWaveguideBristles(): BristleSpec[] {
  const beamArray: BristleSpec[] = []
  const rows = 16
  const beamsPerRow = 80

  for (let row = 0; row < rows; row++) {
    const rowProgress = row / (rows - 1)
    const radius = 2.5 + rowProgress * 2

    for (let i = 0; i < beamsPerRow; i++) {
      const angle = (i / beamsPerRow) * Math.PI * 2

      const circularX = Math.sin(angle) * radius
      const circularZ = Math.cos(angle) * radius
      const circularY = (Math.random() - 0.5) * 0.3

      const flatX = (i / beamsPerRow) * 20 - 10
      const flatY = circularY
      const flatZ = (row / rows) * 8 - 4

      const rotationY = -angle
      const rotationZ = (Math.random() - 0.5) * 0.2

      const length = 2.5 + Math.random() * 1.5
      const thickness = 0.03 + Math.random() * 0.02

      // Determine which quadrant (0-3) based on angle
      const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const quadrant = Math.floor((normalizedAngle / (Math.PI * 2)) * 4)

      // Position within the quadrant
      const angleInQuadrant = normalizedAngle - quadrant * Math.PI * 0.5
      const progressInQuadrant = angleInQuadrant / (Math.PI * 0.5)
      const positionInQuadrant = Math.floor(progressInQuadrant * (beamsPerRow / 4))

      // Sequential index: quadrant order + position within quadrant + row offset
      const bristlesPerQuadrant = beamsPerRow / 4
      const sequentialIndex = quadrant * bristlesPerQuadrant + positionInQuadrant + row * beamsPerRow
      const globalIndex = i + row * beamsPerRow

      beamArray.push({
        circularPosition: [circularX, circularY, circularZ],
        flatPosition: [flatX, flatY, flatZ],
        rotation: [0, rotationY, rotationZ],
        flatRotation: [0, 0, rotationZ],
        scale: [thickness, length, thickness],
        index: globalIndex,
        angle,
        sequentialIndex,
      })
    }
  }

  return beamArray
}

