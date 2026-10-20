import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  signalCount: number;
  lang: 'ro' | 'en';
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  signalCount,
  lang,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 to-[#050914]/98 border border-white/15 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100 glass-specular-top relative overflow-hidden">
        {/* Ambient warning illumination glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0 shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {lang === 'ro' ? 'Ștergere Definitivă Istoric' : 'Delete All Signal History'}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {lang === 'ro' ? `Tranzacții vizate: ${signalCount} semnale` : `Target: ${signalCount} signals`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Description */}
        <div className="relative z-10 bg-white/5 border border-white/10 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed backdrop-blur-md">
          {lang === 'ro' ? (
            <p>
              Ești sigur că dorești să ștergi <strong className="text-rose-400 font-bold">definitiv</strong> toate cele{' '}
              <strong className="text-white font-mono font-bold">{signalCount}</strong> semnale din istoric? Această acțiune va curăța atât stocarea locală cât și sincronizarea în cloud.
            </p>
          ) : (
            <p>
              Are you sure you want to <strong className="text-rose-400 font-bold">permanently delete</strong> all{' '}
              <strong className="text-white font-mono font-bold">{signalCount}</strong> signals from your history? This action will clear local storage and cloud sync.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs border border-white/10 transition cursor-pointer"
          >
            {lang === 'ro' ? 'Anulează' : 'Cancel'}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-rose-900/40 border border-rose-400/30"
          >
            <Trash2 className="w-4 h-4" />
            <span>{lang === 'ro' ? 'Da, Șterge Tot Istoricul' : 'Yes, Delete All History'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
