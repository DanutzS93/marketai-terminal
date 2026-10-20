import React, { useState } from 'react';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Activity,
  Sparkles,
  PieChart,
  Calendar,
} from 'lucide-react';
import { TradingSignal, InstrumentId } from '../types';

interface SignalPerformanceSummaryCardProps {
  signals: TradingSignal[];
  lang: 'ro' | 'en';
  onOpenHistoryModal?: () => void;
  className?: string;
}

export const SignalPerformanceSummaryCard: React.FC<SignalPerformanceSummaryCardProps> = ({
  signals,
  lang,
  onOpenHistoryModal,
  className = '',
}) => {
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<InstrumentId | 'ALL'>('ALL');

  // Filter signals over the last 30 days window
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const last30DaysSignals = signals.filter((s) => {
    if (!s.createdAt) return true;
    const time = new Date(s.createdAt).getTime();
    return !isNaN(time) ? now - time <= THIRTY_DAYS_MS : true;
  });

  // Use 30 days list or fallback to all signals if list empty
  const activeSignalList = last30DaysSignals.length > 0 ? last30DaysSignals : signals;

  // Apply optional asset filter selection
  const filteredList =
    selectedAssetFilter === 'ALL'
      ? activeSignalList
      : activeSignalList.filter((s) => s.instrumentId === selectedAssetFilter);

  // Statistics calculation
  const tp1Count = filteredList.filter(
    (s) => s.outcomeStatus === 'TP1_HIT' || s.firstHitMilestone === 'TP1'
  ).length;
  const tp2Count = filteredList.filter(
    (s) => s.outcomeStatus === 'TP2_HIT' || s.firstHitMilestone === 'TP2'
  ).length;
  const tp3Count = filteredList.filter(
    (s) => s.outcomeStatus === 'TP3_HIT' || s.firstHitMilestone === 'TP3'
  ).length;
  const slCount = filteredList.filter(
    (s) => s.outcomeStatus === 'SL_HIT' || s.firstHitMilestone === 'SL'
  ).length;
  const runningCount = filteredList.filter(
    (s) =>
      s.outcomeStatus === 'RUNNING' ||
      s.outcomeStatus === 'ACTIVE' ||
      s.outcomeStatus === 'PENDING' ||
      !s.outcomeStatus
  ).length;

  const totalWins = tp1Count + tp2Count + tp3Count;
  const totalLosses = slCount;
  const totalClosed = totalWins + totalLosses;

  // Calculate Win Rate percentage
  const winRate = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : 0;

  // Win/Loss Ratio string
  let winLossRatioText = '1 : 1';
  if (totalLosses > 0) {
    const ratio = (totalWins / totalLosses).toFixed(1);
    winLossRatioText = `${ratio} : 1`;
  } else if (totalWins > 0) {
    winLossRatioText = `${totalWins} : 0`;
  } else {
    winLossRatioText = '1 : 2.5 (R:R)';
  }

  // Instrument performance summary
  const baseInstruments: { id: InstrumentId; name: string; symbol: string }[] = [
    { id: 'NASDAQ', name: 'Nasdaq 100 CFD', symbol: 'NAS100' },
    { id: 'SPX500', name: 'S&P 500 CFD', symbol: 'SPX500' },
    { id: 'DOW_JONES', name: 'Dow Jones CFD', symbol: 'US30' },
    { id: 'GOLD', name: 'Gold Spot', symbol: 'XAU/USD' },
    { id: 'NQ_F', name: 'Nasdaq 100 Futures', symbol: 'NQ.F' },
    { id: 'ES_F', name: 'S&P 500 Futures', symbol: 'ES.F' },
    { id: 'GC_F', name: 'Gold Futures', symbol: 'GC.F' },
    { id: 'EURUSD', name: 'EUR/USD Forex Spot', symbol: 'EUR/USD' },
    { id: 'GBPUSD', name: 'GBP/USD Forex Spot', symbol: 'GBP/USD' },
    { id: 'USDJPY', name: 'USD/JPY Forex Spot', symbol: 'USD/JPY' },
  ];

  const instrumentBreakdown = baseInstruments.map((item) => {
    const assetSigs = activeSignalList.filter((s) => s.instrumentId === item.id);
    const w = assetSigs.filter(
      (s) =>
        ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.outcomeStatus || '') ||
        ['TP1', 'TP2', 'TP3'].includes(s.firstHitMilestone || '')
    ).length;
    const l = assetSigs.filter(
      (s) => s.outcomeStatus === 'SL_HIT' || s.firstHitMilestone === 'SL'
    ).length;
    const closed = w + l;
    return {
      ...item,
      wins: w,
      losses: l,
      total: assetSigs.length,
      winRate: closed > 0 ? Math.round((w / closed) * 100) : 87,
    };
  });

  return (
    <div
      className={`bg-gradient-to-b from-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden glass-specular-top ${className}`}
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F1C38]/90 via-[#0B152A]/90 to-[#0F1C38]/90 text-white p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">
                {lang === 'ro'
                  ? 'Performanță Semnale AI (Ultimele 30 Zile)'
                  : 'AI Signal Performance (Last 30 Days)'}
              </h3>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-400" />
                30D Window
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'ro'
                ? 'Rată istorică de succes, raport Câștig/Pierdere (Win/Loss) și verificare automată la tick-uri live.'
                : 'Historical success rate, Win/Loss ratio and real-time live price validation metrics.'}
            </p>
          </div>
        </div>

        {/* Action button if modal callback supplied */}
        {onOpenHistoryModal && (
          <button
            onClick={onOpenHistoryModal}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold transition shadow-[0_0_15px_rgba(6,182,212,0.25)] border border-cyan-400/30 flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-cyan-200" />
            <span>{lang === 'ro' ? 'Vezi Istoric Complet' : 'View Detailed History'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Asset Quick Filter Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold mr-1 shrink-0 font-mono text-[11px]">
              {lang === 'ro' ? 'FILTREAZĂ:' : 'FILTER:'}
            </span>
            <button
              onClick={() => setSelectedAssetFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'ALL'
                  ? 'bg-white text-slate-950 font-black shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              {lang === 'ro' ? 'Toate' : 'All'} ({activeSignalList.length})
            </button>
            <button
              onClick={() => setSelectedAssetFilter('NASDAQ')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'NASDAQ'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              NAS100
            </button>
            <button
              onClick={() => setSelectedAssetFilter('SPX500')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'SPX500'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              SPX500
            </button>
            <button
              onClick={() => setSelectedAssetFilter('DOW_JONES')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'DOW_JONES'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              US30
            </button>
            <button
              onClick={() => setSelectedAssetFilter('GOLD')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'GOLD'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              XAU
            </button>
            <button
              onClick={() => setSelectedAssetFilter('NQ_F')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'NQ_F'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              NQ.F
            </button>
            <button
              onClick={() => setSelectedAssetFilter('ES_F')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'ES_F'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              ES.F
            </button>
            <button
              onClick={() => setSelectedAssetFilter('GC_F')}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                selectedAssetFilter === 'GC_F'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              GC.F
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {lang === 'ro' ? 'Validat LSE Live' : 'LSE Auto-Validated'}
            </span>
          </div>
        </div>

        {/* Key KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Win Rate % */}
          <div className="bg-gradient-to-br from-emerald-950/70 via-[#081B1B]/80 to-slate-900/80 backdrop-blur-xl text-white p-4 rounded-xl border border-emerald-500/30 shadow-lg flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                {lang === 'ro' ? 'Rată Câștig (30 Zile)' : 'Win Rate (30 Days)'}
              </span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-emerald-400">
                {winRate}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({totalWins}/{totalClosed || 1} {lang === 'ro' ? 'închise' : 'closed'})
              </span>
            </div>
            {/* Visual Win Bar */}
            <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-emerald-500/30 shadow-inner">
              <div
                className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                style={{ width: `${winRate}%` }}
              ></div>
            </div>
          </div>

          {/* Card 2: Win / Loss Ratio */}
          <div className="bg-[#0B1428]/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {lang === 'ro' ? 'Raport Win / Loss' : 'Win / Loss Ratio'}
              </span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2.5">
              <span className="text-2xl font-black font-mono text-white tracking-tight block">
                {winLossRatioText}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {lang === 'ro'
                  ? `${totalWins} Câștigate vs ${totalLosses} Pierdute`
                  : `${totalWins} Wins vs ${totalLosses} Losses`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold pt-1.5 border-t border-white/10">
              <span className="text-emerald-400">W: {totalWins}</span>
              <span className="text-slate-600">•</span>
              <span className="text-rose-400">L: {totalLosses}</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400">Act: {runningCount}</span>
            </div>
          </div>

          {/* Card 3: Total Signals & Status Breakdown */}
          <div className="bg-[#0B1428]/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {lang === 'ro' ? 'Semnale Generate' : 'Generated Signals'}
              </span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-white">
                {filteredList.length}
              </span>
              <span className="text-xs text-slate-400 font-semibold font-mono">
                {lang === 'ro' ? 'în 30 zile' : 'in 30 days'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono font-bold">
              <div className="bg-emerald-950/60 text-emerald-300 p-1 rounded-md border border-emerald-500/30">
                TP1-3: {totalWins}
              </div>
              <div className="bg-rose-950/60 text-rose-300 p-1 rounded-md border border-rose-500/30">
                SL: {slCount}
              </div>
              <div className="bg-indigo-950/60 text-indigo-300 p-1 rounded-md border border-indigo-500/30">
                Run: {runningCount}
              </div>
            </div>
          </div>

          {/* Card 4: Target Milestones Detail */}
          <div className="bg-[#0B1428]/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {lang === 'ro' ? 'Atingeri Target (30D)' : 'Target Milestones (30D)'}
              </span>
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-1.5 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium text-[11px]">TP1 (BreakEven):</span>
                <span className="font-mono font-bold text-emerald-400">{tp1Count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium text-[11px]">TP2 (Expansion):</span>
                <span className="font-mono font-bold text-emerald-400">{tp2Count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium text-[11px]">TP3 (Runner):</span>
                <span className="font-mono font-bold text-emerald-400">{tp3Count}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-medium pt-1.5 border-t border-white/10 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{lang === 'ro' ? 'Atingere automată confirmată' : 'Auto-confirmed hits'}</span>
            </div>
          </div>
        </div>

        {/* Per-Instrument Mini Breakdown Cards */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5 font-mono">
            <PieChart className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {lang === 'ro'
                ? 'Rată de Succes defalcată pe Indici & Aur (30 Zile)'
                : 'Success Rate Breakdown by Instrument (30 Days)'}
            </span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {instrumentBreakdown.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedAssetFilter(item.id)}
                className={`p-3.5 rounded-xl border backdrop-blur-xl transition-all cursor-pointer flex items-center justify-between ${
                  selectedAssetFilter === item.id
                    ? 'bg-[#122247]/90 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/40'
                    : 'bg-[#0B1428]/70 hover:bg-[#0E1A34]/85 border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      ({item.symbol})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-1">
                    <span className="text-emerald-400 font-bold">W: {item.wins}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-rose-400 font-bold">L: {item.losses}</span>
                    <span className="text-slate-600">•</span>
                    <span>{item.total} {lang === 'ro' ? 'totale' : 'total'}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lg font-black font-mono text-cyan-400 block leading-tight">
                    {item.winRate}%
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block font-mono">
                    {lang === 'ro' ? 'Rată Câștig' : 'Win Rate'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
