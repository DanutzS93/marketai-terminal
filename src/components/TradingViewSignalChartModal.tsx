import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Layers,
  Activity,
  Zap,
  Info,
  Calculator,
  RefreshCw,
  Sliders,
  Compass,
  BarChart2,
  CheckCircle2,
  Clock,
  Radio,
  ArrowDown,
  ArrowUp,
  Monitor,
} from 'lucide-react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import { TradingSignal, TimeFrame } from '../types';
import {
  formatSignalPrice,
  getOutcomeBadgeDetails,
  calculateExecutionType,
  getLocalizedSignalText,
  formatFullDateTime,
} from '../utils/signalUtils';

// TradingView official widget symbol mappings
const TV_SYMBOL_MAP: Record<string, string> = {
  NASDAQ: 'OANDA:NAS100USD',
  NAS100: 'OANDA:NAS100USD',
  'NQ.F': 'OANDA:NAS100USD',
  NQ_F: 'OANDA:NAS100USD',
  SPX500: 'OANDA:SPX500USD',
  SP500: 'OANDA:SPX500USD',
  'ES.F': 'OANDA:SPX500USD',
  ES_F: 'OANDA:SPX500USD',
  DOW_JONES: 'OANDA:US30USD',
  US30: 'OANDA:US30USD',
  'DOW.F': 'OANDA:US30USD',
  GOLD: 'OANDA:XAUUSD',
  XAUUSD: 'OANDA:XAUUSD',
  'XAU/USD': 'OANDA:XAUUSD',
  'GC.F': 'OANDA:XAUUSD',
  GC_F: 'OANDA:XAUUSD',
  EURUSD: 'FX:EURUSD',
  'EUR/USD': 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  'GBP/USD': 'FX:GBPUSD',
  USDJPY: 'FX:USDJPY',
  'USD/JPY': 'FX:USDJPY',
};

// Generates mathematically consistent realistic continuous candles if the external API is offline
function generateClientFallbackCandles(
  basePrice: number,
  timeframe: string,
  decimals: number
) {
  const stepSeconds =
    timeframe === '1m' ? 60 : timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : timeframe === '1d' ? 86400 : 300;
  const count = 75;
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * stepSeconds;
  const candles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  const pctVol = decimals === 5 ? 0.0003 : decimals === 3 ? 0.0005 : 0.0008;
  const volatility = basePrice * pctVol;

  let curr = Number((basePrice * (1 - (Math.random() * 0.003 - 0.0015))).toFixed(decimals));

  for (let i = 0; i < count; i++) {
    const time = startTime + i * stepSeconds;
    const isLast = i === count - 1;
    const open = curr;
    const delta = isLast ? basePrice - curr : (Math.random() - 0.49) * volatility;
    const close = isLast ? basePrice : Number((open + delta).toFixed(decimals));
    const high = Number((Math.max(open, close) + Math.random() * volatility * 0.5).toFixed(decimals));
    const low = Number((Math.min(open, close) - Math.random() * volatility * 0.5).toFixed(decimals));
    candles.push({ time, open, high, low, close });
    curr = close;
  }
  return candles;
}

interface TradingViewSignalChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: TradingSignal | null;
  lang: 'ro' | 'en';
  onOpenCalcModal?: () => void;
}

export const TradingViewSignalChartModal: React.FC<TradingViewSignalChartModalProps> = ({
  isOpen,
  onClose,
  signal,
  lang,
  onOpenCalcModal,
}) => {
  // All hooks MUST be called unconditionally at the top level (Rules of Hooks)
  const [chartMode, setChartMode] = useState<'smc' | 'tradingview'>('smc');
  const [selectedTf, setSelectedTf] = useState<string>(signal?.timeframe || '5m');
  const [showTradeLevels, setShowTradeLevels] = useState<boolean>(true);
  const [showMovingAverages, setShowMovingAverages] = useState<boolean>(true);
  const [showKeyLevels, setShowKeyLevels] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [livePrice, setLivePrice] = useState<number | null>(signal?.currentMarketPrice || null);
  const [livePricePrev, setLivePricePrev] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'strategy' | 'orderflow' | 'levels'>('strategy');

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvWidgetContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);
  const [isScrolledDown, setIsScrolledDown] = useState<boolean>(false);

  const handleContainerScroll = () => {
    if (scrollContainerRef.current) {
      setIsScrolledDown(scrollContainerRef.current.scrollTop > 80);
    }
  };

  const scrollToDetails = () => {
    if (detailsSectionRef.current) {
      detailsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Sync timeframe with signal when signal changes
  useEffect(() => {
    if (signal) {
      setSelectedTf(signal.timeframe || '5m');
      setLivePrice(signal.currentMarketPrice || null);
    }
  }, [signal?.id, signal?.timeframe]);

  // Helper calculation for EMA
  const calculateEMA = (data: { time: any; close: number }[], period: number) => {
    if (!data || data.length < period) return [];
    const k = 2 / (period + 1);
    const result: { time: any; value: number }[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    let prevEma = sum / period;
    result.push({ time: data[period - 1].time, value: parseFloat(prevEma.toFixed(2)) });

    for (let i = period; i < data.length; i++) {
      const currentEma = data[i].close * k + prevEma * (1 - k);
      result.push({ time: data[i].time, value: parseFloat(currentEma.toFixed(2)) });
      prevEma = currentEma;
    }
    return result;
  };

  // Helper calculation for SMA
  const calculateSMA = (data: { time: any; close: number }[], period: number) => {
    if (!data || data.length < period) return [];
    const result: { time: any; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      result.push({ time: data[i].time, value: parseFloat((sum / period).toFixed(2)) });
    }
    return result;
  };

  // Render & Update Price Lines (Entry, SL, TP1, TP2, TP3, POC, Key Levels)
  const renderPriceLines = useCallback(() => {
    if (!isOpen || !signal) return;
    const series = candlestickSeriesRef.current;
    if (!series) return;

    // Clear previous price lines safely
    priceLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    if (!showTradeLevels) return;

    const formattedEntry = formatSignalPrice(signal.entryPrice, signal.instrumentId, signal.symbol);
    const formattedSL = formatSignalPrice(signal.stopLoss, signal.instrumentId, signal.symbol);
    const formattedTP1 = formatSignalPrice(signal.targetPrice1, signal.instrumentId, signal.symbol);

    const addSafePriceLine = (options: {
      price: number | undefined | null;
      color: string;
      lineWidth?: number;
      lineStyle?: LineStyle;
      axisLabelVisible?: boolean;
      title?: string;
    }) => {
      if (typeof options.price !== 'number' || isNaN(options.price) || options.price <= 0) {
        return;
      }
      try {
        const line = series.createPriceLine({
          price: options.price,
          color: options.color,
          lineWidth: (options.lineWidth as any) || 1,
          lineStyle: options.lineStyle || LineStyle.Solid,
          axisLabelVisible: options.axisLabelVisible !== false,
          title: options.title || '',
        });
        if (line) {
          priceLinesRef.current.push(line);
        }
      } catch (err) {
        console.warn('Failed to create safe price line:', err);
      }
    };

    // 1. Entry Price Line
    addSafePriceLine({
      price: signal.entryPrice,
      color: '#3B82F6',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: `🎯 ENTRY ($${formattedEntry})`,
    });

    // 2. Stop Loss Line
    addSafePriceLine({
      price: signal.stopLoss,
      color: '#EF4444',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      title: `🛑 STOP LOSS ($${formattedSL})`,
    });

    // 3. Take Profit 1
    addSafePriceLine({
      price: signal.targetPrice1,
      color: '#10B981',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: `🎯 TP1 ($${formattedTP1})`,
    });

    // 4. Take Profit 2
    if (typeof signal.targetPrice2 === 'number' && !isNaN(signal.targetPrice2) && signal.targetPrice2 > 0) {
      const formattedTP2 = formatSignalPrice(signal.targetPrice2, signal.instrumentId, signal.symbol);
      addSafePriceLine({
        price: signal.targetPrice2,
        color: '#14B8A6',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: `🎯 TP2 ($${formattedTP2})`,
      });
    }

    // 5. Take Profit 3
    if (typeof signal.targetPrice3 === 'number' && !isNaN(signal.targetPrice3) && signal.targetPrice3 > 0) {
      const formattedTP3 = formatSignalPrice(signal.targetPrice3, signal.instrumentId, signal.symbol);
      addSafePriceLine({
        price: signal.targetPrice3,
        color: '#059669',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        title: `🎯 TP3 ($${formattedTP3})`,
      });
    }

    // Key Levels & POC
    if (showKeyLevels && signal.keyLevels) {
      if (typeof signal.keyLevels.poc === 'number' && !isNaN(signal.keyLevels.poc) && signal.keyLevels.poc > 0) {
        addSafePriceLine({
          price: signal.keyLevels.poc,
          color: '#EAB308',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: `📊 POC ($${formatSignalPrice(signal.keyLevels.poc, signal.instrumentId, signal.symbol)})`,
        });
      }

      if (typeof signal.keyLevels.val === 'number' && !isNaN(signal.keyLevels.val) && signal.keyLevels.val > 0) {
        addSafePriceLine({
          price: signal.keyLevels.val,
          color: '#8B5CF6',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: 'VAL',
        });
      }

      if (typeof signal.keyLevels.vah === 'number' && !isNaN(signal.keyLevels.vah) && signal.keyLevels.vah > 0) {
        addSafePriceLine({
          price: signal.keyLevels.vah,
          color: '#8B5CF6',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: 'VAH',
        });
      }

      (signal.keyLevels.support || []).slice(0, 2).forEach((sup, idx) => {
        if (typeof sup === 'number' && !isNaN(sup) && sup > 0) {
          addSafePriceLine({
            price: sup,
            color: '#06B6D4',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: `S${idx + 1}`,
          });
        }
      });

      (signal.keyLevels.resistance || []).slice(0, 2).forEach((res, idx) => {
        if (typeof res === 'number' && !isNaN(res) && res > 0) {
          addSafePriceLine({
            price: res,
            color: '#F97316',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: `R${idx + 1}`,
          });
        }
      });
    }
  }, [isOpen, showTradeLevels, showKeyLevels, signal]);

  // Synchronize price lines whenever toggles or signal changes
  useEffect(() => {
    renderPriceLines();
  }, [renderPriceLines]);

  // Build & Render Chart with Lightweight Charts
  useEffect(() => {
    if (!isOpen || !signal || !chartContainerRef.current) return;
    let isSubscribed = true;

    const container = chartContainerRef.current;
    container.innerHTML = '';
    priceLinesRef.current = [];

    const initialWidth = container.clientWidth || 800;
    const initialHeight = container.clientHeight || 420;

    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#090D16' },
        textColor: '#94A3B8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366F1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#4F46E5',
        },
        horzLine: {
          color: '#6366F1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#4F46E5',
        },
      },
      rightPriceScale: {
        borderColor: '#1E293B',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: selectedTf === '1m' || selectedTf === '5m',
        borderColor: '#1E293B',
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartInstanceRef.current = chart;

    // Candlestick Series
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

    candlestickSeriesRef.current = candlestickSeries;

    // Moving Averages Line Series
    const emaSeries = (chart as any).addLineSeries
      ? (chart as any).addLineSeries({
          color: '#38BDF8', // Sky blue for EMA 20
          lineWidth: 2,
          title: 'EMA 20',
          priceLineVisible: false,
        })
      : chart.addSeries(LineSeries, {
          color: '#38BDF8',
          lineWidth: 2,
          title: 'EMA 20',
          priceLineVisible: false,
        });

    const smaSeries = (chart as any).addLineSeries
      ? (chart as any).addLineSeries({
          color: '#F59E0B', // Amber for SMA 50
          lineWidth: 2,
          title: 'SMA 50',
          priceLineVisible: false,
        })
      : chart.addSeries(LineSeries, {
          color: '#F59E0B',
          lineWidth: 2,
          title: 'SMA 50',
          priceLineVisible: false,
        });

    emaSeriesRef.current = emaSeries;
    smaSeriesRef.current = smaSeries;

    // Responsive Canvas Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartInstanceRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        try {
          chartInstanceRef.current.applyOptions({ width, height });
        } catch (e) {}
      }
    });
    resizeObserver.observe(container);

    // Fetch Candles with Automatic Resilient Fallback
    setIsLoading(true);
    const targetSymbol = signal.symbol || signal.instrumentId;
    const decimals =
      signal.instrumentId === 'EURUSD' || signal.instrumentId === 'GBPUSD'
        ? 5
        : signal.instrumentId === 'USDJPY'
        ? 3
        : 2;

    const fetchCandles = async () => {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(targetSymbol)}&timeframe=${encodeURIComponent(selectedTf)}`
        );
        let sanitizedCandles: any[] = [];
        let currPrice: number | null = null;

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.candles) && data.candles.length > 0) {
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
            for (const c of validCandles) {
              if (!seenTimes.has(c.time)) {
                seenTimes.add(c.time);
                sanitizedCandles.push(c);
              }
            }
            sanitizedCandles.sort((a, b) => a.time - b.time);
            if (typeof data.currentLivePrice === 'number') {
              currPrice = data.currentLivePrice;
            }
          }
        }

        // If API returned 0 candles or was offline, generate continuous fallback candles anchored to live price
        if (sanitizedCandles.length === 0) {
          const base =
            typeof signal.currentMarketPrice === 'number' && signal.currentMarketPrice > 0
              ? signal.currentMarketPrice
              : signal.entryPrice || 100;
          sanitizedCandles = generateClientFallbackCandles(base, selectedTf, decimals);
          currPrice = base;
        }

        if (isSubscribed && sanitizedCandles.length > 0) {
          try {
            candlestickSeries.setData(sanitizedCandles);
          } catch (e) {
            console.warn('Could not set candlestick data:', e);
          }

          // Update Moving Averages
          const emaData = calculateEMA(sanitizedCandles, 20);
          const smaData = calculateSMA(sanitizedCandles, 50);
          try {
            emaSeries.setData(showMovingAverages ? emaData : []);
            smaSeries.setData(showMovingAverages ? smaData : []);
          } catch (e) {}

          // Update Live Price state
          const lastCandle = sanitizedCandles[sanitizedCandles.length - 1];
          const finalPrice = currPrice !== null ? currPrice : lastCandle.close;
          setLivePrice((prev) => {
            setLivePricePrev(prev);
            return finalPrice;
          });

          setLastUpdatedTime(new Date().toLocaleTimeString());

          // Render trade levels & fit content
          renderPriceLines();
          try {
            chart.timeScale().fitContent();
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Failed to fetch candles for signal chart, generating fallback:', err);
        if (isSubscribed && candlestickSeriesRef.current) {
          const base =
            typeof signal.currentMarketPrice === 'number' && signal.currentMarketPrice > 0
              ? signal.currentMarketPrice
              : signal.entryPrice || 100;
          const fallbackCandles = generateClientFallbackCandles(base, selectedTf, decimals);
          try {
            candlestickSeriesRef.current.setData(fallbackCandles);
            const emaData = calculateEMA(fallbackCandles, 20);
            const smaData = calculateSMA(fallbackCandles, 50);
            if (emaSeriesRef.current) emaSeriesRef.current.setData(showMovingAverages ? emaData : []);
            if (smaSeriesRef.current) smaSeriesRef.current.setData(showMovingAverages ? smaData : []);
            renderPriceLines();
            if (chartInstanceRef.current) chartInstanceRef.current.timeScale().fitContent();
          } catch (e) {}
        }
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    };

    fetchCandles();

    // 3-second live price polling
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(targetSymbol)}&timeframe=${encodeURIComponent(selectedTf)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isSubscribed && Array.isArray(data.candles) && data.candles.length > 0) {
          const lastCandle = data.candles[data.candles.length - 1];
          if (
            lastCandle &&
            typeof lastCandle.time === 'number' &&
            typeof lastCandle.open === 'number' &&
            typeof lastCandle.high === 'number' &&
            typeof lastCandle.low === 'number' &&
            typeof lastCandle.close === 'number'
          ) {
            try {
              candlestickSeries.update(lastCandle);
            } catch (e) {}
            const curr = typeof data.currentLivePrice === 'number' ? data.currentLivePrice : lastCandle.close;
            setLivePrice((prev) => {
              setLivePricePrev(prev);
              return curr;
            });
            setLastUpdatedTime(new Date().toLocaleTimeString());
          }
        }
      } catch (e) {}
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(pollTimer);
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (e) {}
        chartInstanceRef.current = null;
        candlestickSeriesRef.current = null;
        emaSeriesRef.current = null;
        smaSeriesRef.current = null;
        priceLinesRef.current = [];
      }
    };
  }, [isOpen, signal?.id, selectedTf, renderPriceLines]);

  // Official TradingView Advanced Chart Widget Initialization
  useEffect(() => {
    if (!isOpen || !signal || chartMode !== 'tradingview') return;
    let isMounted = true;
    const container = tvWidgetContainerRef.current;
    if (!container) return;

    try {
      container.innerHTML = '';
    } catch (_) {}

    const tvSym =
      TV_SYMBOL_MAP[signal.symbol] ||
      TV_SYMBOL_MAP[signal.instrumentId] ||
      TV_SYMBOL_MAP[signal.symbol.replace('/', '')] ||
      'OANDA:NAS100USD';

    const containerId = `tv_modal_${Math.random().toString(36).substring(7)}`;
    const chartDiv = document.createElement('div');
    chartDiv.id = containerId;
    chartDiv.className = 'w-full h-full min-h-[380px]';
    container.appendChild(chartDiv);

    const userTimezone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC';
      } catch (e) {
        return 'Etc/UTC';
      }
    })();

    const initTvWidget = () => {
      if (!isMounted) return;
      if ((window as any).TradingView && document.getElementById(containerId)) {
        try {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: tvSym,
            interval:
              selectedTf === '1m'
                ? '1'
                : selectedTf === '5m'
                ? '5'
                : selectedTf === '15m'
                ? '15'
                : selectedTf === '1h'
                ? '60'
                : 'D',
            timezone: userTimezone,
            theme: 'dark',
            style: '1',
            locale: lang === 'ro' ? 'ro' : 'en',
            toolbar_bg: '#090D16',
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: containerId,
            hide_side_toolbar: false,
            studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
          });
        } catch (e) {
          console.warn('TradingView modal widget init warning:', e);
        }
      }
    };

    let timer: any = null;
    if ((window as any).TradingView) {
      timer = setTimeout(initTvWidget, 50);
    } else {
      const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', initTvWidget);
      } else {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = initTvWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (container) {
        const iframes = container.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          try {
            iframe.src = 'about:blank';
          } catch (_) {}
        });
        try {
          container.innerHTML = '';
        } catch (_) {}
      }
    };
  }, [isOpen, signal?.id, chartMode, selectedTf, lang]);

  // Handle switching back to SMC mode: resize and fit content cleanly
  useEffect(() => {
    if (chartMode === 'smc' && chartInstanceRef.current && chartContainerRef.current) {
      setTimeout(() => {
        try {
          const w = chartContainerRef.current?.clientWidth || 0;
          const h = chartContainerRef.current?.clientHeight || 0;
          if (w > 0 && h > 0) {
            chartInstanceRef.current?.applyOptions({ width: w, height: h });
          }
          chartInstanceRef.current?.timeScale().fitContent();
          renderPriceLines();
        } catch (e) {}
      }, 50);
    }
  }, [chartMode, renderPriceLines]);

  // Toggle Moving Averages visibility
  useEffect(() => {
    if (emaSeriesRef.current && smaSeriesRef.current) {
      emaSeriesRef.current.applyOptions({ visible: showMovingAverages });
      smaSeriesRef.current.applyOptions({ visible: showMovingAverages });
    }
  }, [showMovingAverages]);

  const handleResetZoom = () => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  };

  const getPriceFlashClass = () => {
    if (!livePrice || !livePricePrev) return 'text-slate-100';
    if (livePrice > livePricePrev) return 'text-emerald-400 font-bold';
    if (livePrice < livePricePrev) return 'text-rose-400 font-bold';
    return 'text-slate-100';
  };

  const timeframes: { id: string; label: string }[] = [
    { id: '1m', label: '1m' },
    { id: '5m', label: '5m' },
    { id: '15m', label: '15m' },
    { id: '1h', label: '1H' },
    { id: '1d', label: '1D' },
  ];

  // If modal is closed or no signal provided, return null AFTER all hooks have executed unconditionally
  if (!isOpen || !signal) return null;

  const isBuy = signal.type.includes('BUY');
  const entryPrice = signal.entryPrice;
  const slPrice = signal.stopLoss;
  const tp1Price = signal.targetPrice1;
  const tp2Price = signal.targetPrice2;
  const tp3Price = signal.targetPrice3;

  const riskDistance = Math.abs(entryPrice - slPrice);
  const tp1Distance = Math.abs(tp1Price - entryPrice);
  const tp2Distance = typeof tp2Price === 'number' ? Math.abs(tp2Price - entryPrice) : 0;
  const tp3Distance = typeof tp3Price === 'number' ? Math.abs(tp3Price - entryPrice) : 0;

  const riskPercent = entryPrice > 0 ? ((riskDistance / entryPrice) * 100).toFixed(2) : '0.00';
  const execType =
    signal.executionType ||
    calculateExecutionType(signal.type, signal.entryPrice, signal.currentMarketPrice || signal.entryPrice);

  const outcomeBadge = getOutcomeBadgeDetails(
    signal.outcomeStatus,
    lang,
    signal.isBeHitAfterTp1,
    signal.isBeHitAfterTp2
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-gradient-to-b from-[#0A1326]/95 via-[#080E1C]/95 to-[#040813]/98 text-white border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 w-full relative glass-specular-top ${
          isFullscreen
            ? 'h-[100dvh] max-w-none rounded-none'
            : 'max-w-[96vw] xl:max-w-7xl h-[92vh] max-h-[920px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="bg-[#0e1424] border-b border-slate-800 px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Instrument & Signal Identification */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                {signal.instrumentName}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                {signal.symbol}
              </span>
            </div>

            {/* Signal Action Badge */}
            <span
              className={`px-2.5 py-1 rounded text-xs font-black uppercase flex items-center gap-1.5 shadow-sm ${
                isBuy ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{signal.type.replace('_', ' ')}</span>
            </span>

            {/* Order Execution Type */}
            <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-800 text-indigo-300 border border-indigo-900/60 hidden sm:inline-flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{execType}</span>
            </span>

            {/* Outcome Badge */}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${outcomeBadge.badgeClass}`}>
              {outcomeBadge.label}
            </span>
          </div>

          {/* Center: Live Price Display */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {lang === 'ro' ? 'Preț Live Piață' : 'Live Market Price'}
              </div>
              <div className={`font-mono text-sm sm:text-base font-black transition-colors ${getPriceFlashClass()}`}>
                {livePrice !== null && livePrice > 0 ? `$${formatSignalPrice(livePrice, signal.instrumentId, signal.symbol)}` : '-'}
              </div>
            </div>
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isFullscreen ? 'Ieșire Fullscreen' : 'Ecran Complet (Fullscreen)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
              title="Închide fereastra"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOOLBAR: Mode Switch, Timeframes, Indicators, and Layer Toggles */}
        <div className="bg-[#090D16] border-b border-slate-800/80 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Left: View Mode Toggle & Timeframe Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: SMC vs Official TradingView */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setChartMode('smc')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  chartMode === 'smc'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={lang === 'ro' ? 'Grafic Tehnic Interactiv cu Niveluri SMC, Entry, SL, TP' : 'Interactive SMC Technical Chart'}
              >
                <BarChart2 className="w-3.5 h-3.5 text-blue-300" />
                <span>{lang === 'ro' ? 'Grafic Tehnic (SMC)' : 'SMC Technical'}</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('tradingview')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  chartMode === 'tradingview'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={lang === 'ro' ? 'Platformă Grafică Avansată TradingView Oficial' : 'Official TradingView Chart'}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>TradingView Oficial</span>
              </button>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase tracking-wider hidden sm:inline">
                TF:
              </span>
              {timeframes.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setSelectedTf(tf.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    selectedTf === tf.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Indicator & Layer Toggles (Visible in SMC mode) */}
          {chartMode === 'smc' ? (
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {/* Trade Levels (Entry / SL / TP) */}
              <button
                onClick={() => setShowTradeLevels(!showTradeLevels)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  showTradeLevels
                    ? 'bg-blue-950/60 text-blue-300 border-blue-700/60'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Activează / Dezactivează afișarea Entry, SL și TP pe grafic"
              >
                <Target className="w-3 h-3 text-blue-400" />
                <span>{lang === 'ro' ? 'Niveluri Trade (SL/TP)' : 'Trade Levels (SL/TP)'}</span>
              </button>

              {/* Moving Averages (EMA 20 / SMA 50) */}
              <button
                onClick={() => setShowMovingAverages(!showMovingAverages)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  showMovingAverages
                    ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Activează / Dezactivează EMA 20 (albastru) și SMA 50 (galben)"
              >
                <Activity className="w-3 h-3 text-amber-400" />
                <span>EMA 20 & SMA 50</span>
              </button>

              {/* S/R & POC */}
              <button
                onClick={() => setShowKeyLevels(!showKeyLevels)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  showKeyLevels
                    ? 'bg-purple-950/60 text-purple-300 border-purple-700/60'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Afișează POC și Nivelurile Cheie de Suport / Rezistență"
              >
                <Layers className="w-3 h-3 text-purple-400" />
                <span>POC & S/R</span>
              </button>

              {/* Reset Zoom */}
              <button
                onClick={handleResetZoom}
                className="p-1 rounded-md text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
                title="Re-centrează graficul"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>TradingView Live Stream Active</span>
            </div>
          )}
        </div>

        {/* MAIN BODY: CHART & DRAWER */}
        <div
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative custom-scrollbar"
        >
          {/* CHART CANVAS AREA */}
          <div className="w-full h-[360px] sm:h-[420px] lg:h-full lg:flex-1 relative flex flex-col shrink-0 lg:shrink bg-[#090D16]">
            {/* Loading Overlay */}
            {isLoading && chartMode === 'smc' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#090D16]/80 backdrop-blur-xs">
                <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin mb-2" />
                <span className="text-xs font-bold text-slate-300">
                  {lang === 'ro'
                    ? 'Se încarcă datele de lumânări și indicatori...'
                    : 'Loading candlestick & indicator data...'}
                </span>
              </div>
            )}

            {/* Chart Legend on Top of Canvas (SMC Mode) */}
            {chartMode === 'smc' && (
              <div className="absolute top-2 left-3 z-10 flex flex-wrap items-center gap-3 pointer-events-none bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800/80 text-[10px] font-mono">
                <div className="flex items-center gap-1 text-slate-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Cumpărare</span>
                </div>
                <div className="flex items-center gap-1 text-slate-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  <span>Vânzare</span>
                </div>
                {showMovingAverages && (
                  <>
                    <div className="flex items-center gap-1 text-sky-400 font-bold">
                      <span className="w-2.5 h-0.5 bg-sky-400 inline-block"></span>
                      <span>EMA 20</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <span className="w-2.5 h-0.5 bg-amber-400 inline-block"></span>
                      <span>SMA 50</span>
                    </div>
                  </>
                )}
                {showTradeLevels && (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold">● Intrare: ${formatSignalPrice(entryPrice, signal.instrumentId, signal.symbol)}</span>
                    <span className="text-rose-400 font-bold">● SL: ${formatSignalPrice(slPrice, signal.instrumentId, signal.symbol)}</span>
                    <span className="text-emerald-400 font-bold">● TP1: ${formatSignalPrice(tp1Price, signal.instrumentId, signal.symbol)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Interactive Lightweight Candlestick Chart Container (SMC) */}
            <div
              ref={chartContainerRef}
              className={`w-full flex-1 min-h-[300px] h-full ${chartMode === 'smc' ? 'block' : 'hidden'}`}
            />

            {/* Official TradingView Advanced Widget Container */}
            <div
              ref={tvWidgetContainerRef}
              className={`w-full flex-1 min-h-[380px] h-full ${chartMode === 'tradingview' ? 'block' : 'hidden'}`}
            />
          </div>

          {/* SIDE PANEL / STRATEGY DRAWER */}
          <div
            ref={detailsSectionRef}
            className="w-full lg:w-88 xl:w-96 bg-[#0B0F19] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0 lg:h-full lg:overflow-hidden"
          >
            {/* Tab Navigation */}
            <div className="sticky top-0 z-20 flex items-center border-b border-slate-800 bg-[#0e1424] px-2 py-1 text-xs shrink-0 shadow-sm">
              <button
                onClick={() => setActiveTab('strategy')}
                className={`flex-1 py-1.5 text-center font-bold rounded-md transition cursor-pointer ${
                  activeTab === 'strategy'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ro' ? 'Strategie & Risc' : 'Strategy & Risk'}
              </button>
              <button
                onClick={() => setActiveTab('orderflow')}
                className={`flex-1 py-1.5 text-center font-bold rounded-md transition cursor-pointer ${
                  activeTab === 'orderflow'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Order Flow
              </button>
              <button
                onClick={() => setActiveTab('levels')}
                className={`flex-1 py-1.5 text-center font-bold rounded-md transition cursor-pointer ${
                  activeTab === 'levels'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'ro' ? 'Niveluri' : 'Levels'}
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-3 sm:p-4 space-y-4 text-xs lg:flex-1 lg:overflow-y-auto custom-scrollbar pb-16 lg:pb-4">
              {activeTab === 'strategy' && (
                <>
                  {/* Risk / Reward Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Risc / Recompensă
                      </span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        {signal.riskRewardRatio || '1:2.5'}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Încredere Model AI
                      </span>
                      <span className="text-sm font-black text-indigo-400 font-mono">
                        {signal.confidencePercent}%
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Distanță Risc (SL)
                      </span>
                      <span className="text-xs font-black text-rose-400 font-mono">
                        -{riskDistance.toFixed(1)} pct ({riskPercent}%)
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Țintă Principală (TP1)
                      </span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        +{tp1Distance.toFixed(1)} pct
                      </span>
                    </div>
                  </div>

                  {/* AI Trade Plan / Rationale */}
                  <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                      <Info className="w-3.5 h-3.5" />
                      <span>{lang === 'ro' ? 'Justificare Intrare' : 'Trade Rationale'}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans max-h-36 overflow-y-auto pr-1">
                      {getLocalizedSignalText(signal, 'rationale', lang)}
                    </p>
                  </div>

                  {/* Technical Indicator States */}
                  <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ro' ? 'Confirmări Indicatori' : 'Indicator Confirmations'}
                    </span>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">RSI Status:</span>
                        <span className="font-bold text-slate-200">
                          {signal.indicators?.rsiStatus || '48.5 (Neutru)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">MACD:</span>
                        <span className="font-bold text-slate-200">
                          {signal.indicators?.macdStatus || 'Bullish Momentum'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Volatilitate:</span>
                        <span className="font-bold text-slate-200">
                          {signal.indicators?.volatility || 'Normală'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Medii Mobile:</span>
                        <span className="font-bold text-slate-200">
                          {signal.indicators?.movingAverages || 'Peste EMA 20'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'orderflow' && (
                <>
                  {/* Order Flow Summary */}
                  <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {lang === 'ro' ? 'Profil Volum & Delta' : 'Volume & Delta Profile'}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-400 font-mono">
                        {signal.orderFlow?.deltaStatus || 'BULLISH_ABSORPTION'}
                      </span>
                    </div>

                    {/* Delta Meter */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-emerald-400 font-bold">
                          Cumpărători: {signal.orderFlow?.buyVolumePercent || 64}%
                        </span>
                        <span className="text-rose-400 font-bold">
                          Vânzători: {signal.orderFlow?.sellVolumePercent || 36}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-rose-950 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${signal.orderFlow?.buyVolumePercent || 64}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] pt-1">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Delta Net:</span>
                        <span
                          className={`font-mono font-bold ${
                            (signal.orderFlow?.delta || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {(signal.orderFlow?.delta || 0) >= 0 ? '+' : ''}
                          {signal.orderFlow?.delta || 1420} loturi
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Presiune Instituțională:</span>
                        <span className="font-bold text-slate-200">
                          {signal.orderFlow?.institutionalPressure || 'HIGH_BUYING'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tip Dezechilibru:</span>
                        <span className="font-bold text-slate-200">
                          {signal.orderFlow?.imbalanceType || 'BUY_SIDE_STACKED'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'levels' && (
                <>
                  {/* Detailed Levels List */}
                  <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ro' ? 'Niveluri Exacte de Execuție' : 'Exact Execution Levels'}
                    </span>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between p-2 rounded bg-blue-950/40 border border-blue-800/40">
                        <span className="text-blue-300 font-bold">🎯 INTRARE (ENTRY):</span>
                        <span className="text-white font-black">${formatSignalPrice(entryPrice, signal.instrumentId, signal.symbol)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded bg-rose-950/40 border border-rose-800/40">
                        <span className="text-rose-300 font-bold">🛑 STOP LOSS:</span>
                        <span className="text-rose-400 font-black">${formatSignalPrice(slPrice, signal.instrumentId, signal.symbol)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded bg-emerald-950/40 border border-emerald-800/40">
                        <span className="text-emerald-300 font-bold">🎯 TP1 (Principal):</span>
                        <span className="text-emerald-400 font-black">${formatSignalPrice(tp1Price, signal.instrumentId, signal.symbol)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded bg-teal-950/40 border border-teal-800/40">
                        <span className="text-teal-300 font-bold">🎯 TP2 (Extins):</span>
                        <span className="text-teal-400 font-black">${formatSignalPrice(tp2Price, signal.instrumentId, signal.symbol)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded bg-green-950/40 border border-green-800/40">
                        <span className="text-green-300 font-bold">🎯 TP3 (Maxim):</span>
                        <span className="text-green-400 font-black">${formatSignalPrice(tp3Price, signal.instrumentId, signal.symbol)}</span>
                      </div>

                      {signal.keyLevels?.poc && (
                        <div className="flex items-center justify-between p-2 rounded bg-amber-950/40 border border-amber-800/40">
                          <span className="text-amber-300 font-bold">📊 Point of Control (POC):</span>
                          <span className="text-amber-400 font-black">${formatSignalPrice(signal.keyLevels.poc, signal.instrumentId, signal.symbol)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ACTION: OPEN RISK CALCULATOR */}
              {onOpenCalcModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCalcModal();
                  }}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  <Calculator className="w-4 h-4 text-indigo-200" />
                  <span>{lang === 'ro' ? 'Calculează Lotul în Calculator Risc 🧮' : 'Calculate Lots in Risk Calc 🧮'}</span>
                </button>
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="bg-[#090D16] border-t border-slate-800 px-3 py-2 flex items-center justify-between text-[10px] text-slate-500 shrink-0 font-mono">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Semnal creat: {formatFullDateTime(signal.createdAt, lang)}</span>
              </div>
              {lastUpdatedTime && <span>Act: {lastUpdatedTime}</span>}
            </div>
          </div>
        </div>

        {/* Mobile Floating Scroll Navigation Helper */}
        <div className="lg:hidden absolute bottom-3 right-3 z-30 pointer-events-auto">
          <button
            onClick={isScrolledDown ? scrollToTop : scrollToDetails}
            className="bg-indigo-600/90 hover:bg-indigo-500 active:scale-95 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-xl backdrop-blur-md border border-indigo-400/40 flex items-center gap-1.5 transition-all cursor-pointer"
            title={isScrolledDown ? 'Derulează la grafic' : 'Derulează la detalii și strategie'}
          >
            {isScrolledDown ? (
              <>
                <ArrowUp className="w-3.5 h-3.5 text-indigo-200" />
                <span>{lang === 'ro' ? 'Grafic Sus ↑' : 'Chart Top ↑'}</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-indigo-200 animate-bounce" />
                <span>{lang === 'ro' ? 'Derulează Detalii ↓' : 'Scroll Details ↓'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
