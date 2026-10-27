import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { createChart, ColorType, IChartApi, CandlestickSeries } from 'lightweight-charts';
import { InstrumentId } from '../types';

interface LseSupplementaryChartProps {
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
  quotes?: Record<InstrumentId, any>;
  lang: 'ro' | 'en';
}

type LsePairKey = 'NQ.F' | 'ES.F' | 'DOW.F' | 'GC.F';

export const LseSupplementaryChart: React.FC<LseSupplementaryChartProps> = ({
  selectedInstrument,
  onSelectInstrument,
  quotes,
  lang,
}) => {
  const [activePair, setActivePair] = useState<LsePairKey>('NQ.F');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('5m');

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  // Sync active pair with parent instrument selection
  useEffect(() => {
    if (selectedInstrument === 'NQ_F' || selectedInstrument === 'NASDAQ') {
      setActivePair('NQ.F');
    } else if (selectedInstrument === 'ES_F' || selectedInstrument === 'SPX500') {
      setActivePair('ES.F');
    } else if (selectedInstrument === 'YM_F' || selectedInstrument === 'DOW_JONES') {
      setActivePair('DOW.F');
    } else if (selectedInstrument === 'GC_F' || selectedInstrument === 'GOLD') {
      setActivePair('GC.F');
    }
  }, [selectedInstrument]);

  const lsePairs: {
    id: LsePairKey;
    appInstrument: InstrumentId;
    label: string;
    basePrice: number;
  }[] = [
    {
      id: 'NQ.F',
      appInstrument: 'NQ_F',
      label: 'NQ.F (Nasdaq Futures)',
      basePrice: (quotes?.NQ_F?.price && quotes.NQ_F.price > 0) ? quotes.NQ_F.price : (quotes?.NASDAQ?.price && quotes.NASDAQ.price > 0 ? quotes.NASDAQ.price : 0),
    },
    {
      id: 'ES.F',
      appInstrument: 'ES_F',
      label: 'ES.F (S&P 500 Futures)',
      basePrice: (quotes?.ES_F?.price && quotes.ES_F.price > 0) ? quotes.ES_F.price : (quotes?.SPX500?.price && quotes.SPX500.price > 0 ? quotes.SPX500.price : 0),
    },
    {
      id: 'DOW.F',
      appInstrument: 'YM_F',
      label: 'DOW.F (Dow Jones Futures)',
      basePrice: (quotes?.YM_F?.price && quotes.YM_F.price > 0) ? quotes.YM_F.price : (quotes?.DOW_JONES?.price && quotes.DOW_JONES.price > 0 ? quotes.DOW_JONES.price : 0),
    },
    {
      id: 'GC.F',
      appInstrument: 'GC_F',
      label: 'GC.F (Gold Futures)',
      basePrice: (quotes?.GC_F?.price && quotes.GC_F.price > 0) ? quotes.GC_F.price : (quotes?.GOLD?.price && quotes.GOLD.price > 0 ? quotes.GOLD.price : 0),
    },
  ];

  const currentPair = lsePairs.find((p) => p.id === activePair) || lsePairs[0];

  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);

  // Lightweight Canvas Candlestick Chart Generator with real API candles
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let isSubscribed = true;
    const container = chartContainerRef.current;
    container.innerHTML = '';

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#090D16' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
      },
      width: container.clientWidth,
      height: 540,
      timeScale: {
        timeVisible: true,
        secondsVisible: timeframe === '1m' || timeframe === '5m',
        borderColor: '#334155',
      },
    });

    chartInstanceRef.current = chart;

    const candlestickSeries = (chart as any).addCandlestickSeries
      ? (chart as any).addCandlestickSeries({
          upColor: '#10B981',
          downColor: '#EF4444',
          borderVisible: false,
          wickUpColor: '#10B981',
          wickDownColor: '#EF4444',
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: '#10B981',
          downColor: '#EF4444',
          borderVisible: false,
          wickUpColor: '#10B981',
          wickDownColor: '#EF4444',
        });

    setIsLoadingCandles(true);

    const loadRealCandles = async () => {
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(activePair)}&timeframe=${timeframe}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (isSubscribed && Array.isArray(data.candles) && data.candles.length > 0) {
          const validCandles = data.candles.filter(
            (c: any) =>
              c &&
              typeof c.time === 'number' &&
              !isNaN(c.time) &&
              typeof c.open === 'number' &&
              !isNaN(c.open) &&
              typeof c.high === 'number' &&
              !isNaN(c.high) &&
              typeof c.low === 'number' &&
              !isNaN(c.low) &&
              typeof c.close === 'number' &&
              !isNaN(c.close)
          );
          const seenTimes = new Set<number>();
          const sanitized: typeof validCandles = [];
          for (const c of validCandles) {
            if (!seenTimes.has(c.time)) {
              seenTimes.add(c.time);
              sanitized.push(c);
            }
          }
          sanitized.sort((a, b) => a.time - b.time);

          if (sanitized.length > 0) {
            try {
              candlestickSeries.setData(sanitized);
            } catch (e) {}
            if (typeof data.currentLivePrice === 'number') {
              setLivePrice(data.currentLivePrice);
            } else {
              setLivePrice(sanitized[sanitized.length - 1].close);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch real API candles, falling back to live quote prices:', err);
      } finally {
        if (isSubscribed) setIsLoadingCandles(false);
      }
    };

    loadRealCandles();

    // Poll live market API every 3 seconds for real candle updates
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(activePair)}&timeframe=${timeframe}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isSubscribed && Array.isArray(data.candles) && data.candles.length > 0) {
          const last = data.candles[data.candles.length - 1];
          if (
            last &&
            typeof last.time === 'number' &&
            typeof last.open === 'number' &&
            typeof last.high === 'number' &&
            typeof last.low === 'number' &&
            typeof last.close === 'number'
          ) {
            try {
              candlestickSeries.update(last);
            } catch (e) {}
            if (typeof data.currentLivePrice === 'number') {
              setLivePrice(data.currentLivePrice);
            }
          }
        }
      } catch (_) {}
    }, 3000);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      window.removeEventListener('resize', handleResize);
      try {
        chart.remove();
      } catch (_) {}
    };
  }, [activePair, timeframe]);

  return (
    <div className="w-full bg-[#090D16] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl mb-8">
      {/* Header bar with Pair Selector and Timeframe Selector */}
      <div className="bg-slate-950 px-3 py-3 sm:px-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Pair Buttons (NQ.F, ES.F, GC.F) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {lsePairs.map((pair) => (
              <button
                key={pair.id}
                onClick={() => {
                  setActivePair(pair.id);
                  onSelectInstrument(pair.appInstrument);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition flex items-center gap-1.5 ${
                  activePair === pair.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black scale-105'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{pair.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(['1m', '5m', '15m', '1h', '1d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                timeframe === tf
                  ? 'bg-slate-700 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Display Body */}
      <div className="relative w-full h-[520px] sm:h-[600px] bg-[#090D16]">
        <div className="w-full h-full relative">
          <div ref={chartContainerRef} className="w-full h-full" />
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-2 shadow-lg z-10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white">{currentPair.id}</span>
            <span className="text-slate-400">|</span>
            <span className="text-amber-400 font-bold">
              {(() => {
                const effectivePrice = (livePrice && livePrice > 0) ? livePrice : (currentPair.basePrice && currentPair.basePrice > 0 ? currentPair.basePrice : 0);
                return effectivePrice > 0
                  ? `${effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                  : '-';
              })()}
            </span>
            {isLoadingCandles && (
              <span className="text-[10px] text-slate-400 italic animate-pulse ml-1">
                ({lang === 'ro' ? 'Se încarcă date API...' : 'Loading API data...'})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
