import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Info,
  Award,
  Trash2,
  RotateCcw,
  HardDrive,
  Cloud,
  Trophy,
  History,
  BarChart2,
  Lock,
  AlertOctagon,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { TradingSignal, InstrumentId, TimeFrame, UserProfile, MarketQuote } from '../types';
import { getOutcomeBadgeDetails, getLocalizedSignalText, formatFullDateTime, getCancellationReason, calculateExecutionType, getOrCalculateVolumeProfileLevels, formatSignalPrice, calculateTradePnLMetrics } from '../utils/signalUtils';
import { getMarketScheduleStatus } from '../utils/marketSchedule';
import { SignalHistoryStatsModal } from './SignalHistoryStatsModal';
import { SignalDetailsModal } from './SignalDetailsModal';
import { OrderFlowWidget } from './OrderFlowWidget';
import { TradingViewSignalChartModal } from './TradingViewSignalChartModal';

interface TradingSignalsSectionProps {
  signals: TradingSignal[];
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
  onGenerateSignal: (instrumentId: InstrumentId, timeframe: TimeFrame, strategy: string) => void;
  isGenerating: boolean;
  onOpenCalcModal: () => void;
  lang: 'ro' | 'en';
  onUpdateSignalOutcome?: (signalId: string, outcome: 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT') => void;
  onDeleteSignal?: (signalId: string) => void;
  onCloseTrade?: (signalId: string) => void;
  onDeleteAllSignals?: () => void;
  onResetSignals?: () => void;
  user?: UserProfile | null;
  quotes?: Record<InstrumentId, MarketQuote>;
}

export const TradingSignalsSection: React.FC<TradingSignalsSectionProps> = ({
  signals,
  selectedInstrument,
  onSelectInstrument,
  onGenerateSignal,
  isGenerating,
  onOpenCalcModal,
  lang,
  onUpdateSignalOutcome,
  onDeleteSignal,
  onCloseTrade,
  onDeleteAllSignals,
  onResetSignals,
  user,
  quotes,
}) => {
  const [filterInstrument, setFilterInstrument] = useState<InstrumentId | 'ALL'>('ALL');
  const [filterTimeframe, setFilterTimeframe] = useState<TimeFrame | 'ALL'>('ALL');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>('1h');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('Intraday Trend & Breakout');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedSignalForDetails, setSelectedSignalForDetails] = useState<TradingSignal | null>(null);
  const [selectedSignalForChart, setSelectedSignalForChart] = useState<TradingSignal | null>(null);

  // Close Trade confirmation state
  const [signalToClose, setSignalToClose] = useState<TradingSignal | null>(null);
  const [isClosingTrade, setIsClosingTrade] = useState<boolean>(false);
  const [closeSuccessToast, setCloseSuccessToast] = useState<string | null>(null);

  const handleCloseClick = (sig: TradingSignal) => {
    setSignalToClose(sig);
  };

  const handleConfirmCloseTrade = async () => {
    if (!signalToClose) return;
    setIsClosingTrade(true);
    try {
      if (onCloseTrade) {
        await onCloseTrade(signalToClose.id);
      } else if (onDeleteSignal) {
        onDeleteSignal(signalToClose.id);
      }

      setCloseSuccessToast(
        lang === 'ro'
          ? `Poziția pentru ${signalToClose.symbol} a fost închisă! Comanda a fost transmisă către MT5 și NinjaTrader.`
          : `Position for ${signalToClose.symbol} closed! Order sent to MT5 and NinjaTrader.`
      );
      setTimeout(() => setCloseSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error closing trade:', err);
    } finally {
      setIsClosingTrade(false);
      setSignalToClose(null);
    }
  };

  const marketSchedule = getMarketScheduleStatus();

  const filteredSignals = signals.filter((s) => {
    if (filterInstrument !== 'ALL' && s.instrumentId !== filterInstrument) return false;
    if (filterTimeframe !== 'ALL' && s.timeframe !== filterTimeframe) return false;
    return true;
  });

  const featuredSignal = filteredSignals[0] || signals[0];

  // Calculate statistics across all stored signals
  const tp1Count = signals.filter((s) => s.outcomeStatus === 'TP1_HIT').length;
  const tp2Count = signals.filter((s) => s.outcomeStatus === 'TP2_HIT').length;
  const tp3Count = signals.filter((s) => s.outcomeStatus === 'TP3_HIT').length;
  const slCount = signals.filter((s) => s.outcomeStatus === 'SL_HIT').length;
  const runningCount = signals.filter((s) => s.outcomeStatus === 'RUNNING').length;
  const pendingCount = signals.filter((s) => !s.outcomeStatus || s.outcomeStatus === 'PENDING' || s.outcomeStatus === 'ACTIVE').length;
  
  const totalClosed = tp1Count + tp2Count + tp3Count + slCount;
  const totalWins = tp1Count + tp2Count + tp3Count;
  const winRatePercent = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : 0;

  const getSignalBadgeStyle = (type: string) => {
    switch (type) {
      case 'STRONG_BUY':
        return 'bg-emerald-600 text-white font-bold shadow-xs';
      case 'BUY':
        return 'bg-emerald-500 text-white font-bold shadow-xs';
      case 'SELL':
        return 'bg-rose-500 text-white font-bold shadow-xs';
      case 'STRONG_SELL':
        return 'bg-rose-600 text-white font-bold shadow-xs';
      default:
        return 'bg-amber-500 text-white font-bold shadow-xs';
    }
  };

  const getExecutionBadgeStyle = (execType?: string) => {
    if (!execType) return 'bg-slate-700 text-white border-slate-800 font-bold';
    const upper = execType.toUpperCase();
    if (upper.includes('MARKET') || upper === 'MARKET EXECUTION') {
      return 'bg-amber-600 text-white border-amber-700 font-extrabold shadow-xs';
    }
    if (upper.includes('BUY LIMIT')) {
      return 'bg-sky-600 text-white border-sky-700 font-extrabold shadow-xs';
    }
    if (upper.includes('SELL LIMIT')) {
      return 'bg-purple-600 text-white border-purple-700 font-extrabold shadow-xs';
    }
    if (upper.includes('BUY STOP')) {
      return 'bg-indigo-600 text-white border-indigo-700 font-extrabold shadow-xs';
    }
    if (upper.includes('SELL STOP')) {
      return 'bg-rose-600 text-white border-rose-700 font-extrabold shadow-xs';
    }
    return 'bg-slate-700 text-white border-slate-800 font-bold shadow-xs';
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 mb-8 w-full overflow-hidden text-slate-100 relative">
      {/* Specular top reflection line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {/* Weekend Market Closed Alert Banner */}
      {marketSchedule.isClosed && (
        <div className="mb-4 liquid-amber border border-amber-500/40 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2 font-mono">
                <span>{lang === 'ro' ? 'Piața este Închisă pentru Weekend' : 'Market Closed for Weekend'}</span>
                <span className="text-[10px] font-bold uppercase bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                  {marketSchedule.userTimezoneShort}
                </span>
              </div>
              <p className="text-[11px] text-amber-300 font-medium mt-0.5">
                {lang === 'ro'
                  ? `Generarea de semnale live este oprită în weekend. Se va relua Luni de la ora 01:00 (Ora locală: ${marketSchedule.nextOpenTimeStrRo}).`
                  : `Live signal generation paused over the weekend. Resumes Monday at 01:00 AM (Your local time: ${marketSchedule.nextOpenTimeStrEn}).`}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg shadow-md border border-amber-400/40">
            {lang === 'ro' ? 'Tranzacționare închisă' : 'Trading Paused'}
          </span>
        </div>
      )}

      {/* Title & Generator Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-white/10">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="p-2 rounded-xl liquid-indigo text-indigo-300 border border-indigo-400/40 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <Sparkles className="w-5 h-5 text-indigo-300" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight font-sans">
              {lang === 'ro' ? 'Live Trading Signals Desk' : 'Live Trading Signals Desk'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold liquid-emerald text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {filteredSignals.length} {lang === 'ro' ? 'Semnale Găsite' : 'Signals Found'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold liquid-indigo text-indigo-200 border border-indigo-400/40 flex items-center gap-1 shadow-sm font-mono">
              <Cloud className="w-3.5 h-3.5 text-indigo-300" />
              <span>{lang === 'ro' ? 'Sincronizat în Cloud (30 Zile)' : 'Cloud Synced (30 Days)'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            {lang === 'ro'
              ? 'Semnalele generate de contul tău sunt stocate securizat în cloud timp de 30 de zile și sincronizate instant pe orice dispozitiv.'
              : 'Signals generated by your account are securely stored in the cloud for 30 days and synchronized across all your devices.'}
          </p>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Generate AI Signal Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/70 p-2 rounded-xl border border-white/10 w-full sm:w-auto backdrop-blur-xl shadow-inner">
            <select
              value={selectedInstrument}
              onChange={(e) => onSelectInstrument(e.target.value as InstrumentId)}
              className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-white/15 focus:outline-none focus:border-indigo-400 font-semibold cursor-pointer"
            >
              <optgroup label="--- INDICI & SPOT CFD ---" className="bg-slate-900 text-slate-300">
                <option value="NASDAQ">NASDAQ CFD (NAS100)</option>
                <option value="SPX500">S&P 500 CFD (SPX500)</option>
                <option value="DOW_JONES">Dow Jones CFD (US30)</option>
                <option value="GOLD">Gold Spot (XAU/USD)</option>
              </optgroup>
              <optgroup label="--- CONTRACTE FUTURES ---" className="bg-slate-900 text-slate-300">
                <option value="NQ_F">Nasdaq 100 Futures (NQ.F)</option>
                <option value="ES_F">S&P 500 Futures (ES.F)</option>
                <option value="GC_F">Gold Futures (GC.F)</option>
              </optgroup>
              <optgroup label="--- FOREX SPOT (FX) ---" className="bg-slate-900 text-slate-300">
                <option value="EURUSD">EUR/USD (Euro / US Dollar)</option>
                <option value="GBPUSD">GBP/USD (British Pound)</option>
                <option value="USDJPY">USD/JPY (US Dollar / Yen)</option>
              </optgroup>
            </select>

            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as TimeFrame)}
              className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-white/15 focus:outline-none focus:border-indigo-400 font-semibold cursor-pointer font-mono"
            >
              <option value="5m">TF 5m (Scalp Rapid ATR)</option>
              <option value="15m">TF 15m (Scalp Standard)</option>
              <option value="1h">TF 1h (Intraday)</option>
              <option value="4h">TF 4h (Swing)</option>
              <option value="1D">TF 1D (Macro)</option>
            </select>

            <button
              onClick={() => onGenerateSignal(selectedInstrument, selectedTimeframe, selectedStrategy)}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs shadow-[0_0_20px_rgba(99,102,241,0.4)] transition disabled:opacity-50 cursor-pointer border border-indigo-400/40"
            >
              <Zap className={`w-4 h-4 ${isGenerating ? 'animate-bounce text-amber-300' : 'text-amber-300'}`} />
              <span>
                {isGenerating
                  ? (lang === 'ro' ? 'Se calculează...' : 'Analyzing Market...')
                  : (lang === 'ro' ? 'Generează Semnal AI' : 'Generate AI Signal')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* STATS PERFORMANCE DASHBOARD */}
      <div className="my-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-mono">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>{lang === 'ro' ? 'Statistici & Performanță Semnale (Ultimele 30 Zile)' : '30-Day Signal Statistics & Performance'}</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-medium font-mono">
            {signals.length} {lang === 'ro' ? 'semnale salvate în cloud' : 'cloud signals stored'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Win Rate */}
          <div className="liquid-indigo p-3.5 rounded-xl border border-indigo-500/40 shadow-lg flex flex-col justify-between backdrop-blur-md">
            <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider block font-mono">
              {lang === 'ro' ? 'Rată de Câștig' : 'Win Rate'}
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-black font-mono text-emerald-300">{winRatePercent}%</span>
              <span className="text-[10px] text-slate-400 font-mono">({totalWins}/{totalClosed || 1})</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ width: `${winRatePercent}%` }}></div>
            </div>
          </div>

          {/* TP1 Count */}
          <div className="liquid-emerald p-3.5 rounded-xl border border-emerald-500/40 shadow-md backdrop-blur-md">
            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider block font-mono">
              Take Profit 1 (TP1)
            </span>
            <span className="text-2xl font-black font-mono text-white block my-1">{tp1Count}</span>
            <span className="text-[11px] text-emerald-300 font-medium font-mono block">
              {signals.length > 0 ? ((tp1Count / signals.length) * 100).toFixed(0) : 0}% {lang === 'ro' ? 'din total' : 'of total'}
            </span>
          </div>

          {/* TP2 Count */}
          <div className="liquid-emerald p-3.5 rounded-xl border border-emerald-500/40 shadow-md backdrop-blur-md">
            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider block font-mono">
              Take Profit 2 (TP2)
            </span>
            <span className="text-2xl font-black font-mono text-white block my-1">{tp2Count}</span>
            <span className="text-[11px] text-emerald-300 font-medium font-mono block">
              {signals.length > 0 ? ((tp2Count / signals.length) * 100).toFixed(0) : 0}% {lang === 'ro' ? 'din total' : 'of total'}
            </span>
          </div>

          {/* TP3 Count */}
          <div className="liquid-indigo p-3.5 rounded-xl border border-indigo-500/40 shadow-md backdrop-blur-md">
            <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider block font-mono">
              Take Profit 3 (TP3 Max)
            </span>
            <span className="text-2xl font-black font-mono text-white block my-1">{tp3Count}</span>
            <span className="text-[11px] text-indigo-300 font-medium font-mono block">
              {signals.length > 0 ? ((tp3Count / signals.length) * 100).toFixed(0) : 0}% {lang === 'ro' ? 'din total' : 'of total'}
            </span>
          </div>

          {/* SL Count */}
          <div className="liquid-rose p-3.5 rounded-xl border border-rose-500/40 shadow-md backdrop-blur-md">
            <span className="text-[10px] text-rose-300 uppercase font-bold tracking-wider block font-mono">
              Stop Loss (SL Hit)
            </span>
            <span className="text-2xl font-black font-mono text-white block my-1">{slCount}</span>
            <span className="text-[11px] text-rose-300 font-medium font-mono block">
              {signals.length > 0 ? ((slCount / signals.length) * 100).toFixed(0) : 0}% {lang === 'ro' ? 'din total' : 'of total'}
            </span>
          </div>

          {/* Active / Running Count */}
          <div className="liquid-cyan p-3.5 rounded-xl border border-cyan-500/40 shadow-md backdrop-blur-md">
            <span className="text-[10px] text-cyan-300 uppercase font-bold tracking-wider block font-mono">
              {lang === 'ro' ? 'În Derulare' : 'Running Signals'}
            </span>
            <span className="text-2xl font-black font-mono text-white block my-1">{runningCount}</span>
            <span className="text-[11px] text-cyan-300 font-medium font-mono block">
              {signals.length > 0 ? ((runningCount / signals.length) * 100).toFixed(0) : 0}% {lang === 'ro' ? 'în derulare' : 'running'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 my-5 bg-slate-950/70 p-2.5 rounded-xl border border-white/10 text-xs backdrop-blur-md shadow-inner">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1 font-mono">{lang === 'ro' ? 'PERECHE:' : 'PAIR:'}</span>
          {(['ALL', 'NASDAQ', 'SPX500', 'DOW_JONES', 'GOLD', 'NQ_F', 'ES_F', 'GC_F', 'EURUSD', 'GBPUSD', 'USDJPY'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setFilterInstrument(id)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                filterInstrument === id
                  ? 'liquid-indigo text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.35)] border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {id === 'ALL'
                ? (lang === 'ro' ? 'Toate' : 'All')
                : id === 'NQ_F'
                ? 'NQ.F Fut'
                : id === 'ES_F'
                ? 'ES.F Fut'
                : id === 'GC_F'
                ? 'GC.F Fut'
                : id === 'GOLD'
                ? 'XAU Spot'
                : id === 'EURUSD'
                ? 'EUR/USD'
                : id === 'GBPUSD'
                ? 'GBP/USD'
                : id === 'USDJPY'
                ? 'USD/JPY'
                : id}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider font-mono">TIMEFRAME:</span>
          {(['ALL', '5m', '15m', '1h', '4h', '1D'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setFilterTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-xs ${
                filterTimeframe === tf
                  ? 'bg-white text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Main Signal Card */}
      {featuredSignal ? (
        <div className="bg-gradient-to-b from-[#0C152B]/90 via-[#091022]/85 to-[#070D1C]/90 backdrop-blur-2xl rounded-2xl border border-white/15 p-5 sm:p-6 mb-8 shadow-2xl relative overflow-hidden glass-specular-top">
          {/* Subtle Ambient Glow inside card */}
          <div className="absolute top-0 right-1/4 w-96 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-xs px-3 py-1.5 rounded-lg uppercase tracking-wider font-bold shadow-sm ${getSignalBadgeStyle(
                    featuredSignal.type
                  )}`}
                >
                  {featuredSignal.type.replace('_', ' ')}
                </span>
                {featuredSignal.executionType && (
                  <span
                    className={`text-xs px-2.5 py-1.5 rounded-lg border tracking-wide uppercase font-mono font-bold ${getExecutionBadgeStyle(
                      featuredSignal.executionType
                    )}`}
                  >
                    ⚡ {featuredSignal.executionType}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{featuredSignal.instrumentName}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/15">
                    {featuredSignal.symbol}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                    {featuredSignal.timeframe}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{getLocalizedSignalText(featuredSignal, 'title', lang)}</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300 bg-white/5 px-2.5 py-0.5 rounded-md border border-white/10">
                    <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                    {lang === 'ro' ? 'Generat la:' : 'Generated At:'} <strong className="text-slate-200">{formatFullDateTime(featuredSignal.createdAt, lang)}</strong>
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Outcome Badge */}
              <div className="flex items-center gap-2 bg-[#0B1428]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">{lang === 'ro' ? 'Stare:' : 'Status:'}</span>
                <span className={`px-2.5 py-0.5 rounded-md text-xs border font-mono font-bold ${getOutcomeBadgeDetails(featuredSignal.outcomeStatus, lang, featuredSignal.isBeHitAfterTp1).badgeClass}`}>
                  {getOutcomeBadgeDetails(featuredSignal.outcomeStatus, lang, featuredSignal.isBeHitAfterTp1).label}
                </span>
              </div>

              {/* Confidence Score */}
              <div className="bg-[#0B1428]/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-right shadow-sm">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">{lang === 'ro' ? 'Încredere AI' : 'AI Confidence'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold font-mono text-indigo-400">
                    {featuredSignal.confidencePercent}%
                  </span>
                  <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                      style={{ width: `${featuredSignal.confidencePercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Rubrică PNL Curent sincronizat din MT5 / NinjaTrader */}
              {(() => {
                const featPnl = calculateTradePnLMetrics(featuredSignal, user, quotes);
                const isPos = featPnl.pnl > 0;
                const isNeg = featPnl.pnl < 0;
                return (
                  <div className="bg-[#0B1428]/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-right shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">
                        {lang === 'ro' ? 'PNL Curent' : 'Live P&L'}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-tight ${featPnl.accountBadgeStyle}`}>
                        {featPnl.accountBadge}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={`text-base font-black font-mono tracking-tight ${
                        featPnl.hasPrice === false
                          ? 'text-slate-400'
                          : isPos
                          ? 'text-emerald-400'
                          : isNeg
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}>
                        {featPnl.hasPrice === false
                          ? '-'
                          : isPos
                          ? `+$${featPnl.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : isNeg
                          ? `-$${Math.abs(featPnl.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '$0.00'}
                      </span>
                      {featPnl.hasPrice !== false && featPnl.rr !== 0 && (
                        <span className={`text-[10px] font-mono font-bold ${isPos ? 'text-emerald-300' : 'text-rose-300'}`}>
                          ({isPos ? '+' : ''}{featPnl.rr}R)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* R:R Ratio */}
              <div className="bg-[#0B1428]/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-right shadow-sm">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">{lang === 'ro' ? 'Raport R:R' : 'R:R Ratio'}</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {featuredSignal.riskRewardRatio}
                </span>
              </div>

              {/* Emergency Close Button for Featured Signal */}
              {featuredSignal.outcomeStatus !== 'CANCELLED' && (
                <button
                  onClick={() => handleCloseClick(featuredSignal)}
                  className="px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)] transition cursor-pointer hover:border-rose-400 group"
                  title={lang === 'ro' ? 'Închide Trade-ul (Închidere Poziție în MT5 & NinjaTrader)' : 'Close Trade (Close Position in MT5 & NinjaTrader)'}
                >
                  <X className="w-4 h-4 text-rose-400 group-hover:scale-125 transition-transform" />
                  <div className="text-left">
                    <div className="text-[9px] text-rose-400/80 uppercase leading-none font-semibold font-mono">MT5 / Ninja</div>
                    <div className="font-bold text-rose-300 leading-tight text-xs">
                      {lang === 'ro' ? 'Închide Trade' : 'Close Trade'}
                    </div>
                  </div>
                </button>
              )}

              {/* TradingView Technical Chart Button */}
              <button
                onClick={() => setSelectedSignalForChart(featuredSignal)}
                className="px-3.5 py-2 rounded-xl bg-[#0F1D38]/90 hover:bg-[#16274B] text-white font-bold text-xs flex items-center gap-2 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition cursor-pointer hover:border-emerald-400 group"
                title={lang === 'ro' ? 'Deschide Grafic Tehnic TradingView cu Niveluri și Indicatori' : 'Open TradingView Technical Chart'}
              >
                <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="text-[9px] text-slate-400 uppercase leading-none font-semibold font-mono">TradingView</div>
                  <div className="font-bold text-emerald-400 leading-tight text-xs flex items-center gap-1">
                    <span>{lang === 'ro' ? 'Grafic Tehnic' : 'Live Chart'}</span>
                    <span>📈</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Order Execution & Live Price Status Banner */}
          <div className="my-4 p-3.5 bg-[#081020]/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-black/60 text-amber-300 border border-amber-500/30 font-mono font-bold tracking-tight shadow-sm">
                {lang === 'ro' ? 'Preț Curent Piață:' : 'Live Market Price:'} ${formatSignalPrice(featuredSignal.currentMarketPrice || featuredSignal.entryPrice, featuredSignal.instrumentId, featuredSignal.symbol)}
              </span>
              {(() => {
                const effectiveExecType = featuredSignal.executionType || calculateExecutionType(
                  featuredSignal.type,
                  featuredSignal.entryPrice,
                  featuredSignal.currentMarketPrice || featuredSignal.entryPrice
                );
                return (
                  <>
                    <span className={`px-2.5 py-1 rounded-lg border text-[11px] uppercase font-mono font-bold ${getExecutionBadgeStyle(effectiveExecType)}`}>
                      ⚡ {effectiveExecType}
                    </span>
                    {(() => {
                      const featPnl = calculateTradePnLMetrics(featuredSignal, user, quotes);
                      const isPos = featPnl.pnl > 0;
                      const isNeg = featPnl.pnl < 0;
                      return (
                        <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm ${
                          isPos
                            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                            : isNeg
                            ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                            : 'bg-black/60 border-white/10 text-slate-300'
                        }`}>
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-semibold">
                            {lang === 'ro' ? 'PNL Curent:' : 'Live P&L:'}
                          </span>
                          <span className="font-black text-xs">
                            {isPos
                              ? `+$${featPnl.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : isNeg
                              ? `-$${Math.abs(featPnl.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '$0.00'}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${featPnl.accountBadgeStyle}`}>
                            {featPnl.accountBadge}
                          </span>
                          {featPnl.rr !== 0 && (
                            <span className={`text-[9px] font-semibold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ({isPos ? '+' : ''}{featPnl.rr}R)
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
            <div className="text-slate-300 font-sans text-xs flex items-center gap-1.5 flex-wrap">
              {(() => {
                const liveCurPrice = featuredSignal.currentMarketPrice || featuredSignal.entryPrice;
                const effectiveExecType = featuredSignal.executionType || calculateExecutionType(
                  featuredSignal.type,
                  featuredSignal.entryPrice,
                  featuredSignal.currentMarketPrice || featuredSignal.entryPrice
                );
                const liveCurStr = formatSignalPrice(liveCurPrice, featuredSignal.instrumentId, featuredSignal.symbol);
                const entryStr = formatSignalPrice(featuredSignal.entryPrice, featuredSignal.instrumentId, featuredSignal.symbol);

                const status = featuredSignal.outcomeStatus || 'PENDING';

                if (status === 'RUNNING') {
                  return (
                    <span className="text-cyan-300 bg-cyan-950/50 px-3 py-1 rounded-lg border border-cyan-500/40 font-medium flex items-center gap-1.5">
                      ⚡ <b>{lang === 'ro' ? 'Trade Activ (În Desfășurare)' : 'Trade In Progress'}</b>: {lang === 'ro' ? `Ordinul ${effectiveExecType} a fost activat la $${entryStr}. Cotație curentă: $${liveCurStr}.` : `${effectiveExecType} order triggered at $${entryStr}. Current price: $${liveCurStr}.`}
                    </span>
                  );
                } else if (status === 'TP1_HIT') {
                  if (featuredSignal.isBeHitAfterTp1) {
                    return (
                      <span className="text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-500/40 font-medium flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                        🎯 <b>{lang === 'ro' ? 'TP1 Atins, BE Atins (Trade Închis)' : 'TP1 Hit, BE Hit (Trade Closed)'}</b>: {lang === 'ro' ? `Profit securizat la TP1 ($${featuredSignal.targetPrice1}), restul poziției închisă la Break-Even ($${entryStr}).` : `Profit locked at TP1 ($${featuredSignal.targetPrice1}), remaining closed at Break-Even ($${entryStr}).`}
                      </span>
                    );
                  }
                  return (
                    <span className="text-emerald-300 bg-emerald-950/50 px-3 py-1 rounded-lg border border-emerald-500/40 font-medium flex items-center gap-1.5">
                      🎯 <b>{lang === 'ro' ? 'WIN TP1 Atins (SL la Break-Even)' : 'WIN TP1 Hit (SL at Break-Even)'}</b>: {lang === 'ro' ? `Tranzacție câștigătoare la TP1 ($${featuredSignal.targetPrice1}). Protejată la Break-Even.` : `Winning trade at TP1 ($${featuredSignal.targetPrice1}). Protected at BreakEven.`}
                    </span>
                  );
                } else if (status === 'TP2_HIT') {
                  if (featuredSignal.isBeHitAfterTp2) {
                    return (
                      <span className="text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-400 font-medium flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                        🚀 <b>{lang === 'ro' ? 'TP1 & TP2 Atins, BE Atins (Trade Închis)' : 'TP1 & TP2 Hit, BE Hit (Trade Closed)'}</b>: {lang === 'ro' ? `Câștiguri securizate la TP1 & TP2 ($${featuredSignal.targetPrice2}), restul poziției închisă la BE ($${entryStr}).` : `Profits locked at TP1 & TP2 ($${featuredSignal.targetPrice2}), remainder closed at BE ($${entryStr}).`}
                      </span>
                    );
                  }
                  return (
                    <span className="text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-400 font-medium flex items-center gap-1.5">
                      🚀 <b>{lang === 'ro' ? 'WIN TP2 Atins (Țintă TP3)' : 'WIN TP2 Hit (Target TP3)'}</b>: {lang === 'ro' ? `Tranzacție câștigătoare la TP2 ($${featuredSignal.targetPrice2}). Țintă deschisă spre TP3.` : `Winning trade at TP2 ($${featuredSignal.targetPrice2}). Target open to TP3.`}
                    </span>
                  );
                } else if (status === 'TP3_HIT') {
                  return (
                    <span className="text-indigo-300 bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-400 font-medium flex items-center gap-1.5 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                      💎 <b>{lang === 'ro' ? 'TP3 MAX Atins (Trade Închis)' : 'TP3 MAX Hit (Trade Closed)'}</b>: {lang === 'ro' ? `Target maxim atins la $${featuredSignal.targetPrice3}. Tranzacție finalizată cu profit maxim.` : `Max target reached at $${featuredSignal.targetPrice3}. Full profit secured.`}
                    </span>
                  );
                } else if (status === 'CANCELLED') {
                  return (
                    <span className="text-rose-300 bg-rose-950/50 px-3 py-1 rounded-lg border border-rose-500/40 font-medium flex items-center gap-1.5">
                      🚫 <b>{lang === 'ro' ? 'Ordin Anulat / Setup Invalidat' : 'Order Cancelled / Setup Invalidated'}</b>: {getCancellationReason(featuredSignal, lang)}
                    </span>
                  );
                } else if (status === 'SL_HIT') {
                  return (
                    <span className="text-rose-300 bg-rose-950/50 px-3 py-1 rounded-lg border border-rose-500/40 font-medium flex items-center gap-1.5">
                      🔴 <b>{lang === 'ro' ? 'SL Atins (Trade Închis)' : 'SL Hit (Trade Closed)'}</b>: {lang === 'ro' ? `Nivelul Stop Loss ($${featuredSignal.stopLoss}) a fost atins de prețul pieței ($${liveCurStr}).` : `Stop Loss level ($${featuredSignal.stopLoss}) was hit by market price ($${liveCurStr}).`}
                    </span>
                  );
                }

                const execUpper = (effectiveExecType || '').toUpperCase();

                if (execUpper.includes('MARKET') || execUpper === 'MARKET EXECUTION') {
                  return (
                    <span className="text-amber-300 bg-amber-950/50 px-3 py-1 rounded-lg border border-amber-500/30 font-medium">
                      ⚡ {lang === 'ro' ? 'Prețul propus este la nivelul pieței (Market Execution)' : 'Proposed entry is at current market level (Market Execution)'}
                    </span>
                  );
                } else if (execUpper.includes('BUY LIMIT')) {
                  return (
                    <span className="text-sky-300 bg-sky-950/50 px-3 py-1 rounded-lg border border-sky-500/30 font-medium">
                      ⏳ <b>Buy Limit</b>: {lang === 'ro' ? `Prețul curent (${liveCurStr}) este peste intrarea propusă (${entryStr}). Ordin în așteptare la pullback (retragere pe suport).` : `Current price (${liveCurStr}) is above proposed entry (${entryStr}). Pending pullback order.`}
                    </span>
                  );
                } else if (execUpper.includes('BUY STOP')) {
                  return (
                    <span className="text-indigo-300 bg-indigo-950/50 px-3 py-1 rounded-lg border border-indigo-500/30 font-medium">
                      🚀 <b>Buy Stop</b>: {lang === 'ro' ? `Prețul curent (${liveCurStr}) este sub intrarea propusă (${entryStr}). Ordin în așteptare la străpungere (Breakout).` : `Current price (${liveCurStr}) is below proposed entry (${entryStr}). Pending breakout order.`}
                    </span>
                  );
                } else if (execUpper.includes('SELL LIMIT')) {
                  return (
                    <span className="text-purple-300 bg-purple-950/50 px-3 py-1 rounded-lg border border-purple-500/30 font-medium">
                      ⏳ <b>Sell Limit</b>: {lang === 'ro' ? `Prețul curent (${liveCurStr}) este sub intrarea propusă (${entryStr}). Ordin în așteptare la retragere (bounce pe rezistență).` : `Current price (${liveCurStr}) is below proposed entry (${entryStr}). Pending order on bounce.`}
                    </span>
                  );
                } else if (execUpper.includes('SELL STOP')) {
                  return (
                    <span className="text-rose-300 bg-rose-950/50 px-3 py-1 rounded-lg border border-rose-500/30 font-medium">
                      📉 <b>Sell Stop</b>: {lang === 'ro' ? `Prețul curent (${liveCurStr}) este peste intrarea propusă (${entryStr}). Ordin în așteptare la străpungere în jos (Breakdown).` : `Current price (${liveCurStr}) is above proposed entry (${entryStr}). Pending breakdown order.`}
                    </span>
                  );
                } else {
                  return (
                    <span className="text-slate-300 bg-white/5 px-3 py-1 rounded-lg border border-white/10 font-medium">
                      ⏳ <b>{effectiveExecType}</b>: {lang === 'ro' ? `Ordin în așteptare la $${entryStr}. Cotație curentă: $${liveCurStr}.` : `Pending order at $${entryStr}. Current price: $${liveCurStr}.`}
                    </span>
                  );
                }
              })()}
            </div>
          </div>

          {/* Cancellation Reason Alert if Cancelled */}
          {featuredSignal.outcomeStatus === 'CANCELLED' && (
            <div className="my-3 p-3.5 bg-rose-950/60 border border-rose-500/80 text-white rounded-xl shadow-lg flex items-start gap-3 backdrop-blur-md">
              <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block font-mono">
                  {lang === 'ro' ? 'Motiv Anulare Tradepoint / Ordin Neactivat:' : 'Cancellation Reason (Unfilled / Invalidation):'}
                </span>
                <p className="text-xs text-slate-200 font-medium mt-0.5">
                  {getCancellationReason(featuredSignal, lang)}
                </p>
              </div>
            </div>
          )}

          {/* Target Levels Grid - Translucent Frosted Glass Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-5 relative z-10">
            {/* Entry Price Zone */}
            <div className="bg-[#0E1A36]/80 backdrop-blur-xl p-3.5 sm:p-4 rounded-xl border border-indigo-500/30 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              <span className="text-[10px] text-indigo-400 uppercase font-bold block mb-1 tracking-wider font-mono">
                {lang === 'ro' ? 'Zona Intrare (Entry)' : 'Entry Zone'}
              </span>
              <span className="text-lg sm:text-xl font-mono font-bold text-white block">
                ${formatSignalPrice(featuredSignal.entryPrice, featuredSignal.instrumentId, featuredSignal.symbol)}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block mt-0.5 font-medium">
                ${featuredSignal.entryRangeMin} - ${featuredSignal.entryRangeMax}
              </span>
            </div>

            {/* Stop Loss */}
            <div className={`p-3.5 sm:p-4 rounded-xl border shadow-lg backdrop-blur-xl relative overflow-hidden ${
              featuredSignal.outcomeStatus === 'SL_HIT' 
                ? 'bg-[#250C1B]/90 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                : 'bg-[#1C0E1F]/70 border-rose-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-rose-400 uppercase font-bold block tracking-wider font-mono">
                  Stop Loss (SL)
                </span>
                {featuredSignal.outcomeStatus === 'SL_HIT' && (
                  <span className="text-[10px] bg-rose-500 text-white font-mono font-bold px-1.5 py-0.5 rounded">ATINS</span>
                )}
              </div>
              <span className="text-lg sm:text-xl font-mono font-bold text-rose-400 block">
                ${formatSignalPrice(featuredSignal.stopLoss, featuredSignal.instrumentId, featuredSignal.symbol)}
              </span>
              <span className="text-[11px] text-rose-300/80 font-mono block mt-0.5 font-medium">
                -
                {Math.abs(
                  ((featuredSignal.entryPrice - featuredSignal.stopLoss) / featuredSignal.entryPrice) * 100
                ).toFixed(2)}
                %
              </span>
            </div>

            {/* Target 1 */}
            <div className={`p-3.5 sm:p-4 rounded-xl border shadow-lg backdrop-blur-xl relative overflow-hidden ${
              ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(featuredSignal.outcomeStatus || '') 
                ? 'bg-[#09221C]/90 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.25)]' 
                : 'bg-[#0A1A1E]/70 border-emerald-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block tracking-wider font-mono">
                  Take Profit 1 (TP1)
                </span>
                {['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(featuredSignal.outcomeStatus || '') && (
                  <span className="text-[10px] bg-emerald-500 text-slate-950 font-mono font-bold px-1.5 py-0.5 rounded">ATINS</span>
                )}
              </div>
              <span className="text-lg sm:text-xl font-mono font-bold text-emerald-400 block">
                ${formatSignalPrice(featuredSignal.targetPrice1, featuredSignal.instrumentId, featuredSignal.symbol)}
              </span>
              <span className="text-[11px] text-emerald-300/80 font-mono block mt-0.5 font-medium">
                +
                {Math.abs(
                  ((featuredSignal.targetPrice1 - featuredSignal.entryPrice) / featuredSignal.entryPrice) * 100
                ).toFixed(2)}
                %
              </span>
            </div>

            {/* Target 2 */}
            <div className={`p-3.5 sm:p-4 rounded-xl border shadow-lg backdrop-blur-xl relative overflow-hidden ${
              ['TP2_HIT', 'TP3_HIT'].includes(featuredSignal.outcomeStatus || '') 
                ? 'bg-[#0B2A22]/90 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                : 'bg-[#081F1E]/70 border-emerald-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block tracking-wider font-mono">
                  Take Profit 2 (TP2)
                </span>
                {['TP2_HIT', 'TP3_HIT'].includes(featuredSignal.outcomeStatus || '') && (
                  <span className="text-[10px] bg-emerald-400 text-slate-950 font-mono font-bold px-1.5 py-0.5 rounded">ATINS</span>
                )}
              </div>
              <span className="text-lg sm:text-xl font-mono font-bold text-emerald-400 block">
                ${formatSignalPrice(featuredSignal.targetPrice2, featuredSignal.instrumentId, featuredSignal.symbol)}
              </span>
              <span className="text-[11px] text-emerald-300/80 font-mono block mt-0.5 font-medium">
                +
                {Math.abs(
                  ((featuredSignal.targetPrice2 - featuredSignal.entryPrice) / featuredSignal.entryPrice) * 100
                ).toFixed(2)}
                %
              </span>
            </div>

            {/* Target 3 */}
            <div className={`p-3.5 sm:p-4 rounded-xl border shadow-lg backdrop-blur-xl relative overflow-hidden ${
              featuredSignal.outcomeStatus === 'TP3_HIT' 
                ? 'bg-[#151D48]/90 border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.35)]' 
                : 'bg-[#0E1632]/70 border-indigo-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-indigo-400 uppercase font-bold block tracking-wider font-mono">
                  Take Profit 3 (TP3)
                </span>
                {featuredSignal.outcomeStatus === 'TP3_HIT' && (
                  <span className="text-[10px] bg-indigo-500 text-white font-mono font-bold px-1.5 py-0.5 rounded">MAX ATINS</span>
                )}
              </div>
              <span className="text-lg sm:text-xl font-mono font-bold text-indigo-300 block">
                ${formatSignalPrice(featuredSignal.targetPrice3, featuredSignal.instrumentId, featuredSignal.symbol)}
              </span>
              <span className="text-[11px] text-indigo-300/80 font-mono block mt-0.5 font-medium">
                +
                {Math.abs(
                  ((featuredSignal.targetPrice3 - featuredSignal.entryPrice) / featuredSignal.entryPrice) * 100
                ).toFixed(2)}
                %
              </span>
            </div>
          </div>

          {/* TP1 & Break-Even Recommendation Banner */}
          {featuredSignal.isBeHitAfterTp1 ? (
            <div className="p-3.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl flex items-center gap-3 text-xs text-emerald-200 font-medium shadow-lg backdrop-blur-md relative z-10">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="font-bold block text-emerald-300">
                  {lang === 'ro' ? '🎯 TP1 Atins & Break-Even (BE) Atins – Trade Închis' : '🎯 TP1 Hit & Break-Even (BE) Hit – Trade Closed'}
                </strong>
                <span>
                  {lang === 'ro'
                    ? `S-a securizat profitul pe 70% din poziție la TP1. Restul de 30% s-a închis pe Break-Even ($${featuredSignal.entryPrice}). Tranzacție finalizată.`
                    : `Profit secured on 70% of position at TP1. Remaining 30% closed at Break-Even ($${featuredSignal.entryPrice}). Trade completed.`}
                </span>
              </div>
            </div>
          ) : ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(featuredSignal.outcomeStatus || '') ? (
            <div className="p-3.5 bg-amber-950/60 border border-amber-500/40 rounded-xl flex items-center gap-3 text-xs text-amber-200 font-medium shadow-lg backdrop-blur-md relative z-10">
              <Zap className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <strong className="font-bold block text-amber-300">
                  {lang === 'ro' ? '🎯 Recomandare Management Risc (TP1 Atins)' : '🎯 Risk Management Recommendation (TP1 Hit)'}
                </strong>
                <span>
                  {lang === 'ro'
                    ? `Odată ce trade-ul a atins TP1, se recomandă închiderea a 70% din poziție și mutarea Stop Loss-ului la Break-Even (BE = $${featuredSignal.entryPrice}).`
                    : `Once the trade hits TP1, it is recommended to close 70% of position and move Stop Loss to Break-Even (BE = $${featuredSignal.entryPrice}).`}
                </span>
              </div>
            </div>
          ) : null}

          {/* Rationale & Plan Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-5 border-t border-white/10 relative z-10 mt-5">
            {/* Detailed Rationale */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>{lang === 'ro' ? 'Justificare Tehnică Gemini AI' : 'Gemini AI Trade Plan & Rationale'}</span>
                </h4>
                <div className="flex items-center gap-2">
                  {featuredSignal.outcomeStatus !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCloseClick(featuredSignal)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition border border-rose-500/40 cursor-pointer shadow-sm group"
                      title={lang === 'ro' ? 'Închide Trade-ul (Comandă Stop MT5 / NinjaTrader)' : 'Close Trade (Stop order MT5 / NinjaTrader)'}
                    >
                      <X className="w-3.5 h-3.5 text-rose-400 group-hover:scale-125 transition-transform" />
                      <span>{lang === 'ro' ? 'Închide Trade' : 'Close Trade'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSignalForChart(featuredSignal)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition border border-emerald-500/30 cursor-pointer shadow-sm"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'ro' ? 'Grafic TradingView 📈' : 'TradingView Chart 📈'}</span>
                  </button>
                  <button
                    onClick={() => setSelectedSignalForDetails(featuredSignal)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition border border-indigo-500/30 cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'ro' ? 'Pop-Up Explicație 🔍' : 'Trade Details 🔍'}</span>
                  </button>
                </div>
              </div>
              <p
                onClick={() => setSelectedSignalForDetails(featuredSignal)}
                className="text-xs text-slate-300 leading-relaxed bg-[#0B1428]/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 whitespace-pre-line shadow-lg font-medium hover:border-indigo-500/50 hover:bg-[#0E1A34]/90 transition cursor-pointer"
                title={lang === 'ro' ? 'Click pentru a deschide fereastra pop-up cu explicația detaliată' : 'Click to open full trade explanation pop-up'}
              >
                {getLocalizedSignalText(featuredSignal, 'rationale', lang)}
              </p>
            </div>

            {/* Indicators & Key Levels */}
            <div className="space-y-4">
              {/* ORDER FLOW WIDGET - Positioned directly above Key Technical Levels */}
              <OrderFlowWidget signal={featuredSignal} lang={lang} />

              <div className="bg-[#0B1428]/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 shadow-lg">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2 font-mono">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{lang === 'ro' ? 'Niveluri Tehnice Cheie' : 'Key Technical Levels'}</span>
                </h4>
                <div className="space-y-3 text-xs">
                  {/* Volume Profile Zone: POC, VAL, VAH */}
                  {(() => {
                    const vp = getOrCalculateVolumeProfileLevels(featuredSignal);
                    return (
                      <div className="pb-2.5 border-b border-white/10">
                        <span className="text-slate-400 block text-[11px] font-semibold mb-1.5 font-mono">
                          {lang === 'ro' ? 'Profil Volum (POC, VAL, VAH):' : 'Volume Profile (POC, VAL, VAH):'}
                        </span>
                        <div className="flex flex-wrap gap-1.5 font-mono">
                          <span className="bg-amber-950/60 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold" title="Point of Control - Maximum Volume Price">
                            POC: ${vp.poc}
                          </span>
                          <span className="bg-sky-950/60 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold" title="Value Area High (70%)">
                            VAH: ${vp.vah}
                          </span>
                          <span className="bg-purple-950/60 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold" title="Value Area Low (70%)">
                            VAL: ${vp.val}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold font-mono">{lang === 'ro' ? 'Rezistențe:' : 'Resistances:'}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1 font-mono">
                      {featuredSignal.keyLevels.resistance.map((res, idx) => (
                        <span key={idx} className="bg-rose-950/60 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          ${res}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold font-mono">{lang === 'ro' ? 'Suporturi:' : 'Supports:'}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1 font-mono">
                      {featuredSignal.keyLevels.support.map((sup, idx) => (
                        <span key={idx} className="bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          ${sup}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button for Risk Calculator */}
              <button
                onClick={onOpenCalcModal}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-[0_0_20px_rgba(6,182,212,0.25)] border border-cyan-400/30 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-cyan-200" />
                <span>{lang === 'ro' ? 'Calculează Lotul & Riscul pentru acest Semnal' : 'Calculate Risk & Position Size'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Signal History Table */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>{lang === 'ro' ? 'Istoric Semnale Active & Rezultate Tranzacționare' : 'Signal History & Performance Log'}</span>
            <span className="text-xs text-cyan-400 font-semibold font-mono">
              ({filteredSignals.length} {lang === 'ro' ? 'semnale' : 'signals'})
            </span>
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/90 to-indigo-500/90 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-md border border-indigo-400/30 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-300" />
              <span>{lang === 'ro' ? 'Statistici & Istoric Detaliat (History Stats)' : 'Full History Stats & Analytics'}</span>
            </button>

            {onDeleteAllSignals && signals.length > 0 && (
              <button
                onClick={onDeleteAllSignals}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs shadow-md border border-rose-500/40 transition cursor-pointer"
                title={lang === 'ro' ? 'Șterge definitiv tot istoricul de semnale' : 'Delete all signal history'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                <span>{lang === 'ro' ? 'Șterge Tot Istoricul' : 'Clear All History'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile View: Stacked Cards (Frosted Glass) */}
        <div className="block md:hidden space-y-3">
          {filteredSignals.map((sig) => {
            const badge = getOutcomeBadgeDetails(sig.outcomeStatus, lang, sig.isBeHitAfterTp1, sig.isBeHitAfterTp2);
            return (
              <div
                key={sig.id}
                onClick={() => setSelectedSignalForDetails(sig)}
                className="bg-[#0A1326]/80 backdrop-blur-xl border border-white/10 rounded-xl p-3.5 shadow-lg hover:border-indigo-500/40 hover:bg-[#0D1A33]/90 transition cursor-pointer space-y-3"
              >
                {/* Header Row: Instrument Name, Action Badge, Result Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                      <span>{sig.instrumentName}</span>
                      <span className="text-xs text-slate-400 font-mono">({sig.symbol})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{formatFullDateTime(sig.createdAt, lang)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getSignalBadgeStyle(sig.type)}`}>
                      {sig.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] border whitespace-nowrap font-mono ${badge.badgeClass}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Sub row: Execution & TF & Confidence */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  {(() => {
                    const execType = sig.executionType || calculateExecutionType(sig.type, sig.entryPrice, sig.currentMarketPrice || sig.entryPrice);
                    return (
                      <span className={`px-2 py-0.5 rounded text-[10px] border uppercase ${getExecutionBadgeStyle(execType)}`}>
                        ⚡ {execType}
                      </span>
                    );
                  })()}
                  <span className="px-2 py-0.5 bg-white/10 text-slate-200 border border-white/10 rounded font-bold">
                    TF: {sig.timeframe}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-bold border border-indigo-500/30">
                    AI: {sig.confidencePercent}%
                  </span>
                </div>

                {/* PNL Curent Row for Mobile */}
                {(() => {
                  const pnlData = calculateTradePnLMetrics(sig, user, quotes);
                  const isPos = pnlData.pnl > 0;
                  const isNeg = pnlData.pnl < 0;
                  return (
                    <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">{lang === 'ro' ? 'PNL Curent:' : 'Live P&L:'}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${pnlData.accountBadgeStyle}`}>
                          {pnlData.accountBadge}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black ${
                          pnlData.hasPrice === false
                            ? 'text-slate-400'
                            : isPos
                            ? 'text-emerald-400'
                            : isNeg
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}>
                          {pnlData.hasPrice === false
                            ? '-'
                            : isPos
                            ? `+$${pnlData.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : isNeg
                            ? `-$${Math.abs(pnlData.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '$0.00'}
                        </span>
                        {pnlData.hasPrice !== false && pnlData.rr !== 0 && (
                          <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ({isPos ? '+' : ''}{pnlData.rr}R)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Grid for Entry, SL, TP Prices */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/40 p-2.5 rounded-lg border border-white/10">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">{lang === 'ro' ? 'Intrare' : 'Entry'}</span>
                    <span className="font-bold text-white">${formatSignalPrice(sig.entryPrice, sig.instrumentId, sig.symbol)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Stop Loss</span>
                    <span className="font-bold text-rose-400">${formatSignalPrice(sig.stopLoss, sig.instrumentId, sig.symbol)}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-white/10 flex flex-wrap justify-between gap-1 text-[11px] text-emerald-400 font-bold">
                    <span>TP1: ${formatSignalPrice(sig.targetPrice1, sig.instrumentId, sig.symbol)}</span>
                    <span>TP2: ${formatSignalPrice(sig.targetPrice2, sig.instrumentId, sig.symbol)}</span>
                    <span>TP3: ${formatSignalPrice(sig.targetPrice3, sig.instrumentId, sig.symbol)}</span>
                  </div>
                </div>

                {sig.isBeHitAfterTp1 ? (
                  <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-[11px]">
                    <span className="font-bold text-emerald-300 block uppercase text-[10px] font-mono">
                      🎯 {lang === 'ro' ? 'TP1 Atins & BE Atins' : 'TP1 Hit & BE Hit'}
                    </span>
                    <p className="text-emerald-300 mt-0.5">
                      {lang === 'ro'
                        ? `70% profit securizat la TP1. Restul de 30% închis la Break-Even ($${sig.entryPrice}). Trade închis.`
                        : `70% profit locked at TP1. Remaining 30% closed at Break-Even ($${sig.entryPrice}). Trade closed.`}
                    </p>
                  </div>
                ) : (sig.outcomeStatus === 'TP1_HIT' || sig.firstHitMilestone === 'TP1') && (
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px]">
                    <span className="font-bold text-amber-300 block uppercase text-[10px] font-mono">
                      🎯 {lang === 'ro' ? 'Recomandare Management Risc' : 'Risk Management'}
                    </span>
                    <p className="text-amber-200 mt-0.5">
                      {lang === 'ro'
                        ? `TP1 Atins! Închideți 70% din poziție și mutați SL la BE ($${sig.entryPrice}).`
                        : `TP1 Hit! Close 70% of position and move SL to BE ($${sig.entryPrice}).`}
                    </p>
                  </div>
                )}

                {sig.outcomeStatus === 'CANCELLED' && (
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-white text-[11px]">
                    <span className="font-bold text-rose-400 block uppercase text-[10px] font-mono">{lang === 'ro' ? 'Motiv Anulare:' : 'Cancellation Reason:'}</span>
                    <p className="text-slate-200 mt-0.5">{getCancellationReason(sig, lang)}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  {sig.outcomeStatus !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCloseClick(sig)}
                      className="py-1.5 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 font-bold text-xs flex items-center justify-center gap-1 transition border border-rose-500/40 shadow-sm"
                      title={lang === 'ro' ? 'Închide Trade-ul (MT5 / NinjaTrader)' : 'Close Trade (MT5 / NinjaTrader)'}
                    >
                      <X className="w-3.5 h-3.5 text-rose-400" />
                      <span>{lang === 'ro' ? 'Închide' : 'Close'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSignalForChart(sig)}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-emerald-500/30"
                    title={lang === 'ro' ? 'Deschide Grafic Tehnic TradingView' : 'Open TradingView Chart'}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'ro' ? 'Grafic 📈' : 'Chart 📈'}</span>
                  </button>
                  <button
                    onClick={() => setSelectedSignalForDetails(sig)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-indigo-500/30"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'ro' ? 'Explicație 🔍' : 'Rationale 🔍'}</span>
                  </button>
                  {onDeleteSignal && (
                    <button
                      onClick={() => onDeleteSignal(sig.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                      title={lang === 'ro' ? 'Șterge semnal' : 'Delete signal'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Full Data Table with Obsidian Frosted Glass */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-[#091122]/80 backdrop-blur-2xl">
          <table className="w-full text-left text-xs text-slate-200 font-mono">
            <thead className="bg-[#060B17]/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-white/10">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">{lang === 'ro' ? 'Instrument' : 'Instrument'}</th>
                <th className="px-2.5 py-3 whitespace-nowrap">{lang === 'ro' ? 'Acțiune' : 'Action'}</th>
                <th className="px-2.5 py-3 whitespace-nowrap">{lang === 'ro' ? 'Tip Ordin' : 'Order Type'}</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">{lang === 'ro' ? 'Timeframe' : 'Timeframe'}</th>
                <th className="px-3 py-3 whitespace-nowrap">{lang === 'ro' ? 'Intrare (Entry)' : 'Entry Price'}</th>
                <th className="px-3 py-3 whitespace-nowrap">{lang === 'ro' ? 'Stop Loss' : 'Stop Loss'}</th>
                <th className="px-3 py-3 whitespace-nowrap">{lang === 'ro' ? 'Take Profit (1 / 2 / 3)' : 'Take Profit (1 / 2 / 3)'}</th>
                <th className="px-3 py-3 whitespace-nowrap">{lang === 'ro' ? 'Stare Rezultat (TP/SL)' : 'Result Status'}</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">{lang === 'ro' ? 'Încredere' : 'Confidence'}</th>
                {/* Rubrică PNL Curent sincronizat din MT5 / NinjaTrader */}
                <th className="px-3 py-3 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-white font-extrabold">{lang === 'ro' ? 'PNL Curent' : 'Live P&L'}</span>
                    <span className="text-[8px] font-sans text-cyan-400 font-semibold tracking-wider uppercase">MT5 / Ninja</span>
                  </div>
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap">{lang === 'ro' ? 'Acțiuni' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-transparent">
              {filteredSignals.map((sig) => {
                const badge = getOutcomeBadgeDetails(sig.outcomeStatus, lang, sig.isBeHitAfterTp1, sig.isBeHitAfterTp2);
                return (
                  <tr
                    key={sig.id}
                    onClick={() => setSelectedSignalForDetails(sig)}
                    className="hover:bg-white/[0.04] transition cursor-pointer group"
                    title={lang === 'ro' ? 'Click pentru a vedea explicația detaliată a semnalului' : 'Click to open trade explanation pop-up'}
                  >
                    <td className="px-3 py-2.5 font-sans font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5 group-hover:text-cyan-400 transition">
                        <span>{sig.instrumentName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({sig.symbol})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1 font-normal">
                        <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>{formatFullDateTime(sig.createdAt, lang)}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getSignalBadgeStyle(sig.type)}`}>
                        {sig.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      {(() => {
                        const execType = sig.executionType || calculateExecutionType(sig.type, sig.entryPrice, sig.currentMarketPrice || sig.entryPrice);
                        return (
                          <span className={`px-2 py-0.5 rounded text-[10px] border uppercase ${getExecutionBadgeStyle(execType)}`}>
                            ⚡ {execType}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-300 font-bold whitespace-nowrap">{sig.timeframe}</td>
                    <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap">${formatSignalPrice(sig.entryPrice, sig.instrumentId, sig.symbol)}</td>
                    <td className="px-3 py-2.5 text-rose-400 font-bold whitespace-nowrap">${formatSignalPrice(sig.stopLoss, sig.instrumentId, sig.symbol)}</td>
                    <td className="px-3 py-2.5 text-emerald-400 font-bold whitespace-nowrap">
                      <div className="flex flex-col text-[11px] leading-tight">
                        <span className="font-extrabold text-emerald-300">TP1: ${formatSignalPrice(sig.targetPrice1, sig.instrumentId, sig.symbol)}</span>
                        <span className="text-slate-400 text-[10px]">
                          TP2: ${formatSignalPrice(sig.targetPrice2, sig.instrumentId, sig.symbol)} | TP3: ${formatSignalPrice(sig.targetPrice3, sig.instrumentId, sig.symbol)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1 max-w-[220px]">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] border whitespace-nowrap inline-block font-mono ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                        {sig.outcomeStatus === 'CANCELLED' && (
                          <span className="text-[10px] text-slate-300 font-sans leading-tight bg-rose-950/40 p-1 rounded border border-rose-500/30 block" title={getCancellationReason(sig, lang)}>
                            <strong>{lang === 'ro' ? 'Motiv:' : 'Reason:'}</strong> {getCancellationReason(sig, lang)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center text-indigo-300 font-bold whitespace-nowrap">{sig.confidencePercent}%</td>
                    {/* Rubrică PNL Curent sincronizat din MT5 / NinjaTrader */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {(() => {
                        const pnlData = calculateTradePnLMetrics(sig, user, quotes);
                        const isPos = pnlData.pnl > 0;
                        const isNeg = pnlData.pnl < 0;
                        return (
                          <div className="flex flex-col items-center justify-center">
                            <span className={`font-mono font-black tracking-tight text-xs sm:text-[13px] ${
                              pnlData.hasPrice === false
                                ? 'text-slate-400'
                                : isPos
                                ? 'text-emerald-400'
                                : isNeg
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}>
                              {pnlData.hasPrice === false
                                ? '-'
                                : isPos
                                ? `+$${pnlData.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : isNeg
                                ? `-$${Math.abs(pnlData.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '$0.00'}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-tight ${pnlData.accountBadgeStyle}`}>
                                {pnlData.accountBadge}
                              </span>
                              {pnlData.hasPrice !== false && pnlData.rr !== 0 && (
                                <span className={`text-[9px] font-mono font-semibold ${isPos ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  ({isPos ? '+' : ''}{pnlData.rr}R)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Buton X - Închide Trade (MT5 & NinjaTrader) */}
                        {sig.outcomeStatus !== 'CANCELLED' && (
                          <button
                            onClick={() => handleCloseClick(sig)}
                            className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-rose-500/40 shadow-sm hover:border-rose-400 group"
                            title={lang === 'ro' ? 'Închide Trade-ul (Comandă Stop & Închidere Poziție în MT5 / NinjaTrader)' : 'Close Trade (Close Position & Stop in MT5 / NinjaTrader)'}
                          >
                            <X className="w-3.5 h-3.5 text-rose-400 group-hover:scale-125 transition-transform" />
                            <span className="font-mono">{lang === 'ro' ? 'Închide' : 'Close'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedSignalForChart(sig)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-emerald-500/30"
                          title={lang === 'ro' ? 'Deschide Grafic Tehnic TradingView' : 'Open TradingView Technical Chart'}
                        >
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span>{lang === 'ro' ? 'Grafic' : 'Chart'}</span>
                        </button>
                        <button
                          onClick={() => setSelectedSignalForDetails(sig)}
                          className="px-2 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-indigo-500/30"
                          title={lang === 'ro' ? 'Vezi Explicația Detaliată' : 'View Trade Rationale'}
                        >
                          <Info className="w-3 h-3 text-indigo-400" />
                          <span>{lang === 'ro' ? 'Explicație' : 'Details'}</span>
                        </button>
                        {onDeleteSignal && (
                          <button
                            onClick={() => onDeleteSignal(sig.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                            title={lang === 'ro' ? 'Șterge semnal' : 'Delete signal'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signal Details / Rationale Pop-Up Modal */}
      <SignalDetailsModal
        isOpen={!!selectedSignalForDetails}
        onClose={() => setSelectedSignalForDetails(null)}
        signal={selectedSignalForDetails}
        lang={lang}
        onOpenCalcModal={onOpenCalcModal}
        onOpenChartModal={(sig) => setSelectedSignalForChart(sig)}
        user={user}
        quotes={quotes}
      />

      {/* TradingView Technical Chart & Strategy Modal */}
      {selectedSignalForChart && (
        <TradingViewSignalChartModal
          isOpen={!!selectedSignalForChart}
          onClose={() => setSelectedSignalForChart(null)}
          signal={selectedSignalForChart}
          lang={lang}
          onOpenCalcModal={onOpenCalcModal}
        />
      )}

      {/* Signal History Stats Modal */}
      <SignalHistoryStatsModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        signals={signals}
        lang={lang}
        onDeleteSignal={onDeleteSignal}
        onDeleteAllSignals={onDeleteAllSignals}
        onResetSignals={onResetSignals}
      />

      {/* Confirm Close Trade Modal */}
      {signalToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-gradient-to-b from-[#0F1A30] to-[#0A1020] border border-rose-500/40 rounded-2xl p-6 shadow-2xl shadow-rose-950/40 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {lang === 'ro' ? 'Confirmă Închiderea Trade-ului' : 'Confirm Close Trade'}
                  </h3>
                  <span className="text-xs text-rose-400 font-mono font-semibold">
                    MT5 & NinjaTrader Synced
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSignalToClose(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trade Info Summary Card */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono">
                  {signalToClose.symbol} ({signalToClose.timeframe})
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                  signalToClose.type.includes('BUY') 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {signalToClose.type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Entry</span>
                  <span className="text-white font-bold">${signalToClose.entryPrice}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Stop Loss</span>
                  <span className="text-rose-400 font-bold">${signalToClose.stopLoss}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Take Profit 1</span>
                  <span className="text-emerald-400 font-bold">${signalToClose.targetPrice1}</span>
                </div>
              </div>

              {/* PnL Preview if live quote available */}
              {quotes && (
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">
                    {lang === 'ro' ? 'P&L Curent Estimat:' : 'Current Estimated P&L:'}
                  </span>
                  {(() => {
                    const pnlMetrics = calculateTradePnLMetrics(signalToClose, user, quotes);
                    const isPos = pnlMetrics.pnl > 0;
                    return (
                      <span className={`text-sm font-bold font-mono ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPos ? '+' : ''}${pnlMetrics.pnl.toFixed(2)}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Warning / Explanation Text */}
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 leading-relaxed flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p>
                {lang === 'ro'
                  ? 'Această acțiune va marca trade-ul ca închis în MarketAI și va trimite comanda de ÎNCHIDERE a poziției deschise sau de ȘTERGERE a ordinului de intrare către terminalul MetaTrader 5 (MQL5 EA) și NinjaTrader 8.'
                  : 'This action marks the trade as closed in MarketAI and immediately sends a CLOSE POSITION or CANCEL ORDER command to MetaTrader 5 (MQL5 EA) and NinjaTrader 8.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSignalToClose(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer text-center"
              >
                {lang === 'ro' ? 'Anulează / Păstrează' : 'Cancel / Keep'}
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseTrade}
                disabled={isClosingTrade}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs border border-rose-400/30 shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>{isClosingTrade ? (lang === 'ro' ? 'Se închide...' : 'Closing...') : (lang === 'ro' ? 'Închide Trade-ul Acum' : 'Close Trade Now')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Success Toast */}
      {closeSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{closeSuccessToast}</span>
        </div>
      )}
    </div>
  );
};
