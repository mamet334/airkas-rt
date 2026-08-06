import { describe, it, expect } from 'vitest';
import { getCycleMonthYear as getOldCycle, getCycleDateRange as getOldRange } from '../billing';
import { getCycleTarget, getCycleDateRange as getNewRange, getCycleLabel } from '../cycleEngine';

describe('Cycle Engine Parity Checks', () => {
  it('should match cycle target for given dates', () => {
    const testCases = [
      { dateStr: '2026-06-14T10:00:00Z', expectedMonth: 5, expectedYear: 2026 },
      { dateStr: '2026-06-15T10:00:00Z', expectedMonth: 6, expectedYear: 2026 },
      { dateStr: '2026-01-10T10:00:00Z', expectedMonth: 12, expectedYear: 2025 },
      { dateStr: null, expectedMonth: undefined, expectedYear: undefined },
    ];
    testCases.forEach(({ dateStr, expectedMonth, expectedYear }) => {
      const newRes = getCycleTarget(dateStr);
      expect(newRes.month).toBe(expectedMonth);
      expect(newRes.year).toBe(expectedYear);
    });
  });

  it('should match cycle date ranges for given month and year', () => {
    const testCases = [
      { month: 6, year: 2026 },
      { month: 1, year: 2026 }
    ];
    testCases.forEach(({ month, year }) => {
      const oldRes = getOldRange(month, year);
      const newRes = getNewRange(month, year);
      expect(newRes.start).toBe(oldRes.start);
      expect(newRes.end).toBe(oldRes.end);
    });
  });

  it('should generate correct cycle label', () => {
    const label = getCycleLabel(1, 2026);
    expect(label).toBe('15 Desember 2025 - 14 Januari 2026');
  });
});