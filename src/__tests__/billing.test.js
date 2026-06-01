import { describe, it, expect } from 'vitest'
import { getCycleMonthYear } from '../utils/billing'

describe('billing utils', () => {
  it('returns previous month when day < 15', () => {
    const r = getCycleMonthYear('2026-05-10')
    expect(r.month).toBe(4)
    expect(r.year).toBe(2026)
  })

  it('returns same month when day >= 15', () => {
    const r = getCycleMonthYear('2026-05-15')
    expect(r.month).toBe(5)
    expect(r.year).toBe(2026)
  })

  it('handles year boundary correctly for early month', () => {
    const r = getCycleMonthYear('2026-01-10')
    expect(r.month).toBe(12)
    expect(r.year).toBe(2025)
  })
})
