import React from 'react';
import {
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Target,
  Shield,
  ArrowRight,
  Info,
} from 'lucide-react';
import { TradeJournalEntry, TradingSignal } from '../types';

interface DayTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string; // YYYY-MM-DD
  trades: TradeJournalEntry[];
  onOpenAddTrade: (dateStr: string) => void;
  onEditTrade: (trade: TradeJournalEntry) => void;
  onDeleteTrade: (tradeId: string) => void;
  onViewSignalDetails?: (signalId: string) => void;
  lang: 'ro' | 'en';
}

export const DayTradesModal: React.FC<DayTradesModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  trades,
  onOpenAddTrade,
  onEditTrade,
  onDeleteTrade,
  onViewSignalDetails,
  lang,
}) => {
  if (!isOpen) return null;

  // Format date for display
  const formatDateTitle = (str: string) => {
    if (!str) return '';
    const [y, m, d] = str.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return str;

    const daysRo = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthsRo = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = (lang === 'ro' ? daysRo : daysEn)[dateObj.getDay()];
    const monthName = (lang === 'ro' ? monthsRo : monthsEn)[dateObj.getMonth()];

    return `${dayName}, ${d} ${monthName} ${y}`;
  };

  // Calculate day summary
  let netRR = 0;
  let winCount = 0;
  let lossCount = 0;
  let beCount = 0;
  let runningCount = 0;
  let totalPnl = 0;

  for (const t of trades) {
    if (t.status === 'WIN') {
      winCount++;
      netRR += t.rrAchieved || 0;
    } else if (t.status === 'LOSS') {
      lossCount++;
      netRR += t.rrAchieved || -1;
    } else if (t.status === 'BREAKEVEN') {
      beCount++;
    } else if (t.status === 'RUNNING') {
      runningCount++;
    }

    if (typeof t.pnl === 'number') {
      totalPnl += t.pnl;
    }
  }

  netRR = Math.round(netRR * 10) / 10;
  const closedCount = winCount + lossCount;
  const winRate = closedCount > 0 ? Math.round((winCount / closedCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 via-[#080E1C]/95 to-[#040813]/98 text-white rounded-2xl border border-white/15 shadow-2xl w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[92vh] glass-specular-top">
        {/* Header */}
        <div className="bg-[#060B18]/90 px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-md shadow-indigo-500/10">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{formatDateTitle(dateStr)}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ro'
                  ? `Jurnal detaliat al tranzacțiilor din această zi (${trades.length} tranzacții)`
                  : `Detailed trade log for this day (${trades.length} trades)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddTrade(dateStr)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 border border-emerald-400/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ro' ? 'Adaugă Trade' : 'Add Trade'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Day Summary Stats Banner */}
        <div className="bg-white/5 px-4 sm:px-6 py-3 border-b border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 backdrop-blur-md">
          {/* Net RR */}
          <div className="bg-[#0A1224]/80 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                {lang === 'ro' ? 'RR Net Zi' : 'Day Net R:R'}
              </span>
              <span
                className={`text-base sm:text-lg font-black font-mono ${
                  netRR > 0 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : netRR < 0 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]' : 'text-slate-300'
                }`}
              >
                {netRR > 0 ? `+${netRR}R` : `${netRR}R`}
              </span>
            </div>
            <div
              className={`p-1.5 rounded-lg ${
                netRR > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : netRR < 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}
            >
              {netRR >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-[#0A1224]/80 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                {lang === 'ro' ? 'Rată Câștig' : 'Win Rate'}
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-cyan-300">
                {winRate}%
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 text-right font-mono">
              <span className="text-emerald-400">{winCount}W</span> /{' '}
              <span className="text-rose-400">{lossCount}L</span>
            </div>
          </div>

          {/* Total Trades */}
          <div className="bg-[#0A1224]/80 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                {lang === 'ro' ? 'Total Tranzacții' : 'Total Trades'}
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-white">
                {trades.length}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {runningCount > 0 && <span className="text-cyan-400 font-bold">{runningCount} active</span>}
            </div>
          </div>

          {/* Profit ($) if available */}
          <div className="bg-[#0A1224]/80 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                {lang === 'ro' ? 'P&L Estimat' : 'Est. P&L'}
              </span>
              <span
                className={`text-base sm:text-lg font-black font-mono ${
                  totalPnl > 0 ? 'text-emerald-400' : totalPnl < 0 ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {totalPnl !== 0 ? (totalPnl > 0 ? `+$${totalPnl}` : `-$${Math.abs(totalPnl)}`) : '$0.00'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">USD</div>
          </div>
        </div>

        {/* Content: List of Trades */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5">
          {trades.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl border border-dashed border-white/10 bg-white/5">
              <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white mb-1">
                {lang === 'ro' ? 'Nicio tranzacție înregistrată în această zi' : 'No trades logged for this day'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                {lang === 'ro'
                  ? 'Poți adăuga manual orice tranzacție executată pe contul tău sau poți importa automat semnalele platformei.'
                  : 'You can log any trade executed on your account or import platform signals.'}
              </p>
              <button
                onClick={() => onOpenAddTrade(dateStr)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 border border-emerald-400/30"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ro' ? 'Înregistrează Primul Trade' : 'Log First Trade'}</span>
              </button>
            </div>
          ) : (
            trades.map((trade) => {
              const isBuy = trade.direction === 'BUY';
              const isPositive = (trade.rrAchieved || 0) > 0;
              const isNegative = (trade.rrAchieved || 0) < 0;

              return (
                <div
                  key={trade.id}
                  className="bg-white/5 hover:bg-white/10 transition rounded-xl border border-white/10 p-3.5 sm:p-4 space-y-3 shadow-md backdrop-blur-md"
                >
                  {/* Top Row: Asset, Direction, RR Badge, Outcome */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Direction Pill */}
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-xs uppercase flex items-center gap-1 font-mono ${
                          isBuy
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isBuy ? '▲ BUY' : '▼ SELL'}
                      </span>

                      {/* Instrument Symbol */}
                      <span className="font-bold text-white text-sm sm:text-base font-mono">
                        {trade.symbol}
                      </span>

                      {/* Time & Timeframe */}
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span title="Ora Generării Trade-ului">{trade.entryTime || trade.time || '12:00'}</span>
                        {trade.exitTime && (
                          <span className="text-[10px] text-slate-400 font-mono" title="Ora Închiderii / Marcării Profitului">
                            → {trade.exitTime}
                          </span>
                        )}
                        {trade.timeframe && (
                          <span className="px-1.5 py-0.2 rounded bg-white/10 text-slate-300 text-[10px] font-mono border border-white/10">
                            {trade.timeframe}
                          </span>
                        )}
                      </span>

                      {/* Source badge */}
                      {!trade.isManual ? (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold font-mono">
                          AI Signal
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] font-bold font-mono border border-white/10">
                          Manual
                        </span>
                      )}
                    </div>

                    {/* Right side: RR badge & Outcome */}
                    <div className="flex items-center gap-2">
                      {/* Outcome label */}
                      <span className="text-xs font-semibold text-slate-300 font-mono">
                        {trade.outcomeLabel || trade.status}
                      </span>

                      {/* Prominent RR Achieved Pill */}
                      <div
                        className={`px-3 py-1 rounded-xl font-black font-mono text-sm sm:text-base flex items-center gap-1 shadow-xs ${
                          isPositive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isNegative
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-white/10 text-slate-300 border border-white/15'
                        }`}
                      >
                        <span>{trade.rrAchieved > 0 ? `+${trade.rrAchieved}R` : `${trade.rrAchieved}R`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Levels Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#060B18]/70 p-2.5 rounded-lg border border-white/10 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">{lang === 'ro' ? 'Intrare' : 'Entry'}</span>
                      <span className="font-mono font-bold text-white">{trade.entryPrice}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-rose-400 block font-mono">{lang === 'ro' ? 'Stop Loss' : 'Stop Loss'}</span>
                      <span className="font-mono font-bold text-rose-300">{trade.stopLoss}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400 block font-mono">
                        {trade.exitPrice ? (lang === 'ro' ? 'Ieșire Realizată' : 'Realized Exit') : 'Take Profit'}
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        {trade.exitPrice || trade.takeProfit || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">{lang === 'ro' ? 'Profit / PnL' : 'P&L'}</span>
                      <span
                        className={`font-mono font-bold ${
                          typeof trade.pnl === 'number'
                            ? trade.pnl > 0
                              ? 'text-emerald-400'
                              : trade.pnl < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {typeof trade.pnl === 'number'
                          ? trade.pnl > 0
                            ? `+$${trade.pnl}`
                            : `-$${Math.abs(trade.pnl)}`
                          : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Setup & Notes */}
                  {(trade.setup || trade.notes) && (
                    <div className="text-xs space-y-1 bg-[#060B18]/50 p-2.5 rounded-lg border border-white/5">
                      {trade.setup && (
                        <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px] font-mono">
                          <Target className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Setup: {trade.setup}</span>
                        </div>
                      )}
                      {trade.notes && (
                        <p className="text-slate-300 text-[11px] leading-relaxed italic">
                          "{trade.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                    <span className="text-[10px] text-slate-500 font-mono">ID: {trade.id.substring(0, 14)}...</span>

                    <div className="flex items-center gap-2">
                      {trade.linkedSignalId && onViewSignalDetails && (
                        <button
                          onClick={() => onViewSignalDetails(trade.linkedSignalId!)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white transition flex items-center gap-1 cursor-pointer border border-indigo-400/30 font-mono"
                        >
                          <ExternalLink className="w-3 h-3 text-cyan-400" />
                          <span>{lang === 'ro' ? 'Vezi Semnal AI' : 'View AI Signal'}</span>
                        </button>
                      )}

                      {trade.isManual && (
                        <>
                          <button
                            onClick={() => onEditTrade(trade)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer border border-white/10 font-mono"
                            title={lang === 'ro' ? 'Editează' : 'Edit'}
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{lang === 'ro' ? 'Editează' : 'Edit'}</span>
                          </button>

                          <button
                            onClick={() => onDeleteTrade(trade.id)}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white transition flex items-center gap-1 cursor-pointer border border-rose-500/30 font-mono"
                            title={lang === 'ro' ? 'Șterge' : 'Delete'}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{lang === 'ro' ? 'Șterge' : 'Delete'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#060B18]/90 px-4 sm:px-6 py-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {lang === 'ro'
                ? 'RR este calculat ca multiplu al riscului asumat (1R = distanța până la Stop Loss).'
                : 'RR is measured as a multiple of risk taken (1R = distance to Stop Loss).'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition cursor-pointer border border-white/10"
          >
            {lang === 'ro' ? 'Închide' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
