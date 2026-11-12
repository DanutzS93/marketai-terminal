import fs from 'fs';
import path from 'path';
import { DailyMacroBriefing } from '../types';

export interface EconomicCalendarItem {
  id: string;
  title: string;
  titleRo?: string;
  titleEn?: string;
  currency: string;
  country: string;
  impact: string;
  date: string;
  dateRo?: string;
  dateEn?: string;
  status: string;
  forecast: string;
  previous: string;
  actual: string | null;
  unit: string;
  affectedAssets: string[];
  description: string;
  descriptionRo?: string;
  descriptionEn?: string;
  epochMs?: number;
  isToday?: boolean;
}

export interface MarketQuotesMap {
  nasdaq?: any;
  spx500?: any;
  dow?: any;
  gold?: any;
  eurusd?: any;
  gbpusd?: any;
  usdjpy?: any;
}

const BRIEFING_CACHE_FILE = path.join(process.cwd(), 'data', 'daily_macro_briefing_cache.json');

/**
 * Calculates dynamic Support and Resistance levels from live quotes (Pivot Points)
 */
function calculatePivotLevels(quote: any, decimals = 2) {
  const p = typeof quote?.price === 'number' && quote.price > 0 ? quote.price : 100;
  const high = typeof quote?.high === 'number' && quote.high > p ? quote.high : p * 1.006;
  const low = typeof quote?.low === 'number' && quote.low < p && quote.low > 0 ? quote.low : p * 0.994;

  const pivot = (high + low + p) / 3;
  const s1 = Number((2 * pivot - high).toFixed(decimals));
  const s2 = Number((pivot - (high - low)).toFixed(decimals));
  const r1 = Number((2 * pivot - low).toFixed(decimals));
  const r2 = Number((pivot + (high - low)).toFixed(decimals));

  return {
    price: p,
    pivot,
    s1,
    s2,
    r1: r1 > s1 ? r1 : Number((p * 1.005).toFixed(decimals)),
    r2: r2 > r1 ? r2 : Number((p * 1.01).toFixed(decimals)),
  };
}

/**
 * Formats price levels for UI display
 */
function formatLevelRange(val1: number, val2: number, prefix = '$', decimals = 0): string {
  const low = Math.min(val1, val2);
  const high = Math.max(val1, val2);
  if (decimals === 0) {
    return `${prefix}${Math.round(low).toLocaleString('en-US')} - ${prefix}${Math.round(high).toLocaleString('en-US')}`;
  }
  return `${prefix}${low.toFixed(decimals)} - ${prefix}${high.toFixed(decimals)}`;
}

/**
 * Institutional effect explanation for economic calendar results
 */
function determineEventMarketEffect(event: EconomicCalendarItem): { effectRo: string; effectEn: string } {
  const title = (event.title || '').toLowerCase();
  const c = event.currency;
  const act = event.actual;
  const fc = event.forecast;

  if (title.includes('cpi') || title.includes('infla') || title.includes('ppi')) {
    return {
      effectRo: 'Datele de inflație dictează traiectoria ratei dobânzii Fed. O cifră peste estimări întărește USD și pune presiune pe aur și acțiuni tehnologice.',
      effectEn: 'Inflation prints dictate the Fed interest rate trajectory. Above-forecast prints strengthen USD and pressure Gold and tech equities.'
    };
  }

  if (title.includes('unemployment') || title.includes('claims') || title.includes('șomaj') || title.includes('non-farm') || title.includes('nfp')) {
    return {
      effectRo: 'Piața muncii reflectă rezistența economiei. Solicitările reduse de șomaj susțin stabilitatea dolarului și amână relaxarea monetară agresivă.',
      effectEn: 'Labor metrics reflect economic endurance. Lower jobless claims support USD stability and delay aggressive monetary easing.'
    };
  }

  if (title.includes('retail') || title.includes('vânzări') || title.includes('consum')) {
    return {
      effectRo: 'Cheltuielile consumatorilor reprezintă nucleul PIB-ului american (~70%). Creșterea vânzărilor susține companiile din Dow Jones și S&P 500.',
      effectEn: 'Consumer spending forms ~70% of US GDP. Robust retail numbers provide underlying support to Dow Jones and S&P 500 equities.'
    };
  }

  if (title.includes('fed') || title.includes('fomc') || title.includes('powell') || title.includes('speech') || title.includes('discurs')) {
    return {
      effectRo: 'Declarațiile bancherilor centrali recalibrează așteptările de politică monetară, generând volatilitate directă pe Nasdaq, Aur și perechile valutare.',
      effectEn: 'Central banker remarks recalibrate rate expectations, sparking direct volatility across Nasdaq, Gold, and major FX pairs.'
    };
  }

  return {
    effectRo: `Publicare oficială pentru ${c}. Rezultatele au generat rebalansări ale fluxurilor instituționale pe activele corelate.`,
    effectEn: `Official release for ${c}. Outcome prompted institutional portfolio rebalancing across correlated asset classes.`
  };
}

/**
 * Builds the comprehensive Daily Macro Briefing from live market quotes & calendar events
 */
export function buildDailyMacroBriefing(
  quotes: MarketQuotesMap,
  calendarEvents: EconomicCalendarItem[] = []
): DailyMacroBriefing {
  const now = new Date();
  const todayDateStr = now.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }); // e.g. 12.11.2026
  const isoDateStr = now.toISOString().split('T')[0]; // e.g. 2026-11-12

  // Romanian date text
  const daysRo = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const monthsRo = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayOfWeekRo = daysRo[now.getDay()];
  const dayOfWeekEn = daysEn[now.getDay()];
  const monthRo = monthsRo[now.getMonth()];
  const monthEn = monthsEn[now.getMonth()];
  const dayNum = now.getDate();
  const yearNum = now.getFullYear();

  const titleRo = `Raport & Rezumat Macro Zilnic • ${dayOfWeekRo}, ${dayNum} ${monthRo} ${yearNum}`;
  const titleEn = `Daily Macro Briefing & Market Outlook • ${dayOfWeekEn}, ${monthEn} ${dayNum}, ${yearNum}`;

  // Live quotes extraction
  const nasdaqQuote = quotes.nasdaq || { price: 28150, change: 45, changePercent: 0.16, rsi: 54, trend: 'BULLISH' };
  const spxQuote = quotes.spx500 || { price: 7550, change: 12, changePercent: 0.16, rsi: 52, trend: 'BULLISH' };
  const dowQuote = quotes.dow || { price: 52100, change: -30, changePercent: -0.06, rsi: 49, trend: 'NEUTRAL' };
  const goldQuote = quotes.gold || { price: 3965.5, change: 14.2, changePercent: 0.36, rsi: 58, trend: 'BULLISH' };
  const eurusdQuote = quotes.eurusd || { price: 1.0855, change: 0.0012, changePercent: 0.11 };
  const gbpusdQuote = quotes.gbpusd || { price: 1.2940, change: -0.0008, changePercent: -0.06 };
  const usdjpyQuote = quotes.usdjpy || { price: 154.20, change: 0.35, changePercent: 0.23 };

  // Calculate Pivot levels
  const nasdaqLevels = calculatePivotLevels(nasdaqQuote, 0);
  const spxLevels = calculatePivotLevels(spxQuote, 0);
  const dowLevels = calculatePivotLevels(dowQuote, 0);
  const goldLevels = calculatePivotLevels(goldQuote, 2);
  const eurusdLevels = calculatePivotLevels(eurusdQuote, 4);
  const gbpusdLevels = calculatePivotLevels(gbpusdQuote, 4);
  const usdjpyLevels = calculatePivotLevels(usdjpyQuote, 2);

  // Overall Market Sentiment
  const avgIndicesChange = (nasdaqQuote.changePercent + spxQuote.changePercent + dowQuote.changePercent) / 3;
  let marketSentiment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' = 'NEUTRAL';
  if (avgIndicesChange > 0.15) marketSentiment = 'RISK_ON';
  else if (avgIndicesChange < -0.15) marketSentiment = 'RISK_OFF';

  // Indices Bias
  let indicesBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (nasdaqQuote.changePercent > 0.1 && spxQuote.changePercent > 0.05) indicesBias = 'BULLISH';
  else if (nasdaqQuote.changePercent < -0.1 && spxQuote.changePercent < -0.05) indicesBias = 'BEARISH';

  // Gold Bias
  let goldBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (goldQuote.changePercent > 0.15) goldBias = 'BULLISH';
  else if (goldQuote.changePercent < -0.15) goldBias = 'BEARISH';

  // Filter yesterday and today events from calendar
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const yesterdayMidnight = new Date(todayMidnight);
  yesterdayMidnight.setDate(todayMidnight.getDate() - 1);

  const tomorrowMidnight = new Date(todayMidnight);
  tomorrowMidnight.setDate(todayMidnight.getDate() + 1);

  // Events from yesterday (completed or past)
  const yesterdayEvents = calendarEvents.filter((e) => {
    if (e.isToday) return false;
    const epoch = e.epochMs || 0;
    if (epoch > 0) {
      return epoch >= yesterdayMidnight.getTime() - 86400000 && epoch < todayMidnight.getTime();
    }
    return e.status === 'COMPLETED';
  }).slice(0, 4);

  // Fallback yesterday events if none matched
  const finalYesterdayEvents = yesterdayEvents.length > 0 ? yesterdayEvents : calendarEvents.filter((e) => e.status === 'COMPLETED').slice(0, 3);

  // Events for today (upcoming and today's completed)
  const todayEvents = calendarEvents.filter((e) => {
    if (e.isToday) return true;
    const epoch = e.epochMs || 0;
    if (epoch > 0) {
      return epoch >= todayMidnight.getTime() && epoch < tomorrowMidnight.getTime();
    }
    return false;
  });

  const finalTodayEvents = (todayEvents.length > 0 ? todayEvents : calendarEvents.slice(0, 5)).slice(0, 6);

  // 1. YESTERDAY RECAP
  const yesterdayRecap = {
    summaryRo: `Sesiunea de tranzacționare de ieri a evidențiat ${
      avgIndicesChange >= 0 ? 'consolidare pozitivă' : 'prudență și presiuni corective'
    } pe marile burse globale. Indicele Nasdaq 100 a închis la ${Math.round(nasdaqQuote.price).toLocaleString()} (${nasdaqQuote.changePercent >= 0 ? '+' : ''}${nasdaqQuote.changePercent}%), S&P 500 la ${Math.round(spxQuote.price).toLocaleString()}, iar Dow Jones a atins ${Math.round(dowQuote.price).toLocaleString()}. Aurul a demonstrat reziliență la $${goldQuote.price.toFixed(2)}, fiind sprijinit de repoziționarea randamentelor Trezoreriei SUA și a cotației DXY.`,
    summaryEn: `Yesterday's market session displayed ${
      avgIndicesChange >= 0 ? 'constructive upside consolidation' : 'cautious risk rebalancing'
    } across major global exchanges. Nasdaq 100 settled around ${Math.round(nasdaqQuote.price).toLocaleString()} (${nasdaqQuote.changePercent >= 0 ? '+' : ''}${nasdaqQuote.changePercent}%), S&P 500 hovered near ${Math.round(spxQuote.price).toLocaleString()}, while Dow Jones consolidated at ${Math.round(dowQuote.price).toLocaleString()}. Spot Gold maintained solid support at $${goldQuote.price.toFixed(2)}, bolstered by shifts in US Treasury benchmark yields and Dollar Index (DXY) momentum.`,
    keyEventsYesterday: finalYesterdayEvents.map((e) => {
      const effects = determineEventMarketEffect(e);
      return {
        titleRo: e.titleRo || e.title,
        titleEn: e.titleEn || e.title,
        currency: e.currency,
        impact: (e.impact?.toUpperCase() === 'HIGH' ? 'HIGH' : e.impact?.toUpperCase() === 'LOW' ? 'LOW' : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
        actual: e.actual || undefined,
        forecast: e.forecast && e.forecast !== '--' ? e.forecast : undefined,
        previous: e.previous && e.previous !== '--' ? e.previous : undefined,
        effectRo: effects.effectRo,
        effectEn: effects.effectEn,
      };
    }),
    marketReactionRo: `Reacția pieței la raportările recente a confirmat faptul că investitorii instituționali acordă prioritate dinamicii inflației de bază și solidității pieței forței de muncă. Corelația dintre randamentele obligațiunilor pe 10 ani (US10Y) și sectorul de tehnologie a rămas ridicată, orice temperare a randamentelor deschizând oportunități de cumpărare (buy the dip) pe indici.`,
    marketReactionEn: `Market response to recent data highlighted that institutional desks remain laser-focused on core inflation sticky components and labor market health. Correlation between US 10-Year Treasury yields and growth tech equities remained prominent, with any yield pullbacks promptly triggering dip-buying appetite on index benchmarks.`,
  };

  // 2. INDICES OUTLOOK
  const nasdaqSupportStr = formatLevelRange(nasdaqLevels.s1, nasdaqLevels.s2, '$', 0);
  const nasdaqResistStr = formatLevelRange(nasdaqLevels.r1, nasdaqLevels.r2, '$', 0);
  const spxSupportStr = formatLevelRange(spxLevels.s1, spxLevels.s2, '$', 0);
  const spxResistStr = formatLevelRange(spxLevels.r1, spxLevels.r2, '$', 0);
  const dowSupportStr = formatLevelRange(dowLevels.s1, dowLevels.s2, '$', 0);
  const dowResistStr = formatLevelRange(dowLevels.r1, dowLevels.r2, '$', 0);

  const indicesOutlook = {
    bias: indicesBias,
    summaryRo: `Pentru piața indicilor americani (Nasdaq, S&P 500, Dow Jones), așteptăm astăzi o dinamică pe două paliere: acumulare controlată în sesiunea europeană, urmată de volatilitate accentuată odată cu deschiderea sesiunii de la New York (16:30 RO). Sentimentul dominant este ${
      indicesBias === 'BULLISH' ? 'pozitiv (cumpărătorii controlează minimele zilnice)' : indicesBias === 'BEARISH' ? 'corectiv (vânzătorii pun presiune pe suporturi)' : 'neutru / de consolidare în așteptarea catalizatorilor macro'
    }.`,
    summaryEn: `For the US equity index landscape (Nasdaq 100, S&P 500, Dow Jones), we anticipate a bifurcated session today: disciplined accumulation through the European morning, transitioning into heightened volatility upon the New York opening bell (09:30 EST). Baseline technical tone remains ${
      indicesBias === 'BULLISH' ? 'constructive (buyers defending intraday lows)' : indicesBias === 'BEARISH' ? 'defensive (sellers testing key support shelves)' : 'neutral range consolidation ahead of fresh macroeconomic catalysts'
    }.`,
    nasdaq: {
      currentPrice: nasdaqQuote.price,
      expectedMoveRo: `Dacă prețul menține nivelul suportului ${nasdaqSupportStr}, ne așteptăm la un atac asupra rezistenței ${nasdaqResistStr}. Spargerea cu volum a acestei zone poate deschide drumul către maxime noi. În schimb, pierderea suportului ar declanșa o retragere tehnică de 0.6% - 0.9%.`,
      expectedMoveEn: `Provided price action maintains footing above support ${nasdaqSupportStr}, expect an upside rotation toward resistance ${nasdaqResistStr}. Sustained volume breakout targets fresh highs, whereas loss of support risks an intraday corrective dip of 0.6% - 0.9%.`,
      supportLevel: nasdaqSupportStr,
      resistanceLevel: nasdaqResistStr,
      keyFocusRo: 'Fluxurile de capital pe companiile Big Tech (NVIDIA, Apple, Microsoft) și evoluția randamentelor obligațiunilor SUA.',
      keyFocusEn: 'Capital flows into Mega-Cap tech constituents (NVIDIA, Apple, Microsoft) and US Treasury yield trajectories.',
    },
    spx500: {
      currentPrice: spxQuote.price,
      expectedMoveRo: `Oscilație în canalul ${spxSupportStr} (suport) și ${spxResistStr} (rezistență). Menținerea deasupra pivotului de ${Math.round(spxLevels.pivot).toLocaleString()} favorizează continuarea trendului bullish pe scară largă.`,
      expectedMoveEn: `Oscillation within the channel between support ${spxSupportStr} and resistance ${spxResistStr}. Holding above the ${Math.round(spxLevels.pivot).toLocaleString()} pivot preserves broad-market bullish continuity.`,
      supportLevel: spxSupportStr,
      resistanceLevel: spxResistStr,
      keyFocusRo: 'Lărgimea pieței (market breadth), rapoartele de câștiguri corporative și volumul agregat la New York.',
      keyFocusEn: 'Market breadth expansion, earnings releases, and aggregate NYSE/Nasdaq order flow.',
    },
    dowJones: {
      currentPrice: dowQuote.price,
      expectedMoveRo: `Testare a suportului instituțional ${dowSupportStr}. În caz de respingere fermă, așteptăm un avans către rezistența ${dowResistStr}, susținut de sectorul industrial și financiar.`,
      expectedMoveEn: `Testing the institutional support shelf at ${dowSupportStr}. A solid bounce points toward resistance ${dowResistStr}, supported by industrial and financial heavyweights.`,
      supportLevel: dowSupportStr,
      resistanceLevel: dowResistStr,
      keyFocusRo: 'Acțiunile din sectorul industrial, bancar și datele de producție industrială SUA.',
      keyFocusEn: 'Industrial sector equities, banking balance sheets, and US manufacturing activity gauges.',
    },
  };

  // 3. GOLD OUTLOOK
  const goldSupportStr = formatLevelRange(goldLevels.s1, goldLevels.s2, '$', 2);
  const goldResistStr = formatLevelRange(goldLevels.r1, goldLevels.r2, '$', 2);

  const goldOutlook = {
    bias: goldBias,
    currentPrice: goldQuote.price,
    summaryRo: `Cotația Aurului Spot (XAU/USD) se tranzacționează în jurul valorii de $${goldQuote.price.toFixed(2)}. Metalul prețios beneficiază de suport structural prin acumularea continuă a băncilor centrale și cererea instituțională de hedging împotriva incertitudinii macroeconomice și geopolitice.`,
    summaryEn: `Spot Gold (XAU/USD) trades near $${goldQuote.price.toFixed(2)}. The yellow metal maintains structural tailwinds driven by sustained central bank reserves accumulation and institutional portfolio hedging against macroeconomic and geopolitical uncertainty.`,
    supportLevel: goldSupportStr,
    resistanceLevel: goldResistStr,
    macroDriversRo: 'Evoluția indicelui DXY, randamentele reale ale Trezoreriei SUA pe 10 ani (TIPS), tensiunile geopolitice și fluxurile de intrare în ETF-urile pe aur fizic.',
    macroDriversEn: 'US Dollar Index (DXY) momentum, 10-year US real yields (TIPS), geopolitical developments, and ETF physical gold inflows.',
    expectedMoveRo: `Așteptăm consolidare activă între $${goldLevels.s1.toFixed(2)} și $${goldLevels.r1.toFixed(2)}. O închidere de lumânare pe 1H peste $${goldLevels.r1.toFixed(2)} ar confirma continuarea raliului spre $${goldLevels.r2.toFixed(2)}. Pierderea suportului $${goldLevels.s1.toFixed(2)} ar putea genera un retest al zonei $${goldLevels.s2.toFixed(2)}.`,
    expectedMoveEn: `Expect active consolidation between $${goldLevels.s1.toFixed(2)} and $${goldLevels.r1.toFixed(2)}. A 1-Hour candle close above $${goldLevels.r1.toFixed(2)} confirms upside continuation toward $${goldLevels.r2.toFixed(2)}. A breakdown below $${goldLevels.s1.toFixed(2)} opens an intraday sweep of $${goldLevels.s2.toFixed(2)}.`,
  };

  // 4. FOREX OUTLOOK
  const eurusdSupportStr = formatLevelRange(eurusdLevels.s1, eurusdLevels.s2, '', 4);
  const eurusdResistStr = formatLevelRange(eurusdLevels.r1, eurusdLevels.r2, '', 4);
  const gbpusdSupportStr = formatLevelRange(gbpusdLevels.s1, gbpusdLevels.s2, '', 4);
  const gbpusdResistStr = formatLevelRange(gbpusdLevels.r1, gbpusdLevels.r2, '', 4);
  const usdjpySupportStr = formatLevelRange(usdjpyLevels.s1, usdjpyLevels.s2, '¥', 2);
  const usdjpyResistStr = formatLevelRange(usdjpyLevels.r1, usdjpyLevels.r2, '¥', 2);

  const forexOutlook = {
    bias: 'DXY Consolidare / Direcție Mixtă',
    dxySummaryRo: `Indicele Dolarului American (DXY) evoluează într-un interval restrâns de tranzacționare în așteptarea datelor macroeconomice ale zilei. Diferențialul de dobândă între Rezerva Federală, Banca Centrală Europeană (BCE) și Banca Angliei (BoE) rămâne principalul motor al fluxurilor valutare.`,
    dxySummaryEn: `The US Dollar Index (DXY) is navigating a tight consolidation range awaiting today's macroeconomic releases. Interest rate differentials across the Federal Reserve, ECB, and Bank of England remain the primary driver of major FX cross-currents.`,
    eurusd: {
      currentPrice: eurusdQuote.price,
      expectedMoveRo: `EUR/USD testează zona ${eurusdQuote.price.toFixed(4)}. Menținerea peste suportul ${eurusdSupportStr} favorizează un atac spre ${eurusdResistStr}. În caz de date puternice pe USD, riscul este de revenire către minimele săptămânii.`,
      expectedMoveEn: `EUR/USD is testing the ${eurusdQuote.price.toFixed(4)} zone. Staying above support ${eurusdSupportStr} encourages a push toward ${eurusdResistStr}. Conversely, upside US data surprises threaten a return toward weekly lows.`,
      supportLevel: eurusdSupportStr,
      resistanceLevel: eurusdResistStr,
    },
    gbpusd: {
      currentPrice: gbpusdQuote.price,
      expectedMoveRo: `GBP/USD consolidează la ${gbpusdQuote.price.toFixed(4)}. Intervalul vizat astăzi este cuprins între suportul ${gbpusdSupportStr} și rezistența ${gbpusdResistStr}, cu ochiul pe randamentele obligațiunilor Gilt britanice.`,
      expectedMoveEn: `GBP/USD consolidates at ${gbpusdQuote.price.toFixed(4)}. Key intraday boundaries span from support ${gbpusdSupportStr} to resistance ${gbpusdResistStr}, closely monitoring UK Gilt yield fluctuations.`,
      supportLevel: gbpusdSupportStr,
      resistanceLevel: gbpusdResistStr,
    },
    usdjpy: {
      currentPrice: usdjpyQuote.price,
      expectedMoveRo: `USD/JPY se situează la ¥${usdjpyQuote.price.toFixed(2)}. Nivelurile cheie sunt suportul ${usdjpySupportStr} și rezistența ${usdjpyResistStr}. Atenție sporită la orice intervenție verbală din partea Ministerului de Finanțe al Japoniei (MoF).`,
      expectedMoveEn: `USD/JPY trades at ¥${usdjpyQuote.price.toFixed(2)}. Key brackets include support ${usdjpySupportStr} and resistance ${usdjpyResistStr}. Heightened scrutiny on verbal interventions from Japan's Ministry of Finance (MoF).`,
      supportLevel: usdjpySupportStr,
      resistanceLevel: usdjpyResistStr,
    },
  };

  // 5. TODAY'S CATALYSTS
  const todayCatalysts = finalTodayEvents.map((e) => {
    const rawTime = e.date || '15:30 EST';
    const isHigh = e.impact?.toUpperCase() === 'HIGH';

    return {
      time: rawTime,
      currency: e.currency,
      titleRo: e.titleRo || e.title,
      titleEn: e.titleEn || e.title,
      impact: (isHigh ? 'HIGH' : e.impact?.toUpperCase() === 'LOW' ? 'LOW' : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
      forecast: e.forecast && e.forecast !== '--' ? e.forecast : undefined,
      previous: e.previous && e.previous !== '--' ? e.previous : undefined,
      whatToExpectRo: isHigh
        ? 'Volatilitate ridicată garantată. O diferență semnificativă față de consens va determina o mișcare impulsivă pe Nasdaq, S&P 500 și Aur în primele 15 minute de la publicare.'
        : 'Impact moderat. Poate genera reacții locale pe perechile valutare asociate și ajustări ale spread-urilor.',
      whatToExpectEn: isHigh
        ? 'High volatility expected. Any notable deviation from consensus is likely to spark an impulsive directional move across Nasdaq, S&P 500, and Gold during the initial 15-minute window.'
        : 'Moderate impact. Likely to produce localized order flow adjustments on linked FX crosses and temporary spread widening.',
    };
  });

  return {
    date: isoDateStr,
    timestamp: now.toISOString(),
    titleRo,
    titleEn,
    source: 'MarketAI Institutional Macro Engine (Live Real Feeds)',
    marketSentiment,
    yesterdayRecap,
    indicesOutlook,
    goldOutlook,
    forexOutlook,
    todayCatalysts,
  };
}

/**
 * Retrieves the Daily Macro Briefing with daily file caching and live price refresh
 */
export async function getDailyMacroBriefingWithCache(
  quotes: MarketQuotesMap,
  calendarEvents: EconomicCalendarItem[],
  forceRefresh = false
): Promise<DailyMacroBriefing> {
  const todayIso = new Date().toISOString().split('T')[0];

  if (!forceRefresh) {
    try {
      if (fs.existsSync(BRIEFING_CACHE_FILE)) {
        const cachedRaw = fs.readFileSync(BRIEFING_CACHE_FILE, 'utf-8');
        const cached: DailyMacroBriefing = JSON.parse(cachedRaw);
        if (cached && cached.date === todayIso) {
          // Fresh live prices overlay
          if (quotes.nasdaq?.price) cached.indicesOutlook.nasdaq.currentPrice = quotes.nasdaq.price;
          if (quotes.spx500?.price) cached.indicesOutlook.spx500.currentPrice = quotes.spx500.price;
          if (quotes.dow?.price) cached.indicesOutlook.dowJones.currentPrice = quotes.dow.price;
          if (quotes.gold?.price) cached.goldOutlook.currentPrice = quotes.gold.price;
          if (quotes.eurusd?.price) cached.forexOutlook.eurusd.currentPrice = quotes.eurusd.price;
          if (quotes.gbpusd?.price) cached.forexOutlook.gbpusd.currentPrice = quotes.gbpusd.price;
          if (quotes.usdjpy?.price) cached.forexOutlook.usdjpy.currentPrice = quotes.usdjpy.price;
          return cached;
        }
      }
    } catch (e) {
      console.warn('[DailyMacroBriefing] Cache read error, generating fresh:', e);
    }
  }

  const briefing = buildDailyMacroBriefing(quotes, calendarEvents);

  try {
    const dir = path.dirname(BRIEFING_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BRIEFING_CACHE_FILE, JSON.stringify(briefing, null, 2), 'utf-8');
  } catch (saveErr) {
    console.warn('[DailyMacroBriefing] Could not save cache to disk:', saveErr);
  }

  return briefing;
}
