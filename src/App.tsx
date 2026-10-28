import React, { useState, useEffect, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { MarketOverviewCards } from './components/MarketOverviewCards';
import { CustomSignalRulesSection } from './components/CustomSignalRulesSection';
import { TradingSignalsSection } from './components/TradingSignalsSection';
import { MacroNewsSection } from './components/MacroNewsSection';
import { RiskRulesConfigurationSection } from './components/RiskRulesConfigurationSection';
import { PositionCalculatorModal } from './components/PositionCalculatorModal';
import { ApiKeysModal } from './components/ApiKeysModal';
import { AuthModal } from './components/AuthModal';
import { AdminCrmModal } from './components/AdminCrmModal';
import { MarketClosedModal } from './components/MarketClosedModal';
import { SignalPerformanceSummaryCard } from './components/SignalPerformanceSummaryCard';
import { SignalHistoryStatsModal } from './components/SignalHistoryStatsModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { Mt5IntegrationModal } from './components/Mt5IntegrationModal';
import { NinjaTraderIntegrationModal } from './components/NinjaTraderIntegrationModal';
import { TradeJournalSection } from './components/TradeJournalSection';
import { SessionProfitabilityBentoModule } from './components/SessionProfitabilityBentoModule';
import { MarketQuote, TradingSignal, InstrumentId, TimeFrame, UserApiKeys, CustomSignalRule, UserProfile, TradeJournalEntry } from './types';
import { evaluateSignalOutcome, filter30DaySignals, mergeSignals } from './utils/signalUtils';
import { getMarketScheduleStatus, isSignalExpiredByMarketClose } from './utils/marketSchedule';
import { INITIAL_SAMPLE_TRADES, isDemoOrSampleTrade } from './utils/tradeJournalUtils';
import { ShieldCheck, Info, Sparkles, BarChart2, Sliders, Newspaper, LayoutGrid, AlertTriangle } from 'lucide-react';

const LOCAL_STORAGE_SIGNALS_KEY = 'market_ai_signals_v2';
const LOCAL_STORAGE_DELETED_SIGNALS_KEY = 'market_ai_deleted_signal_ids_v1';
const LOCAL_STORAGE_MANUAL_TRADES_KEY = 'market_ai_trade_journal_v1';

export default function App() {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentId>('NASDAQ');
  const [lang, setLang] = useState<'ro' | 'en'>(() => {
    try {
      const saved = localStorage.getItem('market_ai_preferred_lang');
      if (saved === 'ro' || saved === 'en') {
        return saved;
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const userNavLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();

      // Romanian timezone or browser language defaults to 'ro', otherwise default to 'en' for visitors outside Romania
      if (tz === 'Europe/Bucharest' || userNavLang.startsWith('ro')) {
        return 'ro';
      }
      return 'en';
    } catch (e) {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('market_ai_preferred_lang', lang);
    } catch (e) {
      console.warn('Could not save preferred language:', e);
    }
  }, [lang]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('signals');

  // User Auth & Cloud State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('market_ai_auth_token');
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminCrmModalOpen, setIsAdminCrmModalOpen] = useState(false);
  const [isMarketClosedModalOpen, setIsMarketClosedModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isMt5ModalOpen, setIsMt5ModalOpen] = useState(false);
  const [isNinjaTraderModalOpen, setIsNinjaTraderModalOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  const [apiKeys, setApiKeys] = useState<UserApiKeys>(() => {
    try {
      const saved = localStorage.getItem('user_api_keys');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read apiKeys from localStorage:', e);
    }
    return {
      geminiApiKey: '',
    };
  });

  const [deletedSignalIds, setDeletedSignalIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read deletedSignalIds from localStorage:', e);
    }
    return [];
  });

  const [signals, setSignals] = useState<TradingSignal[]>(() => {
    try {
      const savedDeleted = localStorage.getItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY);
      const delIds = savedDeleted ? JSON.parse(savedDeleted) : [];
      const saved = localStorage.getItem(LOCAL_STORAGE_SIGNALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return filter30DaySignals(parsed, delIds);
        }
      }
    } catch (e) {
      console.warn('Could not read signals from localStorage:', e);
    }
    return [];
  });

  const [manualTrades, setManualTrades] = useState<TradeJournalEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MANUAL_TRADES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((t: any) => !isDemoOrSampleTrade(t));
          if (clean.length !== parsed.length) {
            localStorage.setItem(LOCAL_STORAGE_MANUAL_TRADES_KEY, JSON.stringify(clean));
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn('Could not read manual trades from localStorage:', e);
    }
    return [];
  });

  // Verify Auth Session and Sync Cloud Data on Mount
  useEffect(() => {
    let isCancelled = false;

    const initAuthAndSync = async () => {
      const token = localStorage.getItem('market_ai_auth_token');
      if (!token) {
        setIsAuthModalOpen(true);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (isCancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setAuthToken(token);
            setIsAuthModalOpen(false);

            // Fetch Cloud Synced Data (Signals & Keys) for this user
            const syncRes = await fetch('/api/user/sync-data', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (syncRes.ok && !isCancelled) {
              const syncData = await syncRes.json();
              const cloudDeleted = Array.isArray(syncData.deletedSignalIds) ? syncData.deletedSignalIds : [];
              setDeletedSignalIds(cloudDeleted);
              try {
                localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(cloudDeleted));
              } catch (e) {}

              if (Array.isArray(syncData.signals)) {
                const userFiltered = filter30DaySignals(syncData.signals, cloudDeleted);
                setSignals(userFiltered);
                try {
                  localStorage.setItem(LOCAL_STORAGE_SIGNALS_KEY, JSON.stringify(userFiltered));
                } catch (e) {}
              }
              if (Array.isArray(syncData.tradeJournal)) {
                const cleanCloud = syncData.tradeJournal.filter((t: any) => !isDemoOrSampleTrade(t));
                setManualTrades(cleanCloud);
                try {
                  localStorage.setItem(LOCAL_STORAGE_MANUAL_TRADES_KEY, JSON.stringify(cleanCloud));
                } catch (e) {}
              }
              if (syncData.apiKeys && (syncData.apiKeys.geminiApiKey || syncData.apiKeys.lseKey)) {
                setApiKeys(syncData.apiKeys);
              }
            }
          } else {
            const currentToken = localStorage.getItem('market_ai_auth_token');
            if (currentToken === token) {
              setIsAuthModalOpen(true);
            }
          }
        } else {
          const currentToken = localStorage.getItem('market_ai_auth_token');
          if (currentToken === token) {
            localStorage.removeItem('market_ai_auth_token');
            setIsAuthModalOpen(true);
          }
        }
      } catch (err) {
        console.warn('Auth session check failed:', err);
        const currentToken = localStorage.getItem('market_ai_auth_token');
        if (currentToken === token && !isCancelled) {
          setIsAuthModalOpen(true);
        }
      } finally {
        if (!isCancelled) {
          setIsCloudSynced(true);
        }
      }
    };

    initAuthAndSync();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Poll auth/me every 3 seconds to sync live MT5 account balance, equity, and account number
  useEffect(() => {
    if (!authToken) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser((prevUser) => {
              if (!prevUser) return data.user;
              if (
                prevUser.accountBalance !== data.user.accountBalance ||
                prevUser.equity !== data.user.equity ||
                prevUser.mt5AccountNumber !== data.user.mt5AccountNumber ||
                prevUser.mt5AccountServer !== data.user.mt5AccountServer ||
                prevUser.mt5AccountCurrency !== data.user.mt5AccountCurrency ||
                prevUser.mt5AccountCompany !== data.user.mt5AccountCompany ||
                prevUser.mt5LastConnectedAt !== data.user.mt5LastConnectedAt ||
                prevUser.mt5ApiKey !== data.user.mt5ApiKey ||
                prevUser.ninjaTraderAccountNumber !== data.user.ninjaTraderAccountNumber ||
                prevUser.ninjaTraderAccountName !== data.user.ninjaTraderAccountName ||
                prevUser.ninjaTraderAccountCurrency !== data.user.ninjaTraderAccountCurrency ||
                prevUser.ninjaTraderLastConnectedAt !== data.user.ninjaTraderLastConnectedAt ||
                prevUser.ninjaTraderApiKey !== data.user.ninjaTraderApiKey ||
                prevUser.status !== data.user.status ||
                prevUser.subscriptionDaysLeft !== data.user.subscriptionDaysLeft
              ) {
                return {
                  ...prevUser,
                  ...data.user,
                };
              }
              return prevUser;
            });
          }
        }
      } catch (e) {
        // silent
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [authToken]);

  // Save Cloud Data to Server whenever signals, apiKeys or deletedSignalIds update (ONLY after cloud initial sync)
  useEffect(() => {
    if (!user || !authToken || !isCloudSynced) return;

    const syncToCloud = async () => {
      try {
        const clean = filter30DaySignals(signals, deletedSignalIds);
        await fetch('/api/user/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            signals: clean,
            deletedSignalIds,
            tradeJournal: manualTrades,
            apiKeys,
          }),
        });
      } catch (e) {
        console.warn('Cloud synchronization failed:', e);
      }
    };

    syncToCloud();
  }, [signals, manualTrades, apiKeys, deletedSignalIds, user, authToken, isCloudSynced]);

  // Sync active signals to MT5 & NinjaTrader bridge server endpoints (Isolated per user account)
  useEffect(() => {
    const syncToBridges = async () => {
      if (!authToken) return;
      try {
        await Promise.all([
          fetch('/api/mt5/signals/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ signals }),
          }),
          fetch('/api/ninjatrader/signals/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ signals }),
          }),
        ]);
      } catch (e) {
        // silent
      }
    };
    syncToBridges();
  }, [signals, authToken]);

  const handleAuthSuccess = async (newUser: UserProfile, newAuthToken: string) => {
    setUser(newUser);
    setAuthToken(newAuthToken);
    localStorage.setItem('market_ai_auth_token', newAuthToken);
    setIsAuthModalOpen(false);

    // Fetch user cloud data
    try {
      const syncRes = await fetch('/api/user/sync-data', {
        headers: { Authorization: `Bearer ${newAuthToken}` },
      });
        const cloudDeleted = Array.isArray(syncData.deletedSignalIds) ? syncData.deletedSignalIds : [];
        setDeletedSignalIds(cloudDeleted);
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(cloudDeleted));
        } catch (e) {}

        if (Array.isArray(syncData.signals)) {
          const userFiltered = filter30DaySignals(syncData.signals, cloudDeleted);
          setSignals(userFiltered);
          try {
            localStorage.setItem(LOCAL_STORAGE_SIGNALS_KEY, JSON.stringify(userFiltered));
          } catch (e) {}
        }
        if (Array.isArray(syncData.tradeJournal)) {
          const cleanCloud = syncData.tradeJournal.filter((t: any) => !isDemoOrSampleTrade(t));
          setManualTrades(cleanCloud);
          try {
            localStorage.setItem(LOCAL_STORAGE_MANUAL_TRADES_KEY, JSON.stringify(cleanCloud));
          } catch (e) {}
        }
        if (syncData.apiKeys && (syncData.apiKeys.geminiApiKey || syncData.apiKeys.lseKey)) {
          setApiKeys(syncData.apiKeys);
        }
      }
    } catch (e) {
      console.warn('Cloud sync error on login:', e);
    } finally {
      setIsCloudSynced(true);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthToken(null);
    setIsCloudSynced(false);
    setSignals([]);
    setDeletedSignalIds([]);
    setManualTrades([]);
    localStorage.removeItem('market_ai_auth_token');
    localStorage.removeItem(LOCAL_STORAGE_SIGNALS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_MANUAL_TRADES_KEY);
    setIsAuthModalOpen(true);
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}?invite=TRADING2026`;
    navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  // Persist apiKeys to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('user_api_keys', JSON.stringify(apiKeys));
    } catch (e) {
      console.warn('Could not save apiKeys to localStorage:', e);
    }
  }, [apiKeys]);

  const [quotes, setQuotes] = useState<Record<InstrumentId, MarketQuote>>({
    NASDAQ: {
      id: 'NASDAQ',
      symbol: 'NAS100',
      name: 'Nasdaq 100 Futures',
      tradingViewSymbol: 'FOREXCOM:NAS100',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    SPX500: {
      id: 'SPX500',
      symbol: 'SPX500',
      name: 'S&P 500 Futures',
      tradingViewSymbol: 'FOREXCOM:SPX500',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    DOW_JONES: {
      id: 'DOW_JONES',
      symbol: 'US30',
      name: 'Dow Jones Futures',
      tradingViewSymbol: 'FOREXCOM:US30',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    GOLD: {
      id: 'GOLD',
      symbol: 'XAU/USD',
      name: 'Gold Spot (XAU/USD)',
      tradingViewSymbol: 'FOREXCOM:XAUUSD',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    NQ_F: {
      id: 'NQ_F',
      symbol: 'NQ.F',
      name: 'Nasdaq 100 Futures',
      tradingViewSymbol: 'CME_MINI:NQ1!',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    ES_F: {
      id: 'ES_F',
      symbol: 'ES.F',
      name: 'S&P 500 Futures',
      tradingViewSymbol: 'CME_MINI:ES1!',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    YM_F: {
      id: 'YM_F',
      symbol: 'DOW.F',
      name: 'Dow Jones Futures',
      tradingViewSymbol: 'CBOT_MINI:YM1!',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    GC_F: {
      id: 'GC_F',
      symbol: 'GC.F',
      name: 'Gold Futures',
      tradingViewSymbol: 'COMEX:GC1!',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    EURUSD: {
      id: 'EURUSD',
      symbol: 'EUR/USD',
      name: 'EUR/USD Forex Spot',
      tradingViewSymbol: 'FX:EURUSD',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    GBPUSD: {
      id: 'GBPUSD',
      symbol: 'GBP/USD',
      name: 'GBP/USD Forex Spot',
      tradingViewSymbol: 'FX:GBPUSD',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
    USDJPY: {
      id: 'USDJPY',
      symbol: 'USD/JPY',
      name: 'USD/JPY Forex Spot',
      tradingViewSymbol: 'FX:USDJPY',
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: '-',
      source: 'LSE',
      timestamp: '-',
      rsi: 0,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema20: 0,
      sma50: 0,
      sma200: 0,
      trend: 'NEUTRAL',
    },
  });

  // Persist signals to localStorage whenever signals or deletedSignalIds state updates
  useEffect(() => {
    try {
      const clean = filter30DaySignals(signals, deletedSignalIds);
      localStorage.setItem(LOCAL_STORAGE_SIGNALS_KEY, JSON.stringify(clean));
      localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(deletedSignalIds));
    } catch (e) {
      console.warn('Could not save signals to localStorage:', e);
    }
  }, [signals, deletedSignalIds]);

  const handleUpdateSignalOutcome = (signalId: string, outcome: 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | 'CANCELLED' | 'RUNNING' | 'PENDING') => {
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, outcomeStatus: outcome } : s))
    );
  };

  const handleUpdateSignalPnl = async (signalId: string, pnl: number) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, pnl, realizedProfit: pnl, accountSource: s.accountSource || 'MT5' } : s))
    );
    if (user && user.signals) {
      setUser((prev) => {
        if (!prev) return prev;
        const updated = (prev.signals || []).map((s) =>
          s.id === signalId ? { ...s, pnl, realizedProfit: pnl, accountSource: s.accountSource || 'MT5' } : s
        );
        return { ...prev, signals: updated };
      });
    }

    if (user && authToken) {
      try {
        await fetch('/api/signals/update-pnl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ signalId, pnl }),
        });
      } catch (err) {
        console.warn('Backend update signal PnL failed:', err);
      }
    }
  };

  const handleDeleteSignal = (signalId: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== signalId));

    const updatedDeleted = Array.from(new Set([...deletedSignalIds, signalId]));
    setDeletedSignalIds(updatedDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn('Could not save deletedSignalIds to localStorage:', e);
    }

    if (user && authToken) {
      fetch('/api/user/delete-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ signalId }),
      }).catch((err) => console.warn('Cloud delete signal failed:', err));
    }
  };

  const handleCloseTrade = async (signalId: string) => {
    const targetSig = signals.find((s) => s.id === signalId);
    const liveQ = targetSig ? quotes[targetSig.instrumentId] : null;
    const exitPrice = liveQ && liveQ.price > 0 ? liveQ.price : (targetSig?.currentMarketPrice || targetSig?.entryPrice || 0);

    // 1. Mark as CANCELLED with manual close reason
    setSignals((prev) =>
      prev.map((s) => {
        if (s.id === signalId) {
          return {
            ...s,
            status: 'CANCELLED',
            outcomeStatus: 'CANCELLED',
            cancelReasonRo: 'Închis manual din interfață (Comandă Stop MT5 / NinjaTrader)',
            cancelReasonEn: 'Manually closed from dashboard (Stop order MT5 / NinjaTrader)',
            closedAt: new Date().toISOString(),
            exitPrice: exitPrice,
          };
        }
        return s;
      })
    );

    // 2. Add to deletedSignalIds so MT5 & NinjaTrader receive it in cancelled_ids immediately
    const updatedDeleted = Array.from(new Set([...deletedSignalIds, signalId]));
    setDeletedSignalIds(updatedDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn('Could not save deletedSignalIds to localStorage:', e);
    }

    // 3. Post to /api/user/close-trade
    const token = authToken || localStorage.getItem('market_ai_auth_token');
    if (token) {
      try {
        await fetch('/api/user/close-trade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ signalId, exitPrice }),
        });
      } catch (err) {
        console.warn('Cloud close-trade failed:', err);
      }
    }
  };

  const handleCloseAllTrades = async () => {
    const activeSigs = signals.filter(
      (s) => s.outcomeStatus !== 'CANCELLED' && s.outcomeStatus !== 'SL_HIT' && s.outcomeStatus !== 'TP3_HIT'
    );
    if (activeSigs.length === 0) return;

    const closingIds = activeSigs.map((s) => s.id);
    const nowIso = new Date().toISOString();

    setSignals((prev) =>
      prev.map((s) => {
        if (closingIds.includes(s.id)) {
          const liveQ = quotes[s.instrumentId];
          const exitPrice = liveQ && liveQ.price > 0 ? liveQ.price : (s.currentMarketPrice || s.entryPrice || 0);
          return {
            ...s,
            status: 'CANCELLED',
            outcomeStatus: 'CANCELLED',
            cancelReasonRo: 'Închis manual din interfață (Comandă Închidere Totală)',
            cancelReasonEn: 'Manually closed from dashboard (Close All command)',
            closedAt: nowIso,
            exitPrice: exitPrice,
          };
        }
        return s;
      })
    );

    const updatedDeleted = Array.from(new Set([...deletedSignalIds, ...closingIds]));
    setDeletedSignalIds(updatedDeleted);
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn('Could not save deletedSignalIds to localStorage:', e);
    }

    const token = authToken || localStorage.getItem('market_ai_auth_token');
    if (token) {
      try {
        await fetch('/api/user/close-all-trades', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ signalIds: closingIds }),
        });
      } catch (err) {
        console.warn('Cloud close-all-trades failed:', err);
      }
    }
  };

  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);

  const handleDeleteAllSignals = () => {
    setIsConfirmDeleteModalOpen(true);
  };

  const executeDeleteAllSignals = () => {
    const allIds = signals.map((s) => s.id);
    const updatedDeleted = Array.from(new Set([...deletedSignalIds, ...allIds]));

    autoGeneratedRef.current = true;
    setSignals([]);
    setDeletedSignalIds(updatedDeleted);

    try {
      localStorage.setItem(LOCAL_STORAGE_SIGNALS_KEY, JSON.stringify([]));
      localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn('Could not save signals to localStorage:', e);
    }

    if (user && authToken) {
      fetch('/api/user/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          signals: [],
          deletedSignalIds: updatedDeleted,
          apiKeys,
        }),
      }).catch((err) => console.warn('Cloud delete all signals failed:', err));
    }
  };

  const handleSaveManualTrade = (trade: TradeJournalEntry) => {
    setManualTrades((prev) => {
      const existingIdx = prev.findIndex((t) => t.id === trade.id);
      let updated: TradeJournalEntry[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = trade;
      } else {
        updated = [trade, ...prev];
      }
      const clean = updated.filter((t) => !isDemoOrSampleTrade(t));
      try {
        localStorage.setItem(LOCAL_STORAGE_MANUAL_TRADES_KEY, JSON.stringify(clean));
      } catch (e) {}

      // Sync to cloud
      const token = authToken || localStorage.getItem('market_ai_auth_token');
      if (token) {
        fetch('/api/user/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tradeJournal: clean }),
        }).catch((err) => console.warn('Cloud sync tradeJournal failed:', err));
      }

      return clean;
    });
  };

  const handleDeleteManualTrade = (tradeId: string) => {
    setManualTrades((prev) => {
      const updated = prev.filter((t) => t.id !== tradeId && !isDemoOrSampleTrade(t));
      try {
        localStorage.setItem(LOCAL_STORAGE_MANUAL_TRADES_KEY, JSON.stringify(updated));
      } catch (e) {}

      // Sync to cloud
      const token = authToken || localStorage.getItem('market_ai_auth_token');
      if (token) {
        fetch('/api/user/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tradeJournal: updated }),
        }).catch((err) => console.warn('Cloud sync tradeJournal failed:', err));
      }

      return updated;
    });
  };

  const handleClearAllManualTrades = () => {
    setManualTrades([]);
    try {
      localStorage.setItem(LOCAL_STORAGE_MANUAL_TRADES_KEY, JSON.stringify([]));
    } catch (e) {}

    const token = authToken || localStorage.getItem('market_ai_auth_token');
    if (token) {
      fetch('/api/user/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tradeJournal: [] }),
      }).catch((err) => console.warn('Cloud clear tradeJournal failed:', err));
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingSignal, setIsGeneratingSignal] = useState(false);
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [apiErrors, setApiErrors] = useState<{ londonStrategicEdge?: string }>({});

  const autoGeneratedRef = React.useRef(false);

  // Auto-generate 3 fresh AI signals for NASDAQ, DOW_JONES, GOLD
  const autoGenerate3Signals = useCallback(async (targetLang: 'ro' | 'en') => {
    const marketSchedule = getMarketScheduleStatus();
    if (marketSchedule.isClosed) {
      console.log('Piața este închisă pentru weekend. Generarea automată de semnale a fost omisă.');
      setIsGeneratingSignal(false);
      return;
    }

    setIsGeneratingSignal(true);
    try {
      const pairs: { id: InstrumentId; tf: TimeFrame; strat: string }[] = [
        { id: 'NASDAQ', tf: '1h', strat: 'Intraday Trend & Breakout' },
        { id: 'NQ_F', tf: '1h', strat: 'Futures Intraday Momentum' },
        { id: 'SPX500', tf: '1h', strat: 'Intraday Trend & Breakout' },
        { id: 'ES_F', tf: '1h', strat: 'S&P 500 Futures Flow' },
        { id: 'DOW_JONES', tf: '1h', strat: 'Intraday Trend & Breakout' },
        { id: 'YM_F', tf: '1h', strat: 'Dow Jones Futures Flow' },
        { id: 'GOLD', tf: '4h', strat: 'Swing Trend & Safe Haven Demand' },
        { id: 'GC_F', tf: '4h', strat: 'Gold Futures Breakout' },
        { id: 'EURUSD', tf: '1h', strat: 'London/NY FX Session Flow' },
        { id: 'GBPUSD', tf: '1h', strat: 'Cable Breakout & Volatility' },
        { id: 'USDJPY', tf: '1h', strat: 'Tokyo/NY Session Momentum' },
      ];

      const promises = pairs.map(async (p) => {
        try {
          const res = await fetch('/api/generate-ai-signal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              ...(apiKeys.geminiApiKey ? { 'x-gemini-api-key': apiKeys.geminiApiKey } : {}),
            },
            body: JSON.stringify({
              instrumentId: p.id,
              timeframe: p.tf,
              strategy: p.strat,
              lang: targetLang,
              ...(apiKeys.geminiApiKey ? { geminiApiKey: apiKeys.geminiApiKey } : {}),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            return (data.signal as TradingSignal) || null;
          }
        } catch (e) {
          console.warn(`Auto signal generation error for ${p.id}:`, e);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const generated = results.filter((s): s is TradingSignal => Boolean(s));

      if (generated.length > 0) {
        setSignals((prev) => [...generated, ...prev]);
      }
    } finally {
      setIsGeneratingSignal(false);
    }
  }, [authToken, apiKeys]);

  const handleResetSignals = () => {
    const marketSchedule = getMarketScheduleStatus();
    if (marketSchedule.isClosed) {
      setIsMarketClosedModalOpen(true);
      return;
    }
    setSignals([]);
    autoGenerate3Signals(lang);
  };

  // Auto trigger generation on site entry once market quotes load (ONLY when market is open)
  useEffect(() => {
    if (quotes.NASDAQ.price > 0 && !autoGeneratedRef.current) {
      autoGeneratedRef.current = true;
      const marketSchedule = getMarketScheduleStatus();
      if (!marketSchedule.isClosed && signals.length === 0) {
        autoGenerate3Signals(lang);
      }
    }
  }, [quotes, autoGenerate3Signals, lang, signals.length]);

  // Automated trade status & milestone evaluation loop
  useEffect(() => {
    if (signals.length === 0) return;

    setSignals((prevSignals) => {
      let hasChanges = false;
      const newlyCancelledIds: string[] = [];

      const updated = prevSignals.map((sig) => {
        const liveQuote = quotes[sig.instrumentId];
        const evalPrice = liveQuote && liveQuote.price > 0 ? liveQuote.price : (sig.currentMarketPrice || sig.entryPrice || 0);

        const evalResult = evaluateSignalOutcome(sig, evalPrice);

        const isNewlyCancelled = evalResult.outcomeStatus === 'CANCELLED' && sig.outcomeStatus !== 'CANCELLED';
        if (isNewlyCancelled) {
          newlyCancelledIds.push(sig.id);
        }

        if (
          evalResult.outcomeStatus !== sig.outcomeStatus ||
          evalResult.firstHitMilestone !== sig.firstHitMilestone ||
          evalResult.isEntryTriggered !== sig.isEntryTriggered ||
          evalResult.isBeHitAfterTp1 !== sig.isBeHitAfterTp1 ||
          evalResult.isBeHitAfterTp2 !== sig.isBeHitAfterTp2 ||
          (liveQuote && liveQuote.price && sig.currentMarketPrice !== liveQuote.price) ||
          (isNewlyCancelled && sig.status !== 'CANCELLED')
        ) {
          hasChanges = true;
          return {
            ...sig,
            status: isNewlyCancelled ? 'CANCELLED' : sig.status,
            currentMarketPrice: (liveQuote && liveQuote.price) || sig.currentMarketPrice,
            outcomeStatus: evalResult.outcomeStatus,
            firstHitMilestone: evalResult.firstHitMilestone,
            isEntryTriggered: evalResult.isEntryTriggered ?? sig.isEntryTriggered,
            isBeHitAfterTp1: evalResult.isBeHitAfterTp1 ?? sig.isBeHitAfterTp1,
            isBeHitAfterTp2: evalResult.isBeHitAfterTp2 ?? sig.isBeHitAfterTp2,
            cancelReasonRo: evalResult.cancelReasonRo || sig.cancelReasonRo,
            cancelReasonEn: evalResult.cancelReasonEn || sig.cancelReasonEn,
          };
        }
        return sig;
      });

      if (newlyCancelledIds.length > 0) {
        setDeletedSignalIds((prevDel) => {
          const nextDel = Array.from(new Set([...prevDel, ...newlyCancelledIds]));
          try {
            localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(nextDel));
          } catch (e) {}
          return nextDel;
        });

        // Notify cloud server of auto-cancelled trades so MT5 and NinjaTrader receive them in cancelled_ids immediately
        const token = authToken || localStorage.getItem('market_ai_auth_token');
        if (token) {
          for (const cId of newlyCancelledIds) {
            fetch('/api/user/close-trade', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ signalId: cId }),
            }).catch(() => {});
          }
        }
      }

      return hasChanges ? updated : prevSignals;
    });
  }, [quotes]);

  // Periodic check for 23:00 Romania time market close cutoff for unactivated orders
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals((prevSignals) => {
        let hasChanges = false;
        const newlyCancelledIds: string[] = [];

        const updated = prevSignals.map((sig) => {
          const isUnactivated = !sig.isEntryTriggered || sig.outcomeStatus === 'PENDING';
          const isNotCancelled = sig.status !== 'CANCELLED' && sig.outcomeStatus !== 'CANCELLED' && sig.outcomeStatus !== 'SL_HIT' && sig.outcomeStatus !== 'TP3_HIT';

          if (isUnactivated && isNotCancelled && isSignalExpiredByMarketClose(sig.createdAt)) {
            hasChanges = true;
            newlyCancelledIds.push(sig.id);
            return {
              ...sig,
              status: 'CANCELLED' as const,
              outcomeStatus: 'CANCELLED' as const,
              firstHitMilestone: 'CANCELLED' as const,
              cancelReasonRo: 'Ordin neactivat până la ora 23:00 (înainte de închiderea pieței) - Anulat automat',
              cancelReasonEn: 'Unactivated order by 23:00 (1h before market close) - Automatically cancelled',
            };
          }
          return sig;
        });

        if (newlyCancelledIds.length > 0) {
          setDeletedSignalIds((prevDel) => {
            const nextDel = Array.from(new Set([...prevDel, ...newlyCancelledIds]));
            try {
              localStorage.setItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY, JSON.stringify(nextDel));
            } catch (e) {}
            return nextDel;
          });

          const token = authToken || localStorage.getItem('market_ai_auth_token');
          if (token) {
            for (const cId of newlyCancelledIds) {
              fetch('/api/user/close-trade', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ signalId: cId }),
              }).catch(() => {});
            }
          }
        }

        return hasChanges ? updated : prevSignals;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [authToken]);

  // Fetch quotes from server
  const fetchMarketQuotes = useCallback(
    async (force = false) => {
      setIsRefreshing(true);
      try {
        const queryParams = new URLSearchParams({
          lseKey: apiKeys.lseKey || 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c',
        });
        if (force) {
          queryParams.append('force', 'true');
        }

        const res = await fetch(`/api/market-data?${queryParams.toString()}`);
        const data = await res.json();
        if (data.quotes) {
          setQuotes(data.quotes);
        }
        if (data.apiErrors) {
          setApiErrors(data.apiErrors);
        } else {
          setApiErrors({});
        }
      } catch (err) {
        console.warn('Market fetch notification:', err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [apiKeys]
  );

  // Real-time WebSocket live streaming (LSE feeds) + SSE / REST fallback
  useEffect(() => {
    fetchMarketQuotes();

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let pingInterval: any = null;
    let isDisposed = false;

    const connectWs = () => {
      if (isDisposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/market-ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('⚡ Connected to MarketAI Live WebSocket (LSE Real-Time Feed)');
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'ping' }));
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'QUOTES_UPDATE' && data.quotes) {
              setQuotes((prev) => ({
                ...prev,
                ...data.quotes,
              }));
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          if (pingInterval) clearInterval(pingInterval);
          if (!isDisposed) {
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (err) {
        console.warn('WS connect error:', err);
        if (!isDisposed) {
          reconnectTimer = setTimeout(connectWs, 5000);
        }
      }
    };

    connectWs();

    // Fallback SSE streaming
    let eventSource: EventSource | null = null;
    try {
      const queryParams = new URLSearchParams({
        lseKey: apiKeys.lseKey || 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c',
      });
      eventSource = new EventSource(`/api/market-stream?${queryParams.toString()}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.quotes) {
            setQuotes((prev) => ({
              ...prev,
              ...data.quotes,
            }));
          }
          if (data.apiErrors) {
            setApiErrors(data.apiErrors);
          }
        } catch (e) {
          // ignore
        }
      };

      eventSource.onerror = () => {
        // Fallback or reconnect handles automatically
      };
    } catch (e) {
      console.warn('EventSource initialization:', e);
    }

    const interval = setInterval(() => {
      fetchMarketQuotes();
    }, 10000);

    return () => {
      isDisposed = true;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [fetchMarketQuotes, apiKeys]);

  // Handle generating fresh AI signal via server Gemini 3.6 Flash
  const handleGenerateSignal = async (
    instrumentId: InstrumentId,
    timeframe: TimeFrame,
    strategy: string
  ) => {
    // Check local timezone market status (Closed: Sat 00:00 - Mon 01:00 AM)
    const marketSchedule = getMarketScheduleStatus();
    if (marketSchedule.isClosed) {
      setIsMarketClosedModalOpen(true);
      return;
    }

    const isAdmin = user?.role === 'admin' || user?.username?.toLowerCase() === 'admin';
    if (!isAdmin && (!apiKeys.geminiApiKey || !apiKeys.geminiApiKey.trim())) {
      setIsKeysModalOpen(true);
      alert(
        lang === 'ro'
          ? 'Atenție! Pentru a genera semnale AI este necesar să introduceți cheia API Gemini în meniul Chei API.'
          : 'Notice! To generate AI signals, please enter your personal Gemini API key in the API Keys menu.'
      );
      return;
    }

    setIsGeneratingSignal(true);
    try {
      const res = await fetch('/api/generate-ai-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(apiKeys.geminiApiKey ? { 'x-gemini-api-key': apiKeys.geminiApiKey } : {}),
        },
        body: JSON.stringify({
          instrumentId,
          timeframe,
          strategy,
          lang,
          geminiApiKey: apiKeys.geminiApiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.signal) {
          setSignals((prev) => [data.signal, ...prev]);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'MISSING_GEMINI_API_KEY' && !isAdmin) {
          setIsKeysModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Failed to generate AI signal:', err);
    } finally {
      setIsGeneratingSignal(false);
    }
  };

  // Handle generating custom rule signal via server Gemini 3.6 Flash & Real Live Data
  const handleGenerateCustomSignal = async (rule: CustomSignalRule): Promise<TradingSignal | null> => {
    // Check local timezone market status (Closed: Sat 00:00 - Mon 01:00 AM)
    const marketSchedule = getMarketScheduleStatus();
    if (marketSchedule.isClosed) {
      setIsMarketClosedModalOpen(true);
      return null;
    }

    const isAdmin = user?.role === 'admin' || user?.username?.toLowerCase() === 'admin';
    if (!isAdmin && (!apiKeys.geminiApiKey || !apiKeys.geminiApiKey.trim())) {
      setIsKeysModalOpen(true);
      alert(
        lang === 'ro'
          ? 'Atenție! Pentru a genera semnale din reguli personalizate este necesar să introduceți cheia API Gemini în meniul Chei API.'
          : 'Notice! To generate custom rule signals, please enter your personal Gemini API key in the API Keys menu.'
      );
      return null;
    }

    setIsGeneratingSignal(true);
    try {
      const res = await fetch('/api/generate-custom-rule-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(apiKeys.geminiApiKey ? { 'x-gemini-api-key': apiKeys.geminiApiKey } : {}),
        },
        body: JSON.stringify({
          rule,
          lang,
          geminiApiKey: apiKeys.geminiApiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.signal) {
          setSignals((prev) => [data.signal, ...prev]);
          return data.signal;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'MISSING_GEMINI_API_KEY' && !isAdmin) {
          setIsKeysModalOpen(true);
        }
      }
      return null;
    } catch (err) {
      console.error('Failed to generate custom rule signal:', err);
      return null;
    } finally {
      setIsGeneratingSignal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative terminal-grid-ambient overflow-x-hidden">
      {/* Liquid Glass Ambient Refraction Glows */}
      <div className="fixed top-0 left-1/4 w-[32rem] h-[32rem] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-5 w-[28rem] h-[28rem] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="fixed bottom-20 left-10 w-[26rem] h-[26rem] bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Top Header */}
      <Header
        quotes={quotes}
        selectedInstrument={selectedInstrument}
        onSelectInstrument={setSelectedInstrument}
        onRefresh={() => fetchMarketQuotes(true)}
        isRefreshing={isRefreshing}
        onOpenKeysModal={() => setIsKeysModalOpen(true)}
        onOpenCalcModal={() => setIsCalcModalOpen(true)}
        onOpenMt5Modal={() => setIsMt5ModalOpen(true)}
        onOpenNinjaTraderModal={() => setIsNinjaTraderModalOpen(true)}
        onOpenAdminCrmModal={() => setIsAdminCrmModalOpen(true)}
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === 'ro' ? 'en' : 'ro'))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        signalsCount={signals.length}
        user={user}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onCopyInviteLink={handleCopyInviteLink}
        inviteCopied={inviteCopied}
      />

      {/* API Error Alert Banner */}
      {apiErrors.londonStrategicEdge && (
        <div className="max-w-[1720px] w-full mx-auto px-2 sm:px-4 md:px-6 pt-3 sm:pt-4">
          <div className="liquid-rose rounded-2xl p-3 sm:p-4 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xl backdrop-blur-xl border border-rose-500/40">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 shrink-0 mt-0.5 border border-rose-400/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-white block mb-0.5">
                  Atenție: Conexiune LSE Feed Live
                </span>
                <p className="text-rose-200 text-xs mt-1">
                  <strong className="text-white">LSE Feed:</strong> {apiErrors.londonStrategicEdge}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsKeysModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30 shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Verifică Conexiunea LSE</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-[1720px] w-full mx-auto px-2 sm:px-4 md:px-6 py-3 sm:py-6">
        {/* Section view rendering */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Dashboard Summary Card: Historical Success Rate & Win/Loss Ratio over last 30 days */}
            <SignalPerformanceSummaryCard
              signals={signals}
              lang={lang}
              onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
            />

            {/* Bento Tiles Module: Session & Hourly Trade Profitability Statistics */}
            <SessionProfitabilityBentoModule
              signals={signals}
              manualTrades={manualTrades}
              quotes={quotes}
              lang={lang}
              onNavigateToJournal={() => setActiveTab('journal')}
            />

            <MarketOverviewCards
              quotes={quotes}
              selectedInstrument={selectedInstrument}
              onSelectInstrument={setSelectedInstrument}
              signals={signals}
              onOpenCalcModal={() => setIsCalcModalOpen(true)}
              lang={lang}
              onGenerateSignal={handleGenerateSignal}
              onNavigateToSignals={() => setActiveTab('signals')}
              isGeneratingSignal={isGeneratingSignal}
            />
          </div>
        )}

        {activeTab === 'signals' && (
          <div>
            <TradingSignalsSection
              signals={signals}
              selectedInstrument={selectedInstrument}
              onSelectInstrument={setSelectedInstrument}
              onGenerateSignal={handleGenerateSignal}
              isGenerating={isGeneratingSignal}
              onOpenCalcModal={() => setIsCalcModalOpen(true)}
              lang={lang}
              onUpdateSignalOutcome={handleUpdateSignalOutcome}
              onDeleteSignal={handleDeleteSignal}
              onCloseTrade={handleCloseTrade}
              onCloseAllTrades={handleCloseAllTrades}
              onDeleteAllSignals={handleDeleteAllSignals}
              onResetSignals={handleResetSignals}
              onUpdateSignalPnl={handleUpdateSignalPnl}
              user={user}
              quotes={quotes}
            />
          </div>
        )}

        {activeTab === 'rules' && (
          <div>
            <CustomSignalRulesSection
              quotes={quotes}
              selectedInstrument={selectedInstrument}
              onSelectInstrument={setSelectedInstrument}
              onGenerateCustomSignal={handleGenerateCustomSignal}
              isGenerating={isGeneratingSignal}
              lang={lang}
            />
          </div>
        )}

        {activeTab === 'risk' && (
          <div>
            <RiskRulesConfigurationSection
              quotes={quotes}
              selectedInstrument={selectedInstrument}
              lang={lang}
              user={user}
              authToken={authToken}
              onUpdateUserBalance={(bal) => {
                if (user) {
                  setUser({ ...user, accountBalance: bal });
                }
              }}
            />
          </div>
        )}

        {activeTab === 'macro' && (
          <div>
            <MacroNewsSection selectedInstrument={selectedInstrument} lang={lang} />
          </div>
        )}

        {activeTab === 'journal' && (
          <div>
            <TradeJournalSection
              signals={signals}
              quotes={quotes}
              manualTrades={manualTrades}
              onSaveManualTrade={handleSaveManualTrade}
              onDeleteManualTrade={handleDeleteManualTrade}
              onClearAllManualTrades={handleClearAllManualTrades}
              onViewSignalDetails={(sig) => {
                setActiveTab('signals');
                setSelectedInstrument(sig.instrumentId);
              }}
              lang={lang}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <PositionCalculatorModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        selectedInstrument={selectedInstrument}
        quotes={quotes}
        lang={lang}
        user={user}
      />

      <ApiKeysModal
        isOpen={isKeysModalOpen}
        onClose={() => setIsKeysModalOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={(newKeys) => {
          setApiKeys(newKeys);
          // Force immediate market quotes fetch using the newly saved active keys
          setTimeout(() => {
            fetchMarketQuotes(true);
          }, 100);
        }}
        lang={lang}
        user={user}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          if (user) setIsAuthModalOpen(false);
        }}
        onAuthSuccess={handleAuthSuccess}
        lang={lang}
      />

      <AdminCrmModal
        isOpen={isAdminCrmModalOpen}
        onClose={() => setIsAdminCrmModalOpen(false)}
        authToken={authToken}
        lang={lang}
      />

      <MarketClosedModal
        isOpen={isMarketClosedModalOpen}
        onClose={() => setIsMarketClosedModalOpen(false)}
        lang={lang}
      />

      <SignalHistoryStatsModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        signals={signals}
        lang={lang}
        onDeleteSignal={handleDeleteSignal}
        onDeleteAllSignals={handleDeleteAllSignals}
        onResetSignals={handleResetSignals}
      />

      <Mt5IntegrationModal
        isOpen={isMt5ModalOpen}
        onClose={() => setIsMt5ModalOpen(false)}
        lang={lang}
        authToken={authToken}
        user={user}
      />

      <NinjaTraderIntegrationModal
        isOpen={isNinjaTraderModalOpen}
        onClose={() => setIsNinjaTraderModalOpen(false)}
        lang={lang}
        authToken={authToken}
        user={user}
      />

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteModalOpen}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        onConfirm={executeDeleteAllSignals}
        signalCount={signals.length}
        lang={lang}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070D1A]/85 backdrop-blur-2xl py-6 text-xs text-slate-400 mt-12 shadow-2xl">
        <div className="max-w-[1720px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium">
            <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-slate-300 font-semibold">
              MarketAI Terminal Pro • LSE Feed & Live Quant Quotes • Technicals by TradingView
            </span>
          </div>
          <p className="text-slate-500 text-[11px] font-medium font-mono text-center sm:text-right">
            {lang === 'ro'
              ? 'Avertisment: Tranzacționarea pe indici și aur implică risc de capital. Semnalele AI au rol analitic și educațional.'
              : 'Disclaimer: Trading indices and commodities involves capital risk. AI signals are for analytical & educational purposes.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
