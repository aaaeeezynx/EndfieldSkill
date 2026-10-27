import { describe, expect, it } from 'vitest'
import type { CharacterFact, SkillFact } from '@/types/domain'
import {
  isSkillDataComplete,
  getMissingCoreSkillLabels,
  getSkillGapCharacters,
} from '@/lib/skillGap'

const skill = (
  type: SkillFact['type'],
  tags: string[],
  name = `${type} skill`,
): SkillFact => ({
  id: `${type}_skill`,
  name,
  type,
  resource: 'none',
  description: null,
  tags,
  triggerConditions: [],
  cooldownSeconds: null,
  energyCost: null,
  sharedSkillPointCost: null,
  sourceIds: [],
})

const character = (
  id: string,
  name: string,
  skills: SkillFact[],
): CharacterFact => ({
  id,
  name,
  nameEn: null,
  rarity: null,
  profession: null,
  element: null,
  roles: [],
  tags: [],
  portraitUrl: null,
  skills,
  sourceIds: [],
})

describe('isSkillDataComplete', () => {
  it('treats a named skill with tags as complete', () => {
    expect(isSkillDataComplete(skill('battle', ['shared_skill_points']))).toBe(true)
  })

  it('treats a named skill without tags as complete', () => {
    expect(isSkillDataComplete(skill('combo', []))).toBe(true)
  })

  it('treats null/undefined as incomplete', () => {
    expect(isSkillDataComplete(null)).toBe(false)
    expect(isSkillDataComplete(undefined)).toBe(false)
  })

  it('treats another named skill with tags as complete', () => {
    expect(isSkillDataComplete(skill('combo', ['condition_triggered']))).toBe(true)
  })
})

describe('isSkillDataComplete name checks', () => {
  it('treats an empty-name skill as incomplete', () => {
    const broken = { ...skill('battle', ['shared_skill_points']), name: '' }
    expect(isSkillDataComplete(broken)).toBe(false)
  })

  it('treats a generic placeholder name as incomplete (Simplified)', () => {
    const broken = { ...skill('battle', ['shared_skill_points']), name: '战技' }
    expect(isSkillDataComplete(broken)).toBe(false)
  })

  it('treats a generic placeholder name as incomplete (Traditional)', () => {
    const broken = { ...skill('combo', ['condition_triggered']), name: '連攜技' }
    expect(isSkillDataComplete(broken)).toBe(false)
  })

  it('does not flag verified non-placeholder names', () => {
    expect(isSkillDataComplete(skill('battle', [], '構成序列'))).toBe(true)
    expect(isSkillDataComplete(skill('combo', [], '閉鎖序列'))).toBe(true)
  })
})

describe('getMissingCoreSkillLabels', () => {
  it('flags a combo placeholder as missing 連攜技', () => {
    const skills = [
      skill('battle', ['shared_skill_points']),
      skill('combo', [], '连携技'),
      skill('ultimate', ['energy_cost', 'ultimate']),
    ]
    expect(getMissingCoreSkillLabels(skills)).toEqual(['連攜技'])
  })

  it('flags a battle placeholder as missing 戰技', () => {
    const skills = [
      skill('battle', [], '战技'),
      skill('combo', ['condition_triggered']),
      skill('ultimate', ['energy_cost', 'ultimate']),
    ]
    expect(getMissingCoreSkillLabels(skills)).toEqual(['戰技'])
  })

  it('returns nothing when both core skills are complete', () => {
    const skills = [
      skill('battle', ['shared_skill_points']),
      skill('combo', ['condition_triggered']),
      skill('ultimate', ['energy_cost', 'ultimate']),
    ]
    expect(getMissingCoreSkillLabels(skills)).toEqual([])
  })

  it('flags a fully missing core skill type', () => {
    const skills = [
      skill('ultimate', ['energy_cost', 'ultimate']),
    ]
    expect(getMissingCoreSkillLabels(skills).sort()).toEqual(['戰技', '連攜技'])
  })
})

describe('getSkillGapCharacters', () => {
  const rossi = character('chr_0028_wulfa', '洛茜', [
    skill('battle', [], '灼熱彈痕'),
    skill('combo', [], '燎影時刻'),
    skill('ultimate', [], '狼之怒'),
  ])
  const mifu = character('chr_0031_mifu', '弭弗', [
    skill('combo', [], '拳出無悔'),
    skill('battle', [], '清波三藝'),
    skill('ultimate', [], '絕心'),
  ])
  const typhoea = character('chr_0034_typhoea', '提弗洛斯', [
    skill('combo', [], '風矢穿林'),
    skill('battle', [], '風矢穿林'),
    skill('ultimate', [], '終結技'),
  ])
  const pelica = character('chr_0004_pelica', '佩丽卡', [
    skill('battle', ['shared_skill_points']),
    skill('combo', ['condition_triggered']),
    skill('ultimate', ['energy_cost', 'ultimate']),
  ])

  it('does not report verified skills merely because their tags are empty', () => {
    const result = getSkillGapCharacters([pelica, rossi, mifu, typhoea])
    expect(result).toEqual([])
  })

  it('isolates characters that still use generic placeholder names', () => {
    const tangtang = character('chr_0027_tangtang', '湯湯', [
      skill('battle', [], '战技'),
      skill('combo', [], '连携技'),
      skill('ultimate', [], '终结技'),
    ])

    expect(getSkillGapCharacters([pelica, rossi, tangtang])).toEqual([
      { id: 'chr_0027_tangtang', name: '湯湯', missingLabels: ['戰技', '連攜技'] },
    ])
  })

  it('returns an empty list when all characters are complete', () => {
    expect(getSkillGapCharacters([pelica])).toEqual([])
  })
})
