import { useState } from 'react';
import { useDb } from '../store/DbContext';
import { useNotification } from '../store/NotificationContext';
import { fmtDateTime } from '../utils/format';
import { Search, Trash2, Lock } from 'lucide-react';

const AuditLog = () => {
  const { state, isAdminUnlocked, executeWrite } = useDb();
  const { showToast, showAlert } = useNotification();
  const [search, setSearch] = useState('');

  const filteredLogs = [...state.audit]
    .filter(log => {
      const term = search.toLowerCase();
      const action = (log.aksi || '').toLowerCase();
      const detail = (log.detail || '').toLowerCase();
      return action.includes(term) || detail.includes(term);
    })
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at));

  const handleClearLogs = () => {
    showAlert({
      title: 'Hapus Semua Log Audit',
      message: 'Apakah Anda yakin ingin menghapus semua histori aktivitas log audit secara permanen? Tindakan ini tidak dapat dibatalkan.',
      type: 'danger',
      onConfirm: async () => {
        // Run delete all logs
        for (const log of state.audit) {
          await executeWrite({
            table: 'audit',
            action: 'delete',
            id: log.id,
            logMsg: `Menghapus log audit ID ${log.id}`
          });
        }
        showToast('Semua log audit berhasil dikosongkan.', 'success');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className="relative max-w-sm w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Cari aksi atau keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {isAdminUnlocked ? (
          <button
            onClick={handleClearLogs}
            className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-600 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Trash2 size={14} />
            Kosongkan Log
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
            <Lock size={14} />
            Buka Kunci Admin untuk mengosongkan log audit
          </div>
        )}
      </div>

      {/* AUDIT LOG TABLE CARD */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/60">
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Waktu Kejadian</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Kategori Aksi</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800">Keterangan / Detil Aktivitas</th>
                <th className="p-4 sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-center">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Belum ada histori aktivitas log audit.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const logAction = log.aksi || '';
                  const logDetail = log.detail || '';
                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                      <td className="p-4 font-mono">{fmtDateTime(log.created_at)}</td>
                      <td className="p-4 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                          logAction.includes('METER') ? 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400' :
                          logAction.includes('BAYAR') || logAction.includes('PAY') ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' :
                          logAction.includes('HAPUS') || logAction.includes('DELETE') ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400' :
                          'bg-slate-100 dark:bg-slate-700/45 text-slate-650 dark:text-slate-300'
                        }`}>
                          {logAction}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{logDetail}</td>
                      <td className="p-4 text-center font-semibold text-slate-500 dark:text-slate-450">{log.username || 'Administrator'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
