import fs from 'fs';
import { parse } from '@babel/parser';

try {
  const code = fs.readFileSync('src/views/LaporanKeuangan.jsx', 'utf8');
  parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('Syntax OK');
} catch (e) {
  console.log('Syntax Error:', e.message);
}
