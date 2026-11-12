import React, { useState } from 'react';
import { DailyMacroBriefing } from '../types';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Globe,
  RefreshCw,
  Clock,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Sparkles,
  BarChart3,
  DollarSign,
  Coins,
  ArrowRight,
} from 'lucide-react';

interface DailyMacroBriefingCardProps {
  briefing: DailyMacroBriefing | null;
  isLoading: boolean;
  lang: 'ro' | 'en';
  onRefresh: () => void;
  onOpenModal?: () => void;
}

export const DailyMacroBriefingCard: React.FC<DailyMacroBriefingCardProps> = ({
  briefing,
  isLoading,
  lang,
  onRefresh,
  onOpenModal,
}) => {
  const [activeTab, setActiveTab] = useState<'yesterday' | 'indices' | 'gold' | 'forex' | 'catalysts'>('yesterday');

  if (!briefing && isLoading) {
    return (
      <div className="bg-[#0B1326]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 text-center animate-pulse shadow-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-3">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>{lang === 'ro' ? 'Generare raport macroeconomic zilnic în timp real...' : 'Generating real-time daily macro briefing...'}</span>
        </div>
        <p className="text-xs text-slate-400">
          {lang === 'ro' ? 'Preluare date Forex Factory și cotații live...' : 'Fetching Forex Factory events and live quotes...'}
        </p>
      </div>
    );
  }

  if (!briefing) return null;

  const isRo = lang === 'ro';

  // Sentiment badge helpers
  const sentimentConfig = {
    RISK_ON: {
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
      labelRo: 'Risk-On (Apetit la Risc)',
      labelEn: 'Risk-On (Bullish Sentiment)',
    },
    RISK_OFF: {
      bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
      dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]',
      labelRo: 'Risk-Off (Aversiune la Risc)',
      labelEn: 'Risk-Off (Cautious Sentiment)',
    },
    NEUTRAL: {
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
      labelRo: 'Neutru / Consolidare',
      labelEn: 'Neutral / Range Consolidation',
    },
  }[briefing.marketSentiment];

  const getBiasBadge = (bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => {
    if (bias === 'BULLISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          {isRo ? 'Bullish (Cumpărare)' : 'Bullish'}
        </span>
      );
    }
    if (bias === 'BEARISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <TrendingDown className="w-3 h-3 text-rose-400" />
          {isRo ? 'Bearish (Vânzare)' : 'Bearish'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <Activity className="w-3 h-3 text-amber-400" />
        {isRo ? 'Neutru' : 'Neutral'}
      </span>
    );
  };

  return (
    <div className="bg-[#0B1326]/90 backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_15px_40px_rgba(0,0,0,0.5)] mb-8 relative overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-indigo-600/20 to-cyan-500/30 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/30">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">
                {isRo ? 'RAPORT INSTITUȚIONAL ZILNIC' : 'DAILY INSTITUTIONAL BRIEFING'}
              </span>
              <span className="text-white/30">•</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {new Date(briefing.timestamp).toLocaleTimeString(isRo ? 'ro-RO' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {isRo ? briefing.titleRo : briefing.titleEn}
            </h2>
          </div>
        </div>

        {/* Action Controls & Sentiment Badge */}
        <div className="flex items-center gap-2.5 self-start md:self-center">
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${sentimentConfig.bg}`}>
            <span className={`w-2 h-2 rounded-full ${sentimentConfig.dot}`} />
            <span>{isRo ? sentimentConfig.labelRo : sentimentConfig.labelEn}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title={isRo ? 'Actualizează raportul' : 'Refresh briefing'}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">{isRo ? 'Actualizează' : 'Refresh'}</span>
          </button>

          {onOpenModal && (
            <button
              onClick={onOpenModal}
              title={isRo ? 'Afișează ca pop-up' : 'Open in modal'}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRo ? 'Pop-up' : 'Modal'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Tab Navigation Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto py-3.5 scrollbar-thin scrollbar-thumb-white/10 relative z-10 border-b border-white/5">
        <button
          onClick={() => setActiveTab('yesterday')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'yesterday'
              ? 'bg-gradient-to-r from-indigo-500/30 to-indigo-600/30 border border-indigo-400/40 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>{isRo ? '📅 Ce S-a Întâmplat Ieri' : '📅 Yesterday\'s Recap'}</span>
        </button>

        <button
          onClick={() => setActiveTab('indices')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'indices'
              ? 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border border-blue-400/40 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <span>{isRo ? '📈 Indici Astăzi (NQ / SPX / US30)' : '📈 Indices Outlook'}</span>
          {getBiasBadge(briefing.indicesOutlook.bias)}
        </button>

        <button
          onClick={() => setActiveTab('gold')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'gold'
              ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border border-amber-400/40 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <span>{isRo ? '🟡 Aur Astăzi (XAU/USD)' : '🟡 Gold Spot (XAU/USD)'}</span>
          {getBiasBadge(briefing.goldOutlook.bias)}
        </button>

        <button
          onClick={() => setActiveTab('forex')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'forex'
              ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border border-emerald-400/40 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>{isRo ? '💱 Piața Forex Astăzi' : '💱 FX Markets Today'}</span>
        </button>

        <button
          onClick={() => setActiveTab('catalysts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'catalysts'
              ? 'bg-gradient-to-r from-rose-500/30 to-orange-500/30 border border-rose-400/40 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/5'
          }`}
        >
          <Zap className="w-4 h-4 text-orange-400" />
          <span>{isRo ? '⚡ Știri & Catalizatori Astăzi' : '⚡ Today\'s News Catalysts'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-bold border border-rose-500/40">
            {briefing.todayCatalysts.length}
          </span>
        </button>
      </div>

      {/* Tab Content Display */}
      <div className="pt-5 relative z-10">
        {/* TAB 1: YESTERDAY RECAP */}
        {activeTab === 'yesterday' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2 mb-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                <span>{isRo ? 'Rezumatul Zilei Anterioare' : 'Yesterday\'s Executive Recap'}</span>
              </div>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
                {isRo ? briefing.yesterdayRecap.summaryRo : briefing.yesterdayRecap.summaryEn}
              </p>
            </div>

            {/* Yesterday Key Events Table */}
            {briefing.yesterdayRecap.keyEventsYesterday.length > 0 && (
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>{isRo ? 'Știri Economice & Date Publicate Ieri (Forex Factory)' : 'Economic Data Released Yesterday (Forex Factory)'}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {briefing.yesterdayRecap.keyEventsYesterday.map((ev, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/10 text-white">
                            {ev.currency}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ev.impact === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : ev.impact === 'MEDIUM'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                            }`}
                          >
                            {ev.impact}
                          </span>
                        </div>
                        {ev.actual && (
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {isRo ? 'Real:' : 'Act:'} {ev.actual}
                          </span>
                        )}
                      </div>

                      <h5 className="text-xs sm:text-sm font-semibold text-white mb-1">
                        {isRo ? ev.titleRo : ev.titleEn}
                      </h5>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-2 font-mono">
                        {ev.forecast && <span>{isRo ? 'Estimare:' : 'Fcst:'} <span className="text-slate-300">{ev.forecast}</span></span>}
                        {ev.previous && <span>{isRo ? 'Anterior:' : 'Prev:'} <span className="text-slate-300">{ev.previous}</span></span>}
                      </div>

                      <p className="text-xs text-slate-300/90 leading-snug bg-white/[0.02] p-2 rounded-lg border border-white/5">
                        <strong className="text-cyan-300 font-semibold">{isRo ? 'Efect:' : 'Impact:'}</strong> {isRo ? ev.effectRo : ev.effectEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market Reaction Note */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-400/20">
              <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                {isRo ? 'Reacția Agregată a Piețelor' : 'Aggregate Market Reaction'}
              </h5>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                {isRo ? briefing.yesterdayRecap.marketReactionRo : briefing.yesterdayRecap.marketReactionEn}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: INDICES OUTLOOK */}
        {activeTab === 'indices' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  {isRo ? 'Privire de Ansamblu • Indici Bursieri' : 'Indices Macro Outlook'}
                </span>
                {getBiasBadge(briefing.indicesOutlook.bias)}
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {isRo ? briefing.indicesOutlook.summaryRo : briefing.indicesOutlook.summaryEn}
              </p>
            </div>

            {/* 3 Indices Cards: Nasdaq, S&P 500, Dow Jones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nasdaq */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#111c38] to-[#0d162d] border border-blue-500/20 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-black text-sm text-white">Nasdaq 100 (NAS100)</span>
                    {briefing.indicesOutlook.nasdaq.currentPrice && (
                      <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        ${Math.round(briefing.indicesOutlook.nasdaq.currentPrice).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-3 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 font-semibold">{isRo ? 'Suport:' : 'Support:'}</span>
                      <span className="font-mono font-bold text-emerald-300">{briefing.indicesOutlook.nasdaq.supportLevel}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <span className="text-rose-400 font-semibold">{isRo ? 'Rezistență:' : 'Resistance:'}</span>
                      <span className="font-mono font-bold text-rose-300">{briefing.indicesOutlook.nasdaq.resistanceLevel}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    <strong className="text-white block mb-0.5">{isRo ? 'Mișcare Așteptată Astăzi:' : 'Expected Move Today:'}</strong>
                    {isRo ? briefing.indicesOutlook.nasdaq.expectedMoveRo : briefing.indicesOutlook.nasdaq.expectedMoveEn}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  <span className="text-blue-300 font-semibold">{isRo ? 'Focus cheie: ' : 'Key focus: '}</span>
                  {isRo ? briefing.indicesOutlook.nasdaq.keyFocusRo : briefing.indicesOutlook.nasdaq.keyFocusEn}
                </div>
              </div>

              {/* S&P 500 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#111c38] to-[#0d162d] border border-indigo-500/20 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-black text-sm text-white">S&P 500 (SPX500)</span>
                    {briefing.indicesOutlook.spx500.currentPrice && (
                      <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        ${Math.round(briefing.indicesOutlook.spx500.currentPrice).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-3 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 font-semibold">{isRo ? 'Suport:' : 'Support:'}</span>
                      <span className="font-mono font-bold text-emerald-300">{briefing.indicesOutlook.spx500.supportLevel}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <span className="text-rose-400 font-semibold">{isRo ? 'Rezistență:' : 'Resistance:'}</span>
                      <span className="font-mono font-bold text-rose-300">{briefing.indicesOutlook.spx500.resistanceLevel}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    <strong className="text-white block mb-0.5">{isRo ? 'Mișcare Așteptată Astăzi:' : 'Expected Move Today:'}</strong>
                    {isRo ? briefing.indicesOutlook.spx500.expectedMoveRo : briefing.indicesOutlook.spx500.expectedMoveEn}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  <span className="text-indigo-300 font-semibold">{isRo ? 'Focus cheie: ' : 'Key focus: '}</span>
                  {isRo ? briefing.indicesOutlook.spx500.keyFocusRo : briefing.indicesOutlook.spx500.keyFocusEn}
                </div>
              </div>

              {/* Dow Jones */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#111c38] to-[#0d162d] border border-cyan-500/20 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-black text-sm text-white">Dow Jones (US30)</span>
                    {briefing.indicesOutlook.dowJones.currentPrice && (
                      <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        ${Math.round(briefing.indicesOutlook.dowJones.currentPrice).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-3 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 font-semibold">{isRo ? 'Suport:' : 'Support:'}</span>
                      <span className="font-mono font-bold text-emerald-300">{briefing.indicesOutlook.dowJones.supportLevel}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <span className="text-rose-400 font-semibold">{isRo ? 'Rezistență:' : 'Resistance:'}</span>
                      <span className="font-mono font-bold text-rose-300">{briefing.indicesOutlook.dowJones.resistanceLevel}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    <strong className="text-white block mb-0.5">{isRo ? 'Mișcare Așteptată Astăzi:' : 'Expected Move Today:'}</strong>
                    {isRo ? briefing.indicesOutlook.dowJones.expectedMoveRo : briefing.indicesOutlook.dowJones.expectedMoveEn}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  <span className="text-cyan-300 font-semibold">{isRo ? 'Focus cheie: ' : 'Key focus: '}</span>
                  {isRo ? briefing.indicesOutlook.dowJones.keyFocusRo : briefing.indicesOutlook.dowJones.keyFocusEn}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GOLD OUTLOOK */}
        {activeTab === 'gold' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-[#111c38] to-yellow-500/10 border border-amber-400/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      {isRo ? 'Piața Aurului Spot (XAU/USD)' : 'Spot Gold (XAU/USD)'}
                    </h3>
                    <span className="text-xs text-amber-300 font-mono font-semibold">
                      {briefing.goldOutlook.currentPrice ? `$${briefing.goldOutlook.currentPrice.toFixed(2)}` : ''}
                    </span>
                  </div>
                </div>
                {getBiasBadge(briefing.goldOutlook.bias)}
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mb-4">
                {isRo ? briefing.goldOutlook.summaryRo : briefing.goldOutlook.summaryEn}
              </p>

              {/* Levels & Expected Move */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    {isRo ? 'Niveluri Cheie Intraday (Pivot S/R)' : 'Key Intraday Pivot Levels'}
                  </span>
                  <div className="flex justify-between text-xs py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-emerald-400 font-semibold">{isRo ? 'Suport de Bază:' : 'Primary Support:'}</span>
                    <span className="font-mono font-bold text-emerald-300">{briefing.goldOutlook.supportLevel}</span>
                  </div>
                  <div className="flex justify-between text-xs py-1.5 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="text-rose-400 font-semibold">{isRo ? 'Rezistență Cheie:' : 'Key Resistance:'}</span>
                    <span className="font-mono font-bold text-rose-300">{briefing.goldOutlook.resistanceLevel}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                    {isRo ? 'Mișcare Așteptată Astăzi' : 'Expected Direction Today'}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isRo ? briefing.goldOutlook.expectedMoveRo : briefing.goldOutlook.expectedMoveEn}
                  </p>
                </div>
              </div>

              {/* Macro Drivers */}
              <div className="mt-4 pt-3 border-t border-amber-500/20 text-xs text-slate-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-200">{isRo ? 'Catalizatori & Driveri Macro: ' : 'Macro Drivers: '}</strong>
                  <span>{isRo ? briefing.goldOutlook.macroDriversRo : briefing.goldOutlook.macroDriversEn}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FOREX OUTLOOK */}
        {activeTab === 'forex' && (
          <div className="space-y-5 animate-fadeIn">
            {/* DXY Summary */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>{isRo ? 'Context Valutar & Dolarul American (DXY)' : 'FX Context & US Dollar Index (DXY)'}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {briefing.forexOutlook.bias}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {isRo ? briefing.forexOutlook.dxySummaryRo : briefing.forexOutlook.dxySummaryEn}
              </p>
            </div>

            {/* 3 Major FX Pairs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* EUR/USD */}
              <div className="p-4 rounded-xl bg-[#111c38]/70 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">EUR / USD</span>
                  {briefing.forexOutlook.eurusd.currentPrice && (
                    <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {briefing.forexOutlook.eurusd.currentPrice.toFixed(4)}
                    </span>
                  )}
                </div>
                <div className="space-y-1 mb-2.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>{isRo ? 'Suport:' : 'Support:'}</span>
                    <span className="font-mono text-emerald-400 font-semibold">{briefing.forexOutlook.eurusd.supportLevel}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRo ? 'Rezistență:' : 'Resistance:'}</span>
                    <span className="font-mono text-rose-400 font-semibold">{briefing.forexOutlook.eurusd.resistanceLevel}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  {isRo ? briefing.forexOutlook.eurusd.expectedMoveRo : briefing.forexOutlook.eurusd.expectedMoveEn}
                </p>
              </div>

              {/* GBP/USD */}
              <div className="p-4 rounded-xl bg-[#111c38]/70 border border-teal-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">GBP / USD</span>
                  {briefing.forexOutlook.gbpusd.currentPrice && (
                    <span className="font-mono text-xs font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded">
                      {briefing.forexOutlook.gbpusd.currentPrice.toFixed(4)}
                    </span>
                  )}
                </div>
                <div className="space-y-1 mb-2.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>{isRo ? 'Suport:' : 'Support:'}</span>
                    <span className="font-mono text-emerald-400 font-semibold">{briefing.forexOutlook.gbpusd.supportLevel}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRo ? 'Rezistență:' : 'Resistance:'}</span>
                    <span className="font-mono text-rose-400 font-semibold">{briefing.forexOutlook.gbpusd.resistanceLevel}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  {isRo ? briefing.forexOutlook.gbpusd.expectedMoveRo : briefing.forexOutlook.gbpusd.expectedMoveEn}
                </p>
              </div>

              {/* USD/JPY */}
              <div className="p-4 rounded-xl bg-[#111c38]/70 border border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">USD / JPY</span>
                  {briefing.forexOutlook.usdjpy.currentPrice && (
                    <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">
                      ¥{briefing.forexOutlook.usdjpy.currentPrice.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="space-y-1 mb-2.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>{isRo ? 'Suport:' : 'Support:'}</span>
                    <span className="font-mono text-emerald-400 font-semibold">{briefing.forexOutlook.usdjpy.supportLevel}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRo ? 'Rezistență:' : 'Resistance:'}</span>
                    <span className="font-mono text-rose-400 font-semibold">{briefing.forexOutlook.usdjpy.resistanceLevel}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  {isRo ? briefing.forexOutlook.usdjpy.expectedMoveRo : briefing.forexOutlook.usdjpy.expectedMoveEn}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TODAY'S CATALYSTS */}
        {activeTab === 'catalysts' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>{isRo ? 'Evenimente programate pentru astăzi (Forex Factory feed):' : 'Key events scheduled for today (Forex Factory feed):'}</span>
              <span className="text-orange-400 font-semibold">{briefing.todayCatalysts.length} {isRo ? 'evenimente monitorizate' : 'tracked events'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {briefing.todayCatalysts.map((cat, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/10 text-white">
                          {cat.currency}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cat.impact === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : cat.impact === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                          }`}
                        >
                          {cat.impact}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {cat.time}
                      </span>
                    </div>

                    <h5 className="text-xs sm:text-sm font-bold text-white mb-1.5">
                      {isRo ? cat.titleRo : cat.titleEn}
                    </h5>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-2 font-mono">
                      {cat.forecast && <span>{isRo ? 'Prognoză:' : 'Forecast:'} <span className="text-slate-200 font-semibold">{cat.forecast}</span></span>}
                      {cat.previous && <span>{isRo ? 'Anterior:' : 'Previous:'} <span className="text-slate-200 font-semibold">{cat.previous}</span></span>}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 text-xs text-slate-300/90 leading-snug bg-white/[0.02] p-2 rounded-lg">
                    <strong className="text-orange-300 font-semibold block mb-0.5">{isRo ? 'Așteptări Instituționale:' : 'Institutional Expectation:'}</strong>
                    {isRo ? cat.whatToExpectRo : cat.whatToExpectEn}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
