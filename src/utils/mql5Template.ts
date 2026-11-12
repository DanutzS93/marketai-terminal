export const MT5_EA_VERSION = '4.89';

export function getMql5EaCode(
  mt5Endpoint: string,
  mt5UpdateEndpoint: string,
  apiKey: string,
  currentOrigin: string,
  accountName: string = 'Cont 1 (Principal)'
): string {
  return `//+------------------------------------------------------------------+
//|                                         MarketAI_MT5_Bridge.mq5 |
//|                                  Copyright 2026, MarketAI Signals |
//|                                             https://ai.studio     |
//+------------------------------------------------------------------+
#property copyright "MarketAI Signals"
#property link      "https://ai.studio"
#property version   "${MT5_EA_VERSION}"
#property description "MarketAI MT5 Auto-Trading Bridge v${MT5_EA_VERSION} for ${accountName} with Exact Broker PnL Sync"

#include <Trade\\Trade.mqh>
CTrade trade;

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+
input group "=== [1] Web API & Connection Settings ==="
input string   InpEndpointURL           = "${mt5Endpoint}";
input string   InpUpdateURL             = "${mt5UpdateEndpoint}";
input string   InpApiKey                = "${apiKey}"; // Cheia MT5 API Personalizata (Asigura izolarea 100% per cont)
input string   InpAccountSlotName       = "${accountName}"; // Identificator slot cont (ex: Cont 1, Cont 2)
input string   InpBrokerSymbol          = "";             // Custom broker symbol (e.g. EURUSD.pro, XAUUSD, NAS100, leave blank for chart symbol)
input int      InpMagicNumber           = 26082026;       // EA Magic Number
input int      InpCheckInterval         = 2;              // Fast polling & sync interval in seconds (2s for ultra-fast live PnL updates)

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
bool   g_pendingTradeSync = false;

struct TrackedTrade {
   string signalId;
   ulong  positionId;
   ulong  positionTicket;
   string symbol;
   long   posType;
   double openPrice;
   double volume;
   double tp1;
   double tp2;
   double tp3;
   bool   tp1Hit;
   bool   tp2Hit;
   bool   isClosed;
   double finalPnl;
   datetime openTime;
   datetime lastCloseAttempt;
};
TrackedTrade trackedTrades[];

struct SignalTargetInfo
{
   string signalId;
   string symbol;
   double tp1;
   double tp2;
   double tp3;
};
SignalTargetInfo signalTargets[];

void StoreSignalTargets(string sId, string sym, double t1, double t2, double t3)
{
   if(sId == "") return;
   for(int k = 0; k < ArraySize(signalTargets); k++)
   {
      if(signalTargets[k].signalId == sId)
      {
         signalTargets[k].symbol = sym;
         if(t1 > 0) signalTargets[k].tp1 = t1;
         if(t2 > 0) signalTargets[k].tp2 = t2;
         if(t3 > 0) signalTargets[k].tp3 = t3;
         return;
      }
   }
   int sz = ArraySize(signalTargets);
   ArrayResize(signalTargets, sz + 1);
   signalTargets[sz].signalId = sId;
   signalTargets[sz].symbol = sym;
   signalTargets[sz].tp1 = t1;
   signalTargets[sz].tp2 = t2;
   signalTargets[sz].tp3 = t3;
}

void LookupSignalTargets(string sId, double &t1, double &t2, double &t3)
{
   t1 = 0.0; t2 = 0.0; t3 = 0.0;
   if(sId == "") return;
   for(int k = 0; k < ArraySize(signalTargets); k++)
   {
      if(signalTargets[k].signalId == sId)
      {
         t1 = signalTargets[k].tp1;
         t2 = signalTargets[k].tp2;
         t3 = signalTargets[k].tp3;
         return;
      }
   }
}

// Forward declarations
bool SendTradeUpdate(string signalId, string status, string outcome, string milestone, double pnl = 0.0, double exitPrice = 0.0, bool isManualClose = false);
void UpdateChartHUD();

int FindTrackedTradeIndex(ulong posId, ulong posTicket)
{
   for(int k = 0; k < ArraySize(trackedTrades); k++)
   {
      if((posId > 0 && trackedTrades[k].positionId == posId) || (posTicket > 0 && trackedTrades[k].positionTicket == posTicket))
         return k;
   }
   return -1;
}

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
//| Check if symbol has futures indicator (.F, _F, -F, FUT, -, etc.) |
//+------------------------------------------------------------------+
bool HasFuturesTagMql(string sym)
{
   if(StringFind(sym, "CASH") != -1 || StringFind(sym, "SPOT") != -1) return false;
   
   // Exclude common broker account type suffixes before checking for futures tags
   string baseSym = sym;
   int dashPos = StringFind(baseSym, "-");
   if(dashPos != -1)
   {
      string suffix = StringSubstr(baseSym, dashPos + 1);
      StringToUpper(suffix);
      if(suffix == "VIP" || suffix == "PRO" || suffix == "RAW" || suffix == "ECN" ||
         suffix == "ZERO" || suffix == "MICRO" || suffix == "MINI" || suffix == "STD" || suffix == "STP")
      {
         baseSym = StringSubstr(baseSym, 0, dashPos);
      }
   }
   int underPos = StringFind(baseSym, "_");
   if(underPos != -1)
   {
      string suffix = StringSubstr(baseSym, underPos + 1);
      StringToUpper(suffix);
      if(suffix == "VIP" || suffix == "PRO" || suffix == "RAW" || suffix == "ECN" ||
         suffix == "ZERO" || suffix == "MICRO" || suffix == "MINI" || suffix == "STD" || suffix == "STP")
      {
         baseSym = StringSubstr(baseSym, 0, underPos);
      }
   }

   // Strip trailing dots, hashes, pluses (e.g. NAS100., DJ30., US30., EURUSD.)
   while(StringLen(baseSym) > 0)
   {
      string lastCharStr = StringSubstr(baseSym, StringLen(baseSym) - 1);
      if(lastCharStr == "." || lastCharStr == "#" || lastCharStr == "+")
      {
         baseSym = StringSubstr(baseSym, 0, StringLen(baseSym) - 1);
      }
      else
      {
         break;
      }
   }

   string upperClean = baseSym;
   StringToUpper(upperClean);

   // Exact known Cash / Spot Indices are NEVER futures:
   if(upperClean == "DJ30" || upperClean == "US30" || upperClean == "USA30" || upperClean == "WS30" ||
      upperClean == "WALLST30" || upperClean == "WALLSTREET" || upperClean == "DOW" || upperClean == "DOW30" || upperClean == "DJI" ||
      upperClean == "NAS100" || upperClean == "US100" || upperClean == "USA100" || upperClean == "USTEC" || upperClean == "NDX" ||
      upperClean == "SPX500" || upperClean == "SP500" || upperClean == "US500" || upperClean == "USA500" || upperClean == "SPX" ||
      upperClean == "XAUUSD" || upperClean == "GOLD" ||
      upperClean == "EURUSD" || upperClean == "GBPUSD" || upperClean == "USDJPY")
   {
      return false;
   }

   if(StringFind(baseSym, ".F") != -1 || StringFind(baseSym, "_F") != -1 || StringFind(baseSym, "-F") != -1 || StringFind(baseSym, "/F") != -1) return true;
   if(StringFind(baseSym, ".FT") != -1 || StringFind(baseSym, "_FT") != -1 || StringFind(baseSym, "FT.") != -1 || StringFind(baseSym, "FUT") != -1) return true;
   if(StringSubstr(baseSym, StringLen(baseSym) - 1) == "-") return true; // XM Global futures: US100-, US500-, US30-, GOLD-
   if(StringFind(baseSym, "@") != -1) return true; // CME prefix: @NQ, @ES, @YM, @GC
   
   int len = StringLen(baseSym);
   if(len > 1)
   {
      // Ends with 'F' or "FT"
      if(StringSubstr(baseSym, len - 2) == "FT") return true;
      if(StringSubstr(baseSym, len - 1) == "F") return true;
   }
   
   // Check CME/Dated futures expiry patterns like JAN..DEC
   if(StringFind(baseSym, "JAN") != -1 || StringFind(baseSym, "FEB") != -1 || StringFind(baseSym, "MAR") != -1 ||
      StringFind(baseSym, "APR") != -1 || StringFind(baseSym, "MAY") != -1 || StringFind(baseSym, "JUN") != -1 ||
      StringFind(baseSym, "JUL") != -1 || StringFind(baseSym, "AUG") != -1 || StringFind(baseSym, "SEP") != -1 ||
      StringFind(baseSym, "OCT") != -1 || StringFind(baseSym, "NOV") != -1 || StringFind(baseSym, "DEC") != -1)
   {
      return true;
   }

   // CME Single-letter month code + 1 or 2 digits at end (e.g. Z26, H27, M6)
   // NOT applicable to base spot indices whose names end in numbers (e.g. DJ30, US30, NAS100)
   if(len >= 3)
   {
      ushort lastChar = StringGetCharacter(baseSym, len - 1);
      if(lastChar >= '0' && lastChar <= '9')
      {
         int monthPos = len - 2;
         ushort prevChar = StringGetCharacter(baseSym, monthPos);
         if(prevChar >= '0' && prevChar <= '9')
         {
            monthPos = len - 3;
         }
         if(monthPos >= 0)
         {
            string rootBeforeMonth = StringSubstr(baseSym, 0, monthPos);
            StringToUpper(rootBeforeMonth);
            // Protect indices like DJ30 (root DJ + J30), US30, etc.
            if(rootBeforeMonth != "DJ" && rootBeforeMonth != "US" && rootBeforeMonth != "USA" && rootBeforeMonth != "WS")
            {
               ushort mCode = StringGetCharacter(baseSym, monthPos);
               if(mCode == 'F' || mCode == 'G' || mCode == 'H' || mCode == 'J' || mCode == 'K' ||
                  mCode == 'M' || mCode == 'N' || mCode == 'Q' || mCode == 'U' || mCode == 'V' ||
                  mCode == 'X' || mCode == 'Z')
               {
                  return true;
               }
            }
         }
      }
   }
   
   return false;
}

bool IsGoldFuturesMql(string sym)
{
   if(StringFind(sym, "CASH") != -1 || StringFind(sym, "SPOT") != -1) return false;
   // AMP CME Futures: GC, MGC (e.g. GC, GCZ26, @GC, GC#, GC.F, MGC, MGCZ26)
   if(sym == "GC" || sym == "MGC" || StringFind(sym, "@GC") != -1 || StringFind(sym, "GC#") != -1 || StringFind(sym, "MGC#") != -1 || StringFind(sym, "MGC") != -1 ||
      (StringFind(sym, "GC") == 0 && StringLen(sym) <= 6 && (HasFuturesTagMql(sym) || StringLen(sym) >= 3))) return true;
      
   // BlackBull (XAUUSD.f, GOLD.f), XM (GOLD-, GOLD-DEC26), Generic (GC.F, XAUUSDft, etc.)
   if((StringFind(sym, "GOLD") != -1 || StringFind(sym, "XAU") != -1) && HasFuturesTagMql(sym)) return true;
   return false;
}

bool IsGoldSpotMql(string sym)
{
   if(IsGoldFuturesMql(sym)) return false;
   return (StringFind(sym, "XAU") != -1 || StringFind(sym, "GOLD") != -1);
}

bool IsNasdaqFuturesMql(string sym)
{
   if(StringFind(sym, "CASH") != -1 || StringFind(sym, "SPOT") != -1) return false;
   // AMP CME Futures: NQ, MNQ, ENQ (e.g. NQ, MNQ, ENQ, NQZ26, MNQZ26, ENQZ26, @NQ, NQ#, NQ.F)
   if(StringFind(sym, "NQ") != -1 || StringFind(sym, "MNQ") != -1 || StringFind(sym, "ENQ") != -1) return true;
   // BlackBull (USTEC.f, US100.f, NAS100.f, NDX.f), XM (US100-, US100-DEC26), Generic (NQ.F, NAS100ft, etc.)
   if((StringFind(sym, "NAS") != -1 || StringFind(sym, "US100") != -1 || StringFind(sym, "USA100") != -1 || StringFind(sym, "USTEC") != -1 || StringFind(sym, "NDX") != -1) && HasFuturesTagMql(sym)) return true;
   return false;
}

bool IsNasdaqSpotMql(string sym)
{
   if(IsNasdaqFuturesMql(sym)) return false;
   return (StringFind(sym, "NAS100") != -1 || StringFind(sym, "NASDAQ") != -1 || StringFind(sym, "US100") != -1 || StringFind(sym, "USA100") != -1 || StringFind(sym, "USTEC") != -1 || StringFind(sym, "NDX") != -1 || StringFind(sym, "NAS") == 0);
}

bool IsSpxFuturesMql(string sym)
{
   if(StringFind(sym, "CASH") != -1 || StringFind(sym, "SPOT") != -1) return false;
   // Avoid false matches for European indices like Euro Stoxx (ESTX50) or Spain (ESP35)
   if(StringFind(sym, "ESTX") != -1 || StringFind(sym, "ESP35") != -1 || StringFind(sym, "ES35") != -1) return false;
   
   // AMP CME Futures: ES, MES, EP (e.g. ES, ESM26, ESZ26, @ES, ES#, ES.F, MES, MESZ26, EP, EPZ26)
   if(sym == "ES" || sym == "MES" || sym == "EP" ||
      StringFind(sym, "@ES") != -1 || StringFind(sym, "ES#") != -1 || StringFind(sym, "ES.F") != -1 || StringFind(sym, "ES_F") != -1 ||
      StringFind(sym, "MES") != -1 || (StringFind(sym, "EP") == 0 && StringLen(sym) <= 5)) return true;
      
   if((StringFind(sym, "ES") == 0 && StringLen(sym) <= 6) && (StringFind(sym, "500") != -1 || HasFuturesTagMql(sym))) return true;
   
   // BlackBull (US500.f, SPX500.f), XM (US500-, US500-DEC26), Generic (SPX500ft, etc.)
   if((StringFind(sym, "SPX") != -1 || StringFind(sym, "US500") != -1 || StringFind(sym, "USA500") != -1 || StringFind(sym, "SP500") != -1) && HasFuturesTagMql(sym)) return true;
   
   return false;
}

bool IsSpxSpotMql(string sym)
{
   if(IsSpxFuturesMql(sym)) return false;
   if(StringFind(sym, "ESTX") != -1 || StringFind(sym, "ESP35") != -1 || StringFind(sym, "ES35") != -1) return false;
   return (StringFind(sym, "SPX500") != -1 || StringFind(sym, "US500") != -1 || StringFind(sym, "USA500") != -1 || StringFind(sym, "SP500") != -1 || StringFind(sym, "SPX") != -1);
}

bool IsDowFuturesMql(string sym)
{
   if(StringFind(sym, "CASH") != -1 || StringFind(sym, "SPOT") != -1) return false;
   // AMP CME Futures: YM, MYM (e.g. YM, YMZ26, @YM, YM#, YM.F, MYM, MYMZ26)
   if(StringFind(sym, "YM") != -1 || StringFind(sym, "MYM") != -1) return true;
   // BlackBull (US30.f, DJ30.f, WALLST30.f), XM (US30-, US30-DEC26), Generic (YM.F, US30ft, DJ30ft, etc.)
   if((StringFind(sym, "US30") != -1 || StringFind(sym, "USA30") != -1 || StringFind(sym, "DJ30") != -1 || StringFind(sym, "DOW") != -1 || StringFind(sym, "WS30") != -1 || StringFind(sym, "WALLST") != -1 || StringFind(sym, "DJI") != -1) && HasFuturesTagMql(sym)) return true;
   return false;
}

bool IsDowSpotMql(string sym)
{
   if(IsDowFuturesMql(sym)) return false;
   return (StringFind(sym, "US30") != -1 || StringFind(sym, "USA30") != -1 || StringFind(sym, "DJ30") != -1 || StringFind(sym, "DOW") != -1 || StringFind(sym, "WS30") != -1 || StringFind(sym, "WALLST") != -1 || StringFind(sym, "DJI") != -1 || sym == "DJ");
}

//+------------------------------------------------------------------+
//| Symbol Matching Helper (Supports BlackBull, XM, AMP, and Generic)|
//+------------------------------------------------------------------+
bool DoSymbolsMatch(string chartSym, string sigSym)
{
   if(chartSym == "" || sigSym == "") return true;
   string c = chartSym;
   string s = sigSym;
   StringTrimLeft(c);
   StringTrimRight(c);
   StringTrimLeft(s);
   StringTrimRight(s);
   StringToUpper(c);
   StringToUpper(s);
   
   // 1. STRICT SEPARATION: GOLD SPOT (XAUUSD) vs GOLD FUTURES (GC.F / XAUUSD.f / GC)
   bool sigIsGoldFutures   = IsGoldFuturesMql(s);
   bool chartIsGoldFutures = IsGoldFuturesMql(c);
   bool sigIsGoldSpot      = IsGoldSpotMql(s);
   bool chartIsGoldSpot    = IsGoldSpotMql(c);

   if(sigIsGoldFutures) return chartIsGoldFutures;
   if(sigIsGoldSpot)    return chartIsGoldSpot;

   // 2. STRICT SEPARATION: NASDAQ SPOT (NAS100/US100/USTEC/US100Cash) vs NASDAQ FUTURES (NQ.F/USTEC.f/NQ/MNQ/ENQ)
   bool sigIsNasFutures   = IsNasdaqFuturesMql(s);
   bool chartIsNasFutures = IsNasdaqFuturesMql(c);
   bool sigIsNasSpot      = IsNasdaqSpotMql(s);
   bool chartIsNasSpot    = IsNasdaqSpotMql(c);

   if(sigIsNasFutures) return chartIsNasFutures;
   if(sigIsNasSpot)    return chartIsNasSpot;

   // 3. STRICT SEPARATION: SPX500 SPOT (SPX500/US500/US500Cash) vs S&P 500 FUTURES (ES.F/US500.f/ES/MES/EP)
   bool sigIsSpxFutures   = IsSpxFuturesMql(s);
   bool chartIsSpxFutures = IsSpxFuturesMql(c);
   bool sigIsSpxSpot      = IsSpxSpotMql(s);
   bool chartIsSpxSpot    = IsSpxSpotMql(c);

   if(sigIsSpxFutures) return chartIsSpxFutures;
   if(sigIsSpxSpot)    return chartIsSpxSpot;

   // 4. STRICT SEPARATION: DOW JONES SPOT (US30/US30Cash/DJ30) vs DOW JONES FUTURES (YM.F/US30.f/YM/MYM)
   bool sigIsDowFutures   = IsDowFuturesMql(s);
   bool chartIsDowFutures = IsDowFuturesMql(c);
   bool sigIsDowSpot      = IsDowSpotMql(s);
   bool chartIsDowSpot    = IsDowSpotMql(c);

   if(sigIsDowFutures) return chartIsDowFutures;
   if(sigIsDowSpot)    return chartIsDowSpot;

   // Direct match
   if(c == s || StringFind(c, s) != -1 || StringFind(s, c) != -1) return true;
   
   // Forex Pairs Matching (including CME futures EU6, 6E, BP6, 6B, JY6, 6J, and broker suffixes .pro, micro, #)
   if((StringFind(s, "EURUSD") != -1 || StringFind(s, "EUR/USD") != -1) && (StringFind(c, "EURUSD") != -1 || StringFind(c, "EU6") != -1 || StringFind(c, "6E") != -1)) return true;
   if((StringFind(s, "GBPUSD") != -1 || StringFind(s, "GBP/USD") != -1) && (StringFind(c, "GBPUSD") != -1 || StringFind(c, "BP6") != -1 || StringFind(c, "6B") != -1)) return true;
   if((StringFind(s, "USDJPY") != -1 || StringFind(s, "USD/JPY") != -1) && (StringFind(c, "USDJPY") != -1 || StringFind(c, "JY6") != -1 || StringFind(c, "6J") != -1)) return true;
   
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
//| Extract Nested JSON object value (with brace depth tracking)     |
//+------------------------------------------------------------------+
string ExtractJsonNestedValue(string json, string parentKey, string key)
{
   int pPos = StringFind(json, "\\"" + parentKey + "\\":");
   if(pPos == -1) return "";
   int bStart = StringFind(json, "{", pPos);
   if(bStart == -1) return "";
   
   int braceCount = 0;
   int bEnd = -1;
   int len = StringLen(json);
   for(int i = bStart; i < len; i++)
   {
      ushort c = StringGetCharacter(json, i);
      if(c == '{') braceCount++;
      else if(c == '}')
      {
         braceCount--;
         if(braceCount == 0)
         {
            bEnd = i;
            break;
         }
      }
   }
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

   if(StringFind(InpUpdateURL, "fly.dev") >= 0 || StringFind(InpEndpointURL, "fly.dev") >= 0)
   {
      Print("[MarketAI] InpUpdateURL / InpEndpointURL contineau vechiul domeniu fly.dev. Redirectionare automata garantata la: ", "${currentOrigin}");
   }
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   Print("MarketAI MT5 Bridge v", "${MT5_EA_VERSION}", " [", InpAccountSlotName, "] initialized with Exact Broker PnL Engine. Target Symbol: ", targetSymbol, " Magic: ", InpMagicNumber, " Connected Account: #", login, " (", serverName, ") [", company, "]");
   
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

string g_reportedCancelledSigIds[];

bool IsSignalCancelReported(string sId)
{
   if(sId == "") return false;
   for(int k = 0; k < ArraySize(g_reportedCancelledSigIds); k++)
   {
      if(g_reportedCancelledSigIds[k] == sId) return true;
   }
   return false;
}

void MarkSignalCancelReported(string sId)
{
   if(sId == "" || IsSignalCancelReported(sId)) return;
   int sz = ArraySize(g_reportedCancelledSigIds);
   ArrayResize(g_reportedCancelledSigIds, sz + 1);
   g_reportedCancelledSigIds[sz] = sId;
}

void CheckCancelledOrdersInHistory()
{
   static datetime lastHistOrderCheck = 0;
   datetime now = TimeCurrent();
   if(now - lastHistOrderCheck < 3) return; // Check history every 3s
   lastHistOrderCheck = now;

   if(!HistorySelect(now - 86400, now)) return;

   int totalHist = HistoryOrdersTotal();
   for(int i = totalHist - 1; i >= 0 && i >= totalHist - 60; i--)
   {
      ulong ticket = HistoryOrderGetTicket(i);
      if(ticket > 0)
      {
         long state = HistoryOrderGetInteger(ticket, ORDER_STATE);
         if(state == ORDER_STATE_CANCELED || state == ORDER_STATE_EXPIRED || state == ORDER_STATE_REJECTED)
         {
            string comm = HistoryOrderGetString(ticket, ORDER_COMMENT);
            string sigId = ExtractSignalIdFromText(comm);
            if(sigId != "" && !IsSignalCancelReported(sigId))
            {
               MarkSignalCancelReported(sigId);
               Print("[MarketAI] Ordin pending anulat/sters din MT5 identificat in istoric: #", ticket, " (Signal: ", sigId, "). Se trimite anularea spre platforma...");
               SendTradeUpdate(sigId, "CANCELLED", "CANCELLED", "MANUAL_CANCEL", 0.0, 0.0, true);
               g_pendingTradeSync = true;
            }
         }
      }
   }
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
      // Non-blocking asynchronous notification: set flag so OnTimer flushes sync without freezing main trading thread
      g_pendingTradeSync = true;
      UpdateChartHUD();
   }
   else if(trans.type == TRADE_TRANSACTION_ORDER_DELETE)
   {
      // A pending order was deleted or cancelled in MT5 (e.g. user clicked X on a Buy Limit / Sell Limit)
      if(HistoryOrderSelect(trans.order))
      {
         long ordState = HistoryOrderGetInteger(trans.order, ORDER_STATE);
         if(ordState == ORDER_STATE_CANCELED || ordState == ORDER_STATE_EXPIRED || ordState == ORDER_STATE_REJECTED)
         {
            string comm = HistoryOrderGetString(trans.order, ORDER_COMMENT);
            string sigId = ExtractSignalIdFromText(comm);
            if(sigId != "")
            {
               MarkSignalCancelReported(sigId);
               Print("[MarketAI] Ordin pending #", trans.order, " (Signal: ", sigId, ") a fost anulat/sters direct din MT5! Notificare imediata catre platforma...");
               SendTradeUpdate(sigId, "CANCELLED", "CANCELLED", "MANUAL_CANCEL", 0.0, 0.0, true);
               g_pendingTradeSync = true;
               UpdateChartHUD();
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Expert tick function: fast floating PnL synchronization on ticks |
//+------------------------------------------------------------------+
void OnTick()
{
   if(PositionsTotal() > 0)
   {
      static ulong lastTickSyncTime = 0;
      ulong nowTick = GetTickCount64();
      // Sync live floating PnL on price ticks at most once per second
      if(nowTick - lastTickSyncTime >= 1000)
      {
         lastTickSyncTime = nowTick;
         SendAccountSync();
      }
   }
}

//+------------------------------------------------------------------+
//| Expert timer function (polls Web API and manages positions)      |
//+------------------------------------------------------------------+
void OnTimer()
{
   static bool isBusy = false;
   if(isBusy) return;
   isBusy = true;

   static int syncCounter = 0;
   syncCounter++;

   if(g_pendingTradeSync)
   {
      g_pendingTradeSync = false;
      CheckAndReportTrackedTrades();
      CheckCancelledOrdersInHistory();
      SendAccountSync();
   }

   FetchAndExecuteSignals();
   ManageActivePositions();
   CheckAndReportTrackedTrades();
   CheckCancelledOrdersInHistory();

   // Sync historical closed trades periodically every ~3 minutes (every 90 timer ticks = 180s when interval=2)
   if(syncCounter % 90 == 0)
   {
      SyncClosedHistoricalTrades();
   }

   // Sync account and open positions:
   // - Every timer tick (every 2s) if there are open positions, to ensure real-time PnL
   // - Every 5 timer ticks (~10s) when idle, to minimize network bandwidth
   if(PositionsTotal() > 0 || (syncCounter % 5 == 0))
   {
      SendAccountSync();
   }

   UpdateChartHUD();
   isBusy = false;
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
   if(StringFind(u, "fly.dev") >= 0)
   {
      u = "${currentOrigin}";
   }
   return u;
}

//+------------------------------------------------------------------+
//| Extract signal ID from order or deal comment                     |
//+------------------------------------------------------------------+
string ExtractSignalIdFromText(string text)
{
   if(text == "") return "";
   int p = StringFind(text, "custom_sig_");
   if(p == -1) p = StringFind(text, "scalp_");
   if(p == -1) p = StringFind(text, "sig_");
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
//| Send account balance, equity & login info to MarketAI            |
//+------------------------------------------------------------------+
void SendAccountSync()
{
   char data[];
   char result[];
   string result_headers;
   string cleanKey = GetCleanApiKey();
   string headers = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n" +
                    "User-Agent: Mozilla/5.0 MarketAI-Bridge/${MT5_EA_VERSION}\\r\\n" +
                    "Connection: close\\r\\n";
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string serverName = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   // Smart throttle:
   // If there are open positions, sync as fast as every 1 second when equity or floating profit moves
   // If idle (no open positions), sync every 10 seconds to keep connection alive
   static ulong lastAccSyncTick = 0;
   static double lastSyncedBalance = 0;
   static double lastSyncedEquity = 0;
   ulong nowTick = GetTickCount64();

   if(PositionsTotal() > 0)
   {
      // Allow syncing at most once every 1000ms
      if(nowTick - lastAccSyncTick < 1000)
      {
         return;
      }
      // If equity & balance haven't changed at all, throttle to once every 3000ms
      if(nowTick - lastAccSyncTick < 3000 && MathAbs(equity - lastSyncedEquity) < 0.01 && MathAbs(balance - lastSyncedBalance) < 0.01)
      {
         return;
      }
   }
   else
   {
      // Idle mode: throttle to once every 10 seconds if balance and equity are unchanged
      if(nowTick - lastAccSyncTick < 3000)
      {
         return;
      }
      if(nowTick - lastAccSyncTick < 10000 && MathAbs(balance - lastSyncedBalance) < 0.01 && MathAbs(equity - lastSyncedEquity) < 0.01)
      {
         return;
      }
   }
   lastAccSyncTick = nowTick;
   lastSyncedBalance = balance;
   lastSyncedEquity = equity;
   
   // Build JSON array of all open positions in MT5
   string posJson = "[";
   int posCount = 0;
   for(int p = PositionsTotal() - 1; p >= 0; p--)
   {
      ulong t = PositionGetTicket(p);
      if(t > 0)
      {
         string comm = PositionGetString(POSITION_COMMENT);
         string sigId = ExtractSignalIdFromText(comm);
         string sym = PositionGetString(POSITION_SYMBOL);
         long pType = PositionGetInteger(POSITION_TYPE);
         double oPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double cPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
         double vol = PositionGetDouble(POSITION_VOLUME);
         double pProf = PositionGetDouble(POSITION_PROFIT);
         double pSwap = PositionGetDouble(POSITION_SWAP);
         double netProfit = pProf + pSwap;
         int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
         if(digits <= 0) digits = 2;

         if(posCount > 0) posJson += ",";
         posJson += "{\\"ticket\\":" + IntegerToString(t) +
                    ",\\"symbol\\":\\"" + sym + "\\"" +
                    ",\\"type\\":\\"" + (pType == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\\"" +
                    ",\\"volume\\":" + DoubleToString(vol, 2) +
                    ",\\"openPrice\\":" + DoubleToString(oPrice, digits) +
                    ",\\"currentPrice\\":" + DoubleToString(cPrice, digits) +
                    ",\\"profit\\":" + DoubleToString(netProfit, 2) +
                    ",\\"signalId\\":\\"" + sigId + "\\"}";
         posCount++;
      }
   }
   posJson += "]";

   // Build JSON array of all pending orders in MT5 (Buy Limit, Sell Limit, Buy Stop, Sell Stop)
   string ordJson = "[";
   int ordCount = 0;
   for(int o = OrdersTotal() - 1; o >= 0; o--)
   {
      ulong ot = OrderGetTicket(o);
      if(ot > 0)
      {
         string ocomm = OrderGetString(ORDER_COMMENT);
         string osigId = ExtractSignalIdFromText(ocomm);
         string osym = OrderGetString(ORDER_SYMBOL);
         long oType = OrderGetInteger(ORDER_TYPE);
         double oPrice = OrderGetDouble(ORDER_PRICE_OPEN);
         double oVol = OrderGetDouble(ORDER_VOLUME_INITIAL);
         int odigits = (int)SymbolInfoInteger(osym, SYMBOL_DIGITS);
         if(odigits <= 0) odigits = 2;

         string typeStr = "ORDER";
         if(oType == ORDER_TYPE_BUY_LIMIT) typeStr = "BUY_LIMIT";
         else if(oType == ORDER_TYPE_SELL_LIMIT) typeStr = "SELL_LIMIT";
         else if(oType == ORDER_TYPE_BUY_STOP) typeStr = "BUY_STOP";
         else if(oType == ORDER_TYPE_SELL_STOP) typeStr = "SELL_STOP";

         if(ordCount > 0) ordJson += ",";
         ordJson += "{\\"ticket\\":" + IntegerToString(ot) +
                    ",\\"symbol\\":\\"" + osym + "\\"" +
                    ",\\"type\\":\\"" + typeStr + "\\"" +
                    ",\\"volume\\":" + DoubleToString(oVol, 2) +
                    ",\\"openPrice\\":" + DoubleToString(oPrice, odigits) +
                    ",\\"currentPrice\\":" + DoubleToString(oPrice, odigits) +
                    ",\\"profit\\":0.0" +
                    ",\\"isPending\\":true" +
                    ",\\"signalId\\":\\"" + osigId + "\\"}";
         ordCount++;
      }
   }
   ordJson += "]";

   string payload = "{\\"accountNumber\\":\\"" + IntegerToString(login) + "\\",\\"accountServer\\":\\"" + serverName + "\\",\\"accountCurrency\\":\\"" + currency + "\\",\\"accountCompany\\":\\"" + company + "\\",\\"accountBalance\\":" + DoubleToString(balance, 2) + ",\\"equity\\":" + DoubleToString(equity, 2) + ",\\"positions\\":" + posJson + ",\\"orders\\":" + ordJson + "}";
   int copied = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0 && data[copied - 1] == 0) ArrayResize(data, copied - 1);
   ArrayResize(result, 0);
   ResetLastError();
   
   string origin = ForceHttps("${currentOrigin}");
   string accountURL = origin + "/api/mt5/account"; // API key sent only via Authorization header
   int res = WebRequest("POST", accountURL, headers, 6000, data, result, result_headers);
   if(res == -1)
   {
      int err = GetLastError();
      static datetime lastAccErr = 0;
      if(TimeCurrent() - lastAccErr > 60)
      {
         if(err == 4014 || err == 4060)
            Print("[MarketAI EROARE ", err, "] URL-ul '", origin, "' NU este autorizat in MT5! Adaugati '", origin, "' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
         else
            Print("[MarketAI EROARE WebRequest ", err, "] Sincronizarea contului a esuat (retea/firewall). Se reincearca automat.");
         lastAccErr = TimeCurrent();
      }
   }
   else if(res != 200)
   {
      int errCode = GetLastError();
      static datetime lastAccHttpErr = 0;
      if(TimeCurrent() - lastAccHttpErr > 60)
      {
         if(res >= 1000)
            Print("[MarketAI MT5 ", res, " / err ", errCode, "] Sincronizare cont: raspunsul serverului nu a sosit la timp (", DescribeWebRequestError(errCode), "). Se reincearca automat.");
         else
            Print("[MarketAI HTTP ", res, "] Sincronizare cont respinsa de server.");
         lastAccHttpErr = TimeCurrent();
      }
   }
}

//+------------------------------------------------------------------+
//| Human-readable description of MQL5 WebRequest error codes        |
//+------------------------------------------------------------------+
string DescribeWebRequestError(int err)
{
   if(err == 5200) return "URL invalid";
   if(err == 5201) return "conectare esuata la server";
   if(err == 5202) return "timeout - serverul nu a raspuns la timp";
   if(err == 5203) return "cerere esuata - retea, antivirus, proxy sau VPN";
   if(err == 4014 || err == 4060) return "URL neautorizat in Tools -> Options -> Expert Advisors";
   return "eroare interna WinINet";
}

//+------------------------------------------------------------------+
//| Calculate exact cumulative realized P&L for a position ticket    |
//| Sums profit, swap, commission across all entry and exit deals    |
//+------------------------------------------------------------------+
double GetRealizedProfitForPosition(ulong posId, double &lastExitPrice, bool &isManualClose)
{
   double totalProfit = 0.0;
   lastExitPrice = 0.0;
   isManualClose = false;
   
   // HistorySelectByPosition loads only this position's deals (much faster than full history)
   if(HistorySelectByPosition((long)posId))
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

                  long reason = HistoryDealGetInteger(dealTicket, DEAL_REASON);
                  // DEAL_REASON_CLIENT = 0, DEAL_REASON_MOBILE = 1, DEAL_REASON_WEB = 2
                  // ONLY explicit manual actions by the user on the closing deal
                  if(reason == 0 || reason == 1 || reason == 2)
                  {
                     isManualClose = true;
                  }
                  else
                  {
                     isManualClose = false;
                  }
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

// Backward-compatible overload
double GetRealizedProfitForPosition(ulong posId, double &lastExitPrice)
{
   bool dummyManual = false;
   return GetRealizedProfitForPosition(posId, lastExitPrice, dummyManual);
}

//+------------------------------------------------------------------+
//| Send trade execution, update & realized P&L to MarketAI Web API  |
//+------------------------------------------------------------------+
bool SendTradeUpdate(string signalId, string status, string outcome, string milestone, double pnl = 0.0, double exitPrice = 0.0, bool isManualClose = false)
{
   if(signalId == "") return true;
   
   char data[];
   char result[];
   string result_headers;
   string cleanKey = GetCleanApiKey();
   string headers = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                    "Content-Type: application/json\\r\\n" +
                    "User-Agent: Mozilla/5.0 MarketAI-Bridge/${MT5_EA_VERSION}\\r\\n" +
                    "Connection: close\\r\\n";
   
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

   string pnlJson = "";
   if(status == "CLOSED" || milestone == "POSITION_CLOSED" || milestone == "MANUAL_CLOSE" || isManualClose || milestone == "TP1_BREAK_EVEN")
   {
      pnlJson = ",\\"pnl\\":" + DoubleToString(pnl, 2) + ",\\"profit\\":" + DoubleToString(pnl, 2);
   }
   
   string payload = "{\\"signal_id\\":\\"" + signalId + "\\"," +
                    "\\"status\\":\\"" + status + "\\"," +
                    "\\"outcomeStatus\\":\\"" + outcome + "\\"," +
                    "\\"milestone\\":\\"" + milestone + "\\"," +
                    "\\"isManualClose\\":" + (isManualClose ? "true" : "false") +
                    pnlJson + exitPriceJson + "," +
                    "\\"accountNumber\\":\\"" + IntegerToString(login) + "\\"," +
                    "\\"accountServer\\":\\"" + serverName + "\\"," +
                    "\\"accountCurrency\\":\\"" + currency + "\\"," +
                    "\\"accountCompany\\":\\"" + company + "\\"," +
                    "\\"accountBalance\\":" + DoubleToString(balance, 2) + "," +
                    "\\"equity\\":" + DoubleToString(equity, 2) + "}";
                    
   int copied = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0 && data[copied - 1] == 0) ArrayResize(data, copied - 1);
   ArrayResize(result, 0);
   ResetLastError();
   
   string updateURL = "${mt5UpdateEndpoint}";
   if(InpUpdateURL != "" && StringFind(InpUpdateURL, "fly.dev") < 0)
   {
      updateURL = InpUpdateURL;
   }
   updateURL = ForceHttps(updateURL);
   // API key is sent only via Authorization header (never in URL / logs)

   int res = WebRequest("POST", updateURL, headers, 6000, data, result, result_headers);
   if(res == 200)
   {
      Print("[MarketAI] Status & Realized PnL updated for signal ", signalId, " -> ", milestone, " | PnL: $", DoubleToString(pnl, 2), (exitPrice > 0 ? (" @ " + DoubleToString(exitPrice, 2)) : ""));
      return true;
   }

   int err = GetLastError();
   string updOrigin = ForceHttps("${currentOrigin}");
   if(res == -1 && (err == 4014 || err == 4060))
      Print("[MarketAI EROARE ", err, "] URL-ul '", updOrigin, "' NU este autorizat in MT5! Adaugati '", updOrigin, "' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
   else if(res == -1 || res >= 1000)
      Print("[MarketAI MT5 ", res, " / err ", err, "] Update pentru semnalul ", signalId, " (", milestone, ") nu a ajuns la server (", DescribeWebRequestError(err), "). Se reincearca automat.");
   else
      Print("[MarketAI HTTP ", res, "] Update pentru semnalul ", signalId, " (", milestone, ") respins de server.");
   // 4xx = definitive rejection (do not retry forever); network / 5xx / 1003 = retry
   return (res >= 400 && res < 500);
}

// Backward compatibility wrapper
void SendStatusUpdate(string signalId, string status, string outcome, string milestone)
{
   SendTradeUpdate(signalId, status, outcome, milestone, 0.0, 0.0);
}

//+------------------------------------------------------------------+
//| Register or update tracked signal trade in memory                |
//+------------------------------------------------------------------+
void RegisterTrackedTrade(string sigId, ulong posTicket, ulong posId, string sym, long pType, double oPrice, double vol, double tp1Val = 0.0, double tp2Val = 0.0, double tp3Val = 0.0)
{
   if(sigId == "" || posId == 0) return;
   for(int i = 0; i < ArraySize(trackedTrades); i++)
   {
      if(trackedTrades[i].positionId == posId || (posTicket > 0 && trackedTrades[i].positionTicket == posTicket) || trackedTrades[i].signalId == sigId)
      {
         trackedTrades[i].positionTicket = posTicket;
         trackedTrades[i].positionId = posId;
         trackedTrades[i].signalId = sigId;
         trackedTrades[i].symbol = sym;
         trackedTrades[i].posType = pType;
         trackedTrades[i].openPrice = oPrice;
         trackedTrades[i].volume = vol;
         if(tp1Val > 0) trackedTrades[i].tp1 = tp1Val;
         if(tp2Val > 0) trackedTrades[i].tp2 = tp2Val;
         if(tp3Val > 0) trackedTrades[i].tp3 = tp3Val;
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
   trackedTrades[sz].tp1 = tp1Val;
   trackedTrades[sz].tp2 = tp2Val;
   trackedTrades[sz].tp3 = tp3Val;
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
            double sTp1 = 0, sTp2 = 0, sTp3 = 0;
            LookupSignalTargets(sigId, sTp1, sTp2, sTp3);
            RegisterTrackedTrade(sigId, t, posId, sym, pType, oPrice, vol, sTp1, sTp2, sTp3);
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
         // Throttle retries: don't hammer the server on every timer tick if update is in flight
         if(TimeCurrent() - trackedTrades[i].lastCloseAttempt < 10) continue;
         trackedTrades[i].lastCloseAttempt = TimeCurrent();

         // Position is closed in MT5!
         double exitPrice = 0.0;
         bool isManualClose = false;
         double realPnl = GetRealizedProfitForPosition(posId, exitPrice, isManualClose);
         trackedTrades[i].finalPnl = realPnl;
         
         string outcome = "";
         string milestone = "";
         if(trackedTrades[i].tp2Hit && realPnl > 0.01)
         {
            outcome = "TP2_HIT";
            milestone = "TP2_HIT";
            isManualClose = false;
         }
         else if(trackedTrades[i].tp1Hit && realPnl > 0.01)
         {
            outcome = "TP1_HIT";
            milestone = "TP1_HIT";
            isManualClose = false;
         }
         else if(isManualClose)
         {
            outcome = (realPnl > 0.01) ? "MANUAL_PROFIT" : ((realPnl < -0.01) ? "MANUAL_LOSS" : "MANUAL_BE");
            milestone = "MANUAL_CLOSE";
         }
         else
         {
            outcome = (realPnl > 0.01) ? "TP1_HIT" : ((realPnl < -0.01) ? "SL_HIT" : "BREAKEVEN");
            milestone = "POSITION_CLOSED";
         }
         
         // Mark closed only after the server confirmed; on HTTP 1003 / network error retry on next timer tick
         if(!SendTradeUpdate(trackedTrades[i].signalId, "CLOSED", outcome, milestone, realPnl, exitPrice, isManualClose))
            continue;
         trackedTrades[i].isClosed = true;
         Print("[MarketAI] Trade closed in MT5 for Signal ", trackedTrades[i].signalId, " (Pos #", posId, ") [Manual: ", isManualClose ? "YES" : "NO", "]! Realized PnL: $", DoubleToString(realPnl, 2), " Exit Price: ", exitPrice);
         
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
   static long g_syncedClosedPosIds[];

   // Phase 1: collect candidate (signalId, positionId) pairs from the last 30 days.
   // We must NOT call GetRealizedProfitForPosition() inside this loop, because it
   // changes the history selection and would corrupt the deal indexes being iterated.
   string candSig[];
   long   candPos[];
   datetime fromTime = TimeCurrent() - (30 * 86400);
   if(!HistorySelect(fromTime, TimeCurrent() + 86400)) return;

   int dealsTotal = HistoryDealsTotal();
   for(int i = dealsTotal - 1; i >= 0; i--)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
      if(!(magic == InpMagicNumber || InpMagicNumber == 0)) continue;

      string sigId = ExtractSignalIdFromText(HistoryDealGetString(dealTicket, DEAL_COMMENT));
      if(sigId == "")
      {
         ulong ordTicket = (ulong)HistoryDealGetInteger(dealTicket, DEAL_ORDER);
         if(HistoryOrderSelect(ordTicket))
            sigId = ExtractSignalIdFromText(HistoryOrderGetString(ordTicket, ORDER_COMMENT));
      }

      long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(sigId == "" || posId <= 0) continue;

      bool known = false;
      for(int k = 0; k < ArraySize(g_syncedClosedPosIds); k++)
         if(g_syncedClosedPosIds[k] == posId) { known = true; break; }
      for(int c = 0; !known && c < ArraySize(candPos); c++)
         if(candPos[c] == posId) known = true;
      if(known) continue;

      int n = ArraySize(candPos);
      ArrayResize(candPos, n + 1);
      ArrayResize(candSig, n + 1);
      candPos[n] = posId;
      candSig[n] = sigId;
   }

   // Phase 2: report each closed position; remember it only after the server confirmed
   // Throttle: max 1 historical closed deal sync per run to avoid socket exhaustion (err 5203)
   int syncedCount = 0;
   for(int c = 0; c < ArraySize(candPos); c++)
   {
      long posId = candPos[c];

      bool isOpen = false;
      for(int p = PositionsTotal() - 1; p >= 0; p--)
      {
         ulong pTicket = PositionGetTicket(p);
         if(pTicket > 0 && (long)PositionGetInteger(POSITION_IDENTIFIER) == posId)
         {
            isOpen = true;
            break;
         }
      }

      bool done = true;
      if(!isOpen)
      {
         double exitPrice = 0.0;
         bool isManualClose = false;
         double realPnl = GetRealizedProfitForPosition((ulong)posId, exitPrice, isManualClose);
         string outcome = "";
         string milestone = "";
         if(isManualClose)
         {
            outcome = (realPnl > 0.01) ? "MANUAL_PROFIT" : ((realPnl < -0.01) ? "MANUAL_LOSS" : "MANUAL_BE");
            milestone = "MANUAL_CLOSE";
         }
         else
         {
            outcome = (realPnl > 0.01) ? "TP1_HIT" : ((realPnl < -0.01) ? "SL_HIT" : "BREAKEVEN");
            milestone = "HISTORICAL_SYNC";
         }
         done = SendTradeUpdate(candSig[c], "CLOSED", outcome, milestone, realPnl, exitPrice, isManualClose);
      }

      if(done)
      {
         int sz = ArraySize(g_syncedClosedPosIds);
         ArrayResize(g_syncedClosedPosIds, sz + 1);
         g_syncedClosedPosIds[sz] = posId;
         syncedCount++;
         if(syncedCount >= 1) break;
      }
      else
      {
         // If update failed (e.g. timeout / network), abort remaining candidates this cycle
         break;
      }
   }
}

//+------------------------------------------------------------------+
//| Fetch signals from Web API, parse Risk Rules & Execute           |
//+------------------------------------------------------------------+
void FetchAndExecuteSignals()
{
   string targetSymbol = (InpBrokerSymbol != "") ? InpBrokerSymbol : _Symbol;
   StringTrimLeft(targetSymbol);
   StringTrimRight(targetSymbol);

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

   char data[];
   char result[];
   string result_headers;
   string cleanKey = GetCleanApiKey();
   string safeSymbol = UrlEncodeParam(targetSymbol);
   
   // Capture live broker prices from current chart/symbol to synchronize directly with MarketAI
   MqlTick currentTick;
   double curBid = 0.0, curAsk = 0.0, curPrice = 0.0;
   if(SymbolInfoTick(targetSymbol, currentTick))
   {
      curBid = currentTick.bid;
      curAsk = currentTick.ask;
      curPrice = (currentTick.last > 0.0) ? currentTick.last : ((currentTick.bid > 0.0 && currentTick.ask > 0.0) ? (currentTick.bid + currentTick.ask) * 0.5 : currentTick.bid);
   }
   if(curBid <= 0.0) curBid = SymbolInfoDouble(targetSymbol, SYMBOL_BID);
   if(curAsk <= 0.0) curAsk = SymbolInfoDouble(targetSymbol, SYMBOL_ASK);
   if(curPrice <= 0.0) curPrice = (curBid > 0.0 && curAsk > 0.0) ? (curBid + curAsk) * 0.5 : (curBid > 0.0 ? curBid : curAsk);

   int symDigits = (int)SymbolInfoInteger(targetSymbol, SYMBOL_DIGITS);
   if(symDigits <= 0) symDigits = _Digits;

   double dOpen = iOpen(targetSymbol, PERIOD_D1, 0);
   double dHigh = iHigh(targetSymbol, PERIOD_D1, 0);
   double dLow  = iLow(targetSymbol, PERIOD_D1, 0);
   double dPrevClose = iClose(targetSymbol, PERIOD_D1, 1);
   if(dOpen <= 0.0) dOpen = curPrice;
   if(dHigh <= 0.0) dHigh = curPrice;
   if(dLow <= 0.0)  dLow  = curPrice;
   if(dPrevClose <= 0.0) dPrevClose = curPrice;

   // Calculate live floating profit for any position on targetSymbol
   double symFloatingProfit = 0.0;
   bool hasSymPosition = false;
   string matchedSigId = "";
   for(int p = PositionsTotal() - 1; p >= 0; p--)
   {
      ulong t = PositionGetTicket(p);
      if(t > 0 && PositionGetString(POSITION_SYMBOL) == targetSymbol)
      {
         hasSymPosition = true;
         symFloatingProfit += (PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP));
         if(matchedSigId == "")
         {
            matchedSigId = ExtractSignalIdFromText(PositionGetString(POSITION_COMMENT));
         }
      }
   }

   string origin = ForceHttps("${currentOrigin}");
   string signalsUrl = origin + "/api/mt5/signals?symbol=" + safeSymbol +
                       "&bid=" + DoubleToString(curBid, symDigits) +
                       "&ask=" + DoubleToString(curAsk, symDigits) +
                       "&price=" + DoubleToString(curPrice, symDigits) +
                       "&positionProfit=" + DoubleToString(symFloatingProfit, 2) +
                       "&hasPosition=" + (hasSymPosition ? "1" : "0") +
                       "&signalId=" + matchedSigId;
   
   // Direct JSON POST request with User-Agent and Connection: close
   string postHeaders = "Authorization: Bearer " + cleanKey + "\\r\\n" +
                        "Content-Type: application/json\\r\\n" +
                        "User-Agent: Mozilla/5.0 MarketAI-Bridge/${MT5_EA_VERSION}\\r\\n" +
                        "Connection: close\\r\\n";
   string postPayload = "{\\\"apiKey\\\":\\\"" + cleanKey + "\\\"" +
                        ",\\\"symbol\\\":\\\"" + targetSymbol + "\\\"" +
                        ",\\\"bid\\\":" + DoubleToString(curBid, symDigits) +
                        ",\\\"ask\\\":" + DoubleToString(curAsk, symDigits) +
                        ",\\\"price\\\":" + DoubleToString(curPrice, symDigits) +
                        ",\\\"open\\\":" + DoubleToString(dOpen, symDigits) +
                        ",\\\"high\\\":" + DoubleToString(dHigh, symDigits) +
                        ",\\\"low\\\":" + DoubleToString(dLow, symDigits) +
                        ",\\\"prevClose\\\":" + DoubleToString(dPrevClose, symDigits) +
                        ",\\\"time\\\":" + IntegerToString((long)TimeCurrent()) +
                        ",\\\"positionProfit\\\":" + DoubleToString(symFloatingProfit, 2) +
                        ",\\\"hasPosition\\\":" + (hasSymPosition ? "true" : "false") +
                        ",\\\"signalId\\\":\\\"" + matchedSigId + "\\\"" +
                        "}";
   int copied = StringToCharArray(postPayload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0 && data[copied - 1] == 0) ArrayResize(data, copied - 1);
   ArrayResize(result, 0);
   ResetLastError();
   
   static int consecutiveFailures = 0;
   static bool wasDisconnected = false;
   
   int res = WebRequest("POST", signalsUrl, postHeaders, 6000, data, result, result_headers);
   
   if(res == -1)
   {
      consecutiveFailures++;
      if(consecutiveFailures >= 2)
      {
         wasDisconnected = true;
         int err = GetLastError();
         static datetime lastWebErr = 0;
         if(TimeCurrent() - lastWebErr > 30)
         {
            if(err == 4060 || err == 4014)
               Print("[MarketAI EROARE ", err, "] URL-ul '", origin, "' NU este autorizat in MT5! Adaugati obligatoriu '", origin, "' in Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
            else
               Print("[MarketAI EROARE WebRequest ", err, "] Conexiunea la server a esuat (", DescribeWebRequestError(err), "). Server: '", origin, "'");
            lastWebErr = TimeCurrent();
         }
      }
      return;
   }
   
   if(res != 200)
   {
      consecutiveFailures++;
      if(consecutiveFailures >= 2)
      {
         wasDisconnected = true;
         int lastErr = GetLastError();
         static datetime lastHttpErr = 0;
         if(TimeCurrent() - lastHttpErr > 25)
         {
            string errBody = (ArraySize(result) > 0) ? CharArrayToString(result) : "";
            if(res == 401)
               Print("[MarketAI HTTP 401] Cheia API este invalida sau a expirat! Verificati InpApiKey: '", cleanKey, "'");
            else if(res >= 1000)
               Print("[MarketAI MT5 ", res, " / err ", lastErr, "] Raspunsul serverului nu a sosit la timp (", DescribeWebRequestError(lastErr), "). Nu este o eroare HTTP a serverului; se reincearca automat. (Server: '", origin, "')");
            else
               Print("[MarketAI HTTP ", res, "] Serverul a raspuns: ", errBody);
            lastHttpErr = TimeCurrent();
         }
      }
      return;
   }

   if(wasDisconnected)
   {
      Print("[MarketAI OK] Conexiunea la server a fost restabilita cu succes (HTTP 200). Monitorizeaza semnale pentru ", targetSymbol);
      wasDisconnected = false;
   }
   consecutiveFailures = 0;

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

            // 1. Close open positions in MT5 matching cancelled/closed signals for THIS targetSymbol
            for(int p = PositionsTotal() - 1; p >= 0; p--)
            {
               ulong posTicket = PositionGetTicket(p);
               if(posTicket > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
               {
                  string posSym = PositionGetString(POSITION_SYMBOL);
                  // Strict symbol isolation: EA on this chart only touches positions of its symbol
                  if(posSym != targetSymbol && posSym != _Symbol && !DoSymbolsMatch(targetSymbol, posSym)) continue;

                  ulong posId = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
                  string comment = PositionGetString(POSITION_COMMENT);
                  string sigToCheck = "";

                  // Priority 1: Match against registered trackedTrades
                  for(int k = 0; k < ArraySize(trackedTrades); k++)
                  {
                     if(!trackedTrades[k].isClosed && (trackedTrades[k].positionTicket == posTicket || trackedTrades[k].positionId == posId))
                     {
                        sigToCheck = trackedTrades[k].signalId;
                        break;
                     }
                  }

                  // Priority 2: Extract signalId from position comment
                  if(sigToCheck == "")
                  {
                     sigToCheck = ExtractSignalIdFromText(comment);
                  }
                  if(sigToCheck == "" && StringLen(comment) >= 6)
                  {
                     sigToCheck = comment;
                  }

                  bool shouldClose = false;
                  // Strict quoted search prevents false substring matches between different signals
                  if(StringLen(sigToCheck) >= 6)
                  {
                     if(StringFind(cancelArrStr, "\\\"" + sigToCheck + "\\\"") != -1 ||
                        StringFind(cancelArrStr, "\\\"" + sigToCheck) != -1)
                     {
                        shouldClose = true;
                     }
                  }
                  if(!shouldClose && StringLen(comment) >= 6)
                  {
                     if(StringFind(cancelArrStr, "\\\"" + comment + "\\\"") != -1 ||
                        StringFind(cancelArrStr, "\\\"" + comment) != -1)
                     {
                        shouldClose = true;
                     }
                  }

                  if(shouldClose)
                  {
                     trade.PositionClose(posTicket);
                     Sleep(100);
                     double exitPr = 0.0;
                     double realizedPnl = GetRealizedProfitForPosition(posTicket, exitPr);
                     Print("MarketAI: Position #", posTicket, " (Signal: ", (sigToCheck != "" ? sigToCheck : comment), ") on ", posSym, " closed via Web Terminal command! Realized PnL: $", DoubleToString(realizedPnl, 2));
                     SendTradeUpdate((sigToCheck != "" ? sigToCheck : comment), "CLOSED", (realizedPnl > 0 ? "TP1_HIT" : "SL_HIT"), "CLOSED_VIA_TERMINAL", realizedPnl, exitPr);
                     if(activeSignalId == sigToCheck || activeSignalId == comment) activeSignalId = "";
                  }
               }
            }

            // 2. Delete pending orders in MT5 matching cancelled/closed signals for THIS targetSymbol
            for(int i = OrdersTotal() - 1; i >= 0; i--)
            {
               ulong ticket = OrderGetTicket(i);
               if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
               {
                  string ordSym = OrderGetString(ORDER_SYMBOL);
                  // Strict symbol isolation: EA on this chart only deletes orders of its symbol
                  if(ordSym != targetSymbol && ordSym != _Symbol && !DoSymbolsMatch(targetSymbol, ordSym)) continue;

                  string comment = OrderGetString(ORDER_COMMENT);
                  string sigToCheck = ExtractSignalIdFromText(comment);
                  if(sigToCheck == "" && StringLen(comment) >= 6)
                  {
                     sigToCheck = comment;
                  }

                  bool shouldDelete = false;
                  if(StringLen(sigToCheck) >= 6)
                  {
                     if(StringFind(cancelArrStr, "\\\"" + sigToCheck + "\\\"") != -1 ||
                        StringFind(cancelArrStr, "\\\"" + sigToCheck) != -1)
                     {
                        shouldDelete = true;
                     }
                  }
                  if(!shouldDelete && StringLen(comment) >= 6)
                  {
                     if(StringFind(cancelArrStr, "\\\"" + comment + "\\\"") != -1 ||
                        StringFind(cancelArrStr, "\\\"" + comment) != -1)
                     {
                        shouldDelete = true;
                     }
                  }

                  if(shouldDelete)
                  {
                     bool delSuccess = trade.OrderDelete(ticket);
                     if(delSuccess)
                     {
                        Print("MarketAI: Pending order #", ticket, " (Signal: ", (sigToCheck != "" ? sigToCheck : comment), ") on ", ordSym, " deleted successfully via cancel command.");
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
      
      // Robust JSON parser: strictly parses objects within "signals": [ ... ] array boundaries
      int sigArrayPos = StringFind(jsonResponse, "\\\"signals\\\":");
      if(sigArrayPos == -1) return;
      
      int arrayStart = StringFind(jsonResponse, "[", sigArrayPos);
      if(arrayStart == -1) return;
      
      int bracketCount = 0;
      int arrayEnd = -1;
      int jsonLen = StringLen(jsonResponse);
      for(int i = arrayStart; i < jsonLen; i++)
      {
         ushort c = StringGetCharacter(jsonResponse, i);
         if(c == '[') bracketCount++;
         else if(c == ']')
         {
            bracketCount--;
            if(bracketCount == 0)
            {
               arrayEnd = i;
               break;
            }
         }
      }
      if(arrayEnd == -1 || arrayEnd <= arrayStart + 1)
      {
         // Signals array is empty: "signals": []
         return;
      }
      
      // Parse individual signal objects strictly inside arrayStart..arrayEnd with nested brace depth tracking
      int searchPos = arrayStart + 1;
      while(searchPos < arrayEnd)
      {
         int objStart = StringFind(jsonResponse, "{", searchPos);
         if(objStart == -1 || objStart >= arrayEnd) break;
         
         int braceCount = 0;
         int objEnd = -1;
         for(int j = objStart; j < arrayEnd; j++)
         {
            ushort c = StringGetCharacter(jsonResponse, j);
            if(c == '{') braceCount++;
            else if(c == '}')
            {
               braceCount--;
               if(braceCount == 0)
               {
                  objEnd = j;
                  break;
               }
            }
         }
         
         if(objEnd == -1) break;
         
         string sigJson = StringSubstr(jsonResponse, objStart, objEnd - objStart + 1);
         searchPos = objEnd + 1;
         
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
         StoreSignalTargets(sigId, targetSymbol, tp1, tp2, tp3);
         
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
            if(isPendingOrder)
            {
               SendTradeUpdate(sigId, "ACTIVE", "PENDING", "PENDING_PLACED", 0.0, 0.0, false);
            }
            else
            {
               SendTradeUpdate(sigId, "RUNNING", "OPENED", "ENTRY", 0.0, 0.0, false);
            }
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
//| Safe & Guaranteed Partial Close across any broker filling mode   |
//+------------------------------------------------------------------+
bool ClosePositionPartialSafe(ulong ticket, double closeVol, string sym)
{
   if(!PositionSelectByTicket(ticket)) return false;
   long pType = PositionGetInteger(POSITION_TYPE);
   double price = (pType == POSITION_TYPE_BUY) ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK);
   if(price <= 0.0) price = PositionGetDouble(POSITION_PRICE_CURRENT);

   trade.SetMarginMode();
   SetupTradeFillingMode(sym);

   // 1. Try standard CTrade PositionClosePartial first
   if(trade.PositionClosePartial(ticket, closeVol))
   {
      return true;
   }
   uint rCode = trade.ResultRetcode();
   if(rCode == TRADE_RETCODE_DONE || rCode == TRADE_RETCODE_PLACED)
   {
      return true;
   }

   // 2. Direct OrderSend fallback trying all supported filling modes
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action    = TRADE_ACTION_DEAL;
   req.position  = ticket;
   req.symbol    = sym;
   req.volume    = closeVol;
   req.price     = price;
   req.type      = (pType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
   req.deviation = 50;
   req.magic     = InpMagicNumber;

   ENUM_ORDER_TYPE_FILLING fillings[3] = { ORDER_FILLING_IOC, ORDER_FILLING_FOK, ORDER_FILLING_RETURN };
   for(int f = 0; f < 3; f++)
   {
      req.type_filling = fillings[f];
      if(OrderSend(req, res))
      {
         if(res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED)
         {
            Print("[MarketAI TP1 Direct Safe] PositionClosePartial reusit cu modul de umplere ", fillings[f], " pe pozitia #", ticket, " (", closeVol, " loturi)!");
            return true;
         }
      }
      Print("[MarketAI TP1 Direct Safe] OrderSend modul ", fillings[f], " pe pozitia #", ticket, " retcode: ", res.retcode, " (", res.comment, ")");
   }

   return false;
}

//+------------------------------------------------------------------+
//| Manage Active Positions: Auto Break-Even & Smart Trailing Stop   |
//+------------------------------------------------------------------+
void ManageActivePositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;

      string posSym = PositionGetString(POSITION_SYMBOL);
      int digits = (int)SymbolInfoInteger(posSym, SYMBOL_DIGITS);
      if(digits <= 0) digits = _Digits;
      double point = SymbolInfoDouble(posSym, SYMBOL_POINT);
      if(point <= 0) point = 0.00001;
      double tickSize = SymbolInfoDouble(posSym, SYMBOL_TRADE_TICK_SIZE);
      if(tickSize <= 0) tickSize = point;

      double ask = SymbolInfoDouble(posSym, SYMBOL_ASK);
      double bid = SymbolInfoDouble(posSym, SYMBOL_BID);

      int stopsLevel  = (int)SymbolInfoInteger(posSym, SYMBOL_TRADE_STOPS_LEVEL);
      int freezeLevel = (int)SymbolInfoInteger(posSym, SYMBOL_TRADE_FREEZE_LEVEL);
      int spread      = (int)SymbolInfoInteger(posSym, SYMBOL_SPREAD);
      double minDistance = (MathMax((double)stopsLevel, MathMax((double)freezeLevel, (double)spread)) + 2.0) * point;
      if(minDistance < 5.0 * point) minDistance = 5.0 * point;

      double openPrice    = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
      double currentSL    = PositionGetDouble(POSITION_SL);
      double currentTP    = PositionGetDouble(POSITION_TP);
      double volume       = PositionGetDouble(POSITION_VOLUME);
      long posType        = PositionGetInteger(POSITION_TYPE);
      ulong posId         = (ulong)PositionGetInteger(POSITION_IDENTIFIER);

      int tIdx = FindTrackedTradeIndex(posId, ticket);
      string thisSigId = (tIdx >= 0 && trackedTrades[tIdx].signalId != "") ? trackedTrades[tIdx].signalId : activeSignalId;
      if(thisSigId == "") thisSigId = ExtractSignalIdFromText(PositionGetString(POSITION_COMMENT));

      double thisTp1 = (tIdx >= 0 && trackedTrades[tIdx].tp1 > 0) ? trackedTrades[tIdx].tp1 : 0.0;
      double thisTp2 = (tIdx >= 0 && trackedTrades[tIdx].tp2 > 0) ? trackedTrades[tIdx].tp2 : 0.0;
      if(thisTp1 <= 0.0)
      {
         double s1 = 0, s2 = 0, s3 = 0;
         LookupSignalTargets(thisSigId, s1, s2, s3);
         if(s1 > 0.0) thisTp1 = s1;
         if(s2 > 0.0) thisTp2 = s2;
      }
      bool thisTp1Hit = (tIdx >= 0) ? trackedTrades[tIdx].tp1Hit : false;
      bool thisTp2Hit = (tIdx >= 0) ? trackedTrades[tIdx].tp2Hit : false;

      double stepLot = SymbolInfoDouble(posSym, SYMBOL_VOLUME_STEP);
      if(stepLot <= 0) stepLot = 0.01;
      int volDigits = (stepLot < 0.1) ? 2 : ((stepLot < 1.0) ? 1 : 0);

      double origVol = (tIdx >= 0 && trackedTrades[tIdx].volume > 0.0) ? trackedTrades[tIdx].volume : volume;
      bool hasNotClosedPartialYet = (volume >= (origVol * 0.5));

      // [A] BUY POSITIONS MANAGEMENT
      if(posType == POSITION_TYPE_BUY)
      {
         double posProfit = PositionGetDouble(POSITION_PROFIT);
         bool isInProfit = (posProfit > 0.0) && (currentPrice > (openPrice + minDistance));

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

         // 1. AUTO BREAK-EVEN & TP1 PARTIAL CLOSE (70%)
         if(isInProfit && isTp1Reached && (!thisTp1Hit || !isSlAlreadyBE || hasNotClosedPartialYet))
         {
            if(liveAutoBreakEven)
            {
               double minLot = SymbolInfoDouble(posSym, SYMBOL_VOLUME_MIN);
               double targetCloseLot = NormalizeDouble(MathFloor((volume * 0.7) / stepLot) * stepLot, volDigits);
               if((volume - targetCloseLot) < minLot && volume > minLot)
               {
                  targetCloseLot = volume - minLot;
               }

               bool closeSuccess = false;
               if(hasNotClosedPartialYet && targetCloseLot >= minLot && (volume - targetCloseLot) >= minLot)
               {
                  closeSuccess = ClosePositionPartialSafe(ticket, targetCloseLot, posSym);
                  if(closeSuccess)
                  {
                     Print("[MarketAI TP1] TP1 atins la ", currentPrice, "! Profit: +$", posProfit, ". S-a inchis partial 70% (", targetCloseLot, " loturi din ", volume, ").");
                  }
                  else
                  {
                     Print("[MarketAI TP1 AVERTISMENT] ClosePositionPartialSafe nu a reusit pe pozitia #", ticket, ". Se va reincerca la urmatorul tick.");
                  }
               }
               else if(!hasNotClosedPartialYet)
               {
                  closeSuccess = true;
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
               }

               if(closeSuccess || isSlAlreadyBE)
               {
                  if(tIdx >= 0) trackedTrades[tIdx].tp1Hit = true;
                  tp1Hit = true;
                  Sleep(100);
                  double exitPr = 0.0;
                  double currentRealized = GetRealizedProfitForPosition(ticket, exitPr);
                  SendTradeUpdate(thisSigId, "RUNNING", "TP1_HIT", "TP1_BREAK_EVEN", currentRealized, currentPrice);
               }
            }
         }
         
         // 2. TP2 PARTIAL CLOSE (10%)
         if(isInProfit && thisTp1Hit && !thisTp2Hit && thisTp2 > thisTp1 && currentPrice >= thisTp2)
         {
            double partialVolume = NormalizeDouble(MathFloor((volume * 0.33) / stepLot) * stepLot, volDigits);
            if(partialVolume >= SymbolInfoDouble(posSym, SYMBOL_VOLUME_MIN))
            {
               if(ClosePositionPartialSafe(ticket, partialVolume, posSym))
               {
                  if(tIdx >= 0) trackedTrades[tIdx].tp2Hit = true;
                  tp2Hit = true;
                  Print("MarketAI: TP2 reached at ", currentPrice, "! Profit: +$", posProfit, ". Closed partial.");
                  SendTradeUpdate(thisSigId, "RUNNING", "TP2_HIT", "TP2", 0.0, currentPrice);
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

         // 1. AUTO BREAK-EVEN & TP1 PARTIAL CLOSE (70%)
         if(isInProfit && isTp1Reached && (!thisTp1Hit || !isSlAlreadyBE || hasNotClosedPartialYet))
         {
            if(liveAutoBreakEven)
            {
               double minLot = SymbolInfoDouble(posSym, SYMBOL_VOLUME_MIN);
               double targetCloseLot = NormalizeDouble(MathFloor((volume * 0.7) / stepLot) * stepLot, volDigits);
               if((volume - targetCloseLot) < minLot && volume > minLot)
               {
                  targetCloseLot = volume - minLot;
               }

               bool closeSuccess = false;
               if(hasNotClosedPartialYet && targetCloseLot >= minLot && (volume - targetCloseLot) >= minLot)
               {
                  closeSuccess = ClosePositionPartialSafe(ticket, targetCloseLot, posSym);
                  if(closeSuccess)
                  {
                     Print("[MarketAI TP1] TP1 atins la ", currentPrice, "! Profit: +$", posProfit, ". S-a inchis partial 70% (", targetCloseLot, " loturi din ", volume, ").");
                  }
                  else
                  {
                     Print("[MarketAI TP1 AVERTISMENT] ClosePositionPartialSafe nu a reusit pe pozitia #", ticket, ". Se va reincerca la urmatorul tick.");
                  }
               }
               else if(!hasNotClosedPartialYet)
               {
                  closeSuccess = true;
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
               }

               if(closeSuccess || isSlAlreadyBE)
               {
                  if(tIdx >= 0) trackedTrades[tIdx].tp1Hit = true;
                  tp1Hit = true;
                  Sleep(100);
                  double exitPr = 0.0;
                  double currentRealized = GetRealizedProfitForPosition(ticket, exitPr);
                  SendTradeUpdate(thisSigId, "RUNNING", "TP1_HIT", "TP1_BREAK_EVEN", currentRealized, currentPrice);
               }
            }
         }
         
         // 2. TP2 PARTIAL CLOSE (10%)
         if(isInProfit && thisTp1Hit && !thisTp2Hit && thisTp2 < thisTp1 && currentPrice <= thisTp2)
         {
            double partialVolume = NormalizeDouble(MathFloor((volume * 0.33) / stepLot) * stepLot, volDigits);
            if(partialVolume >= SymbolInfoDouble(posSym, SYMBOL_VOLUME_MIN))
            {
               if(ClosePositionPartialSafe(ticket, partialVolume, posSym))
               {
                  if(tIdx >= 0) trackedTrades[tIdx].tp2Hit = true;
                  tp2Hit = true;
                  Print("MarketAI: TP2 reached at ", currentPrice, "! Profit: +$", posProfit, ". Closed partial.");
                  SendTradeUpdate(thisSigId, "RUNNING", "TP2_HIT", "TP2", 0.0, currentPrice);
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
//+------------------------------------------------------------------+`;
}
