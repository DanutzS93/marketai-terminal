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
#property version   "4.60"
#property description "MarketAI MT5 Auto-Trading Bridge with Real-Time Risk Rules & Smart Trailing Engine"

#include <Trade\\Trade.mqh>
CTrade trade;

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+
input group "=== [1] Web API & Connection Settings ==="
input string   InpEndpointURL           = "${mt5Endpoint}";
input string   InpUpdateURL             = "${mt5UpdateEndpoint}";
input string   InpApiKey                = "${apiKey}";
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
input int      InpMaxTradesPerDay       = 10;             // Max Trades allowed per calendar day
input int      InpMaxTradesPerSymbol    = 3;              // Max Concurrent trades per symbol

input group "=== [5] Position Management & Smart Trailing ==="
input bool     InpAutoBreakEven         = true;           // Auto move SL to Break-Even at TP1 (+2 points buffer)
input bool     InpSmartTrailingStop     = true;           // Dynamic Trailing Stop to lock in running trend profits
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

// Effective Live Risk Rules (can be overridden by Web API in real-time)
double liveRiskPercent        = 1.0;
double liveMaxDailyLoss       = 3000.0;
double liveDailyProfitTarget  = 5000.0;
int    liveMaxTradesPerDay    = 10;
int    liveMaxTradesPerSymbol = 3;
bool   liveAutoBreakEven      = true;
bool   liveTrailingStop       = true;
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
   
   if(c == s || StringFind(c, s) != -1 || StringFind(s, c) != -1) return true;
   
   // Forex Pairs Matching
   if(StringFind(s, "EURUSD") != -1 && StringFind(c, "EURUSD") != -1) return true;
   if(StringFind(s, "GBPUSD") != -1 && StringFind(c, "GBPUSD") != -1) return true;
   if(StringFind(s, "USDJPY") != -1 && StringFind(c, "USDJPY") != -1) return true;
   if(StringFind(s, "EUR/USD") != -1 && StringFind(c, "EURUSD") != -1) return true;
   if(StringFind(s, "GBP/USD") != -1 && StringFind(c, "GBPUSD") != -1) return true;
   if(StringFind(s, "USD/JPY") != -1 && StringFind(c, "USDJPY") != -1) return true;
   
   // Indices / Commodities
   if((StringFind(s, "NAS") != -1 || StringFind(s, "NQ") != -1) && (StringFind(c, "NAS") != -1 || StringFind(c, "US100") != -1 || StringFind(c, "USTEC") != -1 || StringFind(c, "NQ") != -1)) return true;
   if((StringFind(s, "US30") != -1 || StringFind(s, "DOW") != -1) && (StringFind(c, "US30") != -1 || StringFind(c, "DJ30") != -1 || StringFind(c, "WS30") != -1 || StringFind(c, "DOW") != -1)) return true;
   if((StringFind(s, "SPX") != -1 || StringFind(s, "US500") != -1 || StringFind(s, "SP500") != -1 || StringFind(s, "ES") != -1) && (StringFind(c, "SPX") != -1 || StringFind(c, "US500") != -1 || StringFind(c, "SP500") != -1 || StringFind(c, "ES") != -1)) return true;
   if((StringFind(s, "GOLD") != -1 || StringFind(s, "XAU") != -1 || StringFind(s, "GC") != -1) && (StringFind(c, "XAU") != -1 || StringFind(c, "GOLD") != -1 || StringFind(c, "GC") != -1)) return true;
   
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
         if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\\n' || ch == '\\r') break;
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
   else if(StringFind(symUp, "US30") >= 0 || StringFind(symUp, "DJ") >= 0 || StringFind(symUp, "DOW") >= 0)
      assetSpecificPoints = ExtractJsonNestedValue(json, "riskRules", "trailingStopPointsPerAsset.DOW_JONES");
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
                "  MarketAI Signals MT5 Bridge v4.60 (Pro Risk Engine)  \\n" +
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
                " Auto Break-Even   : " + (liveAutoBreakEven ? "ENABLED (TP1)" : "DISABLED") + "\\n" +
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
   Print("MarketAI MT5 Bridge v4.60 initialized. Target Symbol: ", targetSymbol, " Magic: ", InpMagicNumber, " Connected Account: #", login, " (", serverName, ") [", company, "]");
   
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
   Print("MarketAI MT5 Bridge v4.60 stopped.");
}

//+------------------------------------------------------------------+
//| Expert timer function (polls Web API and manages positions)      |
//+------------------------------------------------------------------+
void OnTimer()
{
   FetchAndExecuteSignals();
   ManageActivePositions();
   SendAccountSync();
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Send account balance, equity & login info to MarketAI            |
//+------------------------------------------------------------------+
void SendAccountSync()
{
   uchar data[];
   uchar result[];
   string result_headers;
   string headers = "Authorization: Bearer " + InpApiKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n";
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   string payload = "{\\"accountNumber\\":\\"" + IntegerToString(login) + "\\",\\"accountServer\\":\\"" + serverName + "\\",\\"accountCurrency\\":\\"" + currency + "\\",\\"accountCompany\\":\\"" + company + "\\",\\"accountBalance\\":" + DoubleToString(balance, 2) + ",\\"equity\\":" + DoubleToString(equity, 2) + "}";
   ArrayResize(data, StringLen(payload));
   StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   
   string accountURL = "${currentOrigin}/api/mt5/account?apiKey=" + InpApiKey;
   WebRequest("POST", accountURL, headers, 4000, data, result, result_headers);
}

//+------------------------------------------------------------------+
//| Send status update back to MarketAI                              |
//+------------------------------------------------------------------+
void SendStatusUpdate(string signalId, string status, string outcome, string milestone)
{
   uchar data[];
   uchar result[];
   string result_headers;
   string headers = "Authorization: Bearer " + InpApiKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n";
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   string payload = "{\\"signal_id\\":\\"" + signalId + "\\",\\"status\\":\\"" + status + "\\",\\"outcomeStatus\\":\\"" + outcome + "\\",\\"milestone\\":\\"" + milestone + "\\",\\"accountNumber\\":\\"" + IntegerToString(login) + "\\",\\"accountServer\\":\\"" + serverName + "\\",\\"accountCurrency\\":\\"" + currency + "\\",\\"accountCompany\\":\\"" + company + "\\",\\"accountBalance\\":" + DoubleToString(balance, 2) + ",\\"equity\\":" + DoubleToString(equity, 2) + "}";
   ArrayResize(data, StringLen(payload));
   StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   
   string updateURL = InpUpdateURL;
   if(StringFind(updateURL, "?") < 0) updateURL = updateURL + "?apiKey=" + InpApiKey;
   else updateURL = updateURL + "&apiKey=" + InpApiKey;

   int res = WebRequest("POST", updateURL, headers, 4000, data, result, result_headers);
   if(res == 200)
   {
      Print("MarketAI: Status updated for signal ", signalId, " -> ", milestone);
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
   string headers = "Authorization: Bearer " + InpApiKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n";
   string url = InpEndpointURL;
   if(StringFind(url, "?") < 0) url = url + "?symbol=" + targetSymbol + "&apiKey=" + InpApiKey;
   else url = url + "&symbol=" + targetSymbol + "&apiKey=" + InpApiKey;
   
   int res = WebRequest("GET", url, headers, 5000, data, result, result_headers);
   
   if(res == -1)
   {
      int err = GetLastError();
      static datetime lastWebErr = 0;
      if(TimeCurrent() - lastWebErr > 30)
      {
         if(err == 4060)
            Print("[MarketAI EROARE 4060] URL-ul WebRequest nu este autorizat in MT5! Adaugati '", url, "' sau '${currentOrigin}' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
         else
            Print("[MarketAI EROARE WebRequest ", err, "] Conexiunea la server a esuat. Verificati internetul sau firewall-ul. URL: ", url);
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
         Print("[MarketAI HTTP ", res, "] Serverul a raspuns cu eroare: ", errBody, " | Verificati cheia InpApiKey: '", InpApiKey, "'");
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
                  int posLower = StringFind(comment, "sig_");
                  int posUpper = StringFind(comment, "SIG-");
                  int posUpper2 = StringFind(comment, "SIG_");
                  int bestPos = -1;
                  if(posLower != -1) bestPos = posLower;
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
                  else if(StringLen(comment) >= 8 && (StringFind(comment, "sig") != -1 || StringFind(comment, "SIG") != -1))
                  {
                     sigToCheck = comment;
                  }

                  bool shouldClose = false;
                  if(StringLen(sigToCheck) >= 8)
                  {
                     string searchKey = "\\\"" + sigToCheck + "\\\"";
                     if(StringFind(cancelArrStr, searchKey) != -1)
                     {
                        shouldClose = true;
                     }
                  }

                  if(shouldClose)
                  {
                     trade.PositionClose(posTicket);
                     Print("MarketAI: Position #", posTicket, " (Signal: ", sigToCheck, ") closed via Web Terminal command!");
                     SendStatusUpdate(sigToCheck, "CLOSED", "MANUAL_CLOSED", "CLOSED_VIA_TERMINAL");
                     if(activeSignalId == sigToCheck) activeSignalId = "";
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
                  int posLower = StringFind(comment, "sig_");
                  int posUpper = StringFind(comment, "SIG-");
                  int posUpper2 = StringFind(comment, "SIG_");
                  int bestPos = -1;
                  if(posLower != -1) bestPos = posLower;
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
                  else if(StringLen(comment) >= 8 && (StringFind(comment, "sig") != -1 || StringFind(comment, "SIG") != -1))
                  {
                     sigToCheck = comment;
                  }

                  bool shouldDelete = false;
                  if(StringLen(sigToCheck) >= 8)
                  {
                     string searchKey = "\\\"" + sigToCheck + "\\\"";
                     if(StringFind(cancelArrStr, searchKey) != -1)
                     {
                        shouldDelete = true;
                     }
                  }

                  if(shouldDelete)
                  {
                     trade.OrderDelete(ticket);
                     Print("MarketAI: Pending order #", ticket, " (Signal: ", sigToCheck, ") deleted via Web Terminal command.");
                     if(activeSignalId == sigToCheck) activeSignalId = "";
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

         double ask = SymbolInfoDouble(targetSymbol, SYMBOL_ASK);
         double bid = SymbolInfoDouble(targetSymbol, SYMBOL_BID);

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
         
         // Determine direction based on action string AND price orientation
         bool isSell = (StringFind(action, "SELL") != -1 || StringFind(action, "SHORT") != -1);
         if(!isSell && sl > 0 && ((entry > 0 && sl > entry) || (ask > 0 && sl > ask)))
         {
            isSell = true;
         }

         // Fallback SL/TP3 if 0
         if(!isSell)
         {
            if(sl <= 0)  sl  = NormalizeDouble(ask - 300 * point, digits);
            if(tp3 <= 0) tp3 = NormalizeDouble(ask + 600 * point, digits);
            if(tp1 <= 0) tp1 = NormalizeDouble(ask + 200 * point, digits);
            if(tp2 <= 0) tp2 = NormalizeDouble(ask + 400 * point, digits);
         }
         else
         {
            if(sl <= 0)  sl  = NormalizeDouble(bid + 300 * point, digits);
            if(tp3 <= 0) tp3 = NormalizeDouble(bid - 600 * point, digits);
            if(tp1 <= 0) tp1 = NormalizeDouble(bid - 200 * point, digits);
            if(tp2 <= 0) tp2 = NormalizeDouble(bid - 400 * point, digits);
         }

         // Validate and auto-adjust pending orders if market price has already crossed the level
         string orderExecAction = action;
         if(StringFind(action, "BUY_LIMIT") != -1)
         {
            if(entry <= 0 || entry >= (bid - minDistance))
            {
               orderExecAction = "BUY";
               entry = 0.0;
            }
         }
         else if(StringFind(action, "SELL_LIMIT") != -1)
         {
            if(entry <= 0 || entry <= (ask + minDistance))
            {
               orderExecAction = "SELL";
               entry = 0.0;
            }
         }
         else if(StringFind(action, "BUY_STOP") != -1)
         {
            if(entry <= 0 || entry <= (ask + minDistance))
            {
               orderExecAction = "BUY";
               entry = 0.0;
            }
         }
         else if(StringFind(action, "SELL_STOP") != -1)
         {
            if(entry <= 0 || entry >= (bid - minDistance))
            {
               orderExecAction = "SELL";
               entry = 0.0;
            }
         }

         // Ensure SL & TP strictly comply with broker minimum distance
         if(entry > 0.0)
         {
            // Pending orders: distance relative to entry price
            if(!isSell)
            {
               double maxAllowedSL = NormalizeDouble(entry - minDistance, digits);
               if(sl >= maxAllowedSL) sl = maxAllowedSL;

               double minAllowedTP = NormalizeDouble(entry + minDistance, digits);
               if(tp3 <= minAllowedTP) tp3 = minAllowedTP;
            }
            else
            {
               double minAllowedSL = NormalizeDouble(entry + minDistance, digits);
               if(sl <= minAllowedSL) sl = minAllowedSL;

               double maxAllowedTP = NormalizeDouble(entry - minDistance, digits);
               if(tp3 >= maxAllowedTP) tp3 = maxAllowedTP;
            }
         }
         else
         {
            // Market orders: In MT5, BUY SL is checked against Bid, SELL SL against Ask
            if(!isSell)
            {
               double maxAllowedSL = NormalizeDouble(bid - minDistance, digits);
               if(sl >= maxAllowedSL) sl = maxAllowedSL;

               double minAllowedTP = NormalizeDouble(ask + minDistance, digits);
               if(tp3 <= minAllowedTP) tp3 = minAllowedTP;
            }
            else
            {
               double minAllowedSL = NormalizeDouble(ask + minDistance, digits);
               if(sl <= minAllowedSL) sl = minAllowedSL;

               double maxAllowedTP = NormalizeDouble(bid - minDistance, digits);
               if(tp3 >= maxAllowedTP) tp3 = maxAllowedTP;
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
         
         // DYNAMIC LOT SIZE CALCULATION BASED ON % RISK & SL DISTANCE
         double tradePrice = (entry > 0) ? entry : (isSell ? bid : ask);
         double finalLot = CalculateLotSize(targetSymbol, tradePrice, sl, liveRiskPercent);
         
         bool orderSuccess = false;
         string orderComment = sigId;
         if(StringLen(orderComment) > 31) orderComment = StringSubstr(sigId, 0, 31);
         
         if(StringFind(orderExecAction, "BUY_LIMIT") != -1 && entry > 0)
         {
            orderSuccess = trade.BuyLimit(finalLot, entry, targetSymbol, sl, tp3, 0, 0, orderComment);
         }
         else if(StringFind(orderExecAction, "SELL_LIMIT") != -1 && entry > 0)
         {
            orderSuccess = trade.SellLimit(finalLot, entry, targetSymbol, sl, tp3, 0, 0, orderComment);
         }
         else if(StringFind(orderExecAction, "BUY_STOP") != -1 && entry > 0)
         {
            orderSuccess = trade.BuyStop(finalLot, entry, targetSymbol, sl, tp3, 0, 0, orderComment);
         }
         else if(StringFind(orderExecAction, "SELL_STOP") != -1 && entry > 0)
         {
            orderSuccess = trade.SellStop(finalLot, entry, targetSymbol, sl, tp3, 0, 0, orderComment);
         }
         else if(isSell)
         {
            orderSuccess = trade.Sell(finalLot, targetSymbol, 0.0, sl, tp3, orderComment);
         }
         else
         {
            orderSuccess = trade.Buy(finalLot, targetSymbol, 0.0, sl, tp3, orderComment);
         }

         // Two-stage fallback: If broker returns 10016/10015 (Invalid Stops / ECN Market Execution restriction)
         if(!orderSuccess && (trade.ResultRetcode() == 10016 || trade.ResultRetcode() == 10015))
         {
            Print("[MarketAI] Broker a returnat ", trade.ResultRetcode(), " (Invalid Stops/Price). Se reîncearcă plasarea fără SL/TP inițial și aplicarea imediată prin PositionModify...");
            if(isSell)
               orderSuccess = trade.Sell(finalLot, targetSymbol, 0.0, 0.0, 0.0, orderComment);
            else
               orderSuccess = trade.Buy(finalLot, targetSymbol, 0.0, 0.0, 0.0, orderComment);

            if(orderSuccess)
            {
               Sleep(150);
               double curBid = SymbolInfoDouble(targetSymbol, SYMBOL_BID);
               double curAsk = SymbolInfoDouble(targetSymbol, SYMBOL_ASK);
               double curMinDist = MathMax((double)SymbolInfoInteger(targetSymbol, SYMBOL_TRADE_STOPS_LEVEL), (double)SymbolInfoInteger(targetSymbol, SYMBOL_SPREAD)) * point;
               if(curMinDist < 10.0 * point) curMinDist = 10.0 * point;

               if(!isSell)
               {
                  if(sl >= (curBid - curMinDist)) sl = NormalizeDouble(curBid - curMinDist - 2 * point, digits);
                  if(tp3 <= (curAsk + curMinDist)) tp3 = NormalizeDouble(curAsk + curMinDist + 2 * point, digits);
                  if(tickSize > 0)
                  {
                     sl = NormalizeDouble(MathFloor(sl / tickSize) * tickSize, digits);
                     tp3 = NormalizeDouble(MathCeil(tp3 / tickSize) * tickSize, digits);
                  }
               }
               else
               {
                  if(sl <= (curAsk + curMinDist)) sl = NormalizeDouble(curAsk + curMinDist + 2 * point, digits);
                  if(tp3 >= (curBid - curMinDist)) tp3 = NormalizeDouble(curBid - curMinDist - 2 * point, digits);
                  if(tickSize > 0)
                  {
                     sl = NormalizeDouble(MathCeil(sl / tickSize) * tickSize, digits);
                     tp3 = NormalizeDouble(MathFloor(tp3 / tickSize) * tickSize, digits);
                  }
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
            
            Print("[MarketAI SUCCES] Tranzactie executata cu succes (", action, ") Lot: ", finalLot, " (Risc: ", liveRiskPercent, "%) pe ", targetSymbol, " Signal ID: ", sigId, " SL: ", sl, " TP3: ", tp3);
            SendStatusUpdate(sigId, "RUNNING", "OPENED", "ENTRY");
         }
         else
         {
            Print("[MarketAI EROARE ORDIN] Ordinul nu a putut fi plasat pe ", targetSymbol, "! Actiune: ", action, " Lot: ", finalLot, " Cod MT5: ", trade.ResultRetcode(), " (", trade.ResultRetcodeDescription(), ")");
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
            // 1. AUTO BREAK-EVEN & TP1 PARTIAL CLOSE (70%)
            if(!tp1Hit && activeTp1 > 0 && currentPrice >= activeTp1)
            {
               double partialVolume = NormalizeDouble(volume * 0.7, 2);
               if(partialVolume >= SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN))
               {
                  if(trade.PositionClosePartial(ticket, partialVolume))
                  {
                     tp1Hit = true;
                     Print("MarketAI: TP1 reached at ", currentPrice, "! Closed 70% partial.");
                     
                     // Move SL to Break-Even + 2 points buffer if Auto Break-Even enabled
                     if(liveAutoBreakEven)
                     {
                        double beSL = NormalizeDouble(openPrice + 2 * point, digits);
                        if(tickSize > 0) beSL = NormalizeDouble(MathFloor(beSL / tickSize) * tickSize, digits);
                        if(beSL > currentSL && beSL <= (bid - minDistance))
                        {
                           if(trade.PositionModify(ticket, beSL, currentTP))
                           {
                              Print("MarketAI: SL moved to Break-Even: ", beSL);
                           }
                        }
                     }
                     SendStatusUpdate(activeSignalId, "RUNNING", "PROFIT", "TP1");
                  }
               }
            }
            
            // 2. TP2 PARTIAL CLOSE (10%)
            if(tp1Hit && !tp2Hit && activeTp2 > 0 && currentPrice >= activeTp2)
            {
               double partialVolume = NormalizeDouble(volume * 0.1, 2);
               if(partialVolume >= SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN))
               {
                  if(trade.PositionClosePartial(ticket, partialVolume))
                  {
                     tp2Hit = true;
                     Print("MarketAI: TP2 reached at ", currentPrice, "! Closed 10% partial.");
                     SendStatusUpdate(activeSignalId, "RUNNING", "PROFIT", "TP2");
                  }
               }
            }
            
            // 3. SMART TRAILING STOP
            if(liveTrailingStop)
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
            // 1. AUTO BREAK-EVEN & TP1 PARTIAL CLOSE (70%)
            if(!tp1Hit && activeTp1 > 0 && currentPrice <= activeTp1)
            {
               double partialVolume = NormalizeDouble(volume * 0.7, 2);
               if(partialVolume >= SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN))
               {
                  if(trade.PositionClosePartial(ticket, partialVolume))
                  {
                     tp1Hit = true;
                     Print("MarketAI: TP1 reached at ", currentPrice, "! Closed 70% partial.");
                     
                     // Move SL to Break-Even - 2 points buffer if Auto Break-Even enabled
                     if(liveAutoBreakEven)
                     {
                        double beSL = NormalizeDouble(openPrice - 2 * point, digits);
                        if(tickSize > 0) beSL = NormalizeDouble(MathCeil(beSL / tickSize) * tickSize, digits);
                        if((currentSL == 0 || beSL < currentSL) && beSL >= (ask + minDistance))
                        {
                           if(trade.PositionModify(ticket, beSL, currentTP))
                           {
                              Print("MarketAI: SL moved to Break-Even: ", beSL);
                           }
                        }
                     }
                     SendStatusUpdate(activeSignalId, "RUNNING", "PROFIT", "TP1");
                  }
               }
            }
            
            // 2. TP2 PARTIAL CLOSE (10%)
            if(tp1Hit && !tp2Hit && activeTp2 > 0 && currentPrice <= activeTp2)
            {
               double partialVolume = NormalizeDouble(volume * 0.1, 2);
               if(partialVolume >= SymbolInfoDouble(targetSymbol, SYMBOL_VOLUME_MIN))
               {
                  if(trade.PositionClosePartial(ticket, partialVolume))
                  {
                     tp2Hit = true;
                     Print("MarketAI: TP2 reached at ", currentPrice, "! Closed 10% partial.");
                     SendStatusUpdate(activeSignalId, "RUNNING", "PROFIT", "TP2");
                  }
               }
            }
            
            // 3. SMART TRAILING STOP
            if(liveTrailingStop)
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
