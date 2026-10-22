import portraitMap from './characterPortraitMap.json'

/**
 * 取得角色立繪圖片路徑
 * @param characterId 角色 ID (例如: chr_0033_camille)
 * @returns 圖片路徑或 null
 */
export function getCharacterPortrait(characterId: string): string | null {
  const filename = (portraitMap as Record<string, string>)[characterId]
  if (!filename) return null
  return `${import.meta.env.BASE_URL}assets/character_portraits/${filename}.png`
}
