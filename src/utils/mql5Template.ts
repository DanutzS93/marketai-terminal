export const MT5_EA_VERSION = '4.72';

export function getMql5EaCode(
  mt5Endpoint: string,
  mt5UpdateEndpoint: string,
  apiKey: string,
  currentOrigin: string
): string {
  return `//+------------------------------------------------------------------+
//|                                         MarketAI_MT5_Bridge.mq5 |
//|                                  Copyright 2026, MarketAI Signals |
//|                                             https://ai.studio     |
//+------------------------------------------------------------------+
#property copyright "MarketAI Signals"
#property link      "https://ai.studio"
#property version   "${MT5_EA_VERSION}"
#property description "MarketAI MT5 Auto-Trading Bridge v${MT5_EA_VERSION} with Hybrid GET/POST Engine & Exact Broker PnL Sync"

#include <Trade\\Trade.mqh>
CTrade trade;

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+
input group "=== [1] Web API & Connection Settings ==="
input string   InpEndpointURL           = "${mt5Endpoint}";
input string   InpUpdateURL             = "${mt5UpdateEndpoint}";
input string   InpApiKey                = "${apiKey}"; // Cheia MT5 API Personalizata (Asigura izolarea 100% per utilizator)
input string   InpBrokerSymbol          = "";             // Custom broker symbol (e.g. EURUSD.pro, XAUUSD, NAS100, leave blank for chart symbol)
input int      InpMagicNumber           = 26082026;       // EA Magic Number
input int      InpCheckInterval         = 4;              // Check interval in seconds

input group "=== [2] Dynamic Web Risk Synchronization ==="
input bool     InpSyncRiskRulesFromWeb  = true;           // Auto-sync risk rules dynamically from MarketAI Web Panel

input group "=== [3] Risk Management & Lot Sizing ==="
input bool     InpUseDynamicLot         = true;           // Calculate Lot Size based on % Risk per trade
input double   InpRiskPercent           = 1.0;            // Risk percentage per trade (% of Balance)
input double   InpDefaultLotSize        = 0.10;           // Fixed / Fallback Lot Size if dynamic calculation unavailable

input group "=== [4] Daily Risk Guards (Prop Firm / Account Safety) ==="
input double   InpMaxDailyLoss          = 3000.0;         // Max Daily Loss ($) - Halts trading when reached
input double   InpDailyProfitTarget     = 5000.0;         // Daily Profit Target ($) - Locks profits when reached (0 to disable)
input int      InpMaxTradesPerDay       = 50;             // Max Trades allowed per calendar day
input int      InpMaxTradesPerSymbol    = 50;             // Max Concurrent trades per symbol

input group "=== [5] Position Management & Smart Trailing ==="
input bool     InpAutoBreakEven         = true;           // Auto move SL to Break-Even (+2 pts) & close 70% at TP1
input bool     InpSmartTrailingStop     = false;          // Dynamic Trailing Stop to lock in running trend profits
input int      InpTrailTriggerPoints    = 150;            // Points in profit required to activate Trailing Stop
input int      InpTrailDistancePoints   = 200;            // Distance in points behind current price to trail SL
input int      InpTrailStepPoints       = 50;             // Step in points before moving SL again

//+------------------------------------------------------------------+
//| RUNTIME STATE VARIABLES                                          |
//+------------------------------------------------------------------+
string processedSignalIds[];
string activeSignalId = "";
double activeTp1 = 0;
double activeTp2 = 0;
double activeTp3 = 0;
bool   tp1Hit = false;
bool   tp2Hit = false;

struct TrackedTrade {
   string signalId;
   ulong  positionId;
   ulong  positionTicket;
   string symbol;
   long   posType;
   double openPrice;
   double volume;
   bool   tp1Hit;
   bool   tp2Hit;
   bool   isClosed;
   double finalPnl;
   datetime openTime;
};
TrackedTrade trackedTrades[];

// Effective Live Risk Rules (can be overridden by Web API in real-time)
double liveRiskPercent        = 1.0;
double liveMaxDailyLoss       = 3000.0;
double liveDailyProfitTarget  = 5000.0;
int    liveMaxTradesPerDay    = 50;
int    liveMaxTradesPerSymbol = 50;
bool   liveAutoBreakEven      = false;
bool   liveTrailingStop       = false;
int    liveTrailDistancePoints = InpTrailDistancePoints;
int    liveMinConfidence      = 75;

datetime lastSyncTime         = 0;
string   lastGuardStatus      = "NORMAL";

//+------------------------------------------------------------------+
//| Helper: Check if signal was already processed                    |
//+------------------------------------------------------------------+
bool IsSignalProcessed(string sigId)
{
   if(sigId == "") return true;
   for(int i = 0; i < ArraySize(processedSignalIds); i++)
   {
      if(processedSignalIds[i] == sigId) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Helper: Mark signal as processed                                 |
//+------------------------------------------------------------------+
void MarkSignalAsProcessed(string sigId)
{
   if(sigId == "" || IsSignalProcessed(sigId)) return;
   int size = ArraySize(processedSignalIds);
   ArrayResize(processedSignalIds, size + 1);
   processedSignalIds[size] = sigId;
}

//+------------------------------------------------------------------+
//| Helper: Setup trade filling mode for symbol                      |
//+------------------------------------------------------------------+
void SetupTradeFillingMode(string sym)
{
   uint filling = (uint)SymbolInfoInteger(sym, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) != 0)
      trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if((filling & SYMBOL_FILLING_IOC) != 0)
      trade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      trade.SetTypeFilling(ORDER_FILLING_RETURN);
}

//+------------------------------------------------------------------+
//| Symbol Matching Helper                                           |
//+------------------------------------------------------------------+
bool DoSymbolsMatch(string chartSym, string sigSym)
{
   if(chartSym == "" || sigSym == "") return true;
   string c = chartSym;
   string s = sigSym;
   StringToUpper(c);
   StringToUpper(s);
   
   // --- STRICT SEPARATION: GOLD SPOT (XAUUSD) vs GOLD FUTURES (GC.F / XAUUSDft) ---
   bool sigIsGoldFutures = (StringFind(s, "GC") != -1 || StringFind(s, "MGC") != -1 || ((StringFind(s, "GOLD") != -1 || StringFind(s, "XAU") != -1) && (StringFind(s, "FT") != -1 || StringFind(s, "FUT") != -1 || StringFind(s, ".F") != -1 || StringFind(s, "_F") != -1)));
   bool chartIsGoldFutures = (StringFind(c, "GC") != -1 || StringFind(c, "MGC") != -1 || ((StringFind(c, "GOLD") != -1 || StringFind(c, "XAU") != -1) && (StringFind(c, "FT") != -1 || StringFind(c, "FUT") != -1 || StringFind(c, ".F") != -1 || StringFind(c, "_F") != -1)));

   bool sigIsGoldSpot = (!sigIsGoldFutures && (StringFind(s, "XAU") != -1 || StringFind(s, "GOLD") != -1));
   bool chartIsGoldSpot = (!chartIsGoldFutures && (StringFind(c, "XAU") != -1 || StringFind(c, "GOLD") != -1));

   if(sigIsGoldFutures) return chartIsGoldFutures;
   if(sigIsGoldSpot)    return chartIsGoldSpot;

   // --- STRICT SEPARATION: NASDAQ SPOT (NAS100/US100/USTEC) vs NASDAQ FUTURES (NQ.F/NQ/NAS100ft) ---
   bool sigIsNasFutures = (StringFind(s, "NQ") != -1 || StringFind(s, "MNQ") != -1 || ((StringFind(s, "NAS") != -1 || StringFind(s, "US100") != -1 || StringFind(s, "USTEC") != -1 || StringFind(s, "NDX") != -1) && (StringFind(s, "FT") != -1 || StringFind(s, "FUT") != -1 || StringFind(s, ".F") != -1 || StringFind(s, "_F") != -1)));
   bool chartIsNasFutures = (StringFind(c, "NQ") != -1 || StringFind(c, "MNQ") != -1 || ((StringFind(c, "NAS") != -1 || StringFind(c, "US100") != -1 || StringFind(c, "USTEC") != -1 || StringFind(c, "NDX") != -1) && (StringFind(c, "FT") != -1 || StringFind(c, "FUT") != -1 || StringFind(c, ".F") != -1 || StringFind(c, "_F") != -1)));

   bool sigIsNasSpot = (!sigIsNasFutures && (StringFind(s, "NAS") != -1 || StringFind(s, "US100") != -1 || StringFind(s, "USTEC") != -1 || StringFind(s, "NDX") != -1));
   bool chartIsNasSpot = (!chartIsNasFutures && (StringFind(c, "NAS") != -1 || StringFind(c, "US100") != -1 || StringFind(c, "USTEC") != -1 || StringFind(c, "NDX") != -1));

   if(sigIsNasFutures) return chartIsNasFutures;
   if(sigIsNasSpot)    return chartIsNasSpot;

   // --- STRICT SEPARATION: SPX500 SPOT (SPX500/US500/SP500) vs S&P 500 FUTURES (ES.F/ES/US500ft) ---
   bool sigIsSpxFutures = (StringFind(s, "ES") != -1 || StringFind(s, "MES") != -1 || ((StringFind(s, "SPX") != -1 || StringFind(s, "US500") != -1 || StringFind(s, "SP500") != -1) && (StringFind(s, "FT") != -1 || StringFind(s, "FUT") != -1 || StringFind(s, ".F") != -1 || StringFind(s, "_F") != -1)));
   bool chartIsSpxFutures = (StringFind(c, "ES") != -1 || StringFind(c, "MES") != -1 || ((StringFind(c, "SPX") != -1 || StringFind(c, "US500") != -1 || StringFind(c, "SP500") != -1) && (StringFind(c, "FT") != -1 || StringFind(c, "FUT") != -1 || StringFind(c, ".F") != -1 || StringFind(c, "_F") != -1)));

   bool sigIsSpxSpot = (!sigIsSpxFutures && (StringFind(s, "SPX") != -1 || StringFind(s, "US500") != -1 || StringFind(s, "SP500") != -1));
   bool chartIsSpxSpot = (!chartIsSpxFutures && (StringFind(c, "SPX") != -1 || StringFind(c, "US500") != -1 || StringFind(c, "SP500") != -1));

   if(sigIsSpxFutures) return chartIsSpxFutures;
   if(sigIsSpxSpot)    return chartIsSpxSpot;

   // --- STRICT SEPARATION: DOW JONES SPOT (US30/DJ30/DOW) vs DOW JONES FUTURES (YM.F/YM/DJ30ft) ---
   bool sigIsDowFutures = (StringFind(s, "YM") != -1 || StringFind(s, "MYM") != -1 || ((StringFind(s, "US30") != -1 || StringFind(s, "DJ30") != -1 || StringFind(s, "DOW") != -1 || StringFind(s, "WS30") != -1) && (StringFind(s, "FT") != -1 || StringFind(s, "FUT") != -1 || StringFind(s, ".F") != -1 || StringFind(s, "_F") != -1)));
   bool chartIsDowFutures = (StringFind(c, "YM") != -1 || StringFind(c, "MYM") != -1 || ((StringFind(c, "US30") != -1 || StringFind(c, "DJ30") != -1 || StringFind(c, "DOW") != -1 || StringFind(c, "WS30") != -1) && (StringFind(c, "FT") != -1 || StringFind(c, "FUT") != -1 || StringFind(c, ".F") != -1 || StringFind(c, "_F") != -1)));

   bool sigIsDowSpot = (!sigIsDowFutures && (StringFind(s, "US30") != -1 || StringFind(s, "DJ30") != -1 || StringFind(s, "DOW") != -1 || StringFind(s, "WS30") != -1));
   bool chartIsDowSpot = (!chartIsDowFutures && (StringFind(c, "US30") != -1 || StringFind(c, "DJ30") != -1 || StringFind(c, "DOW") != -1 || StringFind(c, "WS30") != -1));

   if(sigIsDowFutures) return chartIsDowFutures;
   if(sigIsDowSpot)    return chartIsDowSpot;

   if(c == s || StringFind(c, s) != -1 || StringFind(s, c) != -1) return true;
   
   // Forex Pairs Matching
   if(StringFind(s, "EURUSD") != -1 && StringFind(c, "EURUSD") != -1) return true;
   if(StringFind(s, "GBPUSD") != -1 && StringFind(c, "GBPUSD") != -1) return true;
   if(StringFind(s, "USDJPY") != -1 && StringFind(c, "USDJPY") != -1) return true;
   if(StringFind(s, "EUR/USD") != -1 && StringFind(c, "EURUSD") != -1) return true;
   if(StringFind(s, "GBP/USD") != -1 && StringFind(c, "GBPUSD") != -1) return true;
   if(StringFind(s, "USD/JPY") != -1 && StringFind(c, "USDJPY") != -1) return true;
   
   // Dow Jones
   if((StringFind(s, "US30") != -1 || StringFind(s, "DOW") != -1) && (StringFind(c, "US30") != -1 || StringFind(c, "DJ30") != -1 || StringFind(c, "WS30") != -1 || StringFind(c, "DOW") != -1)) return true;
   
   return false;
}

//+------------------------------------------------------------------+
//| Simple JSON value extractor helper                               |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key)
{
   int pos = StringFind(json, "\\"" + key + "\\":");
   if(pos == -1) return "";
   int start = pos + StringLen(key) + 3;
   if(start >= StringLen(json)) return "";
   
   // Skip any spaces, tabs, carriage returns or newlines after the colon
   while(start < StringLen(json))
   {
      ushort ws = StringGetCharacter(json, start);
      if(ws != ' ' && ws != '\\t' && ws != '\\r' && ws != '\\n') break;
      start++;
   }
   if(start >= StringLen(json)) return "";
   
   if(StringGetCharacter(json, start) == '\\"')
   {
      start++;
      int end = StringFind(json, "\\"", start);
      if(end == -1) return "";
      return StringSubstr(json, start, end - start);
   }
   else
   {
      int end = start;
      while(end < StringLen(json))
      {
         ushort ch = StringGetCharacter(json, end);
         if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\\t' || ch == '\\n' || ch == '\\r') break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }
}

//+------------------------------------------------------------------+
//| Extract Nested JSON object value                                 |
//+------------------------------------------------------------------+
string ExtractJsonNestedValue(string json, string parentKey, string key)
{
   int pPos = StringFind(json, "\\"" + parentKey + "\\":");
   if(pPos == -1) return "";
   int bStart = StringFind(json, "{", pPos);
   if(bStart == -1) return "";
   int bEnd = StringFind(json, "}", bStart);
   if(bEnd == -1) return "";
   
   string subJson = StringSubstr(json, bStart, bEnd - bStart + 1);
   return ExtractJsonValue(subJson, key);
}

//+------------------------------------------------------------------+
//| Dynamic Timeframe-calibrated Minimum Safe SL Distance            |
//+------------------------------------------------------------------+
double GetMinimumSafeSLDistance(string sym, string tf, double currentPrice)
{
   string s = sym;
   StringToUpper(s);
   string t = tf;
   StringToLower(t);
   
   // Dow Jones (US30, DJ30, WS30, YM)
   if(StringFind(s, "US30") != -1 || StringFind(s, "DJ30") != -1 || StringFind(s, "DOW") != -1 || StringFind(s, "WS30") != -1 || StringFind(s, "YM") != -1)
   {
      if(t == "1m")  return 35.0;
      if(t == "5m")  return 70.0;
      if(t == "15m") return 140.0;
      if(t == "1h")  return 280.0;
      if(t == "4h")  return 520.0;
      return 850.0;
   }
   
   // Nasdaq (NAS100, US100, USTEC, NQ)
   if(StringFind(s, "NAS") != -1 || StringFind(s, "US100") != -1 || StringFind(s, "USTEC") != -1 || StringFind(s, "NQ") != -1)
   {
      if(t == "1m")  return 22.0;
      if(t == "5m")  return 45.0;
      if(t == "15m") return 90.0;
      if(t == "1h")  return 180.0;
      if(t == "4h")  return 340.0;
      return 550.0;
   }
   
   // Gold (XAUUSD, GOLD, GC)
   if(StringFind(s, "XAU") != -1 || StringFind(s, "GOLD") != -1 || StringFind(s, "GC") != -1)
   {
      if(t == "1m")  return 2.2;
      if(t == "5m")  return 4.5;
      if(t == "15m") return 8.5;
      if(t == "1h")  return 18.0;
      if(t == "4h")  return 35.0;
      return 60.0;
   }
   
   // S&P 500 (SPX500, US500, ES)
   if(StringFind(s, "SPX") != -1 || StringFind(s, "US500") != -1 || StringFind(s, "ES") != -1)
   {
      if(t == "1m")  return 5.0;
      if(t == "5m")  return 10.0;
      if(t == "15m") return 18.0;
      if(t == "1h")  return 38.0;
      if(t == "4h")  return 70.0;
      return 120.0;
   }
   
   // Forex EUR/USD, GBP/USD
   if(StringFind(s, "EUR") != -1 || StringFind(s, "GBP") != -1)
   {
      if(t == "1m")  return 0.0007;
      if(t == "5m")  return 0.0013;
      if(t == "15m") return 0.0022;
      if(t == "1h")  return 0.0045;
      if(t == "4h")  return 0.0080;
      return 0.0140;
   }
   
   // Forex USD/JPY
   if(StringFind(s, "JPY") != -1)
   {
      if(t == "1m")  return 0.08;
      if(t == "5m")  return 0.16;
      if(t == "15m") return 0.30;
      if(t == "1h")  return 0.60;
      if(t == "4h")  return 1.10;
      return 1.80;
   }
   
   double fallbackPct = 0.0025;
   if(t == "1m")  fallbackPct = 0.0008;
   if(t == "5m")  fallbackPct = 0.0015;
   if(t == "15m") fallbackPct = 0.0025;
   if(t == "1h")  fallbackPct = 0.0055;
   if(t == "4h")  fallbackPct = 0.0100;
   if(t == "1d")  fallbackPct = 0.0160;
   
   return (currentPrice > 0 ? currentPrice : 1000.0) * fallbackPct;
}

//+------------------------------------------------------------------+
//| Calculate dynamic lot size based on % risk & distance to SL      |
//+------------------------------------------------------------------+
double CalculateLotSize(string sym, double entryPrice, double slPrice, double riskPct)
{
   if(!InpUseDynamicLot || riskPct <= 0 || slPrice <= 0 || entryPrice <= 0)
   {
      return InpDefaultLotSize;
   }
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance <= 0) balance = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0) return InpDefaultLotSize;
   
   double dollarRisk = balance * (riskPct / 100.0);
   
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   double minLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double stepLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   
   if(point <= 0 || tickSize <= 0 || tickValue <= 0 || stepLot <= 0)
   {
      return InpDefaultLotSize;
   }
   
   double slDistPoints = MathAbs(entryPrice - slPrice) / point;
   if(slDistPoints <= 0) return InpDefaultLotSize;
   
   // Risk per 1.0 standard lot
   double riskPerLot = slDistPoints * (tickValue / (tickSize / point));
   if(riskPerLot <= 0) return InpDefaultLotSize;
   
   double calculatedLot = dollarRisk / riskPerLot;
   
   // Align to broker lot step
   calculatedLot = MathFloor(calculatedLot / stepLot) * stepLot;
   
   // Clamp within broker limits
   if(calculatedLot < minLot) calculatedLot = minLot;
   if(calculatedLot > maxLot) calculatedLot = maxLot;
   
   return NormalizeDouble(calculatedLot, 2);
}

//+------------------------------------------------------------------+
//| Calculate Today's Closed P&L and Trade Counts                    |
//+------------------------------------------------------------------+
void GetTodayStats(double &todayProfit, int &todayTradesCount)
{
   todayProfit = 0.0;
   todayTradesCount = 0;
   
   datetime startOfDay = iTime(_Symbol, PERIOD_D1, 0);
   datetime now = TimeCurrent();
   
   if(HistorySelect(startOfDay, now))
   {
      int dealsTotal = HistoryDealsTotal();
      for(int i = 0; i < dealsTotal; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            if(magic == InpMagicNumber || InpMagicNumber == 0)
            {
               long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
               if(entryType == DEAL_ENTRY_IN)
               {
                  todayTradesCount++;
               }
               if(entryType == DEAL_ENTRY_OUT || entryType == DEAL_ENTRY_INOUT)
               {
                  todayProfit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
                  todayProfit += HistoryDealGetDouble(ticket, DEAL_SWAP);
                  todayProfit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
               }
            }
         }
      }
   }
   
   // Add floating profit/loss of currently open positions
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         todayProfit += PositionGetDouble(POSITION_PROFIT);
         todayProfit += PositionGetDouble(POSITION_SWAP);
      }
   }
}

//+------------------------------------------------------------------+
//| Get active trades count on a specific symbol                     |
//+------------------------------------------------------------------+
int GetSymbolActiveCount(string sym)
{
   int count = 0;
   
   // Count open positions
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber && PositionGetString(POSITION_SYMBOL) == sym)
      {
         count++;
      }
   }
   
   // Count pending orders
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber && OrderGetString(ORDER_SYMBOL) == sym)
      {
         count++;
      }
   }
   
   return count;
}

//+------------------------------------------------------------------+
//| Check if risk parameters allow opening a new trade               |
//+------------------------------------------------------------------+
bool CheckRiskAllowed(string sym, string &reason)
{
   double todayProfit = 0;
   int todayTradesCount = 0;
   GetTodayStats(todayProfit, todayTradesCount);
   
   // 1. Max Daily Loss Guard
   if(liveMaxDailyLoss > 0 && todayProfit <= -liveMaxDailyLoss)
   {
      reason = "DAILY LOSS LIMIT HIT: P&L is $" + DoubleToString(todayProfit, 2) + " (Max Loss: -$" + DoubleToString(liveMaxDailyLoss, 2) + ")";
      lastGuardStatus = "DAILY LOSS LIMIT LOCKED";
      return false;
   }
   
   // 2. Daily Profit Target Guard
   if(liveDailyProfitTarget > 0 && todayProfit >= liveDailyProfitTarget)
   {
      reason = "DAILY PROFIT TARGET SECURED: P&L is +$" + DoubleToString(todayProfit, 2) + " (Target: +$" + DoubleToString(liveDailyProfitTarget, 2) + ")";
      lastGuardStatus = "DAILY TARGET HIT - PROFITS SECURED";
      return false;
   }
   
   // 3. Max Trades Per Day Guard
   if(liveMaxTradesPerDay > 0 && todayTradesCount >= liveMaxTradesPerDay)
   {
      reason = "MAX TRADES PER DAY REACHED (" + IntegerToString(todayTradesCount) + " / " + IntegerToString(liveMaxTradesPerDay) + ")";
      lastGuardStatus = "MAX TRADES/DAY REACHED";
      return false;
   }
   
   // 4. Max Trades Per Symbol Guard
   int symCount = GetSymbolActiveCount(sym);
   if(liveMaxTradesPerSymbol > 0 && symCount >= liveMaxTradesPerSymbol)
   {
      reason = "MAX TRADES FOR SYMBOL " + sym + " REACHED (" + IntegerToString(symCount) + " / " + IntegerToString(liveMaxTradesPerSymbol) + ")";
      return false;
   }
   
   lastGuardStatus = "ACTIVE & MONITORING";
   return true;
}

//+------------------------------------------------------------------+
//| Update Risk Rules dynamically from Web API JSON response         |
//+------------------------------------------------------------------+
void UpdateRiskRulesFromJson(string json)
{
   if(!InpSyncRiskRulesFromWeb) return;
   
   string riskPerTradeStr = ExtractJsonNestedValue(json, "riskRules", "riskPerTrade");
   if(riskPerTradeStr != "") liveRiskPercent = StringToDouble(riskPerTradeStr);
   
   string maxDailyLossStr = ExtractJsonNestedValue(json, "riskRules", "maxDailyLoss");
   if(maxDailyLossStr != "") liveMaxDailyLoss = StringToDouble(maxDailyLossStr);
   
   string dailyProfitTargetStr = ExtractJsonNestedValue(json, "riskRules", "dailyProfitTarget");
   if(dailyProfitTargetStr != "") liveDailyProfitTarget = StringToDouble(dailyProfitTargetStr);
   
   string maxTradesPerDayStr = ExtractJsonNestedValue(json, "riskRules", "maxTradesPerDay");
   if(maxTradesPerDayStr != "") liveMaxTradesPerDay = (int)StringToInteger(maxTradesPerDayStr);
   
   string maxTradesPerSymbolStr = ExtractJsonNestedValue(json, "riskRules", "maxTradesPerSymbol");
   if(maxTradesPerSymbolStr != "") liveMaxTradesPerSymbol = (int)StringToInteger(maxTradesPerSymbolStr);
   
   string autoBreakEvenStr = ExtractJsonNestedValue(json, "riskRules", "autoBreakEven");
   if(autoBreakEvenStr != "") liveAutoBreakEven = (autoBreakEvenStr == "true");
   
   string trailingStopStr = ExtractJsonNestedValue(json, "riskRules", "trailingStop");
   if(trailingStopStr != "") liveTrailingStop = (trailingStopStr == "true");

   string targetSymbol = (InpBrokerSymbol != "") ? InpBrokerSymbol : _Symbol;
   string symUp = targetSymbol;
   StringToUpper(symUp);
   
   string assetSpecificPoints = "";
   if(StringFind(symUp, "XAU") >= 0 || StringFind(symUp, "GOLD") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.GOLD");
   else if(StringFind(symUp, "NAS") >= 0 || StringFind(symUp, "USTEC") >= 0 || StringFind(symUp, "100") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.NASDAQ");
   else if(StringFind(symUp, "SPX") >= 0 || StringFind(symUp, "US500") >= 0 || StringFind(symUp, "ES") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.SPX500");
   else if(StringFind(symUp, "US30") >= 0 || StringFind(symUp, "DJ") >= 0 || StringFind(symUp, "DOW") >= 0 || StringFind(symUp, "YM") >= 0)
   {
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.YM_F");
      if(assetSpecificPoints == "")
         assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.DOW_JONES");
   }
   else if(StringFind(symUp, "EURUSD") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.EURUSD");
   else if(StringFind(symUp, "GBPUSD") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.GBPUSD");
   else if(StringFind(symUp, "USDJPY") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.USDJPY");

   if(assetSpecificPoints != "")
   {
      double ptsVal = StringToDouble(assetSpecificPoints);
      if(StringFind(symUp, "XAU") >= 0 || StringFind(symUp, "GOLD") >= 0)
         liveTrailDistancePoints = (int)MathRound(ptsVal * 100);
      else if(StringFind(symUp, "EURUSD") >= 0 || StringFind(symUp, "GBPUSD") >= 0 || StringFind(symUp, "USDJPY") >= 0)
         liveTrailDistancePoints = (int)MathRound(ptsVal * 10);
      else
         liveTrailDistancePoints = (int)MathRound(ptsVal);
   }
   else
   {
      string trailingStopPointsStr = ExtractJsonNestedValue(json, "riskRules", "trailingStopPoints");
      if(trailingStopPointsStr != "") liveTrailDistancePoints = (int)StringToInteger(trailingStopPointsStr);
   }
   
   lastSyncTime = TimeCurrent();
}

//+------------------------------------------------------------------+
//| Update On-Chart HUD Display                                      |
//+------------------------------------------------------------------+
void UpdateChartHUD()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   double todayProfit = 0;
   int todayTrades = 0;
   GetTodayStats(todayProfit, todayTrades);
   
   string targetSymbol = (InpBrokerSymbol != "") ? InpBrokerSymbol : _Symbol;
   int symTrades = GetSymbolActiveCount(targetSymbol);
   
   string hud = "=======================================================\\n" +
                "  MarketAI Signals MT5 Bridge v" + "${MT5_EA_VERSION}" + " (Real PnL Sync Engine)  \\n" +
                "=======================================================\\n" +
                " Connected Account : #" + IntegerToString(login) + " (" + serverName + ")\\n" +
                " Balance / Equity   : $" + DoubleToString(balance, 2) + " / $" + DoubleToString(equity, 2) + "\\n" +
                "-------------------------------------------------------\\n" +
                " Today's Net P&L   : " + (todayProfit >= 0 ? "+$" : "-$") + DoubleToString(MathAbs(todayProfit), 2) + "\\n" +
                " Max Daily Loss    : -$" + DoubleToString(liveMaxDailyLoss, 2) + "\\n" +
                " Daily Profit Target: +$" + DoubleToString(liveDailyProfitTarget, 2) + "\\n" +
                " Trades Today      : " + IntegerToString(todayTrades) + " / " + IntegerToString(liveMaxTradesPerDay) + " Max\\n" +
                " Symbol Positions  : " + IntegerToString(symTrades) + " / " + IntegerToString(liveMaxTradesPerSymbol) + " Max (" + targetSymbol + ")\\n" +
                " Risk Per Trade    : " + DoubleToString(liveRiskPercent, 1) + "% (" + (InpUseDynamicLot ? "Dynamic Lot Size" : "Fixed Lot") + ")\\n" +
                " Auto Break-Even   : " + (liveAutoBreakEven ? "ACTIV (Inchide 70% & SL la BE la TP1)" : "DEZACTIVAT") + "\\n" +
                " Smart Trailing    : " + (liveTrailingStop ? "ACTIVE" : "DISABLED") + "\\n" +
                "-------------------------------------------------------\\n" +
                " Guard Status      : [" + lastGuardStatus + "]\\n" +
                " Web Sync Status   : " + (InpSyncRiskRulesFromWeb ? "LIVE REAL-TIME SYNC" : "OFFLINE / LOCAL INPUTS") + "\\n" +
                "=======================================================";
   
   Comment(hud);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagicNumber);
   
   // Initialize live rules with input values
   liveRiskPercent        = InpRiskPercent;
   liveMaxDailyLoss       = InpMaxDailyLoss;
   liveDailyProfitTarget  = InpDailyProfitTarget;
   liveMaxTradesPerDay    = InpMaxTradesPerDay;
   liveMaxTradesPerSymbol = InpMaxTradesPerSymbol;
   liveAutoBreakEven      = InpAutoBreakEven;
   liveTrailingStop       = InpSmartTrailingStop;

   string targetSymbol = (InpBrokerSymbol != "") ? InpBrokerSymbol : _Symbol;
   SetupTradeFillingMode(targetSymbol);
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   Print("MarketAI MT5 Bridge v", "${MT5_EA_VERSION}", " initialized with Exact Broker PnL Engine. Target Symbol: ", targetSymbol, " Magic: ", InpMagicNumber, " Connected Account: #", login, " (", serverName, ") [", company, "]");
   
   if(StringFind(InpEndpointURL, "onrender.com") >= 0 || StringFind(InpUpdateURL, "onrender.com") >= 0 || (StringFind(InpEndpointURL, "fly.dev") < 0 && StringFind(InpEndpointURL, "localhost") < 0))
   {
      Print("[MarketAI OK] Conexiunea a fost redirectionata automat catre serverul activ Fly.dev: ${currentOrigin} !");
   }
   
   // Register any existing open positions and sync historical closed trades from MT5
   RegisterOpenPositions();
   SyncClosedHistoricalTrades();
   
   // Send immediate initial sync on startup
   SendAccountSync();
   UpdateChartHUD();
   
   EventSetTimer(InpCheckInterval);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
   Print("MarketAI MT5 Bridge v", "${MT5_EA_VERSION}", " stopped.");
}

//+------------------------------------------------------------------+
//| TradeTransaction function: triggers instantly on any deal/fill   |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      CheckAndReportTrackedTrades();
      SendAccountSync();
      UpdateChartHUD();
   }
}

//+------------------------------------------------------------------+
//| Expert timer function (polls Web API and manages positions)      |
//+------------------------------------------------------------------+
void OnTimer()
{
   static int syncCounter = 0;
   syncCounter++;

   FetchAndExecuteSignals();
   ManageActivePositions();
   CheckAndReportTrackedTrades();

   // Sync historical closed trades periodically every ~24 seconds
   if(syncCounter % 6 == 0)
   {
      SyncClosedHistoricalTrades();
   }

   SendAccountSync();
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Helpers for cleaning credentials, URL encoding and HTTPS         |
//+------------------------------------------------------------------+
string GetCleanApiKey()
{
   string k = InpApiKey;
   StringTrimLeft(k);
   StringTrimRight(k);
   StringReplace(k, "\\\"", "");
   StringReplace(k, "'", "");
   StringReplace(k, " ", "");
   return k;
}

string UrlEncodeParam(string text)
{
   string s = text;
   StringReplace(s, "#", "%23");
   StringReplace(s, "+", "%2B");
   StringReplace(s, " ", "%20");
   StringReplace(s, "&", "%26");
   return s;
}

string ForceHttps(string rawUrl)
{
   string u = rawUrl;
   if(StringFind(u, "http://") == 0)
   {
      u = "https://" + StringSubstr(u, 7);
   }
   return u;
}

//+------------------------------------------------------------------+
//| Send account balance, equity & login info to MarketAI            |
//+------------------------------------------------------------------+
void SendAccountSync()
{
   uchar data[];
   uchar result[];
   string result_headers;
   string cleanKey = GetCleanApiKey();
   string headers = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n\\r\\n";
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   string payload = "{\\"accountNumber\\":\\"" + IntegerToString(login) + "\\",\\"accountServer\\":\\"" + serverName + "\\",\\"accountCurrency\\":\\"" + currency + "\\",\\"accountCompany\\":\\"" + company + "\\",\\"accountBalance\\":" + DoubleToString(balance, 2) + ",\\"equity\\":" + DoubleToString(equity, 2) + "}";
   ArrayResize(data, StringLen(payload));
   StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   
   string origin = ForceHttps("${currentOrigin}");
   string accountURL = origin + "/api/mt5/account?apiKey=" + cleanKey;
   int res = WebRequest("POST", accountURL, headers, 10000, data, result, result_headers);
   if(res == -1)
   {
      int err = GetLastError();
      static datetime lastAccErr = 0;
      if(TimeCurrent() - lastAccErr > 60)
      {
         if(err == 4014 || err == 4060)
            Print("[MarketAI EROARE ", err, "] URL-ul '", origin, "' NU este autorizat in MT5! Adaugati '", origin, "' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
         lastAccErr = TimeCurrent();
      }
   }
}

//+------------------------------------------------------------------+
//| Extract signal ID from order or deal comment                     |
//+------------------------------------------------------------------+
string ExtractSignalIdFromText(string text)
{
   if(text == "") return "";
   int p = StringFind(text, "sig_");
   if(p == -1) p = StringFind(text, "SIG_");
   if(p == -1) p = StringFind(text, "SIG-");
   if(p == -1) p = StringFind(text, "sig-");
   if(p != -1)
   {
      string sub = StringSubstr(text, p);
      int len = StringLen(sub);
      for(int i = 0; i < len; i++)
      {
         ushort c = StringGetCharacter(sub, i);
         if(c == ' ' || c == ';' || c == ',' || c == ')' || c == ']' || c == '\\"' || c == '\\r' || c == '\\n')
         {
            return StringSubstr(sub, 0, i);
         }
      }
      return sub;
   }
   if(StringFind(text, "MarketAI ") == 0)
   {
      return StringSubstr(text, 9);
   }
   return "";
}

//+------------------------------------------------------------------+
//| Calculate exact cumulative realized P&L for a position ticket    |
//| Sums profit, swap, commission across all entry and exit deals    |
//+------------------------------------------------------------------+
double GetRealizedProfitForPosition(ulong posId, double &lastExitPrice)
{
   double totalProfit = 0.0;
   lastExitPrice = 0.0;
   
   if(HistorySelect(0, TimeCurrent() + 86400))
   {
      int dealsTotal = HistoryDealsTotal();
      for(int i = 0; i < dealsTotal; i++)
      {
         ulong dealTicket = HistoryDealGetTicket(i);
         if(dealTicket > 0)
         {
            long dealPosId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
            if(dealPosId == (long)posId)
            {
               long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
               if(entryType == DEAL_ENTRY_OUT || entryType == DEAL_ENTRY_INOUT)
               {
                  totalProfit += HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
                  totalProfit += HistoryDealGetDouble(dealTicket, DEAL_SWAP);
                  totalProfit += HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
                  totalProfit += HistoryDealGetDouble(dealTicket, DEAL_FEE);
                  lastExitPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
               }
               else if(entryType == DEAL_ENTRY_IN)
               {
                  totalProfit += HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
                  totalProfit += HistoryDealGetDouble(dealTicket, DEAL_FEE);
               }
            }
         }
      }
   }
   return NormalizeDouble(totalProfit, 2);
}

//+------------------------------------------------------------------+
//| Send trade execution, update & realized P&L to MarketAI Web API  |
//+------------------------------------------------------------------+
void SendTradeUpdate(string signalId, string status, string outcome, string milestone, double pnl = 0.0, double exitPrice = 0.0)
{
   if(signalId == "") return;
   
   uchar data[];
   uchar result[];
   string result_headers;
   string cleanKey = GetCleanApiKey();
   string headers = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n\\r\\n";
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   string exitPriceJson = "";
   if(exitPrice > 0.0)
   {
      exitPriceJson = ",\\"exitPrice\\":" + DoubleToString(exitPrice, 5);
   }
   
   string payload = "{\\"signal_id\\":\\"" + signalId + "\\"," +
                    "\\"status\\":\\"" + status + "\\"," +
                    "\\"outcomeStatus\\":\\"" + outcome + "\\"," +
                    "\\"milestone\\":\\"" + milestone + "\\"," +
                    "\\"pnl\\":" + DoubleToString(pnl, 2) + "," +
                    "\\"profit\\":" + DoubleToString(pnl, 2) + exitPriceJson + "," +
                    "\\"accountNumber\\":\\"" + IntegerToString(login) + "\\"," +
                    "\\"accountServer\\":\\"" + serverName + "\\"," +
                    "\\"accountCurrency\\":\\"" + currency + "\\"," +
                    "\\"accountCompany\\":\\"" + company + "\\"," +
                    "\\"accountBalance\\":" + DoubleToString(balance, 2) + "," +
                    "\\"equity\\":" + DoubleToString(equity, 2) + "}";
                    
   ArrayResize(data, StringLen(payload));
   StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   
   string updateURL = InpUpdateURL;
   if(StringFind(updateURL, "onrender.com") >= 0 || updateURL == "" || (StringFind(updateURL, "fly.dev") < 0 && StringFind(updateURL, "localhost") < 0))
   {
      updateURL = "${mt5UpdateEndpoint}";
   }
   updateURL = ForceHttps(updateURL);
   if(StringFind(updateURL, "?") < 0) updateURL = updateURL + "?apiKey=" + cleanKey;
   else updateURL = updateURL + "&apiKey=" + cleanKey;

   int res = WebRequest("POST", updateURL, headers, 10000, data, result, result_headers);
   if(res == 200)
   {
      Print("[MarketAI] Status & Realized PnL updated for signal ", signalId, " -> ", milestone, " | PnL: $", DoubleToString(pnl, 2), (exitPrice > 0 ? (" @ " + DoubleToString(exitPrice, 2)) : ""));
   }
   else if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014 || err == 4060)
         Print("[MarketAI EROARE ", err, "] URL-ul '", "${currentOrigin}", "' NU este autorizat in MT5! Adaugati '", "${currentOrigin}", "' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
   }
}

// Backward compatibility wrapper
void SendStatusUpdate(string signalId, string status, string outcome, string milestone)
{
   SendTradeUpdate(signalId, status, outcome, milestone, 0.0, 0.0);
}

//+------------------------------------------------------------------+
//| Register or update tracked signal trade in memory                |
//+------------------------------------------------------------------+
void RegisterTrackedTrade(string sigId, ulong posTicket, ulong posId, string sym, long pType, double oPrice, double vol)
{
   if(sigId == "" || posId == 0) return;
   for(int i = 0; i < ArraySize(trackedTrades); i++)
   {
      if(trackedTrades[i].positionId == posId || trackedTrades[i].signalId == sigId)
      {
         trackedTrades[i].positionTicket = posTicket;
         trackedTrades[i].positionId = posId;
         trackedTrades[i].signalId = sigId;
         trackedTrades[i].symbol = sym;
         trackedTrades[i].posType = pType;
         trackedTrades[i].openPrice = oPrice;
         trackedTrades[i].volume = vol;
         return;
      }
   }
   int sz = ArraySize(trackedTrades);
   ArrayResize(trackedTrades, sz + 1);
   trackedTrades[sz].signalId = sigId;
   trackedTrades[sz].positionId = posId;
   trackedTrades[sz].positionTicket = posTicket;
   trackedTrades[sz].symbol = sym;
   trackedTrades[sz].posType = pType;
   trackedTrades[sz].openPrice = oPrice;
   trackedTrades[sz].volume = vol;
   trackedTrades[sz].tp1Hit = false;
   trackedTrades[sz].tp2Hit = false;
   trackedTrades[sz].isClosed = false;
   trackedTrades[sz].finalPnl = 0.0;
   trackedTrades[sz].openTime = TimeCurrent();
}

//+------------------------------------------------------------------+
//| Scan and register currently open MT5 positions for this EA       |
//+------------------------------------------------------------------+
void RegisterOpenPositions()
{
   for(int p = PositionsTotal() - 1; p >= 0; p--)
   {
      ulong t = PositionGetTicket(p);
      if(t > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         string comm = PositionGetString(POSITION_COMMENT);
         string sigId = ExtractSignalIdFromText(comm);
         if(sigId != "")
         {
            ulong posId = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
            string sym = PositionGetString(POSITION_SYMBOL);
            long pType = PositionGetInteger(POSITION_TYPE);
            double oPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double vol = PositionGetDouble(POSITION_VOLUME);
            RegisterTrackedTrade(sigId, t, posId, sym, pType, oPrice, vol);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Check tracked positions and report closed trades immediately     |
//+------------------------------------------------------------------+
void CheckAndReportTrackedTrades()
{
   for(int i = 0; i < ArraySize(trackedTrades); i++)
   {
      if(trackedTrades[i].isClosed) continue;
      
      ulong posId = trackedTrades[i].positionId;
      bool stillOpen = false;
      
      for(int p = PositionsTotal() - 1; p >= 0; p--)
      {
         ulong pTicket = PositionGetTicket(p);
         if(pTicket > 0)
         {
            ulong pId = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
            if(pId == posId || pTicket == trackedTrades[i].positionTicket)
            {
               stillOpen = true;
               break;
            }
         }
      }
      
      if(!stillOpen)
      {
         // Position is closed in MT5!
         double exitPrice = 0.0;
         double realPnl = GetRealizedProfitForPosition(posId, exitPrice);
         trackedTrades[i].isClosed = true;
         trackedTrades[i].finalPnl = realPnl;
         
         string outcome = (realPnl > 0.01) ? "TP1_HIT" : ((realPnl < -0.01) ? "SL_HIT" : "BREAKEVEN");
         if(trackedTrades[i].tp2Hit && realPnl > 0.01) outcome = "TP2_HIT";
         
         Print("[MarketAI] Trade closed in MT5 for Signal ", trackedTrades[i].signalId, " (Pos #", posId, ")! Realized PnL: $", DoubleToString(realPnl, 2), " Exit Price: ", exitPrice);
         SendTradeUpdate(trackedTrades[i].signalId, "CLOSED", outcome, "POSITION_CLOSED", realPnl, exitPrice);
         
         if(activeSignalId == trackedTrades[i].signalId)
         {
            activeSignalId = "";
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Historical Deals Scanner: Synchronize closed trades from MT5     |
//+------------------------------------------------------------------+
void SyncClosedHistoricalTrades()
{
   // Select past 30 days of trade history
   datetime fromTime = TimeCurrent() - (30 * 86400);
   if(HistorySelect(fromTime, TimeCurrent() + 86400))
   {
      int dealsTotal = HistoryDealsTotal();
      long syncedPosIds[];
      
      for(int i = dealsTotal - 1; i >= 0; i--)
      {
         ulong dealTicket = HistoryDealGetTicket(i);
         if(dealTicket > 0)
         {
            long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
            if(magic == InpMagicNumber || InpMagicNumber == 0)
            {
               string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
               string sigId = ExtractSignalIdFromText(comment);
               
               if(sigId == "")
               {
                  ulong ordTicket = (ulong)HistoryDealGetInteger(dealTicket, DEAL_ORDER);
                  if(HistoryOrderSelect(ordTicket))
                  {
                     sigId = ExtractSignalIdFromText(HistoryOrderGetString(ordTicket, ORDER_COMMENT));
                  }
               }
               
               long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
               if(sigId != "" && posId > 0)
               {
                  bool already = false;
                  for(int k = 0; k < ArraySize(syncedPosIds); k++)
                  {
                     if(syncedPosIds[k] == posId) { already = true; break; }
                  }
                  if(already) continue;
                  
                  int sz = ArraySize(syncedPosIds);
                  ArrayResize(syncedPosIds, sz + 1);
                  syncedPosIds[sz] = posId;
                  
                  // Verify if currently open
                  bool isOpen = false;
                  for(int p = PositionsTotal() - 1; p >= 0; p--)
                  {
                     ulong pTicket = PositionGetTicket(p);
                     if(pTicket > 0 && (ulong)PositionGetInteger(POSITION_IDENTIFIER) == (ulong)posId)
                     {
                        isOpen = true;
                        break;
                     }
                  }
                  
                  if(!isOpen)
                  {
                     double exitPrice = 0.0;
                     double realPnl = GetRealizedProfitForPosition((ulong)posId, exitPrice);
                     string outcome = (realPnl > 0.01) ? "TP1_HIT" : ((realPnl < -0.01) ? "SL_HIT" : "BREAKEVEN");
                     
                     SendTradeUpdate(sigId, "CLOSED", outcome, "HISTORICAL_SYNC", realPnl, exitPrice);
                  }
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Fetch signals from Web API, parse Risk Rules & Execute           |
//+------------------------------------------------------------------+
void FetchAndExecuteSignals()
{
   string targetSymbol = (InpBrokerSymbol != "") ? InpBrokerSymbol : _Symbol;

   // Diagnostic check for Algo Trading permissions in MT5
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      static datetime lastAlgoWarn = 0;
      if(TimeCurrent() - lastAlgoWarn > 60)
      {
         Print("[MarketAI ATENTIE] 'Algo Trading' este DEZACTIVAT in bara de sus din MT5! Apasati butonul 'Algo Trading' (sa devina verde) pentru a permite executarea tranzactiilor.");
         lastAlgoWarn = TimeCurrent();
      }
   }
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      static datetime lastMqlWarn = 0;
      if(TimeCurrent() - lastMqlWarn > 60)
      {
         Print("[MarketAI ATENTIE] Optiunea 'Allow Algo Trading' nu este bifata in setarile EA-ului! Apasati F7 -> Common -> bifati 'Allow Algo Trading'.");
         lastMqlWarn = TimeCurrent();
      }
   }

   uchar data[];
   uchar result[];
   string result_headers;
   string cleanKey = GetCleanApiKey();
   string safeSymbol = UrlEncodeParam(targetSymbol);
   
   string origin = ForceHttps("${currentOrigin}");
   string signalsUrl = origin + "/api/mt5/signals?apiKey=" + cleanKey + "&symbol=" + safeSymbol;
   
   // Clean GET request (no Content-Type on body-less GET to prevent Windows WinINet socket/read timeouts 1003)
   string getHeaders = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                       "User-Agent: Mozilla/5.0 MarketAI-Bridge/4.72\\r\\n\\r\\n";
   
   int res = WebRequest("GET", signalsUrl, getHeaders, 8000, data, result, result_headers);
   
   // Resilient Fallback: If GET failed or returned code 1003 (WinINet socket/read timeout), retry via POST with JSON body
   if(res != 200)
   {
      string postHeaders = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                           "Content-Type: application/json\\r\\n\\r\\n";
      string postPayload = "{\\\"apiKey\\\":\\\"" + cleanKey + "\\\",\\\"symbol\\\":\\\"" + targetSymbol + "\\\"}";
      ArrayResize(data, StringLen(postPayload));
      StringToCharArray(postPayload, data, 0, StringLen(postPayload), CP_UTF8);
      res = WebRequest("POST", signalsUrl, postHeaders, 8000, data, result, result_headers);
   }
   
   if(res == -1)
   {
      int err = GetLastError();
      static datetime lastWebErr = 0;
      if(TimeCurrent() - lastWebErr > 30)
      {
         if(err == 4060 || err == 4014)
            Print("[MarketAI EROARE ", err, "] URL-ul '", origin, "' NU este autorizat in MT5! Adaugati obligatoriu '", origin, "' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
         else
            Print("[MarketAI EROARE WebRequest ", err, "] Conexiunea la server a esuat (eroare retea/firewall). URL: ", signalsUrl);
         lastWebErr = TimeCurrent();
      }
      return;
   }
   
   if(res != 200)
   {
      static datetime lastHttpErr = 0;
      if(TimeCurrent() - lastHttpErr > 30)
      {
         string errBody = CharArrayToString(result);
         if(res == 401)
            Print("[MarketAI HTTP 401] Cheia API este invalida sau a expirat! Verificati InpApiKey: '", cleanKey, "'");
         else if(res == 1003)
            Print("[MarketAI HTTP 1003] Timeout conexiune MT5 la conectarea cu '", origin, "'. Verificati Tools -> Options -> Expert Advisors -> 'Allow WebRequest for listed URL' (trebuie sa contina '", origin, "') si firewall-ul Windows.");
         else
            Print("[MarketAI HTTP ", res, "] Serverul a raspuns: ", errBody);
         lastHttpErr = TimeCurrent();
      }
      return;
   }

   // Periodic heartbeat in Experts tab every 60s
   static datetime lastHeartbeat = 0;
   if(TimeCurrent() - lastHeartbeat > 60)
   {
      Print("[MarketAI OK] Bridge conectat cu succes la server. Monitorizeaza semnale pentru ", targetSymbol, "... (HTTP 200)");
      lastHeartbeat = TimeCurrent();
   }
   
   if(res == 200)
   {
      string jsonResponse = CharArrayToString(result);

      // Check for cancelled/closed signal IDs to close live market positions and delete pending orders in MT5
      int cancelPos = StringFind(jsonResponse, "\\\"cancelled_ids\\\":");
      if(cancelPos != -1)
      {
         int arrStart = StringFind(jsonResponse, "[", cancelPos);
         int arrEnd = StringFind(jsonResponse, "]", arrStart);
         if(arrStart != -1 && arrEnd != -1)
         {
            string cancelArrStr = StringSubstr(jsonResponse, arrStart, arrEnd - arrStart + 1);

            // 1. Close any open positions in MT5 matching cancelled/closed signals
            for(int p = PositionsTotal() - 1; p >= 0; p--)
            {
               ulong posTicket = PositionGetTicket(p);
               if(posTicket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
               {
                  string comment = PositionGetString(POSITION_COMMENT);
                  string sigToCheck = "";
                  int posCustom = StringFind(comment, "custom_sig_");
                  int posScalp  = StringFind(comment, "scalp_");
                  int posLower  = StringFind(comment, "sig_");
                  int posUpper  = StringFind(comment, "SIG-");
                  int posUpper2 = StringFind(comment, "SIG_");
                  int bestPos = -1;
                  if(posCustom != -1) bestPos = posCustom;
                  else if(posScalp != -1) bestPos = posScalp;
                  else if(posLower != -1) bestPos = posLower;
                  else if(posUpper != -1) bestPos = posUpper;
                  else if(posUpper2 != -1) bestPos = posUpper2;

                  if(bestPos != -1)
                  {
                     sigToCheck = StringSubstr(comment, bestPos);
                     int spacePos = StringFind(sigToCheck, " ");
                     if(spacePos != -1) sigToCheck = StringSubstr(sigToCheck, 0, spacePos);
                     int quotePos = StringFind(sigToCheck, "\\\"");
                     if(quotePos != -1) sigToCheck = StringSubstr(sigToCheck, 0, quotePos);
                  }
                  else if(StringFind(comment, "MarketAI ") == 0)
                  {
                     sigToCheck = StringSubstr(comment, 9);
                  }
                  else if(StringLen(comment) >= 6)
                  {
                     sigToCheck = comment;
                  }

                  bool shouldClose = false;
                  if(StringLen(comment) >= 6 && StringFind(cancelArrStr, comment) != -1)
                  {
                     shouldClose = true;
                  }
                  if(!shouldClose && StringLen(sigToCheck) >= 6 && StringFind(cancelArrStr, sigToCheck) != -1)
                  {
                     shouldClose = true;
                  }
                  if(!shouldClose && StringLen(activeSignalId) >= 6 && StringFind(cancelArrStr, activeSignalId) != -1)
                  {
                     shouldClose = true;
                  }

                  if(shouldClose)
                  {
                     trade.PositionClose(posTicket);
                     Sleep(100);
                     double exitPr = 0.0;
                     double realizedPnl = GetRealizedProfitForPosition(posTicket, exitPr);
                     Print("MarketAI: Position #", posTicket, " (Signal: ", (sigToCheck != "" ? sigToCheck : comment), ") closed via Web Terminal command! Realized PnL: $", DoubleToString(realizedPnl, 2));
                     SendTradeUpdate((sigToCheck != "" ? sigToCheck : comment), "CLOSED", (realizedPnl > 0 ? "TP1_HIT" : "SL_HIT"), "CLOSED_VIA_TERMINAL", realizedPnl, exitPr);
                     if(activeSignalId == sigToCheck || activeSignalId == comment) activeSignalId = "";
                  }
               }
            }

            // 2. Delete any pending orders in MT5 matching cancelled/closed signals
            for(int i = OrdersTotal() - 1; i >= 0; i--)
            {
               ulong ticket = OrderGetTicket(i);
               if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
               {
                  string comment = OrderGetString(ORDER_COMMENT);
                  string sigToCheck = "";
                  int posCustom = StringFind(comment, "custom_sig_");
                  int posScalp  = StringFind(comment, "scalp_");
                  int posLower  = StringFind(comment, "sig_");
                  int posUpper  = StringFind(comment, "SIG-");
                  int posUpper2 = StringFind(comment, "SIG_");
                  int bestPos = -1;
                  if(posCustom != -1) bestPos = posCustom;
                  else if(posScalp != -1) bestPos = posScalp;
                  else if(posLower != -1) bestPos = posLower;
                  else if(posUpper != -1) bestPos = posUpper;
                  else if(posUpper2 != -1) bestPos = posUpper2;

                  if(bestPos != -1)
                  {
                     sigToCheck = StringSubstr(comment, bestPos);
                     int spacePos = StringFind(sigToCheck, " ");
                     if(spacePos != -1) sigToCheck = StringSubstr(sigToCheck, 0, spacePos);
                     int quotePos = StringFind(sigToCheck, "\\\"");
                     if(quotePos != -1) sigToCheck = StringSubstr(sigToCheck, 0, quotePos);
                  }
                  else if(StringFind(comment, "MarketAI ") == 0)
                  {
                     sigToCheck = StringSubstr(comment, 9);
                  }
                  else if(StringLen(comment) >= 6)
                  {
                     sigToCheck = comment;
                  }

                  bool shouldDelete = false;
                  if(StringLen(comment) >= 6 && StringFind(cancelArrStr, comment) != -1)
                  {
                     shouldDelete = true;
                  }
                  if(!shouldDelete && StringLen(sigToCheck) >= 6 && StringFind(cancelArrStr, sigToCheck) != -1)
                  {
                     shouldDelete = true;
                  }
                  if(!shouldDelete && StringLen(activeSignalId) >= 6 && StringFind(cancelArrStr, activeSignalId) != -1)
                  {
                     shouldDelete = true;
                  }

                  if(shouldDelete)
                  {
                     bool delSuccess = trade.OrderDelete(ticket);
                     if(delSuccess)
                     {
                        Print("MarketAI: Pending order #", ticket, " (Signal: ", (sigToCheck != "" ? sigToCheck : comment), ") deleted successfully via cancel/23:00 market cutoff.");
                        SendTradeUpdate((sigToCheck != "" ? sigToCheck : comment), "CANCELLED", "CANCELLED", "ORDER_DELETED", 0.0, 0.0);
                     }
                     else
                     {
                        Print("MarketAI: Warning: OrderDelete #", ticket, " returned: ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
                     }
                     if(activeSignalId == sigToCheck || activeSignalId == comment) activeSignalId = "";
                  }
               }
            }

         }
      }
      
      // Update dynamic risk rules from server in real-time
      UpdateRiskRulesFromJson(jsonResponse);
      
      int sigArrayPos = StringFind(jsonResponse, "\\"signals\\":");
      if(sigArrayPos == -1) return;
      
      int currentPos = sigArrayPos;
      
      while(true)
      {
         int objStart = StringFind(jsonResponse, "{", currentPos);
         if(objStart == -1) break;
         int objEnd = StringFind(jsonResponse, "}", objStart);
         if(objEnd == -1) break;
         
         string sigJson = StringSubstr(jsonResponse, objStart, objEnd - objStart + 1);
         currentPos = objEnd + 1;
         
         string sigId = ExtractJsonValue(sigJson, "signal_id");
         if(sigId == "" || IsSignalProcessed(sigId)) continue;
         
         string sigSymbol = ExtractJsonValue(sigJson, "symbol");
         if(!DoSymbolsMatch(targetSymbol, sigSymbol)) continue;
         
         // CHECK RISK RULES BEFORE PLACING ANY TRADE
         string riskDenialReason = "";
         if(!CheckRiskAllowed(targetSymbol, riskDenialReason))
         {
            Print("MarketAI RISK GUARD BLOCKED SIGNAL ", sigId, " on ", targetSymbol, ": ", riskDenialReason);
            continue;
         }
         
         string action = ExtractJsonValue(sigJson, "action");
         bool isPending = (action == "BUY_LIMIT" || action == "SELL_LIMIT" || action == "BUY_STOP" || action == "SELL_STOP");
         
         // Verify no existing active order or position already has this signal
         bool alreadyPlaced = false;
         
         for(int i = PositionsTotal() - 1; i >= 0; i--)
         {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber && PositionGetString(POSITION_SYMBOL) == targetSymbol)
            {
               string comment = PositionGetString(POSITION_COMMENT);
               if(StringFind(comment, sigId) != -1)
               {
                  alreadyPlaced = true;
                  break;
               }
            }
         }
         
         if(!alreadyPlaced)
         {
            for(int i = OrdersTotal() - 1; i >= 0; i--)
            {
               ulong ticket = OrderGetTicket(i);
               if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber && OrderGetString(ORDER_SYMBOL) == targetSymbol)
               {
                  string comment = OrderGetString(ORDER_COMMENT);
                  if(StringFind(comment, sigId) != -1)
                  {
                     alreadyPlaced = true;
                     break;
                  }
               }
            }
         }
         
         if(alreadyPlaced)
         {
            MarkSignalAsProcessed(sigId);
            continue;
         }
         
         // Setup trade filling mode and precision
         SetupTradeFillingMode(targetSymbol);
         int digits = (int)SymbolInfoInteger(targetSymbol, SYMBOL_DIGITS);
         double point = SymbolInfoDouble(targetSymbol, SYMBOL_POINT);
         double tickSize = SymbolInfoDouble(targetSymbol, SYMBOL_TRADE_TICK_SIZE);
         if(tickSize <= 0) tickSize = point;

         // Fresh tick retrieval
         double ask = 0.0;
         double bid = 0.0;
         MqlTick lastTick;
         if(SymbolInfoTick(targetSymbol, lastTick))
         {
            ask = lastTick.ask;
            bid = lastTick.bid;
         }
         if(ask <= 0.0) ask = SymbolInfoDouble(targetSymbol, SYMBOL_ASK);
         if(bid <= 0.0) bid = SymbolInfoDouble(targetSymbol, SYMBOL_BID);

         int stopsLevel = (int)SymbolInfoInteger(targetSymbol, SYMBOL_TRADE_STOPS_LEVEL);
         int freezeLevel = (int)SymbolInfoInteger(targetSymbol, SYMBOL_TRADE_FREEZE_LEVEL);
         int spread = (int)SymbolInfoInteger(targetSymbol, SYMBOL_SPREAD);

         // Minimum safe distance required by broker in price points (plus 3 points safety buffer)
         double rawMinPoints = MathMax((double)stopsLevel, MathMax((double)freezeLevel, (double)spread));
         if(rawMinPoints < 10.0) rawMinPoints = 10.0;
         double minDistance = (rawMinPoints + 3.0) * point;
         
         double entry = NormalizeDouble(StringToDouble(ExtractJsonValue(sigJson, "entry")), digits);
         double sl    = NormalizeDouble(StringToDouble(ExtractJsonValue(sigJson, "sl")), digits);
         double tp1   = NormalizeDouble(StringToDouble(ExtractJsonValue(sigJson, "tp1")), digits);
         double tp2   = NormalizeDouble(StringToDouble(ExtractJsonValue(sigJson, "tp2")), digits);
         double tp3   = NormalizeDouble(StringToDouble(ExtractJsonValue(sigJson, "tp3")), digits);
         
         string timeframe = ExtractJsonValue(sigJson, "timeframe");
         if(timeframe == "") timeframe = "15m";
         double slDist  = StringToDouble(ExtractJsonValue(sigJson, "sl_dist"));
         double tp1Dist = StringToDouble(ExtractJsonValue(sigJson, "tp1_dist"));
         double tp2Dist = StringToDouble(ExtractJsonValue(sigJson, "tp2_dist"));
         double tp3Dist = StringToDouble(ExtractJsonValue(sigJson, "tp3_dist"));
         
         // Determine direction based on action string AND price orientation
         bool isSell = (StringFind(action, "SELL") != -1 || StringFind(action, "SHORT") != -1);
         if(!isSell && sl > 0 && ((entry > 0 && sl > entry) || (ask > 0 && sl > ask)))
         {
            isSell = true;
         }

         // Calculate intended distances with dynamic timeframe protection
         double intendedSlDist = slDist;
         if(intendedSlDist <= 0 && entry > 0 && sl > 0) intendedSlDist = MathAbs(entry - sl);
         double refPrice = (entry > 0) ? entry : (isSell ? bid : ask);
         double minSafeSL = GetMinimumSafeSLDistance(targetSymbol, timeframe, refPrice);
         if(intendedSlDist < minSafeSL) intendedSlDist = minSafeSL;

         double intendedTp1Dist = (tp1Dist > 0) ? tp1Dist : (intendedSlDist * 1.5);
         double intendedTp2Dist = (tp2Dist > 0) ? tp2Dist : (intendedSlDist * 2.2);
         double intendedTp3Dist = (tp3Dist > 0) ? tp3Dist : (intendedSlDist * 3.0);

         // Validate and auto-adjust pending orders if market price has already reached or crossed the level
         string orderExecAction = action;
         bool isPendingOrder = (StringFind(action, "LIMIT") != -1 || StringFind(action, "STOP") != -1);

         if(StringFind(action, "BUY_LIMIT") != -1)
         {
            if(entry <= 0 || (bid > 0 && entry >= (bid - minDistance)))
            {
               Print("[MarketAI] Prețul pieței (", bid, ") a atins/depășit nivelul BUY_LIMIT (", entry, "). Se comută automat pe ordin la piață (BUY)...");
               orderExecAction = "BUY";
               entry = 0.0;
               isPendingOrder = false;
            }
         }
         else if(StringFind(action, "SELL_LIMIT") != -1)
         {
            if(entry <= 0 || (ask > 0 && entry <= (ask + minDistance)))
            {
               Print("[MarketAI] Prețul pieței (", ask, ") a atins/depășit nivelul SELL_LIMIT (", entry, "). Se comută automat pe ordin la piață (SELL)...");
               orderExecAction = "SELL";
               entry = 0.0;
               isPendingOrder = false;
            }
         }
         else if(StringFind(action, "BUY_STOP") != -1)
         {
            if(entry <= 0 || (ask > 0 && entry <= (ask + minDistance)))
            {
               Print("[MarketAI] Prețul pieței (", ask, ") a atins/depășit nivelul BUY_STOP (", entry, "). Se comută automat pe ordin la piață (BUY)...");
               orderExecAction = "BUY";
               entry = 0.0;
               isPendingOrder = false;
            }
         }
         else if(StringFind(action, "SELL_STOP") != -1)
         {
            if(entry <= 0 || (bid > 0 && entry >= (bid - minDistance)))
            {
               Print("[MarketAI] Prețul pieței (", bid, ") a atins/depășit nivelul SELL_STOP (", entry, "). Se comută automat pe ordin la piață (SELL)...");
               orderExecAction = "SELL";
               entry = 0.0;
               isPendingOrder = false;
            }
         }

         // STRICT RE-ALIGNMENT OF SL & TPs:
         // 1. For Market Orders (or converted pending): SL and TPs MUST be computed relative to actual execution price (ask/bid)!
         if(!isPendingOrder || entry <= 0.0)
         {
            double tradePrice = isSell ? bid : ask;
            if(!isSell)
            {
               sl  = NormalizeDouble(tradePrice - intendedSlDist, digits);
               tp1 = NormalizeDouble(tradePrice + intendedTp1Dist, digits);
               tp2 = NormalizeDouble(tradePrice + intendedTp2Dist, digits);
               tp3 = NormalizeDouble(tradePrice + intendedTp3Dist, digits);
               if(sl >= (bid - minDistance)) sl = NormalizeDouble(bid - minDistance, digits);
               if(tp3 <= (ask + minDistance)) tp3 = NormalizeDouble(ask + minDistance, digits);
            }
            else
            {
               sl  = NormalizeDouble(tradePrice + intendedSlDist, digits);
               tp1 = NormalizeDouble(tradePrice - intendedTp1Dist, digits);
               tp2 = NormalizeDouble(tradePrice - intendedTp2Dist, digits);
               tp3 = NormalizeDouble(tradePrice - intendedTp3Dist, digits);
               if(sl <= (ask + minDistance)) sl = NormalizeDouble(ask + minDistance, digits);
               if(tp3 >= (bid - minDistance)) tp3 = NormalizeDouble(bid - minDistance, digits);
            }
         }
         else
         {
            // 2. For Pending Orders: SL and TPs relative to entry
            if(!isSell)
            {
               sl  = NormalizeDouble(entry - intendedSlDist, digits);
               tp1 = NormalizeDouble(entry + intendedTp1Dist, digits);
               tp2 = NormalizeDouble(entry + intendedTp2Dist, digits);
               tp3 = NormalizeDouble(entry + intendedTp3Dist, digits);
               if(sl >= (entry - minDistance)) sl = NormalizeDouble(entry - minDistance, digits);
               if(tp3 <= (entry + minDistance)) tp3 = NormalizeDouble(entry + minDistance, digits);
            }
            else
            {
               sl  = NormalizeDouble(entry + intendedSlDist, digits);
               tp1 = NormalizeDouble(entry - intendedTp1Dist, digits);
               tp2 = NormalizeDouble(entry - intendedTp2Dist, digits);
               tp3 = NormalizeDouble(entry - intendedTp3Dist, digits);
               if(sl <= (entry + minDistance)) sl = NormalizeDouble(entry + minDistance, digits);
               if(tp3 >= (entry - minDistance)) tp3 = NormalizeDouble(entry - minDistance, digits);
            }
         }

         // Align all levels to broker tick size without stepping inside the forbidden stop zone
         if(tickSize > 0)
         {
            if(entry > 0) entry = NormalizeDouble(MathRound(entry / tickSize) * tickSize, digits);
            if(sl > 0)
            {
               if(!isSell)
                  sl = NormalizeDouble(MathFloor(sl / tickSize) * tickSize, digits);
               else
                  sl = NormalizeDouble(MathCeil(sl / tickSize) * tickSize, digits);
            }
            if(tp3 > 0)
            {
               if(!isSell)
                  tp3 = NormalizeDouble(MathCeil(tp3 / tickSize) * tickSize, digits);
               else
                  tp3 = NormalizeDouble(MathFloor(tp3 / tickSize) * tickSize, digits);
            }
            if(tp1 > 0)   tp1   = NormalizeDouble(MathRound(tp1 / tickSize) * tickSize, digits);
            if(tp2 > 0)   tp2   = NormalizeDouble(MathRound(tp2 / tickSize) * tickSize, digits);
         }
         
         // DYNAMIC LOT SIZE CALCULATION BASED ON % RISK & REAL SL DISTANCE
         double tradePrice = (entry > 0) ? entry : (isSell ? bid : ask);
         double finalLot = CalculateLotSize(targetSymbol, tradePrice, sl, liveRiskPercent);
         
         bool orderSuccess = false;
         string orderComment = sigId;
         if(StringLen(orderComment) > 31) orderComment = StringSubstr(sigId, 0, 31);
         
         // 1. Try placing as pending order if applicable
         if(isPendingOrder && entry > 0)
         {
            // Pending orders in MT5 require ORDER_FILLING_RETURN (FOK/IOC causes error 10015/10013)
            trade.SetTypeFilling(ORDER_FILLING_RETURN);
            if(StringFind(orderExecAction, "BUY_LIMIT") != -1)
            {
               orderSuccess = trade.BuyLimit(finalLot, entry, targetSymbol, sl, tp3, ORDER_TIME_GTC, 0, orderComment);
            }
            else if(StringFind(orderExecAction, "SELL_LIMIT") != -1)
            {
               orderSuccess = trade.SellLimit(finalLot, entry, targetSymbol, sl, tp3, ORDER_TIME_GTC, 0, orderComment);
            }
            else if(StringFind(orderExecAction, "BUY_STOP") != -1)
            {
               orderSuccess = trade.BuyStop(finalLot, entry, targetSymbol, sl, tp3, ORDER_TIME_GTC, 0, orderComment);
            }
            else if(StringFind(orderExecAction, "SELL_STOP") != -1)
            {
               orderSuccess = trade.SellStop(finalLot, entry, targetSymbol, sl, tp3, ORDER_TIME_GTC, 0, orderComment);
            }
         }

         // Fallback 1: If pending order failed for ANY reason (10015 invalid price, 10016 invalid stops, 10013, 10014),
         // or if it was converted to a market order, execute directly at market price with properly recalibrated SL/TP!
         if(!orderSuccess && isPendingOrder)
         {
            Print("[MarketAI] Plasarea ordinului pending (", orderExecAction, " la ", entry, ") a fost respinsă de broker (Cod: ", trade.ResultRetcode(), " - ", trade.ResultRetcodeDescription(), "). Se execută imediat la prețul curent al pieței (MARKET ORDER)...");
            SetupTradeFillingMode(targetSymbol);
            double execPrice = isSell ? bid : ask;
            if(!isSell)
            {
               sl  = NormalizeDouble(execPrice - intendedSlDist, digits);
               tp1 = NormalizeDouble(execPrice + intendedTp1Dist, digits);
               tp2 = NormalizeDouble(execPrice + intendedTp2Dist, digits);
               tp3 = NormalizeDouble(execPrice + intendedTp3Dist, digits);
               if(sl >= (bid - minDistance)) sl = NormalizeDouble(bid - minDistance, digits);
               if(tp3 <= (ask + minDistance)) tp3 = NormalizeDouble(ask + minDistance, digits);
            }
            else
            {
               sl  = NormalizeDouble(execPrice + intendedSlDist, digits);
               tp1 = NormalizeDouble(execPrice - intendedTp1Dist, digits);
               tp2 = NormalizeDouble(execPrice - intendedTp2Dist, digits);
               tp3 = NormalizeDouble(execPrice - intendedTp3Dist, digits);
               if(sl <= (ask + minDistance)) sl = NormalizeDouble(ask + minDistance, digits);
               if(tp3 >= (bid - minDistance)) tp3 = NormalizeDouble(bid - minDistance, digits);
            }
            finalLot = CalculateLotSize(targetSymbol, execPrice, sl, liveRiskPercent);
            if(isSell)
               orderSuccess = trade.Sell(finalLot, targetSymbol, 0.0, sl, tp3, orderComment);
            else
               orderSuccess = trade.Buy(finalLot, targetSymbol, 0.0, sl, tp3, orderComment);
         }
         else if(!isPendingOrder)
         {
            SetupTradeFillingMode(targetSymbol);
            if(isSell)
               orderSuccess = trade.Sell(finalLot, targetSymbol, 0.0, sl, tp3, orderComment);
            else
               orderSuccess = trade.Buy(finalLot, targetSymbol, 0.0, sl, tp3, orderComment);
         }

         // Fallback 2: ECN Market Execution restriction (broker does not accept SL/TP on initial market order)
         if(!orderSuccess && (trade.ResultRetcode() == 10016 || trade.ResultRetcode() == 10015 || trade.ResultRetcode() == 10013))
         {
            Print("[MarketAI] Broker ECN / restricții stops (Cod ", trade.ResultRetcode(), "). Se reîncearcă plasarea fără SL/TP inițial și aplicarea imediată prin PositionModify...");
            SetupTradeFillingMode(targetSymbol);
            double execPrice = isSell ? bid : ask;
            finalLot = CalculateLotSize(targetSymbol, execPrice, sl, liveRiskPercent);
            if(isSell)
               orderSuccess = trade.Sell(finalLot, targetSymbol, 0.0, 0.0, 0.0, orderComment);
            else
               orderSuccess = trade.Buy(finalLot, targetSymbol, 0.0, 0.0, 0.0, orderComment);

            if(orderSuccess)
            {
               Sleep(150);
               double curBid = SymbolInfoDouble(targetSymbol, SYMBOL_BID);
               double curAsk = SymbolInfoDouble(targetSymbol, SYMBOL_ASK);
               if(!isSell)
               {
                  sl  = NormalizeDouble(curAsk - intendedSlDist, digits);
                  tp3 = NormalizeDouble(curAsk + intendedTp3Dist, digits);
                  if(sl >= (curBid - minDistance)) sl = NormalizeDouble(curBid - minDistance, digits);
                  if(tp3 <= (curAsk + minDistance)) tp3 = NormalizeDouble(curAsk + minDistance, digits);
               }
               else
               {
                  sl  = NormalizeDouble(curBid + intendedSlDist, digits);
                  tp3 = NormalizeDouble(curBid - intendedTp3Dist, digits);
                  if(sl <= (curAsk + minDistance)) sl = NormalizeDouble(curAsk + minDistance, digits);
                  if(tp3 >= (curBid - minDistance)) tp3 = NormalizeDouble(curBid - minDistance, digits);
               }
               if(tickSize > 0)
               {
                  if(!isSell) sl = NormalizeDouble(MathFloor(sl / tickSize) * tickSize, digits);
                  else sl = NormalizeDouble(MathCeil(sl / tickSize) * tickSize, digits);
                  if(!isSell) tp3 = NormalizeDouble(MathCeil(tp3 / tickSize) * tickSize, digits);
                  else tp3 = NormalizeDouble(MathFloor(tp3 / tickSize) * tickSize, digits);
               }

               for(int p = PositionsTotal() - 1; p >= 0; p--)
               {
                  ulong pTicket = PositionGetTicket(p);
                  if(pTicket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber && PositionGetString(POSITION_SYMBOL) == targetSymbol)
                  {
                     if(trade.PositionModify(pTicket, sl, tp3))
                     {
                        Print("[MarketAI] SL (", sl, ") și TP3 (", tp3, ") aplicate cu succes prin PositionModify pe poziția #", pTicket);
                     }
                     else
                     {
                        Print("[MarketAI AVERTISMENT] PositionModify a returnat: ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
                     }
                     break;
                  }
               }
            }
         }
         
         if(orderSuccess)
         {
            MarkSignalAsProcessed(sigId);
            activeSignalId = sigId;
            activeTp1 = tp1;
            activeTp2 = tp2;
            activeTp3 = tp3;
            tp1Hit = false;
            tp2Hit = false;
            
            Print("[MarketAI SUCCES] Tranzacție executată cu succes (", action, ") Lot: ", finalLot, " (Risc: ", liveRiskPercent, "%) pe ", targetSymbol, " Signal ID: ", sigId, " SL: ", sl, " TP3: ", tp3);
            SendStatusUpdate(sigId, "RUNNING", "OPENED", "ENTRY");
         }
         else
         {
            Print("[MarketAI EROARE ORDIN] Ordinul nu a putut fi plasat pe ", targetSymbol, "! Acțiune: ", action, " Lot: ", finalLot, " Cod MT5: ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
            // Evităm repetarea erorii în buclă la fiecare 4 secunde
            MarkSignalAsProcessed(sigId);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Calculate asset-appropriate trailing stop distance in price units|
//+------------------------------------------------------------------+
double GetTrailingDistanceInPrice(string sym, int points)
{
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   string upperSym = sym;
   StringToUpper(upperSym);
   
   double multiplier = 1.0;
   if(StringFind(upperSym, "NAS") >= 0 || StringFind(upperSym, "US30") >= 0 || StringFind(upperSym, "SPX") >= 0 || StringFind(upperSym, "NQ") >= 0 || StringFind(upperSym, "DAX") >= 0)
   {
      multiplier = (point == 0.01) ? 100.0 : (point == 0.25 ? 4.0 : 1.0);
   }
   else if(StringFind(upperSym, "XAU") >= 0 || StringFind(upperSym, "GOLD") >= 0 || StringFind(upperSym, "GC") >= 0)
   {
      multiplier = (point == 0.01) ? 10.0 : 1.0;
   }
   else
   {
      multiplier = 1.0;
   }
   
   return points * multiplier * point;
}

//+------------------------------------------------------------------+
//| Manage Active Positions: Auto Break-Even & Smart Trailing Stop   |
//+------------------------------------------------------------------+
void ManageActivePositions()
{
   string targetSymbol = (InpBrokerSymbol != "") ? InpBrokerSymbol : _Symbol;
   int digits = (int)SymbolInfoInteger(targetSymbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(targetSymbol, SYMBOL_POINT);
   double tickSize = SymbolInfoDouble(targetSymbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0) tickSize = point;
   double ask = SymbolInfoDouble(targetSymbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(targetSymbol, SYMBOL_BID);

   int stopsLevel  = (int)SymbolInfoInteger(targetSymbol, SYMBOL_TRADE_STOPS_LEVEL);
   int freezeLevel = (int)SymbolInfoInteger(targetSymbol, SYMBOL_TRADE_FREEZE_LEVEL);
   int spread      = (int)SymbolInfoInteger(targetSymbol, SYMBOL_SPREAD);
   double minDistance = (MathMax((double)stopsLevel, MathMax((double)freezeLevel, (double)spread)) + 2.0) * point;
   if(minDistance < 10.0 * point) minDistance = 10.0 * point;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber && PositionGetString(POSITION_SYMBOL) == targetSymbol)
      {
         double openPrice    = PositionGetDouble(POSITION_PRICE_OPEN);
         double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
         double currentSL    = PositionGetDouble(POSITION_SL);
         double currentTP    = PositionGetDouble(POSITION_TP);
         double volume       = PositionGetDouble(POSITION_VOLUME);
         long posType        = PositionGetInteger(POSITION_TYPE);
         
         // [A] BUY POSITIONS MANAGEMENT
         if(posType == POSITION_TYPE_BUY)
         {
            double posProfit = PositionGetDouble(POSITION_PROFIT);
            bool isInProfit = (posProfit > 0.0) && (currentPrice > (openPrice + minDistance));

            // Resolve TP1 level with fallback to 1.5x SL distance or 45% of TP if activeTp1 not set
            double thisTp1 = activeTp1;
            if(thisTp1 <= (openPrice + minDistance))
            {
               if(currentSL > 0 && currentSL < openPrice)
                  thisTp1 = openPrice + (openPrice - currentSL) * 1.5;
               else if(currentTP > openPrice)
                  thisTp1 = openPrice + (currentTP - openPrice) * 0.45;
               else
                  thisTp1 = openPrice + 20 * point;
            }

            bool isTp1Reached = (currentPrice >= thisTp1 && thisTp1 > (openPrice + minDistance));
            bool isSlAlreadyBE = (currentSL >= openPrice);

            // 1. AUTO BREAK-EVEN & TP1 PARTIAL CLOSE (70%) - CONTROLLED BY AUTO BREAK-EVEN TOGGLE
            if(isInProfit && isTp1Reached && (!tp1Hit || !isSlAlreadyBE))
            {
               if(liveAutoBreakEven)
               {
                  double minLot = SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN);
                  double stepLot = SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_STEP);
                  if(stepLot <= 0) stepLot = 0.01;

                  double targetCloseLot = MathFloor((volume * 0.7) / stepLot) * stepLot;
                  if((volume - targetCloseLot) < minLot && volume > minLot)
                  {
                     targetCloseLot = volume - minLot;
                  }

                  if(targetCloseLot >= minLot && (volume - targetCloseLot) >= minLot)
                  {
                     if(trade.PositionClosePartial(ticket, targetCloseLot))
                     {
                        Print("[MarketAI TP1] TP1 atins la ", currentPrice, "! Profit: +$", posProfit, ". S-a inchis partial 70% (", targetCloseLot, " loturi din ", volume, ").");
                     }
                     else
                     {
                        Print("[MarketAI TP1 AVERTISMENT] PositionClosePartial nu a reusit: Cod ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
                     }
                  }
                  else
                  {
                     Print("[MarketAI TP1] TP1 atins la ", currentPrice, "! Profit: +$", posProfit, ". Volumul (", volume, ") este minim, se muta direct SL la Break-Even.");
                  }

                  // Move SL to Break-Even + 2 points buffer (zero risk + covers spread/fees)
                  double beSL = NormalizeDouble(openPrice + 2 * point, digits);
                  if(tickSize > 0) beSL = NormalizeDouble(MathFloor(beSL / tickSize) * tickSize, digits);
                  if(beSL > currentSL && beSL <= (bid - minDistance))
                  {
                     if(trade.PositionModify(ticket, beSL, currentTP))
                     {
                        Print("[MarketAI BE] SL mutat automat la Break-Even (+2 pct peste Entry): ", beSL, " pe pozitia #", ticket);
                     }
                     else
                     {
                        Print("[MarketAI BE AVERTISMENT] PositionModify nu a putut muta SL la BE: Cod ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
                     }
                  }

                  tp1Hit = true;
                  Sleep(100);
                  double exitPr = 0.0;
                  double currentRealized = GetRealizedProfitForPosition(ticket, exitPr);
                  SendTradeUpdate(activeSignalId, "RUNNING", "PROFIT", "TP1_BREAK_EVEN", currentRealized, currentPrice);
               }
            }
            
            // 2. TP2 PARTIAL CLOSE (10%) - STRICT PROFIT VERIFICATION
            if(isInProfit && tp1Hit && !tp2Hit && activeTp2 > activeTp1 && currentPrice >= activeTp2)
            {
               double partialVolume = NormalizeDouble(volume * 0.1, 2);
               if(partialVolume >= SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN))
               {
                  if(trade.PositionClosePartial(ticket, partialVolume))
                  {
                     tp2Hit = true;
                     Print("MarketAI: TP2 reached at ", currentPrice, "! Profit: +$", posProfit, ". Closed 10% partial.");
                     SendStatusUpdate(activeSignalId, "RUNNING", "PROFIT", "TP2");
                  }
               }
            }
            
            // 3. SMART TRAILING STOP
            if(liveTrailingStop && isInProfit)
            {
               double profitPoints = (bid - openPrice) / point;
               if(profitPoints >= InpTrailTriggerPoints)
               {
                  double proposedSL = NormalizeDouble(bid - liveTrailDistancePoints * point, digits);
                  if(proposedSL > (bid - minDistance)) proposedSL = NormalizeDouble(bid - minDistance, digits);
                  if(tickSize > 0) proposedSL = NormalizeDouble(MathFloor(proposedSL / tickSize) * tickSize, digits);
                  
                  // Only trail forward in profit above current SL + step, respecting broker distance
                  if(proposedSL > (currentSL + InpTrailStepPoints * point) && proposedSL > openPrice && proposedSL <= (bid - minDistance))
                  {
                     if(trade.PositionModify(ticket, proposedSL, currentTP))
                     {
                        Print("MarketAI Smart Trailing: SL advanced to ", proposedSL, " (+", (proposedSL - openPrice) / point, " pts profit locked)");
                     }
                  }
               }
            }
         }
         // [B] SELL POSITIONS MANAGEMENT
         else if(posType == POSITION_TYPE_SELL)
         {
            double posProfit = PositionGetDouble(POSITION_PROFIT);
            bool isInProfit = (posProfit > 0.0) && (currentPrice < (openPrice - minDistance));

            // Resolve TP1 level with fallback to 1.5x SL distance or 45% of TP if activeTp1 not set
            double thisTp1 = activeTp1;
            if(thisTp1 <= 0 || thisTp1 >= (openPrice - minDistance))
            {
               if(currentSL > 0 && currentSL > openPrice)
                  thisTp1 = openPrice - (currentSL - openPrice) * 1.5;
               else if(currentTP > 0 && currentTP < openPrice)
                  thisTp1 = openPrice - (openPrice - currentTP) * 0.45;
               else
                  thisTp1 = openPrice - 20 * point;
            }

            bool isTp1Reached = (currentPrice <= thisTp1 && thisTp1 < (openPrice - minDistance));
            bool isSlAlreadyBE = (currentSL > 0 && currentSL <= openPrice);

            // 1. AUTO BREAK-EVEN & TP1 PARTIAL CLOSE (70%) - CONTROLLED BY AUTO BREAK-EVEN TOGGLE
            if(isInProfit && isTp1Reached && (!tp1Hit || !isSlAlreadyBE))
            {
               if(liveAutoBreakEven)
               {
                  double minLot = SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN);
                  double stepLot = SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_STEP);
                  if(stepLot <= 0) stepLot = 0.01;

                  double targetCloseLot = MathFloor((volume * 0.7) / stepLot) * stepLot;
                  if((volume - targetCloseLot) < minLot && volume > minLot)
                  {
                     targetCloseLot = volume - minLot;
                  }

                  if(targetCloseLot >= minLot && (volume - targetCloseLot) >= minLot)
                  {
                     if(trade.PositionClosePartial(ticket, targetCloseLot))
                     {
                        Print("[MarketAI TP1] TP1 atins la ", currentPrice, "! Profit: +$", posProfit, ". S-a inchis partial 70% (", targetCloseLot, " loturi din ", volume, ").");
                     }
                     else
                     {
                        Print("[MarketAI TP1 AVERTISMENT] PositionClosePartial nu a reusit: Cod ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
                     }
                  }
                  else
                  {
                     Print("[MarketAI TP1] TP1 atins la ", currentPrice, "! Profit: +$", posProfit, ". Volumul (", volume, ") este minim, se muta direct SL la Break-Even.");
                  }

                  // Move SL to Break-Even - 2 points buffer (zero risk + covers spread/fees)
                  double beSL = NormalizeDouble(openPrice - 2 * point, digits);
                  if(tickSize > 0) beSL = NormalizeDouble(MathCeil(beSL / tickSize) * tickSize, digits);
                  if((currentSL == 0 || beSL < currentSL) && beSL >= (ask + minDistance))
                  {
                     if(trade.PositionModify(ticket, beSL, currentTP))
                     {
                        Print("[MarketAI BE] SL mutat automat la Break-Even (-2 pct sub Entry): ", beSL, " pe pozitia #", ticket);
                     }
                     else
                     {
                        Print("[MarketAI BE AVERTISMENT] PositionModify nu a putut muta SL la BE: Cod ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
                     }
                  }

                  tp1Hit = true;
                  Sleep(100);
                  double exitPr = 0.0;
                  double currentRealized = GetRealizedProfitForPosition(ticket, exitPr);
                  SendTradeUpdate(activeSignalId, "RUNNING", "PROFIT", "TP1_BREAK_EVEN", currentRealized, currentPrice);
               }
            }
            
            // 2. TP2 PARTIAL CLOSE (10%) - STRICT PROFIT VERIFICATION
            if(isInProfit && tp1Hit && !tp2Hit && activeTp2 < activeTp1 && currentPrice <= activeTp2)
            {
               double partialVolume = NormalizeDouble(volume * 0.1, 2);
               if(partialVolume >= SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN))
               {
                  if(trade.PositionClosePartial(ticket, partialVolume))
                  {
                     tp2Hit = true;
                     Print("MarketAI: TP2 reached at ", currentPrice, "! Profit: +$", posProfit, ". Closed 10% partial.");
                     SendStatusUpdate(activeSignalId, "RUNNING", "PROFIT", "TP2");
                  }
               }
            }
            
            // 3. SMART TRAILING STOP
            if(liveTrailingStop && isInProfit)
            {
               double profitPoints = (openPrice - ask) / point;
               if(profitPoints >= InpTrailTriggerPoints)
               {
                  double proposedSL = NormalizeDouble(ask + liveTrailDistancePoints * point, digits);
                  if(proposedSL < (ask + minDistance)) proposedSL = NormalizeDouble(ask + minDistance, digits);
                  if(tickSize > 0) proposedSL = NormalizeDouble(MathCeil(proposedSL / tickSize) * tickSize, digits);
                  
                  // Only trail downwards in profit below current SL - step, respecting broker distance
                  if((currentSL == 0 || proposedSL < (currentSL - InpTrailStepPoints * point)) && proposedSL < openPrice && proposedSL >= (ask + minDistance))
                  {
                     if(trade.PositionModify(ticket, proposedSL, currentTP))
                     {
                        Print("MarketAI Smart Trailing: SL advanced to ", proposedSL, " (+", (openPrice - proposedSL) / point, " pts profit locked)");
                     }
                  }
               }
            }
         }
      }
   }
}
//+------------------------------------------------------------------+`;
}
