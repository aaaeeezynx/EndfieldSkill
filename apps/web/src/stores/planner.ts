import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { loadDataset } from '@/data/loadDataset'
import { buildRecommendationReport } from '@/lib/recommendation'
import { validatePlannerInput } from '@/lib/validation'
import type { CharacterFact, Dataset, RecommendationReport } from '@/types/domain'

export type DataState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export const usePlannerStore = defineStore('planner', () => {
  const dataset = ref<Dataset | null>(null)
  const dataState = ref<DataState>('idle')
  const dataError = ref<string | null>(null)
  const selectedCharacterIds = ref<string[]>([])
  const playerLevelRaw = ref('')
  const chapterId = ref('')
  const notice = ref<string | null>(null)
  const report = ref<RecommendationReport | null>(null)
  const isGenerating = ref(false)

  const characters = computed(() => dataset.value?.characters ?? [])
  const chapters = computed(() =>
    [...(dataset.value?.chapters ?? [])].sort((a, b) => a.order - b.order),
  )
  const selectedCharacters = computed<CharacterFact[]>(() => {
    const byId = new Map(characters.value.map((character) => [character.id, character]))
    return selectedCharacterIds.value
      .map((id) => byId.get(id))
      .filter((character): character is CharacterFact => Boolean(character))
  })
  const validation = computed(() =>
    validatePlannerInput(
      {
        selectedCharacterIds: selectedCharacterIds.value,
        playerLevelRaw: playerLevelRaw.value,
        chapterId: chapterId.value,
      },
      characters.value,
      chapters.value,
    ),
  )
  const hasCoreData = computed(() => characters.value.length > 0)
  const hasChapterData = computed(() => chapters.value.length > 0)
  const isPipelineWaiting = computed(
    () => dataState.value === 'empty' || (dataset.value?.missingFiles.length ?? 0) > 0,
  )

  const initialize = async (force = false): Promise<void> => {
    if (dataState.value === 'loading') return
    if (dataset.value && !force) return

    dataState.value = 'loading'
    dataError.value = null
    try {
      const loaded = await loadDataset()
      dataset.value = loaded
      if (!hasCoreData.value) {
        dataState.value = 'empty'
        return
      }
      dataState.value = 'ready'
      if (!playerLevelRaw.value) {
        playerLevelRaw.value = String(chapters.value[0]?.minPlayerLevel ?? 1)
      }
      if (!hasChapterData.value) {
        chapterId.value = ''
      } else if (!chapterId.value) {
        chapterId.value = chapters.value[0].id
      }
    } catch (error) {
      dataError.value = error instanceof Error ? error.message : String(error)
      dataState.value = 'error'
    }
  }

  const invalidateReport = (): void => {
    report.value = null
  }

  const setNotice = (message: string): void => {
    notice.value = message
  }

  const clearNotice = (): void => {
    notice.value = null
  }

  const toggleCharacter = (characterId: string): void => {
    clearNotice()
    const existingIndex = selectedCharacterIds.value.indexOf(characterId)
    if (existingIndex >= 0) {
      selectedCharacterIds.value.splice(existingIndex, 1)
      invalidateReport()
      return
    }
    if (selectedCharacterIds.value.length >= 4) {
      setNotice('队伍已满。先移除一名角色，再加入新角色。')
      return
    }
    selectedCharacterIds.value.push(characterId)
    invalidateReport()
  }

  const removeCharacter = (characterId: string): void => {
    selectedCharacterIds.value = selectedCharacterIds.value.filter((id) => id !== characterId)
    invalidateReport()
  }

  const clearTeam = (): void => {
    selectedCharacterIds.value = []
    invalidateReport()
  }

  const setPlayerLevel = (value: string): void => {
    playerLevelRaw.value = value
    invalidateReport()
  }

  const setChapter = (value: string): void => {
    chapterId.value = value
    invalidateReport()
  }

  const generate = async (): Promise<boolean> => {
    if (!dataset.value || !validation.value.valid || validation.value.playerLevel === null) {
      return false
    }
    isGenerating.value = true
    try {
      // Yield once so the terminal-style loading state can render.
      await new Promise((resolve) => window.setTimeout(resolve, 180))
      report.value = buildRecommendationReport(dataset.value, selectedCharacterIds.value, {
        playerLevel: validation.value.playerLevel,
        chapterId: chapterId.value || null,
      })
      return true
    } finally {
      isGenerating.value = false
    }
  }

  return {
    dataset,
    dataState,
    dataError,
    selectedCharacterIds,
    playerLevelRaw,
    chapterId,
    notice,
    report,
    isGenerating,
    characters,
    chapters,
    selectedCharacters,
    validation,
    hasCoreData,
    hasChapterData,
    isPipelineWaiting,
    initialize,
    toggleCharacter,
    removeCharacter,
    clearTeam,
    setPlayerLevel,
    setChapter,
    generate,
    setNotice,
    clearNotice,
  }
})
