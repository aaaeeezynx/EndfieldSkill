// Dynamic detection of characters missing a usable 戰技 (battle) or 連攜技
// (combo) skill, derived purely from `character.skills` so the list is never
// hard-coded and disappears automatically once the underlying data is repaired.
//
// Some verified skills have no structured resource tags, so tags cannot be
// used as a completeness signal. A skill is considered usable only when its
// entry has a real, non-placeholder name. This keeps verified skills with
// empty tag arrays from being reported as missing.

import type { CharacterFact, SkillFact } from '@/types/domain'
import { displaySkillType } from '@/lib/displayLabels'

// Generic placeholder names left where the source data has not yet yielded a
// verified skill name. These are treated as "missing" even when the skill entry
// exists, because they carry no usable gameplay information. Covers both
// Simplified and Traditional Chinese forms.
const PLACEHOLDER_SKILL_NAMES = new Set<string>([
  '战技',
  '连携技',
  '终结技',
  '戰技',
  '連攜技',
  '終結技',
])

// Skill types the homepage gap list cares about: 戰技 and 連攜技.
export const CORE_SKILL_TYPES = ['battle', 'combo'] as const
export type CoreSkillType = (typeof CORE_SKILL_TYPES)[number]

/**
 * A skill counts as data-complete when it has a real (non-blank,
 * non-placeholder) name. Resource tags are optional metadata and must not be
 * used to infer missing skill data.
 */
export const isSkillDataComplete = (
  skill: SkillFact | null | undefined,
): boolean => {
  const name = typeof skill?.name === 'string' ? skill.name.trim() : ''
  return name.length > 0 && !PLACEHOLDER_SKILL_NAMES.has(name)
}

/**
 * Return the localized labels (戰技 / 連攜技) for any core skill type the
 * character is missing — i.e. no skill entry, a blank name, or a generic
 * placeholder name.
 */
export const getMissingCoreSkillLabels = (
  skills: ReadonlyArray<SkillFact> | null | undefined,
): string[] =>
  CORE_SKILL_TYPES.filter((type) => {
    const skill = (skills ?? []).find((candidate) => candidate.type === type)
    return !isSkillDataComplete(skill)
  }).map((type) => displaySkillType(type))

export interface SkillGapEntry {
  id: string
  name: string
  missingLabels: string[]
}

/**
 * Build the dynamic list of characters missing a usable 戰技 or 連攜技 from
 * `character.skills`. Returns an empty array when the data is complete.
 */
export const getSkillGapCharacters = (
  characters: ReadonlyArray<CharacterFact>,
): SkillGapEntry[] =>
  characters
    .map((character) => ({
      id: character.id,
      name: character.name,
      missingLabels: getMissingCoreSkillLabels(character.skills),
    }))
    .filter((entry) => entry.missingLabels.length > 0)
