import type { CharacterFact, StoryChapter } from '@/types/domain'

export const MIN_TEAM_SIZE = 1
export const MAX_TEAM_SIZE = 4

export interface PlannerInput {
  selectedCharacterIds: string[]
  playerLevelRaw: string
  chapterId: string | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  playerLevel: number | null
  chapter: StoryChapter | null
}

export const validatePlannerInput = (
  input: PlannerInput,
  characters: CharacterFact[],
  chapters: StoryChapter[],
): ValidationResult => {
  const errors: string[] = []
  const characterIds = new Set(characters.map((character) => character.id))
  const uniqueSelection = new Set(input.selectedCharacterIds)

  if (
    input.selectedCharacterIds.length < MIN_TEAM_SIZE ||
    input.selectedCharacterIds.length > MAX_TEAM_SIZE
  ) {
    errors.push('至少選擇 1 名角色，最多 4 名。')
  }
  if (uniqueSelection.size !== input.selectedCharacterIds.length) {
    errors.push('隊伍中有重複角色。')
  }
  if ([...uniqueSelection].some((id) => !characterIds.has(id))) {
    errors.push('隊伍包含資料集中不存在的角色。')
  }

  const playerLevel = /^\d+$/.test(input.playerLevelRaw.trim())
    ? Number(input.playerLevelRaw)
    : null
  if (playerLevel === null || !Number.isInteger(playerLevel) || playerLevel < 1 || playerLevel > 999) {
    errors.push('玩家等級必須是 1–999 的整數。')
  }

  const selectedChapterId = input.chapterId?.trim() ?? ''
  const chapter = selectedChapterId
    ? chapters.find((item) => item.id === selectedChapterId) ?? null
    : null
  // Chapter progress is intentionally outside the current planning contract.
  // An unknown or stale chapter is ignored instead of blocking generation.

  return {
    valid: errors.length === 0,
    errors,
    playerLevel,
    chapter,
  }
}
