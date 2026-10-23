const EQUIPMENT_STAT_LABELS: Readonly<Record<string, string>> = {
  Main: '主屬性',
  Sub: '副屬性',
  MaxHp: '最大生命',
  Atk: '攻擊力',
  Str: '力量',
  Agi: '敏捷',
  Wisd: '智識',
  Will: '意志',
  CriticalRate: '暴擊率',
  NormalAttackDamageIncrease: '普通攻擊傷害提升',
  NormalSkillDamageIncrease: '普通技能傷害提升',
  ComboSkillDamageIncrease: '連攜技傷害提升',
  UltimateSkillDamageIncrease: '終結技傷害提升',
  AllSkillDamageIncrease: '全技能傷害提升',
  HealOutputIncrease: '治療量提升',
  UltimateSpGainScalar: '終結技能量回復係數',
  PhysicalDamageIncrease: '物理傷害提升',
  FireAndNaturalDamageIncrease: '火與自然傷害提升',
  CrystAndPulseDamageIncrease: '結晶與脈衝傷害提升',
  SpellDamageIncrease: '法術傷害提升',
  AllDamageTakenScalar: '承受傷害係數',
  DamageToBrokenUnitIncrease: '對失衡單位傷害提升',
  PhysicalAndSpellInflictionEnhance: '物理與法術附著強化',
}

export interface EquipmentStatDisplay {
  key: string
  label: string
  value: string
}

export const formatEquipmentStatValue = (value: string | number): string => {
  if (typeof value !== 'number') return value
  if (!Number.isFinite(value)) return String(value)

  const rounded = Number(value.toFixed(3))
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

export const mapEquipmentStatLabel = (statType: unknown): string | null => {
  if (statType == null) return null
  if (typeof statType !== 'string') return null

  const normalized = statType.trim()
  if (!normalized) return null

  return EQUIPMENT_STAT_LABELS[normalized] ?? normalized
}

export const buildEquipmentStatDisplays = (
  stats: Record<string, string | number>,
  statTypes: Record<string, string | null> | undefined,
  limit = 6,
): EquipmentStatDisplay[] => {
  if (limit <= 0) return []

  const displays: EquipmentStatDisplay[] = []

  for (const [key, value] of Object.entries(stats)) {
    const label = mapEquipmentStatLabel(statTypes?.[key])
    if (!label) continue

    displays.push({
      key,
      label,
      value: formatEquipmentStatValue(value),
    })
    if (displays.length >= limit) break
  }

  return displays
}
