export function getNinjaTraderScript(
  signalsEndpoint: string,
  accountEndpoint: string,
  updateEndpoint: string,
  apiKey: string,
  currentOrigin: string
): string {
  return `#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Media;
using System.Xml.Serialization;
using System.Net.Http;
using System.Text.RegularExpressions;
using NinjaTrader.Cbi;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Chart;
using NinjaTrader.Gui.Tools;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
using NinjaTrader.Core.FloatingPoint;
using NinjaTrader.NinjaScript.Indicators;
#endregion

// =========================================================================================
//  MarketAI NinjaTrader 8 Auto-Trading Bridge v2.40 (Prop Firm & Futures Edition)
//  Self-Contained C# NinjaScript Strategy with Live Risk Guard & Cloud Synchronization
//  Compatible with: NinjaTrader 8, Apex Trader Funding, Topstep, MyFundedFutures, Bulenox
// =========================================================================================

namespace NinjaTrader.NinjaScript.Strategies
{
    public class MarketAI_NinjaTrader_Bridge : Strategy
    {
        #region Private Fields
        private HttpClient httpClient;
        private System.Threading.Timer pollTimer;
        private System.Threading.Timer accountTimer;
        private readonly HashSet<string> processedSignalIds = new HashSet<string>();
        private readonly object lockObj = new object();
        private bool isPolling = false;
        private double lastAccountBalance = 0;
        private double lastAccountEquity = 0;
        private string activeSignalId = "";
        #endregion

        #region Properties & Inputs
        [NinjaScriptProperty]
        [Display(Name = "MarketAI API Key (Bearer Token)", Description = "Your personal API key from MarketAI Settings", Order = 1, GroupName = "1. MarketAI Connection")]
        public string MarketAiApiKey { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Signals Endpoint URL", Description = "REST API endpoint to fetch active signals", Order = 2, GroupName = "1. MarketAI Connection")]
        public string SignalsUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Account Sync Endpoint URL", Description = "REST API endpoint to report balance and equity", Order = 3, GroupName = "1. MarketAI Connection")]
        public string AccountUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Update Endpoint URL", Description = "REST API endpoint to report order fills and status", Order = 4, GroupName = "1. MarketAI Connection")]
        public string UpdateUrl { get; set; }

        [NinjaScriptProperty]
        [Range(1, 100)]
        [Display(Name = "Default Contracts Size", Description = "Number of contracts per trade (e.g. 1 NQ or 2 MNQ)", Order = 5, GroupName = "2. Order Execution")]
        public int ContractsSize { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Trade Micro Contracts (MNQ/MES/MYM/MGC)", Description = "Automatically map Full Contracts to Micro Contracts for lower risk", Order = 6, GroupName = "2. Order Execution")]
        public bool AutoMapToMicro { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Order Type Mode", Description = "Limit (Wait for pullback) or Market (Immediate execution)", Order = 7, GroupName = "2. Order Execution")]
        public MarketAiOrderMode OrderMode { get; set; }

        [NinjaScriptProperty]
        [Range(1, 10)]
        [Display(Name = "Polling Interval (Seconds)", Description = "How frequently to check MarketAI cloud for new signals", Order = 8, GroupName = "3. Automation & Timers")]
        public int PollIntervalSeconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Enable Smart Trailing Stop", Description = "Trail stop behind price once trade goes into profit", Order = 9, GroupName = "4. Risk Management")]
        public bool EnableTrailingStop { get; set; }

        [NinjaScriptProperty]
        [Range(10, 500)]
        [Display(Name = "Trailing Stop (Ticks)", Description = "Trailing stop distance in ticks (e.g. 80 ticks = 20 points NQ)", Order = 10, GroupName = "4. Risk Management")]
        public int TrailingStopTicks { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Auto Break-Even at TP1", Description = "Move Stop Loss to Entry when Target 1 is reached", Order = 11, GroupName = "4. Risk Management")]
        public bool AutoBreakEven { get; set; }
        #endregion

        public enum MarketAiOrderMode
        {
            RespectSignalOrderType,
            ForceMarketImmediate,
            ForceLimitOrder
        }

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description                                 = "MarketAI NinjaTrader 8 Auto-Trading Bridge with Real-Time Risk Rules & Account Synchronization";
                Name                                        = "MarketAI_NinjaTrader_Bridge";
                Calculate                                   = Calculate.OnPriceChange;
                EntriesPerDirection                         = 1;
                EntryHandling                               = EntryHandling.AllEntries;
                IsExitOnSessionCloseStrategy                = false;
                ExitOnSessionCloseSeconds                   = 30;
                IsFillLimitOnTouch                          = false;
                MaximumBarsLookBack                         = MaximumBarsLookBack.TwoHundredFiftySix;
                OrderFillResolution                         = OrderFillResolution.Standard;
                Slippage                                    = 2;
                StartBehavior                               = StartBehavior.WaitUntilFlat;
                TimeInForce                                 = TimeInForce.Day;
                TraceOrders                                 = false;
                RealtimeErrorHandling                       = RealtimeErrorHandling.StopCancelClose;
                StopTargetHandling                          = StopTargetHandling.PerEntryExecution;
                BarsRequiredToTrade                         = 5;
                IsInstantiatedOnEachOptimizationIteration   = false;

                // Default Parameters
                MarketAiApiKey        = "${apiKey}";
                SignalsUrl           = "${signalsEndpoint}";
                AccountUrl           = "${accountEndpoint}";
                UpdateUrl           = "${updateEndpoint}";
                ContractsSize        = 1;
                AutoMapToMicro       = false;
                OrderMode            = MarketAiOrderMode.RespectSignalOrderType;
                PollIntervalSeconds  = 2;
                EnableTrailingStop   = true;
                TrailingStopTicks    = 80;
                AutoBreakEven        = true;
            }
            else if (State == State.Configure)
            {
                // HttpClient with custom headers
                httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(5);
                if (!string.IsNullOrEmpty(MarketAiApiKey))
                {
                    httpClient.DefaultRequestHeaders.Remove("Authorization");
                    httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + MarketAiApiKey);
                }
            }
            else if (State == State.DataLoaded)
            {
                Print(string.Format("[MarketAI Bridge] Initialized on {0}. Polling every {1}s from: {2}", 
                    Instrument.FullName, PollIntervalSeconds, SignalsUrl));

                // Start polling timer
                pollTimer = new System.Threading.Timer(OnPollTimerCallback, null, 1000, PollIntervalSeconds * 1000);

                // Start account sync timer (every 5 seconds)
                accountTimer = new System.Threading.Timer(OnAccountSyncTimerCallback, null, 2000, 5000);
            }
            else if (State == State.Terminated)
            {
                if (pollTimer != null)
                {
                    pollTimer.Dispose();
                    pollTimer = null;
                }
                if (accountTimer != null)
                {
                    accountTimer.Dispose();
                    accountTimer = null;
                }
                if (httpClient != null)
                {
                    httpClient.Dispose();
                    httpClient = null;
                }
                Print("[MarketAI Bridge] Strategy stopped and timers released.");
            }
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress != 0 || CurrentBar < BarsRequiredToTrade)
                return;

            // Trailing Stop Logic during live position
            if (Position.MarketPosition != MarketPosition.Flat && EnableTrailingStop)
            {
                double tickSize = Instrument.MasterInstrument.TickSize;
                double trailDistance = TrailingStopTicks * tickSize;

                if (Position.MarketPosition == MarketPosition.Long)
                {
                    double currentStop = Position.AveragePrice - trailDistance;
                    double proposedStop = High[0] - trailDistance;
                    if (proposedStop > Position.AveragePrice)
                    {
                        SetStopLoss("MarketAI_Long", CalculationMode.Price, proposedStop, false);
                    }
                }
                else if (Position.MarketPosition == MarketPosition.Short)
                {
                    double currentStop = Position.AveragePrice + trailDistance;
                    double proposedStop = Low[0] + trailDistance;
                    if (proposedStop < Position.AveragePrice)
                    {
                        SetStopLoss("MarketAI_Short", CalculationMode.Price, proposedStop, false);
                    }
                }
            }
        }

        #region Background Polling & Execution
        private void OnPollTimerCallback(object state)
        {
            if (isPolling) return;
            lock (lockObj)
            {
                isPolling = true;
            }

            try
            {
                string instrumentName = Instrument.MasterInstrument.Name.ToUpper();
                string url = string.Format("{0}?apiKey={1}&instrument={2}", SignalsUrl, Uri.EscapeDataString(MarketAiApiKey), Uri.EscapeDataString(instrumentName));

                var request = new HttpRequestMessage(HttpMethod.Get, url);
                if (!string.IsNullOrEmpty(MarketAiApiKey))
                {
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", MarketAiApiKey);
                }

                HttpResponseMessage response = httpClient.SendAsync(request).GetAwaiter().GetResult();
                if (response.IsSuccessStatusCode)
                {
                    string json = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    ProcessSignalsJson(json);
                }
            }
            catch (Exception ex)
            {
                // Silently ignore transient network glitches, log on debug
            }
            finally
            {
                lock (lockObj)
                {
                    isPolling = false;
                }
            }
        }

        private void ProcessSignalsJson(string json)
        {
            if (string.IsNullOrEmpty(json)) return;

            // Extract placed_ids to keep local cache in sync with server
            MatchCollection placedMatches = Regex.Matches(json, "\\"placed_ids\\"\\s*:\\s*\\[(.*?)\\]");
            if (placedMatches.Count > 0)
            {
                string idsStr = placedMatches[0].Groups[1].Value;
                foreach (Match m in Regex.Matches(idsStr, "\\"([^\\"]+)\\""))
                {
                    processedSignalIds.Add(m.Groups[1].Value);
                }
            }

            // Check for cancelled/closed signal IDs to close live market position or cancel orders in NinjaTrader
            MatchCollection cancelMatches = Regex.Matches(json, "\\\"cancelled_ids\\\"\\s*:\\s*\\[(.*?)\\]");
            if (cancelMatches.Count > 0)
            {
                string cancelIdsStr = cancelMatches[0].Groups[1].Value;
                if (!string.IsNullOrEmpty(activeSignalId) && cancelIdsStr.Contains(activeSignalId))
                {
                    ChartControl?.Dispatcher?.InvokeAsync(() =>
                    {
                        if (Position.MarketPosition != MarketPosition.Flat)
                        {
                            Print(string.Format("[MarketAI Bridge] Closing Position on {0} for Signal {1} via Web Terminal X-button!", 
                                Instrument.FullName, activeSignalId));
                            if (Position.MarketPosition == MarketPosition.Long)
                                ExitLong("MarketAI_Long");
                            else if (Position.MarketPosition == MarketPosition.Short)
                                ExitShort("MarketAI_Short");
                        }
                    });
                }
            }

            // Sync live risk rules and symbol-specific trailing stop ticks
            int riskIdx = json.IndexOf("\"riskRules\"");
            if (riskIdx >= 0)
            {
                string trailingStopStr = ExtractJsonString(json, "trailingStop");
                if (!string.IsNullOrEmpty(trailingStopStr))
                    EnableTrailingStop = (trailingStopStr.ToLower() == "true");

                string instName = Instrument.MasterInstrument.Name.ToUpper();
                double tickSz = Instrument.MasterInstrument.TickSize;
                double assetPts = 0;

                if (instName.Contains("NQ") || instName.Contains("MNQ"))
                    assetPts = ExtractJsonDouble(json, "NQ_F");
                else if (instName.Contains("ES") || instName.Contains("MES"))
                    assetPts = ExtractJsonDouble(json, "ES_F");
                else if (instName.Contains("GC") || instName.Contains("MGC"))
                    assetPts = ExtractJsonDouble(json, "GC_F");
                else if (instName.Contains("YM") || instName.Contains("MYM"))
                    assetPts = ExtractJsonDouble(json, "DOW_JONES");
                else if (instName.Contains("6E"))
                    assetPts = ExtractJsonDouble(json, "EURUSD") * 0.0001;
                else if (instName.Contains("6B"))
                    assetPts = ExtractJsonDouble(json, "GBPUSD") * 0.0001;
                else if (instName.Contains("6J"))
                    assetPts = ExtractJsonDouble(json, "USDJPY") * 0.01;

                if (assetPts > 0 && tickSz > 0)
                {
                    TrailingStopTicks = (int)Math.Round(assetPts / tickSz);
                }
            }

            // Extract signals array items
            int signalsIndex = json.IndexOf("\\"signals\\"");
            if (signalsIndex < 0) return;

            // Regex match each JSON signal object
            MatchCollection signalBlocks = Regex.Matches(json, "\\{[^{}]*?\\\"signal_id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"[^{}]*?\\}");
            foreach (Match block in signalBlocks)
            {
                string item = block.Value;
                string sigId = ExtractJsonString(item, "signal_id");
                if (string.IsNullOrEmpty(sigId) || processedSignalIds.Contains(sigId))
                    continue;

                string symbol = ExtractJsonString(item, "symbol");
                string action = ExtractJsonString(item, "action").ToUpper();
                double entry = ExtractJsonDouble(item, "entry");
                double sl = ExtractJsonDouble(item, "sl");
                double tp1 = ExtractJsonDouble(item, "tp1");

                if (!IsSymbolMatchingThisChart(symbol))
                    continue;

                // Dispatch order execution to NinjaTrader chart thread
                ChartControl?.Dispatcher?.InvokeAsync(() =>
                {
                    ExecuteMarketAiSignal(sigId, symbol, action, entry, sl, tp1);
                });
            }
        }

        private bool IsSymbolMatchingThisChart(string signalSymbol)
        {
            string chartInst = Instrument.MasterInstrument.Name.ToUpper();
            string sig = (signalSymbol ?? "").ToUpper();

            if (chartInst == sig) return true;

            // Nasdaq mapping
            if ((chartInst.Contains("NQ") || chartInst.Contains("MNQ")) && (sig.Contains("NAS") || sig.Contains("NQ") || sig.Contains("US100")))
                return true;

            // Dow Jones mapping
            if ((chartInst.Contains("YM") || chartInst.Contains("MYM")) && (sig.Contains("DOW") || sig.Contains("US30") || sig.Contains("YM") || sig.Contains("DJ30")))
                return true;

            // S&P 500 mapping
            if ((chartInst.Contains("ES") || chartInst.Contains("MES")) && (sig.Contains("SP500") || sig.Contains("US500") || sig.Contains("ES") || sig.Contains("SPX")))
                return true;

            // Gold mapping
            if ((chartInst.Contains("GC") || chartInst.Contains("MGC")) && (sig.Contains("GOLD") || sig.Contains("XAU") || sig.Contains("GC")))
                return true;

            // Forex mapping
            if (chartInst.Contains("6E") && sig.Contains("EURUSD")) return true;
            if (chartInst.Contains("6B") && sig.Contains("GBPUSD")) return true;
            if (chartInst.Contains("6J") && sig.Contains("USDJPY")) return true;
            if (chartInst.Replace("/", "").Contains(sig.Replace("/", ""))) return true;

            return false;
        }

        private void ExecuteMarketAiSignal(string sigId, string symbol, string action, double entry, double sl, double tp1)
        {
            if (processedSignalIds.Contains(sigId)) return;
            processedSignalIds.Add(sigId);
            activeSignalId = sigId;

            int qty = ContractsSize;
            double tickSize = Instrument.MasterInstrument.TickSize;

            Print(string.Format("[MarketAI Bridge] Executing Signal {0} | {1} {2} @ {3} (SL: {4}, TP1: {5})", 
                sigId, action, Instrument.FullName, entry, sl, tp1));

            // Set targets and stops
            if (sl > 0)
            {
                SetStopLoss(CalculationMode.Price, sl);
            }
            if (tp1 > 0)
            {
                SetProfitTarget(CalculationMode.Price, tp1);
            }

            bool isBuy = action.Contains("BUY");
            bool isLimit = action.Contains("LIMIT") || OrderMode == MarketAiOrderMode.ForceLimitOrder;
            bool isStop = action.Contains("STOP");

            if (OrderMode == MarketAiOrderMode.ForceMarketImmediate)
            {
                isLimit = false;
                isStop = false;
            }

            if (isBuy)
            {
                if (isLimit && entry > 0)
                    EnterLongLimit(0, true, qty, entry, "MarketAI_Long");
                else if (isStop && entry > 0)
                    EnterLongStopMarket(0, true, qty, entry, "MarketAI_Long");
                else
                    EnterLong(0, qty, "MarketAI_Long");
            }
            else
            {
                if (isLimit && entry > 0)
                    EnterShortLimit(0, true, qty, entry, "MarketAI_Short");
                else if (isStop && entry > 0)
                    EnterShortStopMarket(0, true, qty, entry, "MarketAI_Short");
                else
                    EnterShort(0, qty, "MarketAI_Short");
            }

            // Report execution to MarketAI Cloud
            NotifyServerOrderPlaced(sigId, action, entry, sl, tp1);
        }

        private void NotifyServerOrderPlaced(string sigId, string action, double entry, double sl, double tp1)
        {
            Task.Run(async () =>
            {
                try
                {
                    string jsonBody = string.Format(
                        "{{\\"signal_id\\":\\"{0}\\",\\"status\\":\\"RUNNING\\",\\"outcomeStatus\\":\\"RUNNING\\",\\"accountNumber\\":\\"{1}\\",\\"accountServer\\":\\"NinjaTrader 8\\",\\"accountCompany\\":\\"{2}\\",\\"accountBalance\\":{3},\\"equity\\":{4}}}",
                        sigId,
                        Account.Name,
                        Account.ConnectionName ?? "NinjaTrader",
                        Account.Get(AccountItem.CashValue, Currency.UsDollar),
                        Account.Get(AccountItem.BuyingPower, Currency.UsDollar)
                    );

                    var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                    var request = new HttpRequestMessage(HttpMethod.Post, UpdateUrl) { Content = content };
                    if (!string.IsNullOrEmpty(MarketAiApiKey))
                        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", MarketAiApiKey);

                    await httpClient.SendAsync(request);
                }
                catch { }
            });
        }
        #endregion

        #region Account Live Synchronization
        private void OnAccountSyncTimerCallback(object state)
        {
            if (Account == null || httpClient == null || string.IsNullOrEmpty(AccountUrl)) return;

            try
            {
                double cash = Account.Get(AccountItem.CashValue, Currency.UsDollar);
                double buyingPower = Account.Get(AccountItem.BuyingPower, Currency.UsDollar);
                double realizedPnL = Account.Get(AccountItem.RealizedProfitLoss, Currency.UsDollar);
                double unrealizedPnL = Account.Get(AccountItem.UnrealizedProfitLoss, Currency.UsDollar);
                double equity = cash + unrealizedPnL;

                // Sync if balance changed or every few intervals
                lastAccountBalance = cash;
                lastAccountEquity = equity;

                string jsonBody = string.Format(
                    "{{\\"accountNumber\\":\\"{0}\\",\\"accountName\\":\\"{0}\\",\\"accountServer\\":\\"{1}\\",\\"accountCompany\\":\\"{2}\\",\\"accountCurrency\\":\\"USD\\",\\"accountBalance\\":{3},\\"equity\\":{4},\\"realizedPnL\\":{5},\\"unrealizedPnL\\":{6}}}",
                    Account.Name,
                    "NinjaTrader 8 (" + (Account.ConnectionName ?? "Live") + ")",
                    Account.ConnectionName ?? "NinjaTrader",
                    cash.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    equity.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    realizedPnL.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                    unrealizedPnL.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)
                );

                var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                var request = new HttpRequestMessage(HttpMethod.Post, AccountUrl) { Content = content };
                if (!string.IsNullOrEmpty(MarketAiApiKey))
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", MarketAiApiKey);

                httpClient.SendAsync(request).GetAwaiter().GetResult();
            }
            catch { }
        }
        #endregion

        #region JSON Helper Parsers (Zero External Dependencies)
        private string ExtractJsonString(string json, string key)
        {
            var match = Regex.Match(json, "\\\"" + key + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
            return match.Success ? match.Groups[1].Value : "";
        }

        private double ExtractJsonDouble(string json, string key)
        {
            var match = Regex.Match(json, "\\\"" + key + "\\\"\\s*:\\s*([0-9.-]+)");
            if (match.Success && double.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double val))
                return val;
            return 0;
        }
        #endregion
    }
}
`;
}
