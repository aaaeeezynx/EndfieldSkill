import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDataset } from '@/data/loadDataset'
import type { RotationPreset, RotationStep, SkillType } from '@/types/domain'
import { recombineRotation } from './rotationRecombination'

const makeStep = (
  order: number,
  characterId: string,
  opts: Partial<RotationStep> = {},
): RotationStep => ({
  id: `${characterId}-step-${order}`,
  order,
  phase: null,
  characterId,
  skillId: null,
  skillName: `skill-${characterId}-${order}`,
  skillType: 'battle' as SkillType,
  triggerCondition: null,
  waitFor: null,
  comboWindowSeconds: null,
  sharedSkillPointCost: null,
  energyCost: null,
  cooldownSeconds: null,
  warnings: [],
  note: null,
  ...opts,
})

const makePreset = (
  id: string,
  characterIds: string[],
  steps: RotationStep[],
  sourceIds: string[] = [id],
): RotationPreset => ({
  id,
  name: id,
  teamPresetId: null,
  characterIds,
  matchType: 'complete',
  dependencies: [],
  scenario: null,
  description: null,
  steps,
  sourceIds,
  confidence: 1,
  author: null,
  videoTimestamp: null,
  publishedAt: null,
  triggerConditions: [],
  waitConditions: [],
  limitations: [],
})

const stepNames = (result: ReturnType<typeof recombineRotation>): string[] =>
  result.steps.map((step) => step.skillName)

const combinations = <T>(values: T[]): T[][] =>
  Array.from({ length: (1 << values.length) - 1 }, (_, index) => index + 1).map(
    (mask) => values.filter((__, index) => (mask & (1 << index)) !== 0),
  )

const loadPhysicalShatterPreset = (): RotationPreset => {
  const raw = JSON.parse(
    readFileSync(
      new URL('../../public/data/v1/rotation-presets.json', import.meta.url),
      'utf8',
    ),
  )
  const preset = parseDataset({ 'rotation-presets.json': raw }).rotationPresets.find(
    (rotation) => rotation.id === 'rotation_physical_shatter_202601',
  )
  if (!preset) throw new Error('rotation_physical_shatter_202601 is missing')
  return preset
}

describe('recombineRotation', () => {
  it('rejects an empty selection without truncating or inventing steps', () => {
    const result = recombineRotation([], [
      makePreset('src-a', ['charA'], [makeStep(1, 'charA')]),
    ])

    expect(result.kind).toBe('invalid-selection')
    expect(result.steps).toHaveLength(0)
    expect(result.sourceSegments).toHaveLength(0)
  })

  it('rejects five distinct characters instead of silently dropping the fifth', () => {
    const result = recombineRotation(
      ['charA', 'charB', 'charC', 'charD', 'charE'],
      [
        makePreset(
          'src-full',
          ['charA', 'charB', 'charC', 'charD'],
          [
            makeStep(1, 'charA'),
            makeStep(2, 'charB'),
            makeStep(3, 'charC'),
            makeStep(4, 'charD'),
          ],
        ),
      ],
    )

    expect(result.kind).toBe('invalid-selection')
    expect(result.steps).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('未截斷')
  })

  it('supports a four-character exact source', () => {
    const result = recombineRotation(
      ['charA', 'charB', 'charC', 'charD'],
      [
        makePreset(
          'src-full',
          ['charA', 'charB', 'charC', 'charD'],
          [
            makeStep(1, 'charA'),
            makeStep(2, 'charB'),
            makeStep(3, 'charC'),
            makeStep(4, 'charD'),
          ],
        ),
      ],
    )

    expect(result.kind).toBe('source-backed')
    expect(result.matchedCharacterIds).toEqual([
      'charA',
      'charB',
      'charC',
      'charD',
    ])
    expect(result.uncoveredCharacterIds).toHaveLength(0)
  })

  it('supports a single selected character', () => {
    const result = recombineRotation(
      ['charA'],
      [makePreset('src-a', ['charA'], [makeStep(1, 'charA')])],
    )

    expect(result.kind).toBe('source-backed')
    expect(result.matchedCharacterIds).toEqual(['charA'])
  })

  it('rejects a repeated character instead of deduplicating to valid', () => {
    const result = recombineRotation(
      ['charA', 'charA'],
      [makePreset('src-a', ['charA'], [makeStep(1, 'charA')])],
    )

    expect(result.kind).toBe('invalid-selection')
    expect(result.steps).toHaveLength(0)
    expect(result.selectedCharacterIds).toEqual(['charA', 'charA'])
    expect(result.warnings.join(' ')).toContain('未截斷')
  })

  it('rejects an empty selection', () => {
    const result = recombineRotation(
      [],
      [makePreset('src-a', ['charA'], [makeStep(1, 'charA')])],
    )

    expect(result.kind).toBe('invalid-selection')
    expect(result.selectedCharacterIds).toEqual([])
  })

  it('treats a single character as a valid source-backed selection', () => {
    const result = recombineRotation(
      ['charA'],
      [makePreset('src-a', ['charA'], [makeStep(1, 'charA')])],
    )

    expect(result.kind).toBe('source-backed')
    expect(result.selectedCharacterIds).toEqual(['charA'])
  })

  it('does not depend on selection order', () => {
    const presets = [
      makePreset(
        'src-full',
        ['charA', 'charB', 'charC'],
        [
          makeStep(1, 'charA'),
          makeStep(2, 'charB'),
          makeStep(3, 'charC'),
        ],
      ),
    ]
    const forward = recombineRotation(
      ['charA', 'charB', 'charC'],
      presets,
    )
    const reversed = recombineRotation(
      ['charC', 'charB', 'charA'],
      presets,
    )

    expect(reversed).toEqual(forward)
  })

  it('does not call a covering source-backed when its roster has extra members', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [
        makePreset(
          'src-three',
          ['charA', 'charB', 'charC'],
          [
            makeStep(1, 'charC'),
            makeStep(2, 'charA'),
            makeStep(3, 'charB'),
          ],
        ),
      ],
    )

    expect(result.kind).toBe('source-fragment')
    expect(result.matchedCharacterIds).toEqual(['charA', 'charB'])
    expect(result.uncoveredCharacterIds).toHaveLength(0)
    expect(stepNames(result)).toEqual([
      'skill-charA-2',
      'skill-charB-3',
    ])
    expect(result.steps.some((step) => step.characterId === 'charC')).toBe(false)
    expect(result.warnings.join(' ')).toContain('未選角色')
  })

  it('filters unselected steps even when preset characterIds look exact', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [
        makePreset(
          'src-leaky',
          ['charA', 'charB'],
          [
            makeStep(1, 'charA'),
            makeStep(2, 'charC'),
            makeStep(3, 'charB'),
          ],
        ),
      ],
    )

    expect(result.kind).toBe('source-fragment')
    expect(result.steps.map((step) => step.characterId)).toEqual([
      'charA',
      'charB',
    ])
    expect(result.warnings.join(' ')).toContain('已過濾')
  })

  it('preserves the source array order instead of sorting by step.order', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [
        makePreset(
          'src-authored',
          ['charA', 'charB'],
          [
            makeStep(9, 'charA', { skillName: 'A-first' }),
            makeStep(1, 'charB', { skillName: 'B-second' }),
            makeStep(5, 'charA', { skillName: 'A-third' }),
            makeStep(2, 'charB', { skillName: 'B-fourth' }),
          ],
        ),
      ],
    )

    expect(result.kind).toBe('source-backed')
    expect(stepNames(result)).toEqual([
      'A-first',
      'B-second',
      'A-third',
      'B-fourth',
    ])
  })

  it('never promotes a fragment preset to source-backed when its roster matches', () => {
    const fragment = makePreset(
      'src-fragment',
      ['charA', 'charB'],
      [makeStep(1, 'charA'), makeStep(2, 'charB')],
    )
    fragment.matchType = 'fragment'

    const result = recombineRotation(['charA', 'charB'], [fragment])

    expect(result.kind).toBe('source-fragment')
    expect(result.sourceSegments.map((segment) => segment.presetId)).toEqual([
      'src-fragment',
    ])
  })

  it('never anchors a composite with a fragment preset', () => {
    const fragment = makePreset(
      'src-frag-ab',
      ['charA', 'charB'],
      [makeStep(1, 'charA'), makeStep(2, 'charB')],
    )
    fragment.matchType = 'fragment'
    const completeAb = makePreset(
      'src-ab',
      ['charA', 'charB'],
      [makeStep(1, 'charA'), makeStep(2, 'charB')],
    )
    const completeCd = makePreset(
      'src-cd',
      ['charC', 'charD'],
      [makeStep(1, 'charC'), makeStep(2, 'charD')],
    )

    const result = recombineRotation(
      ['charA', 'charB', 'charC', 'charD'],
      [fragment, completeAb, completeCd],
    )

    expect(result.kind).toBe('source-composite')
    expect(
      result.sourceSegments.map((segment) => segment.presetId),
    ).not.toContain('src-frag-ab')
    expect(
      result.sourceSegments.map((segment) => segment.presetId),
    ).toEqual(['src-ab', 'src-cd'])
  })

  it('still surfaces a fragment preset only as a disclosed fragment', () => {
    const complete = makePreset(
      'src-a',
      ['charA'],
      [makeStep(1, 'charA')],
    )
    const fragment = makePreset(
      'src-frag-b',
      ['charB'],
      [makeStep(1, 'charB')],
    )
    fragment.matchType = 'fragment'

    const result = recombineRotation(['charA', 'charB'], [complete, fragment])

    // The fragment covers only one of the two selected characters, so it can
    // only appear as a disclosed fragment, never as source-backed/composite.
    expect(result.kind).toBe('source-fragment')
    expect(result.sourceSegments.map((segment) => segment.presetId)).toContain(
      'src-frag-b',
    )
    expect(result.sourceSegments.some((segment) => segment.presetId === 'src-frag-b')).toBe(true)
    expect(result.kind === 'source-backed' || result.kind === 'source-composite').toBe(false)
  })

  it('does not mechanically order steps by skill type', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [
        makePreset(
          'src-types',
          ['charA', 'charB'],
          [
            makeStep(1, 'charA', {
              skillName: 'battle-first',
              skillType: 'battle',
            }),
            makeStep(2, 'charB', {
              skillName: 'ultimate-second',
              skillType: 'ultimate',
            }),
            makeStep(3, 'charA', {
              skillName: 'combo-third',
              skillType: 'combo',
            }),
          ],
        ),
      ],
    )

    expect(stepNames(result)).toEqual([
      'battle-first',
      'ultimate-second',
      'combo-third',
    ])
  })

  it('prefers an exact single source over a possible composite', () => {
    const presets = [
      makePreset('src-a', ['charA'], [makeStep(1, 'charA')]),
      makePreset('src-b', ['charB'], [makeStep(1, 'charB')]),
      makePreset(
        'src-exact',
        ['charA', 'charB'],
        [makeStep(1, 'charA'), makeStep(2, 'charB')],
      ),
    ]
    const result = recombineRotation(['charA', 'charB'], presets)

    expect(result.kind).toBe('source-backed')
    expect(result.sourceSegments.map((segment) => segment.presetId)).toEqual([
      'src-exact',
    ])
  })

  it('composes multiple complete sources with explicit source segments', () => {
    const presets = [
      makePreset(
        'src-cd',
        ['charC', 'charD'],
        [
          makeStep(1, 'charD', { skillName: 'D-one' }),
          makeStep(2, 'charC', { skillName: 'C-two' }),
        ],
      ),
      makePreset(
        'src-ab',
        ['charA', 'charB'],
        [
          makeStep(1, 'charB', { skillName: 'B-one' }),
          makeStep(2, 'charA', { skillName: 'A-two' }),
        ],
      ),
    ]
    const result = recombineRotation(
      ['charD', 'charB', 'charA', 'charC'],
      presets,
    )

    expect(result.kind).toBe('source-composite')
    expect(result.sourceSegments.map((segment) => segment.presetId)).toEqual([
      'src-ab',
      'src-cd',
    ])
    expect(stepNames(result)).toEqual([
      'B-one',
      'A-two',
      'D-one',
      'C-two',
    ])
    expect(result.steps.map((step) => step.order)).toEqual([1, 2, 3, 4])
    expect(result.uncoveredCharacterIds).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('跨來源')
  })

  it('chooses the deterministic minimum-source complete composite', () => {
    const presets = [
      makePreset(
        'src-ab',
        ['charA', 'charB'],
        [makeStep(1, 'charA'), makeStep(2, 'charB')],
      ),
      makePreset(
        'src-cd',
        ['charC', 'charD'],
        [makeStep(1, 'charC'), makeStep(2, 'charD')],
      ),
      makePreset(
        'src-ac',
        ['charA', 'charC'],
        [makeStep(1, 'charA'), makeStep(2, 'charC')],
      ),
      makePreset(
        'src-bd',
        ['charB', 'charD'],
        [makeStep(1, 'charB'), makeStep(2, 'charD')],
      ),
    ]
    const result = recombineRotation(
      ['charA', 'charB', 'charC', 'charD'],
      presets,
    )

    expect(result.kind).toBe('source-composite')
    expect(result.sourceSegments.map((segment) => segment.presetId)).toEqual([
      'src-ab',
      'src-cd',
    ])
  })

  it('uses only source-contained presets for a complete composite', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [
        makePreset(
          'src-ac',
          ['charA', 'charC'],
          [makeStep(1, 'charA'), makeStep(2, 'charC')],
        ),
        makePreset(
          'src-bc',
          ['charB', 'charC'],
          [makeStep(1, 'charB'), makeStep(2, 'charC')],
        ),
      ],
    )

    expect(result.kind).toBe('source-fragment')
    expect(result.steps.some((step) => step.characterId === 'charC')).toBe(false)
    expect(result.matchedCharacterIds).toEqual(['charA', 'charB'])
    expect(result.warnings.join(' ')).toContain('未選角色')
  })

  it('does not treat a preset with missing team steps as a complete source', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [
        makePreset(
          'src-incomplete',
          ['charA', 'charB'],
          [makeStep(1, 'charA')],
        ),
      ],
    )

    expect(result.kind).toBe('source-fragment')
    expect(result.uncoveredCharacterIds).toEqual(['charB'])
  })

  it('emits a filtered fragment and discloses uncovered characters', () => {
    const result = recombineRotation(
      ['charA', 'charB'],
      [makePreset('src-a', ['charA'], [makeStep(1, 'charA')])],
    )

    expect(result.kind).toBe('source-fragment')
    expect(result.matchedCharacterIds).toEqual(['charA'])
    expect(result.uncoveredCharacterIds).toEqual(['charB'])
    expect(result.steps.map((step) => step.characterId)).toEqual(['charA'])
    expect(result.warnings.join(' ')).toContain('未涵蓋角色')
  })

  it('returns unavailable when no source covers any selected character', () => {
    const result = recombineRotation(
      ['charZ'],
      [makePreset('src-a', ['charA'], [makeStep(1, 'charA')])],
    )

    expect(result.kind).toBe('unavailable')
    expect(result.steps).toHaveLength(0)
    expect(result.uncoveredCharacterIds).toEqual(['charZ'])
  })

  it('keeps preset sourceIds even when steps carry no sourceIds', () => {
    const result = recombineRotation(
      ['charA'],
      [
        makePreset(
          'src-a',
          ['charA'],
          [makeStep(1, 'charA')],
          ['video-source-1', 'article-source-2'],
        ),
      ],
    )

    expect(result.kind).toBe('source-backed')
    expect(result.sourceIds).toEqual(['video-source-1', 'article-source-2'])
    expect(result.sourceSegments[0].sourceIds).toEqual([
      'video-source-1',
      'article-source-2',
    ])
  })

  it('falls back to step sourceIds when preset sourceIds are empty', () => {
    const result = recombineRotation(
      ['charA'],
      [
        makePreset(
          'src-step-only',
          ['charA'],
          [makeStep(1, 'charA', { sourceIds: ['step-source'] })],
          [],
        ),
      ],
    )

    expect(result.kind).toBe('source-backed')
    expect(result.sourceIds).toEqual(['step-source'])
  })

  it('rejects a preset with only partially sourced steps', () => {
    const result = recombineRotation(
      ['charA'],
      [
        makePreset(
          'src-partial',
          ['charA'],
          [
            makeStep(1, 'charA', { sourceIds: ['step-source'] }),
            makeStep(2, 'charA'),
          ],
          [],
        ),
      ],
    )

    expect(result.kind).toBe('unavailable')
    expect(result.steps).toHaveLength(0)
  })

  it('never reuses a preset in composite or fragment output', () => {
    const presets = [
      makePreset(
        'src-a',
        ['charA'],
        [makeStep(1, 'charA')],
      ),
      makePreset(
        'src-b',
        ['charB'],
        [makeStep(1, 'charB')],
      ),
      makePreset(
        'src-a',
        ['charA'],
        [makeStep(1, 'charA')],
      ),
    ]
    const result = recombineRotation(['charA', 'charB'], presets)

    expect(result.sourceSegments.map((segment) => segment.presetId)).toEqual([
      'src-a',
      'src-b',
    ])
    expect(
      new Set(result.sourceSegments.map((segment) => segment.presetId)).size,
    ).toBe(result.sourceSegments.length)
  })

  it('is deterministic across repeated calls and preset order', () => {
    const presets = [
      makePreset('src-c', ['charC'], [makeStep(1, 'charC')]),
      makePreset('src-a', ['charA'], [makeStep(1, 'charA')]),
      makePreset('src-b', ['charB'], [makeStep(1, 'charB')]),
    ]
    const first = recombineRotation(
      ['charC', 'charA', 'charB'],
      presets,
    )
    const second = recombineRotation(
      ['charC', 'charA', 'charB'],
      presets,
    )
    const reversed = recombineRotation(
      ['charB', 'charA', 'charC'],
      [...presets].reverse(),
    )

    expect(first).toEqual(second)
    expect(reversed).toEqual(first)
    expect(first.sourceSegments.map((segment) => segment.presetId)).toEqual([
      'src-a',
      'src-b',
      'src-c',
    ])
  })

  describe('real rotation_physical_shatter_202601 subset matrix', () => {
    const preset = loadPhysicalShatterPreset()

    for (const selection of combinations(preset.characterIds)) {
      it(`recombines ${selection.length} character(s) while preserving authored evidence`, () => {
        const expectedSteps = preset.steps.filter((step) =>
          selection.includes(step.characterId),
        )
        const result = recombineRotation(selection, [preset])
        const reversed = recombineRotation([...selection].reverse(), [preset])

        expect(result.kind).toBe(
          selection.length === preset.characterIds.length
            ? 'source-backed'
            : 'source-fragment',
        )
        expect(result.steps.map((step) => step.id)).toEqual(
          expectedSteps.map((step) => step.id),
        )
        expect(stepNames(result)).toEqual(
          expectedSteps.map((step) => step.skillName),
        )
        expect(result.steps.map((step) => step.characterId)).toEqual(
          expectedSteps.map((step) => step.characterId),
        )
        expect(result.sourceIds).toEqual(preset.sourceIds)
        expect(result.sourceSegments).toHaveLength(1)
        expect(result.sourceSegments[0]).toMatchObject({
          presetId: 'rotation_physical_shatter_202601',
          name: '物理碎冰隊基礎循環',
          sourceIds: [
            'src_gamersky_shatter_2078431',
            'src_nga_shatter_46010223',
            'src_taptap_shatter_763416813445841179',
          ],
        })
        expect(result.sourceSegments[0].steps).toEqual(result.steps)
        expect(result.sourceSegments[0].steps.map((step) => step.id)).toEqual(
          expectedSteps.map((step) => step.id),
        )
        expect(reversed).toEqual(result)
      })
    }
  })
})
