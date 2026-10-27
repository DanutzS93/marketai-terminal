import React, { useState } from 'react';
import {
  Trophy,
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  TrendingUp,
  BarChart3,
  Award,
  Trash2,
  Info,
} from 'lucide-react';
import { TradingSignal, InstrumentId, TimeFrame } from '../types';
import { getOutcomeBadgeDetails, getLocalizedSignalText, formatFullDateTime, getCancellationReason } from '../utils/signalUtils';
import { SignalDetailsModal } from './SignalDetailsModal';

interface SignalHistoryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  signals: TradingSignal[];
  lang: 'ro' | 'en';
  onDeleteSignal?: (id: string) => void;
  onDeleteAllSignals?: () => void;
  onResetSignals?: () => void;
}

export const SignalHistoryStatsModal: React.FC<SignalHistoryStatsModalProps> = ({
  isOpen,
  onClose,
  signals,
  lang,
  onDeleteSignal,
  onDeleteAllSignals,
  onResetSignals,
}) => {
  const [filterAsset, setFilterAsset] = useState<InstrumentId | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSignalForDetails, setSelectedSignalForDetails] = useState<TradingSignal | null>(null);

  if (!isOpen) return null;

  // Filter signals
  const filtered = signals.filter((sig) => {
    if (filterAsset !== 'ALL' && sig.instrumentId !== filterAsset) return false;
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'BREAKEVEN' && sig.outcomeStatus !== 'TP1_HIT') return false;
      if (filterStatus === 'RUNNING' && sig.outcomeStatus !== 'RUNNING') return false;
      if (filterStatus === 'PENDING' && sig.outcomeStatus !== 'PENDING') return false;
      if (filterStatus === 'TP2' && sig.outcomeStatus !== 'TP2_HIT') return false;
      if (filterStatus === 'TP3' && sig.outcomeStatus !== 'TP3_HIT') return false;
      if (filterStatus === 'SL' && sig.outcomeStatus !== 'SL_HIT') return false;
      if (filterStatus === 'CANCELLED' && sig.outcomeStatus !== 'CANCELLED') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        sig.title.toLowerCase().includes(q) ||
        sig.symbol.toLowerCase().includes(q) ||
        sig.instrumentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate statistics
  const tp1Count = signals.filter((s) => s.outcomeStatus === 'TP1_HIT').length;
  const tp2Count = signals.filter((s) => s.outcomeStatus === 'TP2_HIT').length;
  const tp3Count = signals.filter((s) => s.outcomeStatus === 'TP3_HIT').length;
  const slCount = signals.filter((s) => s.outcomeStatus === 'SL_HIT').length;
  const runningCount = signals.filter((s) => s.outcomeStatus === 'RUNNING').length;
  const pendingCount = signals.filter((s) => !s.outcomeStatus || s.outcomeStatus === 'PENDING' || s.outcomeStatus === 'ACTIVE').length;

  const totalClosed = tp1Count + tp2Count + tp3Count + slCount;
  const totalWins = tp1Count + tp2Count + tp3Count;
  const winRatePercent = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : 0;

  // What was hit first count
  const tpFirstCount = signals.filter((s) => s.firstHitMilestone === 'TP1' || s.firstHitMilestone === 'TP2' || s.firstHitMilestone === 'TP3').length;
  const slFirstCount = signals.filter((s) => s.firstHitMilestone === 'SL').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto pt-12 sm:pt-6 pb-6 animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 via-[#080E1C]/95 to-[#040813]/98 rounded-2xl border border-white/15 shadow-2xl w-full max-w-5xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100vh-3.5rem)] sm:max-h-[88vh] text-slate-100 glass-specular-top">
        {/* Modal Header */}
        <div className="bg-[#060B18]/90 text-white p-3.5 sm:p-6 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 shrink-0 shadow-md shadow-indigo-500/15">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-xl font-bold tracking-tight text-white flex flex-wrap items-center gap-1.5 sm:gap-2 leading-tight">
                <span>{lang === 'ro' ? 'Istoric & Statistici Performanță Semnale' : 'Signal History & Performance Stats'}</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                  {winRatePercent}% {lang === 'ro' ? 'RATĂ DE CÂȘTIG' : 'WIN RATE'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                {lang === 'ro'
                  ? 'Jurnal detaliat al tuturor tranzacțiilor generate, monitorizate automat la prețul de piață live.'
                  : 'Detailed performance log of all generated trades, automatically monitored against live prices.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onDeleteAllSignals && signals.length > 0 && (
              <button
                onClick={onDeleteAllSignals}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-rose-950/40 border border-rose-400/30"
                title={lang === 'ro' ? 'Șterge definitiv tot istoricul de semnale' : 'Delete all signal history'}
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">{lang === 'ro' ? 'Șterge Tot Istoricul' : 'Clear All History'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Win Rate */}
            <div className="col-span-2 bg-gradient-to-br from-[#0E1A38]/90 via-[#0A1224]/90 to-[#070D1A]/95 text-white p-4 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between backdrop-blur-xl">
              <div>
                <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider block font-mono">
                  {lang === 'ro' ? 'Rată Câștig (TP vs SL)' : 'Win Rate (TP vs SL)'}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black font-mono text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">{winRatePercent}%</span>
                  <span className="text-xs text-slate-400 font-mono">({totalWins}/{totalClosed || 1} {lang === 'ro' ? 'închise' : 'closed'})</span>
                </div>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-3">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all shadow-[0_0_8px_rgba(52,211,153,0.5)]" style={{ width: `${winRatePercent}%` }}></div>
              </div>
            </div>

            {/* BreakEven / TP1 */}
            <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/25 backdrop-blur-md">
              <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block font-mono">
                {lang === 'ro' ? 'BreakEven (TP1)' : 'BreakEven (TP1)'}
              </span>
              <span className="text-2xl font-black font-mono text-emerald-300 block my-1">{tp1Count}</span>
              <span className="text-[10px] text-emerald-400/80 font-medium block">
                🛡️ {lang === 'ro' ? 'Risc eliminat' : 'Risk secured'}
              </span>
            </div>

            {/* TP2 Hits */}
            <div className="bg-emerald-500/15 p-3.5 rounded-xl border border-emerald-500/35 backdrop-blur-md">
              <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider block font-mono">
                TP2 Hit 🚀
              </span>
              <span className="text-2xl font-black font-mono text-emerald-200 block my-1">{tp2Count}</span>
              <span className="text-[10px] text-emerald-300/80 font-medium block">
                {lang === 'ro' ? 'Țintă intermediară' : 'Target 2 hit'}
              </span>
            </div>

            {/* TP3 Max */}
            <div className="bg-indigo-500/10 p-3.5 rounded-xl border border-indigo-400/25 backdrop-blur-md">
              <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block font-mono">
                TP3 Max 💎
              </span>
              <span className="text-2xl font-black font-mono text-indigo-300 block my-1">{tp3Count}</span>
              <span className="text-[10px] text-indigo-400/80 font-medium block">
                {lang === 'ro' ? 'Profit maxim' : 'Max profit hit'}
              </span>
            </div>

            {/* SL Hits */}
            <div className="bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/25 backdrop-blur-md">
              <span className="text-[10px] text-rose-300 font-bold uppercase tracking-wider block font-mono">
                Stop Loss 🔴
              </span>
              <span className="text-2xl font-black font-mono text-rose-400 block my-1">{slCount}</span>
              <span className="text-[10px] text-rose-400/80 font-medium block">
                {lang === 'ro' ? 'Invalide' : 'SL Triggered'}
              </span>
            </div>

            {/* Running Trades */}
            <div className="bg-cyan-500/10 p-3.5 rounded-xl border border-cyan-400/25 backdrop-blur-md">
              <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider block font-mono">
                {lang === 'ro' ? 'În Derulare' : 'Running'}
              </span>
              <span className="text-2xl font-black font-mono text-cyan-300 block my-1">{runningCount}</span>
              <span className="text-[10px] text-cyan-400/80 font-medium block">
                ⚡ {lang === 'ro' ? 'În piață' : 'Active position'}
              </span>
            </div>
          </div>

          {/* First Hit Milestone Analysis Summary Banner */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  {lang === 'ro' ? 'Analiză Primul Nivel Atins (TP vs SL First Touch)' : 'First Milestone Reached Analysis (TP vs SL First Touch)'}
                </h4>
                <p className="text-slate-300 text-xs">
                  {lang === 'ro'
                    ? `Din cele ${signals.length} semnale, ${tpFirstCount} au atins TP1 mai întâi (trecute pe BreakEven), iar ${slFirstCount} au atins Stop Loss mai întâi.`
                    : `Out of ${signals.length} total signals, ${tpFirstCount} reached TP1 first (moved to BreakEven), while ${slFirstCount} hit Stop Loss first.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs shrink-0">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                TP First: {tpFirstCount} ({signals.length > 0 ? Math.round((tpFirstCount / signals.length) * 100) : 0}%)
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30">
                SL First: {slFirstCount} ({signals.length > 0 ? Math.round((slFirstCount / signals.length) * 100) : 0}%)
              </span>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#060B18]/80 p-3 rounded-xl border border-white/10 text-xs backdrop-blur-md">
            {/* Search input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={lang === 'ro' ? 'Caută după titlu sau simbol...' : 'Search symbol or title...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0A1326]/90 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            {/* Asset & Status Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterAsset}
                onChange={(e) => setFilterAsset(e.target.value as any)}
                className="bg-[#0A1326]/90 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              >
                <option value="ALL">{lang === 'ro' ? 'Toate Activele' : 'All Assets'}</option>
                <optgroup label="--- INDICI & SPOT CFD ---">
                  <option value="NASDAQ">NASDAQ CFD (NAS100)</option>
                  <option value="SPX500">S&P 500 CFD (SPX500)</option>
                  <option value="DOW_JONES">Dow Jones CFD (US30)</option>
                  <option value="GOLD">Gold Spot (XAU/USD)</option>
                </optgroup>
                <optgroup label="--- CONTRACTE FUTURES ---">
                  <option value="NQ_F">Nasdaq 100 Futures (NQ.F)</option>
                  <option value="ES_F">S&P 500 Futures (ES.F)</option>
                  <option value="YM_F">Dow Jones Futures (DOW.F)</option>
                  <option value="GC_F">Gold Futures (GC.F)</option>
                </optgroup>
                <optgroup label="--- FOREX SPOT (FX) ---">
                  <option value="EURUSD">EUR/USD (Euro / US Dollar)</option>
                  <option value="GBPUSD">GBP/USD (British Pound)</option>
                  <option value="USDJPY">USD/JPY (US Dollar / Yen)</option>
                </optgroup>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#0A1326]/90 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              >
                <option value="ALL">{lang === 'ro' ? 'Toate Statusurile' : 'All Statuses'}</option>
                <option value="BREAKEVEN">BreakEven (TP1 Atins)</option>
                <option value="RUNNING">{lang === 'ro' ? 'În Derulare' : 'Running'}</option>
                <option value="PENDING">{lang === 'ro' ? 'În Așteptare' : 'Pending'}</option>
                <option value="TP2">TP 2 Atins</option>
                <option value="TP3">TP 3 Max Atins</option>
                <option value="SL">Stop Loss Atins</option>
                <option value="CANCELLED">{lang === 'ro' ? 'Anulat (Ordin Neactivat)' : 'Cancelled (Unfilled)'}</option>
              </select>
            </div>
          </div>

          {/* DETAILED SIGNAL LOG TABLE */}
          <div className="overflow-x-auto rounded-xl border border-white/10 shadow-xl bg-white/5 backdrop-blur-md">
            <table className="w-full text-left text-xs text-slate-200 font-mono">
              <thead className="bg-[#060B18]/90 text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3.5">{lang === 'ro' ? 'Data & Ora' : 'Date & Time'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Instrument' : 'Instrument'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Acțiune' : 'Action'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Tip Ordin' : 'Order Type'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Nivel Intrare' : 'Entry Price'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Stop Loss' : 'Stop Loss'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Take Profit (1 / 2 / 3)' : 'Take Profit (1 / 2 / 3)'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Stadiu Actual' : 'Current Status'}</th>
                  <th className="p-3.5">{lang === 'ro' ? 'Ce a Atins Prima Dată' : 'First Touch Milestone'}</th>
                  <th className="p-3.5 text-right">{lang === 'ro' ? 'Acțiuni' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">
                      {lang === 'ro' ? 'Nu s-a găsit niciun semnal conform filtrelor.' : 'No signals found matching selected filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((sig) => {
                    const badge = getOutcomeBadgeDetails(sig.outcomeStatus, lang, sig.isBeHitAfterTp1, sig.isBeHitAfterTp2);
                    const isBuy = sig.type.includes('BUY');

                    return (
                      <tr
                        key={sig.id}
                        onClick={() => setSelectedSignalForDetails(sig)}
                        className="hover:bg-white/5 transition cursor-pointer group"
                        title={lang === 'ro' ? 'Click pentru a vedea explicația detaliată a semnalului' : 'Click to view trade rationale pop-up'}
                      >
                        <td className="p-3.5 text-slate-300 font-sans text-[11px] font-semibold whitespace-nowrap">
                          {formatFullDateTime(sig.createdAt, lang)}
                        </td>
                        <td className="p-3.5 font-sans font-bold text-white">
                          <div className="group-hover:text-cyan-400 transition">{sig.instrumentName}</div>
                          <div className="text-[11px] text-slate-300 font-medium font-sans">
                            {getLocalizedSignalText(sig, 'title', lang)}
                          </div>
                          <div className="text-[10px] text-cyan-300 font-mono">
                            {sig.symbol} • {sig.timeframe}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              isBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {sig.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] font-semibold text-slate-300">
                          ⚡ {sig.executionType || 'Market Execution'}
                        </td>
                        <td className="p-3.5 font-bold text-white">${sig.entryPrice}</td>
                        <td className="p-3.5 text-rose-400 font-bold">${sig.stopLoss}</td>
                        <td className="p-3.5 text-emerald-400 font-bold">
                          <div className="text-[11px]">
                            <span>TP1: ${sig.targetPrice1}</span>
                            <div className="text-[10px] text-slate-400 font-normal">
                              TP2: ${sig.targetPrice2} | TP3: ${sig.targetPrice3}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded text-xs border whitespace-nowrap ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-3.5 font-sans text-xs">
                          {sig.firstHitMilestone === 'TP1' || sig.firstHitMilestone === 'TP2' || sig.firstHitMilestone === 'TP3' ? (
                            <span className="text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              {lang === 'ro' ? 'TP1 Atins Prima Dată → BreakEven' : 'TP1 Hit First → BreakEven'}
                            </span>
                          ) : sig.firstHitMilestone === 'SL' ? (
                            <span className="text-rose-300 font-bold flex items-center gap-1 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              {lang === 'ro' ? 'Stop Loss Atins Prima Dată' : 'Stop Loss Hit First'}
                            </span>
                          ) : sig.firstHitMilestone === 'ENTRY' || sig.outcomeStatus === 'RUNNING' ? (
                            <span className="text-cyan-300 font-semibold flex items-center gap-1 bg-cyan-500/15 px-2 py-0.5 rounded border border-cyan-500/30">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" />
                              {lang === 'ro' ? 'Intrare declanșată → În Derulare' : 'Entry Triggered → Running'}
                            </span>
                          ) : sig.outcomeStatus === 'CANCELLED' ? (
                            <div className="flex flex-col gap-0.5 max-w-[220px]">
                              <span className="text-slate-300 font-bold text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/10 inline-block w-max">
                                🚫 {lang === 'ro' ? 'Ordin Anulat / Neactivat' : 'Order Cancelled / Unfilled'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans leading-tight">
                                {getCancellationReason(sig, lang)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">
                              {lang === 'ro' ? 'În Așteptare Nivel Intrare' : 'Awaiting Entry Level'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedSignalForDetails(sig)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-indigo-400/30"
                              title={lang === 'ro' ? 'Vezi Explicația Detaliată' : 'View Trade Rationale'}
                            >
                              <Info className="w-3 h-3 text-cyan-400" />
                              <span>{lang === 'ro' ? 'Explicație' : 'Details'}</span>
                            </button>
                            {onDeleteSignal && (
                              <button
                                onClick={() => onDeleteSignal(sig.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                                title={lang === 'ro' ? 'Șterge din istoric' : 'Delete log'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#060B18]/90 p-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-medium backdrop-blur-md">
          <div className="font-mono">
            {signals.length} {lang === 'ro' ? 'semnale totale înregistrate persistent' : 'total signals logged persistently'}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition shadow-xs cursor-pointer border border-white/10"
          >
            {lang === 'ro' ? 'Închide Vizualizarea' : 'Close View'}
          </button>
        </div>
      </div>

      {/* Signal Details Pop-Up Modal */}
      <SignalDetailsModal
        isOpen={!!selectedSignalForDetails}
        onClose={() => setSelectedSignalForDetails(null)}
        signal={selectedSignalForDetails}
        lang={lang}
      />
    </div>
  );
};
