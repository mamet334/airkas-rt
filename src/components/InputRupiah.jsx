// src/components/InputRupiah.jsx
import { digitsOnly, normalizeDigits, formatRibuan, caretAfterDigits } from '../utils/rupiahInput';

/**
 * Kolom input nominal rupiah yang menampilkan titik ribuan sambil diketik:
 * mengetik 150000 tampil sebagai "150.000".
 *
 * Menggantikan <input type="number"> pada kolom uang, karena type="number"
 * tidak bisa menampilkan pemisah ribuan — di situlah Rp 1.000 dan Rp 10.000
 * jadi mudah tertukar.
 *
 * Nilai yang dikirim ke onChange SELALU digit murni ("150000"), bukan teks
 * berformat, sehingga Number(nilai) di pemanggil tetap bekerja tanpa diubah.
 *
 * @param {string|number} value nilai tersimpan (digit murni)
 * @param {(digits: string) => void} onChange menerima digit murni
 */
const InputRupiah = ({ value, onChange, className = '', ...rest }) => {
  const display = formatRibuan(value);

  const handleChange = (e) => {
    const input = e.target;
    const caret = input.selectionStart ?? input.value.length;
    // Posisi kursor disimpan sebagai "jumlah digit di kiri kursor", bukan
    // indeks karakter, karena jumlah titik bisa berubah setelah diformat.
    const digitsBeforeCaret = digitsOnly(input.value.slice(0, caret)).length;

    const next = normalizeDigits(input.value);
    onChange(next);

    const nextCaret = caretAfterDigits(formatRibuan(next), digitsBeforeCaret);
    // Dijalankan setelah React menulis ulang nilai input, kalau tidak
    // kursornya akan dilempar ke ujung kanan setiap kali mengetik.
    requestAnimationFrame(() => {
      if (input.isConnected) input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <input
      type="text"
      // Memunculkan papan tombol angka di ponsel, tanpa ikut membawa
      // keterbatasan type="number" (tidak bisa menampilkan titik ribuan).
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onChange={handleChange}
      className={className}
      {...rest}
    />
  );
};

export default InputRupiah;
