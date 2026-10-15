import { describe, it, expect } from 'vitest';
import { keteranganAkhirMeterLama } from './gantiMeterText.js';

describe('keteranganAkhirMeterLama', () => {
  it('kolom dikosongkan -> menjelaskan bahwa sisa diabaikan', () => {
    const r = keteranganAkhirMeterLama('', 123);
    expect(r.teks).toContain('diabaikan');
    expect(r.sisa).toBe(0);
    expect(r.peringatan).toBe(false);
  });

  it('sama dengan catatan terakhir -> menyatakan tidak ada tambahan (kasus Sukiono)', () => {
    const r = keteranganAkhirMeterLama('123', 123);
    expect(r.teks).toBe('Sama dengan catatan terakhir (123), jadi tidak ada tambahan pemakaian dari meteran lama.');
    expect(r.sisa).toBe(0);
    expect(r.peringatan).toBe(false);
    // Tidak boleh lagi berbunyi "0 m3 ikut ditagih" yang membingungkan
    expect(r.teks).not.toContain('ikut ditagih');
  });

  it('lebih besar dari catatan terakhir -> menyebut sisa yang ditagih', () => {
    const r = keteranganAkhirMeterLama('129', 123);
    expect(r.sisa).toBe(6);
    expect(r.teks).toContain('123 → 129');
    expect(r.teks).toContain('Sisa 6 m³');
    expect(r.peringatan).toBe(false);
  });

  it('lebih kecil dari catatan terakhir -> memberi peringatan salah ketik', () => {
    const r = keteranganAkhirMeterLama('114', 123);
    expect(r.peringatan).toBe(true);
    expect(r.sisa).toBe(0);
    expect(r.teks).toContain('lebih kecil dari catatan terakhir (123)');
  });

  it('bukan angka -> ditolak dengan peringatan', () => {
    const r = keteranganAkhirMeterLama('abc', 123);
    expect(r.peringatan).toBe(true);
    expect(r.sisa).toBe(0);
  });

  it('warga tanpa catatan sebelumnya (catatan terakhir 0)', () => {
    expect(keteranganAkhirMeterLama('', 0).sisa).toBe(0);
    expect(keteranganAkhirMeterLama('0', 0).teks).toContain('tidak ada tambahan');
    expect(keteranganAkhirMeterLama('5', 0).sisa).toBe(5);
  });

  it('menerima angka desimal seperti data lama (12.5 m3)', () => {
    const r = keteranganAkhirMeterLama('29.5', 21);
    expect(r.sisa).toBe(8.5);
  });

  it('spasi di sekitar angka tidak membuatnya dianggap kosong', () => {
    const r = keteranganAkhirMeterLama('  129  ', 123);
    expect(r.sisa).toBe(6);
  });
});
