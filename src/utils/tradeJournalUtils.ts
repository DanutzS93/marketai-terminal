import { TradingSignal, TradeJournalEntry, InstrumentId, MarketQuote } from '../types';

export function getLocalDateKey(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeFromDate(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '12:00';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function calculateSignalAchievedRR(
  signal: TradingSignal,
  currentPrice?: number,
  user?: any,
  lang: 'ro' | 'en' = 'ro'
): { rr: number; status: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'RUNNING'; label: string } {
  const isRo = lang === 'ro';
  const typeStr = (signal.type || (signal as any).direction || signal.executionType || '').toUpperCase();
  const isBuy = typeStr.includes('BUY');
  const riskDist = Math.max(0.0001, Math.abs(signal.entryPrice - signal.stopLoss));
  const accountBalance = user?.accountBalance || 100000;
  const riskPerTrade = user?.riskSettings?.riskPerTrade ?? 1.0;
  const dollarRisk = Math.max(10, Math.round(accountBalance * (riskPerTrade / 100)));
  const effectivePnl = signal.pnl !== undefined ? signal.pnl : signal.realizedProfit;

  switch (signal.outcomeStatus) {
    case 'TP3_HIT': {
      const tp3Dist = Math.abs(signal.targetPrice3 - signal.entryPrice);
      const rawRr = tp3Dist / riskDist;
      const rr = Math.round(Math.max(rawRr, 3.0) * 10) / 10;
      return { rr, status: 'WIN', label: 'TP3 Max Hit 💎' };
    }
    case 'TP2_HIT': {
      const tp2Dist = Math.abs(signal.targetPrice2 - signal.entryPrice);
      const rawRr = tp2Dist / riskDist;
      const rr = Math.round(Math.max(rawRr, 2.0) * 10) / 10;
      return { rr, status: 'WIN', label: 'TP2 Hit 🚀' };
    }
    case 'TP1_HIT': {
      const tp1Dist = Math.abs(signal.targetPrice1 - signal.entryPrice);
      const rawRr = tp1Dist / riskDist;
      // If BE hit after TP1, 70% was scaled out at TP1 and 30% closed at BE
      const rrValue = signal.isBeHitAfterTp1 ? rawRr * 0.7 : rawRr;
      const rr = Math.round(Math.max(rrValue, 1.0) * 10) / 10;
      return {
        rr,
        status: 'WIN',
        label: signal.isBeHitAfterTp1
          ? (isRo ? 'TP1 Hit + BE Închis 🎯' : 'TP1 Hit + BE Closed 🎯')
          : (isRo ? 'TP1 Securizat 🎯' : 'TP1 Secured 🎯'),
      };
    }
    case 'SL_HIT':
      return { rr: -1.0, status: 'LOSS', label: 'Stop Loss Hit 🛑' };

    case 'MANUAL_PROFIT': {
      const finalExit = signal.exitPrice || (currentPrice && currentPrice > 0 ? currentPrice : signal.entryPrice);
      const move = isBuy ? (finalExit - signal.entryPrice) : (signal.entryPrice - finalExit);
      const priceRr = Math.round((move / riskDist) * 10) / 10;
      let rr = priceRr > 0 ? priceRr : 1.5;
      if (typeof effectivePnl === 'number' && dollarRisk > 0) {
        rr = Math.max(0.1, Math.round((effectivePnl / dollarRisk) * 10) / 10);
      }
      return {
        rr,
        status: 'WIN',
        label: typeof effectivePnl === 'number'
          ? (isRo ? `Închis Manual Profit (+$${effectivePnl.toFixed(2)}) ✋` : `Closed Manually Profit (+$${effectivePnl.toFixed(2)}) ✋`)
          : (isRo ? `Închis Manual Profit (+${rr}R) ✋` : `Closed Manually Profit (+${rr}R) ✋`),
      };
    }

    case 'MANUAL_LOSS': {
      const finalExit = signal.exitPrice || (currentPrice && currentPrice > 0 ? currentPrice : signal.entryPrice);
      const move = isBuy ? (finalExit - signal.entryPrice) : (signal.entryPrice - finalExit);
      const priceRr = Math.round((move / riskDist) * 10) / 10;
      let rr = priceRr < 0 ? priceRr : -1.0;
      if (typeof effectivePnl === 'number' && dollarRisk > 0) {
        rr = Math.min(-0.1, Math.round((effectivePnl / dollarRisk) * 10) / 10);
      }
      return {
        rr,
        status: 'LOSS',
        label: typeof effectivePnl === 'number'
          ? (isRo ? `Închis Manual Pierdere (-$${Math.abs(effectivePnl).toFixed(2)}) ✋` : `Closed Manually Loss (-$${Math.abs(effectivePnl).toFixed(2)}) ✋`)
          : (isRo ? `Închis Manual Pierdere (${rr}R) ✋` : `Closed Manually Loss (${rr}R) ✋`),
      };
    }

    case 'MANUAL_BE':
    case 'MANUAL_CLOSED':
      return { rr: 0, status: 'BREAKEVEN', label: isRo ? 'Închis Manual (BE) 🛡️' : 'Closed Manually (BE) 🛡️' };

    case 'CANCELLED': {
      // If entry was never triggered, this order was never executed in the market!
      if (!signal.isEntryTriggered) {
        return { rr: 0, status: 'BREAKEVEN', label: isRo ? 'Ordin Anulat 🚫' : 'Order Cancelled 🚫' };
      }
      if (typeof effectivePnl === 'number') {
        if (effectivePnl > 0) {
          const rr = dollarRisk > 0 ? Math.max(0.1, Math.round((effectivePnl / dollarRisk) * 10) / 10) : 0.5;
          return {
            rr,
            status: 'WIN',
            label: isRo ? `Închis Manual (+$${effectivePnl.toFixed(2)}) ✋` : `Closed Manually (+$${effectivePnl.toFixed(2)}) ✋`,
          };
        } else if (effectivePnl < 0) {
          const rr = dollarRisk > 0 ? Math.min(-0.1, Math.round((effectivePnl / dollarRisk) * 10) / 10) : -0.5;
          return {
            rr,
            status: 'LOSS',
            label: isRo ? `Închis Manual (-$${Math.abs(effectivePnl).toFixed(2)}) ✋` : `Closed Manually (-$${Math.abs(effectivePnl).toFixed(2)}) ✋`,
          };
        } else {
          return { rr: 0, status: 'BREAKEVEN', label: isRo ? 'Închis Manual (BE) 🛡️' : 'Closed Manually (BE) 🛡️' };
        }
      }
      if (signal.exitPrice && signal.exitPrice !== signal.entryPrice) {
        const move = isBuy ? (signal.exitPrice - signal.entryPrice) : (signal.entryPrice - signal.exitPrice);
        const rawRr = Math.round((move / riskDist) * 10) / 10;
        if (move > 0) return { rr: Math.max(0.1, rawRr), status: 'WIN', label: isRo ? `Închis Manual Profit (+${rawRr}R) ✋` : `Closed Manually Profit (+${rawRr}R) ✋` };
        if (move < 0) return { rr: Math.min(-0.1, rawRr), status: 'LOSS', label: isRo ? `Închis Manual Pierdere (${rawRr}R) ✋` : `Closed Manually Loss (${rawRr}R) ✋` };
      }
      return { rr: 0, status: 'BREAKEVEN', label: isRo ? 'Ordin Anulat 🚫' : 'Order Cancelled 🚫' };
    }

    case 'RUNNING': {
      if (typeof currentPrice === 'number' && currentPrice > 0) {
        const unrealizedMove = isBuy
          ? currentPrice - signal.entryPrice
          : signal.entryPrice - currentPrice;
        const rawRr = unrealizedMove / riskDist;
        const rr = Math.round(rawRr * 10) / 10;
        return {
          rr,
          status: 'RUNNING',
          label: isRo
            ? (rr >= 0 ? `În Desfășurare (+${rr}R)` : `În Desfășurare (${rr}R)`)
            : (rr >= 0 ? `In Progress (+${rr}R)` : `In Progress (${rr}R)`),
        };
      }
      return { rr: 0, status: 'RUNNING', label: isRo ? 'Activ / În Rulare' : 'Active / Running' };
    }

    default: {
      if (signal.status === 'CLOSED') {
        if (typeof effectivePnl === 'number') {
          if (effectivePnl > 0) {
            const rr = dollarRisk > 0 ? Math.max(0.1, Math.round((effectivePnl / dollarRisk) * 10) / 10) : 1.5;
            return { rr, status: 'WIN', label: isRo ? `Închis Profit (+$${effectivePnl.toFixed(2)})` : `Closed Profit (+$${effectivePnl.toFixed(2)})` };
          } else if (effectivePnl < 0) {
            const rr = dollarRisk > 0 ? Math.min(-0.1, Math.round((effectivePnl / dollarRisk) * 10) / 10) : -1.0;
            return { rr, status: 'LOSS', label: isRo ? `Închis Pierdere (-$${Math.abs(effectivePnl).toFixed(2)})` : `Closed Loss (-$${Math.abs(effectivePnl).toFixed(2)})` };
          } else {
            return { rr: 0, status: 'BREAKEVEN', label: isRo ? 'Închis BE ($0.00)' : 'Closed BE ($0.00)' };
          }
        }
        if (signal.exitPrice && signal.isEntryTriggered) {
          const move = isBuy ? (signal.exitPrice - signal.entryPrice) : (signal.entryPrice - signal.exitPrice);
          const rawRr = Math.round((move / riskDist) * 10) / 10;
          if (rawRr > 0) return { rr: rawRr, status: 'WIN', label: isRo ? `Închis Profit (+${rawRr}R)` : `Closed Profit (+${rawRr}R)` };
          if (rawRr < 0) return { rr: rawRr, status: 'LOSS', label: isRo ? `Închis Pierdere (${rawRr}R)` : `Closed Loss (${rawRr}R)` };
          return { rr: 0, status: 'BREAKEVEN', label: isRo ? 'Închis BE' : 'Closed BE' };
        }
      }
      return { rr: 0, status: 'RUNNING', label: isRo ? 'În Așteptare' : 'Pending' };
    }
  }
}

export function convertSignalToJournalEntry(
  signal: TradingSignal,
  quotes?: Record<string, MarketQuote>,
  user?: any,
  lang: 'ro' | 'en' = 'ro'
): TradeJournalEntry {
  const isRo = lang === 'ro';
  const currentQuote = quotes ? quotes[signal.instrumentId] : undefined;
  const currPrice = currentQuote?.price ?? signal.currentMarketPrice;
  const { rr, status, label } = calculateSignalAchievedRR(signal, currPrice, user, lang);

  const typeStr = (signal.type || (signal as any).direction || signal.executionType || '').toUpperCase();
  const isBuy = typeStr.includes('BUY');
  const dKey = getLocalDateKey(signal.createdAt);
  const timeStr = formatTimeFromDate(signal.createdAt);

  const accountBalance = user?.accountBalance || 100000;
  const riskPerTrade = user?.riskSettings?.riskPerTrade ?? 1.0;
  const dollarRisk = Math.max(10, Math.round(accountBalance * (riskPerTrade / 100)));

  const effectivePnl = (signal.pnl !== undefined && typeof signal.pnl === 'number')
    ? signal.pnl
    : (signal.realizedProfit !== undefined && typeof signal.realizedProfit === 'number')
    ? signal.realizedProfit
    : undefined;

  const hasRealPnl = effectivePnl !== undefined;
  let realPnl: number;
  let finalRr = rr;

  if (hasRealPnl) {
    realPnl = Math.round(effectivePnl! * 100) / 100;
    if (dollarRisk > 0 && finalRr === 0) {
      if (realPnl > 0) finalRr = Math.max(0.1, Math.round((realPnl / dollarRisk) * 10) / 10);
      else if (realPnl < 0) finalRr = Math.min(-0.1, Math.round((realPnl / dollarRisk) * 10) / 10);
    }
  } else if (status === 'WIN') {
    realPnl = Math.round(dollarRisk * (finalRr > 0 ? finalRr : 1.5) * 100) / 100;
  } else if (status === 'LOSS') {
    realPnl = finalRr === -1.0 ? -dollarRisk : Math.round(dollarRisk * finalRr * 100) / 100;
  } else if (status === 'BREAKEVEN') {
    realPnl = 0;
  } else {
    realPnl = Math.round(dollarRisk * finalRr * 100) / 100;
  }

  let finalStatus = status;
  let finalLabel = label;
  if (hasRealPnl && realPnl !== undefined) {
    if (realPnl > 0) {
      finalStatus = 'WIN';
      if (finalRr <= 0) finalRr = dollarRisk > 0 ? Math.max(0.1, Math.round((realPnl / dollarRisk) * 10) / 10) : 1.5;
      finalLabel = signal.outcomeStatus === 'TP3_HIT'
        ? (isRo ? `TP3 Realizat (+$${realPnl.toFixed(2)}) 💎` : `TP3 Realized (+$${realPnl.toFixed(2)}) 💎`)
        : signal.outcomeStatus === 'TP2_HIT'
        ? (isRo ? `TP2 Realizat (+$${realPnl.toFixed(2)}) 🚀` : `TP2 Realized (+$${realPnl.toFixed(2)}) 🚀`)
        : signal.outcomeStatus === 'TP1_HIT'
        ? (isRo ? `TP1 Realizat (+$${realPnl.toFixed(2)}) 🎯` : `TP1 Realized (+$${realPnl.toFixed(2)}) 🎯`)
        : (isRo ? `Profit Realizat (+$${realPnl.toFixed(2)})` : `Realized Profit (+$${realPnl.toFixed(2)})`);
    } else if (realPnl < 0) {
      finalStatus = 'LOSS';
      if (finalRr >= 0) finalRr = dollarRisk > 0 ? Math.min(-0.1, Math.round((realPnl / dollarRisk) * 10) / 10) : -1.0;
      finalLabel = signal.outcomeStatus === 'SL_HIT'
        ? `Stop Loss (-$${Math.abs(realPnl).toFixed(2)}) 🛑`
        : (isRo ? `Pierdere Realizată (-$${Math.abs(realPnl).toFixed(2)})` : `Realized Loss (-$${Math.abs(realPnl).toFixed(2)})`);
    } else {
      finalStatus = 'BREAKEVEN';
      finalRr = 0;
      finalLabel = isRo ? 'BE Realizat ($0.00)' : 'BE Realized ($0.00)';
    }
  } else if (status === 'WIN') {
    finalLabel = signal.outcomeStatus === 'TP3_HIT'
      ? `TP3 Max Hit (+$${realPnl.toFixed(2)}) 💎`
      : signal.outcomeStatus === 'TP2_HIT'
      ? `TP2 Hit (+$${realPnl.toFixed(2)}) 🚀`
      : signal.outcomeStatus === 'TP1_HIT'
      ? (isRo ? `TP1 Securizat (+$${realPnl.toFixed(2)}) 🎯` : `TP1 Secured (+$${realPnl.toFixed(2)}) 🎯`)
      : label;
  } else if (status === 'LOSS') {
    finalLabel = signal.outcomeStatus === 'SL_HIT'
      ? `Stop Loss (-$${Math.abs(realPnl).toFixed(2)}) 🛑`
      : label;
  }

  const exitPrice =
    signal.exitPrice ||
    (signal.outcomeStatus === 'TP3_HIT'
      ? signal.targetPrice3
      : signal.outcomeStatus === 'TP2_HIT'
      ? signal.targetPrice2
      : signal.outcomeStatus === 'TP1_HIT'
      ? signal.targetPrice1
      : finalStatus === 'LOSS'
      ? signal.stopLoss
      : currPrice);

  const takeProfit = signal.targetPrice3 || signal.targetPrice2 || signal.targetPrice1;

  return {
    id: `sig_journal_${signal.id}`,
    date: dKey,
    time: timeStr,
    instrumentId: signal.instrumentId,
    symbol: signal.symbol,
    instrumentName: signal.instrumentName,
    direction: isBuy ? 'BUY' : 'SELL',
    executionType: signal.executionType || (isBuy ? 'BUY MARKET' : 'SELL MARKET'),
    entryPrice: signal.entryPrice,
    stopLoss: signal.stopLoss,
    takeProfit: takeProfit,
    exitPrice: exitPrice,
    rrAchieved: finalRr,
    pnl: realPnl,
    status: finalStatus,
    outcomeLabel: finalLabel,
    setup: signal.title || 'AI Strategy Signal',
    notes: signal.summary || signal.rationale || '',
    timeframe: signal.timeframe,
    linkedSignalId: signal.id,
    isManual: signal.status === 'CANCELLED' && Boolean(signal.cancelReasonRo?.includes('manual')),
    generatedAt: signal.createdAt,
    entryDate: dKey,
    entryTime: timeStr,
    closedAt: (finalStatus === 'WIN' || finalStatus === 'LOSS' || finalStatus === 'BREAKEVEN')
      ? (signal.closedAt || signal.updatedAt || new Date().toISOString())
      : undefined,
    createdAt: signal.createdAt,
  };
}

export function isDemoOrSampleTrade(trade: any): boolean {
  if (!trade || typeof trade !== 'object') return false;
  const id = String(trade.id || '');
  if (
    id.startsWith('sample_trade') ||
    id.startsWith('dummy_') ||
    id.startsWith('demo_') ||
    id.includes('sample')
  ) {
    return true;
  }
  return false;
}

export function localizeOutcomeLabel(label?: string, lang: 'ro' | 'en' = 'ro'): string {
  if (!label) return '';
  if (lang === 'en') {
    return label
      .replace(/Închis Manual Profit/gi, 'Closed Manually Profit')
      .replace(/Închis Manual Pierdere/gi, 'Closed Manually Loss')
      .replace(/Închis Manual \(BE\)/gi, 'Closed Manually (BE)')
      .replace(/Închis Manual din MT5/gi, 'Closed Manually in MT5')
      .replace(/Închis Manual/gi, 'Closed Manually')
      .replace(/În Desfășurare \/ Activ/gi, 'Running / Active')
      .replace(/În Desfășurare/gi, 'In Progress')
      .replace(/Activ \/ În Rulare/gi, 'Active / Running')
      .replace(/În Așteptare/gi, 'Pending')
      .replace(/Ordin Anulat/gi, 'Order Cancelled')
      .replace(/TP1 Hit \+ BE Închis/gi, 'TP1 Hit + BE Closed')
      .replace(/TP1 Securizat/gi, 'TP1 Secured')
      .replace(/TP1 Realizat/gi, 'TP1 Realized')
      .replace(/TP2 Realizat/gi, 'TP2 Realized')
      .replace(/TP3 Realizat/gi, 'TP3 Realized')
      .replace(/Profit Realizat/gi, 'Realized Profit')
      .replace(/Pierdere Realizată/gi, 'Realized Loss')
      .replace(/BE Realizat/gi, 'BE Realized');
  } else {
    return label
      .replace(/Closed Manually Profit/gi, 'Închis Manual Profit')
      .replace(/Closed Manually Loss/gi, 'Închis Manual Pierdere')
      .replace(/Closed Manually \(BE\)/gi, 'Închis Manual (BE)')
      .replace(/Closed Manually in MT5/gi, 'Închis Manual din MT5')
      .replace(/Closed Manually/gi, 'Închis Manual')
      .replace(/Running \/ Active/gi, 'În Desfășurare / Activ')
      .replace(/In Progress/gi, 'În Desfășurare')
      .replace(/Active \/ Running/gi, 'Activ / În Rulare')
      .replace(/Order Cancelled/gi, 'Ordin Anulat')
      .replace(/TP1 Hit \+ BE Closed/gi, 'TP1 Hit + BE Închis')
      .replace(/TP1 Secured/gi, 'TP1 Securizat')
      .replace(/TP1 Realized/gi, 'TP1 Realizat')
      .replace(/TP2 Realized/gi, 'TP2 Realized')
      .replace(/TP3 Realized/gi, 'TP3 Realizat')
      .replace(/Realized Profit/gi, 'Profit Realizat')
      .replace(/Realized Loss/gi, 'Pierdere Realizată')
      .replace(/BE Realized/gi, 'BE Realizat');
  }
}

export function unifyJournalEntries(
  signals: TradingSignal[],
  manualEntries: TradeJournalEntry[],
  quotes?: Record<string, MarketQuote>,
  user?: any,
  deletedJournalIds?: string[],
  lang: 'ro' | 'en' = 'ro'
): TradeJournalEntry[] {
  const deletedSet = new Set<string>([
    ...(deletedJournalIds || []),
    ...(user?.deletedJournalTradeIds || []),
  ]);

  // Strip out any demo or dummy sample entries and permanently deleted entries
  const cleanManual = (manualEntries || []).filter((m) => {
    if (!m || isDemoOrSampleTrade(m)) return false;
    if (deletedSet.has(m.id)) return false;
    if (m.linkedSignalId && deletedSet.has(m.linkedSignalId)) return false;
    if (deletedSet.has(`sig_journal_${m.id}`)) return false;
    return true;
  });

  // Filter out any signals that have been deleted from the journal
  const convertedSignals = (signals || [])
    .filter((s) => {
      if (!s || !s.id) return false;
      if (deletedSet.has(s.id) || deletedSet.has(`sig_journal_${s.id}`)) return false;
      return true;
    })
    .map((s) => convertSignalToJournalEntry(s, quotes, user, lang));

  const manualMap = new Map<string, TradeJournalEntry>();
  for (const m of cleanManual) {
    const key = m.linkedSignalId || m.id;
    manualMap.set(key, m);
  }

  const result: TradeJournalEntry[] = [];
  const processedKeys = new Set<string>();

  for (const cs of convertedSignals) {
    const key = cs.linkedSignalId || cs.id;
    if (deletedSet.has(cs.id) || (cs.linkedSignalId && deletedSet.has(cs.linkedSignalId))) {
      continue;
    }
    processedKeys.add(key);
    const existingManual = manualMap.get(key);

    if (existingManual) {
      // Sanitize inverted signs (e.g. positive pnl on a LOSS trade)
      let cleanExisting = existingManual;
      if (cleanExisting.status === 'LOSS' && typeof cleanExisting.pnl === 'number' && cleanExisting.pnl > 0) {
        cleanExisting = {
          ...cleanExisting,
          pnl: -Math.abs(cleanExisting.pnl),
          rrAchieved: cleanExisting.rrAchieved !== undefined ? -Math.abs(cleanExisting.rrAchieved) : -1,
        };
      }

      // If signal reached a milestone (TP1, TP2, TP3, SL) or has higher achieved RR / profit:
      // Always update the journal entry to reflect the latest status, TP3 milestone, and profit!
      const csRr = cs.rrAchieved || 0;
      const exRr = cleanExisting.rrAchieved || 0;
      const isProgressed = cs.status === 'WIN' && (csRr > exRr || cs.outcomeLabel.includes('TP3') || cs.outcomeLabel.includes('TP2'));
      const isTerminalUpdate = (cs.status === 'WIN' || cs.status === 'LOSS') && cleanExisting.status === 'RUNNING';

      if (isProgressed || isTerminalUpdate) {
        result.push({
          ...cleanExisting,
          status: cs.status,
          outcomeLabel: cs.outcomeLabel,
          rrAchieved: cs.rrAchieved,
          pnl: cs.pnl,
          exitPrice: cs.exitPrice,
          takeProfit: cs.takeProfit,
          closedAt: cs.closedAt || cleanExisting.closedAt,
        });
      } else {
        // Keep existing manual details, ensuring pnl is not lost
        if (cleanExisting.pnl === undefined && cs.pnl !== undefined) {
          result.push({
            ...cleanExisting,
            pnl: cs.pnl,
            rrAchieved: cleanExisting.rrAchieved || cs.rrAchieved,
          });
        } else {
          result.push(cleanExisting);
        }
      }
    } else {
      result.push(cs);
    }
  }

  // Include all manual entries that do not have an active signal (e.g. manually closed signals)
  for (const m of cleanManual) {
    const key = m.linkedSignalId || m.id;
    if (!processedKeys.has(key)) {
      if (!deletedSet.has(m.id) && (!m.linkedSignalId || !deletedSet.has(m.linkedSignalId))) {
        let cleanEntry = m;
        if (cleanEntry.status === 'LOSS' && typeof cleanEntry.pnl === 'number' && cleanEntry.pnl > 0) {
          cleanEntry = {
            ...cleanEntry,
            pnl: -Math.abs(cleanEntry.pnl),
            rrAchieved: cleanEntry.rrAchieved !== undefined ? -Math.abs(cleanEntry.rrAchieved) : -1,
          };
        }
        result.push(cleanEntry);
      }
    }
  }

  // Sort by date + time descending
  return result.sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.time || '12:00'}:00`).getTime();
    const timeB = new Date(`${b.date}T${b.time || '12:00'}:00`).getTime();
    return timeB - timeA;
  });
}

export interface DayCalendarCell {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  dayOfWeek: number; // 0=Mon, ..., 6=Sun
}

export function getCalendarGridForMonth(year: number, month: number): DayCalendarCell[] {
  const todayStr = getLocalDateKey(new Date());

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Monday-first indexing: Monday = 0, Tuesday = 1, ..., Sunday = 6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const cells: DayCalendarCell[] = [];

  // Previous month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const d = new Date(prevYear, prevMonth, dayNum);
    const dow = (d.getDay() + 6) % 7;
    cells.push({
      dateStr: dStr,
      dayNumber: dayNum,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      isWeekend: dow === 5 || dow === 6,
      dayOfWeek: dow,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(year, month, day);
    const dow = (d.getDay() + 6) % 7;
    cells.push({
      dateStr: dStr,
      dayNumber: day,
      month,
      year,
      isCurrentMonth: true,
      isToday: dStr === todayStr,
      isWeekend: dow === 5 || dow === 6,
      dayOfWeek: dow,
    });
  }

  // Next month padding to fill complete rows (multiples of 7, either 35 or 42 cells)
  const totalSlots = cells.length <= 35 ? 35 : 42;
  const remaining = totalSlots - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(nextYear, nextMonth, day);
    const dow = (d.getDay() + 6) % 7;
    cells.push({
      dateStr: dStr,
      dayNumber: day,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      isWeekend: dow === 5 || dow === 6,
      dayOfWeek: dow,
    });
  }

  return cells;
}

export interface DayJournalSummary {
  dateStr: string;
  totalRR: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  runningCount: number;
  winRate: number;
  totalPnl: number;
  trades: TradeJournalEntry[];
  symbols: string[];
}

export function getDailyJournalMap(entries: TradeJournalEntry[]): Record<string, DayJournalSummary> {
  const map: Record<string, DayJournalSummary> = {};

  for (const entry of entries) {
    const key = entry.date;
    if (!key) continue;

    if (!map[key]) {
      map[key] = {
        dateStr: key,
        totalRR: 0,
        tradesCount: 0,
        winCount: 0,
        lossCount: 0,
        beCount: 0,
        runningCount: 0,
        winRate: 0,
        totalPnl: 0,
        trades: [],
        symbols: [],
      };
    }

    const day = map[key];
    day.trades.push(entry);
    day.tradesCount++;

    if (entry.status === 'WIN') {
      day.winCount++;
      day.totalRR += entry.rrAchieved || 0;
    } else if (entry.status === 'LOSS') {
      day.lossCount++;
      day.totalRR += -Math.abs(entry.rrAchieved !== undefined && !isNaN(entry.rrAchieved) ? entry.rrAchieved : 1);
    } else if (entry.status === 'BREAKEVEN') {
      day.beCount++;
    } else if (entry.status === 'RUNNING') {
      day.runningCount++;
      // Do not count running trades towards locked RR unless desired
    }

    if (typeof entry.pnl === 'number') {
      day.totalPnl += entry.pnl;
    }

    if (entry.symbol && !day.symbols.includes(entry.symbol)) {
      day.symbols.push(entry.symbol);
    }
  }

  // Finalize stats per day
  for (const day of Object.values(map)) {
    day.totalRR = Math.round(day.totalRR * 10) / 10;
    const closed = day.winCount + day.lossCount;
    day.winRate = closed > 0 ? Math.round((day.winCount / closed) * 100) : 0;
    day.totalPnl = Math.round(day.totalPnl * 100) / 100;
  }

  return map;
}

export interface MonthlyJournalStats {
  totalNetRR: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  runningCount: number;
  winRate: number;
  greenDaysCount: number;
  redDaysCount: number;
  neutralDaysCount: number;
  bestDay: { date: string; rr: number } | null;
  worstDay: { date: string; rr: number } | null;
  totalPnl: number;
  avgRrPerWin: number;
  avgRrPerTrade: number;
}

export function calculateMonthlyStats(
  entries: TradeJournalEntry[],
  year: number,
  month: number
): MonthlyJournalStats {
  const targetPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.date && e.date.startsWith(targetPrefix));
  const dailyMap = getDailyJournalMap(monthEntries);

  let totalNetRR = 0;
  let totalTrades = monthEntries.length;
  let winCount = 0;
  let lossCount = 0;
  let beCount = 0;
  let runningCount = 0;
  let totalPnl = 0;
  let totalWinRR = 0;

  for (const entry of monthEntries) {
    if (entry.status === 'WIN') {
      winCount++;
      totalNetRR += entry.rrAchieved || 0;
      totalWinRR += entry.rrAchieved || 0;
    } else if (entry.status === 'LOSS') {
      lossCount++;
      totalNetRR += -Math.abs(entry.rrAchieved !== undefined && !isNaN(entry.rrAchieved) ? entry.rrAchieved : 1);
    } else if (entry.status === 'BREAKEVEN') {
      beCount++;
    } else if (entry.status === 'RUNNING') {
      runningCount++;
    }

    if (typeof entry.pnl === 'number') {
      const effPnl = (entry.status === 'LOSS' && entry.pnl > 0) ? -entry.pnl : entry.pnl;
      totalPnl += effPnl;
    }
  }

  totalNetRR = Math.round(totalNetRR * 10) / 10;
  const closedCount = winCount + lossCount;
  const winRate = closedCount > 0 ? Math.round((winCount / closedCount) * 100) : 0;

  let greenDaysCount = 0;
  let redDaysCount = 0;
  let neutralDaysCount = 0;
  let bestDay: { date: string; rr: number } | null = null;
  let worstDay: { date: string; rr: number } | null = null;

  for (const [date, day] of Object.entries(dailyMap)) {
    if (day.totalRR > 0) {
      greenDaysCount++;
      if (!bestDay || day.totalRR > bestDay.rr) {
        bestDay = { date, rr: day.totalRR };
      }
    } else if (day.totalRR < 0) {
      redDaysCount++;
      if (!worstDay || day.totalRR < worstDay.rr) {
        worstDay = { date, rr: day.totalRR };
      }
    } else if (day.tradesCount > 0) {
      neutralDaysCount++;
    }
  }

  const avgRrPerWin = winCount > 0 ? Math.round((totalWinRR / winCount) * 10) / 10 : 0;
  const avgRrPerTrade = closedCount > 0 ? Math.round((totalNetRR / closedCount) * 10) / 10 : 0;

  return {
    totalNetRR,
    totalTrades,
    winCount,
    lossCount,
    beCount,
    runningCount,
    winRate,
    greenDaysCount,
    redDaysCount,
    neutralDaysCount,
    bestDay,
    worstDay,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgRrPerWin,
    avgRrPerTrade,
  };
}

// Initial sample trades - empty by default (no demo/dummy trades)
export const INITIAL_SAMPLE_TRADES: TradeJournalEntry[] = [];

