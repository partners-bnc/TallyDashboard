import { describe, expect, it } from 'vitest'
import { normalizePeriodQuery } from './period'

describe('normalizePeriodQuery', () => {
  it('treats blank values as an all-time period', () => {
    expect(normalizePeriodQuery('', '   ')).toEqual({ from: '', to: '', isValid: true })
  })

  it('keeps a valid bounded range', () => {
    expect(normalizePeriodQuery('2026-01-01', '2026-01-31')).toEqual({ from: '2026-01-01', to: '2026-01-31', isValid: true })
  })

  it('supports either date bound independently', () => {
    expect(normalizePeriodQuery('2026-01-01', undefined)).toEqual({ from: '2026-01-01', to: '', isValid: true })
    expect(normalizePeriodQuery(undefined, '2026-01-31')).toEqual({ from: '', to: '2026-01-31', isValid: true })
  })

  it('rejects malformed dates and inverted ranges', () => {
    expect(normalizePeriodQuery('2026-02-30', '')).toEqual({ from: '', to: '', isValid: false })
    expect(normalizePeriodQuery('2026-02-01', '2026-01-31')).toEqual({ from: '', to: '', isValid: false })
  })
})
