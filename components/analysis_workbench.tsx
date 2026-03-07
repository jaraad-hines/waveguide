"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Archive, Boxes, ChevronDown, ChevronUp, Eye, FileOutput, Layers3, Moon, Plus, Radar, Sun, Trash2 } from "lucide-react"
import {
  buildThesisTitle,
  createSeedThesisLibrary,
  createThesisArchiveEntry,
  type ThesisArchiveEntry,
  type ThesisArchiveMode,
} from "../services/thesisArchive"

type InterpreterId = "raw" | "nlp" | "finance" | "music" | "governance" | "workflow" | "schema"
type OutputMode = "summary" | "draft" | "spec" | "json"
type ComposerStage = "define" | "compose" | "validate" | "launch"
type EditorPanel = "input" | "interpreter" | "composer" | "output" | "bridge" | "builder" | "builder_session" | "codegen" | "performance" | "archive" | "spatial"
type ArchiveFilter = "all" | "thesis" | "notebook_snapshot"
type ArchiveSort = "newest" | "oldest" | "mode"
type PromptInsertMode = "append" | "prepend" | "paragraph"
type InterpreterView = InterpreterId | "all"
type ArtifactType = "decision_brief" | "execution_plan" | "system_spec"
type CommandDefinition = {
  id: string
  label: string
  description: string
  token: string
  onSelect: () => void
}
type RunDirective = "output" | "bridge" | "builder" | "codegen" | "full"
type Block1Surface = {
  id: string
  body: string
  editable: boolean
}

type RankedToken = { token: string; score: number; role: string }
type AnalysisMetrics = {
  salience: number
  dominance: number
  confidence: number
  divergence: number
  persistence: number
  location: string
}
type InterpreterResult = {
  interpreter: InterpreterId
  label: string
  summary: string
  ranked: RankedToken[]
  tokens: string[]
  metrics: AnalysisMetrics
  entities: string[]
  actions: string[]
  constraints: string[]
  domainSignals: string[]
  risks: string[]
}
type ComposerMergeMode = "consensus" | "weighted"
type ComposerOutputIntent = "brief" | "spec" | "workflow"
type ComposerConfig = {
  stage: ComposerStage
  mergeMode: ComposerMergeMode
  outputIntent: ComposerOutputIntent
}
type ComposedThesis = {
  title: string
  summary: string
  recommendedStructure: string
  mergedEntities: string[]
  mergedActions: string[]
  mergedConstraints: string[]
  domainSignals: string[]
  unresolved: string[]
  confidence: number
  divergence: number
  interpreterSet: string[]
}
type GeneratedOutput = {
  title: string
  mode: OutputMode
  content: string
  generatedAt: string
}
type BuildArtifact = {
  id: string
  artifactType: ArtifactType
  title: string
  sourceThesis: string
  sourceSummary: string
  readinessScore: number
  interpreterSet: string[]
  composerConfig: ComposerConfig
  brief: string
  nextActions: string[]
  buildGraph: {
    entities: string[]
    actors: string[]
    constraints: string[]
    dependencies: string[]
    stages: string[]
  }
  productComponents: {
    data: string[]
    logic: string[]
    interface: string[]
    governance: string[]
    storage: string[]
  }
  machinePayload: {
    objective: string
    artifactType: ArtifactType
    entities: string[]
    actions: string[]
    constraints: string[]
    stages: string[]
    components: string[]
    unresolved: string[]
    implementationHints: string[]
  }
  domainModel: {
    entities: string[]
    instruments: string[]
    roles: string[]
    constraints: string[]
    regulation: {
      offeringRule: string | null
      fundExemption: string | null
      investorLimit: string | null
      accreditationPaths: string[]
    }
    risks: string[]
    assumptions: string[]
    missingCritical: string[]
    confidenceByField: Record<string, number>
  }
  buildContract: {
    contractVersion: string
    objective: string
    lanes: Array<{
      lane: "Data" | "Logic" | "Interface" | "Governance"
      deliverables: string[]
      acceptanceTests: string[]
    }>
    doneCriteria: string[]
  }
  bridge: {
    vectorChunks: string[]
    builderPrompt: string
    handoffStatus: "stage_1_embed" | "stage_2_expand" | "stage_3_ready"
  }
}
type ThesisBlock = {
  id: string
  thesisId: string
  title: string
  body: string
  status: "draft" | "analyzed" | "archived"
  statusUpdatedAt: string
}
type StatusNotice = { blockId: string; status: ThesisBlock["status"]; atLabel: string }
type BuilderTarget = "product_skeleton" | "schema" | "workflow" | "ui_shell"
type BridgeSubmission = {
  submittedAt: string
  artifactTitle: string
  taskGroups: {
    data: string[]
    logic: string[]
    interface: string[]
    governance: string[]
  }
}
type BuilderJob = {
  queuedAt: string
  target: BuilderTarget
  status: "queued" | "started"
  artifactTitle: string
  taskGroups: BridgeSubmission["taskGroups"]
}
type BuildSessionObject = {
  lane: "Data" | "Logic" | "Interface" | "Governance"
  title: string
  output: string
  deliverables: string[]
  files: string[]
}
type CodegenFileOutline = {
  file: string
  purpose: string
  sections: string[]
  snippet: string
}
type CodegenFileDraft = {
  file: string
  moduleName: string
  summary: string
  exports: string[]
  implementationNotes: string[]
  draft: string
}
type CommittedBuildModule = {
  id: string
  thesisId: string
  lane: BuildSessionObject["lane"]
  file: string
  moduleName: string
  summary: string
  exports: string[]
  implementationNotes: string[]
  draft: string
  sourceObjectTitle: string
  committedAt: string
}
type OutputTreeNode = {
  id: string
  thesisId: string
  blockId: string
  thesisTitle: string
  stage: "composer" | "output" | "bridge" | "builder" | "builder_session" | "codegen" | "archive"
  label: string
  detail: string
  at: string
}
type GAPanel = {
  id: string
  title: string
  bullets: string[]
}
type SavedThesisTree = {
  id: string
  thesisId: string
  blockId: string
  title: string
  savedAt: string
  fileName: string
  tree: {
    thesisId: string
    thesisTitle: string
    thesisBody: string
    outputMode: OutputMode
    nodes: OutputTreeNode[]
    generatedOutput: GeneratedOutput | null
    buildArtifact: BuildArtifact | null
    bridgeSubmission: BridgeSubmission | null
    builderJob: BuilderJob | null
    committedModules: CommittedBuildModule[]
  }
}

const BLOCKS_KEY = "analysis_workbench_thesis_blocks"
const SELECTED_KEY = "analysis_workbench_selected_block"
const ARCHIVE_KEY = "analysis_workbench_archive_library"
const BUILD_ARTIFACT_KEY = "analysis_workbench_build_artifact"
const BRIDGE_SUBMISSION_KEY = "analysis_workbench_bridge_submission"
const BUILDER_JOB_KEY = "analysis_workbench_builder_job"
const COMMITTED_MODULES_KEY = "analysis_workbench_committed_modules"
const OUTPUT_TREE_KEY = "analysis_workbench_output_tree"
const SAVED_THESIS_TREE_KEY = "analysis_workbench_saved_thesis_tree"
const THEME_MODE_KEY = "analysis_workbench_theme_mode"
const THESIS_BLOCK_1_BASELINE = "Create an invite-only private vehicle for trading event contracts and futures with a governed workflow."

function createBlock1Surfaces(seedBody = THESIS_BLOCK_1_BASELINE): Block1Surface[] {
  return [
    {
      id: "block1-surface-1",
      body: seedBody,
      editable: false,
    },
  ]
}

const baseCard: CSSProperties = {
  position: "relative",
  borderRadius: "30px",
  background: "var(--wg-card-bg)",
  boxShadow: "var(--wg-card-shadow)",
}

function shadowLayer(): CSSProperties {
  return {
    position: "absolute",
    inset: "10px -12px -12px 12px",
    borderRadius: "inherit",
    background: "var(--wg-card-shadow-layer)",
    zIndex: -1,
  }
}

function pill(active: boolean, warm = false): CSSProperties {
  return {
    borderRadius: "999px",
    background: active
      ? warm
        ? "var(--wg-pill-active-warm-bg)"
        : "var(--wg-pill-active-bg)"
      : "var(--wg-pill-bg)",
    color: "var(--wg-pill-fg)",
    padding: "10px 14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: active ? "var(--wg-pill-shadow-active)" : "var(--wg-pill-shadow)",
  }
}

function badge(text: string, tone: "neutral" | "warm" | "cool" | "success") {
  return (
    <span
      style={badgeStyle(tone)}
    >
      {text}
    </span>
  )
}

function badgeStyle(tone: "neutral" | "warm" | "cool" | "success"): CSSProperties {
  const tones = {
    neutral: {
      background: "rgba(22,24,29,0.96)",
      border: "1px solid rgba(22,24,29,0.9)",
      color: "rgba(248,249,246,0.98)",
    },
    warm: {
      background: "rgba(56,44,30,0.94)",
      border: "1px solid rgba(56,44,30,0.86)",
      color: "rgba(248,241,228,0.98)",
    },
    cool: {
      background: "rgba(26,31,43,0.96)",
      border: "1px solid rgba(26,31,43,0.88)",
      color: "rgba(242,246,252,0.98)",
    },
    success: {
      background: "rgba(28,45,36,0.96)",
      border: "1px solid rgba(28,45,36,0.88)",
      color: "rgba(240,249,243,0.98)",
    },
  } as const

  return {
    borderRadius: "999px",
    ...tones[tone],
    padding: "4px 9px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  }
}

function getInterpreterAccent(interpreter: InterpreterId | "all") {
  switch (interpreter) {
    case "nlp":
      return {
        cardBackground: "linear-gradient(180deg, rgba(231,238,250,0.98), rgba(219,229,246,0.94))",
        label: "Sentence framing",
      }
    case "finance":
      return {
        cardBackground: "linear-gradient(180deg, rgba(245,236,225,0.98), rgba(236,223,206,0.94))",
        label: "Capital framing",
      }
    case "music":
      return {
        cardBackground: "linear-gradient(180deg, rgba(240,234,244,0.98), rgba(229,220,238,0.94))",
        label: "Rights framing",
      }
    case "governance":
      return {
        cardBackground: "linear-gradient(180deg, rgba(234,239,232,0.98), rgba(222,231,218,0.94))",
        label: "Control framing",
      }
    case "workflow":
      return {
        cardBackground: "linear-gradient(180deg, rgba(236,240,231,0.98), rgba(225,232,218,0.94))",
        label: "Process framing",
      }
    case "schema":
      return {
        cardBackground: "linear-gradient(180deg, rgba(237,238,244,0.98), rgba(226,228,238,0.94))",
        label: "Schema framing",
      }
    case "raw":
      return {
        cardBackground: "linear-gradient(180deg, rgba(244,244,243,0.98), rgba(234,235,233,0.94))",
        label: "Primitive framing",
      }
    case "all":
    default:
      return {
        cardBackground: "linear-gradient(180deg, rgba(247,247,246,0.98), rgba(236,237,236,0.96))",
        label: "Combined framing",
      }
  }
}

function normalizeWord(word: string) {
  return word.replace(/[^a-zA-Z0-9_-]/g, "").trim()
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeEncoding(input: string) {
  return input
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .replaceAll("â€™", "'")
    .replaceAll("â€“", "-")
    .replaceAll("â€”", "-")
}

function extractConstraintPhrases(input: string) {
  const cleaned = normalizeEncoding(input)
  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const generic = new Set(["with", "without", "must", "only", "until", "gated"])
  const collected: string[] = []
  for (const line of lines) {
    const lower = line.toLowerCase()
    const isConstraintLine =
      lower.includes("must") ||
      lower.includes("no ") ||
      lower.includes("cannot") ||
      lower.includes("only") ||
      lower.includes("max ") ||
      lower.includes("at most") ||
      lower.includes("limit") ||
      lower.includes("rule") ||
      lower.includes("required") ||
      lower.includes("accredited")
    if (isConstraintLine) {
      collected.push(line.slice(0, 140))
    }
  }
  if (!collected.length) return []
  return [...new Set(collected)]
    .filter((line) => !generic.has(line.toLowerCase()))
    .slice(0, 6)
}

function extractDomainModel(sourceThesis: string, analysis: InterpreterResult) {
  const source = normalizeEncoding(sourceThesis)
  const lower = source.toLowerCase()
  const roles = ["gp", "lp", "operator", "investor", "member"].filter((role) => lower.includes(role))
  const instruments = ["futures", "event contracts", "options", "swaps", "derivatives"].filter((item) => lower.includes(item))
  const offeringRule = lower.includes("506(b)") ? "Reg D 506(b)" : lower.includes("506(c)") ? "Reg D 506(c)" : null
  const fundExemption = lower.includes("3(c)(1)") ? "3(c)(1)" : lower.includes("3(c)(7)") ? "3(c)(7)" : null
  const investorLimit = lower.includes("100 beneficial owners") || lower.includes("max investors: 100") ? "<=100 beneficial owners" : null
  const accreditationPaths = [
    lower.includes("income") ? "income" : null,
    lower.includes("net worth") ? "net_worth" : null,
    lower.includes("series 7") || lower.includes("series 65") || lower.includes("series 82") ? "license" : null,
    lower.includes("knowledgeable employee") ? "knowledgeable_employee" : null,
  ].filter(Boolean) as string[]
  const constraints = extractConstraintPhrases(source)
  const risks = [
    lower.includes("self-certif") ? "self-certification misrepresentation risk" : null,
    lower.includes("no public offering") ? null : "public offering characterization risk",
    lower.includes("invite-only") ? null : "distribution control risk",
  ].filter(Boolean) as string[]
  const assumptions = [
    "Counterparty and market access are available",
    "Regulatory counsel validates offering details",
    "Operator governance can be encoded into workflow gates",
  ]
  const missingCritical = [
    !offeringRule ? "offering_rule_missing" : null,
    !fundExemption ? "fund_exemption_missing" : null,
    !roles.length ? "role_mapping_missing" : null,
    !constraints.length ? "constraint_clarity_missing" : null,
  ].filter(Boolean) as string[]

  const confidenceByField: Record<string, number> = {
    entities: clamp(analysis.entities.length * 0.16 + 0.22, 0.2, 0.92),
    instruments: instruments.length ? clamp(0.42 + instruments.length * 0.12, 0.25, 0.94) : 0.22,
    regulation: offeringRule || fundExemption ? 0.78 : 0.28,
    constraints: constraints.length ? clamp(0.32 + constraints.length * 0.08, 0.24, 0.9) : 0.2,
    roles: roles.length ? clamp(0.34 + roles.length * 0.1, 0.24, 0.9) : 0.2,
  }

  return {
    entities: analysis.entities.slice(0, 8),
    instruments,
    roles,
    constraints,
    regulation: {
      offeringRule,
      fundExemption,
      investorLimit,
      accreditationPaths,
    },
    risks,
    assumptions,
    missingCritical,
    confidenceByField,
  }
}

function parseEmbeddedCommands(source: string) {
  const commandPattern = /\[\[([^\]]+)\]\]/g
  const found: string[] = []
  for (const match of source.matchAll(commandPattern)) {
    const token = match[1]?.trim()
    if (token) found.push(token)
  }

  const interpreterIds: InterpreterId[] = []
  let interpreterView: InterpreterView | null = null
  let composerStage: ComposerStage | null = null
  let composerMergeMode: ComposerMergeMode | null = null
  let composerOutputIntent: ComposerOutputIntent | null = null
  let artifactType: ArtifactType | null = null
  const runDirectives: RunDirective[] = []

  const consumeToken = (token: string) => {
    if (token.startsWith("interpreter:")) {
      const value = token.replace("interpreter:", "").trim() as InterpreterId
      if (["raw", "nlp", "finance", "music", "governance", "workflow", "schema"].includes(value)) {
        if (!interpreterIds.includes(value)) interpreterIds.push(value)
        interpreterView = value
      }
    } else if (token.startsWith("composer:stage=")) {
      const value = token.replace("composer:stage=", "").trim() as ComposerStage
      if (["define", "compose", "validate", "launch"].includes(value)) composerStage = value
    } else if (token.startsWith("composer:merge=")) {
      const value = token.replace("composer:merge=", "").trim() as ComposerMergeMode
      if (["consensus", "weighted"].includes(value)) composerMergeMode = value
    } else if (token.startsWith("composer:intent=")) {
      const value = token.replace("composer:intent=", "").trim() as ComposerOutputIntent
      if (["brief", "spec", "workflow"].includes(value)) composerOutputIntent = value
    } else if (token.startsWith("artifact:")) {
      const value = token.replace("artifact:", "").trim() as ArtifactType
      if (["decision_brief", "execution_plan", "system_spec"].includes(value)) artifactType = value
    } else if (token.startsWith("run:")) {
      const value = token.replace("run:", "").trim() as RunDirective
      if (["output", "bridge", "builder", "codegen", "full"].includes(value) && !runDirectives.includes(value)) {
        runDirectives.push(value)
      }
    }
  }

  for (const token of found) {
    if (token.startsWith("bind:")) {
      const payload = token.replace("bind:", "").trim()
      const sep = payload.indexOf("|")
      if (sep !== -1) {
        const boundCommand = payload.slice(sep + 1).trim()
        if (boundCommand) consumeToken(boundCommand)
      }
      continue
    }
    consumeToken(token)
  }

  const cleanedBody = source
    .replace(commandPattern, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return {
    cleanedBody,
    overrides: {
      interpreterIds,
      interpreterView,
      composerStage,
      composerMergeMode,
      composerOutputIntent,
      artifactType,
      runDirectives,
    },
  }
}

function extractEmbeddedTokens(source: string) {
  const commandPattern = /\[\[([^\]]+)\]\]/g
  const tokens: string[] = []
  for (const match of source.matchAll(commandPattern)) {
    const token = match[0]?.trim()
    if (token) tokens.push(token)
  }
  return tokens
}

function stripEmbeddedTokens(source: string) {
  return source
    .replace(/\[\[([^\]]+)\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripLegacyNotebookHelper(source: string) {
  return source
    .replace(/^\s*Write directly into the notebook\. Use Cmd\/Ctrl\+Enter to embed commands\.\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function visibleNotebookBodyForBlock(block: ThesisBlock | undefined) {
  if (!block) return ""
  return stripLegacyNotebookHelper(stripEmbeddedTokens(block.body ?? ""))
}

function composeNotebookBody(visibleText: string, tokens: string[]) {
  const cleaned = visibleText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (!tokens.length) return cleaned
  return cleaned ? `${cleaned}\n\n${tokens.join("\n")}` : tokens.join("\n")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseBindEntries(tokens: string[]) {
  const entries: Array<{ word: string; command: string }> = []
  for (const token of tokens) {
    const inner = token.replace(/^\[\[/, "").replace(/\]\]$/, "")
    if (!inner.startsWith("bind:")) continue
    const payload = inner.replace("bind:", "").trim()
    const sep = payload.indexOf("|")
    if (sep === -1) continue
    const word = payload.slice(0, sep).trim()
    const command = payload.slice(sep + 1).trim()
    if (word && command && !entries.some((entry) => entry.word.toLowerCase() === word.toLowerCase() && entry.command === command)) {
      entries.push({ word, command })
    }
  }
  return entries
}

function bindCommandHighlight(command: string) {
  if (command.startsWith("interpreter:")) {
    return { bg: "rgba(203, 228, 255, 0.78)", border: "rgba(128, 176, 228, 0.92)", text: "rgba(20, 62, 108, 0.98)" }
  }
  if (command.startsWith("composer:")) {
    return { bg: "rgba(225, 214, 255, 0.78)", border: "rgba(176, 152, 230, 0.9)", text: "rgba(60, 38, 109, 0.98)" }
  }
  if (command.startsWith("artifact:")) {
    return { bg: "rgba(255, 224, 191, 0.82)", border: "rgba(222, 169, 102, 0.9)", text: "rgba(94, 54, 13, 0.98)" }
  }
  if (command.startsWith("run:")) {
    return { bg: "rgba(199, 242, 216, 0.82)", border: "rgba(102, 184, 135, 0.9)", text: "rgba(16, 82, 46, 0.98)" }
  }
  return { bg: "rgba(222, 227, 236, 0.78)", border: "rgba(162, 172, 189, 0.9)", text: "rgba(46, 52, 66, 0.98)" }
}

function buildStackedHighlight(commands: string[]) {
  if (!commands.length) return bindCommandHighlight("default")
  if (commands.length === 1) return bindCommandHighlight(commands[0] ?? "default")
  const tones = commands.map((command) => bindCommandHighlight(command))
  const segments = tones
    .map((tone, index) => {
      const start = (index * 100) / tones.length
      const end = ((index + 1) * 100) / tones.length
      return `${tone.bg} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    })
    .join(", ")
  return {
    bg: `linear-gradient(90deg, ${segments})`,
    border: tones[0]?.border ?? "rgba(162, 172, 189, 0.9)",
    text: "rgba(30, 37, 48, 0.98)",
  }
}

function renderNotebookRichHtml(rawBody: string) {
  const tokens = extractEmbeddedTokens(rawBody)
  const bindEntries = parseBindEntries(tokens)
  const visible = stripLegacyNotebookHelper(stripEmbeddedTokens(rawBody)).replace(/\*\*([^*]+)\*\*/g, "$1")
  const OPEN = "\u0001"
  const CLOSE = "\u0002"
  let marked = visible
  const groupedBindings: Array<{ word: string; commands: string[] }> = []
  for (const entry of bindEntries) {
    const existing = groupedBindings.find((group) => group.word.toLowerCase() === entry.word.toLowerCase())
    if (existing) {
      if (!existing.commands.includes(entry.command)) existing.commands.push(entry.command)
    } else {
      groupedBindings.push({ word: entry.word, commands: [entry.command] })
    }
  }
  const styles = groupedBindings.map((entry) => buildStackedHighlight(entry.commands))
  for (let i = 0; i < groupedBindings.length; i += 1) {
    const word = groupedBindings[i]?.word
    if (!word) continue
    const pattern = new RegExp(escapeRegExp(word), "i")
    marked = marked.replace(pattern, `${OPEN}${i}${OPEN}$&${CLOSE}${i}${CLOSE}`)
  }
  let html = escapeHtml(marked)
  for (let i = 0; i < styles.length; i += 1) {
    const start = `${OPEN}${i}${OPEN}`
    const end = `${CLOSE}${i}${CLOSE}`
    const style = styles[i]
    const commands = groupedBindings[i]?.commands ?? []
    const commandLabel = commands.join(" | ")
    const tooltip = escapeHtml(commandLabel)
    const stackedBadge =
      commands.length > 1
        ? `<sup style="display:inline-flex;align-items:center;justify-content:center;min-width:14px;height:14px;margin-left:4px;border-radius:999px;border:1px solid rgba(70,76,88,0.38);background:rgba(255,255,255,0.82);font-size:9px;font-weight:700;line-height:1;color:rgba(49,55,66,0.92);vertical-align:text-top;">${commands.length}</sup>`
        : ""
    html = html
      .replaceAll(
        start,
        `<span title="${tooltip}" style="background:${style.bg};color:${style.text};border:1px solid ${style.border};border-radius:7px;padding:0 5px;font-weight:700;">`
      )
      .replaceAll(end, `</span>${stackedBadge}`)
  }
  return html.replace(/\n/g, "<br/>")
}

function baseInterpretation(input: string) {
  const tokens = input.split(/\s+/).map(normalizeWord).filter(Boolean)
  const ranked: RankedToken[] = tokens
    .map((token, index) => {
      const lower = token.toLowerCase()
      const action = /ing$|ed$/.test(lower) || ["build", "create", "design", "analyze", "compare", "submit"].includes(lower)
      const constraint = ["only", "must", "with", "without", "limit", "gated", "until"].includes(lower)
      const structure = ["system", "workflow", "fund", "vehicle", "platform", "policy", "schema", "archive", "thesis"].includes(lower)
      const score = clamp(Math.max(0.18, Math.min(1, token.length / 12)) * Math.max(0.55, 1 - index * 0.028), 0.08, 1)
      return { token, score, role: action ? "action" : constraint ? "constraint" : structure ? "structure" : "term" }
    })
    .sort((a, b) => b.score - a.score)
  return { tokens, ranked, top: ranked.slice(0, 6) }
}

function makeMetrics(top: RankedToken[], tokens: string[], confidenceBoost = 0, divergenceBias = 0): AnalysisMetrics {
  const salience = top.length ? top.reduce((sum, item) => sum + item.score, 0) / top.length : 0
  const dominance = top[0]?.score ?? 0
  const confidence = tokens.length > 2 ? clamp(0.42 + Math.min(0.42, tokens.length * 0.02) + confidenceBoost, 0.28, 0.94) : clamp(0.28 + confidenceBoost, 0.18, 0.72)
  const divergence = top.length > 1 ? clamp(Math.abs((top[0]?.score ?? 0) - (top[1]?.score ?? 0)) * 0.9 + divergenceBias, 0.05, 0.82) : clamp(0.1 + divergenceBias, 0.05, 0.42)
  return {
    salience,
    dominance,
    confidence,
    divergence,
    persistence: clamp(salience * 0.72 + confidence * 0.28, 0.12, 0.9),
    location: top[0]?.role ?? "unmapped",
  }
}

function createInterpreterResult(input: string, interpreter: InterpreterId): InterpreterResult {
  const { tokens, ranked } = baseInterpretation(input)
  const lowerTokens = tokens.map((token) => token.toLowerCase())
  const actions = ranked.filter((item) => item.role === "action").slice(0, 4).map((item) => item.token)
  const constraints = extractConstraintPhrases(input)
  const topTokens = ranked.slice(0, 6)
  const entities = ranked
    .filter((item) => item.role === "structure" || item.score > 0.55)
    .slice(0, 5)
    .map((item) => item.token)

  const domainMap: Record<InterpreterId, string[]> = {
    raw: [],
    nlp: [],
    finance: ["vehicle", "fund", "trade", "capital", "market", "futures", "contracts"],
    music: ["music", "royalty", "master", "rights", "album", "song", "streaming"],
    governance: ["governed", "policy", "approval", "membership", "access", "invite-only"],
    workflow: ["workflow", "stage", "process", "archive", "submit", "development"],
    schema: ["schema", "object", "field", "contract", "structure"],
  }

  const domainSignals = lowerTokens.filter((token) => domainMap[interpreter].includes(token)).slice(0, 6)
  const weighted = ranked.map((item) => {
    let weight = item.score
    if (interpreter === "nlp" && (item.role === "action" || item.role === "constraint")) weight *= 1.14
    if (interpreter === "raw") weight *= 0.94
    if (domainSignals.includes(item.token.toLowerCase())) weight *= 1.22
    if (interpreter === "music" && domainSignals.length === 0) weight *= 0.82
    return { ...item, score: clamp(weight, 0.08, 1) }
  })
  const top = [...weighted].sort((a, b) => b.score - a.score).slice(0, 6)

  const metrics = makeMetrics(
    top,
    tokens,
    interpreter === "nlp" ? 0.08 : interpreter === "finance" || interpreter === "workflow" || interpreter === "governance" ? 0.04 : interpreter === "music" && domainSignals.length === 0 ? -0.08 : 0,
    interpreter === "raw" ? 0.04 : interpreter === "music" && domainSignals.length === 0 ? 0.12 : 0
  )

  const summaries: Record<InterpreterId, string> = {
    raw: "Token-weighted primitive scan. Focuses on position, density, and repeated structural pressure without strong domain claims.",
    nlp: "General sentence analysis. Extracts actions, entities, and constraints from the thesis language before domain-specific framing.",
    finance: "Finance interpreter. Reads the thesis as a vehicle, instrument, capital, and trading structure proposal.",
    music: domainSignals.length
      ? "Music interpreter. Maps the thesis to rights, assets, and distribution language where possible."
      : "Music interpreter. Low direct alignment here, so it mostly reports structural overlap and weak domain confidence.",
    governance: "Governance interpreter. Looks for access rules, controls, approvals, and operating authority.",
    workflow: "Workflow interpreter. Treats the thesis as a staged process with handoffs, gates, and execution sequencing.",
    schema: "Schema interpreter. Converts the thesis into object-like structure, fields, relationships, and output contracts.",
  }

  const risks =
    interpreter === "music" && domainSignals.length === 0
      ? ["Weak music-domain match", "High semantic drift risk"]
      : interpreter === "raw"
        ? ["Low semantic precision", "Domain meaning unresolved"]
        : constraints.length === 0
          ? ["Missing explicit constraints"]
          : ["Domain interpretation depends on assumptions"]

  return {
    interpreter,
    label: interpreter.toUpperCase(),
    summary: summaries[interpreter],
    ranked: top,
    tokens,
    metrics,
    entities,
    actions,
    constraints,
    domainSignals,
    risks,
  }
}

function combineInterpreterResults(results: InterpreterResult[]): InterpreterResult {
  const pooled = results.flatMap((result) => result.ranked.map((item) => ({ ...item, score: item.score / results.length })))
  const combinedRanked = pooled
    .reduce<RankedToken[]>((acc, item) => {
      const existing = acc.find((entry) => entry.token.toLowerCase() === item.token.toLowerCase())
      if (existing) {
        existing.score = clamp(existing.score + item.score, 0.08, 1)
      } else {
        acc.push({ ...item })
      }
      return acc
    }, [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)
  return {
    interpreter: "nlp",
    label: "ALL",
    summary: "Combined interpreter synthesis. Aggregates agreement across all interpreters and highlights where domain adapters diverge.",
    ranked: combinedRanked,
    tokens: [...new Set(results.flatMap((result) => result.tokens))],
    metrics: {
      salience: avg(results.map((result) => result.metrics.salience)),
      dominance: avg(results.map((result) => result.metrics.dominance)),
      confidence: avg(results.map((result) => result.metrics.confidence)),
      divergence: clamp(avg(results.map((result) => result.metrics.divergence)) + (new Set(results.map((result) => result.metrics.location)).size - 1) * 0.05, 0.05, 0.92),
      persistence: avg(results.map((result) => result.metrics.persistence)),
      location: combinedRanked[0]?.role ?? "unmapped",
    },
    entities: [...new Set(results.flatMap((result) => result.entities))].slice(0, 6),
    actions: [...new Set(results.flatMap((result) => result.actions))].slice(0, 6),
    constraints: [...new Set(results.flatMap((result) => result.constraints))].slice(0, 6),
    domainSignals: [...new Set(results.flatMap((result) => result.domainSignals))].slice(0, 8),
    risks: ["Cross-interpreter disagreement requires synthesis", "Output should prioritize consensus nodes first"],
  }
}

function composeThesis(
  results: InterpreterResult[],
  aggregate: InterpreterResult,
  config: ComposerConfig,
  fallbackTitle: string,
  unresolved: string[]
): ComposedThesis {
  const mergedEntities = [...new Set(results.flatMap((result) => result.entities))].slice(0, 6)
  const mergedActions = [...new Set(results.flatMap((result) => result.actions))].slice(0, 6)
  const mergedConstraints = [...new Set(results.flatMap((result) => result.constraints))].slice(0, 6)
  const domainSignals = [...new Set(results.flatMap((result) => result.domainSignals))].slice(0, 8)

  const recommendedStructure =
    config.outputIntent === "workflow"
      ? "Translate the thesis into a staged workflow with decision gates and execution handoffs."
      : config.outputIntent === "spec"
        ? "Translate the thesis into a structured system spec with explicit entities, actions, and constraints."
        : "Translate the thesis into a concise decision brief with prioritized synthesis."

  const summary = [
    `Combined interpreters: ${results.map((result) => result.label).join(", ")}.`,
    `Primary entities: ${mergedEntities.join(", ") || "none identified"}.`,
    `Primary actions: ${mergedActions.join(", ") || "none identified"}.`,
    `Primary constraints: ${mergedConstraints.join(", ") || "none identified"}.`,
    recommendedStructure,
  ].join(" ")

  return {
    title: fallbackTitle,
    summary,
    recommendedStructure,
    mergedEntities,
    mergedActions,
    mergedConstraints,
    domainSignals,
    unresolved,
    confidence: config.mergeMode === "weighted" ? clamp(aggregate.metrics.confidence + 0.04, 0.18, 0.96) : aggregate.metrics.confidence,
    divergence: config.mergeMode === "consensus" ? clamp(aggregate.metrics.divergence - 0.03, 0.05, 0.92) : aggregate.metrics.divergence,
    interpreterSet: results.map((result) => result.label),
  }
}

function generateOutputArtifact(composed: ComposedThesis, mode: OutputMode): GeneratedOutput {
  const content =
    mode === "json"
      ? JSON.stringify(
          {
            title: composed.title,
            summary: composed.summary,
            recommended_structure: composed.recommendedStructure,
            entities: composed.mergedEntities,
            actions: composed.mergedActions,
            constraints: composed.mergedConstraints,
            domain_signals: composed.domainSignals,
            unresolved: composed.unresolved,
            confidence: composed.confidence,
            divergence: composed.divergence,
            interpreter_set: composed.interpreterSet,
          },
          null,
          2
        )
      : mode === "spec"
        ? [
            `Title: ${composed.title}`,
            `Summary: ${composed.summary}`,
            `Recommended structure: ${composed.recommendedStructure}`,
            `Entities: ${composed.mergedEntities.join(", ") || "None"}`,
            `Actions: ${composed.mergedActions.join(", ") || "None"}`,
            `Constraints: ${composed.mergedConstraints.join(", ") || "None"}`,
            `Unresolved: ${composed.unresolved.join(", ") || "None"}`,
          ].join("\n")
        : mode === "draft"
          ? [
              `Generated draft for ${composed.title}`,
              `- ${composed.summary}`,
              `- Build around ${composed.mergedEntities.join(", ") || "core entities"}.`,
              `- Resolve ${composed.unresolved[0] ?? "remaining open questions"}.`,
            ].join("\n")
          : [
              composed.summary,
              `Recommended structure: ${composed.recommendedStructure}`,
              `Confidence ${(composed.confidence * 100).toFixed(0)}% | Divergence ${(composed.divergence * 100).toFixed(0)}%`,
            ].join("\n\n")

  return {
    title: composed.title,
    mode,
    content,
    generatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  }
}

function createBuildArtifact(
  composed: ComposedThesis,
  analysis: InterpreterResult,
  config: ComposerConfig,
  artifactType: ArtifactType,
  sourceThesis: string
): BuildArtifact {
  const normalizedSource = normalizeEncoding(sourceThesis)
  const domainModel = extractDomainModel(normalizedSource, analysis)
  const stages =
    artifactType === "execution_plan"
      ? ["Define structure", "Assign actors", "Implement gates", "Launch monitored flow"]
      : artifactType === "system_spec"
        ? ["Model entities", "Define contracts", "Implement services", "Ship interfaces"]
        : ["Clarify objective", "Resolve blockers", "Approve plan", "Move to execution"]

  const actors = [...new Set(["operator", ...analysis.actions.slice(0, 2).map((action) => `${action.toLowerCase()} owner`)]).values()].slice(0, 4)
  const dependencies = [
    analysis.entities[0] ? `${analysis.entities[0]} registry` : "entity registry",
    analysis.constraints[0] ? `${analysis.constraints[0]} access policy` : "access policy",
    analysis.actions[0] ? `${analysis.actions[0]} workflow gate` : "workflow gate",
  ]

  const productComponents = {
    data: [
      `${analysis.entities[0] ?? "core"} model`,
      `${analysis.entities[1] ?? "access"} record`,
      "audit event log",
    ],
    logic: [
      `${config.mergeMode} synthesis engine`,
      `${config.outputIntent} artifact formatter`,
      `${analysis.actions[0] ?? "approval"} orchestration`,
    ],
    interface: [
      "artifact review console",
      "operator controls",
      "status surface",
    ],
    governance: [
      `${analysis.constraints[0] ?? "gated"} policy`,
      "approval rule set",
      "exception routing",
    ],
    storage: [
      "artifact archive",
      "vector chunk store",
      "replay snapshot log",
    ],
  }

  const implementationHints = [
    "Use typed schemas for all extracted entities",
    "Model workflow steps as explicit state transitions",
    "Persist audit logs alongside generated artifacts",
    "Expose component boundaries as independent modules",
  ]

  const allComponents = [
    ...productComponents.data,
    ...productComponents.logic,
    ...productComponents.interface,
    ...productComponents.governance,
    ...productComponents.storage,
  ]

  const brief =
    artifactType === "execution_plan"
      ? `Execution plan for ${composed.title}. Sequence the build through ${stages.join(", ")} while preserving ${analysis.constraints.join(", ") || "core constraints"}.`
      : artifactType === "system_spec"
        ? `System spec for ${composed.title}. Build around ${composed.mergedEntities.join(", ") || "core entities"} with explicit contracts and orchestration boundaries.`
        : `Decision brief for ${composed.title}. Prioritize ${composed.mergedEntities.join(", ") || "core entities"} and resolve ${composed.unresolved.slice(0, 2).join(", ") || "open questions"} before execution.`

  const nextActions = [
    `Define ${composed.mergedEntities[0] ?? "core"} ownership.`,
    `Implement ${dependencies[1]}.`,
    `Ship ${allComponents[0]}.`,
    `Prepare builder handoff package.`,
  ]

  const machinePayload = {
    objective: composed.recommendedStructure,
    artifactType,
    entities: composed.mergedEntities,
    actions: composed.mergedActions,
    constraints: composed.mergedConstraints,
    stages,
    components: allComponents,
    unresolved: composed.unresolved,
    implementationHints,
  }

  const buildContract = {
    contractVersion: "1.0.0",
    objective: composed.recommendedStructure,
    lanes: [
      {
        lane: "Data" as const,
        deliverables: productComponents.data,
        acceptanceTests: [
          "All primary entities are represented in typed schemas",
          "Records include createdAt/updatedAt and audit fields",
          "Persistence contracts compile with no implicit any",
        ],
      },
      {
        lane: "Logic" as const,
        deliverables: productComponents.logic,
        acceptanceTests: [
          "Stage transitions are explicit and validated",
          "Constraint policies are enforced before side effects",
          "Failure paths emit actionable error reasons",
        ],
      },
      {
        lane: "Interface" as const,
        deliverables: productComponents.interface,
        acceptanceTests: [
          "Operator can inspect artifact and status at each stage",
          "Critical actions require confirmation and capture audit events",
          "UI exposes unresolved constraints and blockers",
        ],
      },
      {
        lane: "Governance" as const,
        deliverables: productComponents.governance,
        acceptanceTests: [
          "Approval rules are encoded and testable",
          "Access policy rejects unauthorized actions",
          "Exception routing captures who/when/why metadata",
        ],
      },
    ],
    doneCriteria: [
      "All lane acceptance tests pass",
      "No critical domain fields remain missing",
      "Bridge reaches stage_3_ready with a non-empty payload",
    ],
  }

  const vectorChunks = [
    `Objective: ${machinePayload.objective}`,
    `Entities: ${machinePayload.entities.join(", ") || "None"}`,
    `Constraints: ${machinePayload.constraints.join(", ") || "None"}`,
    `Components: ${machinePayload.components.slice(0, 6).join(", ")}`,
    `Open questions: ${machinePayload.unresolved.join(", ") || "None"}`,
  ]

  const builderPrompt = [
    `Build a ${artifactType.replaceAll("_", " ")} from this thesis artifact.`,
    `Source thesis: ${sourceThesis}`,
    `Key entities: ${machinePayload.entities.join(", ") || "None"}.`,
    `Required components: ${machinePayload.components.join(", ")}.`,
    `Respect constraints: ${machinePayload.constraints.join(", ") || "None"}.`,
    `Produce a product skeleton with data, logic, interface, and archive layers.`,
  ].join(" ")

  return {
    id: `${Date.now()}-${artifactType}`,
    artifactType,
    title: composed.title,
    sourceThesis: normalizedSource,
    sourceSummary: composed.summary,
    readinessScore: clamp(composed.confidence * 0.62 + (1 - composed.divergence) * 0.24 - domainModel.missingCritical.length * 0.08 + domainModel.constraints.length * 0.015, 0.08, 0.96),
    interpreterSet: composed.interpreterSet,
    composerConfig: config,
    brief,
    nextActions,
    buildGraph: {
      entities: composed.mergedEntities,
      actors,
      constraints: composed.mergedConstraints,
      dependencies,
      stages,
    },
    productComponents,
    machinePayload,
    domainModel,
    buildContract,
    bridge: {
      vectorChunks,
      builderPrompt,
      handoffStatus: "stage_1_embed",
    },
  }
}

function seedBlocks(): ThesisBlock[] {
  return [
    {
      id: "block-1",
      thesisId: "thesis-1",
      title: "Thesis Block 1",
      body: THESIS_BLOCK_1_BASELINE,
      status: "analyzed",
      statusUpdatedAt: "Seeded",
    },
    {
      id: "block-2",
      thesisId: "thesis-2",
      title: "Thesis Block 2",
      body: "Archive generated theses for tuning until response signals are legible, then promote them into product or workflow development.",
      status: "analyzed",
      statusUpdatedAt: "Seeded",
    },
  ]
}

function createCodegenFileOutline(
  buildObject: BuildSessionObject,
  file: string,
  artifact: BuildArtifact | null,
  target: BuilderTarget
): CodegenFileOutline {
  const firstEntity = artifact?.buildGraph.entities[0] ?? "artifact"
  const firstConstraint = artifact?.buildGraph.constraints[0] ?? "policy"
  const firstStage = artifact?.buildGraph.stages[0] ?? "define"
  const baseName = buildObject.title.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "artifact module"
  const targetLabel = target.replaceAll("_", " ")

  const targetSnippetSuffix =
    target === "schema"
      ? "schema"
      : target === "workflow"
        ? "workflow"
        : target === "ui_shell"
          ? "ui"
          : "product"

  if (file === "models.ts") {
    return {
      file,
      purpose:
        target === "schema"
          ? "Define the canonical schema objects and typed records for this build object."
          : `Define the normalized domain models used by the build object for the ${targetLabel} target.`,
      sections:
        target === "schema"
          ? ["Schema entities", "Field maps", "Normalization types"]
          : ["Entity interfaces", "Role and permission flags", "Artifact metadata types"],
      snippet: `export type ${baseName.replace(/\s+/g, "")}Model = {
  id: string
  entity: "${firstEntity}"
  constraint: "${firstConstraint}"
  stage: "${firstStage}"
  target: "${targetSnippetSuffix}"
  status: "draft" | "active" | "archived"
}`,
    }
  }
  if (file === "records.ts") {
    return {
      file,
      purpose:
        target === "workflow"
          ? "Capture workflow events and stage transitions for execution tracking."
          : "Capture persisted trade, approval, and archive records.",
      sections:
        target === "workflow"
          ? ["Transition envelope", "Stage events", "Replay mappers"]
          : ["Record envelope", "History entries", "Snapshot mappers"],
      snippet: `export type RecordEnvelope = {
  recordId: string
  subject: "${firstEntity}"
  event: "created" | "approved" | "archived"
  target: "${targetSnippetSuffix}"
  createdAt: string
}`,
    }
  }
  if (file === "storage.ts") {
    return {
      file,
      purpose:
        target === "schema"
          ? "Define the persistence boundary for schema-backed storage and retrieval."
          : "Define repository boundaries for storing and retrieving artifact state.",
      sections:
        target === "schema"
          ? ["Schema repository", "Migration-safe writes", "Typed reads"]
          : ["Repository contract", "Write methods", "Query methods"],
      snippet: `export interface StorageGateway {
  save(input: unknown): Promise<void>
  loadById(id: string): Promise<unknown>
  listByStage(stage: string): Promise<unknown[]>
}`,
    }
  }
  if (file === "service.ts") {
    return {
      file,
      purpose:
        target === "product_skeleton"
          ? "Implement the product-facing service entrypoint for this build lane."
          : "Implement the primary service entrypoint for this build lane.",
      sections:
        target === "product_skeleton"
          ? ["Service contract", "Primary use case", "Response envelope"]
          : ["Service contract", "Execution method", "Response shape"],
      snippet: `export async function run${baseName.replace(/\s+/g, "")}Service(input: unknown) {
  return {
    ok: true,
    stage: "${firstStage}",
    constraint: "${firstConstraint}",
    target: "${targetSnippetSuffix}",
  }
}`,
    }
  }
  if (file === "policy.ts") {
    return {
      file,
      purpose:
        target === "workflow"
          ? "Evaluate stage gates and approval boundaries before advancing the workflow."
          : "Evaluate rules, constraints, and approval boundaries before execution.",
      sections:
        target === "workflow"
          ? ["Stage guards", "Transition checks", "Violation results"]
          : ["Policy guards", "Constraint checks", "Violation results"],
      snippet: `export function evaluatePolicy(input: { constraint?: string }) {
  return {
    allowed: input.constraint !== undefined,
    boundary: "${firstConstraint}",
    target: "${targetSnippetSuffix}",
  }
}`,
    }
  }
  if (file === "orchestrator.ts") {
    return {
      file,
      purpose:
        target === "workflow"
          ? "Sequence the workflow across explicit stages, approvals, and archive handoffs."
          : "Sequence the service flow across stages and handoffs.",
      sections:
        target === "workflow"
          ? ["Workflow router", "Transition chain", "Archive trigger"]
          : ["Stage router", "Execution chain", "Archive trigger"],
      snippet: `export const orchestrationStages = [
  "${firstStage}",
  "execute",
  "archive",
] as const`,
    }
  }
  if (file === "panel.tsx") {
    return {
      file,
      purpose:
        target === "ui_shell"
          ? "Render the primary UI shell for this build object."
          : "Render the primary interface surface for this build object.",
      sections:
        target === "ui_shell"
          ? ["Shell layout", "Interaction regions", "State summary"]
          : ["Panel shell", "Action surface", "State summary"],
      snippet: `export function ${baseName.replace(/\s+/g, "")}Panel() {
  return <section>${buildObject.title}</section>
}`,
    }
  }
  if (file === "controls.tsx") {
    return {
      file,
      purpose:
        target === "ui_shell"
          ? "Expose the interactive UI controls that drive the shell behavior."
          : "Expose the interactive controls that drive the flow.",
      sections:
        target === "ui_shell"
          ? ["Primary actions", "Control groups", "Submission controls"]
          : ["Primary actions", "Validation controls", "Submission controls"],
      snippet: `export function ${baseName.replace(/\s+/g, "")}Controls() {
  return <div>Controls for ${firstConstraint}</div>
}`,
    }
  }
  if (file === "states.ts") {
    return {
      file,
      purpose:
        target === "ui_shell"
          ? "Declare UI state objects and interaction state for the shell."
          : "Declare UI and workflow state objects for the interface layer.",
      sections:
        target === "ui_shell"
          ? ["View state", "Interaction state", "Resolved flags"]
          : ["View state", "Transition state", "Resolved flags"],
      snippet: `export type ViewState = {
  stage: "${firstStage}"
  target: "${targetSnippetSuffix}"
  ready: boolean
}`,
    }
  }
  if (file === "rules.ts") {
    return {
      file,
      purpose:
        target === "workflow"
          ? "Define workflow governance rules and transition enforcement boundaries."
          : "Define governance rules and enforcement boundaries.",
      sections:
        target === "workflow"
          ? ["Transition rules", "Escalation rules", "Decision outcomes"]
          : ["Approval rules", "Escalation rules", "Decision outcomes"],
      snippet: `export const governanceRules = {
  primaryConstraint: "${firstConstraint}",
  target: "${targetSnippetSuffix}",
  requiresApproval: true,
}`,
    }
  }
  if (file === "audit.ts") {
    return {
      file,
      purpose:
        target === "schema"
          ? "Track immutable audit records tied to schema evolution and artifact lifecycle."
          : "Track immutable audit events tied to the artifact lifecycle.",
      sections:
        target === "schema"
          ? ["Audit record type", "Write event method", "Replay helpers"]
          : ["Audit event type", "Write event method", "Replay helpers"],
      snippet: `export type AuditEvent = {
  event: "submit" | "approve" | "handoff"
  target: "${targetSnippetSuffix}"
  createdAt: string
}`,
    }
  }
  if (file === "archive.ts") {
    return {
      file,
      purpose:
        target === "product_skeleton"
          ? "Archive finalized states, snapshots, and replayable handoff records for the product package."
          : "Archive finalized states, snapshots, and replayable handoff records.",
      sections:
        target === "product_skeleton"
          ? ["Package snapshot", "Version record", "Replay link"]
          : ["Archive snapshot", "Version record", "Replay link"],
      snippet: `export function createArchiveSnapshot() {
  return {
    title: "${artifact?.title ?? "artifact"}",
    stage: "stage_3_ready",
    target: "${targetSnippetSuffix}",
  }
}`,
    }
  }

  return {
    file,
    purpose: `Provide the first-pass implementation scaffold for the promoted build object in the ${targetLabel} target.`,
    sections: ["Primary export", "Core dependency", "Artifact boundary"],
    snippet: `export const scaffold = "${buildObject.title}"`,
  }
}

function createCodegenFileDraft(
  buildObject: BuildSessionObject,
  file: string,
  artifact: BuildArtifact | null,
  target: BuilderTarget
): CodegenFileDraft {
  const outline = createCodegenFileOutline(buildObject, file, artifact, target)
  const firstEntity = artifact?.buildGraph.entities[0] ?? "artifact"
  const firstConstraint = artifact?.buildGraph.constraints[0] ?? "policy"
  const moduleBase = buildObject.title.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "artifact module"
  const moduleName = `${moduleBase.replace(/\s+/g, "")}${file.replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/\s+/g, "")}`
  const targetLabel = target.replaceAll("_", " ")
  const exports =
    file.endsWith(".tsx")
      ? [`${moduleName}`, `${moduleName}Props`]
      : file === "models.ts"
        ? [`${moduleName}`, `${moduleName}Status`]
        : [`${moduleName}`, `create${moduleName}`]
  const implementationNotes = [
    `Bind this module to the ${buildObject.lane.toLowerCase()} lane of the generated artifact.`,
    `Preserve the ${firstConstraint} boundary while targeting the ${targetLabel} build.`,
    `Connect the ${firstEntity} entity path to archive-safe replay and handoff routing.`,
  ]

  let draft = `// ${outline.purpose}
// Target: ${targetLabel}

export const ${moduleName} = {
  file: "${file}",
  lane: "${buildObject.lane}",
  entity: "${firstEntity}",
  constraint: "${firstConstraint}",
}
`

  if (file.endsWith(".tsx")) {
    draft = `type ${moduleName}Props = {
  title?: string
}

export function ${moduleName}(props: ${moduleName}Props) {
  return (
    <section aria-label="${buildObject.title}">
      <h2>{props.title ?? "${buildObject.title}"}</h2>
      <p>${outline.purpose}</p>
    </section>
  )
}`
  } else if (file === "service.ts") {
    draft = `export async function ${moduleName}(input: unknown) {
  return {
    ok: true,
    target: "${targetLabel}",
    lane: "${buildObject.lane}",
    deliverables: ${JSON.stringify(buildObject.deliverables.slice(0, 3))},
  }
}`
  } else if (file === "models.ts") {
    draft = `export type ${moduleName}Status = "draft" | "ready" | "archived"

export type ${moduleName} = {
  id: string
  entity: "${firstEntity}"
  constraint: "${firstConstraint}"
  status: ${moduleName}Status
}`
  } else if (file === "rules.ts") {
    draft = `export const ${moduleName} = {
  requiresApproval: true,
  primaryConstraint: "${firstConstraint}",
  target: "${targetLabel}",
}`
  }

  return {
    file,
    moduleName,
    summary: `${outline.purpose} This draft is the first-pass module handoff for ${buildObject.title}.`,
    exports,
    implementationNotes,
    draft,
  }
}

export default function AnalysisWorkbench({ onOpenSpatial }: { onOpenSpatial: () => void }) {
  const [selectedInterpreters, setSelectedInterpreters] = useState<InterpreterId[]>(["nlp"])
  const [interpreterView, setInterpreterView] = useState<InterpreterView>("nlp")
  const [outputMode, setOutputMode] = useState<OutputMode>("summary")
  const [composerStage, setComposerStage] = useState<ComposerStage>("define")
  const [composerMergeMode, setComposerMergeMode] = useState<ComposerMergeMode>("consensus")
  const [composerOutputIntent, setComposerOutputIntent] = useState<ComposerOutputIntent>("brief")
  const [artifactType, setArtifactType] = useState<ArtifactType>("decision_brief")
  const [archiveMode, setArchiveMode] = useState<ThesisArchiveMode>("tuning")
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all")
  const [archiveSort, setArchiveSort] = useState<ArchiveSort>("newest")
  const [activePanel, setActivePanel] = useState<EditorPanel>("input")
  const [archiveLibrary, setArchiveLibrary] = useState<ThesisArchiveEntry[]>(() => createSeedThesisLibrary())
  const [blocks, setBlocks] = useState<ThesisBlock[]>(() => seedBlocks())
  const [selectedBlockId, setSelectedBlockId] = useState("block-1")
  const [promptInsertMode, setPromptInsertMode] = useState<PromptInsertMode>("paragraph")
  const [toolbarSectionIndex, setToolbarSectionIndex] = useState(0)
  const [interpreterStep, setInterpreterStep] = useState<0 | 1>(0)
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null)
  const [composedThesis, setComposedThesis] = useState<ComposedThesis | null>(null)
  const [generatedOutput, setGeneratedOutput] = useState<GeneratedOutput | null>(null)
  const [buildArtifact, setBuildArtifact] = useState<BuildArtifact | null>(null)
  const [bridgeSubmission, setBridgeSubmission] = useState<BridgeSubmission | null>(null)
  const [builderTarget, setBuilderTarget] = useState<BuilderTarget>("product_skeleton")
  const [builderJob, setBuilderJob] = useState<BuilderJob | null>(null)
  const [selectedBuildObjectLane, setSelectedBuildObjectLane] = useState<BuildSessionObject["lane"] | null>(null)
  const [selectedCodegenFile, setSelectedCodegenFile] = useState<string | null>(null)
  const [committedModules, setCommittedModules] = useState<CommittedBuildModule[]>([])
  const [outputTreeNodes, setOutputTreeNodes] = useState<OutputTreeNode[]>([])
  const [savedThesisTrees, setSavedThesisTrees] = useState<SavedThesisTree[]>([])
  const [cycleGateMessage, setCycleGateMessage] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark")
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState("")
  const [commandIndex, setCommandIndex] = useState(0)
  const [commandSelection, setCommandSelection] = useState<{ start: number; end: number } | null>(null)
  const [block1Surfaces, setBlock1Surfaces] = useState<Block1Surface[]>(() => createBlock1Surfaces())
  const [activeBlock1SurfaceIndex, setActiveBlock1SurfaceIndex] = useState(0)
  const [block1DeletePromptId, setBlock1DeletePromptId] = useState<string | null>(null)
  const inputEditableRef = useRef<HTMLDivElement | null>(null)
  const block1SurfaceRefs = useRef<Array<HTMLDivElement | null>>([])
  const lastSyncedEditorBlockIdRef = useRef<string | null>(null)

  const selected = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0]
  const activeBlock1Surface = useMemo(() => {
    if (selected?.id !== "block-1") return null
    return block1Surfaces[activeBlock1SurfaceIndex] ?? block1Surfaces[0] ?? null
  }, [activeBlock1SurfaceIndex, block1Surfaces, selected?.id])
  const isDark = themeMode === "dark"
  const themeVars = useMemo(
    () =>
      ({
        "--wg-shell-bg": isDark
          ? "radial-gradient(circle at 20% 0%, rgba(54,56,63,0.25), transparent 36%), linear-gradient(180deg, rgba(24,25,29,1), rgba(19,20,24,1))"
          : "linear-gradient(180deg, rgba(241,242,240,0.99), rgba(232,234,232,0.98))",
        "--wg-shell-fg": isDark ? "rgba(229,233,239,0.96)" : "rgba(42,48,60,0.94)",
        "--wg-main-bg": isDark ? "linear-gradient(180deg, rgba(25,26,31,1), rgba(21,22,27,0.98))" : "linear-gradient(180deg, rgba(244,245,243,1), rgba(236,238,235,0.98))",
        "--wg-rail-bg": isDark ? "linear-gradient(180deg, rgba(35,37,43,0.98), rgba(29,31,37,0.96))" : "linear-gradient(180deg, rgba(246,247,245,0.98), rgba(238,239,237,0.96))",
        "--wg-rail-inset": isDark ? "inset 0 1px 0 rgba(255,255,255,0.07)" : "inset 0 1px 0 rgba(255,255,255,0.82)",
        "--wg-ctrl-bg": isDark ? "rgba(48,52,60,0.92)" : "rgba(232,234,236,0.92)",
        "--wg-ctrl-fg": isDark ? "rgba(212,218,226,0.94)" : "rgba(70,76,88,0.9)",
        "--wg-divider": isDark ? "rgba(84,89,99,0.9)" : "rgba(204,208,214,0.9)",
        "--wg-section-active-bg": isDark ? "rgba(91,99,115,0.34)" : "rgba(61,66,77,0.94)",
        "--wg-section-active-fg": isDark ? "rgba(247,250,255,0.98)" : "rgba(248,249,246,0.98)",
        "--wg-section-bg": isDark ? "rgba(44,47,56,0.86)" : "rgba(236,238,240,0.86)",
        "--wg-section-fg": isDark ? "rgba(183,190,202,0.9)" : "rgba(76,82,94,0.9)",
        "--wg-canvas-bg": isDark
          ? "linear-gradient(180deg, rgba(31,33,39,0.97), rgba(24,25,30,0.95)), repeating-linear-gradient(180deg, transparent, transparent 42px, rgba(67,72,82,0.2) 42px, rgba(67,72,82,0.2) 43px)"
          : "linear-gradient(180deg, rgba(248,248,246,0.97), rgba(238,239,237,0.94)), repeating-linear-gradient(180deg, transparent, transparent 42px, rgba(216,219,224,0.18) 42px, rgba(216,219,224,0.18) 43px)",
        "--wg-canvas-inset": isDark ? "inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.82)",
        "--wg-bottom-border": isDark ? "1px solid rgba(84,89,99,0.72)" : "1px solid rgba(214,218,224,0.72)",
        "--wg-bottom-bg": isDark ? "linear-gradient(180deg, rgba(28,30,35,0.95), rgba(24,26,31,0.98))" : "linear-gradient(180deg, rgba(241,242,240,0.92), rgba(233,235,233,0.96))",
        "--wg-output-card-bg": isDark ? "linear-gradient(180deg, rgba(34,36,42,0.94), rgba(28,30,35,0.92))" : "linear-gradient(180deg, rgba(247,247,246,0.94), rgba(238,239,238,0.9))",
        "--wg-card-bg": isDark ? "linear-gradient(180deg, rgba(38,40,46,0.98), rgba(31,33,39,0.96))" : "linear-gradient(180deg, rgba(247,247,246,0.98), rgba(236,237,236,0.96))",
        "--wg-card-shadow": isDark ? "0 22px 44px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05) inset" : "0 24px 48px rgba(112,114,122,0.12), 0 3px 0 rgba(255,255,255,0.7) inset",
        "--wg-card-shadow-layer": isDark ? "rgba(0,0,0,0.34)" : "rgba(201,203,208,0.5)",
        "--wg-pill-active-warm-bg": isDark ? "linear-gradient(180deg, rgba(85,74,60,1), rgba(67,58,48,0.96))" : "linear-gradient(180deg, rgba(241,231,216,1), rgba(228,216,198,0.94))",
        "--wg-pill-active-bg": isDark ? "linear-gradient(180deg, rgba(63,68,78,1), rgba(49,54,64,0.96))" : "linear-gradient(180deg, rgba(236,240,245,1), rgba(223,228,236,0.96))",
        "--wg-pill-bg": isDark ? "linear-gradient(180deg, rgba(46,50,58,0.98), rgba(39,43,51,0.96))" : "linear-gradient(180deg, rgba(252,252,253,0.98), rgba(235,237,242,0.96))",
        "--wg-pill-fg": isDark ? "rgba(228,231,237,0.96)" : "rgba(45,51,62,0.94)",
        "--wg-pill-shadow-active": isDark ? "0 12px 24px rgba(0,0,0,0.35)" : "0 12px 24px rgba(108,110,118,0.14)",
        "--wg-pill-shadow": isDark ? "0 8px 18px rgba(0,0,0,0.26)" : "0 10px 20px rgba(120,122,130,0.1)",
        "--wg-title-input-bg": isDark ? "rgba(43,46,54,0.9)" : "rgba(248,248,246,0.86)",
        "--wg-title-input-fg": isDark ? "rgba(234,238,245,0.98)" : "rgba(42,48,60,0.94)",
        "--wg-title-input-inset": isDark ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.68)",
        "--wg-input-note-fg": isDark ? "rgba(160,168,182,0.88)" : "rgba(90,96,108,0.88)",
        "--wg-chip-fg": isDark ? "rgba(230,235,242,0.96)" : "rgba(45,51,62,0.96)",
        "--wg-panel-bg-primary": isDark ? "rgba(38,41,48,0.7)" : "rgba(250,250,248,0.42)",
        "--wg-panel-bg-secondary": isDark ? "rgba(34,37,44,0.62)" : "rgba(246,247,245,0.55)",
        "--wg-panel-fg": isDark ? "rgba(230,235,242,0.98)" : "rgba(35,41,51,0.97)",
        "--wg-delete-pop-bg": isDark ? "rgba(34,37,44,0.97)" : "rgba(252,252,252,0.97)",
        "--wg-delete-pop-border": isDark ? "rgba(104,110,123,0.72)" : "rgba(176,182,194,0.72)",
        "--wg-delete-pop-shadow": isDark ? "0 10px 22px rgba(0,0,0,0.3)" : "0 10px 22px rgba(45,52,64,0.14)",
        "--wg-delete-icon-bg": isDark ? "rgba(43,47,56,0.86)" : "rgba(248,248,248,0.82)",
        "--wg-delete-icon-border": isDark ? "rgba(103,111,126,0.55)" : "rgba(162,172,189,0.5)",
        "--wg-editor-bg": isDark ? "rgba(38,41,48,0.7)" : "rgba(250,250,248,0.42)",
        "--wg-editor-fg": isDark ? "rgba(230,235,242,0.98)" : "rgba(35,41,51,0.97)",
        "--wg-command-label-fg": isDark ? "rgba(160,168,182,0.86)" : "rgba(102,108,118,0.82)",
        "--wg-command-input-bg": isDark ? "rgba(30,33,40,0.94)" : "rgba(247,248,246,0.9)",
        "--wg-command-input-fg": isDark ? "rgba(227,232,240,0.96)" : "rgba(48,55,66,0.95)",
        "--wg-command-empty-fg": isDark ? "rgba(156,164,178,0.88)" : "rgba(82,88,100,0.88)",
      }) as CSSProperties,
    [isDark]
  )
  const interpreterResults = useMemo(() => {
    const source = selected?.body ?? ""
    return {
      raw: createInterpreterResult(source, "raw"),
      nlp: createInterpreterResult(source, "nlp"),
      finance: createInterpreterResult(source, "finance"),
      music: createInterpreterResult(source, "music"),
      governance: createInterpreterResult(source, "governance"),
      workflow: createInterpreterResult(source, "workflow"),
      schema: createInterpreterResult(source, "schema"),
    } satisfies Record<InterpreterId, InterpreterResult>
  }, [selected?.body])
  const selectedResults = useMemo(
    () => selectedInterpreters.map((id) => interpreterResults[id]),
    [interpreterResults, selectedInterpreters]
  )
  const selectedAggregateAnalysis = useMemo(
    () => combineInterpreterResults(selectedResults),
    [selectedResults]
  )
  const analysis = interpreterView === "all" ? selectedAggregateAnalysis : interpreterResults[interpreterView]
  const aggregateAnalysis = useMemo(() => combineInterpreterResults(Object.values(interpreterResults)), [interpreterResults])
  const dominantTerm = analysis.ranked[0]?.token ?? aggregateAnalysis.ranked[0]?.token ?? "No dominant term"
  const thesisTitle = useMemo(() => buildThesisTitle(archiveMode, dominantTerm), [archiveMode, dominantTerm])
  const composerConfig = useMemo(
    () => ({
      stage: composerStage,
      mergeMode: composerMergeMode,
      outputIntent: composerOutputIntent,
    }),
    [composerMergeMode, composerOutputIntent, composerStage]
  )
  const missingQuestions = useMemo(() => {
    const gaps = ["actor ownership", "validation threshold", "execution boundary", "archive routing"]
    if (interpreterView === "raw") return gaps.slice(0, 2)
    if (analysis.tokens.length < 10) return gaps.slice(0, 3)
    return gaps
  }, [analysis.tokens.length, interpreterView])
  const activeInterpreterAccent = useMemo(() => getInterpreterAccent(interpreterView), [interpreterView])
  const buildSessionObjects = useMemo<BuildSessionObject[]>(() => {
    if (!buildArtifact || !builderJob) return []

    const suffix =
      builderJob.target === "schema"
        ? "schema"
        : builderJob.target === "workflow"
          ? "flow"
          : builderJob.target === "ui_shell"
            ? "ui"
            : "module"

    return [
      {
        lane: "Data",
        title: `${buildArtifact.buildGraph.entities[0] ?? "core"}-${suffix}`,
        output: "Schema package",
        deliverables: builderJob.taskGroups.data,
        files: ["models.ts", "records.ts", "storage.ts"],
      },
      {
        lane: "Logic",
        title: `${buildArtifact.buildGraph.actors[0] ?? "orchestration"}-engine`,
        output: "Service layer",
        deliverables: builderJob.taskGroups.logic,
        files: ["service.ts", "policy.ts", "orchestrator.ts"],
      },
      {
        lane: "Interface",
        title: `${buildArtifact.artifactType.replaceAll("_", "-")}-surface`,
        output: "UI shell",
        deliverables: builderJob.taskGroups.interface,
        files: ["panel.tsx", "controls.tsx", "states.ts"],
      },
      {
        lane: "Governance",
        title: `${buildArtifact.buildGraph.constraints[0] ?? "governance"}-guard`,
        output: "Rule boundary",
        deliverables: builderJob.taskGroups.governance,
        files: ["rules.ts", "audit.ts", "archive.ts"],
      },
    ]
  }, [buildArtifact, builderJob])
  const selectedBuildObject = useMemo(
    () => buildSessionObjects.find((object) => object.lane === selectedBuildObjectLane) ?? buildSessionObjects[0] ?? null,
    [buildSessionObjects, selectedBuildObjectLane]
  )
  const selectedCodegenOutline = useMemo(
    () =>
      selectedBuildObject && selectedCodegenFile
        ? createCodegenFileOutline(selectedBuildObject, selectedCodegenFile, buildArtifact, builderTarget)
        : selectedBuildObject
          ? createCodegenFileOutline(selectedBuildObject, selectedBuildObject.files[0], buildArtifact, builderTarget)
          : null,
    [buildArtifact, builderTarget, selectedBuildObject, selectedCodegenFile]
  )
  const selectedCodegenDraft = useMemo(
    () =>
      selectedBuildObject && selectedCodegenFile
        ? createCodegenFileDraft(selectedBuildObject, selectedCodegenFile, buildArtifact, builderTarget)
        : selectedBuildObject
          ? createCodegenFileDraft(selectedBuildObject, selectedBuildObject.files[0], buildArtifact, builderTarget)
          : null,
    [buildArtifact, builderTarget, selectedBuildObject, selectedCodegenFile]
  )
  const selectedCommittedModule = useMemo(
    () =>
      selectedBuildObject && selectedCodegenFile && selected
        ? committedModules.find(
            (entry) =>
              entry.thesisId === selected.thesisId &&
              entry.lane === selectedBuildObject.lane &&
              entry.file === selectedCodegenFile
          ) ?? null
        : null,
    [committedModules, selected, selectedBuildObject, selectedCodegenFile]
  )
  const selectedOutputTree = useMemo(
    () => (selected ? outputTreeNodes.filter((node) => node.thesisId === selected.thesisId) : []),
    [outputTreeNodes, selected]
  )
  const selectedSavedTrees = useMemo(
    () => (selected ? savedThesisTrees.filter((tree) => tree.thesisId === selected.thesisId) : []),
    [savedThesisTrees, selected]
  )
  const selectedThesisCommittedModules = useMemo(
    () => (selected ? committedModules.filter((module) => module.thesisId === selected.thesisId) : []),
    [committedModules, selected]
  )
  const gaSourceBody = useMemo(
    () => (selected?.id === "block-1" ? activeBlock1Surface?.body ?? selected?.body ?? "" : selected?.body ?? ""),
    [activeBlock1Surface?.body, selected?.body, selected?.id]
  )
  const gaDomainModel = useMemo(
    () => extractDomainModel(normalizeEncoding(gaSourceBody), selectedAggregateAnalysis),
    [gaSourceBody, selectedAggregateAnalysis]
  )
  const gaReadiness = useMemo(
    () =>
      clamp(
        selectedAggregateAnalysis.metrics.confidence * 0.62 +
          (1 - selectedAggregateAnalysis.metrics.divergence) * 0.24 -
          gaDomainModel.missingCritical.length * 0.08 +
          gaDomainModel.constraints.length * 0.015,
        0.08,
        0.96
      ),
    [gaDomainModel.constraints.length, gaDomainModel.missingCritical.length, selectedAggregateAnalysis.metrics.confidence, selectedAggregateAnalysis.metrics.divergence]
  )
  const gaBuildContractPreview = useMemo(() => {
    const data = [
      ...(gaDomainModel.instruments.length ? [`${gaDomainModel.instruments.join(", ")} records`] : []),
      "event log",
      "audit events",
    ].slice(0, 3)
    const logic = [
      ...(selectedAggregateAnalysis.actions.length ? [`${selectedAggregateAnalysis.actions.slice(0, 2).join(" + ")} orchestration`] : []),
      "policy gates",
      "execution control",
    ].slice(0, 3)
    const ui = [
      "operator controls",
      "status surface",
      "exception routing",
    ]
    const governance = [
      ...(gaDomainModel.constraints.slice(0, 2).length ? gaDomainModel.constraints.slice(0, 2) : ["approval rules"]),
      "archive boundary",
      "oversight workflow",
    ].slice(0, 3)
    return { data, logic, ui, governance }
  }, [gaDomainModel.constraints, gaDomainModel.instruments, selectedAggregateAnalysis.actions])
  const gaFlowTrace = useMemo(() => {
    const order: Array<OutputTreeNode["stage"]> = ["composer", "output", "bridge", "builder_session", "codegen", "archive"]
    const seen = new Set(selectedOutputTree.map((node) => node.stage))
    return order.map((stage) => `${stage} (${seen.has(stage) ? "complete" : "pending"})`)
  }, [selectedOutputTree])
  const gaPanels = useMemo<GAPanel[]>(() => {
    const constraints = selectedAggregateAnalysis.constraints.length ? selectedAggregateAnalysis.constraints : ["invite-only", "governed workflow"]
    const risks = selectedAggregateAnalysis.risks.length
      ? selectedAggregateAnalysis.risks
      : ["distribution/compliance risk", "contract execution/governance failure risk"]
    const domainSignalsSummary = selectedAggregateAnalysis.domainSignals.length
      ? selectedAggregateAnalysis.domainSignals.join(", ")
      : "strong finance + governance + workflow alignment"
    return [
      { id: "ga-entities", title: "Entities", bullets: selectedAggregateAnalysis.entities.length ? selectedAggregateAnalysis.entities : ["invite-only", "vehicle", "contracts", "futures", "workflow"] },
      { id: "ga-actions", title: "Actions", bullets: selectedAggregateAnalysis.actions.length ? selectedAggregateAnalysis.actions : ["create", "trading"] },
      { id: "ga-constraints", title: "Constraints", bullets: constraints },
      { id: "ga-risks", title: "Risks", bullets: risks },
      { id: "ga-domain-signals", title: "Domain Signals", bullets: [domainSignalsSummary] },
      {
        id: "ga-metrics",
        title: "Metrics",
        bullets: [
          `${Math.round(selectedAggregateAnalysis.metrics.confidence * 100)}% confidence`,
          `${Math.round(selectedAggregateAnalysis.metrics.divergence * 100)}% divergence`,
          `${Math.round(selectedAggregateAnalysis.metrics.salience * 100)}% salience`,
          `${Math.round(selectedAggregateAnalysis.metrics.dominance * 100)}% dominance`,
        ],
      },
      { id: "ga-open", title: "Missing Questions / Unresolved", bullets: missingQuestions },
      {
        id: "ga-domain-model",
        title: "Domain Model",
        bullets: [
          `instruments: ${gaDomainModel.instruments.join(", ") || "none"}`,
          `roles: ${gaDomainModel.roles.join(", ") || "operator/governance implied"}`,
          `regulation: ${gaDomainModel.regulation.offeringRule || gaDomainModel.regulation.fundExemption || "likely incomplete unless explicit legal rule text is present"}`,
          `missingCritical: ${gaDomainModel.missingCritical.join(", ") || "none"}`,
          `assumptions: ${gaDomainModel.assumptions.join(", ") || "none"}`,
        ],
      },
      {
        id: "ga-readiness",
        title: "Readiness Score",
        bullets: [`${Math.round(gaReadiness * 100)}% readiness (gated by unresolved governance/regulatory specifics)`],
      },
      {
        id: "ga-build-contract",
        title: "Build Contract",
        bullets: [
          `Data: ${gaBuildContractPreview.data.join(", ")}`,
          `Logic: ${gaBuildContractPreview.logic.join(", ")}`,
          `Interface: ${gaBuildContractPreview.ui.join(", ")}`,
          `Governance: ${gaBuildContractPreview.governance.join(", ")}`,
          "includes deliverables, acceptance tests, done criteria",
        ],
      },
      { id: "ga-flow-trace", title: "Flow Trace", bullets: [`node progression: ${gaFlowTrace.join(" -> ")}`] },
    ]
  }, [gaBuildContractPreview.data, gaBuildContractPreview.governance, gaBuildContractPreview.logic, gaBuildContractPreview.ui, gaDomainModel.assumptions, gaDomainModel.instruments, gaDomainModel.missingCritical, gaDomainModel.regulation.fundExemption, gaDomainModel.regulation.offeringRule, gaDomainModel.roles, gaFlowTrace, gaReadiness, missingQuestions, selectedAggregateAnalysis.actions, selectedAggregateAnalysis.constraints, selectedAggregateAnalysis.domainSignals, selectedAggregateAnalysis.entities, selectedAggregateAnalysis.metrics.confidence, selectedAggregateAnalysis.metrics.divergence, selectedAggregateAnalysis.metrics.dominance, selectedAggregateAnalysis.metrics.salience, selectedAggregateAnalysis.risks])
  const finalizeGate = useMemo(() => {
    const cycleCommittedModules = selectedThesisCommittedModules
    const missing: string[] = []
    if (!selected?.title?.trim() || !selected?.body?.trim()) missing.push("Notebook thesis title/body required")
    if (!generatedOutput) missing.push("Generate output from Composer")
    if (!buildArtifact) missing.push("Build artifact missing")
    if (buildArtifact && buildArtifact.bridge.handoffStatus !== "stage_3_ready") missing.push("Bridge must reach stage_3_ready")
    if (!bridgeSubmission) missing.push("Submit bridge to Builder Intake")
    if (!builderJob || builderJob.status !== "started") missing.push("Start Builder Session")
    if (!cycleCommittedModules.length) missing.push("Commit at least one thesis module from Codegen")
    return { ok: missing.length === 0, missing }
  }, [bridgeSubmission, buildArtifact, builderJob, generatedOutput, selected, selectedThesisCommittedModules])

  const commandCatalog = useMemo<CommandDefinition[]>(
    () => [
      {
        id: "cmd-interpreter-nlp",
        label: "Interpreter: NLP",
        description: "Set active interpreter to NLP and embed command token.",
        token: "[[interpreter:nlp]]",
        onSelect: () => {
          setSingleInterpreter("nlp")
        },
      },
      {
        id: "cmd-interpreter-finance",
        label: "Interpreter: Finance",
        description: "Set active interpreter to finance and embed command token.",
        token: "[[interpreter:finance]]",
        onSelect: () => {
          setSingleInterpreter("finance")
        },
      },
      {
        id: "cmd-interpreter-governance",
        label: "Interpreter: Governance",
        description: "Set active interpreter to governance and embed command token.",
        token: "[[interpreter:governance]]",
        onSelect: () => {
          setSingleInterpreter("governance")
        },
      },
      {
        id: "cmd-interpreter-workflow",
        label: "Interpreter: Workflow",
        description: "Set active interpreter to workflow and embed command token.",
        token: "[[interpreter:workflow]]",
        onSelect: () => {
          setSingleInterpreter("workflow")
        },
      },
      {
        id: "cmd-composer-stage-define",
        label: "Composer Stage: Define",
        description: "Switch composer stage to define.",
        token: "[[composer:stage=define]]",
        onSelect: () => {
          setComposerStage("define")
        },
      },
      {
        id: "cmd-composer-stage-compose",
        label: "Composer Stage: Compose",
        description: "Switch composer stage to compose.",
        token: "[[composer:stage=compose]]",
        onSelect: () => {
          setComposerStage("compose")
        },
      },
      {
        id: "cmd-composer-stage-validate",
        label: "Composer Stage: Validate",
        description: "Switch composer stage to validate.",
        token: "[[composer:stage=validate]]",
        onSelect: () => {
          setComposerStage("validate")
        },
      },
      {
        id: "cmd-composer-stage-launch",
        label: "Composer Stage: Launch",
        description: "Switch composer stage to launch.",
        token: "[[composer:stage=launch]]",
        onSelect: () => {
          setComposerStage("launch")
        },
      },
      {
        id: "cmd-composer-merge-consensus",
        label: "Composer Merge: Consensus",
        description: "Set merge mode to consensus.",
        token: "[[composer:merge=consensus]]",
        onSelect: () => {
          setComposerMergeMode("consensus")
        },
      },
      {
        id: "cmd-composer-merge-weighted",
        label: "Composer Merge: Weighted",
        description: "Set merge mode to weighted.",
        token: "[[composer:merge=weighted]]",
        onSelect: () => {
          setComposerMergeMode("weighted")
        },
      },
      {
        id: "cmd-composer-intent-brief",
        label: "Composer Intent: Brief",
        description: "Set composer intent to brief.",
        token: "[[composer:intent=brief]]",
        onSelect: () => {
          setComposerOutputIntent("brief")
        },
      },
      {
        id: "cmd-composer-intent-spec",
        label: "Composer Intent: Spec",
        description: "Set composer intent to spec.",
        token: "[[composer:intent=spec]]",
        onSelect: () => {
          setComposerOutputIntent("spec")
        },
      },
      {
        id: "cmd-composer-intent-workflow",
        label: "Composer Intent: Workflow",
        description: "Set composer intent to workflow.",
        token: "[[composer:intent=workflow]]",
        onSelect: () => {
          setComposerOutputIntent("workflow")
        },
      },
      {
        id: "cmd-artifact-decision",
        label: "Artifact: Decision Brief",
        description: "Set artifact type to decision brief.",
        token: "[[artifact:decision_brief]]",
        onSelect: () => {
          setArtifactType("decision_brief")
        },
      },
      {
        id: "cmd-artifact-execution",
        label: "Artifact: Execution Plan",
        description: "Set artifact type to execution plan.",
        token: "[[artifact:execution_plan]]",
        onSelect: () => {
          setArtifactType("execution_plan")
        },
      },
      {
        id: "cmd-artifact-system-spec",
        label: "Artifact: System Spec",
        description: "Set artifact type to system spec.",
        token: "[[artifact:system_spec]]",
        onSelect: () => {
          setArtifactType("system_spec")
        },
      },
      {
        id: "cmd-run-output",
        label: "Run: Output",
        description: "Convert and run through output generation.",
        token: "[[run:output]]",
        onSelect: () => {},
      },
      {
        id: "cmd-run-bridge",
        label: "Run: Bridge",
        description: "Convert and auto-advance through bridge stage 3.",
        token: "[[run:bridge]]",
        onSelect: () => {},
      },
      {
        id: "cmd-run-builder",
        label: "Run: Builder",
        description: "Convert and start builder session from bridge handoff.",
        token: "[[run:builder]]",
        onSelect: () => {},
      },
      {
        id: "cmd-run-codegen",
        label: "Run: Codegen",
        description: "Convert and auto-commit first thesis module from codegen.",
        token: "[[run:codegen]]",
        onSelect: () => {},
      },
      {
        id: "cmd-run-full",
        label: "Run: Full",
        description: "Convert and execute output, bridge, builder, and codegen commit in one run.",
        token: "[[run:full]]",
        onSelect: () => {},
      },
    ],
    []
  )
  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase()
    if (!q) return commandCatalog
    return commandCatalog.filter((command) =>
      `${command.label} ${command.description} ${command.token}`.toLowerCase().includes(q)
    )
  }, [commandCatalog, commandQuery])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const storedBlocks = window.localStorage.getItem(BLOCKS_KEY)
      const storedSelected = window.localStorage.getItem(SELECTED_KEY)
      const storedArchive = window.localStorage.getItem(ARCHIVE_KEY)
      const storedBuildArtifact = window.localStorage.getItem(BUILD_ARTIFACT_KEY)
      const storedBridgeSubmission = window.localStorage.getItem(BRIDGE_SUBMISSION_KEY)
      const storedBuilderJob = window.localStorage.getItem(BUILDER_JOB_KEY)
      const storedCommittedModules = window.localStorage.getItem(COMMITTED_MODULES_KEY)
      const storedOutputTree = window.localStorage.getItem(OUTPUT_TREE_KEY)
      const storedSavedThesisTree = window.localStorage.getItem(SAVED_THESIS_TREE_KEY)
      const storedThemeMode = window.localStorage.getItem(THEME_MODE_KEY)
      if (storedBlocks) {
        const parsed = JSON.parse(storedBlocks) as ThesisBlock[]
        if (Array.isArray(parsed) && parsed.length) {
          setBlocks(
            parsed.map((block, index) => ({
              ...block,
              body: stripLegacyNotebookHelper(block.body ?? ""),
              thesisId: block.thesisId ?? `thesis-migrated-${index}-${Date.now()}`,
            }))
          )
        }
      }
      if (storedSelected) setSelectedBlockId(storedSelected)
      if (storedArchive) {
        const parsed = JSON.parse(storedArchive) as ThesisArchiveEntry[]
        if (Array.isArray(parsed) && parsed.length) setArchiveLibrary(parsed)
      }
      if (storedBuildArtifact) {
        const parsed = JSON.parse(storedBuildArtifact) as BuildArtifact
        if (parsed && typeof parsed === "object") setBuildArtifact(parsed)
      }
      if (storedBridgeSubmission) {
        const parsed = JSON.parse(storedBridgeSubmission) as BridgeSubmission
        if (parsed && typeof parsed === "object") setBridgeSubmission(parsed)
      }
      if (storedBuilderJob) {
        const parsed = JSON.parse(storedBuilderJob) as BuilderJob
        if (parsed && typeof parsed === "object") setBuilderJob(parsed)
      }
      if (storedCommittedModules) {
        const parsed = JSON.parse(storedCommittedModules) as CommittedBuildModule[]
        if (Array.isArray(parsed)) {
          setCommittedModules(
            parsed.map((module) => ({
              ...module,
              thesisId: module.thesisId ?? "legacy-thesis",
            }))
          )
        }
      }
      if (storedOutputTree) {
        const parsed = JSON.parse(storedOutputTree) as OutputTreeNode[]
        if (Array.isArray(parsed)) {
          setOutputTreeNodes(
            parsed.map((node) => ({
              ...node,
              thesisId: node.thesisId ?? node.blockId,
            }))
          )
        }
      }
      if (storedSavedThesisTree) {
        const parsed = JSON.parse(storedSavedThesisTree) as SavedThesisTree[]
        if (Array.isArray(parsed)) {
          setSavedThesisTrees(
            parsed.map((tree) => ({
              ...tree,
              thesisId: tree.thesisId ?? tree.blockId,
              tree: {
                ...tree.tree,
                thesisId: tree.tree?.thesisId ?? (tree.thesisId ?? tree.blockId),
              },
            }))
          )
        }
      }
      if (storedThemeMode === "light" || storedThemeMode === "dark") {
        setThemeMode(storedThemeMode)
      }
    } catch (error) {
      console.warn("Could not hydrate workbench state from localStorage:", error)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    if (!ready || typeof window === "undefined") return
    try {
      window.localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks))
      window.localStorage.setItem(SELECTED_KEY, selectedBlockId)
      window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archiveLibrary))
      window.localStorage.setItem(BUILD_ARTIFACT_KEY, JSON.stringify(buildArtifact))
      window.localStorage.setItem(BRIDGE_SUBMISSION_KEY, JSON.stringify(bridgeSubmission))
      window.localStorage.setItem(BUILDER_JOB_KEY, JSON.stringify(builderJob))
      window.localStorage.setItem(COMMITTED_MODULES_KEY, JSON.stringify(committedModules))
      window.localStorage.setItem(OUTPUT_TREE_KEY, JSON.stringify(outputTreeNodes))
      window.localStorage.setItem(SAVED_THESIS_TREE_KEY, JSON.stringify(savedThesisTrees))
      window.localStorage.setItem(THEME_MODE_KEY, themeMode)
    } catch (error) {
      console.warn("Could not persist workbench state to localStorage:", error)
    }
  }, [archiveLibrary, blocks, bridgeSubmission, buildArtifact, builderJob, committedModules, outputTreeNodes, ready, savedThesisTrees, selectedBlockId, themeMode])

  useEffect(() => {
    if (!statusNotice) return
    const id = window.setTimeout(() => setStatusNotice(null), 2200)
    return () => window.clearTimeout(id)
  }, [statusNotice])

  useEffect(() => {
    if (!composedThesis) return
    setGeneratedOutput(generateOutputArtifact(composedThesis, outputMode))
  }, [composedThesis, outputMode])

  useEffect(() => {
    if (activePanel === "interpreter") setInterpreterStep(0)
  }, [activePanel])

  useEffect(() => {
    if (!selectedBuildObject) {
      setSelectedCodegenFile(null)
      return
    }
    setSelectedCodegenFile((current) =>
      current && selectedBuildObject.files.includes(current) ? current : selectedBuildObject.files[0] ?? null
    )
  }, [selectedBuildObject])
  useEffect(() => {
    setCommandIndex((current) => {
      if (!filteredCommands.length) return 0
      return Math.min(current, filteredCommands.length - 1)
    })
  }, [filteredCommands])

  const archiveSummary = useMemo(() => {
    let thesis = 0
    let notebook = 0
    let tuning = 0
    let promotion = 0
    for (const entry of archiveLibrary) {
      if (entry.kind === "notebook_snapshot") notebook += 1
      else thesis += 1
      if (entry.mode === "tuning") tuning += 1
      else promotion += 1
    }
    return { total: archiveLibrary.length, thesis, notebook, tuning, promotion }
  }, [archiveLibrary])

  const filteredArchive = useMemo(() => {
    const filtered = archiveFilter === "all" ? [...archiveLibrary] : archiveLibrary.filter((entry) => entry.kind === archiveFilter)
    if (archiveSort === "oldest") return filtered.reverse()
    if (archiveSort === "mode") return [...filtered].sort((a, b) => (a.mode + a.kind + a.title).localeCompare(b.mode + b.kind + b.title))
    return filtered
  }, [archiveFilter, archiveLibrary, archiveSort])

  const outputText = useMemo(() => {
    if (outputMode === "json") {
      if (generatedOutput) return generatedOutput.content
      return JSON.stringify(
        {
          thesis_title: thesisTitle,
          interpreter: interpreterView,
          selected_interpreters: selectedInterpreters,
          metrics: analysis.metrics,
          aggregate_metrics: aggregateAnalysis.metrics,
          dominant_term: dominantTerm,
          interpreter_summary: analysis.summary,
          entities: analysis.entities,
          actions: analysis.actions,
          constraints: analysis.constraints,
          domain_signals: analysis.domainSignals,
          composer_stage: composerStage,
          archive_mode: archiveMode,
          unresolved: missingQuestions,
          domain_model: buildArtifact?.domainModel ?? null,
          build_contract: buildArtifact?.buildContract ?? null,
        },
        null,
        2
      )
    }
    if (outputMode === "spec") {
      if (generatedOutput) return generatedOutput.content
      return [
        `Thesis title: ${thesisTitle}`,
        `Interpreter: ${interpreterView === "all" ? "ALL" : interpreterView}`,
        `Selected interpreters: ${selectedInterpreters.join(", ")}`,
        `Dominant term: ${dominantTerm}`,
        `Primary location: ${analysis.metrics.location}`,
        `Interpreter summary: ${analysis.summary}`,
        `Entities: ${analysis.entities.join(", ") || "None mapped"}`,
        `Constraints: ${analysis.constraints.join(", ") || "None mapped"}`,
        `Composer stage: ${composerStage}`,
        `Archive mode: ${archiveMode}`,
        `Domain model: ${buildArtifact ? "present" : "not generated"}`,
        `Build contract: ${buildArtifact ? "present" : "not generated"}`,
      ].join("\n")
    }
    if (outputMode === "draft") {
      if (generatedOutput) return generatedOutput.content
      return [
        "Working thesis draft",
        `- Focus the thesis around "${dominantTerm}".`,
        `- Preserve ${String(analysis.metrics.location)}-level signal as a core design constraint.`,
        `- Carry forward ${analysis.domainSignals.join(", ") || "general structure"} as the strongest ${(interpreterView === "all" ? "combined" : interpreterView).toUpperCase()} domain signal.`,
        `- Add explicit checks for ${missingQuestions[0] ?? "validation"}.`,
      ].join("\n")
    }
    if (generatedOutput) return generatedOutput.content
    return [
      `The signal is concentrated around "${dominantTerm}" with ${(analysis.metrics.confidence * 100).toFixed(0)}% confidence.`,
      `The active ${(interpreterView === "all" ? "ALL" : interpreterView).toUpperCase()} interpreter view is ranking ${String(analysis.metrics.location)}-type units highest.`,
      `${analysis.summary}`,
      `Across all interpreters, combined confidence is ${(aggregateAnalysis.metrics.confidence * 100).toFixed(0)}% with ${(aggregateAnalysis.metrics.divergence * 100).toFixed(0)}% divergence.`,
      "The thesis layer should convert the top interpreted units into composable constraints, inputs, and output contracts.",
    ].join("\n\n")
  }, [aggregateAnalysis.metrics, analysis.actions, analysis.constraints, analysis.domainSignals, analysis.entities, analysis.metrics, analysis.summary, archiveMode, composerStage, dominantTerm, generatedOutput, interpreterView, missingQuestions, outputMode, selectedInterpreters, thesisTitle])

  const setBlockStatus = (id: string, status: ThesisBlock["status"]) => {
    const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, status, statusUpdatedAt: at } : block)))
    setStatusNotice({ blockId: id, status, atLabel: at })
  }

  const updateBlock = (id: string, next: Partial<ThesisBlock>) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...next } : block)))
  }

  const openCommandMenuFromInput = () => {
    if (!selected) return
    const editor =
      selected.id === "block-1"
        ? block1SurfaceRefs.current[activeBlock1SurfaceIndex] ?? null
        : inputEditableRef.current
    if (!editor) return
    const visible =
      selected.id === "block-1"
        ? stripLegacyNotebookHelper(stripEmbeddedTokens(activeBlock1Surface?.body ?? THESIS_BLOCK_1_BASELINE))
        : visibleNotebookBodyForBlock(selected)
    let start = visible.length
    let end = start
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
        const startRange = range.cloneRange()
        startRange.selectNodeContents(editor)
        startRange.setEnd(range.startContainer, range.startOffset)
        start = startRange.toString().length
        const endRange = range.cloneRange()
        endRange.selectNodeContents(editor)
        endRange.setEnd(range.endContainer, range.endOffset)
        end = endRange.toString().length
      }
    }
    setCommandSelection({ start, end })
    setCommandQuery("")
    setCommandIndex(0)
    setCommandMenuOpen(true)
  }

  const closeCommandMenu = () => {
    setCommandMenuOpen(false)
    setCommandQuery("")
    setCommandSelection(null)
  }

  useEffect(() => {
    if (!selected || !inputEditableRef.current) return
    if (selected.id === "block-1") return
    const editor = inputEditableRef.current
    const nextHtml = renderNotebookRichHtml(selected.body ?? "")
    const blockChanged = lastSyncedEditorBlockIdRef.current !== selected.id
    if (blockChanged || document.activeElement !== editor) {
      if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml
    }
    lastSyncedEditorBlockIdRef.current = selected.id
  }, [selected?.body, selected?.id])

  useEffect(() => {
    if (selected?.id !== "block-1") {
      setActiveBlock1SurfaceIndex(0)
      setBlock1DeletePromptId(null)
    }
  }, [selected?.id])

  useEffect(() => {
    setActiveBlock1SurfaceIndex((current) => {
      if (!block1Surfaces.length) return 0
      return Math.min(current, block1Surfaces.length - 1)
    })
  }, [block1Surfaces.length])

  useEffect(() => {
    if (selected?.id !== "block-1") return
    const selectedBody = selected.body?.trim()
    if (!selectedBody) return
    setBlock1Surfaces((current) => {
      const next = current.length ? [...current] : createBlock1Surfaces()
      if (!next[0]) return next
      if (next[0].body === selectedBody) return next
      next[0] = { ...next[0], body: selectedBody }
      return next
    })
  }, [selected?.body, selected?.id])

  const applyCommand = (command: CommandDefinition) => {
    if (!selected) return
    const currentBody = selected.id === "block-1" ? (activeBlock1Surface?.body ?? THESIS_BLOCK_1_BASELINE) : (selected.body ?? "")
    const currentTokens = extractEmbeddedTokens(currentBody)
    const visibleBody =
      selected.id === "block-1"
        ? stripLegacyNotebookHelper(stripEmbeddedTokens(currentBody))
        : visibleNotebookBodyForBlock(selected)
    const initialStart = commandSelection?.start ?? visibleBody.length
    const initialEnd = commandSelection?.end ?? initialStart
    let start = initialStart
    let end = initialEnd

    if (start === end) {
      while (start > 0 && /[A-Za-z0-9_-]/.test(visibleBody[start - 1] ?? "")) start -= 1
      while (end < visibleBody.length && /[A-Za-z0-9_-]/.test(visibleBody[end] ?? "")) end += 1
    }

    const selectedWord = visibleBody.slice(start, end)
    const normalizedWord = selectedWord.replace(/\*/g, "").trim()
    const commandToken = command.token.replace(/^\[\[/, "").replace(/\]\]$/, "")
    const canBindWord = Boolean(normalizedWord)
    let nextTokens = [...currentTokens]

    if (canBindWord) {
      const bindToken = `[[bind:${normalizedWord}|${commandToken}]]`
      if (!nextTokens.includes(bindToken)) nextTokens.push(bindToken)
    } else {
      if (!nextTokens.includes(command.token)) nextTokens.push(command.token)
    }

    const baseVisibleBody = visibleBody || THESIS_BLOCK_1_BASELINE
    const nextBody = composeNotebookBody(baseVisibleBody, nextTokens)
    if (selected.id === "block-1") {
      setBlock1Surfaces((current) => {
        const next = [...current]
        const target = next[activeBlock1SurfaceIndex]
        if (!target) return current
        next[activeBlock1SurfaceIndex] = { ...target, body: nextBody }
        return next
      })
      if (activeBlock1SurfaceIndex === 0) {
        updateBlock(selected.id, { body: nextBody })
      }
    } else {
      updateBlock(selected.id, { body: nextBody })
    }
    command.onSelect()
    closeCommandMenu()
    requestAnimationFrame(() => {
      const editor =
        selected.id === "block-1"
          ? block1SurfaceRefs.current[activeBlock1SurfaceIndex] ?? null
          : inputEditableRef.current
      if (!editor) return
      if (selected.id !== "block-1") editor.innerHTML = renderNotebookRichHtml(nextBody)
      editor.focus()
    })
  }

  const handleAddBlock1Panel = () => {
    setBlock1Surfaces((current) => [
      ...current,
      {
        id: `block1-surface-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        body: THESIS_BLOCK_1_BASELINE,
        editable: false,
      },
    ])
    setBlock1DeletePromptId(null)
  }

  const handleDeleteBlock1Panel = (panelId: string) => {
    setBlock1Surfaces((current) => {
      if (current.length <= 1) return current
      const next = current.filter((panel) => panel.id !== panelId)
      return next.length ? next : current
    })
    setBlock1DeletePromptId(null)
  }

  const addBlock = (seed?: Partial<ThesisBlock>) => {
    const id = seed?.id ?? `block-${Date.now()}`
    const thesisId = seed?.thesisId ?? `thesis-${Date.now()}`
    const block: ThesisBlock = {
      id,
      thesisId,
      title: seed?.title ?? `Thesis Block ${blocks.length + 1}`,
      body: seed?.body ?? "",
      status: seed?.status ?? "draft",
      statusUpdatedAt: seed?.statusUpdatedAt ?? "Just now",
    }
    setBlocks((prev) => [...prev, block])
    setSelectedBlockId(id)
    setActivePanel("input")
    return block
  }

  const archiveBlock = (block: ThesisBlock) => {
    setArchiveLibrary((prev) => [
      createThesisArchiveEntry({
        sourceText: block.body,
        interpreter: interpreterView === "all" ? `all:${selectedInterpreters.join("+")}` : interpreterView,
        mode: archiveMode,
        stage: composerStage,
        dominantTerm,
        confidence: analysis.metrics.confidence,
        divergence: analysis.metrics.divergence,
        composerConfig: JSON.stringify(composerConfig),
        generatedOutput: generatedOutput?.content,
        buildArtifact: buildArtifact ? JSON.stringify({ artifactType: buildArtifact.artifactType, readinessScore: buildArtifact.readinessScore, title: buildArtifact.title }) : undefined,
      }),
      ...prev,
    ])
    setBlockStatus(block.id, "archived")
    appendOutputTreeNode("archive", "Archived thesis block", `Archived ${block.title || block.thesisId} into thesis archive library.`, block)
    setActivePanel("archive")
  }

  const archiveNotebook = () => {
    const body = blocks.map((block, i) => `# Block ${i + 1}: ${block.title}\n${block.body}\nStatus: ${block.status} (${block.statusUpdatedAt})`).join("\n\n")
    const snapshot = createThesisArchiveEntry({
      sourceText: body,
      interpreter: interpreterView === "all" ? `all:${selectedInterpreters.join("+")}` : interpreterView,
      mode: archiveMode,
      stage: composerStage,
      dominantTerm: `notebook-${blocks.length}`,
      confidence: analysis.metrics.confidence,
      divergence: analysis.metrics.divergence,
      composerConfig: JSON.stringify(composerConfig),
      generatedOutput: generatedOutput?.content,
      buildArtifact: buildArtifact ? JSON.stringify({ artifactType: buildArtifact.artifactType, readinessScore: buildArtifact.readinessScore, title: buildArtifact.title }) : undefined,
    })
    setArchiveLibrary((prev) => [
      { ...snapshot, title: `Notebook Snapshot (${blocks.length} blocks)`, kind: "notebook_snapshot", sourceTitle: `Recovered notebook snapshot (${blocks.length} blocks)` },
      ...prev,
    ])
    if (selected) {
      appendOutputTreeNode("archive", "Archived notebook snapshot", `Saved notebook snapshot across ${blocks.length} blocks.`, selected)
    }
    setActivePanel("archive")
  }

  const openArchiveEntry = (entry: ThesisArchiveEntry) => {
    const existing = blocks.find((block) => block.id === `block-reopen-${entry.id}`)
    if (existing) {
      setSelectedBlockId(existing.id)
      return
    }
    addBlock({
      id: `block-reopen-${entry.id}`,
      thesisId: `thesis-reopen-${entry.id}`,
      title: entry.sourceTitle,
      body: entry.sourceBody,
      status: "archived",
      statusUpdatedAt: "Recovered",
    })
  }

  const submitInline = () => {
    if (!selected || !selected.body.trim()) return
    const nextTitle =
      selected.title.trim() && !/^Thesis Block \d+$/.test(selected.title.trim())
        ? selected.title
        : `Thesis: ${selected.body.trim().split(/\s+/).slice(0, 4).join(" ")}`

    updateBlock(selected.id, { title: nextTitle, status: "analyzed", statusUpdatedAt: "Submitted" })
    setStatusNotice({ blockId: selected.id, status: "analyzed", atLabel: "Submitted" })
    setActivePanel("performance")
  }

  const handleConvertToThesisBlock = () => {
    if (!selected) return
    if (selected.id === "block-1") {
      if (!(activeBlock1Surface?.body ?? "").trim()) return
    } else if (!selected.body.trim()) {
      return
    }

    const sourceBody =
      selected.id === "block-1"
        ? activeBlock1Surface?.body ?? THESIS_BLOCK_1_BASELINE
        : selected.body
    const parsed = parseEmbeddedCommands(sourceBody)
    const cleanedBody = parsed.cleanedBody || sourceBody
    const interpreterIds = parsed.overrides.interpreterIds.length ? parsed.overrides.interpreterIds : selectedInterpreters
    const nextInterpreterView =
      parsed.overrides.interpreterView ??
      (interpreterIds.includes(interpreterView as InterpreterId) ? interpreterView : interpreterIds[0] ?? "nlp")
    const nextComposerStage = parsed.overrides.composerStage ?? composerStage
    const nextComposerMergeMode = parsed.overrides.composerMergeMode ?? composerMergeMode
    const nextComposerOutputIntent = parsed.overrides.composerOutputIntent ?? composerOutputIntent
    const nextArtifactType = parsed.overrides.artifactType ?? artifactType

    const localResults = {
      raw: createInterpreterResult(cleanedBody, "raw"),
      nlp: createInterpreterResult(cleanedBody, "nlp"),
      finance: createInterpreterResult(cleanedBody, "finance"),
      music: createInterpreterResult(cleanedBody, "music"),
      governance: createInterpreterResult(cleanedBody, "governance"),
      workflow: createInterpreterResult(cleanedBody, "workflow"),
      schema: createInterpreterResult(cleanedBody, "schema"),
    } satisfies Record<InterpreterId, InterpreterResult>
    const localSelectedResults = interpreterIds.map((id) => localResults[id])
    const localAggregate = combineInterpreterResults(localSelectedResults)
    const localAnalysis =
      nextInterpreterView === "all" ? localAggregate : localResults[nextInterpreterView as InterpreterId] ?? localAggregate
    const localDominant = localAnalysis.ranked[0]?.token ?? localAggregate.ranked[0]?.token ?? dominantTerm
    const localTitle = buildThesisTitle(archiveMode, localDominant)
    const localConfig: ComposerConfig = {
      stage: nextComposerStage,
      mergeMode: nextComposerMergeMode,
      outputIntent: nextComposerOutputIntent,
    }
    const runDirectives = parsed.overrides.runDirectives
    const runLevel: Record<RunDirective, number> = {
      output: 1,
      bridge: 2,
      builder: 3,
      codegen: 4,
      full: 4,
    }
    const targetRunLevel = runDirectives.length
      ? Math.max(...runDirectives.map((directive) => runLevel[directive]))
      : 1
    const localMissingQuestions = localAnalysis.tokens.length < 10
      ? ["actor ownership", "validation threshold", "execution boundary"]
      : ["actor ownership", "validation threshold", "execution boundary", "archive routing"]
    const composed = composeThesis(localSelectedResults, localAggregate, localConfig, localTitle, localMissingQuestions)
    const baseArtifact = createBuildArtifact(composed, localAnalysis, localConfig, nextArtifactType, cleanedBody)
    let artifact = baseArtifact
    const generated = generateOutputArtifact(composed, outputMode)
    let nextBridgeSubmission: BridgeSubmission | null = null
    let nextBuilderJob: BuilderJob | null = null
    let autoCommittedModule: CommittedBuildModule | null = null

    setSelectedInterpreters(interpreterIds)
    setInterpreterView(nextInterpreterView)
    setComposerStage(nextComposerStage)
    setComposerMergeMode(nextComposerMergeMode)
    setComposerOutputIntent(nextComposerOutputIntent)
    setArtifactType(nextArtifactType)

    const nextTitle =
      selected.title.trim() && !/^Thesis Block \d+$/.test(selected.title.trim())
        ? selected.title.trim()
        : `Thesis: ${cleanedBody.trim().split(/\s+/).slice(0, 4).join(" ")}`
    updateBlock(selected.id, {
      title: nextTitle,
      body: sourceBody,
      status: "analyzed",
      statusUpdatedAt: "Converted",
    })

    if (targetRunLevel >= 2) {
      artifact = {
        ...artifact,
        bridge: {
          ...artifact.bridge,
          handoffStatus: "stage_3_ready",
        },
      }
      const submittedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      const taskGroups = {
        data: artifact.productComponents.data.slice(0, 3),
        logic: artifact.productComponents.logic.slice(0, 3),
        interface: artifact.productComponents.interface.slice(0, 3),
        governance: [...artifact.productComponents.governance.slice(0, 2), ...artifact.productComponents.storage.slice(0, 1)].slice(0, 3),
      }
      nextBridgeSubmission = {
        submittedAt,
        artifactTitle: artifact.title,
        taskGroups,
      }
      nextBuilderJob = {
        queuedAt: submittedAt,
        target: builderTarget,
        status: "queued",
        artifactTitle: artifact.title,
        taskGroups,
      }
    }

    if (targetRunLevel >= 3) {
      const startedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      nextBuilderJob = nextBuilderJob
        ? { ...nextBuilderJob, status: "started" }
        : {
            queuedAt: startedAt,
            target: builderTarget,
            status: "started",
            artifactTitle: artifact.title,
            taskGroups: {
              data: artifact.productComponents.data.slice(0, 3),
              logic: artifact.productComponents.logic.slice(0, 3),
              interface: artifact.productComponents.interface.slice(0, 3),
              governance: [...artifact.productComponents.governance.slice(0, 2), ...artifact.productComponents.storage.slice(0, 1)].slice(0, 3),
            },
          }
    }

    if (targetRunLevel >= 4) {
      const autoObject: BuildSessionObject = {
        lane: "Data",
        title: `${artifact.buildGraph.entities[0] ?? "core"}-module`,
        output: "Schema package",
        deliverables: artifact.productComponents.data.slice(0, 3),
        files: ["models.ts", "records.ts", "storage.ts"],
      }
      const autoFile = autoObject.files[0]
      const autoDraft = createCodegenFileDraft(autoObject, autoFile, artifact, builderTarget)
      const committedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      autoCommittedModule = {
        id: `${autoObject.lane}-${autoDraft.file}-${Date.now()}`,
        thesisId: selected.thesisId,
        lane: autoObject.lane,
        file: autoDraft.file,
        moduleName: autoDraft.moduleName,
        summary: autoDraft.summary,
        exports: autoDraft.exports,
        implementationNotes: autoDraft.implementationNotes,
        draft: autoDraft.draft,
        sourceObjectTitle: autoObject.title,
        committedAt,
      }
      setSelectedBuildObjectLane(autoObject.lane)
      setSelectedCodegenFile(autoFile)
    }

    setComposedThesis(composed)
    setGeneratedOutput(generated)
    setBuildArtifact(artifact)
    setBridgeSubmission(nextBridgeSubmission)
    setBuilderJob(nextBuilderJob)
    if (autoCommittedModule) {
      setCommittedModules((prev) => {
        const next = prev.filter((entry) => !(entry.thesisId === autoCommittedModule?.thesisId && entry.file === autoCommittedModule?.file && entry.lane === autoCommittedModule?.lane))
        return [autoCommittedModule, ...next]
      })
    }
    setCycleGateMessage(null)
    appendOutputTreeNode("composer", "Converted thesis block", `Applied embedded commands and composed with ${interpreterIds.map((id) => id.toUpperCase()).join(", ")}.`)
    appendOutputTreeNode("output", `Generated ${outputMode} output`, `Converted block generated ${artifact.artifactType} artifact | Ready ${Math.round(artifact.readinessScore * 100)}%.`)
    if (targetRunLevel >= 2) {
      appendOutputTreeNode("bridge", "Notebook run advanced bridge", `Auto-advanced bridge to stage_3_ready for ${artifact.title}.`)
    }
    if (targetRunLevel >= 3) {
      appendOutputTreeNode("builder_session", "Notebook run started builder", `Builder session started for ${builderTarget.replaceAll("_", " ")} target.`)
    }
    if (autoCommittedModule) {
      appendOutputTreeNode("codegen", "Notebook run committed thesis module", `${autoCommittedModule.file} committed from ${autoCommittedModule.lane} lane.`)
      appendOutputTreeNode("output", "Integrated notebook codegen commit", `Output tree updated with ${autoCommittedModule.file} from in-notebook run.`)
    }
    if (runDirectives.length) {
      const runSummary = `Notebook run executed: ${runDirectives.join(", ")}.`
      setCycleGateMessage(runSummary)
    }
    setStatusNotice({ blockId: selected.id, status: "analyzed", atLabel: "Converted" })
    setActivePanel("output")
  }

  const tools: Array<{ id: EditorPanel; label: string; icon: typeof Layers3 }> = [
    { id: "input", label: "Notebook", icon: Layers3 },
    { id: "interpreter", label: "Interpreter", icon: Boxes },
    { id: "composer", label: "Composer", icon: Boxes },
    { id: "bridge", label: "Bridge", icon: Boxes },
    { id: "builder", label: "Builder", icon: Boxes },
    { id: "builder_session", label: "Build Session", icon: Boxes },
    { id: "codegen", label: "Codegen", icon: Boxes },
    { id: "output", label: "Output", icon: FileOutput },
    { id: "performance", label: "Performance", icon: Radar },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "spatial", label: "Spatial", icon: Eye },
  ]

  const panelViewportHeight =
    activePanel === "archive" || activePanel === "input"
      ? 320
      : activePanel === "interpreter"
        ? 350
        : activePanel === "composer"
          ? 290
          : activePanel === "bridge"
            ? 300
            : activePanel === "builder"
              ? 320
              : activePanel === "builder_session"
                ? 340
                : activePanel === "codegen"
                  ? 340
        : activePanel === "performance"
          ? 320
          : activePanel === "output"
            ? 240
            : 190

  const cycleToolbarSection = (direction: 1 | -1) => {
    setToolbarSectionIndex((current) => {
      const total = 3
      return (current + direction + total) % total
    })
  }

  const toggleInterpreterSelection = (id: InterpreterId) => {
    setSelectedInterpreters((current) => {
      const exists = current.includes(id)
      const next = exists ? current.filter((entry) => entry !== id) : [...current, id]
      const normalized = next.length ? next : [id]
      setInterpreterView((view) => {
        if (view === "all") return "all"
        return normalized.includes(view) ? view : normalized[0]
      })
      return normalized
    })
  }

  const setSingleInterpreter = (id: InterpreterId) => {
    setSelectedInterpreters([id])
    setInterpreterView(id)
  }

  const appendOutputTreeNode = (
    stage: OutputTreeNode["stage"],
    label: string,
    detail: string,
    block = selected
  ) => {
    if (!block) return
    const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    setOutputTreeNodes((prev) => [
      {
        id: `${block.id}-${stage}-${Date.now()}`,
        thesisId: block.thesisId,
        blockId: block.id,
        thesisTitle: block.title || `Thesis Block ${block.id}`,
        stage,
        label,
        detail,
        at,
      },
      ...prev,
    ])
  }

  const safeFileName = (input: string) =>
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "thesis-tree"

  const downloadTextFile = (fileName: string, content: string, mime = "application/json") => {
    if (typeof window === "undefined") return
    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleSaveThesisTreeToDisk = () => {
    if (!selected) return
    if (!finalizeGate.ok) {
      setCycleGateMessage(`Finalize blocked: ${finalizeGate.missing.join(" | ")}`)
      return
    }
    const nodes = outputTreeNodes.filter((node) => node.thesisId === selected.thesisId)
    if (!nodes.length && !generatedOutput && !buildArtifact) return

    const savedAt = new Date().toLocaleString()
    const fileName = `${safeFileName(selected.title || "thesis")}-${Date.now()}.json`
    const treePayload: SavedThesisTree = {
      id: `${selected.id}-${Date.now()}`,
      thesisId: selected.thesisId,
      blockId: selected.id,
      title: selected.title || `Thesis Block ${selected.id}`,
      savedAt,
      fileName,
      tree: {
        thesisId: selected.thesisId,
        thesisTitle: selected.title,
        thesisBody: selected.body,
        outputMode,
        nodes,
        generatedOutput,
        buildArtifact,
        bridgeSubmission,
        builderJob,
        committedModules: selectedThesisCommittedModules,
      },
    }

    setSavedThesisTrees((prev) => [treePayload, ...prev])
    setArchiveLibrary((prev) => [
      {
        ...createThesisArchiveEntry({
          sourceText: selected.body,
          interpreter: "output_tree:export",
          mode: archiveMode,
          stage: "launch",
          dominantTerm,
          confidence: analysis.metrics.confidence,
          divergence: analysis.metrics.divergence,
          composerConfig: JSON.stringify(composerConfig),
          generatedOutput: JSON.stringify(treePayload.tree, null, 2),
          buildArtifact: buildArtifact ? JSON.stringify(buildArtifact) : undefined,
        }),
        title: `Thesis Tree Export (${selected.title || "untitled"})`,
        excerpt: `Saved thesis tree with ${nodes.length} nodes to disk.`,
        sourceTitle: `Exported thesis tree: ${selected.title || "untitled"}`,
        sourceBody: JSON.stringify(treePayload.tree, null, 2),
      },
      ...prev,
    ])
    downloadTextFile(fileName, JSON.stringify(treePayload.tree, null, 2))
    setCycleGateMessage(`Exported ${fileName} and reset notebook for a new thesis cycle.`)

    updateBlock(selected.id, {
      title: "",
      body: "",
      status: "draft",
      statusUpdatedAt: "Cleared for next cycle",
    })
    setComposedThesis(null)
    setGeneratedOutput(null)
    setBuildArtifact(null)
    setBridgeSubmission(null)
    setBuilderJob(null)
    setSelectedBuildObjectLane(null)
    setSelectedCodegenFile(null)
    setCommittedModules([])
    setOutputTreeNodes((prev) => prev.filter((node) => node.thesisId !== selected.thesisId))
    setActivePanel("input")
  }

  const handleExportSavedTree = (savedTree: SavedThesisTree) => {
    downloadTextFile(savedTree.fileName, JSON.stringify(savedTree.tree, null, 2))
  }

  const handleGenerateOutput = () => {
    const composed = composeThesis(selectedResults, selectedAggregateAnalysis, composerConfig, thesisTitle, missingQuestions)
    const artifact = createBuildArtifact(composed, analysis, composerConfig, artifactType, selected?.body ?? "")
    setComposedThesis(composed)
    setGeneratedOutput(generateOutputArtifact(composed, outputMode))
    setBuildArtifact(artifact)
    setCycleGateMessage(null)
    appendOutputTreeNode("composer", "Composed thesis", composed.summary)
    appendOutputTreeNode("output", `Generated ${outputMode} output`, `Artifact type: ${artifact.artifactType} | Ready ${Math.round(artifact.readinessScore * 100)}%`)
    setActivePanel("output")
  }

  const handleSendToBridgeFromComposer = () => {
    const composed = composeThesis(selectedResults, selectedAggregateAnalysis, composerConfig, thesisTitle, missingQuestions)
    const artifact = createBuildArtifact(composed, analysis, composerConfig, artifactType, selected?.body ?? "")
    const stage1Artifact = {
      ...artifact,
      bridge: {
        ...artifact.bridge,
        handoffStatus: "stage_1_embed" as const,
      },
    }

    setComposedThesis(composed)
    setGeneratedOutput(generateOutputArtifact(composed, outputMode))
    setBuildArtifact(stage1Artifact)
    setBridgeSubmission(null)
    setBuilderJob(null)
    setCycleGateMessage(null)
    appendOutputTreeNode("composer", "Composed thesis", composed.summary)
    appendOutputTreeNode("output", `Generated ${outputMode} output`, `Artifact type: ${stage1Artifact.artifactType} | Ready ${Math.round(stage1Artifact.readinessScore * 100)}%`)
    appendOutputTreeNode("bridge", "Added artifact to bridge", `Handoff reset to stage_1_embed for ${stage1Artifact.title}.`)
    setActivePanel("bridge")
  }

  const handleAddToBridge = () => {
    if (!buildArtifact) return

    setBuildArtifact((current) =>
      current
        ? {
            ...current,
            bridge: {
              ...current.bridge,
              handoffStatus: "stage_1_embed",
            },
          }
        : current
    )
    setBridgeSubmission(null)
    setBuilderJob(null)
    appendOutputTreeNode("bridge", "Added artifact to bridge", `Handoff reset to stage_1_embed for ${buildArtifact.title}.`)
    setActivePanel("bridge")
  }

  const handleAdvanceBridgeStage = (nextStage: BuildArtifact["bridge"]["handoffStatus"]) => {
    setBuildArtifact((current) => {
      if (!current) return current

      const rank = {
        stage_1_embed: 1,
        stage_2_expand: 2,
        stage_3_ready: 3,
      } as const

      if (rank[nextStage] <= rank[current.bridge.handoffStatus]) return current
      if (rank[nextStage] - rank[current.bridge.handoffStatus] > 1) return current

      return {
        ...current,
        bridge: {
          ...current.bridge,
          handoffStatus: nextStage,
        },
      }
    })
  }

  const handleHandoffSubmit = () => {
    if (!buildArtifact) return
    if (buildArtifact.bridge.handoffStatus !== "stage_3_ready") return

    const submittedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    const taskGroups = {
      data: buildArtifact.productComponents.data.slice(0, 3),
      logic: buildArtifact.productComponents.logic.slice(0, 3),
      interface: buildArtifact.productComponents.interface.slice(0, 3),
      governance: [...buildArtifact.productComponents.governance.slice(0, 2), ...buildArtifact.productComponents.storage.slice(0, 1)].slice(0, 3),
    }

    const nextArtifact = {
      ...buildArtifact,
      bridge: {
        ...buildArtifact.bridge,
        handoffStatus: "stage_3_ready" as const,
      },
    }

    setBuildArtifact(nextArtifact)
    setBridgeSubmission({
      submittedAt,
      artifactTitle: buildArtifact.title,
      taskGroups,
    })
    setBuilderJob({
      queuedAt: submittedAt,
      target: builderTarget,
      status: "queued",
      artifactTitle: buildArtifact.title,
      taskGroups,
    })
    setArchiveLibrary((prev) => [
      {
        ...createThesisArchiveEntry({
          sourceText: buildArtifact.sourceThesis,
          interpreter: `bridge:${buildArtifact.interpreterSet.join("+").toLowerCase()}`,
          mode: archiveMode,
          stage: "launch",
          dominantTerm,
          confidence: analysis.metrics.confidence,
          divergence: analysis.metrics.divergence,
          composerConfig: JSON.stringify(buildArtifact.composerConfig),
          generatedOutput: generatedOutput?.content,
          buildArtifact: JSON.stringify({
            artifactType: nextArtifact.artifactType,
            readinessScore: nextArtifact.readinessScore,
            handoffStatus: nextArtifact.bridge.handoffStatus,
            submittedAt,
          }),
        }),
        title: `Bridge Handoff (${submittedAt})`,
        excerpt: `Submitted ${nextArtifact.title} to builder intake at ${submittedAt}.`,
        sourceTitle: `Bridge handoff: ${nextArtifact.title}`,
        sourceBody: `${nextArtifact.bridge.builderPrompt}\n\nSubmitted at ${submittedAt}.`,
      },
      ...prev,
    ])
    setCycleGateMessage(null)
    appendOutputTreeNode("bridge", "Submitted to Builder Intake", `Queued ${buildArtifact.title} at ${submittedAt}.`)
    setActivePanel("builder")
  }

  const bridgeStageRank = {
    stage_1_embed: 1,
    stage_2_expand: 2,
    stage_3_ready: 3,
  } as const

  const bridgeStageState = (stage: keyof typeof bridgeStageRank) => {
    if (!buildArtifact) return "pending" as const
    const current = bridgeStageRank[buildArtifact.bridge.handoffStatus]
    const target = bridgeStageRank[stage]
    if (current > target) return "completed" as const
    if (current === target) return "current" as const
    return "pending" as const
  }

  const handleStartBuilderSession = () => {
    if (!builderJob) return

    const startedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    setSelectedBuildObjectLane(null)
    setCommittedModules([])
    setBuilderJob((current) => (current ? { ...current, status: "started" } : current))
    setArchiveLibrary((prev) => [
      {
        ...createThesisArchiveEntry({
          sourceText: buildArtifact?.sourceThesis ?? selected?.body ?? "",
          interpreter: `builder:${builderTarget}`,
          mode: archiveMode,
          stage: "launch",
          dominantTerm,
          confidence: analysis.metrics.confidence,
          divergence: analysis.metrics.divergence,
          composerConfig: JSON.stringify(composerConfig),
          generatedOutput: generatedOutput?.content,
          buildArtifact: buildArtifact
            ? JSON.stringify({
                artifactType: buildArtifact.artifactType,
                target: builderTarget,
                status: "started",
                startedAt,
              })
            : undefined,
        }),
        title: `Builder Session (${startedAt})`,
        excerpt: `Started ${builderTarget.replaceAll("_", " ")} session for ${builderJob.artifactTitle}.`,
        sourceTitle: `Builder session: ${builderJob.artifactTitle}`,
        sourceBody: buildArtifact?.bridge.builderPrompt ?? "Builder session started.",
      },
      ...prev,
    ])
    setCycleGateMessage(null)
    appendOutputTreeNode("builder_session", "Builder session started", `${builderTarget.replaceAll("_", " ")} started at ${startedAt}.`)
    setActivePanel("builder_session")
  }

  const handlePromoteToCodegen = (lane: BuildSessionObject["lane"]) => {
    setSelectedBuildObjectLane(lane)
    const targetObject = buildSessionObjects.find((object) => object.lane === lane)
    setArchiveLibrary((prev) => [
      {
        ...createThesisArchiveEntry({
          sourceText: buildArtifact?.sourceThesis ?? selected?.body ?? "",
          interpreter: `codegen:${lane.toLowerCase()}`,
          mode: archiveMode,
          stage: "launch",
          dominantTerm,
          confidence: analysis.metrics.confidence,
          divergence: analysis.metrics.divergence,
          composerConfig: JSON.stringify(composerConfig),
          generatedOutput: generatedOutput?.content,
          buildArtifact: buildArtifact
            ? JSON.stringify({
                artifactType: buildArtifact.artifactType,
                lane,
                target: builderTarget,
                promoted: true,
              })
            : undefined,
        }),
        title: `Codegen Target (${lane})`,
        excerpt: `Promoted ${lane} object into the code-generation surface.`,
        sourceTitle: `Codegen target: ${lane}`,
        sourceBody: targetObject?.title ?? buildArtifact?.bridge.builderPrompt ?? "Promoted to codegen.",
      },
      ...prev,
    ])
    appendOutputTreeNode("codegen", "Opened lane in codegen", `${lane} lane promoted to codegen.`)
    setActivePanel("codegen")
  }

  const handleCommitToBuildSession = () => {
    if (!selectedBuildObject || !selectedCodegenDraft) return

    const committedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    const committedEntry: CommittedBuildModule = {
      id: `${selectedBuildObject.lane}-${selectedCodegenDraft.file}-${Date.now()}`,
      thesisId: selected?.thesisId ?? "unassigned-thesis",
      lane: selectedBuildObject.lane,
      file: selectedCodegenDraft.file,
      moduleName: selectedCodegenDraft.moduleName,
      summary: selectedCodegenDraft.summary,
      exports: selectedCodegenDraft.exports,
      implementationNotes: selectedCodegenDraft.implementationNotes,
      draft: selectedCodegenDraft.draft,
      sourceObjectTitle: selectedBuildObject.title,
      committedAt,
    }

    setCommittedModules((prev) => {
      const next = prev.filter(
        (entry) => !(entry.lane === committedEntry.lane && entry.file === committedEntry.file)
      )
      return [committedEntry, ...next]
    })
    setArchiveLibrary((prev) => [
      {
        ...createThesisArchiveEntry({
          sourceText: buildArtifact?.sourceThesis ?? selected?.body ?? "",
          interpreter: `build_session:${committedEntry.lane.toLowerCase()}`,
          mode: archiveMode,
          stage: "launch",
          dominantTerm,
          confidence: analysis.metrics.confidence,
          divergence: analysis.metrics.divergence,
          composerConfig: JSON.stringify(composerConfig),
          generatedOutput: selectedCodegenDraft.draft,
          buildArtifact: buildArtifact
            ? JSON.stringify({
                artifactType: buildArtifact.artifactType,
                target: builderTarget,
                lane: committedEntry.lane,
                file: committedEntry.file,
                committedAt,
              })
            : undefined,
        }),
        title: `Committed Module (${committedEntry.lane})`,
        excerpt: `Committed ${committedEntry.file} into Build Session at ${committedAt}.`,
        sourceTitle: `Build Session commit: ${committedEntry.file}`,
        sourceBody: `${committedEntry.summary}\n\n${committedEntry.draft}`,
      },
      ...prev,
    ])
    const composed = composeThesis(selectedResults, selectedAggregateAnalysis, composerConfig, thesisTitle, missingQuestions)
    const refreshedArtifact = createBuildArtifact(composed, analysis, composerConfig, artifactType, selected?.body ?? "")
    setComposedThesis(composed)
    setGeneratedOutput(generateOutputArtifact(composed, outputMode))
    setBuildArtifact((current) =>
      current
        ? {
            ...refreshedArtifact,
            bridge: {
              ...refreshedArtifact.bridge,
              handoffStatus: current.bridge.handoffStatus,
            },
          }
        : refreshedArtifact
    )
    setCycleGateMessage(null)
    appendOutputTreeNode("codegen", "Committed thesis module", `${committedEntry.file} committed from ${committedEntry.lane} lane (${committedEntry.moduleName}).`)
    appendOutputTreeNode("output", "Integrated codegen commit", `Output tree updated with ${committedEntry.file} commit, exports: ${committedEntry.exports.join(", ") || "none"}.`)
    setActivePanel("output")
  }

  const renderArchive = () => (
    <>
      <div style={{ fontSize: "18px", fontWeight: 700 }}>Archive Library</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
        {(["tuning", "promotion"] as const).map((mode) => (
          <button key={mode} type="button" onClick={() => setArchiveMode(mode)} style={pill(archiveMode === mode, true)}>{mode}</button>
        ))}
        <button type="button" onClick={() => selected && archiveBlock(selected)} style={pill(false)}>Archive Thesis</button>
        <button type="button" onClick={archiveNotebook} style={pill(false)}>Archive Notebook</button>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
        {([["all", "All"], ["thesis", "Thesis"], ["notebook_snapshot", "Notebook"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setArchiveFilter(id)} style={pill(archiveFilter === id)}>{label}</button>
        ))}
        {([["newest", "Newest"], ["oldest", "Oldest"], ["mode", "Mode"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setArchiveSort(id)} style={pill(archiveSort === id)}>{label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "14px" }}>
        {[
          { label: "Total", value: archiveSummary.total, onClick: () => setArchiveFilter("all") },
          { label: "Thesis", value: archiveSummary.thesis, onClick: () => setArchiveFilter("thesis") },
          { label: "Notebook", value: archiveSummary.notebook, onClick: () => setArchiveFilter("notebook_snapshot") },
          { label: "Tuning", value: archiveSummary.tuning, onClick: () => { setArchiveSort("mode"); setArchiveMode("tuning") } },
          { label: "Promotion", value: archiveSummary.promotion, onClick: () => { setArchiveSort("mode"); setArchiveMode("promotion") } },
          { label: "Visible", value: filteredArchive.length, onClick: () => void 0 },
        ].map((card) => (
          <button key={card.label} type="button" onClick={card.onClick} style={{ ...baseCard, padding: "12px 14px", textAlign: "left", cursor: "pointer" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{card.label}</div>
            <div style={{ fontSize: "19px", fontWeight: 700, marginTop: "6px" }}>{card.value}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: "10px", marginTop: "14px", maxHeight: "360px", overflow: "auto", paddingRight: "4px" }}>
        {filteredArchive.map((entry) => (
          <div key={entry.id} style={{ ...baseCard, padding: "12px 14px" }}>
            <div style={shadowLayer()} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{entry.title}</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {badge(entry.kind === "notebook_snapshot" ? "Notebook Snapshot" : "Thesis", entry.kind === "notebook_snapshot" ? "cool" : "neutral")}
                {badge(entry.mode, "warm")}
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "rgba(102,108,118,0.82)", marginTop: "5px" }}>{entry.interpreter.toUpperCase()} | {entry.stage}</div>
            <div style={{ fontSize: "12px", color: "rgba(82,88,100,0.86)", marginTop: "8px", lineHeight: 1.5 }}>{entry.excerpt}</div>
            <div style={{ fontSize: "10px", color: "rgba(88,94,106,0.78)", marginTop: "8px", lineHeight: 1.5 }}>
              Composer config: {entry.composerConfig ? "saved" : "not saved"} | Generated output: {entry.generatedOutput ? "saved" : "not saved"} | Build artifact: {entry.buildArtifact ? "saved" : "not saved"}
            </div>
            <button type="button" onClick={() => openArchiveEntry(entry)} style={{ ...pill(false), marginTop: "10px" }}>Open in Editor</button>
          </div>
        ))}
        {filteredArchive.length === 0 && <div style={{ ...baseCard, padding: "12px 14px" }}><div style={shadowLayer()} />No archive entries match the current filter.</div>}
      </div>
    </>
  )

  const renderInputPanel = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: 700 }}>Thesis Development Input</div>
        <button type="button" onClick={() => addBlock()} style={pill(false, true)}>
          <Plus size={14} />
          Add Thesis
        </button>
      </div>
      <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.86)", marginTop: "10px", lineHeight: 1.6 }}>
        Thesis blocks are the notebook-native input format. This upper notebook section handles selection, creation, and explicit status control.
      </div>
      <div style={{ display: "grid", gap: "10px", marginTop: "14px", maxHeight: "220px", overflow: "auto", paddingRight: "4px" }}>
        {blocks.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => setSelectedBlockId(block.id)}
            style={{
              ...baseCard,
              padding: "14px 16px",
              textAlign: "left",
              cursor: "pointer",
              background:
                block.id === selectedBlockId
                  ? "linear-gradient(180deg, rgba(245,236,223,0.99), rgba(233,222,205,0.97))"
                  : "linear-gradient(180deg, rgba(245,246,245,0.98), rgba(236,237,237,0.95))",
            }}
          >
            <div style={shadowLayer()} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{block.title}</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {badge(block.status, block.status === "archived" ? "cool" : block.status === "analyzed" ? "success" : "neutral")}
                {block.id === selectedBlockId && badge("Active", "warm")}
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "rgba(82,88,100,0.86)", marginTop: "8px", lineHeight: 1.5 }}>
              {block.body.slice(0, 96) || "Empty thesis block"}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(112,118,128,0.72)", marginTop: "8px" }}>Status updated {block.statusUpdatedAt}</div>
          </button>
        ))}
      </div>
      <div style={{ ...baseCard, padding: "12px 14px", marginTop: "12px" }}>
        <div style={shadowLayer()} />
        <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Block Metrics</div>
        <div style={{ fontSize: "12px", marginTop: "8px", lineHeight: 1.7 }}>
          Characters: {selected?.body.length ?? 0}
          <br />
          Tokens: {analysis.tokens.length}
          <br />
          Dominant term: {dominantTerm}
          <br />
          Last status update: {selected?.statusUpdatedAt ?? "N/A"}
          <br />
          Insert mode: {promptInsertMode}
        </div>
      </div>
      <div style={{ ...baseCard, padding: "12px 14px", marginTop: "12px" }}>
        <div style={shadowLayer()} />
        <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Status Controls</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px", marginTop: "10px" }}>
          {(["draft", "analyzed", "archived"] as const).map((status) => (
            <button key={status} type="button" onClick={() => selected && setBlockStatus(selected.id, status)} style={pill(selected?.status === status, true)}>
              {status}
            </button>
          ))}
        </div>
        {statusNotice && selected?.id === statusNotice.blockId && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: "rgba(45,110,72,0.9)" }}>
            Status updated to {statusNotice.status.toUpperCase()} at {statusNotice.atLabel}.
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "12px" }}>
        <button type="button" onClick={() => setActivePanel("performance")} style={pill(false)}>
          View Analysis
        </button>
        <button type="button" onClick={() => selected && archiveBlock(selected)} style={pill(false)}>
          Archive Current
        </button>
      </div>
    </>
  )

  const renderOutputArtifact = () => {
    if (outputMode === "json") {
          const artifactRows = generatedOutput
        ? [
            ["Title", generatedOutput.title],
            ["Mode", generatedOutput.mode],
            ["Summary", composedThesis?.summary ?? generatedOutput.content],
            ["Generated", generatedOutput.generatedAt],
            ["Structure", composedThesis?.recommendedStructure ?? "Awaiting composition"],
            ["Entities", composedThesis?.mergedEntities.join(", ") || "None"],
            ["Actions", composedThesis?.mergedActions.join(", ") || "None"],
            ["Constraints", composedThesis?.mergedConstraints.join(", ") || "None"],
            ["Regulation", buildArtifact?.domainModel?.regulation?.offeringRule ?? "Unmapped"],
            ["Missing Critical", buildArtifact?.domainModel?.missingCritical?.join(", ") || "None"],
            ["Contract Version", buildArtifact?.buildContract?.contractVersion ?? "None"],
          ]
        : [
            ["Title", "No generated artifact yet"],
            ["Mode", outputMode],
            ["Summary", "Generate from Composer to materialize the structured output object."],
            ["Generated", "Not generated"],
            ["Structure", "Awaiting composition"],
            ["Entities", "None"],
            ["Actions", "None"],
            ["Constraints", "None"],
            ["Regulation", "Unmapped"],
            ["Missing Critical", "Unknown"],
            ["Contract Version", "None"],
          ]

      return (
        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
          {artifactRows.map(([label, value]) => (
            <div
              key={String(label)}
              style={{
                display: "grid",
                gridTemplateColumns: "96px minmax(0, 1fr)",
                gap: "10px",
                alignItems: "start",
                padding: "8px 10px",
                borderRadius: "18px",
                background: "rgba(248,249,247,0.9)",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{label}</div>
              <div style={{ fontSize: "11px", lineHeight: 1.5, color: "rgba(58,64,76,0.92)", overflowWrap: "anywhere" }}>{String(value)}</div>
            </div>
          ))}
        </div>
      )
    }

    if (outputMode === "spec") {
      return (
        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
          {[
            ["Intent", generatedOutput?.title ?? "Awaiting generation"],
            ["Primary Structure", composedThesis?.recommendedStructure ?? "Awaiting composition"],
            ["Entities", composedThesis?.mergedEntities.join(", ") || "None"],
            ["Actions", composedThesis?.mergedActions.join(", ") || "None"],
            ["Constraints", composedThesis?.mergedConstraints.join(", ") || "None"],
            ["Open Questions", missingQuestions.join(", ") || "None"],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ padding: "8px 10px", borderRadius: "18px", background: "rgba(248,249,247,0.9)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{label}</div>
              <div style={{ fontSize: "11px", lineHeight: 1.55, marginTop: "4px", color: "rgba(58,64,76,0.92)" }}>{String(value)}</div>
            </div>
          ))}
        </div>
      )
    }

    if (outputMode === "draft") {
      return (
        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
          <div style={{ padding: "10px 12px", borderRadius: "18px", background: "rgba(248,249,247,0.9)", fontSize: "11px", lineHeight: 1.65, color: "rgba(58,64,76,0.92)" }}>
            {composedThesis?.summary ?? generatedOutput?.content ?? "Generate from Composer to draft a thesis artifact."}
          </div>
          {[
            `Build around ${composedThesis?.mergedEntities.join(", ") || "the current entity set"}.`,
            `Prioritize ${composedThesis?.mergedActions.join(", ") || "the current action set"}.`,
            `Resolve ${composedThesis?.mergedConstraints.join(", ") || "open structural questions"}.`,
          ].map((line) => (
            <div key={line} style={{ padding: "8px 10px", borderRadius: "18px", background: "rgba(248,249,247,0.9)", fontSize: "11px", lineHeight: 1.55, color: "rgba(58,64,76,0.92)" }}>
              {line}
            </div>
          ))}
        </div>
      )
    }

    return (
      <div style={{ padding: "10px 12px", borderRadius: "18px", background: "rgba(248,249,247,0.9)", fontSize: "11px", lineHeight: 1.7, color: "rgba(58,64,76,0.92)", marginTop: "8px" }}>
        {composedThesis?.summary ?? generatedOutput?.content ?? outputText}
      </div>
    )
  }

  const renderOutputOverview = () => {
    if (!buildArtifact) {
      return (
        <>
          <div style={{ ...baseCard, padding: "10px 12px" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Artifact Status</div>
            <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
              No build artifact yet. Generate from Composer to produce a builder-ready package.
            </div>
          </div>
          <div style={{ ...baseCard, padding: "10px 12px" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Output Snapshot</div>
            <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
              Mode: {outputMode}
              <br />
              Generated: {generatedOutput ? generatedOutput.generatedAt : "Not generated"}
            </div>
          </div>
        </>
      )
    }

    const baseSnapshot = (
      <div style={{ ...baseCard, padding: "10px 12px" }}>
        <div style={shadowLayer()} />
        <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Artifact Snapshot</div>
        <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
          Type: {buildArtifact.artifactType.replaceAll("_", " ")}
          <br />
          Ready: {Math.round(buildArtifact.readinessScore * 100)}%
          <br />
          Handoff: {buildArtifact.bridge.handoffStatus.replaceAll("_", " ")}
          <br />
          Mode: {outputMode}
        </div>
      </div>
    )

    if (outputMode === "json") {
      return (
        <>
          <div style={{ ...baseCard, padding: "10px 12px" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Machine Payload</div>
            <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
              {buildArtifact.machinePayload.objective}
            </div>
            <div style={{ fontSize: "10px", lineHeight: 1.45, marginTop: "6px", color: "rgba(88,94,106,0.82)" }}>
              Components: {buildArtifact.machinePayload.components.slice(0, 4).join(", ")}
            </div>
          </div>
          {baseSnapshot}
        </>
      )
    }

    if (outputMode === "spec") {
      return (
        <>
          <div style={{ ...baseCard, padding: "10px 12px" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Build Graph</div>
            <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
              Stages: {buildArtifact.buildGraph.stages.join(" -> ")}
              <br />
              Dependencies: {buildArtifact.buildGraph.dependencies.join(", ")}
            </div>
          </div>
          {baseSnapshot}
        </>
      )
    }

    if (outputMode === "draft") {
      return (
        <>
          <div style={{ ...baseCard, padding: "10px 12px" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Next Actions</div>
            <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
              {buildArtifact.nextActions.map((item, index) => (
                <div key={item}>{index + 1}. {item}</div>
              ))}
            </div>
          </div>
          {baseSnapshot}
        </>
      )
    }

    return (
      <>
        <div style={{ ...baseCard, padding: "10px 12px" }}>
          <div style={shadowLayer()} />
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Build Artifact</div>
          <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
            {buildArtifact.brief}
          </div>
          <div style={{ fontSize: "10px", lineHeight: 1.45, marginTop: "6px", color: "rgba(88,94,106,0.82)" }}>
            Interpreters: {buildArtifact.interpreterSet.join(", ")}
            <br />
            Source: {buildArtifact.sourceThesis.slice(0, 92)}
          </div>
        </div>
        {baseSnapshot}
      </>
    )
  }

  const renderPanel = () => {
    if (activePanel === "input") return renderInputPanel()
    if (activePanel === "archive") return renderArchive()
    if (activePanel === "interpreter") {
      const interpreterNodeIds = ["raw", "nlp", "finance", "music", "governance", "workflow", "schema"] as const
      const heroNodeId: InterpreterId =
        interpreterView === "all" ? (selectedInterpreters[0] ?? "nlp") : (interpreterView as InterpreterId)
      const orderedNodeIds = [heroNodeId, ...interpreterNodeIds.filter((id) => id !== heroNodeId)]
      return (
        <>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>Interpreter</div>
            <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "4px" }}>
              Active lens: {interpreterView === "all" ? "Combined" : interpreterView.toUpperCase()} | {activeInterpreterAccent.label}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(102,108,118,0.82)", marginTop: "6px", textTransform: "uppercase" }}>
              {interpreterStep === 0 ? "Step 1: Nodes" : "Step 2: Synthesis"}
            </div>
          </div>
          <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
            <div
              style={{
                ...baseCard,
                padding: "14px",
                borderRadius: "28px",
                background: isDark
                  ? "radial-gradient(circle at 50% 8%, rgba(236,202,153,0.2), transparent 34%), radial-gradient(circle at 10% 74%, rgba(85,112,156,0.18), transparent 32%), linear-gradient(180deg, rgba(26,30,38,0.96), rgba(16,19,25,0.98))"
                  : "radial-gradient(circle at 50% 8%, rgba(243,223,188,0.62), transparent 34%), radial-gradient(circle at 10% 74%, rgba(197,214,238,0.58), transparent 34%), linear-gradient(180deg, rgba(243,245,249,0.98), rgba(234,237,242,0.96))",
                boxShadow: isDark
                  ? "0 26px 58px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)"
                  : "0 18px 44px rgba(88,96,114,0.18), inset 0 1px 0 rgba(255,255,255,0.72)",
                border: isDark ? "1px solid rgba(122,132,149,0.42)" : "1px solid rgba(184,192,207,0.66)",
              }}
            >
              <div style={shadowLayer()} />
              <div key={interpreterStep} style={{ display: "grid", gap: "8px", animation: "stepFade 160ms ease" }}>
              {interpreterStep === 0 ? (
                <>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--wg-command-label-fg)" }}>Interpreter Nodes</div>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginTop: "8px" }}>
                    {orderedNodeIds.map((id, position) => (
                      <div
                        key={id}
                        onClick={() => setSingleInterpreter(id)}
                        style={{
                          ...baseCard,
                          padding: position === 0 ? "14px 16px" : "10px 11px",
                          cursor: "pointer",
                          textAlign: "left",
                          borderRadius: position === 0 ? "24px" : "18px",
                          flex: position === 0 ? "1 1 100%" : "1 1 248px",
                          minWidth: position === 0 ? "100%" : "228px",
                          maxWidth: position === 0 ? "980px" : "312px",
                          minHeight: position === 0 ? "132px" : "120px",
                          background:
                            interpreterView === id
                              ? isDark
                                ? "linear-gradient(180deg, rgba(58,70,90,0.96), rgba(44,54,70,0.95))"
                                : "linear-gradient(180deg, rgba(220,232,248,0.98), rgba(202,219,242,0.96))"
                              : isDark
                                ? "linear-gradient(180deg, rgba(66,74,88,0.9), rgba(51,57,69,0.9))"
                                : "linear-gradient(180deg, rgba(247,248,250,0.98), rgba(239,241,246,0.96))",
                          border:
                            interpreterView === id
                              ? isDark
                                ? "1px solid rgba(148,167,196,0.62)"
                                : "1px solid rgba(139,170,211,0.72)"
                              : isDark
                                ? "1px solid rgba(127,138,156,0.46)"
                                : "1px solid rgba(185,195,212,0.66)",
                          boxShadow:
                            interpreterView === id
                              ? isDark
                                ? "0 16px 28px rgba(0,0,0,0.34)"
                                : "0 12px 24px rgba(113,126,148,0.2)"
                              : isDark
                                ? "0 10px 20px rgba(0,0,0,0.24)"
                                : "0 8px 16px rgba(134,145,163,0.14)",
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSingleInterpreter(id)
                          }
                        }}
                      >
                        <div style={shadowLayer()} />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px", alignItems: "center" }}>
                          <div style={{ fontSize: position === 0 ? "13px" : "11px", fontWeight: 700 }}>{id.toUpperCase()}</div>
                          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {selectedInterpreters.includes(id) && <span style={{ ...badgeStyle("cool"), padding: "3px 6px", fontSize: "8px" }}>Selected</span>}
                            {interpreterView === id && <span style={{ ...badgeStyle("cool"), padding: "3px 6px", fontSize: "8px" }}>Active</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: position === 0 ? "12px" : "10px", color: "var(--wg-input-note-fg)", marginTop: "6px", lineHeight: 1.4 }}>
                          {interpreterResults[id].entities.slice(0, 2).join(", ") || "No entities"}
                          <br />
                          Conf {Math.round(interpreterResults[id].metrics.confidence * 100)}%
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleInterpreterSelection(id)
                          }}
                          style={{ ...pill(selectedInterpreters.includes(id), true), marginTop: "8px", padding: "4px 8px", fontSize: "9px" }}
                        >
                          {selectedInterpreters.includes(id) ? "Included" : "Include"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                    <button type="button" onClick={() => setInterpreterStep(1)} style={{ ...pill(false), padding: "7px 11px", fontSize: "11px" }}>
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--wg-command-label-fg)" }}>Interpreter Synthesis</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "12px", marginTop: "8px", alignItems: "start" }}>
                    <div
                      style={{
                        borderRadius: "22px",
                        padding: "12px 14px",
                        background: isDark
                          ? "linear-gradient(180deg, rgba(59,67,80,0.84), rgba(43,49,61,0.84))"
                          : "linear-gradient(180deg, rgba(246,248,251,0.96), rgba(238,241,246,0.95))",
                        border: isDark ? "1px solid rgba(124,136,156,0.4)" : "1px solid rgba(185,196,214,0.62)",
                      }}
                    >
                      <div style={{ fontSize: "12px", lineHeight: 1.6 }}>{selectedAggregateAnalysis.summary}</div>
                      <div style={{ fontSize: "10px", marginTop: "7px", color: "var(--wg-input-note-fg)", lineHeight: 1.5 }}>
                        Consensus: {selectedAggregateAnalysis.entities.join(", ") || "None"}
                        <br />
                        Divergence: {Math.round(selectedAggregateAnalysis.metrics.divergence * 100)}%
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "10px 11px",
                        borderRadius: "20px",
                        background: isDark
                          ? "linear-gradient(180deg, rgba(66,74,92,0.9), rgba(48,55,68,0.9))"
                          : "linear-gradient(180deg, rgba(229,237,247,0.96), rgba(215,226,241,0.95))",
                        border: isDark ? "1px solid rgba(127,140,162,0.44)" : "1px solid rgba(157,178,206,0.66)",
                      }}
                    >
                      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--wg-command-label-fg)" }}>Active Node</div>
                      <div style={{ fontSize: "11px", marginTop: "4px", lineHeight: 1.45 }}>
                        {(interpreterView === "all" ? "ALL" : interpreterView.toUpperCase())} is shaping the current synthesis.
                      </div>
                      <div style={{ fontSize: "10px", marginTop: "5px", color: "var(--wg-input-note-fg)" }}>{activeInterpreterAccent.label}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                    <button type="button" onClick={() => setInterpreterStep(0)} style={{ ...pill(false), padding: "7px 11px", fontSize: "11px" }}>
                      Prev
                    </button>
                    <button type="button" onClick={() => setActivePanel("composer")} style={{ ...pill(false), padding: "7px 11px", fontSize: "11px" }}>
                      Next: Compose
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        </>
      )
    }
    if (activePanel === "composer") {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Composer</div>
              <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "4px" }}>
                {activeInterpreterAccent.label} | Building from {(interpreterView === "all" ? "combined interpreters" : `${interpreterView.toUpperCase()} interpreter`)}
              </div>
            </div>
            <button type="button" onClick={handleSendToBridgeFromComposer} style={{ ...pill(true, true), padding: "8px 12px", fontSize: "11px" }}>
              Send to Bridge
            </button>
          </div>
          <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
            <div style={{ ...baseCard, padding: "12px 14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Generate</div>
              <div style={{ fontSize: "11px", marginTop: "6px", lineHeight: 1.5 }}>
                {artifactType.replaceAll("_", " ")}
                <br />
                {composerConfig.mergeMode} merge | {composerConfig.outputIntent} output | {composerConfig.stage}
                <br />
                Lens: {activeInterpreterAccent.label}
                <br />
                Set: {selectedInterpreters.map((id) => id.toUpperCase()).join(", ")}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={handleSendToBridgeFromComposer} style={{ ...pill(false), padding: "6px 10px", fontSize: "11px" }}>
                  Send to Bridge
                </button>
                <button type="button" onClick={handleSendToBridgeFromComposer} style={{ ...pill(true, true), padding: "6px 10px", fontSize: "11px" }}>
                  Send to Bridge
                </button>
              </div>
            </div>
            <div style={{ ...baseCard, padding: "12px 14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Composer Controls</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {(["define", "compose", "validate", "launch"] as const).map((stage) => (
                  <button key={stage} type="button" onClick={() => setComposerStage(stage)} style={{ ...pill(composerStage === stage, true), padding: "5px 8px", fontSize: "10px" }}>
                    {stage}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {(["consensus", "weighted"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setComposerMergeMode(mode)} style={{ ...pill(composerMergeMode === mode), padding: "5px 8px", fontSize: "10px" }}>
                    {mode}
                  </button>
                ))}
                {(["brief", "spec", "workflow"] as const).map((intent) => (
                  <button key={intent} type="button" onClick={() => setComposerOutputIntent(intent)} style={{ ...pill(composerOutputIntent === intent, true), padding: "5px 8px", fontSize: "10px" }}>
                    {intent}
                  </button>
                  ))}
                </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {(["decision_brief", "execution_plan", "system_spec"] as const).map((type) => (
                  <button key={type} type="button" onClick={() => setArtifactType(type)} style={{ ...pill(artifactType === type, true), padding: "5px 8px", fontSize: "10px" }}>
                    {type.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...baseCard, padding: "12px 14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Build Inputs</div>
              <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px" }}>
                Entities: {analysis.entities.slice(0, 4).join(", ") || "Awaiting parse"}
                <br />
                Actions: {analysis.actions.join(", ") || "No explicit action mapped"}
                <br />
                Constraints: {analysis.constraints.join(", ") || missingQuestions.slice(0, 2).join(", ")}
                <br />
                Signals: {analysis.domainSignals.join(", ") || "General structure"}
                <br />
                Lens: {activeInterpreterAccent.label}
              </div>
            </div>
          </div>
        </>
      )
    }
    if (activePanel === "performance") {
      return (
        <>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>Performance</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "14px" }}>
            {[["Salience", analysis.metrics.salience], ["Dominance", analysis.metrics.dominance], ["Confidence", analysis.metrics.confidence], ["Divergence", analysis.metrics.divergence], ["Persistence", analysis.metrics.persistence]].map(([label, value]) => (
              <div key={String(label)} style={{ ...baseCard, padding: "10px 12px" }}>
                <div style={shadowLayer()} />
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{label}</div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "6px" }}>{Math.round((value as number) * 100)}%</div>
                <div style={{ height: "7px", borderRadius: "999px", background: "rgba(214,218,226,0.9)", marginTop: "7px" }}>
                  <div style={{ width: `${Math.round((value as number) * 100)}%`, height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, rgba(188,140,87,0.95), rgba(229,208,183,0.98))" }} />
                </div>
              </div>
            ))}
            <div style={{ ...baseCard, padding: "10px 12px" }}><div style={shadowLayer()} /><div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Location</div><div style={{ fontSize: "15px", fontWeight: 700, marginTop: "6px", textTransform: "capitalize" }}>{String(analysis.metrics.location)}</div></div>
            <div style={{ ...baseCard, padding: "10px 12px" }}><div style={shadowLayer()} /><div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Cross-Interpreter Confidence</div><div style={{ fontSize: "15px", fontWeight: 700, marginTop: "6px" }}>{Math.round(aggregateAnalysis.metrics.confidence * 100)}%</div></div>
          </div>
        </>
      )
    }
    if (activePanel === "output") {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Output Tree</div>
              <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "8px", lineHeight: 1.5 }}>
                {generatedOutput
                  ? `Generated at ${generatedOutput.generatedAt}. Build, bridge, and codegen actions are tracked in this thesis tree.`
                  : "Generate from Composer, then use this page to review, archive, and export the thesis tree."}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleSaveThesisTreeToDisk}
                disabled={!selected}
                style={{
                  ...pill(Boolean(selected), true),
                  padding: "8px 12px",
                  fontSize: "11px",
                  opacity: selected ? 1 : 0.55,
                }}
              >
                Finalize + Export
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
            {(["summary", "draft", "spec", "json"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setOutputMode(mode)} style={{ ...pill(outputMode === mode), padding: "6px 10px", fontSize: "11px" }}>{mode}</button>
            ))}
          </div>
          <div style={{ ...baseCard, padding: "10px 12px", marginTop: "10px" }}>
            <div style={shadowLayer()} />
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Finalize Gate</div>
            <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
              {finalizeGate.ok ? "All required stages complete. Ready to finalize and export." : `Blocked: ${finalizeGate.missing.join(" | ")}`}
            </div>
            {cycleGateMessage && <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px", color: "rgba(78,86,106,0.9)" }}>{cycleGateMessage}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "12px", marginTop: "14px", alignItems: "start" }}>
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ ...baseCard, padding: "12px 14px" }}>
                <div style={shadowLayer()} />
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Thesis Root</div>
                <div style={{ fontSize: "14px", fontWeight: 700, marginTop: "8px" }}>{selected?.title || "Untitled thesis block"}</div>
                <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                  Body length: {selected?.body?.trim().length ?? 0} chars
                  <br />
                  Tree nodes: {selectedOutputTree.length}
                  <br />
                  Saved exports for this block: {selectedSavedTrees.length}
                </div>
              </div>
              {renderOutputOverview()}
              {buildArtifact && (
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Codegen Foundation</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                    Artifact: {buildArtifact.title}
                    <br />
                    Target: {builderTarget.replaceAll("_", " ")}
                    <br />
                    Committed modules: {selectedThesisCommittedModules.length}
                  </div>
                </div>
              )}
            </div>
            <div style={{ ...baseCard, padding: "12px 12px 14px", minHeight: "260px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Thesis Output Tree</div>
              {selectedOutputTree.length ? (
                <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                  {selectedOutputTree.map((node, index) => (
                    <div key={node.id} style={{ borderRadius: "16px", padding: "10px 12px", background: "rgba(248,249,247,0.92)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700 }}>{index + 1}. {node.label}</div>
                        {badge(node.stage.replaceAll("_", " "), "cool")}
                      </div>
                      <div style={{ fontSize: "11px", lineHeight: 1.55, marginTop: "6px" }}>{node.detail}</div>
                      <div style={{ fontSize: "10px", color: "rgba(94,100,112,0.84)", marginTop: "6px" }}>{node.at}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                  No output nodes yet for this thesis block. Generate output and continue through bridge, builder, and codegen.
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: "12px", marginTop: "12px", alignItems: "start" }}>
            <div style={{ ...baseCard, padding: "12px 14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Generated Artifact Snapshot</div>
              {renderOutputArtifact()}
            </div>
            <div style={{ ...baseCard, padding: "12px 14px" }}>
              <div style={shadowLayer()} />
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Saved Thesis Exports</div>
                {badge(String(savedThesisTrees.length), "neutral")}
              </div>
              {savedThesisTrees.length ? (
                <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                  {savedThesisTrees.slice(0, 8).map((tree) => (
                    <div key={tree.id} style={{ borderRadius: "14px", background: "rgba(248,249,247,0.92)", padding: "10px 12px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700 }}>{tree.title || "Untitled thesis"}</div>
                      <div style={{ fontSize: "10px", color: "rgba(90,96,108,0.86)", marginTop: "4px", lineHeight: 1.5 }}>
                        Saved {tree.savedAt}
                        <br />
                        Nodes: {tree.tree.nodes.length}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportSavedTree(tree)}
                        style={{ ...pill(false), padding: "6px 10px", fontSize: "10px", marginTop: "8px" }}
                      >
                        Download JSON
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                  No saved thesis trees yet. Save and export a thesis tree to start a downloadable history list.
                </div>
              )}
            </div>
          </div>
        </>
      )
    }
    if (activePanel === "bridge") {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Bridge</div>
              <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "4px" }}>
                {bridgeSubmission ? "Builder intake is prepared from the submitted artifact handoff." : "Prepare the artifact for vector transfer and builder agent routing."}
              </div>
            </div>
          </div>
          {!buildArtifact ? (
            <div style={{ ...baseCard, padding: "14px 16px", marginTop: "14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                No build artifact is available yet. Generate an artifact in Composer, then add it to Bridge from Output.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
                {([
                  ["stage_1_embed", "Stage 1", "Embed", "Vector chunks prepared"],
                  ["stage_2_expand", "Stage 2", "Expand", "Machine payload prepared"],
                  ["stage_3_ready", "Stage 3", "Handoff", "Builder agent handoff armed"],
                ] as const).map(([stageId, step, label, copy]) => {
                  const state = bridgeStageState(stageId)
                  return (
                  <div
                    key={String(step)}
                    style={{
                      ...baseCard,
                      padding: "12px 14px",
                      background:
                        state === "completed"
                          ? "linear-gradient(180deg, rgba(230,241,233,0.99), rgba(216,233,221,0.97))"
                          : state === "current"
                            ? "linear-gradient(180deg, rgba(245,236,223,0.99), rgba(233,222,205,0.97))"
                            : baseCard.background,
                    }}
                  >
                    <div style={shadowLayer()} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                      <div style={{ fontSize: "10px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{step}</div>
                      {state === "completed" ? badge("Done", "success") : state === "current" ? badge("Current", "warm") : badge("Pending", "neutral")}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "6px" }}>{label}</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.5, marginTop: "6px", color: "rgba(82,88,100,0.86)" }}>{copy}</div>
                  </div>
                )})}
              </div>
              <div style={{ ...baseCard, padding: "10px 12px" }}>
                <div style={shadowLayer()} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", color: "rgba(82,88,100,0.88)" }}>
                    Continue flow: progress stages, then submit bridge to queue Builder Intake.
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleAdvanceBridgeStage("stage_2_expand")}
                      disabled={buildArtifact.bridge.handoffStatus !== "stage_1_embed"}
                      style={{
                        ...pill(buildArtifact.bridge.handoffStatus === "stage_1_embed", true),
                        padding: "7px 11px",
                        fontSize: "11px",
                        opacity: buildArtifact.bridge.handoffStatus === "stage_1_embed" ? 1 : 0.55,
                      }}
                    >
                      Advance: Stage 2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvanceBridgeStage("stage_3_ready")}
                      disabled={buildArtifact.bridge.handoffStatus !== "stage_2_expand"}
                      style={{
                        ...pill(buildArtifact.bridge.handoffStatus === "stage_2_expand", true),
                        padding: "7px 11px",
                        fontSize: "11px",
                        opacity: buildArtifact.bridge.handoffStatus === "stage_2_expand" ? 1 : 0.55,
                      }}
                    >
                      Mark Stage 3 Ready
                    </button>
                    <button
                      type="button"
                      onClick={handleHandoffSubmit}
                      disabled={buildArtifact.bridge.handoffStatus !== "stage_3_ready"}
                      style={{
                        ...pill(buildArtifact.bridge.handoffStatus === "stage_3_ready", true),
                        padding: "7px 11px",
                        fontSize: "11px",
                        opacity: buildArtifact.bridge.handoffStatus === "stage_3_ready" ? 1 : 0.55,
                      }}
                    >
                      Submit Bridge to Builder Intake
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "10px" }}>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Vector Payload</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                      {buildArtifact.bridge.vectorChunks.map((chunk) => (
                        <div key={chunk}>{chunk}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Transfer Status</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                      Artifact: {buildArtifact.title}
                      <br />
                      Type: {buildArtifact.artifactType.replaceAll("_", " ")}
                      <br />
                      Handoff: {buildArtifact.bridge.handoffStatus.replaceAll("_", " ")}
                      <br />
                      Ready: {Math.round(buildArtifact.readinessScore * 100)}%
                    </div>
                  </div>
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Builder Agent Prompt</div>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      borderRadius: "20px",
                      background: "rgba(248,249,247,0.9)",
                      fontSize: "11px",
                      lineHeight: 1.7,
                      color: "rgba(58,64,76,0.92)",
                    }}
                  >
                    {buildArtifact.bridge.builderPrompt}
                  </div>
                  <div style={{ ...baseCard, padding: "10px 12px", marginTop: "10px", background: "linear-gradient(180deg, rgba(246,247,245,0.96), rgba(238,239,237,0.94))" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "10px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Handoff Package</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                      Vector chunks: {buildArtifact.bridge.vectorChunks.length}
                      <br />
                      Task groups: data, logic, interface, governance
                      <br />
                      Target: {builderTarget.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setActivePanel("output")} style={{ ...pill(false), padding: "7px 11px", fontSize: "11px" }}>
                      Prev: Output
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvanceBridgeStage("stage_2_expand")}
                      disabled={buildArtifact.bridge.handoffStatus !== "stage_1_embed"}
                      style={{
                        ...pill(buildArtifact.bridge.handoffStatus === "stage_1_embed", true),
                        padding: "7px 11px",
                        fontSize: "11px",
                        opacity: buildArtifact.bridge.handoffStatus === "stage_1_embed" ? 1 : 0.55,
                      }}
                    >
                      Advance: Stage 2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvanceBridgeStage("stage_3_ready")}
                      disabled={buildArtifact.bridge.handoffStatus !== "stage_2_expand"}
                      style={{
                        ...pill(buildArtifact.bridge.handoffStatus === "stage_2_expand", true),
                        padding: "7px 11px",
                        fontSize: "11px",
                        opacity: buildArtifact.bridge.handoffStatus === "stage_2_expand" ? 1 : 0.55,
                      }}
                    >
                      Mark Stage 3 Ready
                    </button>
                    <button
                      type="button"
                      onClick={handleHandoffSubmit}
                      disabled={buildArtifact.bridge.handoffStatus !== "stage_3_ready"}
                      style={{
                        ...pill(buildArtifact.bridge.handoffStatus === "stage_3_ready", true),
                        padding: "7px 11px",
                        fontSize: "11px",
                        opacity: buildArtifact.bridge.handoffStatus === "stage_3_ready" ? 1 : 0.55,
                      }}
                    >
                      Submit Bridge to Builder Intake
                    </button>
                  </div>
                </div>
              </div>
              {bridgeSubmission && (
                <div style={{ display: "grid", gap: "10px" }}>
                  <div style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Builder Intake</div>
                        <div style={{ fontSize: "12px", marginTop: "6px", lineHeight: 1.5 }}>
                          {bridgeSubmission.artifactTitle} was submitted at {bridgeSubmission.submittedAt} and is ready for builder-agent intake.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {badge("Submitted", "success")}
                        <button
                          type="button"
                          onClick={() => setActivePanel("builder")}
                          style={{ ...pill(false), padding: "6px 10px", fontSize: "10px" }}
                        >
                          Open Builder Intake
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                    {([
                      ["Data", bridgeSubmission.taskGroups.data],
                      ["Logic", bridgeSubmission.taskGroups.logic],
                      ["Interface", bridgeSubmission.taskGroups.interface],
                      ["Governance", bridgeSubmission.taskGroups.governance],
                    ] as const).map(([label, items]) => (
                      <div key={label} style={{ ...baseCard, padding: "12px 14px" }}>
                        <div style={shadowLayer()} />
                        <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{label}</div>
                        <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                          {items.map((item) => (
                            <div key={item}>{item}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Next Builder Step</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                      The next surface should be a builder-agent intake queue that locks this payload, selects the target build mode, and starts product skeleton generation from the submitted artifact package.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )
    }
    if (activePanel === "builder") {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Builder Intake</div>
              <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "4px" }}>
                Frozen artifact payload staged for builder-agent execution.
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartBuilderSession}
              disabled={!builderJob}
              style={{ ...pill(Boolean(builderJob), true), padding: "8px 12px", fontSize: "11px", opacity: builderJob ? 1 : 0.55 }}
            >
              Start Builder Session
            </button>
          </div>
          {!buildArtifact || !builderJob ? (
            <div style={{ ...baseCard, padding: "14px 16px", marginTop: "14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                No submitted bridge handoff is queued yet. Use Bridge and submit a handoff to create a builder job.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <button type="button" onClick={() => setActivePanel("bridge")} style={{ ...pill(false), padding: "7px 11px", fontSize: "11px" }}>
                  Open Bridge
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "10px" }}>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Queued Artifact</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                      Artifact: {builderJob.artifactTitle}
                      <br />
                      Queued: {builderJob.queuedAt}
                      <br />
                      Status: {builderJob.status}
                      <br />
                      Handoff: {buildArtifact.bridge.handoffStatus.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Build Target</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                      {(["product_skeleton", "schema", "workflow", "ui_shell"] as const).map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => {
                            setBuilderTarget(target)
                            setBuilderJob((current) => (current ? { ...current, target } : current))
                          }}
                          style={{ ...pill(builderTarget === target, true), padding: "5px 8px", fontSize: "10px" }}
                        >
                          {target.replaceAll("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Frozen Builder Prompt</div>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      borderRadius: "20px",
                      background: "rgba(248,249,247,0.9)",
                      fontSize: "11px",
                      lineHeight: 1.7,
                      color: "rgba(58,64,76,0.92)",
                    }}
                  >
                    {buildArtifact.bridge.builderPrompt}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                {([
                  ["Data", builderJob.taskGroups.data],
                  ["Logic", builderJob.taskGroups.logic],
                  ["Interface", builderJob.taskGroups.interface],
                  ["Governance", builderJob.taskGroups.governance],
                ] as const).map(([label, items]) => (
                  <div key={label} style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{label}</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                      {items.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ ...baseCard, padding: "12px 14px" }}>
                <div style={shadowLayer()} />
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Execution Path</div>
                <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                  The builder session should expand the frozen artifact into implementation tasks, then generate the {builderTarget.replaceAll("_", " ")} from the locked machine payload and archived bridge lineage.
                </div>
              </div>
            </div>
          )}
        </>
      )
    }
    if (activePanel === "builder_session") {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Build Session</div>
              <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "4px" }}>
                Execution workspace for the frozen builder payload.
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setActivePanel("builder")} style={{ ...pill(false), padding: "8px 12px", fontSize: "11px" }}>
                Prev: Builder
              </button>
              {selectedBuildObject && badge(`Selected: ${selectedBuildObject.lane}`, "cool")}
              <button
                type="button"
                onClick={() => selectedBuildObject && handlePromoteToCodegen(selectedBuildObject.lane)}
                disabled={!selectedBuildObject}
                style={{
                  ...pill(Boolean(selectedBuildObject), true),
                  padding: "8px 12px",
                  fontSize: "11px",
                  opacity: selectedBuildObject ? 1 : 0.55,
                }}
              >
                Next: Open Selected in Codegen
              </button>
            </div>
          </div>
          {!buildArtifact || !builderJob ? (
            <div style={{ ...baseCard, padding: "14px 16px", marginTop: "14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                No active builder session yet. Start a builder session from Builder Intake to populate this workspace.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              <div style={{ ...baseCard, padding: "10px 12px" }}>
                <div style={shadowLayer()} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "11px", lineHeight: 1.5, color: "rgba(82,88,100,0.88)" }}>
                    Select a lane object, then use Next: Open Selected in Codegen to generate files and commit modules back into this session.
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "10px" }}>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Session Status</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                    Artifact: {builderJob.artifactTitle}
                    <br />
                    Target: {builderJob.target.replaceAll("_", " ")}
                    <br />
                    Status: {builderJob.status}
                    <br />
                    Source handoff: {buildArtifact.bridge.handoffStatus.replaceAll("_", " ")}
                  </div>
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Execution Prompt</div>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      borderRadius: "20px",
                      background: "rgba(248,249,247,0.9)",
                      fontSize: "11px",
                      lineHeight: 1.7,
                      color: "rgba(58,64,76,0.92)",
                    }}
                  >
                    Build the {builderJob.target.replaceAll("_", " ")} from this frozen artifact. Start with the task groups below, preserve the archived artifact lineage, and generate the first implementation scaffold before expanding into downstream modules.
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                {([
                  ["Data", builderJob.taskGroups.data, "Design the schemas, records, and persistence contracts."],
                  ["Logic", builderJob.taskGroups.logic, "Implement orchestration, policies, and decision flow."],
                  ["Interface", builderJob.taskGroups.interface, "Create the operator-facing controls and visibility layer."],
                  ["Governance", builderJob.taskGroups.governance, "Lock the approval, archive, and oversight mechanics."],
                ] as const).map(([label, items, copy]) => (
                  <div key={label} style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{label}</div>
                    <div style={{ fontSize: "10px", color: "rgba(88,94,106,0.82)", marginTop: "4px", lineHeight: 1.45 }}>{copy}</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                      {items.map((item, index) => (
                        <div key={item}>{index + 1}. {item}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                {buildSessionObjects.map((object) => (
                  <div
                    key={object.lane}
                    style={{
                      ...baseCard,
                      padding: "12px 14px",
                      background:
                        selectedBuildObject?.lane === object.lane
                          ? "linear-gradient(180deg, rgba(245,236,223,0.99), rgba(233,222,205,0.97))"
                          : baseCard.background,
                    }}
                  >
                    <div style={shadowLayer()} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{object.lane} Object</div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {selectedBuildObject?.lane === object.lane && badge("Selected", "warm")}
                        {badge(object.output, "neutral")}
                      </div>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>{object.title}</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                      {object.deliverables.map((item, index) => (
                        <div key={item}>{index + 1}. {item}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: "10px", lineHeight: 1.5, marginTop: "8px", color: "rgba(88,94,106,0.82)" }}>
                      Starter files: {object.files.join(", ")}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedBuildObjectLane(object.lane)}
                        style={{ ...pill(selectedBuildObject?.lane === object.lane, true), padding: "6px 10px", fontSize: "10px" }}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePromoteToCodegen(object.lane)}
                        style={{ ...pill(false), padding: "6px 10px", fontSize: "10px" }}
                      >
                        Open in Codegen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ ...baseCard, padding: "12px 14px" }}>
                <div style={shadowLayer()} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>
                    Committed Modules
                  </div>
                  {badge(`${selectedThesisCommittedModules.length}`, selectedThesisCommittedModules.length ? "success" : "neutral")}
                </div>
                {selectedThesisCommittedModules.length === 0 ? (
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                    No committed modules yet. Commit generated drafts from Codegen to capture Build Session progress.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginTop: "10px" }}>
                    {selectedThesisCommittedModules.slice(0, 6).map((module) => (
                      <div key={module.id} style={{ borderRadius: "14px", background: "rgba(247,248,246,0.88)", padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700 }}>{module.file}</div>
                          {badge(module.lane, "warm")}
                        </div>
                        <div style={{ fontSize: "10px", lineHeight: 1.6, marginTop: "6px", color: "rgba(88,94,106,0.9)" }}>
                          {module.sourceObjectTitle}
                          <br />
                          Committed {module.committedAt}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBuildObjectLane(module.lane)
                            setSelectedCodegenFile(module.file)
                            setActivePanel("codegen")
                          }}
                          style={{ ...pill(false), padding: "5px 8px", fontSize: "10px", marginTop: "8px" }}
                        >
                          Open in Codegen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>First Deliverable</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                    The first deliverable should be a scaffold for the {builderJob.target.replaceAll("_", " ")} that includes the primary entities, the orchestration shell, and the archive boundary.
                  </div>
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Next Builder Action</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                    The next system stage should open a code-generation or implementation planner surface where these task groups become concrete generated files, routes, schemas, or workflow modules.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )
    }
    if (activePanel === "codegen") {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Codegen Target</div>
              <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "4px" }}>
                Generated implementation surface for the selected build object.
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setActivePanel("builder_session")} style={{ ...pill(false), padding: "8px 12px", fontSize: "11px" }}>
                Prev: Build Session
              </button>
              <button
                type="button"
                onClick={handleCommitToBuildSession}
                disabled={!selectedBuildObject || !selectedCodegenDraft}
                style={{
                  ...pill(Boolean(selectedBuildObject && selectedCodegenDraft), true),
                  padding: "8px 12px",
                  fontSize: "11px",
                  opacity: selectedBuildObject && selectedCodegenDraft ? 1 : 0.55,
                }}
              >
                Commit Thesis Module
              </button>
            </div>
          </div>
          {!buildArtifact || !selectedBuildObject ? (
            <div style={{ ...baseCard, padding: "14px 16px", marginTop: "14px" }}>
              <div style={shadowLayer()} />
              <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                No build object is selected yet. Choose an implementation object in Build Session and promote it to Codegen.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "10px" }}>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Selected Object</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>{selectedBuildObject.title}</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                    Lane: {selectedBuildObject.lane}
                    <br />
                    Output: {selectedBuildObject.output}
                    <br />
                    Target: {builderTarget.replaceAll("_", " ")}
                  </div>
                  {selectedCommittedModule && (
                    <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {badge("Committed", "success")}
                      {badge(selectedCommittedModule.committedAt, "cool")}
                    </div>
                  )}
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Codegen Prompt</div>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      borderRadius: "20px",
                      background: "rgba(248,249,247,0.9)",
                      fontSize: "11px",
                      lineHeight: 1.7,
                      color: "rgba(58,64,76,0.92)",
                    }}
                  >
                    Generate the {selectedBuildObject.output.toLowerCase()} for {selectedBuildObject.title}. Use the starter files {selectedBuildObject.files.join(", ")}. Implement the deliverables below while preserving the archived artifact constraints and the {builderTarget.replaceAll("_", " ")} target.
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Generated Module Surface</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                    Module: {selectedBuildObject.title}
                    <br />
                    Files:
                    {selectedBuildObject.files.map((file) => (
                      <div key={file}>- {file}</div>
                    ))}
                  </div>
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Deliverables</div>
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                    {selectedBuildObject.deliverables.map((item, index) => (
                      <div key={item}>{index + 1}. {item}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: "10px" }}>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Starter Files</div>
                  <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                    {selectedBuildObject.files.map((file) => {
                      const isCommitted = committedModules.some(
                        (entry) =>
                          entry.thesisId === (selected?.thesisId ?? "") &&
                          entry.lane === selectedBuildObject.lane &&
                          entry.file === file
                      )
                      return (
                        <button
                          key={file}
                          type="button"
                          onClick={() => setSelectedCodegenFile(file)}
                          style={{
                            ...pill(selectedCodegenFile === file, true),
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            fontSize: "11px",
                          }}
                        >
                          <span>{file}</span>
                          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {isCommitted && badge("Committed", "success")}
                            {selectedCodegenFile === file && badge("Open", "warm")}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ ...baseCard, padding: "12px 14px" }}>
                  <div style={shadowLayer()} />
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>
                    {selectedCodegenOutline?.file ?? "Generated File Outline"}
                  </div>
                  {selectedCodegenOutline ? (
                    <>
                      <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                      {selectedCodegenOutline.purpose}
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 700, marginTop: "10px" }}>Key Sections</div>
                      <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                        {selectedCodegenOutline.sections.map((section, index) => (
                          <div key={section}>{index + 1}. {section}</div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 12px",
                          borderRadius: "18px",
                          background: "rgba(248,249,247,0.92)",
                          fontSize: "11px",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          fontFamily: "\"IBM Plex Mono\", \"Fira Code\", monospace",
                          color: "rgba(54,60,72,0.92)",
                        }}
                      >
                        {selectedCodegenOutline.snippet}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                      Select a starter file to inspect its generated outline.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ ...baseCard, padding: "12px 14px" }}>
                <div style={shadowLayer()} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Generated Module Draft</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>
                      {selectedCodegenDraft?.moduleName ?? "No module selected"}
                    </div>
                  </div>
                  {selectedCodegenDraft && badge(selectedCodegenDraft.file, "warm")}
                </div>
                {selectedCodegenDraft ? (
                  <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "10px", marginTop: "10px" }}>
                    <div>
                      <div style={{ fontSize: "11px", lineHeight: 1.6 }}>{selectedCodegenDraft.summary}</div>
                      <div style={{ fontSize: "11px", fontWeight: 700, marginTop: "10px" }}>Exports</div>
                      <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                        {selectedCodegenDraft.exports.map((item) => (
                          <div key={item}>- {item}</div>
                        ))}
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 700, marginTop: "10px" }}>Implementation Notes</div>
                      <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "6px" }}>
                        {selectedCodegenDraft.implementationNotes.map((item, index) => (
                          <div key={item}>{index + 1}. {item}</div>
                        ))}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "20px",
                        background: "rgba(248,249,247,0.94)",
                        fontSize: "11px",
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                        fontFamily: "\"IBM Plex Mono\", \"Fira Code\", monospace",
                        color: "rgba(54,60,72,0.94)",
                      }}
                    >
                      {selectedCodegenDraft.draft}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                    Select a starter file to generate a fuller module draft.
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
                {selectedBuildObject.files.map((file) => (
                  <div key={file} style={{ ...baseCard, padding: "12px 14px" }}>
                    <div style={shadowLayer()} />
                    <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>{file}</div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6, marginTop: "8px" }}>
                      {createCodegenFileOutline(selectedBuildObject, file, buildArtifact, builderTarget).purpose}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )
    }
    if (activePanel === "spatial") {
      return (
        <>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>Spatial</div>
          <div style={{ ...baseCard, padding: "18px", marginTop: "14px" }}>
            <div style={shadowLayer()} />
            <div style={{ height: "240px", borderRadius: "24px", border: "1px dashed rgba(196,202,212,0.9)", background: "radial-gradient(circle at 20% 28%, rgba(214,194,168,0.88), transparent 18%), radial-gradient(circle at 68% 52%, rgba(183,203,240,0.84), transparent 20%), radial-gradient(circle at 82% 24%, rgba(211,180,168,0.78), transparent 18%), rgba(250,251,252,0.8)" }} />
            <div style={{ marginTop: "12px", fontSize: "12px", color: "rgba(82,88,100,0.86)" }}>The 3D dome remains available as the high-context visualization surface.</div>
          </div>
        </>
      )
    }
    return null
  }

  const renderMainSection = () => {
    if (activePanel === "input") {
      return selected ? (
        <>
          <input
            value={selected.title}
            onChange={(event) => updateBlock(selected.id, { title: event.target.value })}
            style={{
              width: "100%",
              borderRadius: "24px",
              border: "none",
              background: "var(--wg-title-input-bg)",
              color: "var(--wg-title-input-fg)",
              padding: "20px 22px",
              fontSize: "19px",
              fontWeight: 700,
              boxShadow: "var(--wg-title-input-inset)",
            }}
          />
          <div style={{ position: "relative", width: "100%", minHeight: "100%", flex: 1 }}>
            {selected.id === "block-1" ? (
              <div style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", paddingLeft: "2px" }}>
                  {badge(activeBlock1Surface?.editable ? "Editable" : "Fixed", activeBlock1Surface?.editable ? "warm" : "neutral")}
                </div>
                <div
                  style={{
                    borderRadius: "30px",
                    padding: "20px 16px 18px",
                    background: isDark
                      ? "radial-gradient(circle at 50% 4%, rgba(248,223,183,0.2), transparent 38%), radial-gradient(circle at 8% 78%, rgba(87,106,142,0.18), transparent 34%), linear-gradient(180deg, rgba(34,39,50,0.9), rgba(21,24,31,0.92))"
                      : "radial-gradient(circle at 52% 5%, rgba(243,226,194,0.68), transparent 38%), radial-gradient(circle at 12% 78%, rgba(193,212,238,0.6), transparent 34%), linear-gradient(180deg, rgba(245,247,251,0.98), rgba(235,238,244,0.97))",
                    boxShadow: isDark
                      ? "0 24px 56px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)"
                      : "0 16px 38px rgba(102,112,131,0.17), inset 0 1px 0 rgba(255,255,255,0.8)",
                    border: isDark ? "1px solid rgba(118,126,141,0.36)" : "1px solid rgba(186,194,208,0.64)",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px", alignItems: "stretch" }}>
                    {block1Surfaces.map((surface, index) => (
                      <div
                        key={surface.id}
                        style={{
                          position: "relative",
                          flex: index === 0 ? "1 1 100%" : "1 1 290px",
                          maxWidth: index === 0 ? "1120px" : "332px",
                          minWidth: index === 0 ? "100%" : "260px",
                          minHeight: index === 0 ? "132px" : "188px",
                        }}
                      >
                        <div
                          className="hide-scrollbars"
                          ref={(el) => {
                            block1SurfaceRefs.current[index] = el
                          }}
                          tabIndex={0}
                          contentEditable={surface.editable}
                          suppressContentEditableWarning
                          onFocus={() => {
                            setActiveBlock1SurfaceIndex(index)
                          }}
                          onClick={(event) => {
                            setActiveBlock1SurfaceIndex(index)
                            if (event.detail === 3) {
                              setBlock1DeletePromptId(surface.id)
                            }
                          }}
                          onDoubleClick={() => {
                            setBlock1Surfaces((current) => {
                              const next = [...current]
                              const target = next[index]
                              if (!target) return current
                              next[index] = { ...target, editable: !target.editable }
                              return next
                            })
                          }}
                          onInput={(event) => {
                            if (!surface.editable) return
                            const visibleText = event.currentTarget.innerText.replace(/\r\n/g, "\n")
                            setBlock1Surfaces((current) => {
                              const next = [...current]
                              const target = next[index]
                              if (!target) return current
                              const tokens = extractEmbeddedTokens(target.body ?? "")
                              const nextBody = composeNotebookBody(visibleText, tokens)
                              next[index] = { ...target, body: nextBody }
                              return next
                            })
                            if (index === 0) {
                              const tokens = extractEmbeddedTokens(surface.body ?? "")
                              updateBlock(selected.id, { body: composeNotebookBody(visibleText, tokens) })
                            }
                          }}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                              event.preventDefault()
                              setActiveBlock1SurfaceIndex(index)
                              openCommandMenuFromInput()
                              return
                            }
                            if (!surface.editable && (event.key === "Backspace" || event.key === "Delete" || (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey))) {
                              event.preventDefault()
                            }
                            if (!commandMenuOpen) return
                            if (event.key === "Escape") {
                              event.preventDefault()
                              closeCommandMenu()
                            }
                          }}
                          style={{
                            width: "100%",
                            minHeight: index === 0 ? "108px" : "188px",
                            flex: 1,
                            display: "flex",
                            alignItems: index === 0 ? "center" : "flex-start",
                            borderRadius: index === 0 ? "30px" : "24px",
                            border: "none",
                            background: "transparent",
                            color: "var(--wg-panel-fg)",
                            padding: index === 0 ? "0 18px" : "14px 14px 12px",
                            fontSize: index === 0 ? "20px" : "16px",
                            lineHeight: 1.65,
                            fontFamily: "\"Inter\", \"Segoe UI\", sans-serif",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            outline: "none",
                            overflow: index === 0 ? "hidden" : "auto",
                            opacity: 1,
                            cursor: surface.editable ? "text" : "default",
                            boxShadow: "none",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: renderNotebookRichHtml(surface.body),
                          }}
                        />
                        {index > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: "10px",
                              padding: "3px 7px",
                              borderRadius: "999px",
                              fontSize: "10px",
                              fontWeight: 700,
                              letterSpacing: "0.02em",
                              color: isDark ? "rgba(227,232,241,0.9)" : "rgba(73,84,100,0.9)",
                              background: isDark ? "rgba(22,26,34,0.5)" : "rgba(245,249,253,0.82)",
                              border: isDark ? "1px solid rgba(132,142,160,0.34)" : "1px solid rgba(173,183,201,0.56)",
                              pointerEvents: "none",
                            }}
                          >
                            Panel {index + 1}
                          </div>
                        )}
                        {block1DeletePromptId === surface.id && (
                          <div
                            contentEditable={false}
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              display: "grid",
                              gap: "6px",
                              background: "var(--wg-delete-pop-bg)",
                              border: "1px solid var(--wg-delete-pop-border)",
                              borderRadius: "12px",
                              padding: "8px",
                              zIndex: 4,
                              boxShadow: "var(--wg-delete-pop-shadow)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeleteBlock1Panel(surface.id)
                              }}
                              disabled={block1Surfaces.length <= 1}
                              style={{
                                ...pill(block1Surfaces.length > 1, true),
                                padding: "5px 8px",
                                fontSize: "10px",
                                opacity: block1Surfaces.length > 1 ? 1 : 0.55,
                                justifyContent: "center",
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setBlock1DeletePromptId(null)
                              }}
                              style={{ ...pill(false), padding: "5px 8px", fontSize: "10px", justifyContent: "center" }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          contentEditable={false}
                          onClick={(event) => {
                            event.stopPropagation()
                            setBlock1DeletePromptId(surface.id)
                          }}
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "10px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "999px",
                            border: "1px solid var(--wg-delete-icon-border)",
                            background: "var(--wg-delete-icon-bg)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: block1DeletePromptId === surface.id ? 1 : 0,
                            pointerEvents: block1DeletePromptId === surface.id ? "auto" : "none",
                          }}
                          aria-label="Delete panel"
                          title="Delete panel"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                    {gaPanels.map((panel) => (
                      <div
                        key={panel.id}
                        style={{
                          width: "100%",
                          minHeight: "92px",
                          borderRadius: "20px",
                          background: "transparent",
                          color: isDark ? "rgba(232,238,246,0.95)" : "rgba(51,58,69,0.95)",
                          padding: "12px 14px",
                          boxShadow: "none",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.02em", marginBottom: "8px", opacity: 0.96 }}>
                          {panel.title}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "16px", display: "grid", gap: "4px", fontSize: "16px", lineHeight: 1.5 }}>
                          {panel.bullets.map((bullet, bulletIndex) => (
                            <li key={`${panel.id}-${bulletIndex}`}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "2px" }}>
                      <button
                        type="button"
                        onClick={handleAddBlock1Panel}
                        style={{
                          ...pill(false, true),
                          width: "36px",
                          height: "36px",
                          padding: 0,
                          borderRadius: "999px",
                          justifyContent: "center",
                        }}
                        title="Add panel"
                        aria-label="Add panel"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="hide-scrollbars"
                ref={inputEditableRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => {
                  const visibleText = event.currentTarget.innerText.replace(/\r\n/g, "\n")
                  const tokens = extractEmbeddedTokens(selected.body ?? "")
                  updateBlock(selected.id, { body: composeNotebookBody(visibleText, tokens) })
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault()
                    openCommandMenuFromInput()
                    return
                  }
                  if (!commandMenuOpen) return
                  if (event.key === "Escape") {
                    event.preventDefault()
                    closeCommandMenu()
                  }
                }}
                style={{
                  width: "100%",
                  minHeight: "100%",
                  flex: 1,
                  borderRadius: "28px",
                  border: "none",
                  background: "var(--wg-editor-bg)",
                  color: "var(--wg-editor-fg)",
                  padding: "8px 10px",
                  fontSize: "18px",
                  lineHeight: 1.65,
                  fontFamily: "\"Inter\", \"Segoe UI\", sans-serif",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  outline: "none",
                  overflow: "hidden",
                }}
              />
            )}
          </div>
          {commandMenuOpen && (
            <div style={{ ...baseCard, padding: "10px 12px", marginTop: "10px", borderRadius: "22px" }}>
              <div style={shadowLayer()} />
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--wg-command-label-fg)" }}>Command Embed</div>
                {badge("Cmd/Ctrl+Enter", "cool")}
              </div>
              <input
                value={commandQuery}
                onChange={(event) => {
                  setCommandQuery(event.target.value)
                  setCommandIndex(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setCommandIndex((current) => Math.min(current + 1, Math.max(filteredCommands.length - 1, 0)))
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setCommandIndex((current) => Math.max(current - 1, 0))
                  } else if (event.key === "Enter") {
                    event.preventDefault()
                    const command = filteredCommands[commandIndex]
                    if (command) applyCommand(command)
                  } else if (event.key === "Escape") {
                    event.preventDefault()
                    closeCommandMenu()
                  }
                }}
                placeholder="Search command: interpreter, composer, artifact..."
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--wg-command-input-bg)",
                  padding: "9px 10px",
                  fontSize: "12px",
                  color: "var(--wg-command-input-fg)",
                  outline: "none",
                }}
              />
              <div className="hide-scrollbars touch-pan-both" style={{ maxHeight: "180px", overflowY: "auto", marginTop: "8px", display: "grid", gap: "6px" }}>
                {filteredCommands.length ? (
                  filteredCommands.map((command, index) => (
                    <button
                      key={command.id}
                      type="button"
                      onClick={() => applyCommand(command)}
                      style={{
                        ...pill(index === commandIndex, true),
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        fontSize: "11px",
                      }}
                    >
                      <span style={{ display: "grid", textAlign: "left", gap: "2px" }}>
                        <span>{command.label}</span>
                        <span style={{ fontSize: "10px", opacity: 0.82 }}>{command.description}</span>
                      </span>
                      {badge(command.token, "neutral")}
                    </button>
                  ))
                ) : (
                  <div style={{ fontSize: "11px", lineHeight: 1.6, padding: "8px 4px", color: "var(--wg-command-empty-fg)" }}>
                    No commands match this query.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>No thesis block selected.</div>
      )
    }

    return (
      <div
        className="hide-scrollbars touch-pan-both"
        style={{
          ...baseCard,
          padding: "22px 24px",
          height: "100%",
          borderRadius: "30px",
          background: "linear-gradient(180deg, rgba(248,248,246,0.94), rgba(239,240,238,0.9))",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div style={shadowLayer()} />
        {renderPanel()}
      </div>
    )
  }

  const renderOutputSection = () => (
    <>
      <div style={{ fontSize: "18px", fontWeight: 700 }}>Output</div>
      <div style={{ fontSize: "12px", color: "rgba(88,94,106,0.82)", marginTop: "8px", lineHeight: 1.5 }}>
        {generatedOutput
          ? `Generated from composer at ${generatedOutput.generatedAt}.`
          : "Output foundation. Use Composer to generate a result artifact."}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
        {(["summary", "draft", "spec", "json"] as const).map((mode) => (
          <button key={mode} type="button" onClick={() => setOutputMode(mode)} style={pill(outputMode === mode)}>
            {mode}
          </button>
        ))}
      </div>
      {composedThesis && (
        <div style={{ ...baseCard, padding: "12px 14px", marginTop: "14px" }}>
          <div style={shadowLayer()} />
          <div style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(102,108,118,0.82)" }}>Generated Thesis</div>
          <div style={{ fontSize: "12px", marginTop: "8px", lineHeight: 1.6 }}>
            {composedThesis.title}
            <br />
            {composedThesis.recommendedStructure}
          </div>
        </div>
      )}
      <div style={{ ...baseCard, padding: "18px", marginTop: "14px" }}>
        <div style={shadowLayer()} />
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            color: "rgba(58,64,76,0.92)",
            fontSize: "12px",
            lineHeight: 1.7,
            fontFamily: "'Consolas', 'Courier New', monospace",
            maxHeight: "340px",
            overflow: "hidden",
          }}
        >
          {outputText}
        </pre>
      </div>
    </>
  )

  const toolbarSections = [
    {
      id: "tools",
      label: "Core Tools",
      content: tools.map((tool) => {
        const Icon = tool.icon
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActivePanel(tool.id)}
            style={{ ...pill(activePanel === tool.id, true), padding: "8px 12px", fontSize: "11px", flex: "0 0 auto" }}
          >
            <Icon size={12} />
            {tool.label}
          </button>
        )
      }),
    },
    {
      id: "insert",
      label: "Insert Modes",
      content: ([
        ["append", "Append"],
        ["prepend", "Insert Top"],
        ["paragraph", "Paragraph"],
      ] as const).map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => setPromptInsertMode(mode)}
          style={{ ...pill(promptInsertMode === mode, mode === "paragraph"), padding: "8px 12px", fontSize: "11px", flex: "0 0 auto" }}
        >
          {label}
        </button>
      )),
    },
    {
      id: "actions",
      label: "Actions",
      content: [
        <button
          key="archive"
          type="button"
          onClick={() => selected && archiveBlock(selected)}
          style={{ ...pill(false), padding: "8px 12px", fontSize: "11px", flex: "0 0 auto" }}
        >
          Submit to Archive
        </button>,
        <button
          key="spatial"
          type="button"
          onClick={onOpenSpatial}
          style={{ ...pill(false), padding: "8px 12px", fontSize: "11px", flex: "0 0 auto" }}
        >
          Open Spatial Scene
        </button>,
        <button
          key="submit"
          type="button"
          onClick={submitInline}
          style={{
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(180deg, rgba(240,229,212,1), rgba(228,214,195,0.94))",
            color: "rgba(88,59,24,0.96)",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 700,
            boxShadow: "0 12px 22px rgba(132,113,92,0.16)",
            flex: "0 0 auto",
          }}
        >
          Submit
        </button>,
      ],
    },
  ] as const

  const activeToolbarSection = toolbarSections[toolbarSectionIndex]
  const showBottomOutputSection = activePanel === "output"

  return (
    <div
      className="workbench-scroll-shell"
      style={{
        height: "100vh",
        ...themeVars,
        background: "var(--wg-shell-bg)",
        color: "var(--wg-shell-fg)",
        padding: 0,
        fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <style>{`
        .workbench-scroll-shell {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .workbench-scroll-shell::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        .hide-scrollbars {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbars::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        .touch-pan-x {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pinch-zoom;
        }
        .touch-pan-both {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pan-y pinch-zoom;
        }
        @keyframes stepFade {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0, alignItems: "start" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              ...baseCard,
              minHeight: "100vh",
              borderRadius: 0,
              padding: "28px 32px 36px",
              boxShadow: "none",
              background: "var(--wg-main-bg)",
            }}
          >
            <div
              style={{
                marginBottom: "18px",
                padding: "2px 0 0",
                display: "grid",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "6px",
                  paddingBottom: "2px",
                }}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    cycleToolbarSection(1)
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    cycleToolbarSection(-1)
                  }
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: "52px",
                    borderRadius: "18px",
                    background: "var(--wg-rail-bg)",
                    boxShadow: "var(--wg-rail-inset)",
                    padding: "8px 14px",
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => cycleToolbarSection(-1)}
                      style={{
                        border: "none",
                        background: "var(--wg-ctrl-bg)",
                        color: "var(--wg-ctrl-fg)",
                        width: "30px",
                        height: "30px",
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        flex: "0 0 auto",
                      }}
                      aria-label="Show previous toolbar section"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <div style={{ width: "1px", height: "24px", background: "var(--wg-divider)" }} />
                    <button
                      type="button"
                      onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
                      style={{
                        border: "none",
                        background: "var(--wg-ctrl-bg)",
                        color: "var(--wg-ctrl-fg)",
                        width: "30px",
                        height: "30px",
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        flex: "0 0 auto",
                      }}
                      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                      title={isDark ? "Light mode" : "Dark mode"}
                    >
                      {isDark ? <Sun size={13} /> : <Moon size={13} />}
                    </button>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {toolbarSections.map((section, index) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setToolbarSectionIndex(index)}
                          style={{
                            border: "none",
                            background: toolbarSectionIndex === index ? "var(--wg-section-active-bg)" : "var(--wg-section-bg)",
                            color: toolbarSectionIndex === index ? "var(--wg-section-active-fg)" : "var(--wg-section-fg)",
                            padding: "7px 10px",
                            borderRadius: "10px",
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          {section.label.replace(" ", "")}
                        </button>
                      ))}
                    </div>
                    <div style={{ width: "1px", height: "24px", background: "var(--wg-divider)" }} />
                    <button
                      type="button"
                      onClick={() => cycleToolbarSection(1)}
                      style={{
                        border: "none",
                        background: "var(--wg-ctrl-bg)",
                        color: "var(--wg-ctrl-fg)",
                        width: "30px",
                        height: "30px",
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        flex: "0 0 auto",
                      }}
                      aria-label="Show next toolbar section"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                    <div
                      className="hide-scrollbars touch-pan-x"
                      onWheel={(event) => {
                        event.preventDefault()
                        const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
                        event.currentTarget.scrollLeft += dominantDelta
                      }}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        overflowX: "auto",
                        maxWidth: "100%",
                        minWidth: 0,
                        flex: 1,
                        paddingBottom: "2px",
                      }}
                    >
                      {activeToolbarSection.content}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                borderRadius: "38px",
                background: "var(--wg-canvas-bg)",
                boxShadow: "var(--wg-canvas-inset)",
                minHeight: "650px",
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: showBottomOutputSection ? "minmax(380px, 1.12fr) minmax(290px, 0.88fr)" : "minmax(560px, 1fr)",
              }}
            >
              <div className="hide-scrollbars touch-pan-both" style={{ padding: "22px 24px 26px", display: "grid", gap: "16px", overflowX: "hidden", overflowY: "auto" }}>
                {renderMainSection()}
              </div>

              {showBottomOutputSection && (
                <div
                  style={{
                    padding: "18px 20px 20px",
                    borderTop: "var(--wg-bottom-border)",
                    display: "grid",
                    gap: "14px",
                    overflow: "hidden",
                    background: "var(--wg-bottom-bg)",
                  }}
                >
                  <div
                    className="hide-scrollbars"
                    style={{
                      ...baseCard,
                      padding: "16px 18px",
                      height: `${panelViewportHeight}px`,
                      overflow: "hidden",
                      borderRadius: "28px",
                      background: "var(--wg-output-card-bg)",
                    }}
                  >
                    <div style={shadowLayer()} />
                    {renderOutputSection()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
