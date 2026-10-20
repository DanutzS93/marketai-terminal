import React from 'react';
import { TradingSignal } from '../types';
import { getOrCalculateOrderFlow } from '../utils/signalUtils';
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface OrderFlowWidgetProps {
  signal: TradingSignal;
  lang: 'ro' | 'en';
}

export const OrderFlowWidget: React.FC<OrderFlowWidgetProps> = ({ signal, lang }) => {
  const of = getOrCalculateOrderFlow(signal);
  const isBuy = signal.type ? signal.type.includes('BUY') : true;

  const deltaFormatted = (of.delta > 0 ? '+' : '') + of.delta.toLocaleString('en-US') + ' ' + (lang === 'ro' ? 'contracte' : 'contracts');

  return (
    <div className="bg-[#070E1E]/85 backdrop-blur-xl text-white p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-lg space-y-3 relative overflow-hidden">
      {/* Header Layout: Flexible for mobile */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg shrink-0 ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide font-mono">
                  Order Flow & Delta
                </h4>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono px-1.5 py-0.5 rounded font-semibold">
                  INSTITUTIONAL
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {lang === 'ro' ? 'Analiză Microstructură & Volume' : 'Microstructure & Volume Flow'}
              </p>
            </div>
          </div>

          {/* Badge on Mobile (aligned right if header is full width) */}
          <div className={`sm:hidden px-2 py-0.5 rounded text-[10px] font-bold font-mono border flex items-center gap-1 shrink-0 ${
            isBuy 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
              : 'bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
          }`}>
            {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{isBuy ? 'BULLISH DELTA' : 'BEARISH DELTA'}</span>
          </div>
        </div>

        {/* Badge on Desktop */}
        <div className={`hidden sm:flex px-2.5 py-1 rounded-md text-[11px] font-bold font-mono border items-center gap-1 shrink-0 ${
          isBuy 
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
            : 'bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
        }`}>
          {isBuy ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          <span>{isBuy ? 'BULLISH DELTA' : 'BEARISH DELTA'}</span>
        </div>
      </div>

      {/* Main Delta & Buyer/Seller Volume Meter */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
          <div className="flex items-center justify-between sm:justify-start gap-1.5">
            <span className="text-slate-400 text-[11px] font-sans">{lang === 'ro' ? 'Delta Volum:' : 'Volume Delta:'}</span>
            <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>{deltaFormatted}</span>
          </div>
          <div className="text-[11px] text-slate-300 font-bold flex items-center justify-between sm:justify-end gap-2">
            <span className="text-emerald-400">{of.buyVolumePercent}% {lang === 'ro' ? 'Cumpărători' : 'Buyers'}</span>
            <span className="text-slate-500">|</span>
            <span className="text-rose-400">{of.sellVolumePercent}% {lang === 'ro' ? 'Vânzători' : 'Sellers'}</span>
          </div>
        </div>

        {/* Dual Color Progress Meter */}
        <div className="w-full bg-slate-950/80 h-2.5 rounded-full overflow-hidden flex p-0.5 border border-white/10 shadow-inner">
          <div
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-l-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
            style={{ width: `${of.buyVolumePercent}%` }}
            title={`Buy Aggression: ${of.buyVolumePercent}%`}
          />
          <div
            className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-r-full transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
            style={{ width: `${of.sellVolumePercent}%` }}
            title={`Sell Aggression: ${of.sellVolumePercent}%`}
          />
        </div>
      </div>

      {/* Microstructure Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
        <div className="bg-white/5 backdrop-blur-md p-2.5 rounded-lg border border-white/10 flex items-center justify-between sm:block">
          <span className="text-slate-400 text-[10px] block font-sans">{lang === 'ro' ? 'Imbalanță Footprint:' : 'Footprint Imbalance:'}</span>
          <span className="font-bold text-indigo-300 font-mono text-[11px] mt-0.5 block">
            {of.imbalanceType === 'BUY_SIDE_STACKED' 
              ? (lang === 'ro' ? '⚡ Cumpărare Agresivă' : '⚡ Buy Imbalance')
              : (lang === 'ro' ? '⚡ Vânzare Agresivă' : '⚡ Sell Imbalance')}
          </span>
        </div>

        <div className="bg-white/5 backdrop-blur-md p-2.5 rounded-lg border border-white/10 flex items-center justify-between sm:block">
          <span className="text-slate-400 text-[10px] block font-sans">{lang === 'ro' ? 'Absorbție Pasivă:' : 'Passive Absorption:'}</span>
          <span className="font-bold text-amber-300 font-mono text-[11px] mt-0.5 block">
            ${of.absorptionLevel || signal.entryPrice}
          </span>
        </div>
      </div>
    </div>
  );
};
