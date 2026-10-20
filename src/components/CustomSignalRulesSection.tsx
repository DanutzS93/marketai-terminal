import React, { useState } from 'react';
import {
  Sliders,
  Zap,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Target,
  ShieldAlert,
  BarChart2,
  BookmarkPlus,
  ArrowRight,
  Info,
} from 'lucide-react';
import { CustomSignalRule, InstrumentId, MarketQuote, TimeFrame, TradingSignal } from '../types';
import { formatFullDateTime, formatQuoteTime } from '../utils/signalUtils';
import { SignalDetailsModal } from './SignalDetailsModal';

interface CustomSignalRulesSectionProps {
  quotes: Record<InstrumentId, MarketQuote>;
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
  onGenerateCustomSignal: (rule: CustomSignalRule) => Promise<TradingSignal | null>;
  isGenerating: boolean;
  lang: 'ro' | 'en';
}

export const CustomSignalRulesSection: React.FC<CustomSignalRulesSectionProps> = ({
  quotes,
  selectedInstrument,
  onSelectInstrument,
  onGenerateCustomSignal,
  isGenerating,
  lang,
}) => {
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [rsiCondition, setRsiCondition] = useState<CustomSignalRule['rsiCondition']>('CROSS_ABOVE_50');
  const [rsiCustomValue, setRsiCustomValue] = useState<number>(55);
  const [maCondition, setMaCondition] = useState<CustomSignalRule['maCondition']>('PRICE_ABOVE_EMA20');
  const [macdCondition, setMacdCondition] = useState<CustomSignalRule['macdCondition']>('HISTOGRAM_POSITIVE');
  const [priceLevelCondition, setPriceLevelCondition] = useState<CustomSignalRule['priceLevelCondition']>('BREAKOUT_RESISTANCE');
  const [customPriceLevel, setCustomPriceLevel] = useState<number>(0);
  const [riskRewardTarget, setRiskRewardTarget] = useState<string>('1:2.5');
  const [notes, setNotes] = useState<string>('');
  
  const [lastGeneratedCustomSignal, setLastGeneratedCustomSignal] = useState<TradingSignal | null>(null);
  const [selectedSignalForDetails, setSelectedSignalForDetails] = useState<TradingSignal | null>(null);

  const currentQuote = quotes[selectedInstrument];

  // Quick preset templates
  const applyPreset = (type: 'BREAKOUT' | 'OVERSOLD_REVERSAL' | 'SWING_TREND') => {
    if (type === 'BREAKOUT') {
      setRsiCondition('CROSS_ABOVE_50');
      setMaCondition('PRICE_ABOVE_EMA20');
      setMacdCondition('HISTOGRAM_POSITIVE');
      setPriceLevelCondition('BREAKOUT_RESISTANCE');
      setRiskRewardTarget('1:3');
      setNotes(lang === 'ro' ? 'Caut spargere cu volum peste ultima rezistență locală' : 'Looking for breakout with volume above recent resistance');
    } else if (type === 'OVERSOLD_REVERSAL') {
      setRsiCondition('OVERSOLD_30');
      setMaCondition('PRICE_ABOVE_SMA50');
      setMacdCondition('BULLISH_CROSS');
      setPriceLevelCondition('PULLBACK_SUPPORT');
      setRiskRewardTarget('1:2.5');
      setNotes(lang === 'ro' ? 'Cumpărare la supra-vânzare după retragere pe suport cheie' : 'Buy oversold bounce after pullback to key support');
    } else if (type === 'SWING_TREND') {
      setRsiCondition('CROSS_ABOVE_50');
      setMaCondition('GOLDEN_CROSS');
      setMacdCondition('HISTOGRAM_POSITIVE');
      setPriceLevelCondition('BREAKOUT_RESISTANCE');
      setRiskRewardTarget('1:3');
      setNotes(lang === 'ro' ? 'Trend ascendent puternic cu aliniere de medii mobile' : 'Strong uptrend with moving average alignment');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rule: CustomSignalRule = {
      instrumentId: selectedInstrument,
      timeframe,
      rsiCondition,
      rsiCustomValue,
      maCondition,
      macdCondition,
      priceLevelCondition,
      customPriceLevel: customPriceLevel || (currentQuote ? currentQuote.price : undefined),
      riskRewardTarget,
      notes,
    };

    const createdSignal = await onGenerateCustomSignal(rule);
    if (createdSignal) {
      setLastGeneratedCustomSignal(createdSignal);
    }
  };

  // Evaluate live condition matches
  const isRsiMatch = () => {
    if (!currentQuote) return false;
    if (rsiCondition === 'OVERSOLD_30') return currentQuote.rsi <= 35;
    if (rsiCondition === 'OVERBOUGHT_70') return currentQuote.rsi >= 65;
    if (rsiCondition === 'CROSS_ABOVE_50') return currentQuote.rsi >= 50;
    if (rsiCondition === 'CROSS_BELOW_50') return currentQuote.rsi <= 50;
    if (rsiCondition === 'CUSTOM') return Math.abs(currentQuote.rsi - rsiCustomValue) <= 5;
    return true;
  };

  const isMaMatch = () => {
    if (!currentQuote) return false;
    if (maCondition === 'PRICE_ABOVE_EMA20') return currentQuote.price >= currentQuote.ema20;
    if (maCondition === 'PRICE_BELOW_EMA20') return currentQuote.price <= currentQuote.ema20;
    if (maCondition === 'PRICE_ABOVE_SMA50') return currentQuote.price >= currentQuote.sma50;
    if (maCondition === 'PRICE_ABOVE_SMA200') return currentQuote.price >= currentQuote.sma200;
    if (maCondition === 'GOLDEN_CROSS') return currentQuote.ema20 >= currentQuote.sma50;
    return true;
  };

  return (
    <section className="bg-gradient-to-b from-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden mb-8 w-full relative glass-specular-top">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-[#0F1C38]/90 via-[#0B152A]/90 to-[#0F1C38]/90 text-white p-4 sm:p-6 border-b border-white/10 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  {lang === 'ro' ? 'Configurare Reguli Personalizate Semnal' : 'Custom Signal Rule Builder'}
                </h2>
                <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  REGULI PRO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ro'
                  ? 'Definește-ți criteriile tehnice (RSI, Medii Mobile, MACD, Suport/Rezistență) pentru a genera semnale ultra-personalizate.'
                  : 'Define your technical criteria (RSI, MAs, MACD, Support/Resistance) to generate fully customized trading signals.'}
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block w-full md:w-auto font-mono">
              {lang === 'ro' ? 'Șabloane Rapide:' : 'Presets:'}
            </span>
            <button
              type="button"
              onClick={() => applyPreset('BREAKOUT')}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Breakout
            </button>
            <button
              type="button"
              onClick={() => applyPreset('OVERSOLD_REVERSAL')}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Reversie Oversold
            </button>
            <button
              type="button"
              onClick={() => applyPreset('SWING_TREND')}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Swing Trend
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Select Instrument & Timeframe */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#081020]/80 border border-white/10 backdrop-blur-xl space-y-5 shadow-inner">
            {/* Instrument Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5 font-mono">
                <Target className="w-4 h-4 text-cyan-400" />
                {lang === 'ro' ? '1. Selectează Activul (Indici / Aur / Futures / Forex)' : '1. Select Asset (Indices / Gold / Futures / Forex)'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {(['NASDAQ', 'SPX500', 'DOW_JONES', 'GOLD', 'NQ_F', 'ES_F', 'GC_F', 'EURUSD', 'GBPUSD', 'USDJPY'] as InstrumentId[]).map((id) => {
                  const q = quotes[id];
                  const isSel = selectedInstrument === id;
                  const label =
                    id === 'NASDAQ'
                      ? 'NAS100 CFD'
                      : id === 'SPX500'
                      ? 'SPX500 CFD'
                      : id === 'DOW_JONES'
                      ? 'US30 CFD'
                      : id === 'GOLD'
                      ? 'XAU Spot'
                      : id === 'NQ_F'
                      ? 'NQ.F Fut'
                      : id === 'ES_F'
                      ? 'ES.F Fut'
                      : id === 'GC_F'
                      ? 'GC.F Fut'
                      : id === 'EURUSD'
                      ? 'EUR/USD'
                      : id === 'GBPUSD'
                      ? 'GBP/USD'
                      : 'USD/JPY';

                  const priceText = !q || typeof q.price !== 'number' || q.price <= 0
                    ? '-'
                    : id === 'EURUSD' || id === 'GBPUSD'
                    ? q.price.toFixed(5)
                    : id === 'USDJPY'
                    ? q.price.toFixed(3)
                    : `$${q.price.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectInstrument(id)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition font-sans min-w-0 flex flex-col justify-between cursor-pointer ${
                        isSel
                          ? 'bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 text-white border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] font-bold'
                          : 'bg-white/5 text-slate-200 border-white/10 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold truncate leading-tight whitespace-nowrap">
                        {label}
                      </div>
                      <div className={`text-[11px] font-mono mt-1 truncate whitespace-nowrap ${isSel ? 'text-cyan-200' : 'text-slate-400'}`}>
                        {priceText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timeframe Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5 font-mono">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                {lang === 'ro' ? '2. Orizont de Timp (Timeframe)' : '2. Timeframe Horizon'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-2xl">
                {(['5m', '15m', '1h', '4h', '1D'] as TimeFrame[]).map((tf) => {
                  const isSel = timeframe === tf;
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition font-mono cursor-pointer ${
                        isSel
                          ? 'bg-white text-slate-950 border-white shadow-sm font-black'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {tf === '5m' ? '5m (Scalp)' : tf === '15m' ? '15m' : tf === '1h' ? '1h' : tf === '4h' ? '4h' : '1D'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Technical Rules Builder Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Condition 1: RSI */}
            <div className="p-4 rounded-xl border border-white/10 bg-[#0B1428]/80 backdrop-blur-xl hover:border-indigo-500/40 transition shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Condiție RSI (14)
                </span>
                {currentQuote && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-black/40 text-amber-300 rounded border border-amber-500/30">
                    Live: {currentQuote.rsi}
                  </span>
                )}
              </div>
              <select
                value={rsiCondition}
                onChange={(e) => setRsiCondition(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-lg border border-white/10 bg-[#060B18]/90 text-slate-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
              >
                <option value="NONE">{lang === 'ro' ? 'Nicio condiție' : 'No condition'}</option>
                <option value="CROSS_ABOVE_50">{lang === 'ro' ? 'RSI > 50 (Momentum Bullish)' : 'RSI > 50 (Bullish Momentum)'}</option>
                <option value="CROSS_BELOW_50">{lang === 'ro' ? 'RSI < 50 (Momentum Bearish)' : 'RSI < 50 (Bearish Momentum)'}</option>
                <option value="OVERSOLD_30">{lang === 'ro' ? 'RSI < 35 (Sub-cumpărat / Oversold)' : 'RSI < 35 (Oversold)'}</option>
                <option value="OVERBOUGHT_70">{lang === 'ro' ? 'RSI > 65 (Supra-cumpărat / Overbought)' : 'RSI > 65 (Overbought)'}</option>
                <option value="CUSTOM">{lang === 'ro' ? 'Nivel RSI Personalizat' : 'Custom RSI Level'}</option>
              </select>

              {rsiCondition === 'CUSTOM' && (
                <div className="mt-2">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={rsiCustomValue}
                    onChange={(e) => setRsiCustomValue(Number(e.target.value))}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-white/10 bg-[#060B18] text-white"
                    placeholder="ex. 45"
                  />
                </div>
              )}
            </div>

            {/* Condition 2: Moving Averages */}
            <div className="p-4 rounded-xl border border-white/10 bg-[#0B1428]/80 backdrop-blur-xl hover:border-indigo-500/40 transition shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  {lang === 'ro' ? 'Medii Mobile (MA)' : 'Moving Averages (MA)'}
                </span>
                {currentQuote && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-black/40 text-cyan-300 rounded border border-cyan-500/30">
                    EMA20: ${Math.round(currentQuote.ema20)}
                  </span>
                )}
              </div>
              <select
                value={maCondition}
                onChange={(e) => setMaCondition(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-lg border border-white/10 bg-[#060B18]/90 text-slate-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
              >
                <option value="NONE">{lang === 'ro' ? 'Nicio condiție' : 'No condition'}</option>
                <option value="PRICE_ABOVE_EMA20">{lang === 'ro' ? 'Preț > EMA 20 (Trend Scurt)' : 'Price > EMA 20 (Short Trend)'}</option>
                <option value="PRICE_BELOW_EMA20">{lang === 'ro' ? 'Preț < EMA 20' : 'Price < EMA 20'}</option>
                <option value="PRICE_ABOVE_SMA50">{lang === 'ro' ? 'Preț > SMA 50 (Trend Mediu)' : 'Price > SMA 50 (Medium Trend)'}</option>
                <option value="PRICE_ABOVE_SMA200">{lang === 'ro' ? 'Preț > SMA 200 (Trend Lung)' : 'Price > SMA 200 (Long Trend)'}</option>
                <option value="GOLDEN_CROSS">Golden Cross (EMA20 &gt; SMA50)</option>
                <option value="DEATH_CROSS">Death Cross (EMA20 &lt; SMA50)</option>
              </select>
            </div>

            {/* Condition 3: MACD */}
            <div className="p-4 rounded-xl border border-white/10 bg-[#0B1428]/80 backdrop-blur-xl hover:border-indigo-500/40 transition shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                  {lang === 'ro' ? 'Oscilator MACD' : 'MACD Oscillator'}
                </span>
                {currentQuote && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-black/40 text-purple-300 rounded border border-purple-500/30">
                    Val: {currentQuote.macd.value}
                  </span>
                )}
              </div>
              <select
                value={macdCondition}
                onChange={(e) => setMacdCondition(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-lg border border-white/10 bg-[#060B18]/90 text-slate-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
              >
                <option value="NONE">{lang === 'ro' ? 'Nicio condiție' : 'No condition'}</option>
                <option value="HISTOGRAM_POSITIVE">{lang === 'ro' ? 'Histogramă MACD Pozitivă' : 'Positive MACD Histogram'}</option>
                <option value="HISTOGRAM_NEGATIVE">{lang === 'ro' ? 'Histogramă MACD Negativă' : 'Negative MACD Histogram'}</option>
                <option value="BULLISH_CROSS">{lang === 'ro' ? 'Cruce Ascendentă Linia de Semnal' : 'Bullish Signal Line Crossover'}</option>
                <option value="BEARISH_CROSS">{lang === 'ro' ? 'Cruce Descendentă Linia de Semnal' : 'Bearish Signal Line Crossover'}</option>
              </select>
            </div>

            {/* Condition 4: Price Levels & Risk:Reward */}
            <div className="p-4 rounded-xl border border-white/10 bg-[#0B1428]/80 backdrop-blur-xl hover:border-indigo-500/40 transition shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  {lang === 'ro' ? 'Raport Risc / Profit' : 'Risk / Reward Ratio'}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                  Target: {riskRewardTarget}
                </span>
              </div>
              <select
                value={riskRewardTarget}
                onChange={(e) => setRiskRewardTarget(e.target.value)}
                className="w-full text-xs font-medium p-2.5 rounded-lg border border-white/10 bg-[#060B18]/90 text-slate-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none mb-2"
              >
                <option value="1:2">{lang === 'ro' ? 'Risc:Profit 1 : 2.0 (Conservator)' : 'Risk:Reward 1 : 2.0 (Conservative)'}</option>
                <option value="1:2.5">{lang === 'ro' ? 'Risc:Profit 1 : 2.5 (Standard)' : 'Risk:Reward 1 : 2.5 (Standard)'}</option>
                <option value="1:3">{lang === 'ro' ? 'Risc:Profit 1 : 3.0 (Agresiv)' : 'Risk:Reward 1 : 3.0 (Aggressive)'}</option>
                <option value="1:4">{lang === 'ro' ? 'Risc:Profit 1 : 4.0 (Ambițios)' : 'Risk:Reward 1 : 4.0 (Ambitious)'}</option>
              </select>
            </div>
          </div>

          {/* Row 3: Price Level Condition & Custom Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                {lang === 'ro' ? 'Condiție Nivel Preț / Structură:' : 'Price Level / Structure Condition:'}
              </label>
              <select
                value={priceLevelCondition}
                onChange={(e) => setPriceLevelCondition(e.target.value as any)}
                className="w-full text-xs font-medium p-2.5 rounded-lg border border-white/10 bg-[#060B18]/90 text-slate-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
              >
                <option value="NONE">{lang === 'ro' ? 'Nicio preferință de preț fix' : 'No fixed price condition'}</option>
                <option value="BREAKOUT_RESISTANCE">{lang === 'ro' ? 'Spargere peste Rezistența Zilei (Breakout)' : 'Breakout Above Daily Resistance'}</option>
                <option value="PULLBACK_SUPPORT">{lang === 'ro' ? 'Retragere & Re-testare pe Suport (Pullback)' : 'Pullback & Support Retest'}</option>
                <option value="CUSTOM_TARGET">{lang === 'ro' ? 'Preț Țintă de Intrare Fix (Specific)' : 'Custom Specific Entry Price'}</option>
              </select>

              {priceLevelCondition === 'CUSTOM_TARGET' && (
                <div className="mt-2">
                  <input
                    type="number"
                    step="0.1"
                    value={customPriceLevel || ''}
                    onChange={(e) => setCustomPriceLevel(Number(e.target.value))}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-white/10 bg-[#060B18] text-white"
                    placeholder={`ex. ${currentQuote ? currentQuote.price : 20450}`}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                {lang === 'ro' ? 'Instrucțiuni & Reguli Specifice (Opțional):' : 'Custom Strategy Notes & Rules (Optional):'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  lang === 'ro'
                    ? 'ex: Doresc intrare doar la retragere de 50% pe Fibonacci după deschiderea US Session...'
                    : 'e.g., Only trigger entry on 50% Fibonacci pullback after US open...'
                }
                className="w-full text-xs font-medium p-2.5 rounded-lg border border-white/10 bg-[#060B18]/90 text-slate-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
              />
            </div>
          </div>

          {/* Live Condition Verification Status Banner */}
          {currentQuote && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-black/40 border border-white/10 backdrop-blur-xl text-xs text-slate-300 shadow-inner">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-bold flex items-center gap-1.5 text-white font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {lang === 'ro' ? 'Verificare Live Piață:' : 'Live Market Check:'}
                </span>

                <span className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-xs ${isRsiMatch() ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                  RSI ({currentQuote.rsi}) {isRsiMatch() ? '✓ Valid' : '• Neutru'}
                </span>

                <span className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-xs ${isMaMatch() ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
                  Preț (${currentQuote.price}) {isMaMatch() ? '✓ Aliniat' : '• În verificare'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                {lang === 'ro' ? 'Cotat Live via:' : 'Live Feed via:'} <strong className="text-slate-200">{currentQuote.source}</strong> ({formatQuoteTime(currentQuote.timestamp)})
              </div>
            </div>
          )}

          {/* Action Submit Button */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isGenerating}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-400/30 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{lang === 'ro' ? 'Se evaluează regulile tale...' : 'Evaluating custom rules...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{lang === 'ro' ? 'Generează Semnal conform Regulilor mele' : 'Generate Custom Signal from My Rules'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Generated Custom Signal Spotlight View */}
        {lastGeneratedCustomSignal && (
          <div className="mt-6 p-5 rounded-2xl bg-gradient-to-b from-[#0E1B38]/90 to-[#0A1326]/90 border border-indigo-400/40 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 font-mono">
                  <BookmarkPlus className="w-3.5 h-3.5 text-amber-300" />
                  {lang === 'ro' ? 'SEMNAL REGULĂ PERSONALIZATĂ GENERAT' : 'CUSTOM RULE SIGNAL GENERATED'}
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  {lastGeneratedCustomSignal.symbol} • {lastGeneratedCustomSignal.timeframe}
                </span>
              </div>

              <span className="text-xs text-slate-300 font-mono font-semibold bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                {formatFullDateTime(lastGeneratedCustomSignal.createdAt, lang)}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <h3 className="text-base font-bold text-white mb-1">
                  {lastGeneratedCustomSignal.title}
                </h3>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  {lastGeneratedCustomSignal.summary}
                </p>

                <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 text-xs space-y-2 backdrop-blur-md">
                  <div className="font-bold text-cyan-300 border-b border-white/10 pb-1 font-mono">
                    {lang === 'ro' ? 'Confirmare Criterii Personalizate Setate:' : 'Custom Criteria Verification:'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-200">
                    <div>✓ Intrare: <strong className="text-white">${lastGeneratedCustomSignal.entryPrice}</strong></div>
                    <div>✓ Stop Loss: <strong className="text-rose-400">${lastGeneratedCustomSignal.stopLoss}</strong></div>
                    <div>✓ Target 1: <strong className="text-emerald-400">${lastGeneratedCustomSignal.targetPrice1}</strong></div>
                    <div>✓ Risc/Profit: <strong className="text-cyan-400">{lastGeneratedCustomSignal.riskRewardRatio}</strong></div>
                  </div>
                </div>
              </div>

              <div className="bg-[#0B1428]/80 p-4 rounded-xl border border-white/10 flex flex-col justify-between backdrop-blur-xl">
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1 font-mono">{lang === 'ro' ? 'Încredere AI pe Reguli:' : 'AI Rule Confidence:'}</div>
                  <div className="text-3xl font-extrabold font-mono text-cyan-400 mb-2">
                    {lastGeneratedCustomSignal.confidencePercent}%
                  </div>
                  <div className="text-[11px] text-slate-300 leading-snug">
                    {lastGeneratedCustomSignal.indicators.rsiStatus}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedSignalForDetails(lastGeneratedCustomSignal)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm border border-cyan-400/30 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-cyan-200" />
                    <span>{lang === 'ro' ? 'Deschide Pop-Up Explicație 🔍' : 'Open Trade Explanation 🔍'}</span>
                  </button>

                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {lang === 'ro' ? 'Adăugat automat în lista de semnale active' : 'Added automatically to active signals list'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signal Details Pop-Up Modal */}
      <SignalDetailsModal
        isOpen={!!selectedSignalForDetails}
        onClose={() => setSelectedSignalForDetails(null)}
        signal={selectedSignalForDetails}
        lang={lang}
      />
    </section>
  );
};
