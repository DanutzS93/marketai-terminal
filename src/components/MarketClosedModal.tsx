import React from 'react';
import { Lock, Clock, Calendar, Globe, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getMarketScheduleStatus } from '../utils/marketSchedule';

interface MarketClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
}

export const MarketClosedModal: React.FC<MarketClosedModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  const status = getMarketScheduleStatus();

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md overflow-y-auto p-3 sm:p-6 flex justify-center items-center min-h-screen py-6"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-7 relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white">
                {lang === 'ro' ? 'Piața este Închisă (Weekend)' : 'Market Closed (Weekend)'}
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {lang === 'ro' ? 'Weekend Pause' : 'Weekend Pause'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'ro'
                ? 'Intervalul activ de tranzacționare este Luni 01:00 – Vineri 24:00'
                : 'Active trading period: Monday 01:00 AM – Friday midnight'}
            </p>
          </div>
        </div>

        {/* Message Body */}
        <div className="my-5 space-y-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{lang === 'ro' ? 'Generarea de Semnale Live este Suspendată' : 'Live Signal Generation Suspended'}</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-medium">
              {lang === 'ro' ? status.reasonRo : status.reasonEn}
            </p>
          </div>

          {/* User Timezone & Schedule Info Card */}
          <div className="bg-indigo-950/40 border border-indigo-900/60 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-indigo-300 font-semibold text-xs border-b border-indigo-900/50 pb-2">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>{lang === 'ro' ? 'Fus Orar Local Detectat:' : 'Detected Local Timezone:'}</span>
              </span>
              <span className="font-mono font-bold text-white bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-700/50">
                {status.userTimezone}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 pt-1">
              <div className="flex items-start gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    {lang === 'ro' ? 'Ora Curentă Utilizator' : 'Your Current Time'}
                  </span>
                  <span className="font-semibold text-white capitalize">{status.currentLocalTimeStr}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-900/50">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase font-bold block">
                    {lang === 'ro' ? 'Reluare Semnale Live' : 'Live Signals Resume'}
                  </span>
                  <span className="font-bold text-emerald-400 capitalize">
                    {lang === 'ro' ? status.nextOpenTimeStrRo : status.nextOpenTimeStrEn}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition shadow-lg flex items-center justify-center gap-2"
          >
            <span>{lang === 'ro' ? 'Am înțeles (Închide)' : 'Understood (Close)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
