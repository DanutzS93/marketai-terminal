import React, { useState, useMemo } from 'react';
import {
  X,
  Calculator,
  ShieldCheck,
  AlertCircle,
  DollarSign,
  Percent,
  TrendingUp,
  ShieldAlert,
  Scale,
  RefreshCw,
} from 'lucide-react';
import { InstrumentId, CalculatorInstrumentId, MarketQuote, UserProfile } from '../types';
import {
  INSTRUMENT_SPECS,
  calculatePositionMetrics,
  InstrumentSpec,
} from '../utils/lotCalculator';

interface PositionCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInstrument: InstrumentId;
  quotes: Record<InstrumentId, MarketQuote>;
  lang: 'ro' | 'en';
  user?: UserProfile | null;
}

export const PositionCalculatorModal: React.FC<PositionCalculatorModalProps> = ({
  isOpen,
  onClose,
  selectedInstrument: defaultInstrument,
  quotes,
  lang,
  user,
}) => {
  if (!isOpen) return null;

  const [activeInstrument, setActiveInstrument] = useState<CalculatorInstrumentId>(
    defaultInstrument || 'NASDAQ'
  );
  const currentSpec = INSTRUMENT_SPECS[activeInstrument] || INSTRUMENT_SPECS.NASDAQ;
  const quote = quotes[activeInstrument as InstrumentId];

  const [accountBalance, setAccountBalance] = useState<number>(user?.accountBalance ?? 100000);
  const [leverage, setLeverage] = useState<number>(user?.leverage ?? user?.riskSettings?.leverage ?? 100);
  const [riskPercent, setRiskPercent] = useState<number>(user?.riskSettings?.riskPerTrade ?? 1);
  const [dailyLossLimit, setDailyLossLimit] = useState<number>(user?.riskSettings?.maxDailyLoss ?? 3000);
  const [profitTarget, setProfitTarget] = useState<number>(5000);

  const [entryPrice, setEntryPrice] = useState<number>(() => {
    if (quote && quote.price > 0) return quote.price;
    return currentSpec.defaultPrice;
  });

  const [stopLossPrice, setStopLossPrice] = useState<number>(() => {
    const baseP = quote && quote.price > 0 ? quote.price : currentSpec.defaultPrice;
    return Number((baseP - currentSpec.defaultSLDist).toFixed(currentSpec.decimals));
  });

  const handleSelectInstrument = (instId: CalculatorInstrumentId) => {
    setActiveInstrument(instId);
    const newSpec = INSTRUMENT_SPECS[instId] || INSTRUMENT_SPECS.NASDAQ;
    const liveQ = quotes[instId as InstrumentId];
    const newEntry = liveQ && liveQ.price > 0 ? liveQ.price : newSpec.defaultPrice;
    setEntryPrice(newEntry);
    setStopLossPrice(Number((newEntry - newSpec.defaultSLDist).toFixed(newSpec.decimals)));
  };

  const calculation = useMemo(() => {
    return calculatePositionMetrics({
      instrumentId: activeInstrument,
      accountBalance,
      riskPercent,
      entryPrice,
      stopLossPrice,
      leverage,
      quotes,
    });
  }, [activeInstrument, accountBalance, riskPercent, entryPrice, stopLossPrice, leverage, quotes]);

  const allInstrumentKeys = Object.keys(INSTRUMENT_SPECS) as CalculatorInstrumentId[];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 via-[#080E1C]/95 to-[#040813]/98 border border-white/15 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto text-slate-100 glass-specular-top">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  {lang === 'ro' ? 'Calculator Risc, Levier & Loturi MT5' : 'Risk, Leverage & Lot Calculator'}
                </h3>
                <span className="text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  MT5 SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {currentSpec.name} • {currentSpec.specDescriptionRo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instrument Switcher - Select ANY pair */}
        <div className="my-4">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            {lang === 'ro' ? 'Selectează Instrumentul:' : 'Select Instrument:'}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-[#060B18]/80 rounded-xl border border-white/10">
            {allInstrumentKeys.map((id) => {
              const spec = INSTRUMENT_SPECS[id];
              const isSelected = activeInstrument === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectInstrument(id)}
                  className={`p-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer text-center ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-cyan-400/50 shadow-md shadow-indigo-500/20'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {spec.symbol}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3.5 my-4 text-xs">
          {/* Account Balance & Leverage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {lang === 'ro' ? 'Balanță Cont ($):' : 'Account Balance ($):'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono">$</span>
                <input
                  type="number"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(Number(e.target.value))}
                  className="w-full bg-[#060B18]/90 border border-white/10 rounded-xl py-2 pl-7 pr-2 text-white font-mono font-semibold focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-cyan-300 font-medium mb-1">
                {lang === 'ro' ? 'Levier Cont (1:X):' : 'Account Leverage (1:X):'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">1:</span>
                <input
                  type="number"
                  min="1"
                  max="3000"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full bg-[#060B18]/90 border border-white/10 rounded-xl py-2 pl-7 pr-2 text-white font-mono font-semibold focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Risk Percent */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-medium">
                {lang === 'ro' ? 'Procent Risc per Tranzacție (%):' : 'Risk Percentage (%):'}
              </label>
              <span className="font-mono font-bold text-rose-400 text-xs">
                ${calculation.dollarRisk.toFixed(2)} la risc
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-1.5">
              {[0.5, 1, 1.5, 2].map((p) => (
                <button
                  key={p}
                  onClick={() => setRiskPercent(p)}
                  className={`py-1 rounded-lg font-mono font-bold transition border cursor-pointer ${
                    riskPercent === p
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/50 shadow-xs'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="w-full bg-[#060B18]/90 border border-white/10 rounded-xl py-2 px-3 text-white font-mono font-semibold focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Entry & Stop Loss */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {lang === 'ro' ? 'Preț Intrare (Entry):' : 'Entry Price:'}
              </label>
              <input
                type="number"
                step={currentSpec.decimals > 2 ? '0.0001' : '0.01'}
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full bg-[#060B18]/90 border border-white/10 rounded-xl py-2 px-3 text-white font-mono font-semibold focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-rose-400 font-medium mb-1">
                Stop Loss (SL):
              </label>
              <input
                type="number"
                step={currentSpec.decimals > 2 ? '0.0001' : '0.01'}
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(Number(e.target.value))}
                className="w-full bg-[#060B18]/90 border border-rose-500/30 rounded-xl py-2 px-3 text-rose-300 font-mono font-semibold focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>
        </div>

        {/* Calculated Results Box */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2.5 font-mono backdrop-blur-md">
          <div className="flex justify-between items-center p-2.5 rounded-lg bg-indigo-500/15 border border-indigo-400/30 shadow-md shadow-indigo-500/10">
            <span className="text-xs text-indigo-200 font-sans font-bold">
              {lang === 'ro' ? 'Mărime Poziție Calculată:' : 'Calculated Position Size:'}
            </span>
            <span className="text-base font-extrabold text-cyan-300">
              {calculation.roundedLots.toFixed(2)} Loturi
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">Distanță SL:</span>
              <span className="font-semibold text-slate-200">
                {calculation.distanceInPips.toFixed(1)} {currentSpec.pipLabel}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">Marjă Necesară:</span>
              <span className="font-semibold text-amber-300">${calculation.requiredMargin.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">Profit la TP1 (1:1.5) [{calculation.tp1Price}]:</span>
              <span className="font-bold text-emerald-400">+${calculation.tp1Profit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">Profit la TP2 (1:2.5) [{calculation.tp2Price}]:</span>
              <span className="font-bold text-emerald-300">+${calculation.tp2Profit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 text-[11px] text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p>
            {lang === 'ro'
              ? `EA v4.00 Protecție: Calculul respectă specificația ${currentSpec.name} și levierul 1:${leverage}.`
              : `EA v4.00 Guard: Accurate calculation for ${currentSpec.name} with 1:${leverage} leverage.`}
          </p>
        </div>
      </div>
    </div>
  );
};
