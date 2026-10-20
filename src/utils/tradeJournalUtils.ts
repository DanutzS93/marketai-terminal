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
  currentPrice?: number
): { rr: number; status: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'RUNNING'; label: string } {
  const isBuy = signal.type.toUpperCase().includes('BUY');
  const riskDist = Math.abs(signal.entryPrice - signal.stopLoss) || 1;

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
        label: signal.isBeHitAfterTp1 ? 'TP1 Hit + BE Închis 🎯' : 'TP1 Securizat 🎯',
      };
    }
    case 'SL_HIT':
      return { rr: -1.0, status: 'LOSS', label: 'Stop Loss Hit 🛑' };

    case 'CANCELLED':
      return { rr: 0, status: 'BREAKEVEN', label: 'Anulat' };

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
          label: rr >= 0 ? `În Desfășurare (+${rr}R)` : `În Desfășurare (${rr}R)`,
        };
      }
      return { rr: 0, status: 'RUNNING', label: 'Activ / În Rulare' };
    }

    default:
      return { rr: 0, status: 'RUNNING', label: 'În Așteptare' };
  }
}

export function convertSignalToJournalEntry(
  signal: TradingSignal,
  quotes?: Record<string, MarketQuote>
): TradeJournalEntry {
  const currentQuote = quotes ? quotes[signal.instrumentId] : undefined;
  const currPrice = currentQuote?.price ?? signal.currentMarketPrice;
  const { rr, status, label } = calculateSignalAchievedRR(signal, currPrice);

  const isBuy = signal.type.toUpperCase().includes('BUY');
  const dKey = getLocalDateKey(signal.createdAt);
  const timeStr = formatTimeFromDate(signal.createdAt);

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
    takeProfit: signal.targetPrice2 || signal.targetPrice1,
    exitPrice:
      status === 'WIN'
        ? signal.targetPrice2 || signal.targetPrice1
        : status === 'LOSS'
        ? signal.stopLoss
        : currPrice,
    rrAchieved: rr,
    status,
    outcomeLabel: label,
    setup: signal.title || 'AI Strategy Signal',
    notes: signal.summary || signal.rationale || '',
    timeframe: signal.timeframe,
    linkedSignalId: signal.id,
    isManual: false,
    generatedAt: signal.createdAt,
    entryDate: dKey,
    entryTime: timeStr,
    closedAt: (status === 'WIN' || status === 'LOSS' || status === 'BREAKEVEN') ? (signal.updatedAt || new Date().toISOString()) : undefined,
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

export function unifyJournalEntries(
  signals: TradingSignal[],
  manualEntries: TradeJournalEntry[],
  quotes?: Record<string, MarketQuote>
): TradeJournalEntry[] {
  // Strip out any demo or dummy sample entries
  const cleanManual = (manualEntries || []).filter((m) => !isDemoOrSampleTrade(m));
  const convertedSignals = (signals || []).map((s) => convertSignalToJournalEntry(s, quotes));
  const linkedSignalIds = new Set(
    cleanManual.filter((m) => m.linkedSignalId).map((m) => m.linkedSignalId)
  );

  // Exclude signals that already have an explicit manual override
  const cleanConverted = convertedSignals.filter((s) => !linkedSignalIds.has(s.linkedSignalId));

  const all = [...cleanManual, ...cleanConverted];

  // Sort by date + time descending
  return all.sort((a, b) => {
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
      day.totalRR += entry.rrAchieved || -1;
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
      totalNetRR += entry.rrAchieved || -1;
    } else if (entry.status === 'BREAKEVEN') {
      beCount++;
    } else if (entry.status === 'RUNNING') {
      runningCount++;
    }

    if (typeof entry.pnl === 'number') {
      totalPnl += entry.pnl;
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

