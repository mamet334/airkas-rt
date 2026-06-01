import { describe, it, expect } from 'vitest'
import { fmtRp, fmtDate, getCycleMonthYear, MONTHS } from '../utils/format'

describe('format utils', () => {
  it('fmtRp formats numbers as IDR currency without decimals', () => {
    const out = fmtRp(15000)
    expect(out).toMatch(/Rp\s?15.000|Rp15.000/)
  })

  it('fmtRp handles null/undefined', () => {
    expect(fmtRp(null)).toBe('Rp 0')
    expect(fmtRp(undefined)).toBe('Rp 0')
  })

  it('fmtDate returns localized date or dash for falsy', () => {
    expect(fmtDate('2026-05-21')).toContain('2026')
    expect(fmtDate('')).toBe('-')
  })

  it('getCycleMonthYear returns month and year', () => {
    const r = getCycleMonthYear('2026-05-21')
    expect(r).toHaveProperty('month')
    expect(r).toHaveProperty('year')
    expect(MONTHS[r.month]).toBeTruthy()
  })
})
