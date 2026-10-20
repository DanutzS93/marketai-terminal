import React, { useState, useEffect } from 'react';
import { Newspaper, Calendar, Sparkles, Brain, ArrowUpRight, ArrowDownRight, Clock, RefreshCw, Send, CheckCircle2, ShieldAlert, Lightbulb, BookOpen, ShieldCheck, HelpCircle, Globe } from 'lucide-react';
import { InstrumentId } from '../types';

interface MacroNewsSectionProps {
  selectedInstrument: InstrumentId;
  lang: 'ro' | 'en';
}

interface FinbertResult {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
  confidencePercent: number;
  isAnnounced?: boolean;
  metricsUsed?: {
    previous?: string;
    forecast?: string;
    actual?: string | null;
    status?: string;
  };
  probabilities: {
    positive: number;
    negative: number;
    neutral: number;
  };
  unannouncedScenarios?: {
    ifPositiveSurprise: {
      conditionRo: string;
      conditionEn: string;
      probabilityPercent: number;
      impactRo: string;
      impactEn: string;
      assetEffects?: {
        NAS100?: string;
        US30?: string;
        XAUUSD?: string;
      };
    };
    ifNegativeSurprise: {
      conditionRo: string;
      conditionEn: string;
      probabilityPercent: number;
      impactRo: string;
      impactEn: string;
      assetEffects?: {
        NAS100?: string;
        US30?: string;
        XAUUSD?: string;
      };
    };
    ifInLineWithForecast: {
      conditionRo: string;
      conditionEn: string;
      probabilityPercent: number;
      impactRo: string;
      impactEn: string;
      assetEffects?: {
        NAS100?: string;
        US30?: string;
        XAUUSD?: string;
      };
    };
  };
  beginnerConceptRo?: string;
  beginnerConceptEn?: string;
  economicMechanismRo?: string;
  economicMechanismEn?: string;
  summaryRo: string;
  summaryEn?: string;
  keyTopics: string[];
  beginnerGlossary?: { term: string; termEn?: string; definitionRo: string; definitionEn?: string }[];
  riskTipRo?: string;
  riskTipEn?: string;
  assetImpact: {
    [key: string]: {
      direction: string;
      impact: string;
      reasoningRo: string;
      reasoningEn?: string;
      simpleExplanationRo?: string;
      simpleExplanationEn?: string;
      beginnerTipRo?: string;
      beginnerTipEn?: string;
    };
  };
}

// Translation helper for institutional financial reasoning and concepts
const translateFinancialText = (text: string | undefined, lang: 'ro' | 'en'): string => {
  if (!text) return '';
  if (lang === 'ro') return text;

  const t = text.trim();
  if (/costurile.*mai mici de finan.*cresc evalu.*companiilor/i.test(t) || /costurile de finanțare mai mici cresc evaluarea companiilor de creștere/i.test(t)) {
    return 'Lower financing costs boost the valuation of growth companies.';
  }
  if (/banii ieftini ajut.*companiile tech/i.test(t)) {
    return 'Cheap capital helps tech companies invest and expand.';
  }
  if (/cump.*ac.*uni.*relaxare monetar/i.test(t)) {
    return 'Favor equities during monetary easing periods.';
  }
  if (/sentimentul general.*beneficiaz.*blue-chip/i.test(t)) {
    return 'Improved broader market sentiment benefits blue-chip equities.';
  }
  if (/optimismul general ajut.*toate sectoarele industriale/i.test(t)) {
    return 'Broad market optimism supports diversified industrial sectors.';
  }
  if (/monitorizeaz.*indicii industriali/i.test(t)) {
    return 'Monitor industrial indices for stability and trend confirmation.';
  }
  if (/dolarul mai slab.*dob.*aurul mai atractiv/i.test(t) || /dolarul mai slab si dob/i.test(t)) {
    return 'A softer US Dollar and lower interest rates make Gold more attractive.';
  }
  if (/c.*nd dob.*sau dolarul scad.*cump.*r.* aur/i.test(t)) {
    return 'When interest rates or the Dollar drop, investors purchase Gold as a safe-haven asset.';
  }
  if (/a.*tepta.*i stabilizarea spread-ului/i.test(t)) {
    return 'Wait for broker spreads to normalize before entering Gold (XAUUSD).';
  }
  if (/monitorizeaz.*randamentele titlurilor de stat/i.test(t)) {
    return 'Monitor 10-year US Treasury benchmark yields.';
  }
  if (/companiile cresc mai u.*or c.*nd.*mprumuturile sunt mai ieftine/i.test(t)) {
    return 'Companies expand faster when borrowing costs are cheaper.';
  }
  if (/evaluare pe baza diferen.*ei dintre anterior.*i estimat/i.test(t)) {
    return 'Evaluation based on the variance between previous numbers and consensus forecasts.';
  }

  return text;
};

interface EconomicEvent {
  id: string;
  title: string;
  titleRo?: string;
  titleEn?: string;
  currency: string;
  country: string;
  impact: string;
  date: string;
  dateRo?: string;
  dateEn?: string;
  status: string;
  forecast: string;
  previous: string;
  actual: string | null;
  unit: string;
  affectedAssets: string[];
  description: string;
  descriptionRo?: string;
  descriptionEn?: string;
  epochMs?: number;
  isToday?: boolean;
}

export const MacroNewsSection: React.FC<MacroNewsSectionProps> = ({ selectedInstrument, lang }) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'finbert'>('calendar');
  const [calendarEvents, setCalendarEvents] = useState<EconomicEvent[]>([]);
  const [usdHighImpactEvents, setUsdHighImpactEvents] = useState<EconomicEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState<'USD' | 'ALL' | 'EUR' | 'GBP'>('USD');
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'MEDIUM_HIGH' | 'HIGH' | 'MEDIUM'>('ALL');
  const [calendarSource, setCalendarSource] = useState<string>('Forex Factory Live Feed');
  const [isWeekendMode, setIsWeekendMode] = useState<boolean>(() => {
    const d = new Date().getDay();
    return d === 6 || d === 0;
  });

  // FinBERT AI state
  const [customNewsText, setCustomNewsText] = useState('');
  const [analyzingFinbert, setAnalyzingFinbert] = useState(false);
  const [finbertAnalysis, setFinbertAnalysis] = useState<FinbertResult | null>(null);
  const [finbertError, setFinbertError] = useState<string | null>(null);
  const [analyzedHeadline, setAnalyzedHeadline] = useState('');

  // Fetch updated economic calendar
  const fetchCalendar = async () => {
    setLoadingCalendar(true);
    try {
      const res = await fetch(`/api/economic-calendar?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        if (data.events) {
          setCalendarEvents(data.events);
        }
        if (data.usdHighImpactEvents) {
          setUsdHighImpactEvents(data.usdHighImpactEvents);
        }
        if (data.source) {
          setCalendarSource(data.source);
        }
        if (typeof data.isWeekendMode === 'boolean') {
          setIsWeekendMode(data.isWeekendMode);
        }
      }
    } catch (e) {
      console.warn('Failed to load economic calendar', e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [lang]);

  // Run FinBERT AI news interpretation
  const runFinbertAnalysis = async (
    textToAnalyze: string,
    eventDetails?: {
      title?: string;
      previous?: string;
      forecast?: string;
      actual?: string | null;
      status?: string;
      unit?: string;
      currency?: string;
      affectedAssets?: string[];
    }
  ) => {
    if (!textToAnalyze || textToAnalyze.trim().length < 3) return;
    setAnalyzingFinbert(true);
    setFinbertError(null);
    setAnalyzedHeadline(eventDetails?.title || textToAnalyze);

    try {
      const res = await fetch('/api/finbert-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          title: eventDetails?.title,
          asset: selectedInstrument,
          lang,
          previous: eventDetails?.previous,
          forecast: eventDetails?.forecast,
          actual: eventDetails?.actual,
          status: eventDetails?.status,
          unit: eventDetails?.unit,
          currency: eventDetails?.currency,
          affectedAssets: eventDetails?.affectedAssets
        }),
      });

      const data = await res.json();
      if (res.ok && data.analysis) {
        setFinbertAnalysis(data.analysis);
        setActiveTab('finbert');
      } else {
        setFinbertError(data.error || (lang === 'ro' ? 'Eroare la analiza FinBERT AI.' : 'Error performing FinBERT AI analysis.'));
      }
    } catch (err: any) {
      setFinbertError(
        lang === 'ro'
          ? 'A apărut o eroare de rețea în timpul analizei FinBERT AI.'
          : 'A network error occurred during FinBERT AI analysis.'
      );
    } finally {
      setAnalyzingFinbert(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-2xl rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl mb-8 w-full overflow-hidden relative glass-specular-top">
      {/* Top Header & Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-cyan-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
              <span>{lang === 'ro' ? 'Evenimente Macro & AI FinBERT' : 'Macro Events & AI FinBERT'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30 flex items-center gap-1">
                <Brain className="w-3 h-3 text-cyan-400" />
                FinBERT Model
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {lang === 'ro'
                ? 'Sistem integrat de analiză a sentimentului financiar NLP (FinBERT) și calendar macroeconomic'
                : 'Integrated NLP Financial Sentiment Analysis (FinBERT) & Macroeconomic Calendar'}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-semibold backdrop-blur-md">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-lg font-mono transition flex items-center gap-1.5 cursor-pointer text-xs ${
              activeTab === 'calendar' ? 'bg-white text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{lang === 'ro' ? 'Calendar Actualizat' : 'Updated Calendar'}</span>
          </button>
          <button
            onClick={() => setActiveTab('finbert')}
            className={`px-3 py-1.5 rounded-lg font-mono transition flex items-center gap-1.5 cursor-pointer text-xs ${
              activeTab === 'finbert' ? 'bg-white text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'ro' ? 'Interpretare AI FinBERT' : 'FinBERT AI Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Quick Interactive FinBERT Query Input */}
      <div className="mb-6 bg-[#0B1428]/80 border border-white/10 p-3.5 rounded-xl backdrop-blur-xl shadow-lg">
        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span>
              {lang === 'ro'
                ? 'Introduceți orice știre sau titlu financiar pentru analiză instantă FinBERT:'
                : 'Enter any news headline or text for instant FinBERT AI analysis:'}
            </span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">NLP FinBERT v2.4</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={
              lang === 'ro'
                ? 'Ex: Fed signals potential rate cut as inflation drops to 2.9%...'
                : 'e.g. Fed signals potential rate cut as inflation drops to 2.9%...'
            }
            value={customNewsText}
            onChange={(e) => setCustomNewsText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runFinbertAnalysis(customNewsText)}
            className="flex-1 bg-[#060B18]/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner font-medium"
          />
          <button
            onClick={() => runFinbertAnalysis(customNewsText)}
            disabled={analyzingFinbert || !customNewsText.trim()}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.25)] border border-cyan-400/30 cursor-pointer"
          >
            {analyzingFinbert ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{lang === 'ro' ? 'Analizează...' : 'Analyzing...'}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{lang === 'ro' ? 'Analiză FinBERT' : 'FinBERT Analysis'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content 1: Economic News Calendar */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Weekend Calendar Mode Banner */}
          {isWeekendMode && (
            <div className="bg-amber-950/40 border border-amber-500/30 p-3.5 rounded-xl flex items-start gap-3 text-xs text-amber-200 shadow-lg backdrop-blur-md">
              <Calendar className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300 flex items-center gap-2 font-mono">
                  <span>
                    {lang === 'ro'
                      ? '🗓️ Program Săptămâna Viitoare & Recapitulare Weekend (Doar Știri High Impact)'
                      : '🗓️ Next Week Outlook & Weekend Recap (High Impact Events Only)'}
                  </span>
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-amber-500/30">
                    Weekend
                  </span>
                </div>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  {lang === 'ro'
                    ? 'S-a trecut la ziua de sâmbătă. Conform politicii de gestiune a datelor macro, calendarul păstrează exclusiv evenimentele cu Impact Ridicat (HIGH) din săptămâna curentă și afișează programarea știrilor importante pentru Săptămâna Viitoare.'
                    : 'Weekend mode active. According to macro management policy, the calendar retains exclusively High Impact (HIGH) events from the past week and loads the upcoming week’s major news schedule.'}
                </p>
              </div>
            </div>
          )}

          {/* USD High Impact Spotlight Banner */}
          {usdHighImpactEvents.length > 0 && (
            <div className="bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-slate-900/40 border border-rose-500/30 rounded-xl p-3.5 sm:p-4 shadow-lg mb-4 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-2 font-mono">
                    <span>{lang === 'ro' ? '⚡ Evenimente Cheie USD (Forex Factory High Impact)' : '⚡ Key USD Events (Forex Factory High Impact)'}</span>
                    <span className="bg-rose-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                      {usdHighImpactEvents.length} {lang === 'ro' ? 'Evenimente Majore' : 'Major Events'}
                    </span>
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-rose-300 font-mono">
                  {lang === 'ro' ? 'Catalizatori Fed, Dobânzi & Volatilitate Indici (NAS100, US30, SP500, XAUUSD)' : 'Fed Catalysts, Rates & Indices Volatility'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {usdHighImpactEvents.slice(0, 4).map((evt) => {
                  const eventTitle = lang === 'ro' ? (evt.titleRo || evt.title) : (evt.titleEn || evt.title);
                  const eventDate = lang === 'ro' ? (evt.dateRo || evt.date) : (evt.dateEn || evt.date);
                  return (
                    <div key={`spotlight-${evt.id}`} className="bg-[#091122]/90 border border-white/10 rounded-xl p-3 shadow-md flex flex-col justify-between hover:border-rose-500/50 transition">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5 font-mono">
                          <span className="bg-rose-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded">
                            USD HIGH
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {eventDate.split(',')[0]}
                          </span>
                        </div>
                        <p className="font-bold text-xs text-white line-clamp-2 leading-snug mb-2" title={eventTitle}>
                          {eventTitle}
                        </p>
                        <div className="flex items-center justify-between text-[10px] bg-black/40 px-2 py-1 rounded border border-white/10 font-mono mb-2">
                          <span className="text-slate-400">{lang === 'ro' ? 'Est:' : 'Fcst:'} <strong className="text-cyan-300">{evt.forecast || '--'}</strong></span>
                          <span className="text-slate-400">{lang === 'ro' ? 'Ant:' : 'Prev:'} <strong className="text-slate-200">{evt.previous || '--'}</strong></span>
                        </div>
                      </div>
                      <button
                        onClick={() => runFinbertAnalysis(eventTitle + ': ' + (evt.description || ''), {
                          title: eventTitle,
                          previous: evt.previous,
                          forecast: evt.forecast,
                          actual: evt.actual,
                          status: evt.status,
                          unit: evt.unit,
                          currency: evt.currency,
                          affectedAssets: evt.affectedAssets
                        })}
                        className="w-full text-center py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                      >
                        <Brain className="w-3 h-3 text-rose-400" />
                        <span>{lang === 'ro' ? 'Analizează FinBERT' : 'FinBERT AI'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Forex Factory Filter Toolbar */}
          <div className="bg-[#091122]/80 border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs mb-3 backdrop-blur-xl shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              {/* Currency Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-300 text-[11px] font-mono">
                  {lang === 'ro' ? 'VALUTĂ:' : 'CURRENCY:'}
                </span>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setCurrencyFilter('USD')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer font-mono ${
                      currencyFilter === 'USD'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🇺🇸 USD</span>
                    <span className={`text-[9px] px-1 rounded-full ${currencyFilter === 'USD' ? 'bg-rose-800 text-white' : 'bg-white/10 text-slate-300'}`}>
                      {calendarEvents.filter(e => e.currency === 'USD').length || 26}
                    </span>
                  </button>
                  <button
                    onClick={() => setCurrencyFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer font-mono ${
                      currencyFilter === 'ALL'
                        ? 'bg-white text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{lang === 'ro' ? 'Toate' : 'All'}</span>
                    <span className={`text-[9px] px-1 rounded-full ${currencyFilter === 'ALL' ? 'bg-slate-300 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
                      {calendarEvents.length || 105}
                    </span>
                  </button>
                  <button
                    onClick={() => setCurrencyFilter('EUR')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer font-mono ${
                      currencyFilter === 'EUR'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🇪🇺 EUR</span>
                    <span className={`text-[9px] px-1 rounded-full ${currencyFilter === 'EUR' ? 'bg-indigo-800 text-white' : 'bg-white/10 text-slate-300'}`}>
                      {calendarEvents.filter(e => e.currency === 'EUR').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setCurrencyFilter('GBP')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer font-mono ${
                      currencyFilter === 'GBP'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🇬🇧 GBP</span>
                    <span className={`text-[9px] px-1 rounded-full ${currencyFilter === 'GBP' ? 'bg-indigo-800 text-white' : 'bg-white/10 text-slate-300'}`}>
                      {calendarEvents.filter(e => e.currency === 'GBP').length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Impact Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-300 flex items-center gap-1 text-[11px] font-mono">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'ro' ? 'IMPACT:' : 'IMPACT:'}</span>
                </span>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setImpactFilter('HIGH')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer font-mono ${
                      impactFilter === 'HIGH'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>{lang === 'ro' ? 'Doar High' : 'High Only'}</span>
                  </button>
                  <button
                    onClick={() => setImpactFilter('MEDIUM_HIGH')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer font-mono ${
                      impactFilter === 'MEDIUM_HIGH'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>{lang === 'ro' ? 'High & Med' : 'High & Med'}</span>
                  </button>
                  <button
                    onClick={() => setImpactFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer font-mono ${
                      impactFilter === 'ALL'
                        ? 'bg-white text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{lang === 'ro' ? 'Toate' : 'All'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <span>{lang === 'ro' ? 'Flux Live Forex Factory' : (calendarSource || 'Forex Factory Live Feed')}</span>
              </span>
              <button
                onClick={fetchCalendar}
                className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 font-bold text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingCalendar ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{lang === 'ro' ? 'Sincronizează' : 'Sync'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(calendarEvents.length > 0 ? calendarEvents.filter((evt) => {
              if (currencyFilter !== 'ALL' && evt.currency !== currencyFilter) return false;
              if (impactFilter === 'HIGH') return evt.impact === 'HIGH';
              if (impactFilter === 'MEDIUM') return evt.impact === 'MEDIUM';
              if (impactFilter === 'MEDIUM_HIGH') return evt.impact === 'HIGH' || evt.impact === 'MEDIUM';
              return true;
            }) : [
              {
                id: '1',
                title: lang === 'ro' ? 'Decizia FOMC privind Rata Dobânzii de Referință Fed' : 'FOMC Federal Funds Rate Decision',
                titleRo: 'Decizia FOMC privind Rata Dobânzii de Referință Fed',
                titleEn: 'FOMC Federal Funds Rate Decision',
                impact: 'HIGH',
                date: lang === 'ro' ? 'Azi, 21:00 EST' : 'Today, 21:00 EST',
                dateRo: 'Azi, 21:00 EST',
                dateEn: 'Today, 21:00 EST',
                forecast: '5.25%',
                previous: '5.50%',
                actual: null,
                currency: 'USD',
                country: 'US',
                status: 'UPCOMING',
                unit: '%',
                affectedAssets: ['NAS100', 'US30', 'XAUUSD'],
                description: lang === 'ro'
                  ? 'Rezerva Federală decide traiectoria ratei de referință. O menținere sau tăiere sprijină Nasdaq 100 și Aurul.'
                  : 'The Federal Reserve decides the benchmark interest rate trajectory. A hold or cut supports Nasdaq 100 and Gold.',
                descriptionRo: 'Rezerva Federală decide traiectoria ratei de referință. O menținere sau tăiere sprijină Nasdaq 100 și Aurul.',
                descriptionEn: 'The Federal Reserve decides the benchmark interest rate trajectory. A hold or cut supports Nasdaq 100 and Gold.',
              },
              {
                id: '2',
                title: lang === 'ro' ? 'Indicele Prețurilor de Consum CPI (Inflația YoY SUA)' : 'Consumer Price Index CPI (US YoY Inflation)',
                titleRo: 'Indicele Prețurilor de Consum CPI (Inflația YoY SUA)',
                titleEn: 'Consumer Price Index CPI (US YoY Inflation)',
                impact: 'HIGH',
                date: lang === 'ro' ? 'Joi, 15:30 EST' : 'Thu, 15:30 EST',
                dateRo: 'Joi, 15:30 EST',
                dateEn: 'Thu, 15:30 EST',
                forecast: '2.9%',
                previous: '3.1%',
                actual: null,
                currency: 'USD',
                country: 'US',
                status: 'UPCOMING',
                unit: '%',
                affectedAssets: ['NAS100', 'XAUUSD'],
                description: lang === 'ro'
                  ? 'Inflația mai mică sporește încrederea în relaxarea monetară, stimulând cumpărările pe indici.'
                  : 'Lower inflation boosts confidence in monetary easing, stimulating buying on equity indices.',
                descriptionRo: 'Inflația mai mică sporește încrederea în relaxarea monetară, stimulând cumpărările pe indici.',
                descriptionEn: 'Lower inflation boosts confidence in monetary easing, stimulating buying on equity indices.',
              },
            ]).map((evt) => {
              const eventTitle = lang === 'ro' ? (evt.titleRo || evt.title) : (evt.titleEn || evt.title);
              const eventDescription = lang === 'ro' ? (evt.descriptionRo || evt.description) : (evt.descriptionEn || evt.description);
              const eventDate = lang === 'ro' ? (evt.dateRo || evt.date) : (evt.dateEn || evt.date);
              const isHighImpact = evt.impact === 'HIGH';

              return (
                <div
                  key={evt.id}
                  className={`p-4 rounded-xl border transition shadow-lg relative flex flex-col justify-between backdrop-blur-xl ${
                    isHighImpact
                      ? 'border-rose-500/40 bg-[#1A0B1A]/70 hover:border-rose-400/60'
                      : 'border-white/10 bg-[#0B1428]/80 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 font-mono">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
                        {eventDate}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                          evt.currency === 'USD'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                            : 'bg-white/5 text-slate-300 border-white/10'
                        }`}>
                          {evt.currency}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            isHighImpact
                              ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                              : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {lang === 'ro'
                            ? (evt.impact === 'HIGH' ? 'IMPACT RIDICAT' : evt.impact === 'LOW' ? 'IMPACT REDUS' : 'IMPACT MEDIU')
                            : `${evt.impact} IMPACT`}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-white mb-1.5">{eventTitle}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">{eventDescription}</p>

                    {/* Expected / Previous / Actual Metrics */}
                    <div className="grid grid-cols-3 gap-2 bg-black/40 p-2.5 rounded-lg border border-white/10 text-[11px] mb-3">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase font-mono">{lang === 'ro' ? 'Anterior' : 'Previous'}</span>
                        <span className="font-mono font-semibold text-slate-300">{evt.previous || '--'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase font-mono">{lang === 'ro' ? 'Estimat' : 'Forecast'}</span>
                        <span className="font-mono font-semibold text-indigo-400">{evt.forecast || '--'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase font-mono">{lang === 'ro' ? 'Actual' : 'Actual'}</span>
                        <span className="font-mono font-bold text-emerald-400">{evt.actual || (lang === 'ro' ? 'În așteptare' : 'Pending')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
                    <div className="flex items-center gap-1 font-mono">
                      <span className="text-[10px] text-slate-400 font-semibold">{lang === 'ro' ? 'Active:' : 'Assets:'}</span>
                      {evt.affectedAssets.map((asset) => (
                        <span
                          key={asset}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            selectedInstrument === asset ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {asset}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => runFinbertAnalysis(eventTitle + ': ' + eventDescription, {
                        title: eventTitle,
                        previous: evt.previous,
                        forecast: evt.forecast,
                        actual: evt.actual,
                        status: evt.status,
                        unit: evt.unit,
                        currency: evt.currency,
                        affectedAssets: evt.affectedAssets
                      })}
                      className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 bg-cyan-500/15 hover:bg-cyan-500/25 px-2.5 py-1 rounded-lg border border-cyan-400/30 transition cursor-pointer font-mono"
                    >
                      <Brain className="w-3 h-3 text-cyan-400" />
                      <span>{lang === 'ro' ? 'Analizează FinBERT' : 'Analyze FinBERT'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content 2: FinBERT AI Sentiment Result */}
      {activeTab === 'finbert' && (
        <div className="space-y-4">
          {finbertError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium backdrop-blur-md">
              {finbertError}
            </div>
          )}

          {!finbertAnalysis && !analyzingFinbert && (
            <div className="text-center py-10 bg-white/5 border border-dashed border-white/10 rounded-2xl backdrop-blur-md">
              <Brain className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-bounce" />
              <h4 className="font-bold text-white text-sm">
                {lang === 'ro'
                  ? 'Selectați o știre sau tastați mai sus un titlu financiar'
                  : 'Select a news event or type a financial headline above'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                {lang === 'ro'
                  ? 'Modelul FinBERT AI calculează exact scorul de sentiment (Bullish/Bearish), probabilitățile NLP și impactul direcțional direct pe NAS100, US30 și XAUUSD.'
                  : 'The FinBERT AI model calculates exact sentiment score (Bullish/Bearish), NLP probabilities, and direct impact on NAS100, US30, and XAUUSD.'}
              </p>
            </div>
          )}

          {analyzingFinbert && (
            <div className="text-center py-12 bg-indigo-500/10 border border-indigo-400/20 rounded-2xl backdrop-blur-md">
              <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-spin" />
              <h4 className="font-bold text-white text-sm">
                {lang === 'ro' ? 'FinBERT NLP Motorul Procesează Știrea...' : 'FinBERT NLP Engine Processing News...'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'ro'
                  ? 'Aplicație de analiză a vectorilor semantici pe corpus financiar (Bloomberg/Reuters/FOMC)'
                  : 'Semantic vector analysis application on financial corpus (Bloomberg/Reuters/FOMC)'}
              </p>
            </div>
          )}

          {finbertAnalysis && !analyzingFinbert && (
            <div className="bg-gradient-to-b from-[#0A1224]/90 via-[#080E1C]/90 to-[#040813]/95 text-white rounded-2xl p-5 border border-white/15 shadow-2xl space-y-5 glass-specular-top backdrop-blur-2xl">
              {/* Headline Analyzed */}
              <div className="border-b border-white/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 font-mono">
                    {lang === 'ro' ? 'Știre / Titlu Analizat de FinBERT AI:' : 'News Headline Analyzed by FinBERT AI:'}
                  </span>
                  <p className="text-sm font-semibold text-slate-100 italic">"{analyzedHeadline}"</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-lg text-xs font-bold text-indigo-300 font-mono shadow-xs">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  <span>FinBERT 2.0 NLP</span>
                </div>
              </div>

              {/* Macro Metrics Context Bar (Anterior, Estimat, Actual, Stare) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                    {lang === 'ro' ? 'Anterior (Previous)' : 'Previous'}
                  </span>
                  <span className="font-mono font-semibold text-slate-200">
                    {finbertAnalysis.metricsUsed?.previous || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                    {lang === 'ro' ? 'Estimat (Forecast)' : 'Forecast'}
                  </span>
                  <span className="font-mono font-semibold text-indigo-400">
                    {finbertAnalysis.metricsUsed?.forecast || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                    {lang === 'ro' ? 'Actual (Publicat)' : 'Actual (Released)'}
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(() => {
                      const act = finbertAnalysis.metricsUsed?.actual;
                      if (!act || act === 'În așteptare' || act === 'În așteptare (Neanunțat)' || act === 'Pending') {
                        return lang === 'ro' ? 'În așteptare' : 'Pending';
                      }
                      return act;
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                    {lang === 'ro' ? 'Stare Eveniment' : 'Event Status'}
                  </span>
                  <span className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                    finbertAnalysis.isAnnounced
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {finbertAnalysis.isAnnounced
                      ? (lang === 'ro' ? '✓ ANUNȚAT' : '✓ RELEASED')
                      : (lang === 'ro' ? '⏳ ȚINTĂ / NEANUNȚAT' : '⏳ UPCOMING')}
                  </span>
                </div>
              </div>

              {/* Main Sentiment Card & Probabilities */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {lang === 'ro' ? 'FinBERT Sentiment Principal' : 'Primary FinBERT Sentiment'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xl font-bold font-mono ${
                          finbertAnalysis.sentiment === 'POSITIVE'
                            ? 'text-emerald-400'
                            : finbertAnalysis.sentiment === 'NEGATIVE'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {finbertAnalysis.sentiment}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ({lang === 'ro' ? 'Scor:' : 'Score:'} {finbertAnalysis.score > 0 ? '+' : ''}{finbertAnalysis.score})
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{lang === 'ro' ? 'Încredere Algoritm:' : 'Model Confidence:'}</span>
                    <span className="font-mono font-bold text-indigo-400">{finbertAnalysis.confidencePercent}%</span>
                  </div>
                </div>

                {/* Probabilities Breakdown Bars */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {finbertAnalysis.isAnnounced
                        ? (lang === 'ro' ? 'Distribuție Probabilități FinBERT NLP (Eveniment Anunțat)' : 'FinBERT NLP Probability Breakdown (Released Event)')
                        : (lang === 'ro' ? 'Așteptări Probabilistice de Piață Înainte de Anunț' : 'Pre-Release Market Probability Distribution')}
                    </span>
                    {!finbertAnalysis.isAnnounced && (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                        {lang === 'ro' ? 'Scenarii În Așteptare' : 'Pending Scenarios'}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-emerald-400 mb-0.5">
                      <span>Positive (Bullish)</span>
                      <span>{finbertAnalysis.probabilities.positive}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${finbertAnalysis.probabilities.positive}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-rose-400 mb-0.5">
                      <span>Negative (Bearish)</span>
                      <span>{finbertAnalysis.probabilities.negative}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${finbertAnalysis.probabilities.negative}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-amber-400 mb-0.5">
                      <span>Neutral</span>
                      <span>{finbertAnalysis.probabilities.neutral}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${finbertAnalysis.probabilities.neutral}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditional Volatility Scenarios Card (When Event is Unannounced or Pending) */}
              {finbertAnalysis.unannouncedScenarios && (
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        {lang === 'ro'
                          ? '🎯 Scenarii Probabilistice de Volatilitate (Înainte de Anunțul Oficial)'
                          : '🎯 Probabilistic Volatility Scenarios (Pre-Release Outlook)'}
                      </span>
                    </span>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-mono self-start sm:self-auto">
                      {lang === 'ro' ? 'Ecart fațǎ de Estimat' : 'Forecast Deviation Matrix'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Scenario 1: Positive Surprise */}
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>{lang === 'ro' ? '1. Surpriză Pozitivă' : '1. Positive Surprise'}</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                          {finbertAnalysis.unannouncedScenarios.ifPositiveSurprise.probabilityPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-200">
                        {lang === 'ro'
                          ? finbertAnalysis.unannouncedScenarios.ifPositiveSurprise.conditionRo
                          : finbertAnalysis.unannouncedScenarios.ifPositiveSurprise.conditionEn}
                      </p>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {lang === 'ro'
                          ? finbertAnalysis.unannouncedScenarios.ifPositiveSurprise.impactRo
                          : finbertAnalysis.unannouncedScenarios.ifPositiveSurprise.impactEn}
                      </p>
                    </div>

                    {/* Scenario 2: Negative Surprise */}
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-rose-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          <span>{lang === 'ro' ? '2. Surpriză Negativă' : '2. Negative Surprise'}</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-500/40">
                          {finbertAnalysis.unannouncedScenarios.ifNegativeSurprise.probabilityPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-200">
                        {lang === 'ro'
                          ? finbertAnalysis.unannouncedScenarios.ifNegativeSurprise.conditionRo
                          : finbertAnalysis.unannouncedScenarios.ifNegativeSurprise.conditionEn}
                      </p>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {lang === 'ro'
                          ? finbertAnalysis.unannouncedScenarios.ifNegativeSurprise.impactRo
                          : finbertAnalysis.unannouncedScenarios.ifNegativeSurprise.impactEn}
                      </p>
                    </div>

                    {/* Scenario 3: In Line */}
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{lang === 'ro' ? '3. Conform Estimatului' : '3. In-Line'}</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
                          {finbertAnalysis.unannouncedScenarios.ifInLineWithForecast.probabilityPercent}%
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-200">
                        {lang === 'ro'
                          ? finbertAnalysis.unannouncedScenarios.ifInLineWithForecast.conditionRo
                          : finbertAnalysis.unannouncedScenarios.ifInLineWithForecast.conditionEn}
                      </p>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {lang === 'ro'
                          ? finbertAnalysis.unannouncedScenarios.ifInLineWithForecast.impactRo
                          : finbertAnalysis.unannouncedScenarios.ifInLineWithForecast.impactEn}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 💡 Section 1: Beginner Explanation (Ce înseamnă în viața reală) */}
              {(finbertAnalysis.beginnerConceptRo || finbertAnalysis.beginnerConceptEn) && (
                <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
                    <Lightbulb className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{lang === 'ro' ? '💡 Ghid Explicativ pentru Începători (Ce Înseamnă în Viața Reală)' : '💡 Beginner Guide (What This Means in Real Life)'}</span>
                  </div>
                  <p className="text-xs text-amber-100 leading-relaxed font-medium">
                    {lang === 'ro'
                      ? (finbertAnalysis.beginnerConceptRo || finbertAnalysis.beginnerConceptEn)
                      : (finbertAnalysis.beginnerConceptEn || finbertAnalysis.beginnerConceptRo)}
                  </p>
                </div>
              )}

              {/* ⚡ Section 2: Economic Mechanism (Cum funcționează mecanismul economic) */}
              {(finbertAnalysis.economicMechanismRo || finbertAnalysis.economicMechanismEn) && (
                <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wide">
                    <RefreshCw className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span>{lang === 'ro' ? '⚡ Mecanismul Economic Pas-cu-Pas (Impact Macro)' : '⚡ Step-by-Step Economic Mechanism (Macro Impact)'}</span>
                  </div>
                  <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                    {lang === 'ro'
                      ? (finbertAnalysis.economicMechanismRo || finbertAnalysis.economicMechanismEn)
                      : (finbertAnalysis.economicMechanismEn || finbertAnalysis.economicMechanismRo)}
                  </p>
                </div>
              )}

              {/* 🧠 Section 3: Executive Summary */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <span className="font-bold text-indigo-400 block flex items-center gap-1.5 text-xs uppercase tracking-wide">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  <span>{lang === 'ro' ? 'Sinteză Executivă FinBERT AI:' : 'FinBERT AI Executive Synthesis:'}</span>
                </span>
                <p className="text-slate-200 leading-relaxed font-medium">
                  {lang === 'ro'
                    ? (finbertAnalysis.summaryRo || finbertAnalysis.summaryEn)
                    : (finbertAnalysis.summaryEn || finbertAnalysis.summaryRo)}
                </p>
              </div>

              {/* 📈 Section 4: Detailed Asset Impact Matrix */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{lang === 'ro' ? 'Matrice Impact Direcțional Detaliat pe Fiecare Activ:' : 'Detailed Directional Impact Matrix per Asset:'}</span>
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(finbertAnalysis.assetImpact).map(([assetKey, impactData]) => {
                    const reasoningText = lang === 'ro'
                      ? (impactData.reasoningRo || impactData.reasoningEn)
                      : (impactData.reasoningEn && !/[ăîâșț]/i.test(impactData.reasoningEn) && impactData.reasoningEn !== impactData.reasoningRo
                          ? impactData.reasoningEn
                          : translateFinancialText(impactData.reasoningRo, 'en') || impactData.reasoningEn || impactData.reasoningRo);

                    const simpleExpl = lang === 'ro'
                      ? (impactData.simpleExplanationRo || impactData.simpleExplanationEn)
                      : (impactData.simpleExplanationEn && !/[ăîâșț]/i.test(impactData.simpleExplanationEn) && impactData.simpleExplanationEn !== impactData.simpleExplanationRo
                          ? impactData.simpleExplanationEn
                          : translateFinancialText(impactData.simpleExplanationRo, 'en') || impactData.simpleExplanationEn || impactData.simpleExplanationRo);

                    const beginnerTip = lang === 'ro'
                      ? (impactData.beginnerTipRo || impactData.beginnerTipEn)
                      : (impactData.beginnerTipEn && !/[ăîâșț]/i.test(impactData.beginnerTipEn) && impactData.beginnerTipEn !== impactData.beginnerTipRo
                          ? impactData.beginnerTipEn
                          : translateFinancialText(impactData.beginnerTipRo, 'en') || impactData.beginnerTipEn || impactData.beginnerTipRo);

                    return (
                      <div
                        key={assetKey}
                        className={`p-4 rounded-xl border space-y-2.5 ${
                          impactData.direction === 'BULLISH'
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : impactData.direction === 'BEARISH'
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-base text-white">{assetKey}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-mono">
                              ({lang === 'ro'
                                ? (impactData.impact === 'HIGH' ? 'IMPACT RIDICAT' : impactData.impact === 'LOW' ? 'IMPACT REDUS' : 'IMPACT MEDIU')
                                : `${impactData.impact || 'MEDIUM'} IMPACT`})
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded font-mono ${
                              impactData.direction === 'BULLISH'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : impactData.direction === 'BEARISH'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {lang === 'ro'
                              ? (impactData.direction === 'BULLISH' ? 'BULLISH (CREȘTERE)' : impactData.direction === 'BEARISH' ? 'BEARISH (SCĂDERE)' : 'NEUTRU')
                              : impactData.direction}
                          </span>
                        </div>

                        {/* Institutional Reasoning */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                            {lang === 'ro' ? 'Analiză Instituțională:' : 'Institutional Rationale:'}
                          </span>
                          <p className="text-[11px] leading-relaxed text-slate-200">{reasoningText}</p>
                        </div>

                        {/* Beginner Simple Explanation */}
                        {simpleExpl && (
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                            <span className="font-bold text-amber-300 block mb-0.5 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3 text-amber-400" />
                              <span>{lang === 'ro' ? 'De ce reacționează astfel (Pe înțelesul tău):' : 'Why it reacts like this (Simple):'}</span>
                            </span>
                            <p className="text-slate-300 leading-snug">{simpleExpl}</p>
                          </div>
                        )}

                        {/* Beginner Tip */}
                        {beginnerTip && (
                          <div className="text-[10px] text-indigo-300 flex items-start gap-1 pt-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <span>{beginnerTip}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 📚 Section 5: Beginner Glossary */}
              {finbertAnalysis.beginnerGlossary && finbertAnalysis.beginnerGlossary.length > 0 && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-indigo-400 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>{lang === 'ro' ? '📚 Glosar de Termeni Cheie pentru Începători' : '📚 Key Terms Glossary for Beginners'}</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {finbertAnalysis.beginnerGlossary.map((item, idx) => (
                      <div key={idx} className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                        <span className="font-bold text-indigo-300 block text-[11px]">
                          {lang === 'ro' ? item.term : (item.termEn || item.term.replace(/Anterior.*/i, 'Previous').replace(/Estimat.*/i, 'Forecast').replace(/Actual.*/i, 'Actual').replace(/Surpriză.*/i, 'Market Surprise'))}:
                        </span>
                        <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                          {lang === 'ro' ? item.definitionRo : (item.definitionEn || translateFinancialText(item.definitionRo, 'en') || item.definitionRo)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🛡️ Section 6: Risk Tip */}
              {(finbertAnalysis.riskTipRo || finbertAnalysis.riskTipEn) && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-300 uppercase text-[11px] block">
                      {lang === 'ro' ? '🛡️ Recomandare de Risc & Management pentru Începători' : '🛡️ Risk Management Recommendation for Beginners'}
                    </span>
                    <p className="mt-0.5 leading-relaxed text-[11px]">
                      {lang === 'ro'
                        ? (finbertAnalysis.riskTipRo || finbertAnalysis.riskTipEn)
                        : (finbertAnalysis.riskTipEn || finbertAnalysis.riskTipRo)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
