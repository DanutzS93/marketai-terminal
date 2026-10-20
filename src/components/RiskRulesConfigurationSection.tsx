import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Save,
  CheckCircle2,
  DollarSign,
  Percent,
  Calculator,
  RefreshCw,
  AlertTriangle,
  Lock,
  Layers,
  Flame,
  ArrowRightLeft,
  Coins,
  Scale,
  Zap,
  Info,
  RotateCcw,
  Sparkles,
  Check,
  Edit3,
  SlidersHorizontal,
} from 'lucide-react';
import { InstrumentId, CalculatorInstrumentId, MarketQuote, UserProfile } from '../types';
import {
  INSTRUMENT_SPECS,
  calculatePositionMetrics,
  calculateTrailingStopConversions,
  InstrumentSpec,
  TrailingStopParityConversion,
} from '../utils/lotCalculator';

interface RiskRulesConfigurationSectionProps {
  quotes: Record<InstrumentId, MarketQuote>;
  selectedInstrument: InstrumentId;
  lang: 'ro' | 'en';
  user?: UserProfile | null;
  authToken?: string | null;
  onUpdateUserBalance?: (balance: number) => void;
}

export const RiskRulesConfigurationSection: React.FC<RiskRulesConfigurationSectionProps> = ({
  quotes,
  selectedInstrument: initialSelectedInstrument,
  lang,
  user,
  authToken,
  onUpdateUserBalance,
}) => {
  // Simulator active instrument - user can select ANY available pair!
  const [activeInstrument, setActiveInstrument] = useState<CalculatorInstrumentId>(
    initialSelectedInstrument || 'NASDAQ'
  );
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'INDICES' | 'METALS' | 'FOREX'>('ALL');

  // Account parameters
  const [accountBalance, setAccountBalance] = useState<number>(user?.accountBalance ?? 100000);
  const [equity, setEquity] = useState<number>(user?.equity ?? user?.accountBalance ?? 100000);
  const [leverage, setLeverage] = useState<number>(user?.leverage ?? user?.riskSettings?.leverage ?? 100);
  const [customLeverage, setCustomLeverage] = useState<string>('100');
  const [isCustomLeverage, setIsCustomLeverage] = useState<boolean>(false);

  // Risk Rules Parameters
  const [riskPerTrade, setRiskPerTrade] = useState<number>(user?.riskSettings?.riskPerTrade ?? 1);
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(user?.riskSettings?.maxDailyLoss ?? 3000);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(user?.riskSettings?.maxTradesPerDay ?? 10);
  const [maxTradesPerSymbol, setMaxTradesPerSymbol] = useState<number>(user?.riskSettings?.maxTradesPerSymbol ?? 3);
  const [dailyProfitTarget, setDailyProfitTarget] = useState<number>(user?.riskSettings?.dailyProfitTarget ?? 5000);
  const [minConfidence, setMinConfidence] = useState<number>(user?.riskSettings?.minSignalScore ?? 75);
  const [autoBreakEven, setAutoBreakEven] = useState<boolean>(user?.riskSettings?.autoBreakEven ?? true);
  const [trailingStop, setTrailingStop] = useState<boolean>(user?.riskSettings?.trailingStop ?? true);
  const [trailingStopPoints, setTrailingStopPoints] = useState<number>(user?.riskSettings?.trailingStopPoints ?? 50);
  const [trailingStopBaseAsset, setTrailingStopBaseAsset] = useState<InstrumentId>(
    (user?.riskSettings?.trailingStopBaseAsset as InstrumentId) || (initialSelectedInstrument as InstrumentId) || 'NASDAQ'
  );
  const [trailingStopCustomOverrides, setTrailingStopCustomOverrides] = useState<Partial<Record<InstrumentId, number>>>(
    user?.riskSettings?.trailingStopCustomOverrides || {}
  );
  const [tsCategoryFilter, setTsCategoryFilter] = useState<'ALL' | 'INDICES' | 'METALS' | 'FOREX'>('ALL');
  const [tsEditingParity, setTsEditingParity] = useState<InstrumentId | null>(null);
  const [tsEditingVal, setTsEditingVal] = useState<string>('');

  // Active spec & price
  const currentSpec: InstrumentSpec = INSTRUMENT_SPECS[activeInstrument] || INSTRUMENT_SPECS.NASDAQ;
  const quote = quotes[activeInstrument as InstrumentId];

  // Simulator Entry & Stop Loss inputs
  const [entryPrice, setEntryPrice] = useState<number>(() => {
    if (quote && quote.price > 0) return quote.price;
    return currentSpec.defaultPrice;
  });

  const [stopLossPrice, setStopLossPrice] = useState<number>(() => {
    const baseP = quote && quote.price > 0 ? quote.price : currentSpec.defaultPrice;
    return Number((baseP - currentSpec.defaultSLDist).toFixed(currentSpec.decimals));
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if user profile balance or equity updates from MT5 backend
  useEffect(() => {
    if (user?.accountBalance && user.accountBalance !== accountBalance) {
      setAccountBalance(user.accountBalance);
    }
    if (user?.equity && user.equity !== equity) {
      setEquity(user.equity);
    }
  }, [user?.accountBalance, user?.equity]);

  // When activeInstrument changes, update entry & SL intelligently
  const handleSelectInstrument = (instId: CalculatorInstrumentId) => {
    setActiveInstrument(instId);
    const newSpec = INSTRUMENT_SPECS[instId] || INSTRUMENT_SPECS.NASDAQ;
    const liveQ = quotes[instId as InstrumentId];
    const newEntry = liveQ && liveQ.price > 0 ? liveQ.price : newSpec.defaultPrice;
    setEntryPrice(newEntry);
    setStopLossPrice(Number((newEntry - newSpec.defaultSLDist).toFixed(newSpec.decimals)));
  };

  // Synchronize live price button
  const handleSyncWithLiveQuote = () => {
    if (quote && quote.price > 0) {
      setEntryPrice(quote.price);
      setStopLossPrice(Number((quote.price - currentSpec.defaultSLDist).toFixed(currentSpec.decimals)));
    }
  };

  // Perform full mathematical calculation using lot calculator engine
  const calculation = useMemo(() => {
    return calculatePositionMetrics({
      instrumentId: activeInstrument,
      accountBalance,
      equity,
      riskPercent: riskPerTrade,
      entryPrice,
      stopLossPrice,
      leverage,
      quotes,
    });
  }, [activeInstrument, accountBalance, equity, riskPerTrade, entryPrice, stopLossPrice, leverage, quotes]);

  // Multi-parity trailing stop conversions memo
  const trailingStopConversions = useMemo(() => {
    return calculateTrailingStopConversions({
      baseAsset: trailingStopBaseAsset,
      basePoints: trailingStopPoints,
      quotes,
      customOverrides: trailingStopCustomOverrides,
    });
  }, [trailingStopBaseAsset, trailingStopPoints, quotes, trailingStopCustomOverrides]);

  const handleSelectBaseAsset = (newBase: InstrumentId) => {
    if (newBase === trailingStopBaseAsset) return;
    const currentConverted = trailingStopConversions.conversions[newBase]?.points;
    setTrailingStopBaseAsset(newBase);
    if (currentConverted && currentConverted > 0) {
      setTrailingStopPoints(currentConverted);
    }
  };

  const getBasePresets = (baseId: InstrumentId) => {
    if (baseId === 'NASDAQ' || baseId === 'NQ_F') return [25, 50, 75, 100];
    if (baseId === 'SPX500' || baseId === 'ES_F') return [10, 15, 20, 30];
    if (baseId === 'DOW_JONES') return [50, 100, 150, 200];
    if (baseId === 'GOLD' || baseId === 'GC_F') return [4.0, 7.0, 10.0, 15.0];
    if (baseId === 'EURUSD' || baseId === 'GBPUSD') return [15, 25, 35, 50];
    if (baseId === 'USDJPY') return [20, 35, 50, 75];
    return [20, 40, 60, 80];
  };

  const handleSaveParityOverride = (instId: InstrumentId, rawVal: string) => {
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      setTrailingStopCustomOverrides((prev) => ({
        ...prev,
        [instId]: num,
      }));
    }
    setTsEditingParity(null);
  };

  const handleResetSingleOverride = (instId: InstrumentId) => {
    setTrailingStopCustomOverrides((prev) => {
      const next = { ...prev };
      delete next[instId];
      return next;
    });
  };

  const handleResetAllOverrides = () => {
    setTrailingStopCustomOverrides({});
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (authToken) {
        await fetch('/api/user/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            accountBalance,
            leverage,
            riskSettings: {
              riskPerTrade,
              maxDailyLoss,
              dailyProfitTarget,
              maxTradesPerDay,
              maxTradesPerSymbol,
              minSignalScore: minConfidence,
              autoBreakEven,
              trailingStop,
              trailingStopPoints,
              trailingStopBaseAsset,
              trailingStopPointsPerAsset: trailingStopConversions.pointsMap,
              trailingStopCustomOverrides,
              leverage,
            },
          }),
        });
      }

      if (user) {
        user.riskSettings = {
          ...(user.riskSettings || {}),
          riskPerTrade,
          maxDailyLoss,
          dailyProfitTarget,
          maxTradesPerDay,
          maxTradesPerSymbol,
          minSignalScore: minConfidence,
          autoBreakEven,
          trailingStop,
          trailingStopPoints,
          trailingStopBaseAsset,
          trailingStopPointsPerAsset: trailingStopConversions.pointsMap,
          trailingStopCustomOverrides,
          leverage,
        };
      }

      if (onUpdateUserBalance) {
        onUpdateUserBalance(accountBalance);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving risk settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const allInstrumentKeys = Object.keys(INSTRUMENT_SPECS) as CalculatorInstrumentId[];
  const filteredInstruments = allInstrumentKeys.filter((id) => {
    if (categoryFilter === 'ALL') return true;
    return INSTRUMENT_SPECS[id].category === categoryFilter;
  });

  return (
    <section className="space-y-6">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0A1224]/90 via-[#080E1C]/90 to-[#040813]/95 border border-white/10 p-6 shadow-2xl glass-specular-top backdrop-blur-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
              <Sliders className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {lang === 'ro' ? 'Configurare Risc, Levier & Simulator Loturi MT5' : 'Risk Rules, Leverage & MT5 Lot Simulator'}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  MT5 LIVE FEED ACTIVE
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-3xl">
                {lang === 'ro'
                  ? 'Selectează orice paritate sau indice, configurează levierul contului și calculează automat mărimea exactă a lotului în funcție de specificațiile fiecărui activ.'
                  : 'Select any instrument, configure your personal account leverage, and automatically calculate precise lot sizing based on specific asset contract specifications.'}
              </p>
            </div>
          </div>

          {/* Action Save Button */}
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 animate-fade-in font-mono">
                <CheckCircle2 className="w-4 h-4" />
                {lang === 'ro' ? 'Salvat cu Succes!' : 'Saved Successfully!'}
              </span>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm transition shadow-lg shadow-emerald-500/25 border border-emerald-400/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{lang === 'ro' ? 'Salvează Parametri Risc' : 'Save Risk Parameters'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Columns for Rules & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Risk Rules & Account Leverage Configuration (6 cols) */}
        <div className="lg:col-span-6 bg-gradient-to-b from-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6 glass-specular-top">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-base text-white uppercase tracking-wider">
                {lang === 'ro' ? 'Parametri Risc & Levier Cont' : 'Risk & Account Leverage Rules'}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              EA v4.50 Real-Time Sync
            </span>
          </div>

          <div className="space-y-5">
            {/* MT5 Account Connection Status Info */}
            {user?.mt5AccountNumber ? (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-300">
                        {lang === 'ro' ? 'Cont MT5 Conectat:' : 'Connected MT5 Account:'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 font-mono font-bold text-xs">
                        #{user.mt5AccountNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                      Server: {user.mt5AccountServer || 'Live Server'} {user.mt5AccountCompany ? `• ${user.mt5AccountCompany}` : ''} {user.mt5AccountCurrency ? `(${user.mt5AccountCurrency})` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold block">
                    {lang === 'ro' ? 'Sincronizare Activă' : 'Live Sync Active'}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-mono font-bold">
                    EA v4.50 Guard
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <span className="text-xs text-slate-300">
                    {lang === 'ro' ? 'Cont MT5 în așteptare conectare EA...' : 'MT5 Account awaiting EA bridge connection...'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">v4.00</span>
              </div>
            )}

            {/* Account Balance & Equity Live */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {lang === 'ro' ? 'Account Balance ($)' : 'Account Balance ($)'}
                  </label>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    MT5 LIVE
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-base">$</span>
                  <input
                    type="number"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-white font-mono font-bold text-base focus:outline-none focus:border-cyan-500 transition"
                    placeholder="100000"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {lang === 'ro' ? 'Equity Cont ($)' : 'Account Equity ($)'}
                  </label>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    MT5 LIVE
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-base">$</span>
                  <input
                    type="number"
                    value={equity}
                    onChange={(e) => setEquity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-emerald-400 font-mono font-bold text-base focus:outline-none focus:border-cyan-500 transition"
                    placeholder="100000"
                  />
                </div>
              </div>
            </div>

            {/* Setare Levier (Account Leverage) - Explicit User Request */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  <label className="block text-xs font-bold text-indigo-200 uppercase tracking-wider">
                    {lang === 'ro' ? 'Levier Cont (Account Leverage)' : 'Account Leverage (1:X)'}
                  </label>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold">
                  1:{leverage}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {[30, 50, 100, 200, 500, 1000].map((lev) => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => {
                      setLeverage(lev);
                      setIsCustomLeverage(false);
                    }}
                    className={`py-1.5 px-1 rounded-lg font-mono font-bold text-xs transition border cursor-pointer text-center ${
                      leverage === lev && !isCustomLeverage
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    1:{lev}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 shrink-0">
                  {lang === 'ro' ? 'Levier Personalizat:' : 'Custom Leverage:'}
                </span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">1:</span>
                  <input
                    type="number"
                    min="1"
                    max="3000"
                    value={leverage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLeverage(val > 0 ? val : 1);
                      setIsCustomLeverage(true);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 pl-6 pr-2 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="100"
                  />
                </div>
              </div>
            </div>

            {/* Risk Per Trade (%) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {lang === 'ro' ? 'Procent Risc per Tranzacție (%)' : 'Risk Per Trade (%)'}
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  ${calculation.dollarRisk.toFixed(2)} / trade
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[0.5, 1, 1.5, 2].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRiskPerTrade(p)}
                    className={`py-2 rounded-xl font-mono font-bold text-xs transition border cursor-pointer ${
                      riskPerTrade === p
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-400 font-mono text-sm">%</span>
                <input
                  type="number"
                  step="0.1"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 transition"
                  placeholder="1.0"
                />
              </div>
            </div>

            {/* Max Daily Loss ($) & Profit Target ($) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {lang === 'ro' ? 'Max Daily Loss ($)' : 'Max Daily Loss ($)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-rose-400/80 font-mono text-sm">$</span>
                  <input
                    type="number"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-rose-950/60 rounded-xl py-2.5 pl-8 pr-3 text-rose-300 font-mono font-bold text-sm focus:outline-none focus:border-rose-500 transition"
                    placeholder="3000"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {lang === 'ro' ? 'Oprire EA automată la atingere' : 'EA automatic stop on breach'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {lang === 'ro' ? 'Daily Profit Target ($)' : 'Daily Profit Target ($)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-emerald-400/80 font-mono text-sm">$</span>
                  <input
                    type="number"
                    value={dailyProfitTarget}
                    onChange={(e) => setDailyProfitTarget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-emerald-950/60 rounded-xl py-2.5 pl-8 pr-3 text-emerald-300 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 transition"
                    placeholder="5000"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {lang === 'ro' ? 'Blocare profituri zilnice' : 'Lock daily realized profits'}
                </span>
              </div>
            </div>

            {/* Max Trades Per Day & Per Symbol */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {lang === 'ro' ? 'Max Trades Per Day' : 'Max Trades Per Day'}
                </label>
                <input
                  type="number"
                  value={maxTradesPerDay}
                  onChange={(e) => setMaxTradesPerDay(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition"
                  placeholder="10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {lang === 'ro' ? 'Max Trades Per Symbol' : 'Max Trades Per Symbol'}
                </label>
                <input
                  type="number"
                  value={maxTradesPerSymbol}
                  onChange={(e) => setMaxTradesPerSymbol(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition"
                  placeholder="3"
                />
              </div>
            </div>

            {/* Advanced EA Guard Toggles */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {lang === 'ro' ? 'Break-Even la TP1' : 'Auto Break-Even at TP1'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {lang === 'ro' ? 'Muta SL la Entry automat' : 'Moves SL to Entry on TP1'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoBreakEven}
                  onChange={(e) => setAutoBreakEven(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Trailing Stop Multi-Parity Engine */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 via-[#0B1528] to-slate-950 border border-indigo-500/30 shadow-xl space-y-4 sm:col-span-2">
                {/* Header & Toggle */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {lang === 'ro' ? 'Trailing Stop Inteligent (Lock Profit TP1+)' : 'Smart Trailing Stop (TP1+ Lock)'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          trailingStop 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {trailingStop ? (lang === 'ro' ? 'Activ' : 'Active') : (lang === 'ro' ? 'Inactiv' : 'Disabled')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {lang === 'ro' 
                          ? 'Introduci punctele manual pentru o paritate de referință, iar distanța se convertește automat pentru toate cele 10 parități.' 
                          : 'Set manual points for a base instrument and the distance auto-converts proportionally for all 10 assets.'}
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={trailingStop}
                      onChange={(e) => setTrailingStop(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {trailingStop && (
                  <div className="space-y-4 pt-1">
                    {/* Base Asset & Manual Points Input */}
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-indigo-900/40 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                          {lang === 'ro' ? 'Paritate de Bază (Referință Puncte Manuale):' : 'Reference Base Asset (Manual Points):'}
                        </label>
                        <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                          {trailingStopConversions.conversions[trailingStopBaseAsset]?.symbol} • {quotes[trailingStopBaseAsset]?.price ? `$${quotes[trailingStopBaseAsset].price.toLocaleString()}` : `$${INSTRUMENT_SPECS[trailingStopBaseAsset]?.defaultPrice.toLocaleString()}`}
                        </span>
                      </div>

                      {/* Quick Selector Pills for Base Asset */}
                      <div className="flex flex-wrap gap-1.5">
                        {allInstrumentKeys.map((k) => {
                          const spec = INSTRUMENT_SPECS[k];
                          const isSelected = trailingStopBaseAsset === k;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleSelectBaseAsset(k)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <span>{spec.symbol}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Manual Numeric Input + Steppers + Quick Presets */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            {lang === 'ro'
                              ? `Puncte Manuale pentru ${INSTRUMENT_SPECS[trailingStopBaseAsset]?.symbol} (${trailingStopConversions.conversions[trailingStopBaseAsset]?.unitLabel}):`
                              : `Manual Distance for ${INSTRUMENT_SPECS[trailingStopBaseAsset]?.symbol} (${trailingStopConversions.conversions[trailingStopBaseAsset]?.unitLabel}):`}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const step = trailingStopBaseAsset === 'GOLD' || trailingStopBaseAsset === 'GC_F' ? 1.0 : (trailingStopBaseAsset === 'EURUSD' || trailingStopBaseAsset === 'GBPUSD' || trailingStopBaseAsset === 'USDJPY' ? 2 : 5);
                                setTrailingStopPoints((prev) => Math.max(step, Number((prev - step).toFixed(2))));
                              }}
                              className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold hover:text-white flex items-center justify-center cursor-pointer transition shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0.1"
                              value={trailingStopPoints}
                              onChange={(e) => setTrailingStopPoints(Number(e.target.value))}
                              className="w-full bg-slate-950 border border-indigo-500/50 rounded-lg py-2 px-3 text-white font-mono text-sm font-bold focus:outline-none focus:border-indigo-400 transition"
                              placeholder="50"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const step = trailingStopBaseAsset === 'GOLD' || trailingStopBaseAsset === 'GC_F' ? 1.0 : (trailingStopBaseAsset === 'EURUSD' || trailingStopBaseAsset === 'GBPUSD' || trailingStopBaseAsset === 'USDJPY' ? 2 : 5);
                                setTrailingStopPoints((prev) => Number((prev + step).toFixed(2)));
                              }}
                              className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold hover:text-white flex items-center justify-center cursor-pointer transition shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Quick Presets for Base Asset */}
                        <div className="sm:col-span-5 flex flex-col justify-end">
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                            {lang === 'ro' ? 'Preseturi Rapide:' : 'Quick Presets:'}
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {getBasePresets(trailingStopBaseAsset).map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setTrailingStopPoints(val)}
                                className={`py-1.5 px-1 rounded-md text-[11px] font-mono font-bold transition border cursor-pointer text-center ${
                                  trailingStopPoints === val
                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Volatility Distance Equivalence */}
                      <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono text-slate-300">
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          {lang === 'ro' ? 'Echivalent Volatilitate / Distanță Procentuală:' : 'Equivalent Volatility / Percentage Distance:'}
                        </span>
                        <span className="font-bold text-emerald-400">
                          ±{trailingStopConversions.basePercent.toFixed(3)}%
                        </span>
                      </div>
                    </div>

                    {/* Multi-Parity Auto-Conversion Grid (All 10 Parities) */}
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-slate-200">
                            {lang === 'ro'
                              ? 'Conversie Automată Puncte (Toate cele 10 Parități)'
                              : 'Auto-Converted Points (All 10 Parities)'}
                          </span>
                        </div>

                        {/* Category filter tabs */}
                        <div className="flex items-center gap-1">
                          {(['ALL', 'INDICES', 'METALS', 'FOREX'] as const).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setTsCategoryFilter(cat)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                tsCategoryFilter === cat
                                  ? 'bg-slate-700 text-white border border-slate-600'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {cat === 'ALL' ? (lang === 'ro' ? 'Toate (10)' : 'All (10)') : cat}
                            </button>
                          ))}
                          {Object.keys(trailingStopCustomOverrides).length > 0 && (
                            <button
                              type="button"
                              onClick={handleResetAllOverrides}
                              title={lang === 'ro' ? 'Resetează toate ajustările manuale' : 'Reset all manual overrides'}
                              className="px-2 py-0.5 rounded text-[10px] font-mono text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 flex items-center gap-1 cursor-pointer ml-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              {lang === 'ro' ? 'Reset' : 'Reset'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Parities Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                        {allInstrumentKeys
                          .filter((k) => {
                            if (tsCategoryFilter === 'ALL') return true;
                            return INSTRUMENT_SPECS[k].category === tsCategoryFilter;
                          })
                          .map((k) => {
                            const conv = trailingStopConversions.conversions[k];
                            const isBase = trailingStopBaseAsset === k;
                            const isEditing = tsEditingParity === k;

                            return (
                              <div
                                key={k}
                                className={`p-2.5 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                                  isBase
                                    ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-900/20'
                                    : conv.isOverridden
                                    ? 'bg-amber-950/30 border-amber-500/40'
                                    : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-xs text-white">
                                      {conv.symbol}
                                    </span>
                                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                                      conv.category === 'INDICES'
                                        ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                                        : conv.category === 'METALS'
                                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                                        : 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                                    }`}>
                                      {conv.category}
                                    </span>
                                    {isBase && (
                                      <span className="text-[9px] bg-indigo-500 text-white font-mono px-1 rounded font-bold">
                                        BAZĂ
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {conv.isOverridden && (
                                      <button
                                        type="button"
                                        onClick={() => handleResetSingleOverride(k)}
                                        title={lang === 'ro' ? 'Resetează la calcul automat' : 'Reset to auto-calculated'}
                                        className="text-[10px] text-amber-400 hover:text-amber-300 p-0.5 rounded cursor-pointer"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEditing) {
                                          handleSaveParityOverride(k, tsEditingVal);
                                        } else {
                                          setTsEditingParity(k);
                                          setTsEditingVal(String(conv.points));
                                        }
                                      }}
                                      title={lang === 'ro' ? 'Personalizează manual această paritate' : 'Manually override this parity'}
                                      className="text-[10px] text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Converted Value Display or Edit Input */}
                                <div className="flex items-baseline justify-between pt-0.5">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1 w-full my-0.5">
                                      <input
                                        type="number"
                                        step="any"
                                        value={tsEditingVal}
                                        onChange={(e) => setTsEditingVal(e.target.value)}
                                        className="w-full bg-slate-950 border border-cyan-500 rounded py-0.5 px-1.5 text-white font-mono text-xs font-bold focus:outline-none"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveParityOverride(k, tsEditingVal)}
                                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-mono font-bold text-sm text-cyan-300">
                                        {conv.displayValue}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        {conv.secondaryDetail}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Instrument Lot & Position Size Simulator (6 cols) */}
        <div className="lg:col-span-6 bg-gradient-to-b from-[#0A1224]/85 to-[#070D1A]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between space-y-5 glass-specular-top">
          <div className="space-y-4">
            {/* Header & Asset Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white uppercase tracking-wider">
                  {lang === 'ro' ? 'Simulator Loturi & Mărime Poziție' : 'Lot Sizing & Position Simulator'}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-300 font-mono bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-800/60">
                  {currentSpec.name}
                </span>
                {quote && quote.price > 0 && (
                  <button
                    onClick={handleSyncWithLiveQuote}
                    className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title={lang === 'ro' ? 'Reîncarcă prețul live din piață' : 'Reload live price'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills for any pair selection */}
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {(['ALL', 'INDICES', 'METALS', 'FOREX'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg transition border cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {cat === 'ALL'
                    ? lang === 'ro' ? 'Toate' : 'All'
                    : cat === 'INDICES'
                    ? 'Indici'
                    : cat === 'METALS'
                    ? 'Gold & Metale'
                    : 'Forex FX'}
                </button>
              ))}
            </div>

            {/* Multi-Instrument Grid Selector - Allows choosing ANY available instrument */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
              {filteredInstruments.map((id) => {
                const spec = INSTRUMENT_SPECS[id];
                const q = quotes[id as InstrumentId];
                const isSelected = activeInstrument === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleSelectInstrument(id)}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/90 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs font-mono">{spec.symbol}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      {q && typeof q.price === 'number' && q.price > 0 ? q.price.toLocaleString() : '-'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Spec Details & Formula Explanation */}
            <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between font-mono">
              <span className="text-slate-400 font-sans">
                {lang === 'ro' ? 'Specificație Activ:' : 'Asset Specification:'}
              </span>
              <span className="font-semibold text-cyan-300">
                {lang === 'ro' ? currentSpec.specDescriptionRo : currentSpec.specDescriptionEn}
              </span>
            </div>

            {/* Inputs for Entry & SL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold">
                    {lang === 'ro' ? 'Preț Intrare (Entry):' : 'Entry Price:'}
                  </label>
                  {quote && quote.price > 0 && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Live: {quote.price}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step={currentSpec.decimals > 2 ? '0.0001' : '0.01'}
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-rose-400 font-semibold">
                    Stop Loss (SL):
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Δ {calculation.priceDistance.toFixed(currentSpec.decimals)} ({calculation.distanceInPips.toFixed(1)} {currentSpec.pipLabel})
                  </span>
                </div>
                <input
                  type="number"
                  step={currentSpec.decimals > 2 ? '0.0001' : '0.01'}
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-rose-300 font-mono font-bold focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Sizing & Profit Calculations Summary Box */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-3 font-mono">
              {/* Highlighted Calculated Lots */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/30">
                <div>
                  <span className="text-xs text-indigo-200 font-sans font-bold block">
                    {lang === 'ro' ? 'Mărime Calculată Poziție (MT5):' : 'Calculated Position Size (MT5):'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentSpec.unitLabel}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-cyan-300 font-mono">
                    {calculation.roundedLots > 0 ? calculation.roundedLots.toFixed(2) : calculation.calculatedLots.toFixed(2)} Loturi
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {calculation.calculatedLots.toFixed(4)} exact
                  </span>
                </div>
              </div>

              {/* Sizing and Margin Row */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">{lang === 'ro' ? 'Risc la SL ($):' : 'Loss at SL ($):'}</span>
                  <span className="font-bold text-rose-400">${calculation.dollarRisk.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">{lang === 'ro' ? 'Valoare Poziție:' : 'Notional Value:'}</span>
                  <span className="font-bold text-slate-200">${Math.round(calculation.notionalValue).toLocaleString()}</span>
                </div>
              </div>

              {/* Leverage & Margin Requirements */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-900">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">{lang === 'ro' ? 'Marjă Necesară (1:' + leverage + '):' : 'Required Margin:'}</span>
                  <span className={`font-bold ${calculation.isMarginExceeded ? 'text-rose-400' : 'text-amber-300'}`}>
                    ${calculation.requiredMargin.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">{lang === 'ro' ? 'Marjă Liberă:' : 'Free Margin:'}</span>
                  <span className="font-bold text-emerald-400">${calculation.freeMargin.toFixed(2)}</span>
                </div>
              </div>

              {/* Profit Targets Summary */}
              <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {lang === 'ro' ? 'Profit la TP1 (1:1.5) [' + calculation.tp1Price + ']:' : 'TP1 Profit (1:1.5) [' + calculation.tp1Price + ']:'}
                  </span>
                  <span className="font-bold text-emerald-400">+${calculation.tp1Profit.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                    {lang === 'ro' ? 'Profit la TP2 (1:2.5) [' + calculation.tp2Price + ']:' : 'TP2 Profit (1:2.5) [' + calculation.tp2Price + ']:'}
                  </span>
                  <span className="font-bold text-emerald-300">+${calculation.tp2Profit.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                    {lang === 'ro' ? 'Profit la TP3 (1:3.5) [' + calculation.tp3Price + ']:' : 'TP3 Profit (1:3.5) [' + calculation.tp3Price + ']:'}
                  </span>
                  <span className="font-bold text-cyan-300">+${calculation.tp3Profit.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Safety & Compliance Badge */}
          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              {lang === 'ro'
                ? `Formulă Validată MT5: Loturile sunt calculate conform specificației brokerului (${currentSpec.name}), protejând contul la pragul de risc setat (${riskPerTrade}% = $${calculation.dollarRisk.toFixed(2)}).`
                : `MT5 Validated Engine: Lots are calculated according to broker contract specifications (${currentSpec.name}), preserving risk limit (${riskPerTrade}% = $${calculation.dollarRisk.toFixed(2)}).`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
