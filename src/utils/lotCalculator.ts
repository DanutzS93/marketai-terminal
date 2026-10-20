import { InstrumentId, CalculatorInstrumentId, MarketQuote } from '../types';

export interface InstrumentSpec {
  id: CalculatorInstrumentId;
  name: string;
  symbol: string;
  category: 'INDICES' | 'METALS' | 'FOREX';
  defaultPrice: number;
  decimals: number;
  pipSize: number; // e.g. 0.0001 for FX, 0.01 for Gold/JPY, 1.0 for indices
  pipLabel: string; // 'pips' | 'pct' | 'pts' | '$'
  contractSize: number; // units per standard lot
  pointValuePerLot: number; // $ value of 1.00 full price move per 1.00 lot
  minLot: number;
  maxLot: number;
  lotStep: number;
  defaultSLDist: number;
  unitLabel: string; // 'Loturi' | 'Contracte' | 'Coins'
  specDescriptionRo: string;
  specDescriptionEn: string;
}

export const INSTRUMENT_SPECS: Record<CalculatorInstrumentId, InstrumentSpec> = {
  NASDAQ: {
    id: 'NASDAQ',
    name: 'Nasdaq 100 CFD (NAS100 / US100)',
    symbol: 'NAS100',
    category: 'INDICES',
    defaultPrice: 21450,
    decimals: 2,
    pipSize: 1.0,
    pipLabel: 'pct',
    contractSize: 1,
    pointValuePerLot: 1.0, // 1 index point = $1.00 on 1.00 CFD lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 100.0,
    unitLabel: 'Loturi CFD (1 unit/lot)',
    specDescriptionRo: '1.00 Lot = 1 Contract Index ($1.00 per 1 punct mișcare)',
    specDescriptionEn: '1.00 Lot = 1 Index Contract ($1.00 per 1 point move)',
  },
  NQ_F: {
    id: 'NQ_F',
    name: 'Nasdaq 100 E-mini Futures (NQ.F)',
    symbol: 'NQ.F',
    category: 'INDICES',
    defaultPrice: 21450,
    decimals: 2,
    pipSize: 0.25,
    pipLabel: 'pct',
    contractSize: 20,
    pointValuePerLot: 20.0, // $20 per point on 1 E-mini contract
    minLot: 1.0,
    maxLot: 50.0,
    lotStep: 1.0,
    defaultSLDist: 50.0,
    unitLabel: 'Contracte E-mini ($20/pt)',
    specDescriptionRo: '1 Contract E-mini = $20.00 per punct (Micro MNQ = $2.00/pt)',
    specDescriptionEn: '1 E-mini Contract = $20.00 per point (Micro MNQ = $2.00/pt)',
  },
  SPX500: {
    id: 'SPX500',
    name: 'S&P 500 CFD (SPX500 / US500)',
    symbol: 'SPX500',
    category: 'INDICES',
    defaultPrice: 5950,
    decimals: 2,
    pipSize: 0.1,
    pipLabel: 'pct',
    contractSize: 1,
    pointValuePerLot: 1.0, // $1.00 per point on 1.00 CFD lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 25.0,
    unitLabel: 'Loturi CFD (1 unit/lot)',
    specDescriptionRo: '1.00 Lot = 1 Contract Index ($1.00 per 1 punct mișcare)',
    specDescriptionEn: '1.00 Lot = 1 Index Contract ($1.00 per 1 point move)',
  },
  ES_F: {
    id: 'ES_F',
    name: 'S&P 500 E-mini Futures (ES.F)',
    symbol: 'ES.F',
    category: 'INDICES',
    defaultPrice: 5950,
    decimals: 2,
    pipSize: 0.25,
    pipLabel: 'pct',
    contractSize: 50,
    pointValuePerLot: 50.0, // $50 per point on 1 ES contract
    minLot: 1.0,
    maxLot: 50.0,
    lotStep: 1.0,
    defaultSLDist: 15.0,
    unitLabel: 'Contracte E-mini ($50/pt)',
    specDescriptionRo: '1 Contract E-mini = $50.00 per punct (Micro MES = $5.00/pt)',
    specDescriptionEn: '1 E-mini Contract = $50.00 per point (Micro MES = $5.00/pt)',
  },
  DOW_JONES: {
    id: 'DOW_JONES',
    name: 'Dow Jones 30 (US30 / DJ30)',
    symbol: 'US30',
    category: 'INDICES',
    defaultPrice: 43800,
    decimals: 1,
    pipSize: 1.0,
    pipLabel: 'pct',
    contractSize: 1,
    pointValuePerLot: 1.0, // $1.00 per point on 1.00 CFD lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 150.0,
    unitLabel: 'Loturi CFD (1 unit/lot)',
    specDescriptionRo: '1.00 Lot = 1 Contract Index ($1.00 per 1 punct mișcare)',
    specDescriptionEn: '1.00 Lot = 1 Index Contract ($1.00 per 1 point move)',
  },
  GOLD: {
    id: 'GOLD',
    name: 'Gold Spot (XAU/USD)',
    symbol: 'XAU/USD',
    category: 'METALS',
    defaultPrice: 2915,
    decimals: 2,
    pipSize: 0.01,
    pipLabel: '$',
    contractSize: 100, // 100 troy ounces
    pointValuePerLot: 100.0, // $1.00 price move = $100 on 1.00 lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 15.0,
    unitLabel: 'Loturi Standard (100 oz)',
    specDescriptionRo: '1.00 Lot = 100 uncii ($1.00 mișcare = $100 profit/pierdere | $1.00 per 0.01 lot)',
    specDescriptionEn: '1.00 Lot = 100 oz ($1.00 price move = $100 PnL | $1.00 per 0.01 lot)',
  },
  GC_F: {
    id: 'GC_F',
    name: 'Gold Futures (GC.F)',
    symbol: 'GC.F',
    category: 'METALS',
    defaultPrice: 2915,
    decimals: 2,
    pipSize: 0.1,
    pipLabel: '$',
    contractSize: 100,
    pointValuePerLot: 100.0,
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 15.0,
    unitLabel: 'Contracte Futures (100 oz)',
    specDescriptionRo: '1 Contract = 100 uncii ($1.00 mișcare = $100)',
    specDescriptionEn: '1 Contract = 100 oz ($1.00 move = $100)',
  },
  EURUSD: {
    id: 'EURUSD',
    name: 'EUR/USD (Euro / US Dollar)',
    symbol: 'EUR/USD',
    category: 'FOREX',
    defaultPrice: 1.085,
    decimals: 5,
    pipSize: 0.0001,
    pipLabel: 'pips',
    contractSize: 100000,
    pointValuePerLot: 100000.0, // 1 pip (0.0001) = $10 on 1.00 lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 0.0025, // 25 pips
    unitLabel: 'Loturi Forex (100k €)',
    specDescriptionRo: '1.00 Lot = 100,000 € (1 Pip = 0.0001 = $10.00 per lot)',
    specDescriptionEn: '1.00 Lot = 100,000 € (1 Pip = 0.0001 = $10.00 per lot)',
  },
  GBPUSD: {
    id: 'GBPUSD',
    name: 'GBP/USD (British Pound / US Dollar)',
    symbol: 'GBP/USD',
    category: 'FOREX',
    defaultPrice: 1.295,
    decimals: 5,
    pipSize: 0.0001,
    pipLabel: 'pips',
    contractSize: 100000,
    pointValuePerLot: 100000.0, // 1 pip (0.0001) = $10 on 1.00 lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 0.0035, // 35 pips
    unitLabel: 'Loturi Forex (100k £)',
    specDescriptionRo: '1.00 Lot = 100,000 £ (1 Pip = 0.0001 = $10.00 per lot)',
    specDescriptionEn: '1.00 Lot = 100,000 £ (1 Pip = 0.0001 = $10.00 per lot)',
  },
  USDJPY: {
    id: 'USDJPY',
    name: 'USD/JPY (US Dollar / Japanese Yen)',
    symbol: 'USD/JPY',
    category: 'FOREX',
    defaultPrice: 154.5,
    decimals: 3,
    pipSize: 0.01,
    pipLabel: 'pips',
    contractSize: 100000,
    pointValuePerLot: 100000.0 / 154.5, // ~647 USD per 100 JPY
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    defaultSLDist: 0.35, // 35 pips
    unitLabel: 'Loturi Forex (100k $)',
    specDescriptionRo: '1.00 Lot = 100,000 $ (1 Pip = 0.01 ≈ $6.50 per lot)',
    specDescriptionEn: '1.00 Lot = 100,000 $ (1 Pip = 0.01 ≈ $6.50 per lot)',
  },
};

export interface PositionCalculationResult {
  dollarRisk: number;
  priceDistance: number;
  distanceInPips: number;
  pipUnit: string;
  calculatedLots: number;
  roundedLots: number;
  notionalValue: number;
  requiredMargin: number;
  freeMargin: number;
  marginLevelPercent: number;
  maxLeverageLots: number;
  isMarginExceeded: boolean;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  tp1Profit: number;
  tp2Profit: number;
  tp3Profit: number;
  lossAtSL: number;
}

export function calculatePositionMetrics({
  instrumentId,
  accountBalance,
  equity,
  riskPercent,
  entryPrice,
  stopLossPrice,
  leverage = 100,
  quotes,
}: {
  instrumentId: CalculatorInstrumentId;
  accountBalance: number;
  equity?: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  leverage: number;
  quotes?: Record<InstrumentId, MarketQuote> | Record<string, MarketQuote>;
}): PositionCalculationResult {
  const spec = INSTRUMENT_SPECS[instrumentId] || INSTRUMENT_SPECS.NASDAQ;
  const activeEquity = equity ?? accountBalance;
  const safeLeverage = Math.max(1, leverage);

  const dollarRisk = (accountBalance * riskPercent) / 100;
  const priceDistance = Math.abs(entryPrice - stopLossPrice);
  const isZeroDistance = priceDistance <= 0.000001;

  // Calculate distance in pips/points
  const distanceInPips = isZeroDistance ? 0 : priceDistance / (spec.pipSize || 1);

  // Dynamic point value per lot
  let pointValue = spec.pointValuePerLot;
  if (instrumentId === 'USDJPY' && entryPrice > 0) {
    pointValue = 100000 / entryPrice;
  }

  // Exact lot size formula: DollarRisk / (PriceDistance * PointValuePerLot)
  let calculatedLots = 0;
  if (!isZeroDistance && pointValue > 0) {
    calculatedLots = dollarRisk / (priceDistance * pointValue);
  }

  // Clamping and standard MT5 rounding (to lotStep, usually 2 decimals)
  let roundedLots = 0;
  if (calculatedLots > 0) {
    const steps = Math.floor(calculatedLots / spec.lotStep);
    roundedLots = Number((steps * spec.lotStep).toFixed(2));
    if (roundedLots < spec.minLot && calculatedLots > 0) {
      roundedLots = spec.minLot;
    }
  }

  // Notional Position Value in USD: Lots * ContractSize * EntryPrice
  let notionalValue = 0;
  if (instrumentId === 'EURUSD') {
    notionalValue = roundedLots * spec.contractSize * entryPrice;
  } else if (instrumentId === 'GBPUSD') {
    notionalValue = roundedLots * spec.contractSize * entryPrice;
  } else if (instrumentId === 'USDJPY') {
    notionalValue = roundedLots * spec.contractSize;
  } else if (instrumentId === 'GOLD' || instrumentId === 'GC_F') {
    notionalValue = roundedLots * spec.contractSize * entryPrice;
  } else {
    // CFD Indices
    notionalValue = roundedLots * spec.contractSize * entryPrice;
  }

  // Required Margin = Notional Value / Leverage
  const requiredMargin = notionalValue / safeLeverage;
  const freeMargin = activeEquity - requiredMargin;
  const marginLevelPercent = requiredMargin > 0 ? (activeEquity / requiredMargin) * 100 : 9999;
  const isMarginExceeded = requiredMargin > activeEquity;

  // Max lots allowable under leverage
  const maxNotional = activeEquity * safeLeverage;
  const singleLotNotional = spec.contractSize * entryPrice;
  const maxLeverageLots = singleLotNotional > 0 ? Number((maxNotional / singleLotNotional).toFixed(2)) : 0;

  // Target prices and profits
  const isLong = entryPrice >= stopLossPrice;
  const tp1Price = isLong ? entryPrice + priceDistance * 1.5 : entryPrice - priceDistance * 1.5;
  const tp2Price = isLong ? entryPrice + priceDistance * 2.5 : entryPrice - priceDistance * 2.5;
  const tp3Price = isLong ? entryPrice + priceDistance * 3.5 : entryPrice - priceDistance * 3.5;

  const actualLots = roundedLots > 0 ? roundedLots : calculatedLots;
  const lossAtSL = actualLots * priceDistance * pointValue;
  const tp1Profit = actualLots * (priceDistance * 1.5) * pointValue;
  const tp2Profit = actualLots * (priceDistance * 2.5) * pointValue;
  const tp3Profit = actualLots * (priceDistance * 3.5) * pointValue;

  return {
    dollarRisk,
    priceDistance,
    distanceInPips,
    pipUnit: spec.pipLabel,
    calculatedLots,
    roundedLots,
    notionalValue,
    requiredMargin,
    freeMargin,
    marginLevelPercent,
    maxLeverageLots,
    isMarginExceeded,
    tp1Price: Number(tp1Price.toFixed(spec.decimals)),
    tp2Price: Number(tp2Price.toFixed(spec.decimals)),
    tp3Price: Number(tp3Price.toFixed(spec.decimals)),
    tp1Profit,
    tp2Profit,
    tp3Profit,
    lossAtSL,
  };
}

export interface TrailingStopParityConversion {
  instrumentId: InstrumentId;
  name: string;
  symbol: string;
  category: 'INDICES' | 'METALS' | 'FOREX';
  price: number;
  points: number;            // Converted points/distance in native unit
  unitLabel: string;         // 'pts' | '$' | 'pips'
  displayValue: string;      // e.g. "50.0 pts" | "$6.80" | "25.3 pips"
  secondaryDetail: string;   // e.g. "200 ticks • $1,000/ct" or "680 pts MT5"
  percentMove: number;       // % distance of price
  isOverridden: boolean;     // whether user manually changed this specific parity
  mt5Points: number;         // MT5 points
  ticks?: number;            // Futures ticks
  dollarValuePerUnit: number;// PnL impact per standard lot / contract
}

export interface TrailingStopConversionResult {
  baseAsset: InstrumentId;
  basePoints: number;
  basePercent: number;
  conversions: Record<InstrumentId, TrailingStopParityConversion>;
  pointsMap: Record<InstrumentId, number>;
}

export function calculateTrailingStopConversions(params: {
  baseAsset: InstrumentId;
  basePoints: number;
  quotes?: Record<string, MarketQuote>;
  customOverrides?: Partial<Record<InstrumentId, number>>;
}): TrailingStopConversionResult {
  const { baseAsset, basePoints, quotes, customOverrides = {} } = params;
  const safeBaseAsset: InstrumentId = INSTRUMENT_SPECS[baseAsset] ? baseAsset : 'NASDAQ';
  const baseSpec = INSTRUMENT_SPECS[safeBaseAsset];
  const safeBasePoints = Math.max(0.1, Number(basePoints) || 50);

  const baseQuote = quotes ? quotes[safeBaseAsset] : undefined;
  const basePrice = baseQuote && baseQuote.price > 0 ? baseQuote.price : baseSpec.defaultPrice;

  // Convert basePoints to absolute price distance
  let basePriceDistance = safeBasePoints;
  if (safeBaseAsset === 'EURUSD' || safeBaseAsset === 'GBPUSD') {
    basePriceDistance = safeBasePoints * 0.0001;
  } else if (safeBaseAsset === 'USDJPY') {
    basePriceDistance = safeBasePoints * 0.01;
  }

  // Calculate percentage volatility/distance
  const basePercent = basePrice > 0 ? (basePriceDistance / basePrice) * 100 : 0.233;

  const conversions: Partial<Record<InstrumentId, TrailingStopParityConversion>> = {};
  const pointsMap: Partial<Record<InstrumentId, number>> = {};

  const allKeys = Object.keys(INSTRUMENT_SPECS) as InstrumentId[];

  for (const id of allKeys) {
    const spec = INSTRUMENT_SPECS[id];
    const liveQ = quotes ? quotes[id] : undefined;
    const price = liveQ && liveQ.price > 0 ? liveQ.price : spec.defaultPrice;

    const hasOverride = customOverrides[id] !== undefined && customOverrides[id] !== null;
    let convertedPoints: number;

    if (hasOverride) {
      convertedPoints = Math.max(0.1, Number(customOverrides[id]));
    } else if (id === safeBaseAsset) {
      convertedPoints = safeBasePoints;
    } else {
      // Calculate equivalent price distance for this instrument
      const targetPriceDist = price * (basePercent / 100);

      if (id === 'EURUSD' || id === 'GBPUSD') {
        convertedPoints = Number((targetPriceDist / 0.0001).toFixed(1));
      } else if (id === 'USDJPY') {
        convertedPoints = Number((targetPriceDist / 0.01).toFixed(1));
      } else if (id === 'GOLD' || id === 'GC_F') {
        convertedPoints = Number(targetPriceDist.toFixed(2));
      } else if (id === 'NQ_F' || id === 'ES_F') {
        convertedPoints = Number((Math.round(targetPriceDist / 0.25) * 0.25).toFixed(2));
      } else if (id === 'SPX500' || id === 'DOW_JONES' || id === 'NASDAQ') {
        convertedPoints = Number(targetPriceDist.toFixed(1));
      } else {
        convertedPoints = Number(targetPriceDist.toFixed(spec.decimals));
      }
    }

    let unitLabel = 'pts';
    let displayValue = `${convertedPoints} pts`;
    let secondaryDetail = '';
    let mt5Points = Math.round(convertedPoints);
    let ticks: number | undefined;
    let dollarValuePerUnit = convertedPoints * spec.pointValuePerLot;

    if (id === 'NASDAQ') {
      unitLabel = 'pts';
      displayValue = `${convertedPoints.toFixed(1)} pts`;
      mt5Points = Math.round(convertedPoints * (spec.decimals === 2 ? 100 : 1));
      dollarValuePerUnit = convertedPoints * 1.0;
      secondaryDetail = `$${dollarValuePerUnit.toFixed(1)} / lot CFD`;
    } else if (id === 'NQ_F') {
      unitLabel = 'pts';
      ticks = Math.round(convertedPoints / 0.25);
      dollarValuePerUnit = convertedPoints * 20.0;
      displayValue = `${convertedPoints.toFixed(2)} pts`;
      secondaryDetail = `${ticks} ticks • $${dollarValuePerUnit.toFixed(0)} / ct`;
    } else if (id === 'SPX500') {
      unitLabel = 'pts';
      displayValue = `${convertedPoints.toFixed(1)} pts`;
      mt5Points = Math.round(convertedPoints * (spec.decimals === 2 ? 100 : 1));
      dollarValuePerUnit = convertedPoints * 1.0;
      secondaryDetail = `$${dollarValuePerUnit.toFixed(1)} / lot CFD`;
    } else if (id === 'ES_F') {
      unitLabel = 'pts';
      ticks = Math.round(convertedPoints / 0.25);
      dollarValuePerUnit = convertedPoints * 50.0;
      displayValue = `${convertedPoints.toFixed(2)} pts`;
      secondaryDetail = `${ticks} ticks • $${dollarValuePerUnit.toFixed(0)} / ct`;
    } else if (id === 'DOW_JONES') {
      unitLabel = 'pts';
      displayValue = `${convertedPoints.toFixed(1)} pts`;
      mt5Points = Math.round(convertedPoints * 10);
      dollarValuePerUnit = convertedPoints * 1.0;
      secondaryDetail = `$${dollarValuePerUnit.toFixed(1)} / lot CFD`;
    } else if (id === 'GOLD') {
      unitLabel = '$';
      const pips = convertedPoints * 10;
      mt5Points = Math.round(convertedPoints * 100);
      dollarValuePerUnit = convertedPoints * 100.0;
      displayValue = `$${convertedPoints.toFixed(2)}`;
      secondaryDetail = `${pips.toFixed(1)} pips • ${mt5Points} pts MT5 ($${dollarValuePerUnit.toFixed(0)}/lot)`;
    } else if (id === 'GC_F') {
      unitLabel = '$';
      ticks = Math.round(convertedPoints / 0.10);
      dollarValuePerUnit = convertedPoints * 100.0;
      displayValue = `$${convertedPoints.toFixed(2)}`;
      secondaryDetail = `${ticks} ticks • $${dollarValuePerUnit.toFixed(0)} / ct`;
    } else if (id === 'EURUSD' || id === 'GBPUSD') {
      unitLabel = 'pips';
      mt5Points = Math.round(convertedPoints * 10);
      dollarValuePerUnit = convertedPoints * 10.0;
      displayValue = `${convertedPoints.toFixed(1)} pips`;
      secondaryDetail = `${mt5Points} pts MT5 • $${dollarValuePerUnit.toFixed(1)}/lot`;
    } else if (id === 'USDJPY') {
      unitLabel = 'pips';
      mt5Points = Math.round(convertedPoints * 10);
      dollarValuePerUnit = convertedPoints * (1000 / (price || 154.5));
      displayValue = `${convertedPoints.toFixed(1)} pips`;
      secondaryDetail = `${mt5Points} pts MT5 • ~$${dollarValuePerUnit.toFixed(1)}/lot`;
    }

    let actualPriceDist = convertedPoints;
    if (id === 'EURUSD' || id === 'GBPUSD') actualPriceDist = convertedPoints * 0.0001;
    else if (id === 'USDJPY') actualPriceDist = convertedPoints * 0.01;
    const percentMove = price > 0 ? (actualPriceDist / price) * 100 : basePercent;

    conversions[id] = {
      instrumentId: id,
      name: spec.name,
      symbol: spec.symbol,
      category: spec.category,
      price,
      points: convertedPoints,
      unitLabel,
      displayValue,
      secondaryDetail,
      percentMove,
      isOverridden: hasOverride,
      mt5Points,
      ticks,
      dollarValuePerUnit,
    };

    pointsMap[id] = convertedPoints;
  }

  return {
    baseAsset: safeBaseAsset,
    basePoints: safeBasePoints,
    basePercent,
    conversions: conversions as Record<InstrumentId, TrailingStopParityConversion>,
    pointsMap: pointsMap as Record<InstrumentId, number>,
  };
}
