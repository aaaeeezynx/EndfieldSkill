import { describe, expect, it } from 'vitest'
import { toTraditional, toTraditionalList } from './traditionalChinese'

describe('traditional Chinese display conversion', () => {
  it('converts simplified display text to Taiwan traditional Chinese', () => {
    expect(toTraditional('选择队伍与装备')).toBe('選擇隊伍與裝備')
  })

  it('keeps the product name 編排台 instead of converting 台 to 臺', () => {
    expect(toTraditional('終末地 // 戰術編排台')).toBe('終末地 // 戰術編排台')
  })

  it('uses Taiwan wording for runtime, fields, data, and game tables', () => {
    expect(toTraditional('运行时不调用 AI')).toBe('執行期不呼叫 AI')
    expect(toTraditional('未知字段与游戏表数据')).toBe('未知欄位與遊戲資料表資料')
  })

  it('preserves null and converts list values', () => {
    expect(toTraditional(null)).toBeNull()
    expect(toTraditionalList(['连携技', '终结技'])).toEqual(['連攜技', '終結技'])
  })
})
