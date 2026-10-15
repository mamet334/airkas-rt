import { describe, it, expect } from 'vitest';
import { digitsOnly, normalizeDigits, formatRibuan, caretAfterDigits } from './rupiahInput.js';

describe('rupiahInput — digitsOnly', () => {
  it('menyisakan hanya angka', () => {
    expect(digitsOnly('Rp 150.000')).toBe('150000');
    expect(digitsOnly('150.000')).toBe('150000');
    expect(digitsOnly('1a5b0')).toBe('150');
  });

  it('aman untuk nilai kosong, null, dan angka', () => {
    expect(digitsOnly('')).toBe('');
    expect(digitsOnly(null)).toBe('');
    expect(digitsOnly(undefined)).toBe('');
    expect(digitsOnly(150000)).toBe('150000');
  });

  it('membuang tanda minus — nominal tidak boleh negatif', () => {
    expect(digitsOnly('-5000')).toBe('5000');
  });
});

describe('rupiahInput — normalizeDigits', () => {
  it('membuang nol di depan', () => {
    expect(normalizeDigits('0150000')).toBe('150000');
    expect(normalizeDigits('00008000')).toBe('8000');
  });

  it('tetap menyisakan satu nol jika nilainya memang nol', () => {
    expect(normalizeDigits('0')).toBe('0');
    expect(normalizeDigits('000')).toBe('0');
  });

  it('kolom yang dikosongkan tetap kosong, bukan jadi 0', () => {
    expect(normalizeDigits('')).toBe('');
  });
});

describe('rupiahInput — formatRibuan', () => {
  it('membedakan seribu dan sepuluh ribu — alasan utama fitur ini', () => {
    expect(formatRibuan('1000')).toBe('1.000');
    expect(formatRibuan('10000')).toBe('10.000');
    expect(formatRibuan('100000')).toBe('100.000');
  });

  it('tidak menambah titik untuk angka di bawah seribu', () => {
    expect(formatRibuan('0')).toBe('0');
    expect(formatRibuan('999')).toBe('999');
  });

  it('kolom kosong ditampilkan kosong, bukan 0', () => {
    expect(formatRibuan('')).toBe('');
  });

  it('nilai yang sudah berformat tidak rusak saat diformat ulang', () => {
    expect(formatRibuan('150.000')).toBe('150.000');
  });

  it('menerima angka, bukan hanya string', () => {
    expect(formatRibuan(912000)).toBe('912.000');
  });
});

describe('rupiahInput — caretAfterDigits', () => {
  it('menempatkan kursor setelah digit ke-N, melewati titik', () => {
    // "150.000" -> digit ke-3 adalah "0" pada indeks 2, kursor di indeks 3
    expect(caretAfterDigits('150.000', 3)).toBe(3);
    // digit ke-4 adalah "0" pada indeks 4 (setelah titik), kursor di indeks 5
    expect(caretAfterDigits('150.000', 4)).toBe(5);
  });

  it('kursor di awal tetap di awal', () => {
    expect(caretAfterDigits('150.000', 0)).toBe(0);
  });

  it('kursor tidak melewati ujung teks', () => {
    expect(caretAfterDigits('150.000', 99)).toBe(7);
    expect(caretAfterDigits('', 3)).toBe(0);
  });
});
