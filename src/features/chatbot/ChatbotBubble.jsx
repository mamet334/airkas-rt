import { useState, useRef, useEffect, useCallback } from 'react';
import { useDb } from '../../store/DbContext';
import { answerQuestion, BANTUAN } from './chatEngine';
import { MessageCircle, X, Send } from 'lucide-react';

const POS_KEY = 'airkas_chat_pos';
// Ukuran dibuat lapang dan tulisan cukup besar agar mudah dibaca warga lanjut usia
const UKURAN_BUBBLE = 64;
const LEBAR_PANEL = 400;
const TINGGI_PANEL = 600;
const GESER_DIANGGAP_DRAG = 6; // piksel

const batasi = (nilai, min, max) => Math.min(Math.max(nilai, min), max);

// null = belum pernah digeser -> pakai penambat CSS pojok kanan bawah.
// Koordinat piksel hanya dipakai setelah warga menggeser bubble, sehingga
// posisi bawaan tidak bergantung pada ukuran jendela saat render pertama.
const posisiTersimpan = () => {
  try {
    const tersimpan = JSON.parse(localStorage.getItem(POS_KEY));
    if (tersimpan && Number.isFinite(tersimpan.x) && Number.isFinite(tersimpan.y)) return tersimpan;
  } catch {
    // localStorage tidak tersedia / isinya rusak — pakai posisi bawaan
  }
  return null;
};

const ChatbotBubble = () => {
  const { state, isLoading } = useDb();

  const [pos, setPos] = useState(posisiTersimpan);
  const [terbuka, setTerbuka] = useState(false);
  const [input, setInput] = useState('');
  const [pesan, setPesan] = useState([
    { dari: 'bot', teks: `Halo! Saya asisten kas air RT.\n\n${BANTUAN}` }
  ]);

  const dragRef = useRef({ aktif: false, geser: 0, offsetX: 0, offsetY: 0, posTerakhir: null });
  const bubbleRef = useRef(null);
  const akhirPesanRef = useRef(null);
  const inputRef = useRef(null);

  // Jaga bubble tetap di dalam layar saat ukuran jendela berubah
  useEffect(() => {
    const onResize = () => {
      setPos(p => (p ? {
        x: batasi(p.x, 8, Math.max(8, window.innerWidth - UKURAN_BUBBLE - 8)),
        y: batasi(p.y, 8, Math.max(8, window.innerHeight - UKURAN_BUBBLE - 8))
      } : p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (terbuka) akhirPesanRef.current?.scrollIntoView({ block: 'end' });
  }, [pesan, terbuka]);

  const simpanPosisi = useCallback((p) => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* diabaikan */ }
  }, []);

  // ─── Geser bubble ─────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // Posisi nyata bubble saat ini (baik dari penambat CSS maupun koordinat piksel)
    const kotak = bubbleRef.current?.getBoundingClientRect();
    const mulai = pos || { x: kotak?.left ?? 0, y: kotak?.top ?? 0 };
    dragRef.current = {
      aktif: true,
      geser: 0,
      offsetX: e.clientX - mulai.x,
      offsetY: e.clientY - mulai.y,
      posTerakhir: mulai
    };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.aktif) return;
    const x = batasi(e.clientX - d.offsetX, 8, Math.max(8, window.innerWidth - UKURAN_BUBBLE - 8));
    const y = batasi(e.clientY - d.offsetY, 8, Math.max(8, window.innerHeight - UKURAN_BUBBLE - 8));
    d.geser += Math.abs(x - d.posTerakhir.x) + Math.abs(y - d.posTerakhir.y);
    d.posTerakhir = { x, y };
    setPos({ x, y });
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    if (!d.aktif) return;
    d.aktif = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (d.geser < GESER_DIANGGAP_DRAG) {
      // Dianggap klik, bukan geser
      setTerbuka(o => !o);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (d.posTerakhir) {
      simpanPosisi(d.posTerakhir);
    }
  };

  // ─── Kirim pertanyaan ─────────────────────────────────────────────────────
  const kirim = (teks) => {
    const pertanyaan = (teks ?? input).trim();
    if (!pertanyaan) return;

    // Data belum siap -> jangan jawab "tidak kenal", jelaskan apa adanya
    if (isLoading || !state.warga || state.warga.length === 0) {
      setPesan(sebelumnya => [
        ...sebelumnya,
        { dari: 'warga', teks: pertanyaan },
        { dari: 'bot', teks: 'Data masih dimuat dari server. Tunggu sebentar, lalu tanyakan lagi ya.' }
      ]);
      setInput('');
      return;
    }

    const { text } = answerQuestion(pertanyaan, state);
    setPesan(sebelumnya => [
      ...sebelumnya,
      { dari: 'warga', teks: pertanyaan },
      { dari: 'bot', teks: text }
    ]);
    setInput('');
  };

  const onSubmit = (e) => {
    e.preventDefault();
    kirim();
  };

  // Ukuran panel selalu menyesuaikan layar HP
  const ukuranPanel = {
    width: `min(${LEBAR_PANEL}px, calc(100vw - 16px))`,
    height: `min(${TINGGI_PANEL}px, calc(100vh - 24px))`
  };

  // Belum pernah digeser -> tetap di pojok kanan bawah (di atas menu bawah HP).
  // Sudah digeser -> panel menempel di dekat bubble, tetap di dalam layar.
  const bubbleStyle = pos
    ? { left: pos.x, top: pos.y }
    : { right: 16, bottom: 96 };

  const panelStyle = pos
    ? {
      ...ukuranPanel,
      left: batasi(pos.x + UKURAN_BUBBLE - LEBAR_PANEL, 8, Math.max(8, window.innerWidth - LEBAR_PANEL - 8)),
      top: batasi(pos.y - TINGGI_PANEL - 12, 8, Math.max(8, window.innerHeight - TINGGI_PANEL - 8))
    }
    : { ...ukuranPanel, right: 16, bottom: 96 + UKURAN_BUBBLE + 12 };

  const saran = [
    'Saldo kas berapa?',
    'Siapa yang sudah bayar?',
    'Siapa yang belum bayar?',
    'Rincian belum bayar',
    'Laporan bulan ini',
    'Pengeluaran bulan ini',
    'Tarif berapa?'
  ];

  return (
    <div className="no-print">
      {terbuka && (
        <div
          style={panelStyle}
          className="fixed z-50 flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3.5 bg-teal-600 text-white shrink-0">
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight">Tanya Kas Air RT</p>
              <p className="text-xs opacity-90 leading-tight">Info keuangan, hanya bacaan</p>
            </div>
            <button
              type="button"
              onClick={() => setTerbuka(false)}
              aria-label="Tutup obrolan"
              className="p-2 rounded-lg hover:bg-white/20 transition-colors shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Daftar pesan */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50 dark:bg-slate-950/40">
            {pesan.map((p, i) => (
              <div key={i} className={`flex ${p.dari === 'warga' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[15px] whitespace-pre-line leading-relaxed ${
                    p.dari === 'warga'
                      ? 'bg-teal-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                  }`}
                >
                  {p.teks}
                </div>
              </div>
            ))}
            <div ref={akhirPesanRef} />
          </div>

          {/* Saran pertanyaan */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800 shrink-0">
            {saran.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => kirim(s)}
                className="px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="flex items-center gap-2 p-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Sebagian browser/keyboard HP tidak memicu submit form dari Enter
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  kirim();
                }
              }}
              placeholder="Tulis pertanyaan..."
              aria-label="Pertanyaan untuk asisten kas air"
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl text-[15px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              aria-label="Kirim pertanyaan"
              className="p-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-colors shrink-0"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      )}

      {/* Bubble */}
      <button
        ref={bubbleRef}
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ ...bubbleStyle, width: UKURAN_BUBBLE, height: UKURAN_BUBBLE, touchAction: 'none' }}
        aria-label={terbuka ? 'Tutup asisten kas air' : 'Buka asisten kas air'}
        className="fixed z-50 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
      >
        {terbuka ? <X size={26} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
};

export default ChatbotBubble;
