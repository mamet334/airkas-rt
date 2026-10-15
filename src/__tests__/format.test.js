import { describe, it, expect } from 'vitest'
import { fmtRp, fmtDate, getCycleMonthYear, MONTHS } from '../utils/format'

describe('format utils', () => {
  it('fmtRp formats numbers as IDR currency without decimals', () => {
    expect(fmtRp(15000)).toBe('Rp 15.000')
  })

  it('fmtRp separates thousands so 1.000 and 10.000 are easy to tell apart', () => {
    expect(fmtRp(1000)).toBe('Rp 1.000')
    expect(fmtRp(10000)).toBe('Rp 10.000')
    expect(fmtRp(100000)).toBe('Rp 100.000')
  })

  it('fmtRp puts the minus sign before Rp', () => {
    expect(fmtRp(-15000)).toBe('-Rp 15.000')
  })

  it('fmtRp falls back to Rp 0 for non-numeric input', () => {
    expect(fmtRp('abc')).toBe('Rp 0')
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
