import equipmentImageMap from './equipmentImageMap.json'

/**
 * Resolve the locally mirrored WebP artwork for an equipment item.
 * Map values already include the file extension.
 */
export function getEquipmentImage(equipmentId: string): string | null {
  const filename = (equipmentImageMap as Record<string, string>)[equipmentId]
  if (!filename) return null
  return `${import.meta.env.BASE_URL}assets/equipment/${filename}`
}
