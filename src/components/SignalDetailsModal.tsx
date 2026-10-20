import React from 'react';
import {
  X,
  Target,
  ShieldAlert,
  Clock,
  Calendar,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Cpu,
  Globe,
  Sparkles,
  Layers,
  ArrowRight,
  Calculator,
  AlertOctagon,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { TradingSignal, UserProfile, MarketQuote } from '../types';
import { getOutcomeBadgeDetails, getLocalizedSignalText, formatFullDateTime, getCancellationReason, calculateExecutionType, getOrCalculateVolumeProfileLevels, formatSignalPrice, calculateTradePnLMetrics } from '../utils/signalUtils';
import { OrderFlowWidget } from './OrderFlowWidget';

interface SignalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: TradingSignal | null;
  lang: 'ro' | 'en';
  onOpenCalcModal?: () => void;
  onOpenChartModal?: (signal: TradingSignal) => void;
  user?: UserProfile | null;
  quotes?: Record<string, MarketQuote>;
}

export const SignalDetailsModal: React.FC<SignalDetailsModalProps> = ({
  isOpen,
  onClose,
  signal,
  lang,
  onOpenCalcModal,
  onOpenChartModal,
  user,
  quotes,
}) => {
  if (!isOpen || !signal) return null;

  const isBuy = signal.type.includes('BUY');
  const badgeOutcome = getOutcomeBadgeDetails(signal.outcomeStatus, lang, signal.isBeHitAfterTp1, signal.isBeHitAfterTp2);
  const summaryText = getLocalizedSignalText(signal, 'summary', lang);
  const rationaleText = getLocalizedSignalText(signal, 'rationale', lang);
  const titleText = getLocalizedSignalText(signal, 'title', lang);

  const getSignalBadgeStyle = (type: string) => {
    switch (type) {
      case 'STRONG_BUY':
        return 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-300';
      case 'BUY':
        return 'bg-emerald-500 text-white font-bold';
      case 'STRONG_SELL':
        return 'bg-rose-600 text-white font-bold ring-2 ring-rose-300';
      case 'SELL':
        return 'bg-rose-500 text-white font-bold';
      default:
        return 'bg-slate-600 text-white font-bold';
    }
  };

  const getExecutionBadgeStyle = (execType?: string) => {
    if (!execType) return 'bg-white/5 text-slate-300 border-white/10 font-bold';
    const upper = execType.toUpperCase();
    if (upper.includes('MARKET')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-extrabold';
    if (upper.includes('BUY LIMIT')) return 'bg-sky-500/15 text-sky-300 border-sky-500/30 font-extrabold';
    if (upper.includes('SELL LIMIT')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-extrabold';
    if (upper.includes('BUY STOP')) return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 font-extrabold';
    if (upper.includes('SELL STOP')) return 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-extrabold';
    return 'bg-white/5 text-slate-300 border-white/10 font-bold';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-gradient-to-b from-[#0A1326]/95 via-[#080E1C]/95 to-[#040813]/98 rounded-2xl shadow-2xl border border-white/15 overflow-hidden my-8 max-h-[90vh] flex flex-col text-slate-100 glass-specular-top">
        {/* Modal Header */}
        <div className="bg-[#060B18]/90 text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/15' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-md shadow-rose-500/15'
              }`}
            >
              {isBuy ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{signal.instrumentName}</h2>
                <span className="text-xs font-mono text-cyan-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {signal.symbol}
                </span>
                <span className="text-xs font-bold font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-400/30">
                  {signal.timeframe}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5 flex items-center gap-2">
                <span>{titleText}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition cursor-pointer"
            title={lang === 'ro' ? 'Închide' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-200 text-sm">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${getSignalBadgeStyle(signal.type)}`}>
                {signal.type.replace('_', ' ')}
              </span>
              {(() => {
                const execType = signal.executionType || calculateExecutionType(signal.type, signal.entryPrice, signal.currentMarketPrice || signal.entryPrice);
                return (
                  <span className={`px-2.5 py-1 rounded text-xs border font-mono ${getExecutionBadgeStyle(execType)}`}>
                    ⚡ {execType}
                  </span>
                );
              })()}
              <span className={`px-2.5 py-1 rounded text-xs border whitespace-nowrap ${badgeOutcome.badgeClass}`}>
                {badgeOutcome.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/10 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                {lang === 'ro' ? 'Data Generării:' : 'Generated At:'}{' '}
                <strong className="text-white">{formatFullDateTime(signal.createdAt, lang)}</strong>
              </span>
            </div>
          </div>

          {/* Synchronized Live P&L Banner */}
          {(() => {
            const pnlData = calculateTradePnLMetrics(signal, user, quotes);
            const isPos = pnlData.pnl > 0;
            const isNeg = pnlData.pnl < 0;
            return (
              <div className="p-3.5 rounded-xl bg-[#091122]/90 border border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-sans font-semibold uppercase text-[11px]">
                    {lang === 'ro' ? 'PNL Curent Sincronizat:' : 'Synchronized P&L:'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${pnlData.accountBadgeStyle}`}>
                    {pnlData.accountBadge}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-black tracking-tight ${
                    isPos
                      ? 'text-emerald-400'
                      : isNeg
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}>
                    {isPos
                      ? `+$${pnlData.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : isNeg
                      ? `-$${Math.abs(pnlData.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '$0.00'}
                  </span>
                  {pnlData.rr !== 0 && (
                    <span className={`text-xs font-bold ${isPos ? 'text-emerald-300' : 'text-rose-300'}`}>
                      ({isPos ? '+' : ''}{pnlData.rr}R)
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Cancellation Reason Banner if Cancelled */}
          {signal.outcomeStatus === 'CANCELLED' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-white shadow-md animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <span>{lang === 'ro' ? 'Motiv Anulare Tradepoint / Ordin:' : 'Trade Cancellation Reason:'}</span>
                  </h4>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    {getCancellationReason(signal, lang)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Trade Parameters Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'ro' ? 'Niveluri & Parametri Tranzacție' : 'Trade Levels & Execution Parameters'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="text-[11px] text-slate-400 font-bold block">{lang === 'ro' ? 'Preț Intrare (Entry)' : 'Entry Price'}</span>
                <span className="text-base font-extrabold text-white font-mono mt-0.5 block">${formatSignalPrice(signal.entryPrice, signal.instrumentId, signal.symbol)}</span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  ${signal.entryRangeMin} - ${signal.entryRangeMax}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-md">
                <span className="text-[11px] text-rose-300 font-bold block">{lang === 'ro' ? 'Stop Loss (SL)' : 'Stop Loss'}</span>
                <span className="text-base font-extrabold text-rose-400 font-mono mt-0.5 block">${formatSignalPrice(signal.stopLoss, signal.instrumentId, signal.symbol)}</span>
                <span className="text-[10px] text-rose-400/80 font-medium block">{lang === 'ro' ? 'Garanție risc fixat' : 'Strict risk limit'}</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 col-span-2 sm:col-span-2 backdrop-blur-md">
                <span className="text-[11px] text-emerald-300 font-bold block">{lang === 'ro' ? 'Ținte Take Profit (TP1 / TP2 / TP3)' : 'Take Profit Targets'}</span>
                <div className="flex items-center gap-3 mt-1 font-mono font-bold text-emerald-300 text-sm">
                  <span>TP1: ${formatSignalPrice(signal.targetPrice1, signal.instrumentId, signal.symbol)}</span>
                  <span className="text-emerald-500/50">•</span>
                  <span>TP2: ${formatSignalPrice(signal.targetPrice2, signal.instrumentId, signal.symbol)}</span>
                  <span className="text-emerald-500/50">•</span>
                  <span className="text-emerald-200">TP3: ${formatSignalPrice(signal.targetPrice3, signal.instrumentId, signal.symbol)}</span>
                </div>
                <span className="text-[10px] text-emerald-400/90 font-medium block mt-0.5">
                  {lang === 'ro' ? 'TP1 mută Stop Loss automat la BreakEven' : 'TP1 automatically triggers BreakEven SL'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1 text-xs text-slate-400 font-mono">
              <div>
                <span>{lang === 'ro' ? 'Raport Risc/Recompensă:' : 'Risk/Reward Ratio:'}</span>{' '}
                <strong className="text-white font-bold">
                  {(() => {
                    const riskAmt = Math.abs(signal.entryPrice - signal.stopLoss);
                    if (riskAmt <= 0) return signal.riskRewardRatio;
                    const r1 = (Math.abs(signal.targetPrice1 - signal.entryPrice) / riskAmt).toFixed(1);
                    const r2 = (Math.abs(signal.targetPrice2 - signal.entryPrice) / riskAmt).toFixed(1);
                    const r3 = (Math.abs(signal.targetPrice3 - signal.entryPrice) / riskAmt).toFixed(1);
                    return `1:${r1} (TP1) • 1:${r2} (TP2) • 1:${r3} (TP3)`;
                  })()}
                </strong>
              </div>
              <div>
                <span>{lang === 'ro' ? 'Grad Încredere Algoritm:' : 'Confidence Score:'}</span>{' '}
                <strong className="text-cyan-400 font-bold">{signal.confidencePercent}%</strong>
              </div>
            </div>

            {signal.atr && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/20 flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] tracking-wider uppercase shrink-0">
                    ATR Volatility
                  </span>
                  <span className="text-indigo-200 font-semibold">
                    {lang === 'ro' 
                      ? `SL & TP calculate dinamic pe baza ATR(14) - Timeframe ${signal.timeframe}:`
                      : `SL & TP dynamically calculated via ATR(14) - Timeframe ${signal.timeframe}:`}
                  </span>
                </div>
                <span className="font-mono font-bold text-indigo-300 bg-white/5 px-2.5 py-0.5 rounded border border-indigo-400/30 text-xs">
                  ATR = ${signal.atr} pts ({signal.atrMultiplierSL || 1.2}x ATR SL)
                </span>
              </div>
            )}

            {/* TP1 & BE Risk Management Callout */}
            {signal.isBeHitAfterTp1 ? (
              <div className="mt-3 p-3.5 rounded-xl bg-emerald-950/60 text-emerald-100 border border-emerald-500/40 shadow-sm flex items-start gap-3 backdrop-blur-md">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                    {lang === 'ro' ? '🎯 TP1 Atins & BE Atins – Trade Închis' : '🎯 TP1 Hit & BE Hit – Trade Closed'}
                  </strong>
                  <p className="text-xs text-emerald-200/90 leading-relaxed font-medium">
                    {lang === 'ro'
                      ? `Odată cu atingerea TP1, s-au închis 70% din poziție cu profit. Prețul a revenit ulterior la nivelul de intrare ($${signal.entryPrice}), activând Break-Even (BE) pe restul de 30%. Poziție închisă pe plus.`
                      : `70% of the position was closed for profit at TP1. Price subsequently retraced to entry level ($${signal.entryPrice}), triggering Break-Even (BE) on the remaining 30%. Trade closed in net profit.`}
                  </p>
                </div>
              </div>
            ) : ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(signal.outcomeStatus || '') ? (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 text-amber-200 border border-amber-500/30 shadow-sm flex items-start gap-3 backdrop-blur-md">
                <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                    {lang === 'ro' ? '🎯 Recomandare Management Risc (TP1 Atins)' : '🎯 Risk Management Recommendation (TP1 Hit)'}
                  </strong>
                  <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                    {lang === 'ro'
                      ? `Odată ce trade-ul a atins TP1 ($${signal.targetPrice1}), se recomandă închiderea a 70% din poziție și mutarea Stop Loss-ului la Break-Even (BE = $${signal.entryPrice}).`
                      : `Once the trade hits TP1 ($${signal.targetPrice1}), it is recommended to close 70% of position and move Stop Loss to Break-Even (BE = $${signal.entryPrice}).`}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Trade Summary */}
          {summaryText && (
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-400/20 backdrop-blur-md">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{lang === 'ro' ? 'Rezumat Setup Tranzacție' : 'Trade Setup Overview'}</span>
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">{summaryText}</p>
            </div>
          )}

          {/* Full Rationale / Trade Generation Explanation */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B1528]/90 via-[#0A1224]/90 to-[#070D1A]/95 text-white shadow-xl border border-white/10 backdrop-blur-xl">
            <h3 className="text-sm font-bold text-amber-300 tracking-wide mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>{lang === 'ro' ? 'Explicația & Logica Generării Semnalului (Rationale)' : 'Trade Generation Rationale & Logic'}</span>
            </h3>

            <div className="space-y-3 text-xs leading-relaxed text-slate-200 font-sans whitespace-pre-line">
              {rationaleText ? (
                rationaleText.split('\n\n').map((paragraph, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#060B18]/70 border border-white/5">
                    {paragraph}
                  </div>
                ))
              ) : (
                <p>{lang === 'ro' ? 'Nu există descriere disponibilă.' : 'No rationale available.'}</p>
              )}
            </div>
          </div>

          {/* Technical Indicators & Key Levels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Indicators */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 backdrop-blur-md">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>{lang === 'ro' ? 'Indicatori Tehnici Evaluati' : 'Evaluated Indicators'}</span>
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">RSI:</span>
                  <span className="font-mono text-white font-bold">{signal.indicators.rsiStatus}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">MACD:</span>
                  <span className="font-mono text-white font-bold">{signal.indicators.macdStatus}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">{lang === 'ro' ? 'Medii Mobile:' : 'Moving Averages:'}</span>
                  <span className="font-mono text-white font-bold">{signal.indicators.movingAverages}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="font-semibold">{lang === 'ro' ? 'Volatilitate:' : 'Volatility:'}</span>
                  <span className="font-mono text-white font-bold">{signal.indicators.volatility}</span>
                </div>
              </div>
            </div>

            {/* Order Flow Analysis Widget */}
            <OrderFlowWidget signal={signal} lang={lang} />

            {/* Key Levels & Macro */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{lang === 'ro' ? 'Niveluri Cheie & Profil Volum' : 'Key Levels & Volume Profile'}</span>
                </h4>

                {/* Volume Profile POC / VAL / VAH */}
                {(() => {
                  const vp = getOrCalculateVolumeProfileLevels(signal);
                  return (
                    <div className="mb-2 pb-2 border-b border-white/10">
                      <span className="text-slate-400 block text-[11px] font-semibold mb-1">
                        {lang === 'ro' ? 'Zona Profil Volum (POC, VAL, VAH):' : 'Volume Profile Area (POC, VAL, VAH):'}
                      </span>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          POC: ${vp.poc}
                        </span>
                        <span className="bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          VAH: ${vp.vah}
                        </span>
                        <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          VAL: ${vp.val}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-rose-400 font-semibold">{lang === 'ro' ? 'Rezistențe:' : 'Resistances:'}</span>
                    <span className="text-slate-200">
                      {signal.keyLevels.resistance.map((r) => `${r}`).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-emerald-400 font-semibold">{lang === 'ro' ? 'Suporturi:' : 'Supports:'}</span>
                    <span className="text-slate-200">
                      {signal.keyLevels.support.map((s) => `${s}`).join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              {signal.macroFactors && signal.macroFactors.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                    <Globe className="w-3 h-3 text-cyan-400" />
                    <span>{lang === 'ro' ? 'Factori Macro' : 'Macro Factors'}</span>
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                    {signal.macroFactors.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#060B18]/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenChartModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenChartModal(signal);
                }}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-emerald-500/20 border border-emerald-400/30 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-emerald-200" />
                <span>{lang === 'ro' ? 'Grafic Tehnic TradingView 📈' : 'TradingView Chart 📈'}</span>
              </button>
            )}

            {onOpenCalcModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCalcModal();
                }}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-indigo-500/20 border border-indigo-400/30 cursor-pointer"
              >
                <Calculator className="w-4 h-4 text-amber-300" />
                <span>{lang === 'ro' ? 'Calculează Lotul & Risc' : 'Calculate Risk & Lot'}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            {lang === 'ro' ? 'Închide' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
