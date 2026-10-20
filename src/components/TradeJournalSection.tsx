import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  BookOpen,
  CalendarDays,
  Flame,
  Award,
  DollarSign,
  List,
  Grid,
  Trash2,
} from 'lucide-react';
import {
  TradeJournalEntry,
  TradingSignal,
  MarketQuote,
  InstrumentId,
} from '../types';
import {
  getCalendarGridForMonth,
  getDailyJournalMap,
  calculateMonthlyStats,
  unifyJournalEntries,
  getLocalDateKey,
  DayCalendarCell,
} from '../utils/tradeJournalUtils';
import { DayTradesModal } from './DayTradesModal';
import { AddTradeModal } from './AddTradeModal';

interface TradeJournalSectionProps {
  signals: TradingSignal[];
  quotes: Record<InstrumentId, MarketQuote>;
  manualTrades: TradeJournalEntry[];
  onSaveManualTrade: (trade: TradeJournalEntry) => void;
  onDeleteManualTrade: (tradeId: string) => void;
  onClearAllManualTrades?: () => void;
  onViewSignalDetails?: (signal: TradingSignal) => void;
  lang: 'ro' | 'en';
}

export const TradeJournalSection: React.FC<TradeJournalSectionProps> = ({
  signals,
  quotes,
  manualTrades,
  onSaveManualTrade,
  onDeleteManualTrade,
  onClearAllManualTrades,
  onViewSignalDetails,
  lang,
}) => {
  // Current view date: year & month
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Filters: All / AI Signals Only / Manual Only
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SIGNALS' | 'MANUAL'>('ALL');
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');

  // Modal states
  const [selectedDateForPopup, setSelectedDateForPopup] = useState<string | null>(null);
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [addTradeInitialDate, setAddTradeInitialDate] = useState<string>(getLocalDateKey(today));
  const [editingTrade, setEditingTrade] = useState<TradeJournalEntry | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Unify platform signals and manual trades
  const unifiedEntries = useMemo(() => {
    let list = unifyJournalEntries(signals, manualTrades, quotes);
    if (sourceFilter === 'SIGNALS') {
      list = list.filter((t) => !t.isManual);
    } else if (sourceFilter === 'MANUAL') {
      list = list.filter((t) => t.isManual);
    }
    return list;
  }, [signals, manualTrades, quotes, sourceFilter]);

  // Calendar cells for current year and month
  const calendarCells = useMemo(() => {
    return getCalendarGridForMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Grouped daily stats map
  const dailyMap = useMemo(() => {
    return getDailyJournalMap(unifiedEntries);
  }, [unifiedEntries]);

  // Monthly aggregated KPI statistics
  const monthlyStats = useMemo(() => {
    return calculateMonthlyStats(unifiedEntries, currentYear, currentMonth);
  }, [unifiedEntries, currentYear, currentMonth]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const n = new Date();
    setCurrentYear(n.getFullYear());
    setCurrentMonth(n.getMonth());
  };

  // Month and Day labels
  const monthNamesRo = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = (lang === 'ro' ? monthNamesRo : monthNamesEn)[currentMonth];

  const weekdayHeadersRo = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
  const weekdayHeadersEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdayHeaders = lang === 'ro' ? weekdayHeadersRo : weekdayHeadersEn;

  // Day click handler
  const handleCellClick = (cell: DayCalendarCell) => {
    setSelectedDateForPopup(cell.dateStr);
  };

  // Open add trade modal for a specific day
  const handleOpenAddForDate = (dateStr: string) => {
    setEditingTrade(null);
    setAddTradeInitialDate(dateStr);
    setIsAddTradeModalOpen(true);
  };

  // Open edit trade modal
  const handleOpenEditTrade = (trade: TradeJournalEntry) => {
    setEditingTrade(trade);
    setIsAddTradeModalOpen(true);
  };

  // Link to signal details modal
  const handleViewSignal = (signalId: string) => {
    if (!onViewSignalDetails) return;
    const sig = signals.find((s) => s.id === signalId);
    if (sig) {
      onViewSignalDetails(sig);
    }
  };

  // Trades of the currently selected day popup
  const selectedDayTrades = selectedDateForPopup ? dailyMap[selectedDateForPopup]?.trades || [] : [];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0A1224]/90 via-[#080F1F]/90 to-[#050914]/95 p-4 sm:p-6 text-white shadow-2xl backdrop-blur-2xl glass-specular-top">
        {/* Ambient illumination glow */}
        <div className="absolute top-0 right-1/4 -mt-10 h-36 w-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 -mb-10 h-32 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-950/30">
              <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                  {lang === 'ro' ? 'Jurnal de Tranzacții & Calendar R:R' : 'Trade Journal & R:R Calendar'}
                </h1>
                <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono shadow-xs">
                  Live Sync
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {lang === 'ro'
                  ? 'Calendar lunar cu randamentul R:R (Risk/Reward) realizat în fiecare zi. Dă click pe o zi pentru a vedea detaliile tranzacțiilor.'
                  : 'Monthly calendar tracking daily realized R:R. Click any day to view trade details.'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Source Filter */}
            <div className="bg-[#060B18]/80 p-1 rounded-xl border border-white/10 flex items-center text-xs backdrop-blur-md">
              <button
                onClick={() => setSourceFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  sourceFilter === 'ALL'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ro' ? 'Toate' : 'All'}
              </button>
              <button
                onClick={() => setSourceFilter('SIGNALS')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  sourceFilter === 'SIGNALS'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ro' ? 'Semnale AI' : 'AI Signals'}
              </button>
              <button
                onClick={() => setSourceFilter('MANUAL')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  sourceFilter === 'MANUAL'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ro' ? 'Manuale' : 'Manual'}
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-[#060B18]/80 p-1 rounded-xl border border-white/10 flex items-center text-xs backdrop-blur-md">
              <button
                onClick={() => setViewMode('CALENDAR')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'CALENDAR'
                    ? 'bg-white/15 text-white shadow-xs border border-white/10'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={lang === 'ro' ? 'Vizualizare Calendar' : 'Calendar View'}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('LIST')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-white/15 text-white shadow-xs border border-white/10'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={lang === 'ro' ? 'Vizualizare Listă' : 'List View'}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Clear All Manual Trades Button (if manual trades exist) */}
            {onClearAllManualTrades && manualTrades.length > 0 && (
              <button
                onClick={() => setIsConfirmClearOpen(true)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                title={lang === 'ro' ? 'Golește toate tranzacțiile din jurnal' : 'Clear all manual trades from journal'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'ro' ? 'Golește Jurnal' : 'Clear Journal'}</span>
              </button>
            )}

            {/* Add Trade Button */}
            <button
              onClick={() => handleOpenAddForDate(getLocalDateKey(new Date()))}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 border border-emerald-400/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ro' ? '+ Înregistrează Trade' : '+ Log Trade'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Monthly RR */}
        <div className="bg-gradient-to-br from-[#0B1528]/85 via-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl relative overflow-hidden flex flex-col justify-between transition-all duration-300 group glass-specular-top">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {lang === 'ro' ? 'RR Total Lună' : 'Monthly Net R:R'}
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-400/20 text-indigo-400">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div
              className={`text-xl sm:text-3xl font-black font-mono tracking-tight ${
                monthlyStats.totalNetRR > 0
                  ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : monthlyStats.totalNetRR < 0
                  ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : 'text-slate-200'
              }`}
            >
              {monthlyStats.totalNetRR > 0 ? `+${monthlyStats.totalNetRR}R` : `${monthlyStats.totalNetRR}R`}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {monthlyStats.totalNetRR > 0
                ? lang === 'ro'
                  ? 'Lună profitabilă'
                  : 'Profitable month'
                : lang === 'ro'
                ? 'Rezultat net cumulat'
                : 'Cumulative net'}
            </p>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-gradient-to-br from-[#0B1528]/85 via-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-col justify-between transition-all duration-300 group glass-specular-top">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {lang === 'ro' ? 'Rată Câștig' : 'Win Rate'}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black font-mono text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.25)]">
              {monthlyStats.winRate}%
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              <span className="text-emerald-400 font-bold">{monthlyStats.winCount}W</span> /{' '}
              <span className="text-rose-400 font-bold">{monthlyStats.lossCount}L</span>
              {monthlyStats.beCount > 0 && <span> ({monthlyStats.beCount} BE)</span>}
            </p>
          </div>
        </div>

        {/* Green Days vs Red Days */}
        <div className="bg-gradient-to-br from-[#0B1528]/85 via-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-col justify-between transition-all duration-300 group glass-specular-top">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {lang === 'ro' ? 'Zile Verzi / Roșii' : 'Green / Red Days'}
            </span>
            <span className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/20 text-cyan-400">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">{monthlyStats.greenDaysCount}V</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">{monthlyStats.redDaysCount}R</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === 'ro' ? 'Zile cu randament pozitiv' : 'Days in profit'}
            </p>
          </div>
        </div>

        {/* Total Trades Count */}
        <div className="bg-gradient-to-br from-[#0B1528]/85 via-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-col justify-between transition-all duration-300 group glass-specular-top">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {lang === 'ro' ? 'Total Tranzacții' : 'Total Trades'}
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-400/20 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black font-mono text-white">
              {monthlyStats.totalTrades}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {monthlyStats.runningCount > 0 ? (
                <span className="text-cyan-400 font-bold font-mono">{monthlyStats.runningCount} în rulare</span>
              ) : (
                <span>{lang === 'ro' ? 'În această lună' : 'This month'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Best Day */}
        <div className="bg-gradient-to-br from-[#0B1528]/85 via-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-col justify-between transition-all duration-300 group glass-specular-top">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {lang === 'ro' ? 'Cea Mai Bună Zi' : 'Best Day'}
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-400/20 text-amber-400">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black font-mono text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.25)]">
              {monthlyStats.bestDay ? `+${monthlyStats.bestDay.rr}R` : '-'}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
              {monthlyStats.bestDay ? monthlyStats.bestDay.date : (lang === 'ro' ? 'Fără tranzacții' : 'No trades')}
            </p>
          </div>
        </div>

        {/* Estimated Profit ($) / Avg RR */}
        <div className="bg-gradient-to-br from-[#0B1528]/85 via-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-col justify-between transition-all duration-300 group glass-specular-top">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {lang === 'ro' ? 'P&L / Medie RR' : 'P&L / Avg RR'}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/20 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                monthlyStats.totalPnl > 0
                  ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.25)]'
                  : monthlyStats.totalPnl < 0
                  ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                  : 'text-slate-200'
              }`}
            >
              {monthlyStats.totalPnl !== 0
                ? monthlyStats.totalPnl > 0
                  ? `+$${monthlyStats.totalPnl}`
                  : `-$${Math.abs(monthlyStats.totalPnl)}`
                : `${monthlyStats.avgRrPerWin > 0 ? `+${monthlyStats.avgRrPerWin}R win` : '$0.00'}`}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {monthlyStats.avgRrPerWin > 0
                ? `Avg Win: +${monthlyStats.avgRrPerWin}R`
                : (lang === 'ro' ? 'Profit estimat' : 'Est. profit')}
            </p>
          </div>
        </div>
      </div>

      {/* Month Navigation & Controls Bar */}
      <div className="bg-[#0A1224]/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-3.5 sm:p-4 text-white flex flex-wrap items-center justify-between gap-3 shadow-xl glass-specular-top">
        {/* Month Selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer border border-white/10"
            title={lang === 'ro' ? 'Luna precedentă' : 'Previous month'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="min-w-[170px] sm:min-w-[200px] text-center">
            <h2 className="text-base sm:text-xl font-black text-white capitalize tracking-tight">
              {currentMonthName} {currentYear}
            </h2>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer border border-white/10"
            title={lang === 'ro' ? 'Luna următoare' : 'Next month'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 text-xs font-bold border border-indigo-500/30 transition cursor-pointer ml-1"
          >
            {lang === 'ro' ? 'Azi' : 'Today'}
          </button>
        </div>

        {/* Legend / Quick explanation */}
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-400 shadow-xs shadow-emerald-500/30"></span>
            <span>+RR {lang === 'ro' ? 'Profit' : 'Profit'}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-3 h-3 rounded-full bg-rose-500/30 border border-rose-400 shadow-xs shadow-rose-500/30"></span>
            <span>-RR {lang === 'ro' ? 'Pierdere' : 'Loss'}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-3 h-3 rounded-full bg-white/10 border border-white/20"></span>
            <span>0.0R Break-even</span>
          </div>
        </div>
      </div>

      {/* Main Calendar View */}
      {viewMode === 'CALENDAR' ? (
        <div className="bg-[#0A1224]/85 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl glass-specular-top">
          {/* Weekdays Header Grid */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-[#060A14]/90 text-center text-xs font-bold uppercase tracking-wider text-slate-400 py-3 px-1 sm:px-2">
            {weekdayHeaders.map((day, idx) => (
              <div
                key={day}
                className={`py-0.5 ${idx >= 5 ? 'text-indigo-400/90 font-black' : ''}`}
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.substring(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* Days Cells Grid */}
          <div className="grid grid-cols-7 gap-px bg-white/5">
            {calendarCells.map((cell) => {
              const dayData = dailyMap[cell.dateStr];
              const hasTrades = !!(dayData && dayData.tradesCount > 0);
              const isPositive = hasTrades && dayData.totalRR > 0;
              const isNegative = hasTrades && dayData.totalRR < 0;
              const isNeutral = hasTrades && dayData.totalRR === 0;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => handleCellClick(cell)}
                  className={`min-h-[90px] sm:min-h-[120px] p-1.5 sm:p-2.5 transition flex flex-col justify-between relative cursor-pointer group ${
                    cell.isCurrentMonth
                      ? cell.isWeekend
                        ? 'bg-[#080E1C]/80 hover:bg-[#0F1D38]/90'
                        : 'bg-[#0A1224]/80 hover:bg-[#0F1D38]/90'
                      : 'bg-[#040711]/90 text-slate-600 hover:bg-[#070D1B]/80'
                  } ${
                    cell.isToday
                      ? 'ring-2 ring-inset ring-cyan-400/80 shadow-inner'
                      : ''
                  }`}
                >
                  {/* Cell Top Bar: Day number & Today badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono rounded-md px-1.5 py-0.5 ${
                        cell.isToday
                          ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/30'
                          : cell.isCurrentMonth
                          ? 'text-slate-200'
                          : 'text-slate-600'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {cell.isToday && (
                      <span className="text-[9px] font-black uppercase text-cyan-400 font-mono tracking-wider">
                        {lang === 'ro' ? 'AZI' : 'TODAY'}
                      </span>
                    )}

                    {/* Quick plus icon on hover if empty */}
                    {!hasTrades && (
                      <span className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-emerald-400 transition p-0.5">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  {/* Center Content: RR Badge & Trade stats */}
                  {hasTrades ? (
                    <div className="my-auto py-1 space-y-1 sm:space-y-1.5">
                      {/* Prominent RR Achievement Badge */}
                      <div
                        className={`py-1 px-1.5 sm:px-2 rounded-lg font-black font-mono text-center text-xs sm:text-base tracking-tight transition shadow-xs ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500/25 group-hover:border-emerald-400/50 shadow-emerald-500/10'
                            : isNegative
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 group-hover:bg-rose-500/25 group-hover:border-rose-400/50 shadow-rose-500/10'
                            : 'bg-white/5 text-slate-300 border border-white/10'
                        }`}
                      >
                        {dayData.totalRR > 0 ? `+${dayData.totalRR}R` : `${dayData.totalRR}R`}
                      </div>

                      {/* Trade count & Win Rate */}
                      <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-medium text-slate-400 font-mono truncate">
                        <span>
                          {dayData.tradesCount} {dayData.tradesCount === 1 ? 'trade' : 'trades'}
                        </span>
                        {dayData.winCount > 0 && dayData.lossCount > 0 && (
                          <span className="hidden sm:inline font-bold text-slate-500">•</span>
                        )}
                        <span className="hidden sm:inline text-emerald-400 font-bold">
                          {dayData.winRate}% WR
                        </span>
                      </div>

                      {/* Mini Symbol Tags */}
                      {dayData.symbols.length > 0 && (
                        <div className="hidden sm:flex flex-wrap gap-1 justify-center pt-0.5">
                          {dayData.symbols.slice(0, 2).map((sym) => (
                            <span
                              key={sym}
                              className="px-1 py-0.2 rounded bg-white/5 text-slate-300 text-[9px] font-mono border border-white/10"
                            >
                              {sym}
                            </span>
                          ))}
                          {dayData.symbols.length > 2 && (
                            <span className="text-[9px] text-slate-500 font-mono">
                              +{dayData.symbols.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="my-auto text-center py-2">
                      <span className="text-[10px] text-slate-700 group-hover:text-slate-500 transition">
                        -
                      </span>
                    </div>
                  )}

                  {/* Cell Bottom: Profit ($) if recorded */}
                  {hasTrades && dayData.totalPnl !== 0 && (
                    <div className="text-right">
                      <span
                        className={`text-[9px] sm:text-[10px] font-mono font-bold ${
                          dayData.totalPnl > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {dayData.totalPnl > 0 ? `+$${dayData.totalPnl}` : `-$${Math.abs(dayData.totalPnl)}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Alternative View Mode: List of Monthly Trades */
        <div className="bg-[#0A1224]/85 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4 glass-specular-top">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <List className="w-4 h-4 text-cyan-400" />
              <span>
                {lang === 'ro'
                  ? `Toate Tranzacțiile din ${currentMonthName} ${currentYear} (${unifiedEntries.length})`
                  : `All Trades in ${currentMonthName} ${currentYear} (${unifiedEntries.length})`}
              </span>
            </h3>

            <button
              onClick={() => handleOpenAddForDate(getLocalDateKey(new Date()))}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/25 border border-emerald-400/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'ro' ? 'Adaugă Trade' : 'Add Trade'}</span>
            </button>
          </div>

          {unifiedEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{lang === 'ro' ? 'Nicio tranzacție găsită în această lună.' : 'No trades found this month.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {unifiedEntries.map((trade) => {
                const isBuy = trade.direction === 'BUY';
                return (
                  <div
                    key={trade.id}
                    className="py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 px-3 rounded-xl transition border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
                          trade.rrAchieved > 0
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs shadow-emerald-500/10'
                            : trade.rrAchieved < 0
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-xs shadow-rose-500/10'
                            : 'bg-white/5 text-slate-300 border border-white/10'
                        }`}
                      >
                        {trade.rrAchieved > 0 ? `+${trade.rrAchieved}R` : `${trade.rrAchieved}R`}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm font-mono">{trade.symbol}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase font-mono ${
                              isBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {trade.direction}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{trade.date} {trade.time}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {trade.setup || trade.outcomeLabel || 'Manual Trade'}
                          {trade.notes && <span className="italic text-slate-500"> — "{trade.notes}"</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => setSelectedDateForPopup(trade.date)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        {lang === 'ro' ? 'Vezi Ziua' : 'View Day'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pop-up Modal showing the day's trades when clicked */}
      <DayTradesModal
        isOpen={!!selectedDateForPopup}
        onClose={() => setSelectedDateForPopup(null)}
        dateStr={selectedDateForPopup || ''}
        trades={selectedDayTrades}
        onOpenAddTrade={(dStr) => {
          setSelectedDateForPopup(null);
          handleOpenAddForDate(dStr);
        }}
        onEditTrade={(t) => {
          setSelectedDateForPopup(null);
          handleOpenEditTrade(t);
        }}
        onDeleteTrade={(tradeId) => {
          onDeleteManualTrade(tradeId);
        }}
        onViewSignalDetails={handleViewSignal}
        lang={lang}
      />

      {/* Modal for adding/editing a trade */}
      <AddTradeModal
        isOpen={isAddTradeModalOpen}
        onClose={() => {
          setIsAddTradeModalOpen(false);
          setEditingTrade(null);
        }}
        onSaveTrade={(newTrade) => {
          onSaveManualTrade(newTrade);
          // Re-open the day's popup so the user can immediately see their newly recorded trade!
          setSelectedDateForPopup(newTrade.date);
        }}
        initialDate={addTradeInitialDate}
        editingTrade={editingTrade}
        lang={lang}
      />

      {/* Modal for confirming clear all manual trades */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0A1326] to-[#060B16] border border-white/15 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-white space-y-4 animate-in fade-in zoom-in-95 duration-150 glass-specular-top">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 rounded-xl border border-rose-500/30 shrink-0">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ro' ? 'Golește Jurnalul de Tranzacționare?' : 'Clear Trade Journal?'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'ro'
                    ? 'Această acțiune va șterge toate tranzacțiile manuale salvate local și în cloud.'
                    : 'This action will delete all manually saved trades locally and in the cloud.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                {lang === 'ro' ? 'Anulează' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onClearAllManualTrades?.();
                  setIsConfirmClearOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/40 border border-rose-400/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ro' ? 'Da, Golește Tot' : 'Yes, Clear All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
