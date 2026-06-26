import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { Search, UserPlus, Edit2, Lock, Check, X } from 'lucide-react';

const DataWarga = () => {
  const { state, isAdminUnlocked, executeWrite } = useDb();
  const { showToast } = useNotification();
  
  const [search, setSearch] = useState('');
  const [editingWarga, setEditingWarga] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    no_meter: '',
    alamat: '',
    telepon: '',
    aktif: true,
    adalah_pengelola: false
  });

  const resetForm = () => {
    setFormData({
      nama: '',
      no_meter: '',
      alamat: '',
      telepon: '',
      aktif: true,
      adalah_pengelola: false
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleOpenEdit = (w) => {
    setEditingWarga(w);
    setFormData({
      nama: w.nama || '',
      no_meter: w.no_meter || '',
      alamat: w.alamat || '',
      telepon: w.telepon || '',
      aktif: w.aktif !== false,
      adalah_pengelola: w.adalah_pengelola === true
    });
  };

  const validateForm = () => {
    if (!formData.nama.trim()) {
      showToast('Nama warga wajib diisi', 'error');
      return false;
    }
    if (!formData.no_meter.trim()) {
      showToast('Nomor meter wajib diisi', 'error');
      return false;
    }
    const cleanNoMeter = formData.no_meter.trim().toUpperCase();
    const meterPattern = /^M-\d{3}$/;
    if (!meterPattern.test(cleanNoMeter)) {
      showToast('Format nomor meter harus M-XXX (contoh: M-001)', 'error');
      return false;
    }

    const duplicate = state.warga.find(w => w.no_meter === cleanNoMeter && w.id !== (editingWarga ? editingWarga.id : null));
    if (duplicate) {
      showToast(`Nomor meter ${cleanNoMeter} sudah dipakai oleh warga: ${duplicate.nama}`, 'error');
      return false;
    }
    if (!formData.alamat.trim()) {
      showToast('Alamat wajib diisi', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const cleanNoMeter = formData.no_meter.trim().toUpperCase();

      if (isAdding) {
        const newWarga = {
          id: crypto.randomUUID(),
          ...formData,
          no_meter: cleanNoMeter
        };

        await executeWrite({
          table: 'warga',
          action: 'insert',
          data: newWarga,
          logMsg: `Menambahkan warga baru: ${formData.nama} (${cleanNoMeter})`
        });
        setIsAdding(false);
      } else if (editingWarga) {
        const updatedData = {
          ...formData,
          no_meter: cleanNoMeter
        };

        await executeWrite({
          table: 'warga',
          action: 'update',
          id: editingWarga.id,
          data: updatedData,
          logMsg: `Mengubah data warga: ${editingWarga.nama} -> ${formData.nama}`
        });
        setEditingWarga(null);
      }
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  // Filter warga
  const filteredWarga = state.warga.filter(w => {
    const term = search.toLowerCase();
    return (
      w.nama.toLowerCase().includes(term) ||
      w.no_meter.toLowerCase().includes(term) ||
      w.alamat.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Cari nama, no meter, alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Add Button / Lock Notice */}
        {isAdminUnlocked ? (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-600/25 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <UserPlus size={16} />
            Tambah Warga
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
            <Lock size={14} />
            Buka Kunci Admin untuk mengedit warga
          </div>
        )}
      </div>

      {/* TABLE CARD */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                <th className="p-4 sticky top-0 left-0 z-30 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">Nama</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">No. Meter</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Alamat</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Telepon</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Status</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Tipe</th>
                {isAdminUnlocked && <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {filteredWarga.length === 0 ? (
                <tr>
                  <td colSpan={isAdminUnlocked ? 7 : 6} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Data warga tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredWarga.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100 sticky left-0 z-10 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700/40">{w.nama}</td>
                    <td className="p-4"><code className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{w.no_meter}</code></td>
                    <td className="p-4">{w.alamat}</td>
                    <td className="p-4">{w.telepon || '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[10px] ${w.aktif !== false ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700/30 text-slate-500'}`}>
                        {w.aktif !== false ? <Check size={10} /> : <X size={10} />}
                        {w.aktif !== false ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {w.adalah_pengelola ? (
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400">
                          Pengelola RT (Gratis)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 dark:bg-slate-700/30 text-slate-500">
                          Reguler
                        </span>
                      )}
                    </td>
                    {isAdminUnlocked && (
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenEdit(w)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL (ADD / EDIT) */}
      {(isAdding || editingWarga) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleSave} className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAdding ? 'Tambah Warga Baru' : 'Edit Data Warga'}
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Nama Lengkap Warga"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nomor Meter</label>
                <input
                  type="text"
                  required
                  value={formData.no_meter}
                  onChange={(e) => setFormData({ ...formData, no_meter: e.target.value })}
                  placeholder="Contoh: M-001"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Alamat / No Rumah</label>
                <input
                  type="text"
                  required
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Contoh: RT 01 RW 03 No. 12"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nomor Telepon (Optional)</label>
                <input
                  type="text"
                  value={formData.telepon}
                  onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
                  placeholder="08XXXXXXXXXX"
                  className="px-3 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Switches */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Status Warga</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Aktif atau Nonaktif</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.aktif}
                  onChange={(e) => setFormData({ ...formData, aktif: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Pengelola RT</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Gratis biaya air (adalah pengelola)</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.adalah_pengelola}
                  onChange={(e) => setFormData({ ...formData, adalah_pengelola: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingWarga(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-600/25 active:scale-95 transition-all"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DataWarga;
