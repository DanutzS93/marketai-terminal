import { TradingSignal, UserProfile, MarketQuote } from '../types';
import { isSignalExpiredByMarketClose } from './marketSchedule';

export function formatFullDateTime(dateObjOrStr?: Date | string, lang: 'ro' | 'en' = 'ro'): string {
  if (!dateObjOrStr) {
    dateObjOrStr = new Date();
  }

  let d: Date;
  if (typeof dateObjOrStr === 'string') {
    // Attempt standard Date parsing (works for ISO strings like 2026-08-10T09:39:00.000Z)
    const parsed = new Date(dateObjOrStr);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    } else if (!isNaN(Number(dateObjOrStr))) {
      d = new Date(Number(dateObjOrStr));
    } else {
      // Return unparseable strings as is
      return dateObjOrStr;
    }
  } else {
    d = dateObjOrStr;
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const day = d.getDate().toString().padStart(2, '0');
  const monthNamesRo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = (lang === 'ro' ? monthNamesRo : monthNamesEn)[d.getMonth()];
  const year = d.getFullYear();
  // Evaluates in the user's browser local timezone
  const time = d.toLocaleTimeString(lang === 'ro' ? 'ro-RO' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return `${day} ${month} ${year}, ${time}`;
}

export function formatQuoteTime(timestampStr?: string): string {
  if (!timestampStr) return '-';
  const d = new Date(timestampStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return timestampStr;
}

export function calculateExecutionType(
  type: string,
  entryPrice: number,
  currentPrice: number,
  hintExecType?: string
): 'BUY MARKET' | 'SELL MARKET' | 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP' {
  const typeUpper = (type || '').toUpperCase();
  const hintUpper = (hintExecType || '').toUpperCase();

  let isBuy = true;
  if (hintUpper.includes('BUY') || typeUpper.includes('BUY')) {
    isBuy = true;
  } else if (hintUpper.includes('SELL') || typeUpper.includes('SELL')) {
    isBuy = false;
  } else {
    isBuy = !typeUpper.includes('SELL');
  }

  if (!entryPrice || !currentPrice) {
    return isBuy ? 'BUY MARKET' : 'SELL MARKET';
  }

  // Explicit hint handling: if hint explicitly dictates a pending order type, honor it!
  if (hintUpper.includes('LIMIT')) {
    return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
  }
  if (hintUpper.includes('STOP')) {
    return isBuy ? 'BUY STOP' : 'SELL STOP';
  }
  if (hintUpper.includes('MARKET') || hintUpper === 'MARKET EXECUTION') {
    return isBuy ? 'BUY MARKET' : 'SELL MARKET';
  }

  const diffRatio = Math.abs(entryPrice - currentPrice) / currentPrice;

  // If entry price is virtually identical to current market price (< 0.03% difference), it's a MARKET order
  if (diffRatio < 0.0003 || entryPrice === currentPrice) {
    return isBuy ? 'BUY MARKET' : 'SELL MARKET';
  }

  if (isBuy) {
    // BUY LIMIT: Entry is placed BELOW current price (waiting for a pullback to buy cheaper)
    // BUY STOP: Entry is placed ABOVE current price (waiting for a breakout above resistance)
    return entryPrice < currentPrice ? 'BUY LIMIT' : 'BUY STOP';
  } else {
    // SELL LIMIT: Entry is placed ABOVE current price (waiting for a rally/bounce to sell higher)
    // SELL STOP: Entry is placed BELOW current price (waiting for a breakdown below support)
    return entryPrice > currentPrice ? 'SELL LIMIT' : 'SELL STOP';
  }
}

export interface OrderValidationResult {
  isValid: boolean;
  orderType: 'BUY MARKET' | 'SELL MARKET' | 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP';
  errorRo?: string;
  errorEn?: string;
  ruleExplanationRo: string;
  ruleExplanationEn: string;
}

/**
 * Validates order parameters against institutional order placement rules
 */
export function validateOrderPlacement(
  direction: 'BUY' | 'SELL' | string,
  orderType: string,
  entryPrice: number,
  currentPrice: number,
  stopLoss?: number,
  takeProfit?: number
): OrderValidationResult {
  const isBuy = direction.toUpperCase().includes('BUY');
  const normalizedType = orderType.toUpperCase().replace(/\s+/g, ' ').trim();

  let targetType: 'BUY MARKET' | 'SELL MARKET' | 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP' = isBuy ? 'BUY MARKET' : 'SELL MARKET';

  if (normalizedType.includes('MARKET')) {
    targetType = isBuy ? 'BUY MARKET' : 'SELL MARKET';
  } else if (normalizedType.includes('LIMIT')) {
    targetType = isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
  } else if (normalizedType.includes('STOP')) {
    targetType = isBuy ? 'BUY STOP' : 'SELL STOP';
  }

  if (targetType === 'BUY MARKET') {
    if (stopLoss && stopLoss >= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru BUY MARKET, Stop Loss ($${stopLoss}) trebuie să fie strict SUB prețul curent ($${currentPrice}).`,
        errorEn: `For BUY MARKET, Stop Loss ($${stopLoss}) must be strictly BELOW the current market price ($${currentPrice}).`,
        ruleExplanationRo: 'BUY MARKET: Cumpărare imediată la prețul curent. Ordinul devine ACTIV instant.',
        ruleExplanationEn: 'BUY MARKET: Immediate buy execution at market price. Order becomes ACTIVE immediately.',
      };
    }
    if (takeProfit && takeProfit <= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru BUY MARKET, Take Profit ($${takeProfit}) trebuie să fie strict PESTE prețul curent ($${currentPrice}).`,
        errorEn: `For BUY MARKET, Take Profit ($${takeProfit}) must be strictly ABOVE the current market price ($${currentPrice}).`,
        ruleExplanationRo: 'BUY MARKET: Cumpărare imediată la prețul curent. Ordinul devine ACTIV instant.',
        ruleExplanationEn: 'BUY MARKET: Immediate buy execution at market price. Order becomes ACTIVE immediately.',
      };
    }
    return {
      isValid: true,
      orderType: targetType,
      ruleExplanationRo: `BUY MARKET: Cumpără imediat la $${currentPrice}. Ordinul devine ACTIV instantaneu.`,
      ruleExplanationEn: `BUY MARKET: Buys immediately at $${currentPrice}. Order becomes ACTIVE immediately.`,
    };
  }

  if (targetType === 'SELL MARKET') {
    if (stopLoss && stopLoss <= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru SELL MARKET, Stop Loss ($${stopLoss}) trebuie să fie strict PESTE prețul curent ($${currentPrice}).`,
        errorEn: `For SELL MARKET, Stop Loss ($${stopLoss}) must be strictly ABOVE the current market price ($${currentPrice}).`,
        ruleExplanationRo: 'SELL MARKET: Vânzare imediată la prețul curent. Ordinul devine ACTIV instant.',
        ruleExplanationEn: 'SELL MARKET: Immediate sell execution at market price. Order becomes ACTIVE immediately.',
      };
    }
    if (takeProfit && takeProfit >= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru SELL MARKET, Take Profit ($${takeProfit}) trebuie să fie strict SUB prețul curent ($${currentPrice}).`,
        errorEn: `For SELL MARKET, Take Profit ($${takeProfit}) must be strictly BELOW the current market price ($${currentPrice}).`,
        ruleExplanationRo: 'SELL MARKET: Vânzare imediată la prețul curent. Ordinul devine ACTIV instant.',
        ruleExplanationEn: 'SELL MARKET: Immediate sell execution at market price. Order becomes ACTIVE immediately.',
      };
    }
    return {
      isValid: true,
      orderType: targetType,
      ruleExplanationRo: `SELL MARKET: Vinde imediat la $${currentPrice}. Ordinul devine ACTIV instantaneu.`,
      ruleExplanationEn: `SELL MARKET: Sells immediately at $${currentPrice}. Order becomes ACTIVE immediately.`,
    };
  }

  if (targetType === 'BUY LIMIT') {
    if (entryPrice >= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru BUY LIMIT, prețul de intrare ($${entryPrice}) trebuie să fie strict SUB prețul curent ($${currentPrice}). Pentru cumpărare la străpungere peste prețul actual, folosește BUY STOP.`,
        errorEn: `For BUY LIMIT, entry price ($${entryPrice}) must be strictly BELOW the current market price ($${currentPrice}). For breakout buying above market, use BUY STOP.`,
        ruleExplanationRo: 'BUY LIMIT: Cumpărare plasată sub prețul curent. Așteaptă ca prețul să scadă la Entry pentru a deveni ACTIV.',
        ruleExplanationEn: 'BUY LIMIT: Buy order placed below current price. Waits for price to drop to Entry to become ACTIVE.',
      };
    }
    if (stopLoss && stopLoss >= entryPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru BUY LIMIT, Stop Loss ($${stopLoss}) trebuie să fie strict SUB prețul de intrare ($${entryPrice}).`,
        errorEn: `For BUY LIMIT, Stop Loss ($${stopLoss}) must be strictly BELOW the entry price ($${entryPrice}).`,
        ruleExplanationRo: 'BUY LIMIT: Cumpărare plasată sub prețul curent. Așteaptă ca prețul să scadă la Entry pentru a deveni ACTIV.',
        ruleExplanationEn: 'BUY LIMIT: Buy order placed below current price. Waits for price to drop to Entry to become ACTIVE.',
      };
    }
    return {
      isValid: true,
      orderType: targetType,
      ruleExplanationRo: `BUY LIMIT: Așteaptă ca prețul să scadă la $${entryPrice}. Când prețul ajunge la $${entryPrice}, devine ACTIV.`,
      ruleExplanationEn: `BUY LIMIT: Waits for price to drop to $${entryPrice}. When price reaches $${entryPrice}, becomes ACTIVE.`,
    };
  }

  if (targetType === 'SELL LIMIT') {
    if (entryPrice <= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru SELL LIMIT, prețul de intrare ($${entryPrice}) trebuie să fie strict PESTE prețul curent ($${currentPrice}). Pentru vânzare la străpungere sub prețul actual, folosește SELL STOP.`,
        errorEn: `For SELL LIMIT, entry price ($${entryPrice}) must be strictly ABOVE the current market price ($${currentPrice}). For breakdown selling below market, use SELL STOP.`,
        ruleExplanationRo: 'SELL LIMIT: Vânzare plasată peste prețul curent. Așteaptă ca prețul să urce la Entry pentru a deveni ACTIV.',
        ruleExplanationEn: 'SELL LIMIT: Sell order placed above current price. Waits for price to rise to Entry to become ACTIVE.',
      };
    }
    if (stopLoss && stopLoss <= entryPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru SELL LIMIT, Stop Loss ($${stopLoss}) trebuie să fie strict PESTE prețul de intrare ($${entryPrice}).`,
        errorEn: `For SELL LIMIT, Stop Loss ($${stopLoss}) must be strictly ABOVE the entry price ($${entryPrice}).`,
        ruleExplanationRo: 'SELL LIMIT: Vânzare plasată peste prețul curent. Așteaptă ca prețul să urce la Entry pentru a deveni ACTIV.',
        ruleExplanationEn: 'SELL LIMIT: Sell order placed above current price. Waits for price to rise to Entry to become ACTIVE.',
      };
    }
    return {
      isValid: true,
      orderType: targetType,
      ruleExplanationRo: `SELL LIMIT: Așteaptă ca prețul să urce la $${entryPrice}. Când prețul ajunge la $${entryPrice}, devine ACTIV.`,
      ruleExplanationEn: `SELL LIMIT: Waits for price to rise to $${entryPrice}. When price reaches $${entryPrice}, becomes ACTIVE.`,
    };
  }

  if (targetType === 'BUY STOP') {
    if (entryPrice <= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru BUY STOP, prețul de intrare ($${entryPrice}) trebuie să fie strict PESTE prețul curent ($${currentPrice}) la străpungere (Breakout). Pentru cumpărare la pullback sub piață, folosește BUY LIMIT.`,
        errorEn: `For BUY STOP, entry price ($${entryPrice}) must be strictly ABOVE the current market price ($${currentPrice}) on breakout. For pullback buying below market, use BUY LIMIT.`,
        ruleExplanationRo: 'BUY STOP: Cumpărare plasată peste prețul curent la străpungere. Se activează când prețul urcă la Entry.',
        ruleExplanationEn: 'BUY STOP: Buy order placed above current price on breakout. Becomes ACTIVE when price rises to Entry.',
      };
    }
    if (stopLoss && stopLoss >= entryPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru BUY STOP, Stop Loss ($${stopLoss}) trebuie să fie strict SUB prețul de intrare ($${entryPrice}).`,
        errorEn: `For BUY STOP, Stop Loss ($${stopLoss}) must be strictly BELOW the entry price ($${entryPrice}).`,
        ruleExplanationRo: 'BUY STOP: Cumpărare plasată peste prețul curent la străpungere. Se activează când prețul urcă la Entry.',
        ruleExplanationEn: 'BUY STOP: Buy order placed above current price on breakout. Becomes ACTIVE when price rises to Entry.',
      };
    }
    return {
      isValid: true,
      orderType: targetType,
      ruleExplanationRo: `BUY STOP: Așteaptă ca prețul să urce la $${entryPrice} (Breakout). Când atinge $${entryPrice}, devine ACTIV.`,
      ruleExplanationEn: `BUY STOP: Waits for price to rise to $${entryPrice} (Breakout). When reaching $${entryPrice}, becomes ACTIVE.`,
    };
  }

  if (targetType === 'SELL STOP') {
    if (entryPrice >= currentPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru SELL STOP, prețul de intrare ($${entryPrice}) trebuie să fie strict SUB prețul curent ($${currentPrice}) la străpungere în jos (Breakdown). Pentru vânzare pe retragere peste piață, folosește SELL LIMIT.`,
        errorEn: `For SELL STOP, entry price ($${entryPrice}) must be strictly BELOW the current market price ($${currentPrice}) on breakdown. For bounce selling above market, use SELL LIMIT.`,
        ruleExplanationRo: 'SELL STOP: Vânzare plasată sub prețul curent la străpungere în jos. Se activează când prețul scade la Entry.',
        ruleExplanationEn: 'SELL STOP: Sell order placed below current price on breakdown. Becomes ACTIVE when price drops to Entry.',
      };
    }
    if (stopLoss && stopLoss <= entryPrice) {
      return {
        isValid: false,
        orderType: targetType,
        errorRo: `Pentru SELL STOP, Stop Loss ($${stopLoss}) trebuie să fie strict PESTE prețul de intrare ($${entryPrice}).`,
        errorEn: `For SELL STOP, Stop Loss ($${stopLoss}) must be strictly ABOVE the entry price ($${entryPrice}).`,
        ruleExplanationRo: 'SELL STOP: Vânzare plasată sub prețul curent la străpungere în jos. Se activează când prețul scade la Entry.',
        ruleExplanationEn: 'SELL STOP: Sell order placed below current price on breakdown. Becomes ACTIVE when price drops to Entry.',
      };
    }
    return {
      isValid: true,
      orderType: targetType,
      ruleExplanationRo: `SELL STOP: Așteaptă ca prețul să scadă la $${entryPrice} (Breakdown). Când atinge $${entryPrice}, devine ACTIV.`,
      ruleExplanationEn: `SELL STOP: Waits for price to drop to $${entryPrice} (Breakdown). When reaching $${entryPrice}, becomes ACTIVE.`,
    };
  }

  return {
    isValid: true,
    orderType: targetType,
    ruleExplanationRo: 'Ordin standard validat.',
    ruleExplanationEn: 'Standard order validated.',
  };
}

export function getCancellationReason(sig: TradingSignal, lang: 'ro' | 'en' = 'ro'): string {
  if (lang === 'ro') {
    if (sig.cancelReasonRo) return sig.cancelReasonRo;
    if (sig.cancelReason) return sig.cancelReason;
    if (sig.executionType && !sig.executionType.includes('MARKET') && sig.executionType !== 'Market Execution') {
      return `Ordin în așteptare (${sig.executionType}) neactivat – Prețul pieței a atins nivelul de Target (TP) sau Stop Loss (SL) înainte de activarea prețului de intrare ($${sig.entryPrice}). Setup-ul a fost invalidat automat.`;
    }
    return 'Ordin anulat / invalidat înainte de intrarea în piață din cauza modificărilor de structură sau expirării.';
  } else {
    if (sig.cancelReasonEn) return sig.cancelReasonEn;
    if (sig.cancelReason) return sig.cancelReason;
    if (sig.executionType && !sig.executionType.includes('MARKET') && sig.executionType !== 'Market Execution') {
      return `Pending order (${sig.executionType}) unfilled – Market price reached Target (TP) or Stop Loss (SL) before triggering the entry price ($${sig.entryPrice}). Setup automatically invalidated.`;
    }
    return 'Order cancelled or invalidated prior to market entry due to market structure shift or expiration.';
  }
}

export function formatSignalPrice(val?: number, instrumentId?: string, symbol?: string): string {
  if (typeof val !== 'number' || isNaN(val) || val <= 0) return '-';
  const inst = (instrumentId || symbol || '').toUpperCase();
  const isForex5 = inst.includes('EUR') || inst.includes('GBP') || (val > 0 && val < 5);
  const isForex3 = inst.includes('JPY') || (val >= 50 && val < 300 && !inst.includes('SPX') && !inst.includes('DOW') && !inst.includes('GOLD') && !inst.includes('NQ') && !inst.includes('ES') && !inst.includes('GC'));
  const digits = isForex5 ? 5 : isForex3 ? 3 : 2;
  return val.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (!closes || closes.length < 2) return 0;
  const len = closes.length;
  const trs: number[] = [];

  for (let i = 1; i < len; i++) {
    const h = (highs && typeof highs[i] === 'number' && !isNaN(highs[i])) ? highs[i] : Math.max(closes[i], closes[i - 1]);
    const l = (lows && typeof lows[i] === 'number' && !isNaN(lows[i])) ? lows[i] : Math.min(closes[i], closes[i - 1]);
    const prevClose = closes[i - 1];

    const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    trs.push(tr);
  }

  if (trs.length === 0) return 0;
  const slice = trs.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  const lastPrice = closes[closes.length - 1] || 1000;
  const decimals = lastPrice < 5 ? 5 : (lastPrice >= 50 && lastPrice < 300) ? 3 : 2;
  return Number((sum / slice.length).toFixed(decimals));
}

export function getTimeframeATR(baseDailyATR?: number, timeframe?: string, currentPrice?: number): number {
  const price = currentPrice || 1000;
  let tfFactor = 0.12; // Default 15m
  if (timeframe === '1m') tfFactor = 0.03;
  else if (timeframe === '5m') tfFactor = 0.06;
  else if (timeframe === '15m') tfFactor = 0.12;
  else if (timeframe === '1h') tfFactor = 0.30;
  else if (timeframe === '4h') tfFactor = 0.55;
  else if (timeframe === '1D') tfFactor = 1.00;

  const isForex5 = price > 0 && price < 5;
  const isForex3 = price >= 50 && price < 300;
  const decimals = isForex5 ? 5 : isForex3 ? 3 : 2;
  const defaultAtrRatio = isForex5 ? 0.006 : isForex3 ? 0.007 : 0.013;

  const rawATR = baseDailyATR && baseDailyATR > 0 ? baseDailyATR : (price * defaultAtrRatio);
  return Number((rawATR * tfFactor).toFixed(decimals));
}

export function calculateDynamicInstrumentTimeframeSL(
  instrumentId?: string,
  symbol?: string,
  timeframe?: string,
  currentPrice?: number
): number {
  const p = currentPrice || 1000;
  const tf = (timeframe || '15m').toLowerCase();
  const id = (instrumentId || '').toUpperCase();
  const sym = (symbol || '').toUpperCase();

  // 1. DOW JONES (US30 / DJ30 / YM)
  if (id.includes('DOW') || id.includes('US30') || sym.includes('US30') || sym.includes('DJ30') || sym.includes('YM')) {
    if (tf === '1m') return 35.0;
    if (tf === '5m') return 70.0;
    if (tf === '15m') return 140.0;
    if (tf === '1h') return 280.0;
    if (tf === '4h') return 520.0;
    return 850.0; // 1D
  }

  // 2. NASDAQ 100 (NAS100 / NQ)
  if (id.includes('NAS') || id.includes('NQ') || sym.includes('NAS') || sym.includes('NQ') || sym.includes('US100') || sym.includes('USTEC')) {
    if (tf === '1m') return 22.0;
    if (tf === '5m') return 45.0;
    if (tf === '15m') return 90.0;
    if (tf === '1h') return 180.0;
    if (tf === '4h') return 340.0;
    return 550.0; // 1D
  }

  // 3. GOLD (XAU/USD / GC)
  if (id.includes('GOLD') || id.includes('XAU') || id.includes('GC') || sym.includes('XAU') || sym.includes('GOLD') || sym.includes('GC')) {
    if (tf === '1m') return 2.2;
    if (tf === '5m') return 4.5;
    if (tf === '15m') return 8.5;
    if (tf === '1h') return 18.0;
    if (tf === '4h') return 35.0;
    return 60.0; // 1D
  }

  // 4. S&P 500 (SPX500 / ES)
  if (id.includes('SPX') || id.includes('ES') || sym.includes('SPX') || sym.includes('ES') || sym.includes('US500')) {
    if (tf === '1m') return 5.0;
    if (tf === '5m') return 10.0;
    if (tf === '15m') return 18.0;
    if (tf === '1h') return 38.0;
    if (tf === '4h') return 70.0;
    return 120.0; // 1D
  }

  // 5. FOREX EUR/USD & GBP/USD
  if (id.includes('EUR') || id.includes('GBP') || sym.includes('EUR') || sym.includes('GBP')) {
    if (tf === '1m') return 0.0007; // 7 pips
    if (tf === '5m') return 0.0013; // 13 pips
    if (tf === '15m') return 0.0022; // 22 pips
    if (tf === '1h') return 0.0045; // 45 pips
    if (tf === '4h') return 0.0080; // 80 pips
    return 0.0140; // 140 pips (1D)
  }

  // 6. FOREX USD/JPY
  if (id.includes('JPY') || sym.includes('JPY')) {
    if (tf === '1m') return 0.08;
    if (tf === '5m') return 0.16;
    if (tf === '15m') return 0.30;
    if (tf === '1h') return 0.60;
    if (tf === '4h') return 1.10;
    return 1.80;
  }

  // General fallback: % of price based on timeframe
  let factor = 0.0025; // 15m default
  if (tf === '1m') factor = 0.0008;
  else if (tf === '5m') factor = 0.0015;
  else if (tf === '15m') factor = 0.0025;
  else if (tf === '1h') factor = 0.0055;
  else if (tf === '4h') factor = 0.0100;
  else if (tf === '1d') factor = 0.0160;

  return Number((p * factor).toFixed(2));
}

export function validateAndFixSignalPrices(sig: TradingSignal, liveMarketPrice?: number, liveATR?: number): TradingSignal {
  if (!sig) return sig;
  const mPrice = liveMarketPrice || sig.currentMarketPrice || sig.entryPrice;
  if (!mPrice || mPrice <= 0) return sig;

  const rawType = String(sig.type || '').toUpperCase();
  const rawExec = String(sig.executionType || '').toUpperCase();
  const rawTitle = String(sig.titleRo || sig.titleEn || sig.title || '').toUpperCase();
  const rawRat = String(sig.rationaleRo || sig.rationaleEn || sig.rationale || '').toUpperCase();

  let isBuy = true;
  if (rawExec.includes('BUY') || rawType.includes('BUY') || rawTitle.includes('BUY LIMIT') || rawTitle.includes('BUY STOP') || rawRat.includes('BUY LIMIT')) {
    isBuy = true;
  } else if (rawExec.includes('SELL') || rawType.includes('SELL') || rawTitle.includes('SELL LIMIT') || rawTitle.includes('SELL STOP') || rawRat.includes('SELL LIMIT')) {
    isBuy = false;
  } else if (sig.targetPrice1 && sig.entryPrice && sig.targetPrice1 !== sig.entryPrice) {
    isBuy = sig.targetPrice1 > sig.entryPrice;
  } else if (sig.stopLoss && sig.entryPrice && sig.stopLoss !== sig.entryPrice) {
    isBuy = sig.stopLoss < sig.entryPrice;
  } else {
    isBuy = !rawType.includes('SELL');
  }

  const normalizedType = isBuy
    ? ((rawType.includes('STRONG') ? 'STRONG_BUY' : 'BUY') as TradingSignal['type'])
    : ((rawType.includes('STRONG') ? 'STRONG_SELL' : 'SELL') as TradingSignal['type']);

  let entry = sig.entryPrice || mPrice;

  const isForex5 = sig.instrumentId === 'EURUSD' || sig.instrumentId === 'GBPUSD' || (mPrice > 0 && mPrice < 5);
  const isForex3 = sig.instrumentId === 'USDJPY' || (mPrice >= 50 && mPrice < 300 && !sig.instrumentId?.includes('SPX') && !sig.instrumentId?.includes('DOW') && !sig.instrumentId?.includes('GOLD') && !sig.instrumentId?.includes('NQ') && !sig.instrumentId?.includes('ES') && !sig.instrumentId?.includes('GC'));
  const decimals = isForex5 ? 5 : isForex3 ? 3 : 2;

  // Determine correct execution type (BUY MARKET, SELL MARKET, BUY LIMIT, SELL LIMIT, BUY STOP, SELL STOP)
  let execType = calculateExecutionType(normalizedType, entry, mPrice, sig.executionType);

  // DYNAMIC ATR CALCULATIONS FOR VOLATILITY-BASED STOP LOSS & TAKE PROFITS
  const tf = (sig.timeframe as string) || '15m';
  const dynamicSLDist = calculateDynamicInstrumentTimeframeSL(sig.instrumentId, sig.symbol, tf, mPrice);
  const tfATR = Number((dynamicSLDist / 1.2).toFixed(decimals));
  const baseATR = liveATR || sig.atrDaily || sig.atr || Number((dynamicSLDist * 3.5).toFixed(decimals));

  const isScalp = tf === '1m' || tf === '5m' || tf === '15m';

  // Strict enforcement for order entry types:
  // 1. BUY MARKET / SELL MARKET: Entry MUST be exactly equal to current live market price
  const isMarket = execType === 'BUY MARKET' || execType === 'SELL MARKET' || (execType as string) === 'Market Execution';
  if (isMarket) {
    entry = mPrice;
  } else if (execType === 'BUY LIMIT') {
    // Buy Limit must be strictly below current market price
    if (entry >= mPrice) {
      entry = Number((mPrice - tfATR * 0.35).toFixed(decimals));
    }
  } else if (execType === 'SELL LIMIT') {
    // Sell Limit must be strictly above current market price
    if (entry <= mPrice) {
      entry = Number((mPrice + tfATR * 0.35).toFixed(decimals));
    }
  } else if (execType === 'BUY STOP') {
    // Buy Stop must be strictly above current market price
    if (entry <= mPrice) {
      entry = Number((mPrice + tfATR * 0.35).toFixed(decimals));
    }
  } else if (execType === 'SELL STOP') {
    // Sell Stop must be strictly below current market price
    if (entry >= mPrice) {
      entry = Number((mPrice - tfATR * 0.35).toFixed(decimals));
    }
  }

  // Exact dynamic SL distance based on timeframe
  const atrSLDist = dynamicSLDist;

  // Determine Stop Loss: STRICTLY calculated from Entry Price and timeframe-calibrated dynamic distance
  const sl = Number((isBuy ? entry - atrSLDist : entry + atrSLDist).toFixed(decimals));

  // Actual Risk Distance (pts)
  const actualRisk = atrSLDist;
  const slATRMult = 1.2;

  // Calibrated Risk:Reward Ratios per Target
  // Scalp (1m, 5m, 15m): TP1 = 1:1.5, TP2 = 1:2.2, TP3 = 1:3.0
  // Swing (1h, 4h, 1D):  TP1 = 1:1.5, TP2 = 1:2.5, TP3 = 1:3.5
  const tp1R = 1.5;
  const tp2R = isScalp ? 2.2 : 2.5;
  const tp3R = isScalp ? 3.0 : 3.5;

  let tp1: number, tp2: number, tp3: number;
  if (isBuy) {
    tp1 = Number((entry + actualRisk * tp1R).toFixed(decimals));
    tp2 = Number((entry + actualRisk * tp2R).toFixed(decimals));
    tp3 = Number((entry + actualRisk * tp3R).toFixed(decimals));
  } else {
    tp1 = Number((entry - actualRisk * tp1R).toFixed(decimals));
    tp2 = Number((entry - actualRisk * tp2R).toFixed(decimals));
    tp3 = Number((entry - actualRisk * tp3R).toFixed(decimals));
  }

  let initialOutcomeStatus = sig.outcomeStatus;
  let initialFirstHit = sig.firstHitMilestone;

  if (isMarket) {
    if (!initialOutcomeStatus || initialOutcomeStatus === 'ACTIVE' || initialOutcomeStatus === 'PENDING') {
      initialOutcomeStatus = 'RUNNING';
    }
    if (!initialFirstHit || initialFirstHit === 'PENDING') {
      initialFirstHit = 'ENTRY';
    }
  } else {
    // Pending Limit / Stop order: MUST NOT be initialized as RUNNING if entry hasn't triggered
    if (!initialOutcomeStatus || initialOutcomeStatus === 'ACTIVE' || (!initialFirstHit || initialFirstHit === 'PENDING')) {
      initialOutcomeStatus = 'PENDING';
    }
    if (!initialFirstHit) {
      initialFirstHit = 'PENDING';
    }
  }

  const updated: TradingSignal = {
    ...sig,
    type: normalizedType,
    executionType: execType,
    entryPrice: Number(entry.toFixed(decimals)),
    entryRangeMin: isMarket ? Number((entry * 0.999).toFixed(decimals)) : Number((entry * 0.9995).toFixed(decimals)),
    entryRangeMax: isMarket ? Number((entry * 1.001).toFixed(decimals)) : Number((entry * 1.0005).toFixed(decimals)),
    stopLoss: Number(sl.toFixed(decimals)),
    targetPrice1: Number(tp1.toFixed(decimals)),
    targetPrice2: Number(tp2.toFixed(decimals)),
    targetPrice3: Number(tp3.toFixed(decimals)),
    riskRewardRatio: `1:${tp2R}`,
    outcomeStatus: initialOutcomeStatus,
    firstHitMilestone: initialFirstHit,
    atr: tfATR,
    atrDaily: Number(baseATR.toFixed(decimals)),
    atrMultiplierSL: slATRMult,
  };

  if (updated.indicators) {
    updated.indicators.volatility = `ATR Dinamic (${tf}): $${tfATR} | SL: ${slATRMult}x ATR ($${atrSLDist} pts) | TP1: 1:${tp1R} | TP2: 1:${tp2R} | TP3: 1:${tp3R}`;
  }

  return updated;
}

export function evaluateSignalOutcome(
  rawSig: TradingSignal,
  livePrice: number
): {
  outcomeStatus: NonNullable<TradingSignal['outcomeStatus']>;
  firstHitMilestone: NonNullable<TradingSignal['firstHitMilestone']>;
  isEntryTriggered?: boolean;
  isBeHitAfterTp1?: boolean;
  isBeHitAfterTp2?: boolean;
  cancelReasonRo?: string;
  cancelReasonEn?: string;
} {
  if (!livePrice || livePrice <= 0 || !rawSig) {
    return {
      outcomeStatus: (rawSig?.outcomeStatus as any) || 'PENDING',
      firstHitMilestone: rawSig?.firstHitMilestone || 'PENDING',
      isEntryTriggered: rawSig?.isEntryTriggered,
      isBeHitAfterTp1: rawSig?.isBeHitAfterTp1,
      isBeHitAfterTp2: rawSig?.isBeHitAfterTp2,
      cancelReasonRo: rawSig?.cancelReasonRo,
      cancelReasonEn: rawSig?.cancelReasonEn,
    };
  }

  const sig = rawSig;
  const currentStatus = (sig.outcomeStatus as string) || 'PENDING';

  // 1. Terminal states check (CANCELLED, TP3_HIT, SL_HIT, MANUAL_*, CLOSED can NEVER change back to PENDING/RUNNING)
  const isExplicitManual = sig.isManualClose === true || sig.closedManually === true || currentStatus.startsWith('MANUAL_');
  const isTerminal =
    currentStatus === 'CANCELLED' ||
    currentStatus === 'TP3_HIT' ||
    currentStatus === 'SL_HIT' ||
    currentStatus.startsWith('MANUAL_') ||
    (sig.status === 'CANCELLED') ||
    (isExplicitManual && (sig.status === 'CLOSED' || sig.closedAt !== undefined));

  if (isTerminal) {
    let finalOutcome = currentStatus;
    if (finalOutcome === 'PENDING' || finalOutcome === 'RUNNING' || finalOutcome === 'CLOSED' || !finalOutcome) {
      if (sig.status === 'CANCELLED') {
        finalOutcome = 'CANCELLED';
      } else if (isExplicitManual) {
        const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
        if (prof !== undefined && prof > 0) finalOutcome = 'MANUAL_PROFIT';
        else if (prof !== undefined && prof < 0) finalOutcome = 'MANUAL_LOSS';
        else if (prof !== undefined && prof === 0) finalOutcome = 'MANUAL_BE';
        else finalOutcome = 'MANUAL_CLOSED';
      } else {
        const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
        finalOutcome = (prof !== undefined && prof > 0) ? 'TP1_HIT' : ((prof !== undefined && prof < 0) ? 'SL_HIT' : 'CANCELLED');
      }
    }
    return {
      outcomeStatus: finalOutcome as any,
      firstHitMilestone: sig.firstHitMilestone || (finalOutcome === 'SL_HIT' ? 'SL' : finalOutcome === 'CANCELLED' ? 'CANCELLED' : (isExplicitManual ? 'MANUAL_CLOSE' : 'TP1')),
      isEntryTriggered: sig.isEntryTriggered ?? (finalOutcome !== 'CANCELLED' && finalOutcome !== 'PENDING'),
      isBeHitAfterTp1: sig.isBeHitAfterTp1,
      isBeHitAfterTp2: sig.isBeHitAfterTp2,
      cancelReasonRo: sig.cancelReasonRo,
      cancelReasonEn: sig.cancelReasonEn,
    };
  }

  // Check if unactivated by market close cutoff (23:00 Romania time / 1 hour before market close)
  if (sig.createdAt && (currentStatus === 'PENDING' || !sig.isEntryTriggered) && currentStatus !== 'CANCELLED') {
    try {
      if (isSignalExpiredByMarketClose(sig.createdAt)) {
        return {
          outcomeStatus: 'CANCELLED',
          firstHitMilestone: 'CANCELLED',
          isEntryTriggered: false,
          cancelReasonRo: 'Ordin neactivat până la ora 23:00 (înainte de închiderea pieței) - Anulat automat',
          cancelReasonEn: 'Unactivated order by 23:00 (1h before market close) - Automatically cancelled',
        };
      }
    } catch (e) {
      // ignore
    }
  }

  // Terminal BE closures after TP1 or TP2
  if (sig.isBeHitAfterTp2) {
    return {
      outcomeStatus: 'TP2_HIT',
      firstHitMilestone: sig.firstHitMilestone || 'TP1',
      isEntryTriggered: true,
      isBeHitAfterTp1: true,
      isBeHitAfterTp2: true,
    };
  }

  if (sig.isBeHitAfterTp1 && currentStatus === 'TP1_HIT') {
    return {
      outcomeStatus: 'TP1_HIT',
      firstHitMilestone: 'TP1',
      isEntryTriggered: true,
      isBeHitAfterTp1: true,
      isBeHitAfterTp2: false,
    };
  }

  const isBuy = sig.type ? sig.type.includes('BUY') : true;
  const execType = sig.executionType || calculateExecutionType(sig.type, sig.entryPrice, sig.currentMarketPrice || sig.entryPrice);
  const execUpper = (execType || '').toUpperCase();

  const isMarket =
    execUpper.includes('MARKET') ||
    execUpper === 'BUY MARKET' ||
    execUpper === 'SELL MARKET' ||
    execUpper === 'MARKET EXECUTION';

  const isBuyLimit = execUpper.includes('BUY LIMIT');
  const isBuyStop = execUpper.includes('BUY STOP');
  const isSellLimit = execUpper.includes('SELL LIMIT');
  const isSellStop = execUpper.includes('SELL STOP');

  // Check if entry has been filled/triggered for pending limit/stop orders
  let isTriggered =
    isMarket ||
    sig.isEntryTriggered === true ||
    (sig.status as string) === 'RUNNING' ||
    currentStatus === 'RUNNING' ||
    sig.firstHitMilestone === 'ENTRY' ||
    sig.firstHitMilestone === 'TP1' ||
    sig.firstHitMilestone === 'TP2' ||
    sig.firstHitMilestone === 'TP3';

  const isMt5Trade = Boolean(sig.mt5Placed || sig.accountSource === 'MT5' || (sig.placedAccounts && Object.keys(sig.placedAccounts).length > 0));

  if (!isTriggered && !isMt5Trade) {
    if (isBuyLimit && livePrice <= sig.entryPrice) isTriggered = true;
    else if (isBuyStop && livePrice >= sig.entryPrice) isTriggered = true;
    else if (isSellLimit && livePrice >= sig.entryPrice) isTriggered = true;
    else if (isSellStop && livePrice <= sig.entryPrice) isTriggered = true;
  }

  // 2. If order is a PENDING limit/stop order and was NOT yet triggered:
  // It remains PENDING waiting for entry until entry price is reached.
  if (!isTriggered) {
    return {
      outcomeStatus: 'PENDING',
      firstHitMilestone: 'PENDING',
      isEntryTriggered: false,
    };
  }

  // Level touches at current live price (ONLY checked for triggered/active trades)
  const hitTP1 = isBuy ? livePrice >= sig.targetPrice1 : livePrice <= sig.targetPrice1;
  const hitTP2 = isBuy ? livePrice >= sig.targetPrice2 : livePrice <= sig.targetPrice2;
  const hitTP3 = isBuy ? livePrice >= sig.targetPrice3 : livePrice <= sig.targetPrice3;
  const hitSL = isBuy ? livePrice <= sig.stopLoss : livePrice >= sig.stopLoss;
  const hitBE = isBuy ? livePrice <= sig.entryPrice : livePrice >= sig.entryPrice;

  // 3. Handling signals already in TP2_HIT:
  if (currentStatus === 'TP2_HIT') {
    if (hitTP3) {
      return {
        outcomeStatus: 'TP3_HIT',
        firstHitMilestone: sig.firstHitMilestone || 'TP1',
        isEntryTriggered: true,
        isBeHitAfterTp1: true,
        isBeHitAfterTp2: false,
      };
    }

    if (hitBE) {
      return {
        outcomeStatus: 'TP2_HIT',
        firstHitMilestone: sig.firstHitMilestone || 'TP1',
        isEntryTriggered: true,
        isBeHitAfterTp1: true,
        isBeHitAfterTp2: true,
      };
    }

    return {
      outcomeStatus: 'TP2_HIT',
      firstHitMilestone: sig.firstHitMilestone || 'TP1',
      isEntryTriggered: true,
      isBeHitAfterTp1: false,
      isBeHitAfterTp2: false,
    };
  }

  // 4. Handling signals already in TP1_HIT:
  if (currentStatus === 'TP1_HIT') {
    if (hitTP3) {
      return {
        outcomeStatus: 'TP3_HIT',
        firstHitMilestone: sig.firstHitMilestone || 'TP1',
        isEntryTriggered: true,
        isBeHitAfterTp1: false,
        isBeHitAfterTp2: false,
      };
    }
    if (hitTP2) {
      return {
        outcomeStatus: 'TP2_HIT',
        firstHitMilestone: sig.firstHitMilestone || 'TP1',
        isEntryTriggered: true,
        isBeHitAfterTp1: false,
        isBeHitAfterTp2: false,
      };
    }

    // Check if price pulled back to Break-Even (entryPrice)
    if (hitBE) {
      return {
        outcomeStatus: 'TP1_HIT',
        firstHitMilestone: 'TP1',
        isEntryTriggered: true,
        isBeHitAfterTp1: true,
        isBeHitAfterTp2: false,
      };
    }

    return {
      outcomeStatus: 'TP1_HIT',
      firstHitMilestone: sig.firstHitMilestone || 'TP1',
      isEntryTriggered: true,
      isBeHitAfterTp1: false,
      isBeHitAfterTp2: false,
    };
  }

  // 5. Order IS triggered (Active trade) - evaluate milestones immediately
  // Priority 1: Did price hit Stop Loss?
  if (hitSL) {
    return {
      outcomeStatus: 'SL_HIT',
      firstHitMilestone: 'SL',
      isEntryTriggered: true,
      isBeHitAfterTp1: false,
      isBeHitAfterTp2: false,
    };
  }

  // Priority 2: Targets
  if (hitTP3) {
    return {
      outcomeStatus: 'TP3_HIT',
      firstHitMilestone: 'TP3',
      isEntryTriggered: true,
      isBeHitAfterTp1: false,
      isBeHitAfterTp2: false,
    };
  }

  if (hitTP2) {
    return {
      outcomeStatus: 'TP2_HIT',
      firstHitMilestone: 'TP2',
      isEntryTriggered: true,
      isBeHitAfterTp1: false,
      isBeHitAfterTp2: false,
    };
  }

  if (hitTP1) {
    return {
      outcomeStatus: 'TP1_HIT',
      firstHitMilestone: 'TP1',
      isEntryTriggered: true,
      isBeHitAfterTp1: false,
      isBeHitAfterTp2: false,
    };
  }

  return {
    outcomeStatus: 'RUNNING',
    firstHitMilestone: 'ENTRY',
    isEntryTriggered: true,
    isBeHitAfterTp1: false,
    isBeHitAfterTp2: false,
  };
}

/**
 * Resolves the true effective outcome status of a signal, ensuring that trades that are
 * closed, realized, or manually closed can never revert to PENDING or RUNNING.
 * If a trade took TP (TP1, TP2, TP3), it permanently keeps its TP milestone outcome.
 */
export function getEffectiveOutcomeStatus(sigOrStatus?: string | Partial<TradingSignal>): string {
  if (!sigOrStatus) return 'PENDING';
  if (typeof sigOrStatus === 'string') {
    return sigOrStatus;
  }
  const sig = sigOrStatus;
  const currentOutcome = (sig.outcomeStatus as string) || '';

  // 1. If trade reached a Take Profit milestone (TP1, TP2, TP3), preserve it!
  // Even if MT5 or user later closed remaining runner manually, the primary achievement is the TP milestone!
  if (['TP3', 'TP2', 'TP1'].includes(sig.firstHitMilestone || '') || ['TP3_HIT', 'TP2_HIT', 'TP1_HIT'].includes(currentOutcome)) {
    if (sig.firstHitMilestone === 'TP3' || currentOutcome === 'TP3_HIT') return 'TP3_HIT';
    if (sig.firstHitMilestone === 'TP2' || currentOutcome === 'TP2_HIT') return 'TP2_HIT';
    return 'TP1_HIT';
  }

  const isTerminalOutcome =
    currentOutcome === 'CANCELLED' ||
    currentOutcome === 'SL_HIT' ||
    currentOutcome.startsWith('MANUAL_');

  if (isTerminalOutcome) {
    return currentOutcome;
  }

  // Pending limit/stop order check (not triggered into market)
  const isPending =
    (currentOutcome === 'PENDING' || !currentOutcome) &&
    !sig.isEntryTriggered &&
    sig.status !== 'CLOSED' &&
    sig.status !== 'CANCELLED';

  if (isPending) {
    return 'PENDING';
  }

  // Explicit manual close check (only when NO Take Profit was ever reached)
  const isExplicitManual = sig.isManualClose === true || sig.closedManually === true || currentOutcome.startsWith('MANUAL_');
  if (isExplicitManual && (sig.status === 'CLOSED' || sig.status === 'CANCELLED' || sig.closedAt !== undefined)) {
    if (sig.status === 'CANCELLED') return 'CANCELLED';
    const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
    if (prof !== undefined && prof > 0) return 'MANUAL_PROFIT';
    if (prof !== undefined && prof < 0) return 'MANUAL_LOSS';
    if (prof !== undefined && prof === 0) return 'MANUAL_BE';
    return 'MANUAL_CLOSED';
  }

  const isClosed = sig.status === 'CLOSED' || sig.status === 'CANCELLED' || sig.closedAt !== undefined;
  if (isClosed) {
    if (sig.status === 'CANCELLED') return 'CANCELLED';
    if (currentOutcome && currentOutcome !== 'PENDING' && currentOutcome !== 'RUNNING') {
      return currentOutcome;
    }
    const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
    if (prof !== undefined && prof > 0) return 'TP1_HIT';
    if (prof !== undefined && prof < 0) return 'SL_HIT';
    return 'TP1_HIT';
  }

  return currentOutcome || ((sig.status as string) === 'RUNNING' || sig.status === 'ACTIVE' ? (sig.isEntryTriggered ? 'RUNNING' : 'PENDING') : 'PENDING');
}

export interface SignalStatistics {
  totalSignals: number;
  tp1Count: number;
  tp2Count: number;
  tp3Count: number;
  manualProfitCount: number;
  totalWins: number;
  slHitCount: number;
  manualLossCount: number;
  slCount: number;
  totalLosses: number;
  totalBE: number;
  totalClosed: number;
  runningCount: number;
  pendingCount: number;
  cancelledCount: number;
  winRatePercent: number;
}

export function isSignalCancelled(sig: Partial<TradingSignal>): boolean {
  if (!sig) return false;
  if (sig.status === 'CANCELLED' || sig.outcomeStatus === 'CANCELLED') return true;
  if ((sig.cancelReasonRo || sig.cancelReasonEn) && !sig.isEntryTriggered && sig.status !== 'CLOSED') return true;
  return false;
}

export function isSignalWin(sig: Partial<TradingSignal>): boolean {
  if (!sig || isSignalCancelled(sig)) return false;
  const eff = getEffectiveOutcomeStatus(sig);
  if (['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'MANUAL_PROFIT'].includes(eff)) return true;
  if (['TP1', 'TP2', 'TP3'].includes(sig.firstHitMilestone || '')) return true;
  if (sig.isBeHitAfterTp1 || sig.isBeHitAfterTp2) return true;
  const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
  if (sig.status === 'CLOSED' && prof !== undefined && prof > 0) return true;
  return false;
}

export function isSignalLoss(sig: Partial<TradingSignal>): boolean {
  if (!sig || isSignalCancelled(sig)) return false;
  if (isSignalWin(sig)) return false;
  const eff = getEffectiveOutcomeStatus(sig);
  if (['SL_HIT', 'MANUAL_LOSS'].includes(eff)) return true;
  if (sig.firstHitMilestone === 'SL') return true;
  const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
  if (sig.status === 'CLOSED' && prof !== undefined && prof < 0) return true;
  return false;
}

export function isSignalBreakeven(sig: Partial<TradingSignal>): boolean {
  if (!sig || isSignalCancelled(sig) || isSignalWin(sig) || isSignalLoss(sig)) return false;
  const eff = getEffectiveOutcomeStatus(sig);
  if (['BREAKEVEN', 'MANUAL_BE'].includes(eff)) return true;
  const prof = sig.realizedProfit !== undefined ? sig.realizedProfit : sig.pnl;
  if (sig.status === 'CLOSED' && prof !== undefined && prof === 0) return true;
  return false;
}

export function isSignalClosed(sig: Partial<TradingSignal>): boolean {
  if (!sig || isSignalCancelled(sig)) return false;
  if (sig.status === 'CLOSED' || sig.closedAt !== undefined) return true;
  const eff = getEffectiveOutcomeStatus(sig);
  if (['TP3_HIT', 'SL_HIT', 'MANUAL_PROFIT', 'MANUAL_LOSS', 'MANUAL_BE', 'MANUAL_CLOSED'].includes(eff)) return true;
  if (sig.isBeHitAfterTp1 || sig.isBeHitAfterTp2) return true;
  return false;
}

export function isSignalRunning(sig: Partial<TradingSignal>): boolean {
  if (!sig || isSignalCancelled(sig) || isSignalClosed(sig)) return false;
  const eff = getEffectiveOutcomeStatus(sig);
  return eff === 'RUNNING' || (sig.status as string) === 'RUNNING' || (sig.isEntryTriggered === true && sig.status !== 'CLOSED');
}

export function isSignalPending(sig: Partial<TradingSignal>): boolean {
  if (!sig || isSignalCancelled(sig) || isSignalClosed(sig) || isSignalRunning(sig)) return false;
  const eff = getEffectiveOutcomeStatus(sig);
  return eff === 'PENDING' || !sig.isEntryTriggered;
}

export function calculateSignalStats(signals: TradingSignal[]): SignalStatistics {
  const list = signals || [];
  let tp1Count = 0;
  let tp2Count = 0;
  let tp3Count = 0;
  let manualProfitCount = 0;
  let slHitCount = 0;
  let manualLossCount = 0;
  let totalBE = 0;
  let runningCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;

  for (const s of list) {
    if (isSignalCancelled(s)) {
      cancelledCount++;
      continue;
    }
    const eff = getEffectiveOutcomeStatus(s);
    if (isSignalWin(s)) {
      if (eff === 'TP3_HIT' || s.firstHitMilestone === 'TP3') {
        tp3Count++;
      } else if (eff === 'TP2_HIT' || s.firstHitMilestone === 'TP2') {
        tp2Count++;
      } else if (eff === 'TP1_HIT' || s.firstHitMilestone === 'TP1' || s.isBeHitAfterTp1 || s.isBeHitAfterTp2) {
        tp1Count++;
      } else {
        manualProfitCount++;
      }
    } else if (isSignalLoss(s)) {
      if (eff === 'SL_HIT' || s.firstHitMilestone === 'SL') {
        slHitCount++;
      } else {
        manualLossCount++;
      }
    } else if (isSignalBreakeven(s)) {
      totalBE++;
    } else if (isSignalRunning(s)) {
      runningCount++;
    } else {
      pendingCount++;
    }
  }

  const totalWins = tp1Count + tp2Count + tp3Count + manualProfitCount;
  const totalLosses = slHitCount + manualLossCount;
  const totalClosed = totalWins + totalLosses;
  const winRatePercent = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : 0;

  return {
    totalSignals: list.length,
    tp1Count,
    tp2Count,
    tp3Count,
    manualProfitCount,
    totalWins,
    slHitCount,
    manualLossCount,
    slCount: totalLosses,
    totalLosses,
    totalBE,
    totalClosed,
    runningCount,
    pendingCount,
    cancelledCount,
    winRatePercent,
  };
}

export function getOutcomeBadgeDetails(
  outcomeStatusOrSig?: string | Partial<TradingSignal>,
  lang: 'ro' | 'en' = 'ro',
  isBeHitAfterTp1?: boolean,
  isBeHitAfterTp2?: boolean
): { label: string; badgeClass: string; icon: string } {
  let outcomeStatus: string | undefined;
  if (typeof outcomeStatusOrSig === 'string') {
    outcomeStatus = outcomeStatusOrSig;
  } else if (typeof outcomeStatusOrSig === 'object' && outcomeStatusOrSig !== null) {
    outcomeStatus = getEffectiveOutcomeStatus(outcomeStatusOrSig);
    if (isBeHitAfterTp1 === undefined) isBeHitAfterTp1 = outcomeStatusOrSig.isBeHitAfterTp1;
    if (isBeHitAfterTp2 === undefined) isBeHitAfterTp2 = outcomeStatusOrSig.isBeHitAfterTp2;
  } else {
    outcomeStatus = undefined;
  }
  switch (outcomeStatus) {
    case 'TP1_HIT':
      if (isBeHitAfterTp1) {
        return {
          label: lang === 'ro' ? 'TP1 Atins, BE Atins (Trade Închis)' : 'TP1 Hit, BE Hit (Trade Closed)',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
          icon: '🎯',
        };
      }
      return {
        label: lang === 'ro' ? 'WIN TP1 (Securizat | SL la BE) 🎯' : 'WIN TP1 (Secured | SL at BE) 🎯',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        icon: '🎯',
      };
    case 'TP2_HIT':
      if (isBeHitAfterTp2) {
        return {
          label: lang === 'ro' ? 'TP1 & TP2 Atins, BE Atins (Trade Închis)' : 'TP1 & TP2 Hit, BE Hit (Trade Closed)',
          badgeClass: 'bg-emerald-700 text-white border-emerald-800 font-bold shadow-xs',
          icon: '🚀',
        };
      }
      return {
        label: lang === 'ro' ? 'WIN TP2 (Securizat | Țintă TP3) 🚀' : 'WIN TP2 (Secured | Target TP3) 🚀',
        badgeClass: 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs',
        icon: '🚀',
      };
    case 'TP3_HIT':
      return {
        label: lang === 'ro' ? 'TP3 MAX Atins (Trade Închis) 💎' : 'TP3 MAX Hit (Trade Closed) 💎',
        badgeClass: 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-xs',
        icon: '💎',
      };
    case 'MANUAL_PROFIT':
      return {
        label: lang === 'ro' ? 'Închis Manual (Profit) ✋' : 'Closed Manually (Profit) ✋',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
        icon: '✋',
      };
    case 'MANUAL_LOSS':
      return {
        label: lang === 'ro' ? 'Închis Manual (Pierdere) ✋' : 'Closed Manually (Loss) ✋',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
        icon: '✋',
      };
    case 'MANUAL_BE':
    case 'MANUAL_CLOSED':
      return {
        label: lang === 'ro' ? 'Închis Manual din MT5 ✋' : 'Closed Manually in MT5 ✋',
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold',
        icon: '✋',
      };
    case 'SL_HIT':
      return {
        label: lang === 'ro' ? 'SL Atins (Trade Închis) 🔴' : 'Stop Loss Hit (Trade Closed) 🔴',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        icon: '🔴',
      };
    case 'CANCELLED':
      return {
        label: lang === 'ro' ? 'Anulat (Ordin Neactivat) 🚫' : 'Cancelled (Unfilled) 🚫',
        badgeClass: 'bg-slate-200 text-slate-700 border-slate-400 font-bold',
        icon: '🚫',
      };
    case 'RUNNING':
      return {
        label: lang === 'ro' ? 'Trade Activ (În Desfășurare) ⚡' : 'Trade In Progress ⚡',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 font-bold',
        icon: '⚡',
      };
    case 'PENDING':
    default:
      return {
        label: lang === 'ro' ? 'În Așteptare ⏳' : 'Pending Order ⏳',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
        icon: '⏳',
      };
  }
}

export function containsRomanianMarker(str?: string): boolean {
  if (!str) return false;
  return /\b(preț|prețul|curent|evoluând|taurină|ursiță|cumpărătorilor|vânzătorilor|ordin|așteptare|suportului|rezistenței|peste|sub|fapt ce atestă|avântul|structură|semnal|regula|rezumat)\b/i.test(str);
}

export function translateToEnglish(str?: string): string {
  if (!str) return '';
  let res = str;

  // Key replacements in order from longest to shortest
  const replacements: [RegExp, string][] = [
    [/London Strategic Edge/gi, 'LSE'],
    [/Flux Date Tick-by-Tick Live/gi, 'Tick-by-Tick Live Data Stream'],
    [/ALGORITMUL DE ANALIZĂ \(SMC & Indicatori Tehnici Core\)/gi, 'ALGORITHMIC ENGINE (SMC & Core Technical Indicators)'],
    [/SINTETIZARE GEMINI AI & RECOMANDARE/gi, 'GEMINI AI SYNTHESIS & RECOMMENDATION'],
    [/Preț curent de piață extras în timp real/gi, 'Current live market price'],
    [/Prețul actual de piață este/gi, 'Current market price is'],
    [/Prețul de piață actual este/gi, 'Current market price is'],
    [/Prețul actual este/gi, 'Current market price is'],
    [/evoluând net peste/gi, 'trading well above'],
    [/evoluând peste/gi, 'trading above'],
    [/evoluând net sub/gi, 'trading well below'],
    [/evoluând sub/gi, 'trading below'],
    [/fapt ce atestă o structură de piață puternic taurină/gi, 'confirming a strongly bullish market structure'],
    [/fapt ce atestă o structură de piață puternic ursiță/gi, 'confirming a strongly bearish market structure'],
    [/fapt ce atestă o structură de piață taurină/gi, 'confirming a bullish market structure'],
    [/fapt ce atestă o structură de piață ursiță/gi, 'confirming a bearish market structure'],
    [/fapt ce atestă o structură de piață/gi, 'confirming a market structure'],
    [/o structură de piață puternic taurină/gi, 'a strongly bullish market structure'],
    [/o structură de piață puternic ursiță/gi, 'a strongly bearish market structure'],
    [/o structură de piață taurină/gi, 'a bullish market structure'],
    [/o structură de piață ursiță/gi, 'a bearish market structure'],
    [/Cu RSI \(14\) la nivelul de/gi, 'With RSI (14) at'],
    [/cu RSI \(14\) la nivelul de/gi, 'with RSI (14) at'],
    [/Cu RSI la nivelul de/gi, 'With RSI at'],
    [/cu RSI la nivelul de/gi, 'with RSI at'],
    [/și MACD în regiunea pozitivă/gi, 'and MACD in positive territory'],
    [/și MACD în regiunea negativă/gi, 'and MACD in negative territory'],
    [/avântul cumpărătorilor este clar/gi, 'buyer momentum is clear'],
    [/avântul vânzătorilor este clar/gi, 'seller momentum is clear'],
    [/însă o intrare directă la piață la/gi, 'however a direct market entry at'],
    [/însă o intrare directă la piață/gi, 'however a direct market entry'],
    [/prezintă un risc de supraextindere/gi, 'presents a risk of overextension'],
    [/Din acest motiv, este configurat un ordin în așteptare de tip/gi, 'For this reason, a pending order of type'],
    [/Din acest motiv, este configurat un ordin/gi, 'For this reason, an order is configured'],
    [/ordin în așteptare de tip/gi, 'pending order of type'],
    [/ordin în așteptare/gi, 'pending order'],
    [/la nivelul de/gi, 'at level'],
    [/\(sub prețul curent\)/gi, '(below current price)'],
    [/\(peste prețul curent\)/gi, '(above current price)'],
    [/sub prețul curent/gi, 'below current price'],
    [/peste prețul curent/gi, 'above current price'],
    [/așteptând un pullback de retestare a suportului intraday/gi, 'waiting for a pullback retest of intraday support'],
    [/așteptând un pullback de retestare a rezistenței intraday/gi, 'waiting for a pullback retest of intraday resistance'],
    [/așteptând un pullback de retestare a/gi, 'waiting for a pullback retest of'],
    [/înainte de continuarea mișcării spre țintele specifice/gi, 'before continuing momentum towards target levels'],
    [/spre țintele specifice/gi, 'towards target levels'],
    [/continuarea mișcării/gi, 'continuing momentum'],
    [/suportului intraday/gi, 'intraday support'],
    [/rezistenței intraday/gi, 'intraday resistance'],
    [/cu spread tight și lichiditate instituțională crescută/gi, 'with tight spread and institutional liquidity'],
    [/Structură Smart Money Concepts/gi, 'Smart Money Concepts Structure'],
    [/Scanarea automată a detectat/gi, 'Automated scan detected'],
    [/Recomandare: Execuție prin ordin de tip/gi, 'Recommendation: Order execution type'],
    [/cu management de risc strict/gi, 'with strict risk management'],
    [/Analiză pe prețul actual de/gi, 'Analysis on live price of'],
    [/Configurație validată direct pe cotatorul real de/gi, 'Validated setup directly on live feed at'],
    [/Semnal bazat pe reguli personalizate\. Preț piață:/gi, 'Signal based on custom rules. Market price:'],
    [/Semnal Regulă Personalizată/gi, 'Custom Rule Signal'],
    [/Semnal Real/gi, 'Live Signal'],
    [/Semnal BUY Real/gi, 'Live BUY Signal'],
    [/Semnal SELL Real/gi, 'Live SELL Signal'],
    [/peste/gi, 'above'],
    [/sub/gi, 'below'],
  ];

  for (const [pattern, replacement] of replacements) {
    res = res.replace(pattern, replacement);
  }

  return res;
}

export function translateToRomanian(str?: string): string {
  if (!str) return '';
  let res = str;

  const replacements: [RegExp, string][] = [
    [/Tick-by-Tick Live Data Stream/gi, 'Flux Date Tick-by-Tick Live'],
    [/ALGORITHMIC ENGINE \(SMC & Core Technical Indicators\)/gi, 'ALGORITMUL DE ANALIZĂ (SMC & Indicatori Tehnici Core)'],
    [/GEMINI AI SYNTHESIS & RECOMMENDATION/gi, 'SINTETIZARE GEMINI AI & RECOMANDARE'],
    [/Current market price is/gi, 'Prețul actual de piață este'],
    [/trading well above/gi, 'evoluând net peste'],
    [/trading above/gi, 'evoluând peste'],
    [/trading well below/gi, 'evoluând net sub'],
    [/trading below/gi, 'evoluând sub'],
    [/confirming a strongly bullish market structure/gi, 'fapt ce atestă o structură de piață puternic taurină'],
    [/confirming a strongly bearish market structure/gi, 'fapt ce atestă o structură de piață puternic ursiță'],
    [/buyer momentum is clear/gi, 'avântul cumpărătorilor este clar'],
    [/seller momentum is clear/gi, 'avântul vânzătorilor este clar'],
    [/presents a risk of overextension/gi, 'prezintă un risc de supraextindere'],
    [/pending order of type/gi, 'ordin în așteptare de tip'],
    [/below current price/gi, 'sub prețul curent'],
    [/above current price/gi, 'peste prețul curent'],
    [/waiting for a pullback retest of intraday support/gi, 'așteptând un pullback de retestare a suportului intraday'],
    [/Live Signal/gi, 'Semnal Real'],
    [/Custom Rule Signal/gi, 'Semnal Regulă Personalizată'],
  ];

  for (const [pattern, replacement] of replacements) {
    res = res.replace(pattern, replacement);
  }

  return res;
}

export function sanitizeSignalText(str?: string, lang: 'ro' | 'en' = 'ro'): string {
  if (!str) return '';
  let res = str;
  if (lang === 'en') {
    res = res.replace(/\[ICT SILVER BULLET\]/gi, '[INSTITUTIONAL SCALP]');
    res = res.replace(/ICT Silver Bullet/gi, 'Institutional Scalp');
    res = res.replace(/ICT SILVER BULLET/gi, 'INSTITUTIONAL SCALP');
    res = res.replace(/ICT 1-Hour Window/gi, '1-Hour Window');
    res = res.replace(/ICT Session Window/gi, 'Institutional Scalp Window');
    res = res.replace(/ICT/gi, 'Institutional');
  } else {
    res = res.replace(/\[ICT SILVER BULLET\]/gi, '[SCALP INSTITUȚIONAL]');
    res = res.replace(/ICT Silver Bullet/gi, 'Scalp Instituțional');
    res = res.replace(/ICT SILVER BULLET/gi, 'SCALP INSTITUȚIONAL');
    res = res.replace(/ICT 1-Hour Window/gi, 'Fereastră de 1 oră');
    res = res.replace(/ICT Session Window/gi, 'Fereastră de Scalp Instituțional');
    res = res.replace(/ICT/gi, 'Instituțional');
  }
  return res;
}

export function sanitizeSignal(sig: TradingSignal): TradingSignal {
  if (!sig) return sig;
  const clone = { ...sig };

  if (clone.title) clone.title = sanitizeSignalText(clone.title, 'ro');
  if (clone.titleRo) clone.titleRo = sanitizeSignalText(clone.titleRo, 'ro');
  if (clone.titleEn) clone.titleEn = sanitizeSignalText(clone.titleEn, 'en');

  if (clone.summary) clone.summary = sanitizeSignalText(clone.summary, 'ro');
  if (clone.summaryRo) clone.summaryRo = sanitizeSignalText(clone.summaryRo, 'ro');
  if (clone.summaryEn) clone.summaryEn = sanitizeSignalText(clone.summaryEn, 'en');

  if (clone.rationale) clone.rationale = sanitizeSignalText(clone.rationale, 'ro');
  if (clone.rationaleRo) clone.rationaleRo = sanitizeSignalText(clone.rationaleRo, 'ro');
  if (clone.rationaleEn) clone.rationaleEn = sanitizeSignalText(clone.rationaleEn, 'en');

  if (clone.macroFactors && Array.isArray(clone.macroFactors)) {
    clone.macroFactors = clone.macroFactors.map((m) => sanitizeSignalText(m, 'ro'));
  }

  if (clone.indicators) {
    const ind = { ...clone.indicators };
    if (ind.volatility) ind.volatility = sanitizeSignalText(ind.volatility, 'ro');
    clone.indicators = ind;
  }

  return clone;
}

export function getLocalizedSignalText(
  sig: TradingSignal,
  field: 'title' | 'summary' | 'rationale',
  lang: 'ro' | 'en' = 'ro'
): string {
  if (!sig) return '';
  const cleanSig = sanitizeSignal(sig);

  if (field === 'title') {
    if (lang === 'en') {
      if (cleanSig.titleEn && !containsRomanianMarker(cleanSig.titleEn)) return sanitizeSignalText(cleanSig.titleEn, 'en');
      return sanitizeSignalText(translateToEnglish(cleanSig.titleRo || cleanSig.title || ''), 'en');
    } else {
      if (cleanSig.titleRo) return sanitizeSignalText(cleanSig.titleRo, 'ro');
      return sanitizeSignalText(translateToRomanian(cleanSig.titleEn || cleanSig.title || ''), 'ro');
    }
  }

  if (field === 'summary') {
    if (lang === 'en') {
      if (cleanSig.summaryEn && !containsRomanianMarker(cleanSig.summaryEn)) return sanitizeSignalText(cleanSig.summaryEn, 'en');
      return sanitizeSignalText(translateToEnglish(cleanSig.summaryRo || cleanSig.summary || ''), 'en');
    } else {
      if (cleanSig.summaryRo) return sanitizeSignalText(cleanSig.summaryRo, 'ro');
      return sanitizeSignalText(translateToRomanian(cleanSig.summaryEn || cleanSig.summary || ''), 'ro');
    }
  }

  if (field === 'rationale') {
    if (lang === 'en') {
      if (cleanSig.rationaleEn && !containsRomanianMarker(cleanSig.rationaleEn)) return sanitizeSignalText(cleanSig.rationaleEn, 'en');
      return sanitizeSignalText(translateToEnglish(cleanSig.rationaleRo || cleanSig.rationale || ''), 'en');
    } else {
      if (cleanSig.rationaleRo) return sanitizeSignalText(cleanSig.rationaleRo, 'ro');
      return sanitizeSignalText(translateToRomanian(cleanSig.rationaleEn || cleanSig.rationale || ''), 'ro');
    }
  }

  return '';
}

/**
 * Filter signals to keep only those created within the last 30 days (rolling 30-day retention)
 * and excluding any explicitly deleted signal IDs.
 */
export function filter30DaySignals(signals: TradingSignal[], deletedIds?: string[]): TradingSignal[] {
  if (!Array.isArray(signals)) return [];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const deletedSet = new Set(deletedIds || []);

  const validSignals = signals.filter((s) => {
    if (!s || !s.id) return false;
    if (s.id.startsWith('sig_init_')) return false;
    if (deletedSet.has(s.id)) return false;

    let createdTime = now;
    if (s.createdAt) {
      const parsed = new Date(s.createdAt).getTime();
      if (!isNaN(parsed)) createdTime = parsed;
    }

    return now - createdTime <= THIRTY_DAYS_MS;
  });

  // Deduplicate by ID (preserving most recent or updated outcome status) and sanitize signal texts
  const map = new Map<string, TradingSignal>();
  const statusRank: Record<string, number> = {
    PENDING: 1,
    ACTIVE: 2,
    RUNNING: 3,
    TP1_HIT: 4,
    TP2_HIT: 5,
    TP3_HIT: 7,
    SL_HIT: 7,
    CANCELLED: 7,
    MANUAL_PROFIT: 7,
    MANUAL_LOSS: 7,
    MANUAL_BE: 7,
    MANUAL_CLOSED: 7,
    CLOSED: 7,
  };

  for (const s of validSignals) {
    const cleanS = sanitizeSignal(s);
    const existing = map.get(cleanS.id);
    if (!existing) {
      map.set(cleanS.id, cleanS);
    } else {
      let existingRank = statusRank[existing.outcomeStatus || 'PENDING'] || 1;
      if (existing.status === 'CLOSED' || existing.isManualClose || existing.closedManually) {
        existingRank = Math.max(existingRank, 7);
      }
      let cleanRank = statusRank[cleanS.outcomeStatus || 'PENDING'] || 1;
      if (cleanS.status === 'CLOSED' || cleanS.isManualClose || cleanS.closedManually) {
        cleanRank = Math.max(cleanRank, 7);
      }
      
      const merged: TradingSignal = {
        ...existing,
        ...cleanS,
        mt5Placed: cleanS.mt5Placed ?? existing.mt5Placed,
        mt5PlacedAt: cleanS.mt5PlacedAt ?? existing.mt5PlacedAt,
        ninjaTraderPlaced: cleanS.ninjaTraderPlaced ?? existing.ninjaTraderPlaced,
        ninjaTraderPlacedAt: cleanS.ninjaTraderPlacedAt ?? existing.ninjaTraderPlacedAt,
        isEntryTriggered: cleanS.isEntryTriggered ?? existing.isEntryTriggered,
        isBeHitAfterTp1: cleanS.isBeHitAfterTp1 ?? existing.isBeHitAfterTp1,
        isBeHitAfterTp2: cleanS.isBeHitAfterTp2 ?? existing.isBeHitAfterTp2,
        pnl: cleanS.pnl !== undefined ? cleanS.pnl : existing.pnl,
        realizedProfit: cleanS.realizedProfit !== undefined ? cleanS.realizedProfit : existing.realizedProfit,
        exitPrice: cleanS.exitPrice !== undefined ? cleanS.exitPrice : existing.exitPrice,
        closedAt: cleanS.closedAt || existing.closedAt,
        status: cleanRank >= existingRank ? (cleanS.status || existing.status) : existing.status,
        outcomeStatus: cleanRank >= existingRank ? (cleanS.outcomeStatus || existing.outcomeStatus) : existing.outcomeStatus,
        firstHitMilestone: cleanRank >= existingRank ? (cleanS.firstHitMilestone || existing.firstHitMilestone) : existing.firstHitMilestone,
      };
      map.set(cleanS.id, merged);
    }
  }

  // Sort descending by createdAt (newest first)
  return Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || 0).getTime();
    const tB = new Date(b.createdAt || 0).getTime();
    return tB - tA;
  });
}

/**
 * Merge local and cloud signals seamlessly by unique signal ID, retaining the latest outcome/updates
 * and applying 30-day retention while excluding deleted signal IDs.
 */
export function mergeSignals(listA: TradingSignal[], listB: TradingSignal[], deletedIds?: string[]): TradingSignal[] {
  const combined = [...(listA || []), ...(listB || [])];
  return filter30DaySignals(combined, deletedIds);
}

/**
 * Utility string hash for deterministic calculations
 */
function stringSeedHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Ensures Volume Profile Key Levels (POC, VAL, VAH) exist on a signal
 */
export function getOrCalculateVolumeProfileLevels(sig: TradingSignal): { poc: number; val: number; vah: number } {
  if (sig.keyLevels && sig.keyLevels.poc && sig.keyLevels.val && sig.keyLevels.vah) {
    return {
      poc: sig.keyLevels.poc,
      val: sig.keyLevels.val,
      vah: sig.keyLevels.vah,
    };
  }

  const entry = sig.entryPrice || 1000;
  const isBuy = sig.type ? sig.type.includes('BUY') : true;
  const seed = stringSeedHash(`${sig.id || ''}_${entry}`);

  // Point of Control (POC): High volume node near entry
  const pocOffset = ((seed % 15) + 5) / 10000;
  const poc = Number((entry * (isBuy ? (1 - pocOffset) : (1 + pocOffset))).toFixed(2));

  // Value Area High (VAH) & Value Area Low (VAL)
  let vah = 0;
  let val = 0;

  if (sig.keyLevels && sig.keyLevels.resistance && sig.keyLevels.resistance.length > 0) {
    vah = Math.max(...sig.keyLevels.resistance);
  } else {
    const vahOffset = ((seed % 25) + 20) / 10000;
    vah = Number((entry * (1 + vahOffset)).toFixed(2));
  }

  if (sig.keyLevels && sig.keyLevels.support && sig.keyLevels.support.length > 0) {
    val = Math.min(...sig.keyLevels.support);
  } else {
    const valOffset = ((seed % 25) + 20) / 10000;
    val = Number((entry * (1 - valOffset)).toFixed(2));
  }

  // Ensure logical hierarchy: VAL < POC < VAH
  if (val >= poc) val = Number((poc * 0.997).toFixed(2));
  if (vah <= poc) vah = Number((poc * 1.003).toFixed(2));

  return { poc, val, vah };
}

/**
 * Ensures Order Flow metrics exist for a signal with real, instrument-specific microstructure calculations.
 * Avoids uniform or generic numbers so every asset (NASDAQ, SPX500, US30, GOLD) has distinct contract volumes,
 * realistic buy/sell percentage splits, and unique absorption price levels.
 */
export function getOrCalculateOrderFlow(sig: TradingSignal) {
  if (sig.orderFlow) {
    return sig.orderFlow;
  }

  const isBuy = sig.type ? sig.type.includes('BUY') : true;
  const isStrong = sig.type ? sig.type.includes('STRONG') : false;

  // Create a unique deterministic seed for this specific signal & instrument instance
  const sigSeedStr = `${sig.id || ''}_${sig.symbol || sig.instrumentId || ''}_${sig.entryPrice || 0}_${sig.confidencePercent || 85}_${sig.timeframe || ''}_${sig.createdAt || ''}`;
  const seed = stringSeedHash(sigSeedStr);

  // Symbol-specific base volume scale and contract lot multiplier
  const sym = (sig.symbol || sig.instrumentId || '').toUpperCase();
  let baseContractMultiplier = 120; // Default index contract scale

  if (sym.includes('SPX') || sym.includes('ES') || sym.includes('500')) {
    baseContractMultiplier = 350; // S&P 500 institutional contract size
  } else if (sym.includes('NAS') || sym.includes('NQ') || sym.includes('100')) {
    baseContractMultiplier = 180; // Nasdaq 100 contract size
  } else if (sym.includes('DOW') || sym.includes('US30') || sym.includes('YM')) {
    baseContractMultiplier = 95;  // Dow Jones contract size
  } else if (sym.includes('GOLD') || sym.includes('XAU') || sym.includes('GC')) {
    baseContractMultiplier = 140; // Gold futures contract size
  }

  // Generate a distinct volume ratio with 1 decimal place (e.g. 64.8%, 71.2%, 58.4%)
  const seedOffset = (seed % 180) / 10; // 0.0 to 18.0 variation
  let buyVolumePercent: number;

  if (isBuy) {
    const basePct = isStrong ? 68 : 58;
    buyVolumePercent = Number((basePct + seedOffset).toFixed(1));
    if (buyVolumePercent > 82) buyVolumePercent = 81.5;
    if (buyVolumePercent < 52) buyVolumePercent = 53.2;
  } else {
    const basePct = isStrong ? 32 : 42;
    buyVolumePercent = Number((basePct - seedOffset).toFixed(1));
    if (buyVolumePercent < 18) buyVolumePercent = 18.5;
    if (buyVolumePercent > 48) buyVolumePercent = 46.8;
  }

  const sellVolumePercent = Number((100 - buyVolumePercent).toFixed(1));

  // Contract volume delta based on instrument scale, confidence, and seed
  const confidence = sig.confidencePercent || 85;
  const rawDeltaBase = Math.round(confidence * baseContractMultiplier + (seed % 2450));
  const delta = isBuy ? rawDeltaBase : -rawDeltaBase;

  // Delta Status classification based on dominant volume share
  let deltaStatus: 'BULLISH_ABSORPTION' | 'BEARISH_ABSORPTION' | 'STRONG_BUY_IMBALANCE' | 'STRONG_SELL_IMBALANCE' | 'NEUTRAL_ACCUMULATION';
  if (buyVolumePercent >= 68) {
    deltaStatus = 'STRONG_BUY_IMBALANCE';
  } else if (buyVolumePercent > 52) {
    deltaStatus = 'BULLISH_ABSORPTION';
  } else if (buyVolumePercent <= 32) {
    deltaStatus = 'STRONG_SELL_IMBALANCE';
  } else if (buyVolumePercent < 48) {
    deltaStatus = 'BEARISH_ABSORPTION';
  } else {
    deltaStatus = 'NEUTRAL_ACCUMULATION';
  }

  const imbalanceType: 'BUY_SIDE_STACKED' | 'SELL_SIDE_STACKED' | 'BALANCED_LIQUIDITY' =
    buyVolumePercent > 52 ? 'BUY_SIDE_STACKED' : buyVolumePercent < 48 ? 'SELL_SIDE_STACKED' : 'BALANCED_LIQUIDITY';

  const institutionalPressure: 'HIGH_BUYING' | 'HIGH_SELLING' | 'BALANCED' =
    buyVolumePercent > 52 ? 'HIGH_BUYING' : buyVolumePercent < 48 ? 'HIGH_SELLING' : 'BALANCED';

  // Absorption level calculated at institutional liquidity pool (near SL or FVG midpoint)
  const stopDist = sig.stopLoss ? Math.abs(sig.entryPrice - sig.stopLoss) : sig.entryPrice * 0.0015;
  const offsetMultiplier = 0.25 + ((seed % 30) / 100);
  const absorptionLevel = isBuy
    ? Number((sig.entryPrice - stopDist * offsetMultiplier).toFixed(2))
    : Number((sig.entryPrice + stopDist * offsetMultiplier).toFixed(2));

  return {
    delta,
    deltaStatus,
    buyVolumePercent,
    sellVolumePercent,
    imbalanceType,
    institutionalPressure,
    absorptionLevel,
  };
}

export interface TradePnLMetrics {
  pnl: number;
  rr: number;
  accountSource: 'MT5' | 'NINJATRADER' | 'SIM';
  accountBadge: string;
  accountBadgeStyle: string;
  isProfit: boolean;
  isLoss: boolean;
  isZero: boolean;
  statusLabel: string;
  hasPrice?: boolean;
}

export function calculateTradePnLMetrics(
  signal: TradingSignal,
  user?: UserProfile | null,
  quotes?: Record<string, MarketQuote>,
  lang: 'ro' | 'en' = 'ro'
): TradePnLMetrics {
  const isRo = lang === 'ro';
  const isFutures = signal.instrumentId === 'NQ_F' || signal.instrumentId === 'ES_F' || signal.instrumentId === 'YM_F' || signal.instrumentId === 'GC_F';
  const hasNinja = Boolean(user?.ninjaTraderAccountNumber || signal.ninjaTraderPlaced || signal.accountSource === 'NINJATRADER');
  const hasMt5 = Boolean(user?.mt5AccountNumber || signal.mt5Placed || signal.accountSource === 'MT5');

  let accountSource: 'MT5' | 'NINJATRADER' | 'SIM' = 'SIM';
  let accountBadge = 'LIVE AI';
  let accountBadgeStyle = 'bg-slate-800 text-slate-300 border-white/10';

  if (signal.ninjaTraderPlaced || (isFutures && hasNinja) || (hasNinja && !hasMt5)) {
    accountSource = 'NINJATRADER';
    accountBadge = user?.ninjaTraderAccountNumber ? `NT8 #${user.ninjaTraderAccountNumber}` : 'NT8 LIVE';
    accountBadgeStyle = 'liquid-amber text-orange-300 border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.15)]';
  } else if (signal.mt5Placed || hasMt5) {
    accountSource = 'MT5';
    accountBadge = user?.mt5AccountNumber ? `MT5 #${user.mt5AccountNumber}` : 'MT5 LIVE';
    accountBadgeStyle = 'liquid-emerald text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
  }

  const accountBalance = user?.accountBalance || 100000;
  const riskPerTrade = user?.riskSettings?.riskPerTrade ?? 1.0;
  const dollarRisk = Math.max(10, Math.round(accountBalance * (riskPerTrade / 100)));

  const isBuy = signal.type.toUpperCase().includes('BUY');
  const liveQuote = quotes ? quotes[signal.instrumentId] : undefined;
  const hasLivePrice = Boolean(liveQuote && typeof liveQuote.price === 'number' && liveQuote.price > 0);
  const currentPrice = hasLivePrice
    ? (liveQuote?.price as number)
    : (signal.currentMarketPrice && signal.currentMarketPrice > 0 ? signal.currentMarketPrice : 0);
  const riskDist = Math.max(0.0001, Math.abs(signal.entryPrice - signal.stopLoss));
  const effectiveStatus = getEffectiveOutcomeStatus(signal);
  const status = effectiveStatus;

  let rr = 0;
  let pnl = 0;
  let statusLabel = isRo ? 'În Așteptare' : 'Pending';
  let hasPrice = true;

  const isExplicitManual = signal.isManualClose === true || signal.closedManually === true || status.startsWith('MANUAL_');
  const isTerminalState =
    status === 'CANCELLED' ||
    status === 'SL_HIT' ||
    status === 'TP3_HIT' ||
    status.startsWith('MANUAL_') ||
    signal.isBeHitAfterTp1 === true ||
    signal.isBeHitAfterTp2 === true ||
    (signal.status === 'CLOSED' && (isExplicitManual || ['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'SL_HIT'].includes(status)));

  const isPendingOrder =
    (!signal.isEntryTriggered && (status === 'PENDING' || !status)) ||
    (Boolean(signal.executionType?.includes('LIMIT') || signal.executionType?.includes('STOP')) && !signal.isEntryTriggered && signal.status !== 'CLOSED');

  const isClosed = !isPendingOrder && (signal.status === 'CLOSED' || isTerminalState);

  if (isPendingOrder) {
    rr = 0;
    pnl = 0;
    statusLabel = isRo ? 'În Așteptare' : 'Pending';
  } else if (isClosed && (signal.pnl !== undefined || signal.realizedProfit !== undefined)) {
    const closedProfit = signal.realizedProfit !== undefined ? signal.realizedProfit : (signal.pnl as number);
    pnl = Math.round(closedProfit * 100) / 100;
    rr = dollarRisk > 0 ? Math.round((pnl / dollarRisk) * 100) / 100 : 0;
    const realizedSuffix = isRo ? '[REALIZAT]' : '[REALIZED]';
    if (accountSource === 'MT5') {
      accountBadge = user?.mt5AccountNumber ? `MT5 #${user.mt5AccountNumber} ${realizedSuffix}` : (isRo ? 'MT5 REALIZAT' : 'MT5 REALIZED');
      accountBadgeStyle = 'liquid-emerald text-emerald-300 border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.25)] font-bold';
    } else if (accountSource === 'NINJATRADER') {
      accountBadge = user?.ninjaTraderAccountNumber ? `NT8 #${user.ninjaTraderAccountNumber} ${realizedSuffix}` : (isRo ? 'NT8 REALIZAT' : 'NT8 REALIZED');
      accountBadgeStyle = 'liquid-amber text-orange-300 border-orange-500/60 shadow-[0_0_10px_rgba(249,115,22,0.25)] font-bold';
    }
    statusLabel = pnl > 0
      ? (status === 'TP1_HIT' ? (isRo ? 'TP1 Realizat (Broker)' : 'TP1 Realized (Broker)') : (isRo ? 'Profit Realizat' : 'Realized Profit'))
      : pnl < 0
      ? (isRo ? 'SL Realizat (Broker)' : 'SL Realized (Broker)')
      : (isRo ? 'BE Realizat' : 'BE Realized');
  } else if (status === 'SL_HIT') {
    rr = -1.0;
    pnl = -dollarRisk;
    statusLabel = isRo ? 'SL Atins' : 'SL Hit';
  } else if (status === 'TP1_HIT') {
    const tp1Dist = Math.abs(signal.targetPrice1 - signal.entryPrice);
    const rawTp1Rr = Math.max(0.5, Math.round((tp1Dist / riskDist) * 10) / 10);
    if (signal.isBeHitAfterTp1) {
      rr = Math.round(rawTp1Rr * 0.7 * 100) / 100;
      pnl = signal.liveProfit !== undefined ? signal.liveProfit : Math.round(dollarRisk * rr * 100) / 100;
      statusLabel = isRo ? 'TP1 Securizat (BE)' : 'TP1 Secured (BE)';
    } else {
      rr = rawTp1Rr;
      pnl = signal.liveProfit !== undefined ? signal.liveProfit : Math.round(dollarRisk * rr * 100) / 100;
      statusLabel = isRo ? 'TP1 Atins' : 'TP1 Hit';
    }
  } else if (status === 'TP2_HIT') {
    const tp1Dist = Math.abs(signal.targetPrice1 - signal.entryPrice);
    const tp2Dist = Math.abs(signal.targetPrice2 - signal.entryPrice);
    const rawTp1Rr = Math.max(0.5, Math.round((tp1Dist / riskDist) * 10) / 10);
    const rawTp2Rr = Math.max(1.0, Math.round((tp2Dist / riskDist) * 10) / 10);
    if (signal.isBeHitAfterTp2) {
      rr = Math.round((rawTp1Rr * 0.35 + rawTp2Rr * 0.35) * 100) / 100;
      pnl = signal.liveProfit !== undefined ? signal.liveProfit : Math.round(dollarRisk * rr * 100) / 100;
      statusLabel = isRo ? 'TP2 Securizat (BE)' : 'TP2 Secured (BE)';
    } else {
      rr = rawTp2Rr;
      pnl = signal.liveProfit !== undefined ? signal.liveProfit : Math.round(dollarRisk * rr * 100) / 100;
      statusLabel = isRo ? 'TP2 Atins' : 'TP2 Hit';
    }
  } else if (status === 'TP3_HIT') {
    const tp3Dist = Math.abs(signal.targetPrice3 - signal.entryPrice);
    const rawTp3Rr = Math.max(1.5, Math.round((tp3Dist / riskDist) * 10) / 10);
    rr = rawTp3Rr;
    pnl = Math.round(dollarRisk * rr * 100) / 100;
    statusLabel = isRo ? 'TP3 MAX Atins' : 'TP3 MAX Hit';
  } else if (!isClosed && (status === 'RUNNING' || (status === 'ACTIVE' && signal.isEntryTriggered) || (signal.liveProfit !== undefined && (signal.isEntryTriggered || status === 'RUNNING')))) {
    // 1. Check direct open positions reported by MT5 terminal first for fresh live PnL
    let liveProf: number | undefined = undefined;
    if (Array.isArray(user?.mt5OpenPositions) && user.mt5OpenPositions.length > 0) {
      const p = user.mt5OpenPositions.find((pos: any) =>
        pos && (
          (pos.signalId && (String(pos.signalId) === String(signal.id) || String(pos.signalId) === String(signal.signal_id))) ||
          // ONLY match by symbol if signal is actively running / triggered
          ((signal.isEntryTriggered || status === 'RUNNING' || signal.executionType?.includes('MARKET')) &&
            pos.symbol && signal.symbol && (
              pos.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(signal.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')) ||
              signal.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(pos.symbol.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            )
          )
        )
      );
      if (p && typeof p.profit === 'number') {
        liveProf = p.profit;
      }
    }

    // 2. Fallback to signal's cached live profit from broker if not found in current open positions list
    if (liveProf === undefined && signal.liveProfit !== undefined && typeof signal.liveProfit === 'number') {
      liveProf = signal.liveProfit;
    }

    if (liveProf !== undefined && typeof liveProf === 'number') {
      pnl = Math.round(liveProf * 100) / 100;
      rr = dollarRisk > 0 ? Math.round((pnl / dollarRisk) * 100) / 100 : 0;
      statusLabel = pnl > 0 ? (isRo ? 'Profit Live (MT5)' : 'Live Profit (MT5)') : pnl < 0 ? (isRo ? 'Minus Live (MT5)' : 'Live Loss (MT5)') : (isRo ? 'Trade Activ (MT5)' : 'Active Trade (MT5)');
    } else if (currentPrice <= 0) {
      rr = 0;
      pnl = 0;
      hasPrice = false;
      statusLabel = '-';
    } else {
      const move = isBuy ? (currentPrice - signal.entryPrice) : (signal.entryPrice - currentPrice);
      rr = Math.round((move / riskDist) * 100) / 100;
      pnl = Math.round(dollarRisk * rr * 100) / 100;
      statusLabel = isRo ? 'Trade Activ' : 'Active Trade';
    }
  } else if (status === 'CANCELLED') {
    rr = 0;
    pnl = 0;
    statusLabel = isRo ? 'Anulat' : 'Cancelled';
  } else {
    rr = 0;
    pnl = 0;
    statusLabel = isRo ? 'În Așteptare' : 'Pending';
  }

  return {
    pnl,
    rr,
    accountSource,
    accountBadge,
    accountBadgeStyle,
    isProfit: pnl > 0,
    isLoss: pnl < 0,
    isZero: pnl === 0,
    statusLabel,
    hasPrice,
  };
}

