// Pure, deterministic rotation recombination engine.
//
// Product rule: the player's selected 1-4 characters are authoritative. We only
// emit steps from reviewed rotation presets that carry source evidence. Source
// order is never inferred from selection order or skill type. Steps from a
// source retain that source's authored order; steps for unselected characters
// are always removed. Multiple sources are explicitly represented as segments,
// never disguised as one guide.

import type { RotationPreset, RotationStep } from '@/types/domain'

export type RotationRecombinationKind =
  | 'source-backed'
  | 'source-composite'
  | 'source-fragment'
  | 'unavailable'
  | 'invalid-selection'

export interface RotationSourceSegment {
  /** Rotation preset that supplied this contiguous evidence segment. */
  presetId: string
  name: string
  /** Preset and step source ids that support this segment. */
  sourceIds: string[]
  /** Selected-character steps in the source's authored order. */
  steps: RotationStep[]
}

export interface RotationRecombinationResult {
  kind: RotationRecombinationKind
  /** Canonically sorted selected characters covered by emitted steps. */
  matchedCharacterIds: string[]
  /** Canonically sorted selected characters with no emitted step. */
  uncoveredCharacterIds: string[]
  /** Authoritative selected roster. Empty/dup/over-size input stays invalid;
   *  valid input is canonically sorted so selection order never matters. */
  selectedCharacterIds: string[]
  /** Ordered, fully sourced steps. Empty for unavailable/invalid results. */
  steps: RotationStep[]
  /** Every preset or step source id that contributed evidence. */
  sourceIds: string[]
  /** One entry per used preset, preserving each source's internal order. */
  sourceSegments: RotationSourceSegment[]
  /** Human-readable explanation for the UI. */
  explanation: string
  /** Cross-source, filtered-source, and partial-coverage disclosures. */
  warnings: string[]
}

const MAX_SELECTED_CHARACTERS = 4

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

const dedupeStable = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

// Validate the raw selection before any canonical sorting. A repeated id or a
// fifth member stays invalid; we never dedupe or truncate to make it valid.
const validateSelection = (
  ids: string[] | null | undefined,
): string[] | null => {
  const input = (ids ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  if (input.length === 0 || input.length > MAX_SELECTED_CHARACTERS) return null
  const seen = new Set<string>()
  for (const id of input) {
    if (seen.has(id)) return null
    seen.add(id)
  }
  return [...input].sort(compareText)
}

const sourceTeam = (preset: RotationPreset): Set<string> => {
  const ids = new Set<string>(preset.characterIds ?? [])
  for (const step of preset.steps) {
    if (step.characterId) ids.add(step.characterId)
  }
  return ids
}

const sameSet = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id))

const isSubset = (subset: Set<string>, superset: Set<string>): boolean =>
  [...subset].every((id) => superset.has(id))

const stepSourceIds = (step: RotationStep): string[] => {
  const runtimeStep = step as RotationStep & { sourceIds?: unknown }
  if (!Array.isArray(runtimeStep.sourceIds)) return []
  return runtimeStep.sourceIds.filter(
    (sourceId): sourceId is string => typeof sourceId === 'string' && sourceId.length > 0,
  )
}

interface Candidate {
  preset: RotationPreset
  team: Set<string>
  stepCharacters: Set<string>
  selectedSteps: RotationStep[]
  sourceIds: string[]
  coverageMask: number
  includesUnselectedCharacters: boolean
  completeForTeam: boolean
}

const toCandidate = (
  preset: RotationPreset,
  selected: Set<string>,
  selectedIndex: Map<string, number>,
): Candidate | null => {
  // Preserve authored array order. Never sort by `order`, because that would
  // destroy a reviewed source sequence when order metadata is inconsistent.
  const selectedSteps = preset.steps.filter((step) => selected.has(step.characterId))
  if (!selectedSteps.length) return null

  // A preset-level source covers all of its steps. Without one, every emitted
  // step must carry its own evidence; a single sourced step cannot legitimise
  // unsourced neighbours.
  const presetSources = dedupeStable(preset.sourceIds ?? [])
  const sourceIds = presetSources.length
    ? presetSources
    : selectedSteps.every((step) => stepSourceIds(step).length > 0)
      ? dedupeStable(selectedSteps.flatMap(stepSourceIds))
      : []
  if (!sourceIds.length) return null

  let coverageMask = 0
  for (const step of selectedSteps) {
    const index = selectedIndex.get(step.characterId)
    if (index !== undefined) coverageMask |= 1 << index
  }

  const team = sourceTeam(preset)
  const stepCharacters = new Set(
    preset.steps.map((step) => step.characterId).filter(Boolean),
  )
  return {
    preset,
    team,
    stepCharacters,
    selectedSteps,
    sourceIds,
    coverageMask,
    includesUnselectedCharacters: [...team].some((id) => !selected.has(id)),
    completeForTeam: sameSet(team, stepCharacters),
  }
}

const comparePresetIds = (a: Candidate, b: Candidate): number =>
  compareText(a.preset.id, b.preset.id)

const makeSegments = (
  candidates: Candidate[],
): RotationSourceSegment[] => {
  let order = 0
  return [...candidates]
    .sort(comparePresetIds)
    .map((candidate) => ({
      presetId: candidate.preset.id,
      name: candidate.preset.name,
      sourceIds: [...candidate.sourceIds],
      steps: candidate.selectedSteps.map((step) => ({
        ...step,
        order: ++order,
      })),
    }))
}

const buildResult = (
  kind: RotationRecombinationKind,
  candidates: Candidate[],
  selected: string[],
  warnings: string[],
  explanation: string,
): RotationRecombinationResult => {
  const sourceSegments = makeSegments(candidates)
  const steps = sourceSegments.flatMap((segment) => segment.steps)
  const covered = new Set(steps.map((step) => step.characterId))
  return {
    kind,
    matchedCharacterIds: selected.filter((id) => covered.has(id)),
    uncoveredCharacterIds: selected.filter((id) => !covered.has(id)),
    selectedCharacterIds: [...selected],
    steps,
    sourceIds: dedupeStable(sourceSegments.flatMap((segment) => segment.sourceIds)),
    sourceSegments,
    explanation,
    warnings,
  }
}

const emptyUnavailable = (
  selected: string[],
): RotationRecombinationResult => ({
  kind: 'unavailable',
  matchedCharacterIds: [],
  uncoveredCharacterIds: [...selected],
  selectedCharacterIds: [...selected],
  steps: [],
  sourceIds: [],
  sourceSegments: [],
  explanation: '尚無可核驗的隊伍循環可涵蓋所選角色，請依遊戲內機制自行組合。',
  warnings: ['未找到任何可核驗來源，未以規則生成冒充攻略。'],
})

const invalidSelection = (
  selected: string[],
): RotationRecombinationResult => ({
  kind: 'invalid-selection',
  matchedCharacterIds: [],
  uncoveredCharacterIds: [...selected],
  selectedCharacterIds: [...selected],
  steps: [],
  sourceIds: [],
  sourceSegments: [],
  explanation: '隊伍人數必須為 1 至 4 名不同角色，本次未生成技能循環。',
  warnings: ['已拒絕無效隊伍；未截斷、補人、推導或虛構任何步驟。'],
})

interface CoverState {
  candidates: Candidate[]
  stepsCount: number
  key: string
}

const stateFor = (candidates: Candidate[]): CoverState => {
  const ordered = [...candidates].sort(comparePresetIds)
  return {
    candidates: ordered,
    stepsCount: ordered.reduce(
      (total, candidate) => total + candidate.selectedSteps.length,
      0,
    ),
    key: ordered.map((candidate) => candidate.preset.id).join('\u0000'),
  }
}

const compareCompleteState = (
  a: CoverState | null,
  b: CoverState | null,
): number => {
  if (!a) return 1
  if (!b) return -1
  return (
    a.candidates.length - b.candidates.length ||
    a.stepsCount - b.stepsCount ||
    compareText(a.key, b.key)
  )
}

const betterCompleteState = (
  candidate: CoverState,
  current: CoverState | null,
): boolean => compareCompleteState(candidate, current) < 0

// Exact set cover for up to four selected characters. DP runs over the 16
// possible coverage masks, so runtime does not explode with preset count.
const findCompleteComposite = (
  candidates: Candidate[],
  selectedCount: number,
): Candidate[] | null => {
  const fullMask = (1 << selectedCount) - 1
  const states: Array<CoverState | null> = Array.from(
    { length: 1 << selectedCount },
    () => null,
  )
  states[0] = stateFor([])

  for (const candidate of [...candidates].sort(comparePresetIds)) {
    const previous = [...states]
    for (let mask = 0; mask <= fullMask; mask += 1) {
      const state = previous[mask]
      if (!state) continue
      const nextMask = mask | candidate.coverageMask
      if (nextMask === mask) continue
      const next = stateFor([...state.candidates, candidate])
      if (betterCompleteState(next, states[nextMask])) {
        states[nextMask] = next
      }
    }
  }

  const complete = states[fullMask]
  return complete && complete.candidates.length > 1
    ? complete.candidates
    : null
}

const coverageCount = (state: CoverState, mask: number): number => {
  let count = 0
  let value = mask
  while (value) {
    count += value & 1
    value >>>= 1
  }
  return count
}

// Maximise covered selected characters, then minimise source count, emitted
// steps and the deterministic source-id key. Each preset can be used once.
const findBestFragment = (
  candidates: Candidate[],
  selectedCount: number,
): Candidate[] | null => {
  const fullMask = (1 << selectedCount) - 1
  const states: Array<CoverState | null> = Array.from(
    { length: 1 << selectedCount },
    () => null,
  )
  states[0] = stateFor([])

  for (const candidate of [...candidates].sort(comparePresetIds)) {
    const previous = [...states]
    for (let mask = 0; mask <= fullMask; mask += 1) {
      const state = previous[mask]
      if (!state) continue
      const nextMask = mask | candidate.coverageMask
      if (nextMask === mask) continue
      const next = stateFor([...state.candidates, candidate])
      const current = states[nextMask]
      if (
        !current ||
        coverageCount(next, nextMask) > coverageCount(current, nextMask) ||
        (coverageCount(next, nextMask) === coverageCount(current, nextMask) &&
          compareCompleteState(next, current) < 0)
      ) {
        states[nextMask] = next
      }
    }
  }

  let bestMask = -1
  let best: CoverState | null = null
  for (let mask = 1; mask <= fullMask; mask += 1) {
    const state = states[mask]
    if (!state) continue
    if (
      !best ||
      coverageCount(state, mask) > coverageCount(best, bestMask) ||
      (coverageCount(state, mask) === coverageCount(best, bestMask) &&
        compareCompleteState(state, best) < 0)
    ) {
      best = state
      bestMask = mask
    }
  }

  return best?.candidates.length ? best.candidates : null
}

/**
 * Recombine source-backed rotations for a player-selected squad (1-4 chars).
 *
 * Selection order never affects the result. Each preset is used at most once.
 * A preset only qualifies as source-backed when its complete character set is
 * exactly the selected set. Presets containing unselected characters may
 * contribute only explicitly marked, filtered fragments.
 */
export const recombineRotation = (
  selectedCharacterIds: string[],
  presets: RotationPreset[],
): RotationRecombinationResult => {
  // Reject the raw input first. Never dedupe or truncate before rejecting:
  // a repeated id or a fifth member must stay invalid, not be silently fixed.
  const rawInput = (selectedCharacterIds ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  const selection = validateSelection(selectedCharacterIds)
  if (!selection) {
    return invalidSelection(rawInput)
  }

  const selectedSet = new Set(selection)
  const selectedIndex = new Map(selection.map((id, index) => [id, index]))
  const candidateById = new Map<string, Candidate>()
  for (const preset of presets ?? []) {
    const candidate = toCandidate(preset, selectedSet, selectedIndex)
    if (!candidate) continue
    const existing = candidateById.get(candidate.preset.id)
    if (
      !existing ||
      candidate.selectedSteps.length < existing.selectedSteps.length
    ) {
      candidateById.set(candidate.preset.id, candidate)
    }
  }
  const candidates = [...candidateById.values()]

  if (!candidates.length) {
    return emptyUnavailable(selection)
  }

  // 1) A single preset is source-backed only on exact set equality. Merely
  // covering the selected characters is insufficient because the omitted guide
  // members may be required by the authored sequence.
  const exact = candidates
    .filter(
      (candidate) =>
        candidate.completeForTeam &&
        sameSet(candidate.team, selectedSet),
    )
    // A preset explicitly tagged as a fragment must never be promoted to a
    // source-backed guide, even when its character set happens to equal the
    // selection. Fragments may only surface as disclosed fragments.
    .filter((candidate) => candidate.preset.matchType !== 'fragment')
    .sort(
      (a, b) =>
        a.selectedSteps.length - b.selectedSteps.length ||
        comparePresetIds(a, b),
    )[0]

  if (exact) {
    return buildResult(
      'source-backed',
      [exact],
      selection,
      [],
      `完整攻略循環 · 單一來源 ${exact.preset.id} 的角色集合與所選隊伍完全相同。`,
    )
  }

  // 2) A complete composite is allowed only when every contributing preset is
  // wholly contained in the selected roster. A preset with omitted guide
  // members can still appear later, but only as a disclosed fragment.
  const completeSafeCandidates = candidates.filter(
    (candidate) =>
      // Fragments are never allowed to anchor or complete a composite; they
      // remain confined to the disclosed fragment path below.
      candidate.completeForTeam &&
      isSubset(candidate.team, selectedSet) &&
      candidate.preset.matchType !== 'fragment',
  )
  const composite = findCompleteComposite(
    completeSafeCandidates,
    selection.length,
  )

  if (composite) {
    return buildResult(
      'source-composite',
      composite,
      selection,
      [
        '此為跨來源證據化組合，並非單一攻略；各來源片段已分開標示。',
        '來源片段依 preset ID 決定性排列，各片段內步驟順序維持原樣。',
      ],
      `跨來源組合 · 由 ${composite.length} 個來源共同涵蓋所選隊伍（${composite
        .map((candidate) => candidate.preset.id)
        .join(' + ')}）。`,
    )
  }

  // 3) No complete guide exists. Emit the best deterministic evidence
  // fragment, filtering every unselected-character step and disclosing gaps.
  const fragment = findBestFragment(candidates, selection.length)
  if (!fragment) {
    return emptyUnavailable(selection)
  }

  const covered = new Set(
    fragment.flatMap((candidate) =>
      candidate.selectedSteps.map((step) => step.characterId),
    ),
  )
  const uncovered = selection.filter((id) => !covered.has(id))
  const includesFilteredSource = fragment.some(
    (candidate) => candidate.includesUnselectedCharacters,
  )
  return buildResult(
    'source-fragment',
    fragment,
    selection,
    [
      '此為來源循環片段，不能視為完整隊伍攻略。',
      includesFilteredSource
        ? '部分來源包含未選角色；其步驟已過濾，因此不標示為完整攻略。'
        : '',
      fragment.length > 1 ? '此片段由多個來源分段組成，並非單一攻略。' : '',
      uncovered.length
        ? `未涵蓋角色：${uncovered.join('、')}。`
        : '',
    ].filter(Boolean),
    '來源循環片段 · 僅保留所選角色步驟，不代表完整隊伍循環。',
  )
}
