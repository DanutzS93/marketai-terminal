import React from 'react';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Flame,
  ChevronRight,
  X,
  Check,
  TrendingDown,
  Info,
  Calendar,
} from 'lucide-react';
import { InstrumentId } from '../types';
import { INSTRUMENT_SPECS } from '../utils/lotCalculator';

export interface EconomicNewsEvent {
  id: string;
  title: string;
  titleRo?: string;
  titleEn?: string;
  currency: string;
  impact: string;
  date: string;
  dateRo?: string;
  dateEn?: string;
  status?: string;
  forecast?: string;
  previous?: string;
  actual?: string | null;
  unit?: string;
  description?: string;
  descriptionRo?: string;
  descriptionEn?: string;
}

interface UsdHighImpactWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  events: EconomicNewsEvent[];
  selectedInstrument: InstrumentId;
  lang: 'ro' | 'en';
}

export const UsdHighImpactWarningModal: React.FC<UsdHighImpactWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  events,
  selectedInstrument,
  lang,
}) => {
  if (!isOpen) return null;

  const isEn = lang === 'en';
  const spec = INSTRUMENT_SPECS[selectedInstrument] || INSTRUMENT_SPECS.NASDAQ;

  // Custom asset impact explanation
  const getAssetImpactExplanation = () => {
    const isGold = selectedInstrument === 'GOLD' || selectedInstrument === 'GC_F';
    const isIndex =
      selectedInstrument === 'NASDAQ' ||
      selectedInstrument === 'NQ_F' ||
      selectedInstrument === 'SPX500' ||
      selectedInstrument === 'ES_F' ||
      selectedInstrument === 'DOW_JONES' ||
      selectedInstrument === 'YM_F';
    const isForex = selectedInstrument === 'EURUSD' || selectedInstrument === 'GBPUSD' || selectedInstrument === 'USDJPY';

    if (isGold) {
      return isEn
        ? 'Gold (XAU/USD) is denominated in US Dollars and has direct inverse sensitivity to USD economic data. High impact releases (NFP, CPI, Fed Rates) typically cause sudden price spikes of $15 - $40 within seconds, temporary broker spread widening, and elevated slippage risk around entry and Stop Loss levels.'
        : 'Aurul (XAU/USD) este cotat direct în dolari americani și are o sensibilitate extremă la datele economice din SUA. Știrile cu impact ridicat (NFP, CPI, Decizia FED) generează adesea „lumânări fitil” bruște de 15 - 40$ în câteva secunde, lărgirea temporară a spread-ului la brokeri și risc de slippage la Stop Loss.';
    }

    if (isIndex) {
      return isEn
        ? `${spec.symbol} is heavily influenced by US monetary policy, interest rates, and labor indicators. Major USD events can cause sudden 100 - 250 point moves in indices, creating false breakouts before institutional orders find equilibrium.`
        : `${spec.symbol} reacționează agresiv la politica monetară a Rezervei Federale, ratele dobânzilor și piața muncii din SUA. Știrile de impact pot genera mișcări violente de 100 - 250 de puncte în câteva minute, cu posibile spargeri false înainte de stabilizarea lichidității.`;
    }

    if (isForex) {
      return isEn
        ? `${spec.symbol} is directly paired with the US Dollar. Anticipate sharp tick surges and liquidity gaps immediately following the news release. Market execution orders may experience slippage.`
        : `${spec.symbol} este direct ancorată la dolarul american. În momentul publicării știrilor HIGH se produc salturi bruște de preț, iar execuțiile la prețul pieței pot întâmpina slippage temporar.`;
    }

    return isEn
      ? 'Major US macroeconomic news produces extreme short-term volatility and broker spread expansion across all dollar-correlated instruments.'
      : 'Știrile macroeconomice majore din SUA produc volatilitate extremă pe termen scurt și lărgirea spread-ului brokerilor pe toate instrumentele corelate cu dolarul.';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <AlertTriangle className="w-6 h-6 text-amber-400 animate-bounce" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 mb-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>{isEn ? 'HIGH IMPACT USD NEWS DETECTED' : 'ȘTIRI CU IMPACT RIDICAT (HIGH) PE DOLAR'}</span>
              </div>
              <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                {isEn ? 'Economic Calendar Risk Warning' : 'Avertizare Știri Macroeconomice de Risc'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {isEn
                  ? 'High-impact USD events are scheduled today that may trigger extreme volatility.'
                  : 'Calendarul indică evenimente majore pe dolarul american astăzi, cu potențial de volatilitate extremă.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Section 1: Upcoming Events List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{isEn ? 'Scheduled High-Impact Events Today:' : 'Ce știri urmează pe dolar astăzi:'}</span>
            </h4>

            <div className="space-y-2.5">
              {events.map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/25 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      <span>{isEn ? (evt.titleEn || evt.title) : (evt.titleRo || evt.title)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        HIGH IMPACT
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-200">
                        USD
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-mono">
                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isEn ? (evt.dateEn || evt.date) : (evt.dateRo || evt.date)}</span>
                    </span>
                    {evt.forecast && evt.forecast !== '--' && (
                      <span className="text-slate-400">
                        {isEn ? 'Forecast' : 'Prognoză'}: <strong className="text-slate-200">{evt.forecast}</strong>
                      </span>
                    )}
                    {evt.previous && evt.previous !== '--' && (
                      <span className="text-slate-400">
                        {isEn ? 'Previous' : 'Anterior'}: <strong className="text-slate-200">{evt.previous}</strong>
                      </span>
                    )}
                  </div>

                  {(evt.descriptionRo || evt.description) && (
                    <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-white/5">
                      {isEn ? (evt.descriptionEn || evt.description) : (evt.descriptionRo || evt.description)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Potential Impact on Selected Asset */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>
                {isEn ? `Potential Impact on ${spec.symbol} (${spec.name}):` : `Ce impact poate să aibă asupra ${spec.symbol} (${spec.name}):`}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {getAssetImpactExplanation()}
            </p>
          </div>

          {/* Section 3: The Core Question */}
          <div className="p-4 rounded-xl bg-black/60 border border-white/10 text-center space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {isEn ? 'Institutional Risk Confirmation' : 'Confirmare Risc & Generare Semnal'}
            </span>
            <p className="text-base font-extrabold text-white">
              {isEn ? 'Do you still want to generate trading signals?' : 'Dorești să generezi în continuare semnale?'}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-6 pt-4 border-t border-white/10 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition shadow-sm flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>{isEn ? 'CANCEL' : 'ANULEAZĂ'}</span>
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-7 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 text-white" />
            <span>{isEn ? 'YES, GENERATE SIGNAL' : 'DA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
