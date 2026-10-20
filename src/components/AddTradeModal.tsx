import React, { useState, useEffect } from 'react';
import { X, Plus, Calculator, Calendar, Clock, DollarSign, Check, AlertCircle } from 'lucide-react';
import { TradeJournalEntry, InstrumentId } from '../types';
import { getLocalDateKey } from '../utils/tradeJournalUtils';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTrade: (trade: TradeJournalEntry) => void;
  initialDate?: string; // YYYY-MM-DD
  editingTrade?: TradeJournalEntry | null;
  lang: 'ro' | 'en';
}

const INSTRUMENT_OPTIONS: { id: InstrumentId; name: string; symbol: string }[] = [
  { id: 'NASDAQ', name: 'US Tech 100 (NASDAQ)', symbol: 'NAS100' },
  { id: 'GOLD', name: 'Gold / Spot US Dollar', symbol: 'XAUUSD' },
  { id: 'SPX500', name: 'S&P 500 Index', symbol: 'US500' },
  { id: 'DOW_JONES', name: 'Dow Jones Industrial 30', symbol: 'US30' },
  { id: 'EURUSD', name: 'Euro / US Dollar', symbol: 'EURUSD' },
  { id: 'GBPUSD', name: 'British Pound / US Dollar', symbol: 'GBPUSD' },
  { id: 'USDJPY', name: 'US Dollar / Japanese Yen', symbol: 'USDJPY' },
  { id: 'NQ_F', name: 'E-mini NASDAQ Futures', symbol: 'NQ' },
  { id: 'ES_F', name: 'E-mini S&P 500 Futures', symbol: 'ES' },
  { id: 'GC_F', name: 'Gold COMEX Futures', symbol: 'GC' },
];

const SETUP_SUGGESTIONS = [
  'ICT Silver Bullet',
  'Fair Value Gap (FVG)',
  'Order Block Sweep',
  'Break of Structure (BOS)',
  'Trend Pullback',
  'London Breakout',
  'NY Open Momentum',
  'Liquidity Run Reversal',
  'Daily Key Level Retest',
];

export const AddTradeModal: React.FC<AddTradeModalProps> = ({
  isOpen,
  onClose,
  onSaveTrade,
  initialDate,
  editingTrade,
  lang,
}) => {
  const [date, setDate] = useState(initialDate || getLocalDateKey(new Date()));
  const [time, setTime] = useState('14:30');
  const [exitTime, setExitTime] = useState('');
  const [instrumentId, setInstrumentId] = useState<InstrumentId>('NASDAQ');
  const [customSymbol, setCustomSymbol] = useState('');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [status, setStatus] = useState<'WIN' | 'LOSS' | 'BREAKEVEN' | 'RUNNING'>('WIN');
  const [entryPrice, setEntryPrice] = useState<string>('20000');
  const [stopLoss, setStopLoss] = useState<string>('19950');
  const [exitPrice, setExitPrice] = useState<string>('20100');
  const [rrAchieved, setRrAchieved] = useState<string>('2.0');
  const [pnl, setPnl] = useState<string>('200');
  const [lotSize, setLotSize] = useState<string>('1.0');
  const [setup, setSetup] = useState<string>('ICT Silver Bullet');
  const [notes, setNotes] = useState<string>('');
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [isCustomSymbol, setIsCustomSymbol] = useState(false);

  useEffect(() => {
    if (editingTrade) {
      setDate(editingTrade.entryDate || editingTrade.date || getLocalDateKey(new Date()));
      setTime(editingTrade.entryTime || editingTrade.time || '14:30');
      setExitTime(editingTrade.exitTime || '');
      if (INSTRUMENT_OPTIONS.some((i) => i.id === editingTrade.instrumentId)) {
        setInstrumentId(editingTrade.instrumentId as InstrumentId);
        setIsCustomSymbol(false);
      } else {
        setIsCustomSymbol(true);
        setCustomSymbol(editingTrade.symbol || editingTrade.instrumentId);
      }
      setDirection(editingTrade.direction || 'BUY');
      setStatus(editingTrade.status || 'WIN');
      setEntryPrice(String(editingTrade.entryPrice ?? ''));
      setStopLoss(String(editingTrade.stopLoss ?? ''));
      setExitPrice(String(editingTrade.exitPrice ?? ''));
      setRrAchieved(String(editingTrade.rrAchieved ?? '0'));
      setPnl(editingTrade.pnl !== undefined ? String(editingTrade.pnl) : '');
      setLotSize(editingTrade.lotSize !== undefined ? String(editingTrade.lotSize) : '');
      setSetup(editingTrade.setup || '');
      setNotes(editingTrade.notes || '');
      setTimeframe(editingTrade.timeframe || '15m');
    } else {
      setDate(initialDate || getLocalDateKey(new Date()));
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
      setExitTime('');
      setStatus('WIN');
      setRrAchieved('2.0');
      setPnl('');
      setNotes('');
    }
  }, [editingTrade, initialDate, isOpen]);

  if (!isOpen) return null;

  // Auto calculate RR from entry, SL and exit
  const handleAutoCalcRR = () => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const exit = parseFloat(exitPrice);

    if (isNaN(entry) || isNaN(sl) || isNaN(exit)) return;

    const riskDist = Math.abs(entry - sl);
    if (riskDist <= 0) return;

    let computedRR = 0;
    if (direction === 'BUY') {
      computedRR = (exit - entry) / riskDist;
    } else {
      computedRR = (entry - exit) / riskDist;
    }

    const rounded = Math.round(computedRR * 10) / 10;
    setRrAchieved(String(rounded));

    if (rounded > 0.05) {
      setStatus('WIN');
    } else if (rounded < -0.05) {
      setStatus('LOSS');
    } else {
      setStatus('BREAKEVEN');
    }
  };

  const handleStatusChange = (newStatus: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'RUNNING') => {
    setStatus(newStatus);
    if (newStatus === 'LOSS') {
      const current = parseFloat(rrAchieved);
      if (current > 0 || isNaN(current)) {
        setRrAchieved('-1.0');
      }
    } else if (newStatus === 'WIN') {
      const current = parseFloat(rrAchieved);
      if (current <= 0 || isNaN(current)) {
        setRrAchieved('2.0');
      }
    } else if (newStatus === 'BREAKEVEN') {
      setRrAchieved('0.0');
    } else if (newStatus === 'RUNNING') {
      setRrAchieved('0.0');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const entry = parseFloat(entryPrice) || 0;
    const sl = parseFloat(stopLoss) || 0;
    const exit = exitPrice ? parseFloat(exitPrice) : undefined;
    const rr = parseFloat(rrAchieved) || 0;
    const pnlNum = pnl ? parseFloat(pnl) : undefined;
    const lotNum = lotSize ? parseFloat(lotSize) : undefined;

    const selectedInst = INSTRUMENT_OPTIONS.find((i) => i.id === instrumentId);
    const symbol = isCustomSymbol
      ? customSymbol.toUpperCase() || 'CUSTOM'
      : selectedInst?.symbol || 'NAS100';
    const instrumentName = isCustomSymbol
      ? customSymbol.toUpperCase()
      : selectedInst?.name || symbol;

    let outcomeLabel = 'Manual Trade';
    if (status === 'WIN') {
      outcomeLabel = rr >= 3 ? 'TP3 Max Hit 💎' : rr >= 2 ? 'TP2 Hit 🚀' : 'TP1 Hit 🎯';
    } else if (status === 'LOSS') {
      outcomeLabel = 'Stop Loss Hit 🛑';
    } else if (status === 'BREAKEVEN') {
      outcomeLabel = 'Break-Even (BE) ⚖️';
    } else {
      outcomeLabel = 'În Desfășurare / Activ ⏳';
    }

    const tradeEntry: TradeJournalEntry = {
      id: editingTrade ? editingTrade.id : `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date,
      time,
      instrumentId: isCustomSymbol ? customSymbol.toUpperCase() : instrumentId,
      symbol,
      instrumentName,
      direction,
      executionType: `${direction} MARKET`,
      entryPrice: entry,
      exitPrice: exit,
      stopLoss: sl,
      takeProfit: exit,
      rrAchieved: rr,
      pnl: pnlNum,
      lotSize: lotNum,
      status,
      outcomeLabel,
      setup: setup.trim() || 'Setup Manual',
      notes: notes.trim(),
      timeframe,
      isManual: true,
      generatedAt: editingTrade?.generatedAt || editingTrade?.createdAt || new Date(`${date}T${time}:00`).toISOString(),
      entryDate: date,
      entryTime: time,
      exitTime: exitTime.trim() || undefined,
      closedAt: (status === 'WIN' || status === 'LOSS' || status === 'BREAKEVEN')
        ? (editingTrade?.closedAt || (exitTime ? new Date(`${date}T${exitTime}:00`).toISOString() : new Date().toISOString()))
        : undefined,
      createdAt: editingTrade ? editingTrade.createdAt : new Date(`${date}T${time}:00`).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveTrade(tradeEntry);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 via-[#080E1C]/95 to-[#040813]/98 text-white rounded-2xl border border-white/15 shadow-2xl w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] glass-specular-top">
        {/* Header */}
        <div className="bg-[#060B18]/90 px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {editingTrade
                  ? lang === 'ro'
                    ? 'Editează Tranzacție în Jurnal'
                    : 'Edit Journal Trade'
                  : lang === 'ro'
                  ? 'Înregistrează Tranzacție Nouă în Jurnal'
                  : 'Log New Trade in Journal'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ro'
                  ? 'Adaugă detaliile și raportul R:R realizat pentru această zi.'
                  : 'Record trade details and achieved R:R ratio for this day.'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Row 1: Date & Times (Generation & Exit) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>{lang === 'ro' ? 'Data Generării' : 'Trade Date'}</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'ro' ? 'Ora Generării' : 'Generation Time'}</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-800 border border-emerald-500/50 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
              <span className="text-[10px] text-emerald-400/90 block mt-1">
                {lang === 'ro' ? '★ Bază Sesiuni & Ore Profitabile' : '★ Used for Sessions & Hourly Stats'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{lang === 'ro' ? 'Ora Închiderii' : 'Exit Time (opt)'}</span>
              </label>
              <input
                type="time"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
                placeholder="ex. 16:30"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {lang === 'ro' ? 'Marcare profit / TP / SL' : 'When trade closed / TP / SL'}
              </span>
            </div>
          </div>

          {/* Row 2: Instrument & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ro' ? 'Instrument / Simbol' : 'Instrument / Symbol'}
              </label>
              {!isCustomSymbol ? (
                <div className="space-y-1.5">
                  <select
                    value={instrumentId}
                    onChange={(e) => setInstrumentId(e.target.value as InstrumentId)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    {INSTRUMENT_OPTIONS.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.symbol} - {inst.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCustomSymbol(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    {lang === 'ro' ? '+ Folosește alt simbol personalizat' : '+ Use custom symbol'}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="ex. BTCUSD, US2000, CRUDE"
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomSymbol(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-300 underline cursor-pointer"
                  >
                    {lang === 'ro' ? '← Înapoi la lista prestabilită' : '← Back to presets'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ro' ? 'Direcție Tranzacție' : 'Trade Direction'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('BUY')}
                  className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    direction === 'BUY'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${direction === 'BUY' ? 'opacity-100' : 'opacity-0'}`} />
                  <span>BUY / LONG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SELL')}
                  className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    direction === 'SELL'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${direction === 'SELL' ? 'opacity-100' : 'opacity-0'}`} />
                  <span>SELL / SHORT</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Trade Status Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {lang === 'ro' ? 'Rezultat Tranzacție (Status)' : 'Trade Outcome (Status)'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('WIN')}
                className={`p-2.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer border ${
                  status === 'WIN'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">🎯 Câștig (WIN)</span>
                <span className="text-[10px] text-emerald-400 font-semibold">+RR Pozitiv</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('LOSS')}
                className={`p-2.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer border ${
                  status === 'LOSS'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">🛑 Pierdere (SL)</span>
                <span className="text-[10px] text-rose-400 font-semibold">-1.0R / Negativ</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('BREAKEVEN')}
                className={`p-2.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer border ${
                  status === 'BREAKEVEN'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">⚖️ Break-Even</span>
                <span className="text-[10px] text-amber-400 font-semibold">0.0R (Fără Risc)</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('RUNNING')}
                className={`p-2.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer border ${
                  status === 'RUNNING'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">⏳ În Rulare</span>
                <span className="text-[10px] text-blue-400 font-semibold">Deschis / Activ</span>
              </button>
            </div>
          </div>

          {/* Row 4: Price Levels & RR Calculator */}
          <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                <span>{lang === 'ro' ? 'Prețuri & Raport Risc/Recompensă (R:R)' : 'Prices & R:R Ratio'}</span>
              </span>
              <button
                type="button"
                onClick={handleAutoCalcRR}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <span>{lang === 'ro' ? 'Calculează R:R din prețuri' : 'Auto-calc R:R'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">{lang === 'ro' ? 'Preț Intrare' : 'Entry Price'}</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] text-rose-400 mb-1">{lang === 'ro' ? 'Stop Loss' : 'Stop Loss'}</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full bg-slate-900 border border-rose-900/60 rounded-lg px-2.5 py-1.5 text-rose-300 font-mono outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] text-emerald-400 mb-1">{lang === 'ro' ? 'Preț Ieșire / TP' : 'Exit Price / TP'}</label>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  className="w-full bg-slate-900 border border-emerald-900/60 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono outline-hidden"
                />
              </div>
            </div>

            {/* RR Achieved & PnL Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  {lang === 'ro' ? 'R:R Realizat (ex: +2.5R, -1.0R):' : 'Realized R:R (e.g. +2.5R, -1.0R):'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={rrAchieved}
                    onChange={(e) => setRrAchieved(e.target.value)}
                    className={`w-full bg-slate-900 border-2 rounded-xl px-3 py-2 text-base font-black font-mono outline-hidden ${
                      parseFloat(rrAchieved) > 0
                        ? 'border-emerald-500 text-emerald-400'
                        : parseFloat(rrAchieved) < 0
                        ? 'border-rose-500 text-rose-400'
                        : 'border-slate-600 text-slate-300'
                    }`}
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    R
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" />
                  <span>{lang === 'ro' ? 'Profit / Pierdere ($ opțional):' : 'Profit / Loss ($ optional):'}</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="ex: +450 sau -150"
                  value={pnl}
                  onChange={(e) => setPnl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Setup / Strategy & Timeframe */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {lang === 'ro' ? 'Model / Setup Utilizat' : 'Trading Setup / Strategy'}
              </label>
              <input
                type="text"
                list="setupSuggestions"
                value={setup}
                onChange={(e) => setSetup(e.target.value)}
                placeholder="ex. ICT Silver Bullet, FVG, Order Block..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-hidden"
              />
              <datalist id="setupSuggestions">
                {SETUP_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-hidden"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1D">1D</option>
              </select>
            </div>
          </div>

          {/* Row 6: Notes & Reflections */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {lang === 'ro' ? 'Note & Psihologie Trade' : 'Notes & Psychology'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                lang === 'ro'
                  ? 'Ce a mers bine? Ai respectat regulile de intrare? Observații despre sesiune...'
                  : 'What went well? Did you follow your risk rules? Session notes...'
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-hidden resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold transition cursor-pointer"
            >
              {lang === 'ro' ? 'Anulează' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold transition shadow-lg shadow-emerald-500/25 border border-emerald-400/30 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingTrade ? (lang === 'ro' ? 'Salvează Modificările' : 'Save Changes') : (lang === 'ro' ? 'Înregistrează Trade' : 'Log Trade')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
