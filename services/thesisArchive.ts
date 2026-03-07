export type ThesisArchiveMode = "tuning" | "promotion"

export type ThesisArchiveEntry = {
  id: string
  title: string
  createdAt: string
  kind: "thesis" | "notebook_snapshot"
  interpreter: string
  mode: ThesisArchiveMode
  stage: string
  dominantTerm: string
  confidence: number
  divergence: number
  excerpt: string
  sourceTitle: string
  sourceBody: string
  composerConfig?: string
  generatedOutput?: string
  buildArtifact?: string
}

export function createThesisArchiveEntry({
  sourceText,
  interpreter,
  mode,
  stage,
  dominantTerm,
  confidence,
  divergence,
  composerConfig,
  generatedOutput,
  buildArtifact,
}: {
  sourceText: string
  interpreter: string
  mode: ThesisArchiveMode
  stage: string
  dominantTerm: string
  confidence: number
  divergence: number
  composerConfig?: string
  generatedOutput?: string
  buildArtifact?: string
}): ThesisArchiveEntry {
  const titleSeed = dominantTerm && dominantTerm !== "No dominant term" ? dominantTerm : "Untitled thesis"
  return {
    id: `${Date.now()}-${Math.round(confidence * 1000)}`,
    title: `Thesis: ${titleSeed}`,
    createdAt: new Date().toLocaleString(),
    kind: "thesis",
    interpreter,
    mode,
    stage,
    dominantTerm: titleSeed,
    confidence,
    divergence,
    excerpt: sourceText.slice(0, 140),
    sourceTitle: `Recovered thesis: ${titleSeed}`,
    sourceBody: sourceText,
    composerConfig,
    generatedOutput,
    buildArtifact,
  }
}

export function createSeedThesisLibrary(): ThesisArchiveEntry[] {
  return [
    {
      id: "seed-thesis-1",
      title: "Thesis: governed workflow",
      createdAt: "Seeded locally",
      kind: "thesis",
      interpreter: "workflow",
      mode: "tuning",
      stage: "validate",
      dominantTerm: "workflow",
      confidence: 0.68,
      divergence: 0.21,
      excerpt: "A baseline thesis seeded into the archive library for comparative replay and tuning.",
      sourceTitle: "Recovered thesis: governed workflow",
      sourceBody: "A baseline thesis seeded into the archive library for comparative replay and tuning.",
      composerConfig: "stage=validate; mergeMode=consensus; outputIntent=workflow",
      generatedOutput: "A baseline generated output seeded into the archive library for replay.",
      buildArtifact: '{"artifactType":"decision_brief","readinessScore":0.62}',
    },
  ]
}

export function buildThesisTitle(mode: ThesisArchiveMode, dominantTerm: string) {
  const prefix = mode === "tuning" ? "Tuning thesis" : "Promoted thesis"
  return `${prefix}: ${dominantTerm}`
}
