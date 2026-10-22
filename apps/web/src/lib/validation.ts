import type { CharacterFact, StoryChapter } from '@/types/domain'

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

  if (input.selectedCharacterIds.length !== 4) {
    errors.push(`需要恰好 4 名角色，目前为 ${input.selectedCharacterIds.length} 名。`)
  }
  if (uniqueSelection.size !== input.selectedCharacterIds.length) {
    errors.push('队伍中有重复角色。')
  }
  if ([...uniqueSelection].some((id) => !characterIds.has(id))) {
    errors.push('队伍包含数据集中不存在的角色。')
  }

  const playerLevel = /^\d+$/.test(input.playerLevelRaw.trim())
    ? Number(input.playerLevelRaw)
    : null
  if (playerLevel === null || !Number.isInteger(playerLevel) || playerLevel < 1 || playerLevel > 999) {
    errors.push('玩家等级必须是 1–999 的整数。')
  }

  const selectedChapterId = input.chapterId?.trim() ?? ''
  const chapter = selectedChapterId
    ? chapters.find((item) => item.id === selectedChapterId) ?? null
    : null
  // Chapter progress is optional in the current data contract. Missing chapter
  // mappings must not block planning when the characters dataset is usable.
  if (chapters.length > 0 && selectedChapterId && !chapter) {
    errors.push('所选剧情章节不在资料库中。')
  }

  if (chapter?.minPlayerLevel && playerLevel !== null && playerLevel < chapter.minPlayerLevel) {
    errors.push(`该章节至少需要玩家等级 Lv.${chapter.minPlayerLevel}。`)
  }

  return {
    valid: errors.length === 0,
    errors,
    playerLevel,
    chapter,
  }
}
