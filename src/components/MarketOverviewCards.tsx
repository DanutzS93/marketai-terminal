import React, { useRef, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronRight, Cpu, DollarSign, Database, CheckCircle2, Activity, Gauge, Info } from 'lucide-react';
import { MarketQuote, InstrumentId } from '../types';

interface MarketOverviewCardsProps {
  quotes: Record<InstrumentId, MarketQuote>;
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
  lang: 'ro' | 'en';
}

function formatMacdNumber(val: number): string {
  if (val === 0 || isNaN(val)) return '0.00';
  const abs = Math.abs(val);
  const sign = val > 0 ? '+' : '';
  if (abs < 0.001) return `${sign}${val.toFixed(5)}`;
  if (abs < 0.1) return `${sign}${val.toFixed(4)}`;
  if (abs < 1) return `${sign}${val.toFixed(3)}`;
  return `${sign}${val.toFixed(2)}`;
}

interface RsiIndicatorState {
  value: number;
  clamped: number;
  statusText: string;
  badgeStyle: string;
  barGradient: string;
  textStyle: string;
  isOverbought: boolean;
  isOversold: boolean;
}

function getRsiState(rsiVal: number, lang: 'ro' | 'en'): RsiIndicatorState {
  const value = typeof rsiVal === 'number' && !isNaN(rsiVal) ? Number(rsiVal.toFixed(1)) : 50;
  const clamped = Math.min(Math.max(value, 0), 100);
  const isOverbought = value >= 70;
  const isOversold = value <= 30;

  if (isOverbought) {
    return {
      value,
      clamped,
      statusText: lang === 'ro' ? 'Supracumpărat' : 'Overbought',
      badgeStyle: 'bg-rose-100 text-rose-800 border-rose-300',
      barGradient: 'from-amber-400 to-rose-500',
      textStyle: 'text-rose-600',
      isOverbought: true,
      isOversold: false,
    };
  }

  if (isOversold) {
    return {
      value,
      clamped,
      statusText: lang === 'ro' ? 'Supravândut' : 'Oversold',
      badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      barGradient: 'from-cyan-400 to-blue-500',
      textStyle: 'text-cyan-600',
      isOverbought: false,
      isOversold: true,
    };
  }

  if (value >= 55) {
    return {
      value,
      clamped,
      statusText: lang === 'ro' ? 'Bullish' : 'Bullish',
      badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      barGradient: 'from-emerald-400 to-teal-500',
      textStyle: 'text-emerald-700',
      isOverbought: false,
      isOversold: false,
    };
  }

  if (value <= 45) {
    return {
      value,
      clamped,
      statusText: lang === 'ro' ? 'Bearish' : 'Bearish',
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
      barGradient: 'from-amber-400 to-orange-400',
      textStyle: 'text-amber-700',
      isOverbought: false,
      isOversold: false,
    };
  }

  return {
    value,
    clamped,
    statusText: lang === 'ro' ? 'Neutru' : 'Neutral',
    badgeStyle: 'bg-white/5 text-slate-300 border-white/10',
    barGradient: 'from-slate-500 to-slate-400',
    textStyle: 'text-slate-300',
    isOverbought: false,
    isOversold: false,
  };
}

interface MacdIndicatorState {
  value: number;
  signal: number;
  histogram: number;
  strengthPercent: number; // 0 to 100
  isBullish: boolean;
  isBearish: boolean;
  statusText: string;
  badgeStyle: string;
  barGradient: string;
  textStyle: string;
  isExtreme: boolean;
}

function getMacdState(
  macdData: { value: number; signal: number; histogram: number } | undefined,
  price: number,
  lang: 'ro' | 'en'
): MacdIndicatorState {
  const macdVal = macdData && typeof macdData.value === 'number' && !isNaN(macdData.value) ? macdData.value : 0;
  const signalVal = macdData && typeof macdData.signal === 'number' && !isNaN(macdData.signal) ? macdData.signal : 0;
  const histogram =
    macdData && typeof macdData.histogram === 'number' && !isNaN(macdData.histogram)
      ? macdData.histogram
      : Number((macdVal - signalVal).toFixed(5));

  // Determine baseline for normalizing momentum strength bar (0 to 100%)
  const baseline = Math.max(
    Math.abs(signalVal),
    Math.abs(macdVal),
    price > 0 ? price * 0.001 : 1
  );
  const ratio = baseline > 0 ? Math.abs(histogram) / (baseline * 0.45) : 0.5;
  const strengthPercent = Math.min(Math.max(Math.round(ratio * 100), 18), 100);

  const isBullish = histogram > 0;
  const isBearish = histogram < 0;
  const isExtreme = strengthPercent >= 80;

  if (isBullish) {
    const statusText = isExtreme
      ? lang === 'ro' ? 'Forță Bullish (OB)' : 'Strong Bullish (OB)'
      : lang === 'ro' ? 'Momentum Bullish' : 'Bullish Momentum';
    return {
      value: macdVal,
      signal: signalVal,
      histogram,
      strengthPercent,
      isBullish: true,
      isBearish: false,
      isExtreme,
      statusText,
      badgeStyle: isExtreme ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      barGradient: 'from-emerald-400 to-teal-500',
      textStyle: 'text-emerald-700',
    };
  }

  if (isBearish) {
    const statusText = isExtreme
      ? lang === 'ro' ? 'Forță Bearish (OS)' : 'Strong Bearish (OS)'
      : lang === 'ro' ? 'Momentum Bearish' : 'Bearish Momentum';
    return {
      value: macdVal,
      signal: signalVal,
      histogram,
      strengthPercent,
      isBullish: false,
      isBearish: true,
      isExtreme,
      statusText,
      badgeStyle: isExtreme ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-rose-50 text-rose-700 border-rose-200',
      barGradient: 'from-rose-400 to-amber-500',
      textStyle: 'text-rose-700',
    };
  }

  return {
    value: macdVal,
    signal: signalVal,
    histogram: 0,
    strengthPercent: 0,
    isBullish: false,
    isBearish: false,
    isExtreme: false,
    statusText: lang === 'ro' ? 'Neutru' : 'Neutral',
    badgeStyle: 'bg-white/5 text-slate-300 border-white/10',
    barGradient: 'from-slate-500 to-slate-400',
    textStyle: 'text-slate-300',
  };
}

export const MarketOverviewCards: React.FC<MarketOverviewCardsProps> = ({
  quotes,
  selectedInstrument,
  onSelectInstrument,
  lang,
}) => {
  // Flash indicators on live price tick update
  const prevPricesRef = useRef<Record<string, number>>({});
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down'> = {};
    let hasFlash = false;

    for (const [key, quote] of Object.entries(quotes || {})) {
      if (quote && typeof quote.price === 'number') {
        const oldPrice = prevPricesRef.current[key];
        if (oldPrice !== undefined && oldPrice !== quote.price) {
          newFlashes[key] = quote.price > oldPrice ? 'up' : 'down';
          hasFlash = true;
        }
        prevPricesRef.current[key] = quote.price;
      }
    }

    if (hasFlash) {
      setPriceFlashes((prev) => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setPriceFlashes({});
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [quotes]);

  const cfdInstruments: { id: InstrumentId; subtitle: string; provider: string; category: string }[] = [
    { id: 'NASDAQ', subtitle: 'Nasdaq 100 CFD Index (NAS100)', provider: 'LSE', category: 'CFD INDEX' },
    { id: 'SPX500', subtitle: 'S&P 500 CFD Index (SPX500)', provider: 'LSE', category: 'CFD INDEX' },
    { id: 'DOW_JONES', subtitle: 'Dow Jones CFD Index (US30)', provider: 'LSE', category: 'CFD INDEX' },
    { id: 'GOLD', subtitle: 'Gold Spot (XAU/USD)', provider: 'LSE', category: 'SPOT COMMODITY' },
  ];

  const futuresInstruments: { id: InstrumentId; subtitle: string; provider: string; category: string }[] = [
    { id: 'NQ_F', subtitle: 'Nasdaq 100 Futures Contract (NQ.F)', provider: 'LSE / CME', category: 'FUTURES' },
    { id: 'ES_F', subtitle: 'S&P 500 Futures Contract (ES.F)', provider: 'LSE / CME', category: 'FUTURES' },
    { id: 'GC_F', subtitle: 'Gold Futures Contract (GC.F)', provider: 'LSE / COMEX', category: 'FUTURES' },
  ];

  const forexInstruments: { id: InstrumentId; subtitle: string; provider: string; category: string }[] = [
    { id: 'EURUSD', subtitle: 'EUR/USD Forex Spot (100k Lot)', provider: 'LSE Vault Feed', category: 'FOREX' },
    { id: 'GBPUSD', subtitle: 'GBP/USD Forex Spot (100k Lot)', provider: 'LSE Vault Feed', category: 'FOREX' },
    { id: 'USDJPY', subtitle: 'USD/JPY Forex Spot (100k Lot)', provider: 'LSE Vault Feed', category: 'FOREX' },
  ];

  const renderCard = ({ id, subtitle, provider, category }: { id: InstrumentId; subtitle: string; provider: string; category: string }) => {
    const defaultQuote: MarketQuote = {
      id,
      name:
        id === 'NASDAQ'
          ? 'Nasdaq 100 CFD'
          : id === 'SPX500'
          ? 'S&P 500 CFD'
          : id === 'DOW_JONES'
          ? 'Dow Jones CFD'
          : id === 'GOLD'
          ? 'Gold Spot (XAU/USD)'
          : id === 'NQ_F'
          ? 'Nasdaq 100 Futures'
          : id === 'ES_F'
          ? 'S&P 500 Futures'
          : id === 'GC_F'
          ? 'Gold Futures'
          : id === 'EURUSD'
          ? 'EUR/USD (Euro / US Dollar)'
          : id === 'GBPUSD'
          ? 'GBP/USD (British Pound / US Dollar)'
          : 'USD/JPY (US Dollar / Japanese Yen)',
      symbol:
        id === 'NASDAQ'
          ? 'NAS100'
          : id === 'SPX500'
          ? 'SPX500'
          : id === 'DOW_JONES'
          ? 'US30'
          : id === 'GOLD'
          ? 'XAU/USD'
          : id === 'NQ_F'
          ? 'NQ.F'
          : id === 'ES_F'
          ? 'ES.F'
          : id === 'GC_F'
          ? 'GC.F'
          : id === 'EURUSD'
          ? 'EUR/USD'
          : id === 'GBPUSD'
          ? 'GBP/USD'
          : 'USD/JPY',
      tradingViewSymbol: '',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: new Date().toISOString(),
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    };

    const quote = quotes[id] || defaultQuote;
    const hasRealPrice = Boolean(quote && typeof quote.price === 'number' && quote.price > 0 && !isNaN(quote.price));

    const isSelected = selectedInstrument === id;
    const isPositive = hasRealPrice && quote.changePercent >= 0;
    const flash = priceFlashes[id];

    const rangeSpan = quote.high - quote.low;
    const currentPosPercent = (hasRealPrice && rangeSpan > 0) ? Math.min(Math.max(((quote.price - quote.low) / rangeSpan) * 100, 5), 95) : 50;

    const rsiState = getRsiState(quote.rsi, lang);
    const macdState = getMacdState(quote.macd, quote.price, lang);

    const formattedPrice =
      !hasRealPrice
        ? '-'
        : id === 'EURUSD' || id === 'GBPUSD'
        ? `${quote.price.toFixed(5)}`
        : id === 'USDJPY'
        ? `${quote.price.toFixed(3)}`
        : `$${quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const flashCardClass = flash === 'up'
      ? 'ring-2 ring-emerald-400/80 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] scale-[1.01]'
      : flash === 'down'
      ? 'ring-2 ring-rose-400/80 border-rose-400/60 shadow-[0_0_25px_rgba(244,63,94,0.35)] scale-[1.01]'
      : '';

    return (
      <div
        key={id}
        onClick={() => onSelectInstrument(id)}
        className={`cursor-pointer rounded-2xl transition-all duration-300 p-5 border relative overflow-hidden flex flex-col justify-between backdrop-blur-2xl shadow-xl ${
          flashCardClass || (
            isSelected
              ? 'bg-[#0E1830]/85 border-indigo-400/50 shadow-[0_0_30px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/50 text-white'
              : 'bg-[#0A101F]/70 hover:bg-[#0E1830]/75 border-white/10 hover:border-white/20 text-slate-200 hover:shadow-2xl hover:translate-y-[-2px]'
          )
        }`}
      >
        {/* Specular top reflection line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div>
          {/* Top Row: Title & Data Source Tag */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">{quote.name}</h3>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                category === 'FUTURES'
                  ? 'liquid-amber text-amber-300 border-amber-500/40'
                  : category === 'CRYPTO'
                  ? 'liquid-amber text-orange-300 border-orange-500/40'
                  : category === 'FOREX'
                  ? 'liquid-cyan text-cyan-300 border-cyan-500/40'
                  : 'liquid-indigo text-indigo-200 border-indigo-400/40'
              }`}>
                {category}
              </span>
              <span className="text-[10px] text-slate-400 font-mono font-semibold">
                {quote.symbol}
              </span>
            </div>
          </div>

          {/* Price Row */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className={`text-2xl font-black font-mono tracking-tight transition-colors duration-200 ${
                flash === 'up'
                  ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : flash === 'down'
                  ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'text-white'
              }`}>
                {formattedPrice}
              </span>
            </div>
            {hasRealPrice ? (
              <div
                className={`flex items-center gap-1 text-xs font-bold font-mono px-2.5 py-1 rounded-lg border transition-all duration-300 ${
                  flash === 'up'
                    ? 'bg-emerald-500/40 text-emerald-200 border-emerald-400'
                    : flash === 'down'
                    ? 'bg-rose-500/40 text-rose-200 border-rose-400'
                    : isPositive
                    ? 'liquid-emerald text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'liquid-rose text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{isPositive ? '+' : ''}{quote.changePercent}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs font-bold font-mono px-2.5 py-1 rounded-lg border bg-slate-800/40 text-slate-500 border-white/5">
                <span>-</span>
              </div>
            )}
          </div>

          {/* 24h High/Low Range */}
          <div className="mb-4">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium mb-1.5 font-mono">
              <span>Low: {hasRealPrice && quote.low > 0 ? (id === 'EURUSD' || id === 'GBPUSD' ? quote.low.toFixed(5) : id === 'USDJPY' ? quote.low.toFixed(3) : `$${quote.low.toLocaleString('en-US', { minimumFractionDigits: 2 })}`) : '-'}</span>
              <span>High: {hasRealPrice && quote.high > 0 ? (id === 'EURUSD' || id === 'GBPUSD' ? quote.high.toFixed(5) : id === 'USDJPY' ? quote.high.toFixed(3) : `$${quote.high.toLocaleString('en-US', { minimumFractionDigits: 2 })}`) : '-'}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900/90 rounded-full overflow-hidden relative border border-white/10">
              <div className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full"></div>
              <div
                className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)] transform -translate-x-1/2"
                style={{ left: `${hasRealPrice ? currentPosPercent : 50}%` }}
              ></div>
            </div>
          </div>

          {/* Technical Strength & Indicators Section (RSI & MACD visual bars) */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-white/10 space-y-3 mb-3 backdrop-blur-md">
            {/* 1. RSI (14) Indicator with Strength Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RSI (14)</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${quote.price > 0 ? rsiState.badgeStyle : 'bg-slate-800/40 text-slate-500 border-white/5'}`}>
                    {quote.price > 0 ? rsiState.statusText : '-'}
                  </span>
                </div>
                <span className={`font-mono text-xs font-bold ${quote.price > 0 ? rsiState.textStyle : 'text-slate-500'}`}>
                  {quote.price > 0 ? rsiState.value : '-'}
                </span>
              </div>

              {/* RSI Progress Bar */}
              <div
                className="h-2 w-full bg-slate-900 rounded-full relative overflow-hidden border border-white/10"
                title={
                  quote.price > 0
                    ? lang === 'ro'
                      ? `RSI: ${rsiState.value} | <30 Supravândut (OS), >70 Supracumpărat (OB)`
                      : `RSI: ${rsiState.value} | <30 Oversold (OS), >70 Overbought (OB)`
                    : '-'
                }
              >
                {/* Visual zone backgrounds: 0-30% Cyan, 30-70% Slate, 70-100% Rose */}
                <div className="absolute inset-0 flex pointer-events-none">
                  <div className="w-[30%] bg-cyan-500/10 border-r border-white/10" />
                  <div className="w-[40%] bg-white/[0.02] border-r border-white/10" />
                  <div className="w-[30%] bg-rose-500/10" />
                </div>

                {/* Filled indicator bar */}
                <div
                  className={`h-full bg-gradient-to-r ${quote.price > 0 ? rsiState.barGradient : 'from-slate-700 to-slate-700'} rounded-full transition-all duration-300 relative z-10 shadow-sm`}
                  style={{ width: `${quote.price > 0 ? rsiState.clamped : 0}%` }}
                />

                {/* Marker Pin */}
                {quote.price > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.9)] bg-indigo-500 transform -translate-x-1/2 z-20 transition-all duration-300 pointer-events-none"
                    style={{ left: `${rsiState.clamped}%` }}
                  />
                )}
              </div>

              {/* Threshold Labels */}
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 font-semibold px-0.5">
                <span className="text-cyan-400">30 OS</span>
                <span className="text-slate-400">50</span>
                <span className="text-rose-400">70 OB</span>
              </div>
            </div>

            {/* 2. MACD Momentum & Strength Bar */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MACD</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${quote.price > 0 ? macdState.badgeStyle : 'bg-slate-800/40 text-slate-500 border-white/5'}`}>
                    {quote.price > 0 ? macdState.statusText : '-'}
                  </span>
                </div>
                <span className={`font-mono text-xs font-bold ${quote.price > 0 ? macdState.textStyle : 'text-slate-500'}`}>
                  {quote.price > 0 ? formatMacdNumber(macdState.histogram) : '-'}
                </span>
              </div>

              {/* Center-balanced Bi-directional Momentum Bar */}
              <div
                className="h-2 w-full bg-slate-900 rounded-full relative overflow-hidden border border-white/10"
                title={
                  quote.price > 0
                    ? lang === 'ro'
                      ? `MACD: ${formatMacdNumber(macdState.value)} | Semnal: ${formatMacdNumber(macdState.signal)} | Histogramă: ${formatMacdNumber(macdState.histogram)}`
                      : `MACD: ${formatMacdNumber(macdState.value)} | Signal: ${formatMacdNumber(macdState.signal)} | Histogram: ${formatMacdNumber(macdState.histogram)}`
                    : '-'
                }
              >
                {/* Zone Backgrounds */}
                <div className="absolute inset-0 flex pointer-events-none">
                  <div className="w-1/2 bg-rose-500/10 border-r border-white/20" />
                  <div className="w-1/2 bg-emerald-500/10" />
                </div>

                {/* Center 0 Line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/40 z-10" />

                {/* Bullish Fill (Extends Right from 50%) */}
                {quote.price > 0 && macdState.isBullish && (
                  <div
                    className="absolute top-0 bottom-0 left-1/2 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-r-full transition-all duration-300 z-10 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    style={{ width: `${macdState.strengthPercent / 2}%` }}
                  />
                )}

                {/* Bearish Fill (Extends Left from 50%) */}
                {quote.price > 0 && macdState.isBearish && (
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-l from-rose-500 to-amber-500 rounded-l-full transition-all duration-300 z-10 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                    style={{ right: '50%', width: `${macdState.strengthPercent / 2}%` }}
                  />
                )}

                {/* Momentum Pin Dot */}
                {quote.price > 0 && macdState.isBullish && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.9)] bg-emerald-400 transform -translate-x-1/2 z-20 transition-all duration-300 pointer-events-none"
                    style={{ left: `${50 + macdState.strengthPercent / 2}%` }}
                  />
                )}
                {quote.price > 0 && macdState.isBearish && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-[0_0_8px_rgba(244,63,94,0.9)] bg-rose-400 transform -translate-x-1/2 z-20 transition-all duration-300 pointer-events-none"
                    style={{ left: `${50 - macdState.strengthPercent / 2}%` }}
                  />
                )}
                {(!quote.price || (!macdState.isBullish && !macdState.isBearish)) && (
                  <div className="absolute top-1/2 -translate-y-1/2 left-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm bg-slate-500 transform -translate-x-1/2 z-20 pointer-events-none" />
                )}
              </div>

              {/* MACD Reference Axis */}
              <div className="flex justify-between items-center text-[9px] font-mono font-semibold px-0.5">
                <span className="text-rose-400">{lang === 'ro' ? 'Urs (Bear)' : 'Bearish'}</span>
                <span className="text-slate-400">0</span>
                <span className="text-emerald-400">{lang === 'ro' ? 'Taur (Bull)' : 'Bullish'}</span>
              </div>
            </div>

            {/* 3. EMA 20 & Trend AI Row */}
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/10 font-mono">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">EMA 20:</span>
                <span className="font-bold text-white">
                  {hasRealPrice && quote.ema20 > 0 ? (id === 'EURUSD' || id === 'GBPUSD' ? quote.ema20.toFixed(5) : id === 'USDJPY' ? quote.ema20.toFixed(3) : `$${quote.ema20.toLocaleString('en-US', { maximumFractionDigits: 1 })}`) : '-'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Trend:</span>
                <span
                  title={
                    hasRealPrice
                      ? lang === 'ro'
                        ? `Trend tehnic calculat prin: EMA 20 vs Preț, aliniere SMA 50/200, histogramă MACD, RSI și variație zilnică`
                        : `Technical trend computed via: EMA 20 vs Price, SMA 50/200 alignment, MACD histogram, RSI, and daily change`
                      : '-'
                  }
                  className={`font-bold px-2 py-0.5 rounded text-[10px] cursor-help transition-all border ${
                  !hasRealPrice
                    ? 'bg-slate-800/40 text-slate-500 border-white/5'
                    : quote.trend === 'BULLISH'
                    ? 'liquid-emerald text-emerald-300 border-emerald-500/40'
                    : quote.trend === 'BEARISH'
                    ? 'liquid-rose text-rose-300 border-rose-500/40'
                    : 'bg-slate-800/80 text-slate-300 border-white/10'
                }`}>
                  {hasRealPrice ? quote.trend : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selection Prompt Footer */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400 pt-2.5 border-t border-white/10">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
            {isSelected ? (lang === 'ro' ? 'Activ pentru Analiză AI' : 'Active for AI Analysis') : (lang === 'ro' ? 'Apasă pentru selectare' : 'Click to select')}
          </span>
          <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'transform translate-x-1 text-cyan-400' : 'text-slate-500'}`} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 mb-6">
      {/* Informational Guidance Banner on Strength Indicators */}
      <div className="liquid-pill bg-slate-900/80 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 liquid-indigo text-indigo-300 rounded-xl shrink-0 border border-indigo-400/30">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white mr-1.5">
              {lang === 'ro' ? 'Indicatori de Forță Tehnică (RSI & MACD):' : 'Technical Strength Indicators (RSI & MACD):'}
            </span>
            <span className="text-slate-300">
              {lang === 'ro'
                ? 'Barele de progres vizualizează imediat condițiile de piață: RSI (<30 Supravândut, >70 Supracumpărat) și MACD (forța impulsului raportată la axa 0).'
                : 'Progress bars immediately reveal market conditions: RSI (<30 Oversold, >70 Overbought) & MACD momentum strength relative to the 0-axis.'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0 self-end sm:self-auto">
          <span className="px-2 py-0.5 rounded-full liquid-cyan text-cyan-300 font-bold border border-cyan-400/40">
            {lang === 'ro' ? 'OS ≤30' : 'OS ≤30'}
          </span>
          <span className="px-2 py-0.5 rounded-full liquid-rose text-rose-300 font-bold border border-rose-400/40">
            {lang === 'ro' ? 'OB ≥70' : 'OB ≥70'}
          </span>
        </div>
      </div>

      {/* SECTION 1: CFD INDICES & SPOT GOLD */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
            <span>{lang === 'ro' ? '1. Indici CFD, Spot Aur & Cripto (Cotații Live / LSE Feed)' : '1. CFD Indices, Spot Gold & Crypto (Live Quotes / LSE Feed)'}</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">{cfdInstruments.length} {lang === 'ro' ? 'active' : 'assets'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cfdInstruments.map(renderCard)}
        </div>
      </div>

      {/* SECTION 2: FUTURES CONTRACTS */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
            <span>{lang === 'ro' ? '2. Contracte Futures Live (CME & COMEX)' : '2. Live Futures Contracts (CME & COMEX)'}</span>
          </h3>
          <span className="text-[11px] text-amber-300 font-bold liquid-amber px-2 py-0.5 rounded-full border border-amber-500/40">
            {lang === 'ro' ? 'Valori specifice piață Futures (LSE Feed)' : 'Specific Futures Prices (LSE Feed)'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {futuresInstruments.map(renderCard)}
        </div>
      </div>

      {/* SECTION 3: FOREX SPOT (CURRENCIES) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span>{lang === 'ro' ? '3. Perechi Valutare Forex Spot (LSE Vault Feed)' : '3. Forex Spot Currency Pairs (LSE Vault Feed)'}</span>
          </h3>
          <span className="text-[11px] text-emerald-300 font-bold liquid-emerald px-2 py-0.5 rounded-full border border-emerald-500/40">
            {lang === 'ro' ? 'Prețuri directe Tick-by-Tick' : 'Direct Tick-by-Tick Data'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {forexInstruments.map(renderCard)}
        </div>
      </div>
    </div>
  );
};
