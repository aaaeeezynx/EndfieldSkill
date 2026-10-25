import { describe, expect, it } from 'vitest'
import { sanitizeDataset } from '@/data/loadDataset'
import {
  makeCharacter,
  makeDataset,
  makeEquipment,
  makeRotationPreset,
  makeRotationStep,
  makeTeamPreset,
} from '@/test/fixtures'

const B_FORM_ID = 'chr_0003_endminf'

const visibleCharacters = () => [
  makeCharacter('chr_0002_endminm', { name: '管理員' }),
  makeCharacter('perlica', { name: '佩麗卡' }),
  makeCharacter('chen', { name: '陳千語' }),
  makeCharacter('wulfgard', { name: '狼衛' }),
  makeCharacter('antal', { name: '安塔爾' }),
]

describe('sanitizeDataset', () => {
  it('removes the Administrator B-form from characters and statistics', () => {
    const dataset = makeDataset({
      characters: [
        ...visibleCharacters(),
        makeCharacter(B_FORM_ID, { name: '管理員' }),
      ],
      meta: {
        ...makeDataset().meta,
        missingSkillTypes: [`${B_FORM_ID}:combo`, 'perlica:ultimate'],
        coverage: {
          playableCharacters: 6,
          skills: { battle: 6, combo: 5, ultimate: 5, total: 16 },
        },
      },
    })

    const sanitized = sanitizeDataset(dataset)

    expect(sanitized.characters.map((character) => character.id)).toEqual([
      'chr_0002_endminm',
      'perlica',
      'chen',
      'wulfgard',
      'antal',
    ])
    expect(sanitized.meta.missingSkillTypes).toEqual(['perlica:ultimate'])
    expect(sanitized.meta.coverage.playableCharacters).toBe(5)
    expect(sanitized.meta.coverage.skills).toEqual({
      battle: 5,
      combo: 0,
      ultimate: 0,
      total: 5,
    })
  })

  it('drops teams with fewer than four unique IDs or duplicate IDs', () => {
    const dataset = makeDataset({
      characters: visibleCharacters(),
      teamPresets: [
        makeTeamPreset('three-members', ['chr_0002_endminm', 'perlica', 'chen']),
        makeTeamPreset('duplicate-member', [
          'chr_0002_endminm',
          'perlica',
          'perlica',
          'chen',
        ]),
        makeTeamPreset('valid-team', [
          'chr_0002_endminm',
          'perlica',
          'chen',
          'wulfgard',
        ]),
      ],
    })

    const sanitized = sanitizeDataset(dataset)

    expect(sanitized.teamPresets.map((team) => team.id)).toEqual(['valid-team'])
  })

  it('keeps a five-member preset after removing B only when four unique IDs remain', () => {
    const dataset = makeDataset({
      characters: [
        ...visibleCharacters(),
        makeCharacter(B_FORM_ID, { name: '管理員' }),
      ],
      teamPresets: [
        makeTeamPreset(
          'five-with-b',
          ['chr_0002_endminm', 'perlica', 'chen', 'wulfgard', B_FORM_ID],
          {
            alternatives: {
              perlica: ['chen', B_FORM_ID],
              [B_FORM_ID]: ['perlica'],
            },
          },
        ),
        makeTeamPreset('four-with-b', [
          'chr_0002_endminm',
          'perlica',
          'chen',
          B_FORM_ID,
        ]),
      ],
    })

    const sanitized = sanitizeDataset(dataset)

    expect(sanitized.teamPresets).toHaveLength(1)
    expect(sanitized.teamPresets[0]).toMatchObject({
      id: 'five-with-b',
      characterIds: ['chr_0002_endminm', 'perlica', 'chen', 'wulfgard'],
      alternatives: {
        perlica: ['chen'],
      },
    })
  })

  it('removes B-form rotation steps and renumbers the remaining order contiguously', () => {
    const dataset = makeDataset({
      characters: [
        ...visibleCharacters(),
        makeCharacter(B_FORM_ID, { name: '管理員' }),
      ],
      teamPresets: [
        makeTeamPreset('valid-team', [
          'chr_0002_endminm',
          'perlica',
          'chen',
          'wulfgard',
        ]),
      ],
      rotationPresets: [
        makeRotationPreset(
          'mixed-rotation',
          ['chr_0002_endminm', 'perlica', 'chen', B_FORM_ID],
          [
            makeRotationStep('perlica', { id: 'step-a', order: 1 }),
            makeRotationStep(B_FORM_ID, { id: 'step-b', order: 2 }),
            makeRotationStep('chen', { id: 'step-c', order: 4 }),
          ],
          { teamPresetId: 'valid-team' },
        ),
        makeRotationPreset(
          'all-b-rotation',
          [B_FORM_ID],
          [makeRotationStep(B_FORM_ID, { id: 'only-b' })],
        ),
      ],
    })

    const sanitized = sanitizeDataset(dataset)

    expect(sanitized.rotationPresets).toHaveLength(1)
    expect(sanitized.rotationPresets[0].characterIds).toEqual([
      'chr_0002_endminm',
      'perlica',
      'chen',
    ])
    expect(
      sanitized.rotationPresets[0].steps.map((step) => ({
        id: step.id,
        order: step.order,
        characterId: step.characterId,
      })),
    ).toEqual([
      { id: 'step-a', order: 1, characterId: 'perlica' },
      { id: 'step-c', order: 2, characterId: 'chen' },
    ])
    expect(sanitized.rotationPresets[0].teamPresetId).toBe('valid-team')
  })

  it('clears a rotation teamPresetId when the referenced team is removed', () => {
    const dataset = makeDataset({
      characters: visibleCharacters(),
      teamPresets: [
        makeTeamPreset('invalid-team', ['chr_0002_endminm', 'perlica', 'chen']),
      ],
      rotationPresets: [
        makeRotationPreset(
          'rotation',
          ['chr_0002_endminm', 'perlica'],
          [makeRotationStep('perlica')],
          { teamPresetId: 'invalid-team' },
        ),
      ],
    })

    const sanitized = sanitizeDataset(dataset)

    expect(sanitized.teamPresets).toEqual([])
    expect(sanitized.rotationPresets[0].teamPresetId).toBeNull()
  })

  it('strips B-form equipment recommendations and recomputes coverage', () => {
    const dataset = makeDataset({
      characters: [
        ...visibleCharacters(),
        makeCharacter(B_FORM_ID, { name: '管理員' }),
      ],
      equipment: [
        makeEquipment('gear-a', {
          recommendedFor: ['perlica', B_FORM_ID],
        }),
      ],
    })

    const sanitized = sanitizeDataset(dataset)

    expect(sanitized.equipment[0].recommendedFor).toEqual(['perlica'])
    expect(sanitized.meta.coverage.equipment).toMatchObject({
      total: 1,
      withRecommendation: 1,
    })
    expect(sanitized.coverage.characterSkillCoverage).toBe(0)
  })
})
