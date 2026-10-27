import type {
  CharacterFact,
  Dataset,
  EquipmentFact,
  EquipmentLoadout,
  EquipmentSlot,
  EquipmentSlotRecommendation,
  RecommendationReport,
  RotationChoice,
  TeamMatch,
  TeamPreset,
} from '@/types/domain'
import {
  recombineRotation,
  type RotationRecombinationResult,
} from '@/lib/rotationRecombination'
import {
  selectIndeterminateEquipmentBySlot,
  selectLevelEligibleEquipmentBySlot,
} from '@/lib/equipmentEligibility'
import { MAX_TEAM_SIZE } from '@/lib/validation'

export interface PlannerProgress {
  playerLevel: number
  chapterId: string | null
}

const normalizeToken = (value: string): string =>
  value.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')

const unique = <T>(values: T[]): T[] => [...new Set(values)]

const uniqueText = (values: Array<string | null | undefined>): string[] =>
  unique(values.filter((value): value is string => Boolean(value?.trim())))

const joinedText = (values: Array<string | null | undefined>): string | null => {
  const text = uniqueText(values)
  return text.length ? text.join(' / ') : null
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['body', 'hand', 'edc']

const normalizedTags = (character: CharacterFact): string[] =>
  unique([...character.roles, ...character.tags].map(normalizeToken))

const scoreTeamPreset = (preset: TeamPreset, selectedCharacterIds: string[]): TeamMatch => {
  const selectedIds = unique(selectedCharacterIds)
  const presetCharacterIds = unique(preset.characterIds)
  const selected = new Set(selectedIds)
  const presetIds = new Set(presetCharacterIds)
  const matchedCharacterIds = presetCharacterIds.filter((id) => selected.has(id))
  const missingCharacterIds = presetCharacterIds.filter((id) => !selected.has(id))
  const extraCharacterIds = selectedIds.filter((id) => !presetIds.has(id))
  const exact =
    selected.size > 0 &&
    selected.size <= MAX_TEAM_SIZE &&
    presetIds.size <= MAX_TEAM_SIZE &&
    selected.size === presetIds.size &&
    matchedCharacterIds.length === selected.size &&
    extraCharacterIds.length === 0

  const unionSize = new Set([...selected, ...presetIds]).size
  const selectedCoverage = selected.size ? matchedCharacterIds.length / selected.size : 0
  const presetCoverage = presetIds.size ? matchedCharacterIds.length / presetIds.size : 0
  const setCoverage = unionSize ? matchedCharacterIds.length / unionSize : 0
  let score = Math.round(
    setCoverage * 60 + selectedCoverage * 20 + presetCoverage * 20,
  )
  if (preset.sourceIds.length > 0) score += 2
  if (exact) score = 100
  score = Math.max(0, Math.min(100, score))

  return {
    preset,
    score,
    exact,
    matchedCharacterIds,
    missingCharacterIds,
    extraCharacterIds,
    sourceBacked: preset.sourceIds.length > 0,
  }
}

export const matchTeamPresets = (
  selectedCharacterIds: string[],
  presets: TeamPreset[],
): TeamMatch[] =>
  presets
    .map((preset) => scoreTeamPreset(preset, selectedCharacterIds))
    .filter((match) => match.matchedCharacterIds.length > 0)
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.score - a.score ||
        a.preset.id.localeCompare(b.preset.id),
    )

// Deterministic id for a recombination-backed choice. Selection order never
// affects recombineRotation, so this stays stable for a given roster.
const choiceIdFor = (result: ReturnType<typeof recombineRotation>): string => {
  if (result.kind === 'unavailable') return 'rotation-unavailable'
  if (result.kind === 'invalid-selection') return 'rotation-invalid-selection'
  const segmentKey = result.sourceSegments
    .map((segment) => segment.presetId)
    .join('+')
  return `rotation-${segmentKey || 'none'}`
}

const recombinationToChoice = (
  result: RotationRecombinationResult,
  dataset: Dataset,
): RotationChoice => {
  const id = choiceIdFor(result)
  const presetsById = new Map(
    dataset.rotationPresets.map((preset) => [preset.id, preset]),
  )
  const sourcePresets = result.sourceSegments
    .map((segment) => presetsById.get(segment.presetId))
    .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset))
  const confidenceValues = sourcePresets
    .map((preset) => preset.confidence)
    .filter((value): value is number => value !== null)
  const name =
    result.kind === 'unavailable'
      ? '尚無可核驗隊伍循環'
      : result.kind === 'invalid-selection'
        ? '無效隊伍'
        : result.sourceSegments.map((segment) => segment.name).join(' + ') ||
          '來源循環'

  return {
    id,
    name,
    kind: result.kind,
    matchType:
      result.kind === 'source-fragment'
        ? 'fragment'
        : result.kind === 'source-backed' || result.kind === 'source-composite'
          ? 'complete'
          : null,
    dependencies: unique(
      sourcePresets.flatMap((preset) =>
        preset.dependencies.map(
          (dependency) => `${dependency.characterId}\u0000${dependency.reason}`,
        ),
      ),
    ).map((key) => {
      const [characterId, reason] = key.split('\u0000')
      return { characterId, reason }
    }),
    description: result.explanation,
    steps: result.steps,
    warnings: unique([
      ...result.warnings,
      ...sourcePresets.flatMap((preset) => preset.limitations),
      ...result.steps.flatMap((step) => step.warnings),
    ]),
    sourceIds: result.sourceIds,
    confidence: confidenceValues.length
      ? Math.min(...confidenceValues)
      : null,
    presetId:
      result.sourceSegments.length === 1
        ? result.sourceSegments[0].presetId
        : null,
    author: joinedText(sourcePresets.map((preset) => preset.author)),
    videoTimestamp: joinedText(
      sourcePresets.map((preset) => preset.videoTimestamp),
    ),
    publishedAt: joinedText(
      sourcePresets.map((preset) => preset.publishedAt),
    ),
    triggerConditions: unique(
      sourcePresets.flatMap((preset) => preset.triggerConditions),
    ),
    waitConditions: unique(
      sourcePresets.flatMap((preset) => preset.waitConditions),
    ),
    limitations: unique(
      sourcePresets.flatMap((preset) => preset.limitations),
    ),
    matchedCharacterIds: result.matchedCharacterIds,
    selectedCharacterIds: result.selectedCharacterIds,
    uncoveredCharacterIds: result.uncoveredCharacterIds,
    sourceSegments: result.sourceSegments,
    explanation: result.explanation,
  }
}

export const buildRotationChoices = (
  dataset: Dataset,
  selectedCharacterIds: string[],
): RotationChoice[] => {
  const result = recombineRotation(selectedCharacterIds, dataset.rotationPresets)
  return [recombinationToChoice(result, dataset)]
}

const buildEquipmentLoadout = (
  character: CharacterFact,
  dataset: Dataset,
  playerLevel: number,
): EquipmentLoadout => {
  // Level-only eligibility: every craftable item whose playerLevel gate is
  // satisfied by the configured level. Story progress is never consulted.
  const eligibleBySlot = selectLevelEligibleEquipmentBySlot(
    dataset.equipment,
    playerLevel,
  )
  const indeterminateBySlot = selectIndeterminateEquipmentBySlot(
    dataset.equipment,
  )

  const slots = {} as Record<EquipmentSlot, EquipmentSlotRecommendation>
  const warnings: string[] = []
  for (const slot of EQUIPMENT_SLOTS) {
    const items = eligibleBySlot[slot]
    const target = items[0] ?? null
    // The product requirement is an exhaustive level-craftable list. Keep the
    // first item as the display target and every remaining item as alternatives.
    const alternatives = items.slice(1)
    const indeterminate = indeterminateBySlot[slot]
    const slotWarnings: string[] = []
    if (!items.length) {
      slotWarnings.push('此部位目前沒有等級可製造的裝備資料。')
    }
    if (indeterminate.length) {
      slotWarnings.push('部分裝備缺少可判定資料（craftable 或等級門檻為空），已另列「無法判定」。')
    }
    slots[slot] = {
      slot,
      target: target
        ? {
            equipment: target,
            score: 0,
            unlockState: 'unlocked',
            gateLabels: [`可製造等級 Lv.${target.unlock.playerLevel ?? 0}`],
            matchNotes: [],
          }
        : null,
      available: null,
      alternatives: alternatives.map((item) => ({
        equipment: item,
        score: 0,
        unlockState: 'unlocked',
        gateLabels: [`可製造等級 Lv.${item.unlock.playerLevel ?? 0}`],
        matchNotes: [],
      })),
      warnings: slotWarnings,
    }
  }

  return { characterId: character.id, slots, warnings }
}

export const recommendEquipmentForCharacter = (
  dataset: Dataset,
  character: CharacterFact,
  progress: PlannerProgress,
): EquipmentLoadout => buildEquipmentLoadout(character, dataset, progress.playerLevel)

export const buildRecommendationReport = (
  dataset: Dataset,
  selectedCharacterIds: string[],
  progress: PlannerProgress,
): RecommendationReport => {
  const rotationResult = recombineRotation(
    selectedCharacterIds,
    dataset.rotationPresets,
  )
  // Rotation recombination is selection-order independent (it canonically
  // sorts internally). Display artefacts — the squad readout and the equipment
  // board — instead mirror the player's chosen slot order (1..4) so what the
  // player picked first is what they read first.
  const displaySelection =
    rotationResult.kind === 'invalid-selection'
      ? []
      : unique(
          (selectedCharacterIds ?? []).filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
        )
  const byId = new Map(dataset.characters.map((character) => [character.id, character]))
  const characters = displaySelection
    .map((id) => byId.get(id))
    .filter((character): character is CharacterFact => Boolean(character))
  const teamMatches = matchTeamPresets(displaySelection, dataset.teamPresets)
  const exactTeam = teamMatches.find((match) => match.exact) ?? null
  // The rotation is recomposed purely from the player's selected roster; the
  // exact-team match is only a summary and must never gate generation.
  const rotations = [recombinationToChoice(rotationResult, dataset)]
  const equipment = characters.map((character) =>
    buildEquipmentLoadout(character, dataset, progress.playerLevel),
  )
  const teamTags = unique(characters.flatMap((character) => normalizedTags(character))).slice(0, 12)
  const warnings: string[] = []

  if (!exactTeam) {
    warnings.push(
      teamMatches.length
        ? `目前選擇的 ${characters.length} 名角色未與任何攻略隊伍完全一致；隊伍摘要來自部分匹配，不代表攻略隊伍已完整重現。`
        : `目前選擇的 ${characters.length} 名角色沒有可用的攻略隊伍匹配；隊伍摘要僅依角色標籤整理。`,
    )
  }
  if (rotations.every((rotation) => rotation.kind === 'unavailable')) {
    warnings.push('目前隊伍尚無可核驗循環。')
  }
  if (rotations.every((rotation) => rotation.kind === 'invalid-selection')) {
    warnings.push('隊伍人數必須為 1 至 4 名不同角色，未生成技能循環。')
  }
  if (rotations.some((rotation) => rotation.kind === 'source-composite')) {
    warnings.push('技能循環由多個來源分段組合，並非單一攻略。')
  }
  if (
    rotations.some(
      (rotation) =>
        rotation.kind !== 'unavailable' &&
        rotation.kind !== 'invalid-selection' &&
        rotation.uncoveredCharacterIds.length > 0,
    )
  ) {
    warnings.push('部分所選角色沒有來源步驟，已在技能循環中明確標示。')
  }
  if (!dataset.teamPresets.length) warnings.push('team-presets.json 沒有可用記錄。')
  if (!dataset.rotationPresets.length) warnings.push('rotation-presets.json 沒有可用記錄。')
  if (!dataset.equipment.length) warnings.push('equipment.json 沒有可用記錄。')
  return {
    teamMatches,
    exactTeam,
    rotations,
    equipment,
    teamTags,
    warnings,
    selectedCharacterIds: characters.map((character) => character.id),
  }
}
