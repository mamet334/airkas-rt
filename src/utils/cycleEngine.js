export const MONTHS = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Menghitung bulan dan tahun target siklus penagihan berdasarkan tanggal.
 * Siklus: 15 (Bulan Sebelumnya) - 14 (Bulan Ini) -> Target: Bulan Ini
 * @param {string|Date} dateStr 
 * @returns {{ month: number, year: number }}
 */
export const getCycleTarget = (dateStr) => {
  if (!dateStr) return { month: 1, year: 2026 }; // Default sistem
  const d = new Date(dateStr);
  const day = d.getDate();
  let month = d.getMonth() + 1;
  let year = d.getFullYear();

  if (day < 15) {
    month = month - 1;
    if (month === 0) {
      month = 12;
      year = year - 1;
    }
  }
  return { month, year };
};

/**
 * Menghitung rentang tanggal (start dan end) untuk suatu siklus (15-14).
 * @param {number} month 
 * @param {number} year 
 * @returns {{ start: string, end: string }} Format YYYY-MM-DD
 */
export const getCycleDateRange = (month, year) => {
  let startMonth = month - 1;
  let startYear = year;
  
  if (startMonth === 0) {
    startMonth = 12;
    startYear = year - 1;
  }
  
  const start = `${startYear}-${String(startMonth).padStart(2, '0')}-15`;
  const end = `${year}-${String(month).padStart(2, '0')}-14`;
  
  return { start, end };
};

/**
 * Menghasilkan label periode siklus yang ramah dibaca (UI Display).
 * @param {number} month 
 * @param {number} year 
 * @returns {string} Contoh: "15 Mei - 14 Juni 2026"
 */
export const getCycleLabel = (month, year) => {
  let startMonth = month - 1;
  let startYear = year;
  
  if (startMonth === 0) {
    startMonth = 12;
    startYear = year - 1;
  }

  if (startYear !== year) {
    return `15 ${MONTHS[startMonth]} ${startYear} - 14 ${MONTHS[month]} ${year}`;
  }
  
  return `15 ${MONTHS[startMonth]} - 14 ${MONTHS[month]} ${year}`;
};

// Alias untuk menjaga kompatibilitas dengan penamaan fungsi lama di billing.js
export const getCycleMonthYear = getCycleTarget;
