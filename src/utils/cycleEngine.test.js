/* global process */
import { getCycleMonthYear as getOldCycle, getCycleDateRange as getOldRange } from './billing.js';
import { getCycleTarget, getCycleDateRange as getNewRange, getCycleLabel } from './cycleEngine.js';

let passed = true;

const checkParityTarget = (dateStr) => {
  const oldRes = getOldCycle(dateStr);
  const newRes = getCycleTarget(dateStr);
  if (oldRes.month !== newRes.month || oldRes.year !== newRes.year) {
    console.error(`MISMATCH on target for ${dateStr}: Old(${oldRes.month}/${oldRes.year}) vs New(${newRes.month}/${newRes.year})`);
    passed = false;
  }
};

const checkParityRange = (month, year) => {
  const oldRes = getOldRange(month, year);
  const newRes = getNewRange(month, year);
  if (oldRes.start !== newRes.start || oldRes.end !== newRes.end) {
    console.error(`MISMATCH on range for ${month}/${year}: Old(${oldRes.start} to ${oldRes.end}) vs New(${newRes.start} to ${newRes.end})`);
    passed = false;
  }
};

// Tests
checkParityTarget('2026-06-14T10:00:00Z'); // Should map to May (5)
checkParityTarget('2026-06-15T10:00:00Z'); // Should map to June (6)
checkParityTarget('2026-01-10T10:00:00Z'); // Should map to December 2025
checkParityTarget(null);

checkParityRange(6, 2026);
checkParityRange(1, 2026);

if (passed) {
  console.log('SUCCESS: Logic Parity Check 100% PASS (0 Mismatch)');
  console.log('Test Cycle Label:', getCycleLabel(1, 2026));
} else {
  console.log('FAILED: Mismatch detected');
  process.exit(1);
}