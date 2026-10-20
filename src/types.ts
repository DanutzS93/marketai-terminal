export type InstrumentId =
  | 'NASDAQ'
  | 'SPX500'
  | 'DOW_JONES'
  | 'GOLD'
  | 'NQ_F'
  | 'ES_F'
  | 'GC_F'
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY';

export type CalculatorInstrumentId = InstrumentId;

export type TimeFrame = '5m' | '15m' | '1h' | '4h' | '1D';

export type SignalType = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export type ExecutionType =
  | 'BUY MARKET'
  | 'SELL MARKET'
  | 'BUY LIMIT'
  | 'SELL LIMIT'
  | 'BUY STOP'
  | 'SELL STOP'
  | 'Market Execution'
  | 'Buy Limit'
  | 'Sell Limit'
  | 'Buy Stop'
  | 'Sell Stop';

export interface OrderValidationResult {
  isValid: boolean;
  orderType: 'BUY MARKET' | 'SELL MARKET' | 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP';
  errorRo?: string;
  errorEn?: string;
  ruleExplanationRo: string;
  ruleExplanationEn: string;
}

export interface MarketQuote {
  id: InstrumentId;
  symbol: string;
  name: string;
  tradingViewSymbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: string;
  source: 'LSE' | 'WebSocket Live Stream' | 'Yahoo Finance' | 'Live Market Feed';
  timestamp: string;
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  ema20: number;
  sma50: number;
  sma200: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  atr?: number;
}

export interface CustomSignalRule {
  id?: string;
  instrumentId: InstrumentId;
  timeframe: TimeFrame;
  rsiCondition?: 'OVERSOLD_30' | 'OVERBOUGHT_70' | 'CROSS_ABOVE_50' | 'CROSS_BELOW_50' | 'CUSTOM' | 'NONE';
  rsiCustomValue?: number;
  maCondition?: 'PRICE_ABOVE_EMA20' | 'PRICE_BELOW_EMA20' | 'PRICE_ABOVE_SMA50' | 'PRICE_ABOVE_SMA200' | 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'NONE';
  macdCondition?: 'HISTOGRAM_POSITIVE' | 'HISTOGRAM_NEGATIVE' | 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NONE';
  priceLevelCondition?: 'BREAKOUT_RESISTANCE' | 'PULLBACK_SUPPORT' | 'CUSTOM_TARGET' | 'NONE';
  customPriceLevel?: number;
  riskRewardTarget?: string;
  notes?: string;
}

export interface TradingSignal {
  id: string;
  instrumentId: InstrumentId;
  instrumentName: string;
  symbol: string;
  type: SignalType;
  executionType?: ExecutionType;
  currentMarketPrice?: number;
  timeframe: TimeFrame;
  entryPrice: number;
  entryRangeMin: number;
  entryRangeMax: number;
  stopLoss: number;
  targetPrice1: number;
  targetPrice2: number;
  targetPrice3: number;
  riskRewardRatio: string;
  confidencePercent: number;
  status: 'ACTIVE' | 'TARGET_HIT' | 'EXPIRED' | 'CANCELLED';
  outcomeStatus?: 'PENDING' | 'RUNNING' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | 'CANCELLED' | 'ACTIVE';
  firstHitMilestone?: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'ENTRY' | 'PENDING' | 'CANCELLED';
  isBeHitAfterTp1?: boolean;
  isBeHitAfterTp2?: boolean;
  isEntryTriggered?: boolean;
  mt5Placed?: boolean;
  mt5PlacedAt?: string;
  ninjaTraderPlaced?: boolean;
  ninjaTraderPlacedAt?: string;
  pnl?: number;
  accountSource?: 'MT5' | 'NINJATRADER' | 'SIM' | 'AUTO';
  cancelReason?: string;
  cancelReasonRo?: string;
  cancelReasonEn?: string;
  title: string;
  titleRo?: string;
  titleEn?: string;
  summary: string;
  summaryRo?: string;
  summaryEn?: string;
  rationale: string;
  rationaleRo?: string;
  rationaleEn?: string;
  keyLevels: {
    resistance: number[];
    support: number[];
    poc?: number;
    val?: number;
    vah?: number;
  };
  orderFlow?: {
    delta: number;
    deltaStatus: 'BULLISH_ABSORPTION' | 'BEARISH_ABSORPTION' | 'STRONG_BUY_IMBALANCE' | 'STRONG_SELL_IMBALANCE' | 'NEUTRAL_ACCUMULATION';
    buyVolumePercent: number;
    sellVolumePercent: number;
    imbalanceType: 'BUY_SIDE_STACKED' | 'SELL_SIDE_STACKED' | 'BALANCED_LIQUIDITY';
    institutionalPressure: 'HIGH_BUYING' | 'HIGH_SELLING' | 'BALANCED';
    absorptionLevel?: number;
  };
  indicators: {
    rsiStatus: string;
    macdStatus: string;
    movingAverages: string;
    volatility: string;
  };
  macroFactors: string[];
  atr?: number;
  atrDaily?: number;
  atrMultiplierSL?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AIAnalysisResponse {
  timestamp: string;
  marketOverview: string;
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signals: TradingSignal[];
  macroEvents: {
    title: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
  }[];
}

export interface UserApiKeys {
  geminiApiKey?: string;
  lseKey?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  createdAt: string;
  token?: string;
  inviteCodeUsed?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'blocked';
  subscriptionExpiresAt?: string;
  subscriptionDaysLeft?: number;
  accountBalance?: number;
  equity?: number;
  leverage?: number;
  mt5AccountNumber?: string | number;
  mt5AccountServer?: string;
  mt5AccountCurrency?: string;
  mt5AccountCompany?: string;
  mt5LastConnectedAt?: string;
  mt5ApiKey?: string;
  ninjaTraderAccountNumber?: string | number;
  ninjaTraderAccountName?: string;
  ninjaTraderAccountCurrency?: string;
  ninjaTraderLastConnectedAt?: string;
  ninjaTraderApiKey?: string;
  apiKeys?: {
    mt5ApiKey?: string;
    ninjaTraderApiKey?: string;
    geminiApiKey?: string;
    lseKey?: string;
  };
  riskSettings?: {
    riskPerTrade?: number;
    maxDailyLoss?: number;
    dailyProfitTarget?: number;
    maxTradesPerDay?: number;
    maxTradesPerSymbol?: number;
    minSignalScore?: number;
    minRiskReward?: number;
    tp1ScaleOut?: number;
    autoBreakEven?: boolean;
    trailingStop?: boolean;
    trailingStopPoints?: number;
    trailingStopBaseAsset?: InstrumentId;
    trailingStopPointsPerAsset?: Partial<Record<InstrumentId, number>>;
    trailingStopCustomOverrides?: Partial<Record<InstrumentId, number>>;
    leverage?: number;
  };
  tradeJournal?: TradeJournalEntry[];
}

export interface TradeJournalEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  time?: string; // "15:30"
  instrumentId: InstrumentId | string;
  symbol: string;
  instrumentName?: string;
  direction: 'BUY' | 'SELL';
  executionType?: string;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit?: number;
  rrAchieved: number; // e.g. 2.5, -1.0, 0
  pnl?: number; // Realized P&L in USD / currency
  lotSize?: number;
  status: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'RUNNING';
  outcomeLabel?: string; // "TP1 Hit", "TP2 Hit", "SL Hit", "Manual Exit", "BE Hit"
  setup?: string; // "ICT Silver Bullet", "Fair Value Gap (FVG)", "Order Block", "Trend Following", "Scalp"
  notes?: string;
  timeframe?: string;
  linkedSignalId?: string;
  isManual?: boolean;
  generatedAt?: string; // Exact ISO timestamp when trade was generated / opened
  entryDate?: string; // Date of generation / entry "YYYY-MM-DD"
  entryTime?: string; // Hour of generation / entry "HH:mm"
  exitDate?: string; // Date when trade was closed
  exitTime?: string; // Hour when trade was closed / profit marked
  closedAt?: string; // ISO timestamp when trade closed / profit marked
  createdAt: string;
  updatedAt?: string;
}

export interface InviteCodeItem {
  code: string;
  createdByName?: string;
  createdAt: string;
  usesCount: number;
  maxUses?: number;
  validityDays?: number;
  expiresAt?: string;
  isActive?: boolean;
  note?: string;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
}

