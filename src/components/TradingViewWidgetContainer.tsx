import React, { useEffect, useRef, useState } from 'react';
import { BarChart2, Shield, Layers, RefreshCw, Maximize2, Gauge } from 'lucide-react';
import { InstrumentId } from '../types';

interface TradingViewWidgetContainerProps {
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
  lang: 'ro' | 'en';
}

export const TradingViewWidgetContainer: React.FC<TradingViewWidgetContainerProps> = ({
  selectedInstrument,
  onSelectInstrument,
  lang,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const gaugeContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'technical'>('chart');

  // Map instrument ID to TradingView symbol (OANDA CFD benchmark symbols for seamless Chart & Technical Analysis Gauge compatibility)
  const symbolMap: Record<InstrumentId, { symbol: string; name: string; title: string }> = {
    NASDAQ: { symbol: 'OANDA:NAS100USD', name: 'Nasdaq 100 CFD (OANDA:NAS100USD)', title: 'Nasdaq CFD (NAS100)' },
    SPX500: { symbol: 'OANDA:SPX500USD', name: 'S&P 500 CFD (OANDA:SPX500USD)', title: 'S&P 500 CFD (SPX500)' },
    DOW_JONES: { symbol: 'OANDA:US30USD', name: 'Dow Jones CFD (OANDA:US30USD)', title: 'Dow Jones CFD (US30)' },
    GOLD: { symbol: 'OANDA:XAUUSD', name: 'Gold Spot (OANDA:XAUUSD)', title: 'Gold Spot (XAU/USD)' },
    NQ_F: { symbol: 'OANDA:NAS100USD', name: 'Nasdaq 100 CFD (OANDA:NAS100USD)', title: 'Nasdaq Futures (NQ.F)' },
    ES_F: { symbol: 'OANDA:SPX500USD', name: 'S&P 500 CFD (OANDA:SPX500USD)', title: 'S&P 500 Futures (ES.F)' },
    GC_F: { symbol: 'OANDA:XAUUSD', name: 'Gold Spot (OANDA:XAUUSD)', title: 'Gold Futures (GC.F)' },
    EURUSD: { symbol: 'FX:EURUSD', name: 'EUR/USD Forex Spot (FX:EURUSD)', title: 'EUR/USD' },
    GBPUSD: { symbol: 'FX:GBPUSD', name: 'GBP/USD Forex Spot (FX:GBPUSD)', title: 'GBP/USD' },
    USDJPY: { symbol: 'FX:USDJPY', name: 'USD/JPY Forex Spot (FX:USDJPY)', title: 'USD/JPY' },
  };

  const currentSymbolInfo = symbolMap[selectedInstrument] || symbolMap['NASDAQ'];

  // Initialize TradingView Advanced Chart Widget safely
  useEffect(() => {
    let isMounted = true;
    const containerRef = chartContainerRef.current;
    if (!containerRef) return;

    // Safely clear container contents
    try {
      containerRef.innerHTML = '';
    } catch (_) {}

    const containerId = `tradingview_${Math.random().toString(36).substring(7)}`;
    const chartDiv = document.createElement('div');
    chartDiv.id = containerId;
    chartDiv.className = 'w-full h-full min-h-[500px]';
    containerRef.appendChild(chartDiv);

    const userTimezone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC';
      } catch (e) {
        return 'Etc/UTC';
      }
    })();

    const initWidget = () => {
      if (!isMounted) return;
      if ((window as any).TradingView && document.getElementById(containerId)) {
        try {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: currentSymbolInfo.symbol,
            interval: '60',
            timezone: userTimezone,
            theme: 'dark',
            style: '1',
            locale: lang === 'ro' ? 'ro' : 'en',
            toolbar_bg: '#0f172a',
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: containerId,
            hide_side_toolbar: false,
            studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
          });
        } catch (e) {
          console.warn('TradingView widget initialization warning:', e);
        }
      }
    };

    let timer: NodeJS.Timeout | null = null;
    if ((window as any).TradingView) {
      timer = setTimeout(initWidget, 50);
    } else {
      const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', initWidget);
      } else {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = initWidget;
        script.onerror = (e) => {
          console.warn('TradingView tv.js script loading warning:', e);
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (containerRef) {
        const iframes = containerRef.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          try {
            iframe.src = 'about:blank';
          } catch (_) {}
        });
        try {
          containerRef.innerHTML = '';
        } catch (_) {}
      }
    };
  }, [selectedInstrument, lang, currentSymbolInfo.symbol]);

  // Initialize TradingView Technical Analysis Gauge Widget safely
  useEffect(() => {
    let isMounted = true;
    const containerRef = gaugeContainerRef.current;
    if (!containerRef) return;

    try {
      containerRef.innerHTML = '';
    } catch (_) {}

    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container w-full h-full';

    const widgetContainerDiv = document.createElement('div');
    widgetContainerDiv.className = 'tradingview-widget-container__widget w-full h-full';
    wrapper.appendChild(widgetContainerDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.type = 'text/javascript';
    script.onerror = (e) => {
      console.warn('TradingView technical analysis widget script error:', e);
    };
    script.innerHTML = JSON.stringify({
      interval: '1h',
      width: '100%',
      isTransparent: true,
      height: '100%',
      symbol: currentSymbolInfo.symbol,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: lang === 'ro' ? 'ro' : 'en',
      colorTheme: 'dark',
    });

    wrapper.appendChild(script);
    containerRef.appendChild(wrapper);

    return () => {
      isMounted = false;
      if (containerRef) {
        const iframes = containerRef.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          try {
            iframe.src = 'about:blank';
          } catch (_) {}
        });
        try {
          containerRef.innerHTML = '';
        } catch (_) {}
      }
    };
  }, [selectedInstrument, lang, currentSymbolInfo.symbol]);

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-xl mb-8 w-full">
      {/* Header Controls for Chart */}
      <div className="bg-[#0F172A] px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Pair Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
            INSTRUMENT:
          </span>
          {(['NASDAQ', 'SPX500', 'DOW_JONES', 'GOLD', 'NQ_F', 'ES_F', 'GC_F', 'EURUSD', 'GBPUSD', 'USDJPY'] as InstrumentId[]).map((id) => (
            <button
              key={id}
              onClick={() => onSelectInstrument(id)}
              className={`px-2 sm:px-2.5 py-1 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold transition font-mono ${
                selectedInstrument === id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              {symbolMap[id].title}
            </button>
          ))}
        </div>

        {/* Chart vs Technical Gauge Selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest hidden md:inline">
            TRADINGVIEW ENGINE v4.2
          </span>
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md transition font-semibold text-[11px] sm:text-xs ${
                activeTab === 'chart'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{lang === 'ro' ? 'Grafic Live' : 'Live Chart'}</span>
            </button>
            <button
              onClick={() => setActiveTab('technical')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md transition font-semibold text-[11px] sm:text-xs ${
                activeTab === 'technical'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{lang === 'ro' ? 'Manometru' : 'Gauge'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-2 sm:p-4 bg-slate-950">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Main Chart Area (Spans 3 cols on large screens) */}
          <div className="lg:col-span-3 bg-slate-900 rounded-lg border border-slate-800 p-1.5 sm:p-2 min-h-[380px] sm:min-h-[520px] flex flex-col justify-between">
            <div ref={chartContainerRef} className="w-full h-[360px] sm:h-[500px] rounded overflow-hidden"></div>
          </div>

          {/* Side Gauge Panel (Spans 1 col on large screens) */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 sm:p-4 flex flex-col justify-between min-h-[380px] sm:min-h-[520px]">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
                <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'ro' ? 'Analiză Tehnică' : 'TradingView Analysis'}</span>
                </h4>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {selectedInstrument}
                </span>
              </div>

              {/* Embed Gauge */}
              <div ref={gaugeContainerRef} className="w-full h-[320px] sm:h-[380px] overflow-hidden flex items-center justify-center"></div>
            </div>

            <div className="pt-2.5 border-t border-slate-800 text-[11px] text-slate-400">
              <p className="leading-snug">
                {lang === 'ro'
                  ? 'Indicatorul agregat analizează în timp real medii mobile (EMA/SMA) și oscilatori (RSI, MACD).'
                  : 'Aggregate indicator synthesizes real-time moving averages and technical oscillators.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
