import React, { useState } from 'react';
import { DailyMacroBriefing } from '../types';
import {
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Zap,
  ArrowRight,
  Clock,
  BarChart3,
  Coins,
  DollarSign,
  Newspaper,
  CheckCircle2,
} from 'lucide-react';
import { DailyMacroBriefingCard } from './DailyMacroBriefingCard';

interface DailyMacroBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
  briefing: DailyMacroBriefing | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToMacro: () => void;
}

export const DailyMacroBriefingModal: React.FC<DailyMacroBriefingModalProps> = ({
  isOpen,
  onClose,
  lang,
  briefing,
  isLoading,
  onRefresh,
  onNavigateToMacro,
}) => {
  const [showFullReport, setShowFullReport] = useState(false);

  if (!isOpen) return null;

  const isRo = lang === 'ro';

  // Sentiment config
  const sentiment = briefing?.marketSentiment || 'NEUTRAL';
  const sentimentDetails = {
    RISK_ON: {
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      textRo: 'Risk-On (Sentiment Pozitiv)',
      textEn: 'Risk-On (Constructive Bias)',
    },
    RISK_OFF: {
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      textRo: 'Risk-Off (Aversiune la Risc)',
      textEn: 'Risk-Off (Cautious Bias)',
    },
    NEUTRAL: {
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      textRo: 'Neutru / Consolidare',
      textEn: 'Neutral / Range Consolidation',
    },
  }[sentiment];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      {/* Outer Modal Container */}
      <div className="relative w-full max-w-4xl bg-[#090F1F] border border-white/15 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Gradient Specular Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-white/10 flex items-start justify-between gap-4 bg-[#0B1428]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-indigo-600/20 to-cyan-400/30 border border-indigo-400/40 flex items-center justify-center shadow-lg shadow-indigo-900/40 shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-wider text-cyan-400">
                  {isRo ? 'RAPORT MATINAL DE DESCHIDERE' : 'MORNING MARKET BRIEFING'}
                </span>
                <span className="text-white/30">•</span>
                <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full border ${sentimentDetails.color}`}>
                  {isRo ? sentimentDetails.textRo : sentimentDetails.textEn}
                </span>
              </div>
              <h3 className="text-base sm:text-xl font-black text-white tracking-tight">
                {briefing ? (isRo ? briefing.titleRo : briefing.titleEn) : (isRo ? 'Raport Macro Zilnic' : 'Daily Macro Briefing')}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-400 hover:text-white transition-all border border-white/5"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm font-sans flex-1 scrollbar-thin scrollbar-thumb-white/10">
          {isLoading && !briefing ? (
            <div className="py-16 text-center">
              <Activity className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-300 font-medium">
                {isRo ? 'Generare raport macroeconomic live...' : 'Compiling live macroeconomic briefing...'}
              </p>
            </div>
          ) : briefing ? (
            <>
              {/* Full Tabbed View OR Compact First-Glance Overview */}
              {showFullReport ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      {isRo ? 'Raport Detaliat pe Categorii' : 'Comprehensive Category Report'}
                    </span>
                    <button
                      onClick={() => setShowFullReport(false)}
                      className="text-xs text-cyan-300 hover:text-cyan-200 underline font-medium"
                    >
                      {isRo ? '← Înapoi la Rezumatul Rapid' : '← Back to Executive Summary'}
                    </button>
                  </div>
                  <DailyMacroBriefingCard
                    briefing={briefing}
                    isLoading={isLoading}
                    lang={lang}
                    onRefresh={onRefresh}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Yesterday's Recap Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                      <Calendar className="w-4 h-4" />
                      <span>{isRo ? '1. Ce S-a Întâmplat Ieri & Evenimente Cheie' : '1. What Happened Yesterday & Key Events'}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {isRo ? briefing.yesterdayRecap.summaryRo : briefing.yesterdayRecap.summaryEn}
                    </p>

                    {/* Yesterday Highlights */}
                    {briefing.yesterdayRecap.keyEventsYesterday.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {briefing.yesterdayRecap.keyEventsYesterday.slice(0, 2).map((ev, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-semibold text-white">{isRo ? ev.titleRo : ev.titleEn}</span>
                              {ev.actual && <span className="text-emerald-400 font-mono font-bold">{ev.actual}</span>}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight">
                              {isRo ? ev.effectRo : ev.effectEn}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expected Moves Today Grid (Indices, Gold, Forex) */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white mb-2.5 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>{isRo ? '2. Ce Mișcări Așteptăm Astăzi pe Piețe' : '2. Expected Market Moves Today'}</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Indices Outlook Box */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-blue-300 flex items-center gap-1">
                              <BarChart3 className="w-3.5 h-3.5" />
                              {isRo ? 'Indici Bursieri' : 'Indices'}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                              {briefing.indicesOutlook.bias}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-300 leading-snug line-clamp-4">
                            {isRo ? briefing.indicesOutlook.nasdaq.expectedMoveRo : briefing.indicesOutlook.nasdaq.expectedMoveEn}
                          </p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                          <span>{isRo ? 'Suport NAS100: ' : 'NAS100 Sup: '}</span>
                          <span className="text-emerald-400 font-bold">{briefing.indicesOutlook.nasdaq.supportLevel}</span>
                        </div>
                      </div>

                      {/* Gold Outlook Box */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/20 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-amber-300 flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5" />
                              {isRo ? 'Aur Spot (XAU)' : 'Gold Spot'}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                              {briefing.goldOutlook.bias}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-300 leading-snug line-clamp-4">
                            {isRo ? briefing.goldOutlook.expectedMoveRo : briefing.goldOutlook.expectedMoveEn}
                          </p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                          <span>{isRo ? 'Interval XAU: ' : 'XAU Range: '}</span>
                          <span className="text-amber-400 font-bold">{briefing.goldOutlook.supportLevel.split(' - ')[0]} - {briefing.goldOutlook.resistanceLevel.split(' - ')[0]}</span>
                        </div>
                      </div>

                      {/* Forex Outlook Box */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-emerald-300 flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              {isRo ? 'Piața Forex' : 'Forex (FX)'}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              EUR/USD
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-300 leading-snug line-clamp-4">
                            {isRo ? briefing.forexOutlook.eurusd.expectedMoveRo : briefing.forexOutlook.eurusd.expectedMoveEn}
                          </p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                          <span>{isRo ? 'EUR/USD Rez: ' : 'EUR/USD Res: '}</span>
                          <span className="text-rose-400 font-bold">{briefing.forexOutlook.eurusd.resistanceLevel}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Today's Key News Spotlight */}
                  {briefing.todayCatalysts.length > 0 && (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{isRo ? '3. Știri & Catalizatori Astăzi (Forex Factory)' : '3. Today\'s Top Catalysts'}</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {briefing.todayCatalysts.length} {isRo ? 'evenimente' : 'events'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {briefing.todayCatalysts.slice(0, 3).map((cat, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20 border border-white/5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white font-mono">
                                {cat.currency}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  cat.impact === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {cat.impact}
                              </span>
                              <span className="font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-md">
                                {isRo ? cat.titleRo : cat.titleEn}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono shrink-0">
                              {cat.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toggle Full Report Link */}
                  <div className="text-center pt-1">
                    <button
                      onClick={() => setShowFullReport(true)}
                      className="text-xs text-indigo-300 hover:text-indigo-200 underline font-medium"
                    >
                      {isRo ? '📖 Deschide Raportul Complet cu cele 5 Taburi Detaliate' : '📖 View the Full 5-Tab In-Depth Report'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 pt-3 border-t border-white/10 bg-[#0B1428]/90 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-all text-center"
          >
            {isRo ? 'Am Înțeles • Închide' : 'Dismiss • Close'}
          </button>

          <button
            onClick={() => {
              onClose();
              onNavigateToMacro();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all border border-indigo-400/30"
          >
            <Newspaper className="w-4 h-4 text-cyan-200" />
            <span>{isRo ? 'Mergi la Pagina Știri & Macro' : 'Go to Macro & News Page'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
