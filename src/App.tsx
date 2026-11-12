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
import { AutomatedTradeSchedulerSection } from './components/AutomatedTradeSchedulerSection';
import { UsdHighImpactWarningModal, EconomicNewsEvent } from './components/UsdHighImpactWarningModal';
import { SessionProfitabilityBentoModule } from './components/SessionProfitabilityBentoModule';
import { MarketQuote, TradingSignal, InstrumentId, TimeFrame, UserApiKeys, CustomSignalRule, UserProfile, TradeJournalEntry } from './types';
import { evaluateSignalOutcome, filter30DaySignals, mergeSignals } from './utils/signalUtils';
import { getMarketScheduleStatus, isSignalExpiredByMarketClose } from './utils/marketSchedule';
import { INITIAL_SAMPLE_TRADES, isDemoOrSampleTrade, getLocalDateKey, formatTimeFromDate } from './utils/tradeJournalUtils';
import { ShieldCheck, Info, Sparkles, BarChart2, Sliders, Newspaper, LayoutGrid, AlertTriangle } from 'lucide-react';

const LOCAL_STORAGE_SIGNALS_KEY = 'market_ai_signals_v2';
const LOCAL_STORAGE_DELETED_SIGNALS_KEY = 'market_ai_deleted_signal_ids_v1';
const LOCAL_STORAGE_MANUAL_TRADES_KEY = 'market_ai_trade_journal_v1';
const LOCAL_STORAGE_DELETED_JOURNAL_KEY = 'market_ai_deleted_journal_ids_v1';

/**
 * Strict Environment Isolation:
 * Scopes client-side localStorage keys per authenticated User ID.
 * Prevents account cross-talk, data bleeding, or stale session contamination.
 */
export const getUserStorageKey = (base: string, userId?: string | null): string => {
  let uid = userId;
  if (!uid) {
    try {
      const saved = localStorage.getItem('market_ai_user_profile');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.id) uid = u.id;
      }
    } catch (_) {}
  }
  return uid ? `${base}_${uid}` : `${base}_guest`;
};

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

  // User Auth & Cloud State (Persistent across sessions and inactivity)
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('market_ai_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not read user profile from localStorage:', e);
    }
    return null;
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('market_ai_auth_token');
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => {
    // Only open login modal if user has never logged in (no token and no cached profile)
    return !localStorage.getItem('market_ai_auth_token');
  });
  const [isAdminCrmModalOpen, setIsAdminCrmModalOpen] = useState(false);
  const [isMarketClosedModalOpen, setIsMarketClosedModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isMt5ModalOpen, setIsMt5ModalOpen] = useState(false);
  const [isNinjaTraderModalOpen, setIsNinjaTraderModalOpen] = useState(false);
  const [isUsdWarningModalOpen, setIsUsdWarningModalOpen] = useState(false);
  const [usdWarningEvents, setUsdWarningEvents] = useState<EconomicNewsEvent[]>([]);
  const [usdWarningInstrument, setUsdWarningInstrument] = useState<InstrumentId>('NASDAQ');
  const [pendingSignalAction, setPendingSignalAction] = useState<(() => void) | null>(null);
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
      const uid = (() => {
        try {
          const s = localStorage.getItem('market_ai_user_profile');
          return s ? JSON.parse(s)?.id : null;
        } catch (_) { return null; }
      })();
      if (!uid) return [];
      const saved = localStorage.getItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, uid));
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
      const uid = (() => {
        try {
          const s = localStorage.getItem('market_ai_user_profile');
          return s ? JSON.parse(s)?.id : null;
        } catch (_) { return null; }
      })();
      if (!uid) return [];
      const savedDeleted = localStorage.getItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, uid));
      const delIds = savedDeleted ? JSON.parse(savedDeleted) : [];
      const saved = localStorage.getItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, uid));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return filter30DaySignals(parsed, delIds).filter((s) => !s.userId || s.userId === uid);
        }
      }
    } catch (e) {
      console.warn('Could not read signals from localStorage:', e);
    }
    return [];
  });

  const [deletedJournalTradeIds, setDeletedJournalTradeIds] = useState<string[]>(() => {
    try {
      const uid = (() => {
        try {
          const s = localStorage.getItem('market_ai_user_profile');
          return s ? JSON.parse(s)?.id : null;
        } catch (_) { return null; }
      })();
      if (!uid) return [];
      const saved = localStorage.getItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, uid));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read deletedJournalTradeIds from localStorage:', e);
    }
    return [];
  });

  const [manualTrades, setManualTrades] = useState<TradeJournalEntry[]>(() => {
    try {
      const uid = (() => {
        try {
          const s = localStorage.getItem('market_ai_user_profile');
          return s ? JSON.parse(s)?.id : null;
        } catch (_) { return null; }
      })();
      if (!uid) return [];
      const savedDelJournal = localStorage.getItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, uid));
      const delJournalIds = savedDelJournal ? new Set<string>(JSON.parse(savedDelJournal)) : new Set<string>();

      const saved = localStorage.getItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, uid));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((t: any) => {
            if (!t || isDemoOrSampleTrade(t)) return false;
            if (delJournalIds.has(t.id)) return false;
            if (t.linkedSignalId && delJournalIds.has(t.linkedSignalId)) return false;
            if (delJournalIds.has(`sig_journal_${t.id}`)) return false;
            return true;
          });
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
            try {
              localStorage.setItem('market_ai_user_profile', JSON.stringify(data.user));
            } catch (e) {}

            // Fetch Cloud Synced Data (Signals & Keys) for this user
            const syncRes = await fetch('/api/user/sync-data', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (syncRes.ok && !isCancelled) {
              const syncData = await syncRes.json();
              const cloudDeleted = Array.isArray(syncData.deletedSignalIds) ? syncData.deletedSignalIds : [];
              setDeletedSignalIds(cloudDeleted);
              try {
                localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, data.user.id), JSON.stringify(cloudDeleted));
              } catch (e) {}

              const cloudDeletedJournal = Array.isArray(syncData.deletedJournalTradeIds) ? syncData.deletedJournalTradeIds : [];
              setDeletedJournalTradeIds(cloudDeletedJournal);
              try {
                localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, data.user.id), JSON.stringify(cloudDeletedJournal));
              } catch (e) {}
              const cloudDeletedJournalSet = new Set(cloudDeletedJournal);

              if (Array.isArray(syncData.signals)) {
                // Strict isolation: only load signals matching this user's ID
                const userFiltered = filter30DaySignals(syncData.signals, cloudDeleted)
                  .filter((s) => !s.userId || s.userId === data.user.id)
                  .map((s) => ({ ...s, userId: data.user.id }));
                setSignals(userFiltered);
                try {
                  localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, data.user.id), JSON.stringify(userFiltered));
                } catch (e) {}
              }
              if (Array.isArray(syncData.tradeJournal)) {
                const cleanCloud = syncData.tradeJournal.filter((t: any) => {
                  if (!t || isDemoOrSampleTrade(t)) return false;
                  if (cloudDeletedJournalSet.has(t.id)) return false;
                  if (t.linkedSignalId && cloudDeletedJournalSet.has(t.linkedSignalId)) return false;
                  if (cloudDeletedJournalSet.has(`sig_journal_${t.id}`)) return false;
                  return true;
                });
                setManualTrades(cleanCloud);
                try {
                  localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, data.user.id), JSON.stringify(cleanCloud));
                } catch (e) {}
              }
              if (syncData.apiKeys && (syncData.apiKeys.geminiApiKey || syncData.apiKeys.lseKey)) {
                setApiKeys(syncData.apiKeys);
              }
            }
          }
        } else if (res.status === 401 || res.status === 403) {
          // Server explicitly rejected the session (invalid token, blocked account or expired subscription):
          // drop the cached profile so the user is not left in a "logged in" UI where every API call fails.
          // Network errors (catch below) still preserve the session.
          const currentToken = localStorage.getItem('market_ai_auth_token');
          if (currentToken === token && !isCancelled) {
            try {
              localStorage.removeItem('market_ai_user_profile');
              if (res.status === 401) localStorage.removeItem('market_ai_auth_token');
            } catch (e) {}
            setUser(null);
            setIsAuthModalOpen(true);
          }
        }
      } catch (err) {
        // Transient network error or browser tab waking up after inactivity:
        // KEEP USER LOGGED IN! Preserves session without annoying login dialogs.
        console.warn('Network issue during auth verification (session preserved):', err);
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
  // Dynamic auth & live broker trade synchronization
  // Uses high-speed 1000ms polling during active trades, 3000ms in idle mode
  const hasActiveTrades = Boolean(
    (user?.mt5OpenPositions && user.mt5OpenPositions.length > 0) ||
    signals.some((s) => s.status === 'ACTIVE' || s.outcomeStatus === 'RUNNING' || s.isEntryTriggered)
  );

  useEffect(() => {
    if (!authToken) return;
    const pollIntervalMs = hasActiveTrades ? 1000 : 3000;

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
                prevUser.subscriptionDaysLeft !== data.user.subscriptionDaysLeft ||
                JSON.stringify(prevUser.mt5OpenPositions) !== JSON.stringify(data.user.mt5OpenPositions)
              ) {
                const updatedUser = {
                  ...prevUser,
                  ...data.user,
                };
                try {
                  localStorage.setItem('market_ai_user_profile', JSON.stringify(updatedUser));
                } catch (e) {}
                return updatedUser;
              }
              return prevUser;
            });

            // Synchronize live MT5 floating profit & confirmed closure status into local signals state
            if (Array.isArray(data.user.signals) && data.user.signals.length > 0) {
              setSignals((prevSignals) => {
                let hasChanges = false;
                const updated = prevSignals.map((s) => {
                  const srv = data.user.signals.find((sig: any) => String(sig.id) === String(s.id));
                  if (!srv) return s;

                  const isMt5PendingOrder = Array.isArray(data.user.mt5OpenOrders) && data.user.mt5OpenOrders.some((o: any) =>
                    o && (String(o.signalId) === String(s.id) || String(o.signalId) === String(s.signal_id))
                  );
                  const isMt5OpenPos = Array.isArray(data.user.mt5OpenPositions) && data.user.mt5OpenPositions.some((p: any) =>
                    p && (String(p.signalId) === String(s.id) || String(p.signalId) === String(s.signal_id))
                  );

                  const isExplicitManual = s.isManualClose === true || s.closedManually === true || (typeof s.outcomeStatus === 'string' && s.outcomeStatus.startsWith('MANUAL_'));

                  const isClosedSignal = !isMt5PendingOrder && !isMt5OpenPos && (
                    s.status === 'CLOSED' ||
                    s.status === 'CANCELLED' ||
                    (isExplicitManual && s.closedAt !== undefined) ||
                    s.outcomeStatus === 'CANCELLED' ||
                    s.outcomeStatus === 'TP3_HIT' ||
                    s.outcomeStatus === 'SL_HIT' ||
                    (typeof s.outcomeStatus === 'string' && s.outcomeStatus.startsWith('MANUAL_'))
                  );

                  const isPendingOrder = isMt5PendingOrder || ((!s.outcomeStatus || s.outcomeStatus === 'PENDING') && !s.isEntryTriggered && !isMt5OpenPos);

                  // Extract latest floating profit ONLY for active, triggered, non-closed trades
                  let posProfit: number | undefined = undefined;
                  if (!isClosedSignal && !isPendingOrder && Array.isArray(data.user.mt5OpenPositions)) {
                    const p = data.user.mt5OpenPositions.find((pos: any) =>
                      pos && (
                        (pos.signalId && (String(pos.signalId) === String(s.id) || String(pos.signalId) === String(s.signal_id))) ||
                        (pos.symbol && s.symbol && pos.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(s.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')))
                      )
                    );
                    if (p && typeof p.profit === 'number') {
                      posProfit = p.profit;
                    }
                  }

                  // Clear liveProfit if closed or pending order
                  const newLiveProfit = (isClosedSignal || isPendingOrder) ? undefined : (posProfit !== undefined ? posProfit : srv.liveProfit);
                  const newPnl = (isPendingOrder || (!isClosedSignal && isMt5OpenPos)) ? undefined : srv.pnl;
                  let newStatus = srv.status;
                  let newOutcome = srv.outcomeStatus;

                  if (isMt5PendingOrder) {
                    newStatus = 'ACTIVE';
                    newOutcome = 'PENDING';
                  } else if (isMt5OpenPos) {
                    newStatus = 'RUNNING';
                    if (!['TP1_HIT', 'TP2_HIT'].includes(s.outcomeStatus || '')) {
                      newOutcome = 'RUNNING';
                    }
                  }

                  const srvIsClosed =
                    srv.status === 'CLOSED' ||
                    srv.status === 'CANCELLED' ||
                    srv.realizedProfit !== undefined ||
                    (typeof srv.outcomeStatus === 'string' && (
                      srv.outcomeStatus.startsWith('MANUAL_') ||
                      ['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'SL_HIT', 'CANCELLED'].includes(srv.outcomeStatus)
                    ));

                  // Never overwrite live streaming prices with stale server snapshots
                  // Never overwrite unactivated pending limit orders with stale server RUNNING status
                  const canAcceptOutcome =
                    newOutcome &&
                    s.outcomeStatus !== newOutcome &&
                    (srvIsClosed || (!(isPendingOrder && newOutcome === 'RUNNING') &&
                     s.outcomeStatus !== 'SL_HIT' &&
                     s.outcomeStatus !== 'TP3_HIT' &&
                     s.outcomeStatus !== 'CANCELLED'));

                  const canAcceptStatus =
                    newStatus &&
                    s.status !== newStatus &&
                    (srvIsClosed || !(isPendingOrder && newStatus === 'RUNNING'));

                  if (
                    (newLiveProfit !== undefined && s.liveProfit !== newLiveProfit) ||
                    (newPnl !== undefined && s.pnl !== newPnl) ||
                    canAcceptStatus ||
                    canAcceptOutcome ||
                    (srv.exitPrice !== undefined && s.exitPrice !== srv.exitPrice) ||
                    (srv.realizedProfit !== undefined && s.realizedProfit !== srv.realizedProfit)
                  ) {
                    hasChanges = true;
                    return {
                      ...s,
                      liveProfit: newLiveProfit !== undefined ? newLiveProfit : s.liveProfit,
                      pnl: newPnl !== undefined ? newPnl : s.pnl,
                      status: canAcceptStatus ? newStatus : s.status,
                      outcomeStatus: canAcceptOutcome ? newOutcome : s.outcomeStatus,
                      exitPrice: srv.exitPrice ?? s.exitPrice,
                      realizedProfit: srv.realizedProfit ?? s.realizedProfit,
                    };
                  }
                  return s;
                });
                return hasChanges ? updated : prevSignals;
              });
            }
          }
        }
      } catch (e) {
        // silent
      }
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [authToken, hasActiveTrades]);

  // Save Cloud Data to Server whenever signals, apiKeys or deletedSignalIds update (Debounced 1500ms to eliminate burst requests)
  useEffect(() => {
    if (!user || !authToken || !isCloudSynced) return;

    const timer = setTimeout(async () => {
      try {
        // Strict environment isolation: ensure only current user's signals are synced
        const clean = filter30DaySignals(signals, deletedSignalIds)
          .filter((s) => !s.userId || s.userId === user.id)
          .map((s) => ({ ...s, userId: user.id }));
        await fetch('/api/user/sync-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            signals: clean,
            deletedSignalIds,
            deletedJournalTradeIds,
            tradeJournal: manualTrades,
            apiKeys,
          }),
        });
      } catch (e) {
        console.warn('Cloud synchronization failed:', e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [signals, manualTrades, apiKeys, deletedSignalIds, deletedJournalTradeIds, user, authToken, isCloudSynced]);

  // Sync active signals to MT5 & NinjaTrader bridge server endpoints (Debounced 1500ms)
  useEffect(() => {
    if (!user || !authToken || !isCloudSynced) return;

    const timer = setTimeout(async () => {
      try {
        const cleanSignals = filter30DaySignals(signals, deletedSignalIds)
          .filter((s) => !s.userId || s.userId === user.id)
          .map((s) => ({ ...s, userId: user.id }));
        await Promise.all([
          fetch('/api/mt5/signals/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ signals: cleanSignals }),
          }),
          fetch('/api/ninjatrader/signals/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ signals: cleanSignals }),
          }),
        ]);
      } catch (e) {
        // silent
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [signals, deletedSignalIds, user, authToken, isCloudSynced]);

  const handleAuthSuccess = async (newUser: UserProfile, newAuthToken: string) => {
    setUser(newUser);
    setAuthToken(newAuthToken);
    try {
      localStorage.setItem('market_ai_auth_token', newAuthToken);
      localStorage.setItem('market_ai_user_profile', JSON.stringify(newUser));
    } catch (e) {
      console.warn('Could not cache session to localStorage:', e);
    }
    setIsAuthModalOpen(false);

    // Fetch user cloud data
    try {
      const syncRes = await fetch('/api/user/sync-data', {
        headers: { Authorization: `Bearer ${newAuthToken}` },
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        const cloudDeleted = Array.isArray(syncData.deletedSignalIds) ? syncData.deletedSignalIds : [];
        setDeletedSignalIds(cloudDeleted);
        try {
          localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, newUser.id), JSON.stringify(cloudDeleted));
        } catch (e) {}

        const cloudDeletedJournal = Array.isArray(syncData.deletedJournalTradeIds) ? syncData.deletedJournalTradeIds : [];
        setDeletedJournalTradeIds(cloudDeletedJournal);
        try {
          localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, newUser.id), JSON.stringify(cloudDeletedJournal));
        } catch (e) {}
        const cloudDeletedJournalSet = new Set(cloudDeletedJournal);

        if (Array.isArray(syncData.signals)) {
          const userFiltered = filter30DaySignals(syncData.signals, cloudDeleted)
            .filter((s) => !s.userId || s.userId === newUser.id)
            .map((s) => ({ ...s, userId: newUser.id }));
          setSignals(userFiltered);
          try {
            localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, newUser.id), JSON.stringify(userFiltered));
          } catch (e) {}
        }
        if (Array.isArray(syncData.tradeJournal)) {
          const cleanCloud = syncData.tradeJournal.filter((t: any) => {
            if (!t || isDemoOrSampleTrade(t)) return false;
            if (cloudDeletedJournalSet.has(t.id)) return false;
            if (t.linkedSignalId && cloudDeletedJournalSet.has(t.linkedSignalId)) return false;
            if (cloudDeletedJournalSet.has(`sig_journal_${t.id}`)) return false;
            return true;
          });
          setManualTrades(cleanCloud);
          try {
            localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, newUser.id), JSON.stringify(cleanCloud));
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

  const handleLogout = async () => {
    const currentToken = authToken || localStorage.getItem('market_ai_auth_token');
    const oldUserId = user?.id;
    setUser(null);
    setAuthToken(null);
    setIsCloudSynced(false);
    setSignals([]);
    setDeletedSignalIds([]);
    setDeletedJournalTradeIds([]);
    setManualTrades([]);
    localStorage.removeItem('market_ai_auth_token');
    localStorage.removeItem('market_ai_user_profile');
    if (oldUserId) {
      localStorage.removeItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, oldUserId));
      localStorage.removeItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, oldUserId));
      localStorage.removeItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, oldUserId));
      localStorage.removeItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, oldUserId));
    }
    localStorage.removeItem(LOCAL_STORAGE_SIGNALS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_DELETED_SIGNALS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_DELETED_JOURNAL_KEY);
    localStorage.removeItem(LOCAL_STORAGE_MANUAL_TRADES_KEY);
    setIsAuthModalOpen(true);

    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch (e) {
        // silent
      }
    }
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
    if (!user?.id) return;
    try {
      const clean = filter30DaySignals(signals, deletedSignalIds)
        .filter((s) => !s.userId || s.userId === user.id)
        .map((s) => ({ ...s, userId: user.id }));
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, user.id), JSON.stringify(clean));
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user.id), JSON.stringify(deletedSignalIds));
    } catch (e) {
      console.warn('Could not save signals to localStorage:', e);
    }
  }, [signals, deletedSignalIds, user?.id]);

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
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn('Could not save deletedSignalIds to localStorage:', e);
    }

    const journalIdsToRemove = [signalId, `sig_journal_${signalId}`];
    const newDelJournal = Array.from(new Set([...deletedJournalTradeIds, ...journalIdsToRemove]));
    setDeletedJournalTradeIds(newDelJournal);
    try {
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, user?.id), JSON.stringify(newDelJournal));
    } catch (e) {}

    setManualTrades((prev) => {
      const updated = prev.filter((t) => t.id !== signalId && t.id !== `sig_journal_${signalId}` && t.linkedSignalId !== signalId);
      try {
        localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, user?.id), JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

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
    if (!targetSig) return;
    const liveQ = quotes[targetSig.instrumentId];
    const exitPrice = liveQ && liveQ.price > 0 ? liveQ.price : (targetSig?.currentMarketPrice || targetSig?.entryPrice || 0);

    const isBuy = (targetSig.type || '').toUpperCase().includes('BUY');
    const riskDist = Math.max(0.0001, Math.abs(targetSig.entryPrice - targetSig.stopLoss));
    const move = isBuy ? (exitPrice - targetSig.entryPrice) : (targetSig.entryPrice - exitPrice);
    const rr = Math.round((move / riskDist) * 10) / 10;

    const accountBalance = user?.accountBalance || 100000;
    const riskPerTrade = user?.riskSettings?.riskPerTrade ?? 1.0;
    const dollarRisk = Math.max(10, Math.round(accountBalance * (riskPerTrade / 100)));

    const finalPnl = targetSig.pnl !== undefined
      ? Math.round(targetSig.pnl * 100) / 100
      : Math.round(dollarRisk * rr * 100) / 100;
    const finalStatus: 'WIN' | 'LOSS' | 'BREAKEVEN' = finalPnl > 0 ? 'WIN' : finalPnl < 0 ? 'LOSS' : 'BREAKEVEN';
    const outcomeLabel = finalPnl > 0
      ? `Închis Manual Profit (+$${finalPnl.toFixed(2)})`
      : finalPnl < 0
      ? `Închis Manual Pierdere (-$${Math.abs(finalPnl).toFixed(2)})`
      : 'Închis Manual (BE)';

    const nowIso = new Date().toISOString();
    const dKey = getLocalDateKey(targetSig.createdAt);
    const timeStr = formatTimeFromDate(targetSig.createdAt);

    // 1. Create and persist permanent trade journal entry with real profit / loss
    const journalEntry: TradeJournalEntry = {
      id: `sig_journal_${targetSig.id}`,
      date: dKey,
      time: timeStr,
      instrumentId: targetSig.instrumentId,
      symbol: targetSig.symbol,
      instrumentName: targetSig.instrumentName,
      direction: isBuy ? 'BUY' : 'SELL',
      executionType: targetSig.executionType || (isBuy ? 'BUY MARKET' : 'SELL MARKET'),
      entryPrice: targetSig.entryPrice,
      stopLoss: targetSig.stopLoss,
      takeProfit: targetSig.targetPrice3 || targetSig.targetPrice2 || targetSig.targetPrice1,
      exitPrice: exitPrice,
      rrAchieved: rr,
      pnl: finalPnl,
      status: finalStatus,
      outcomeLabel: outcomeLabel,
      setup: targetSig.title || 'Manual Closed Trade',
      notes: `Închis manual la prețul de $${exitPrice} (${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)})`,
      timeframe: targetSig.timeframe,
      linkedSignalId: targetSig.id,
      isManual: true,
      generatedAt: targetSig.createdAt,
      entryDate: dKey,
      entryTime: timeStr,
      closedAt: nowIso,
      createdAt: targetSig.createdAt,
    };

    handleSaveManualTrade(journalEntry);

    // 2. Mark signal as CANCELLED / CLOSED with manual close details
    setSignals((prev) =>
      prev.map((s) => {
        if (s.id === signalId) {
          return {
            ...s,
            status: 'CANCELLED',
            outcomeStatus: 'CANCELLED',
            cancelReasonRo: `Închis manual din interfață la $${exitPrice} (${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)})`,
            cancelReasonEn: `Manually closed from dashboard at $${exitPrice} (${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)})`,
            closedAt: nowIso,
            exitPrice: exitPrice,
            pnl: finalPnl,
            realizedProfit: finalPnl,
          };
        }
        return s;
      })
    );

    // 3. Add to deletedSignalIds so MT5 & NinjaTrader receive it in cancelled_ids immediately
    const updatedDeleted = Array.from(new Set([...deletedSignalIds, signalId]));
    setDeletedSignalIds(updatedDeleted);
    try {
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn('Could not save deletedSignalIds to localStorage:', e);
    }

    // 4. Post to /api/user/close-trade
    const token = authToken || localStorage.getItem('market_ai_auth_token');
    if (token) {
      try {
        await fetch('/api/user/close-trade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            signalId,
            exitPrice,
            pnl: finalPnl,
            status: finalStatus,
            outcomeLabel,
            journalEntry,
          }),
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
    const accountBalance = user?.accountBalance || 100000;
    const riskPerTrade = user?.riskSettings?.riskPerTrade ?? 1.0;
    const dollarRisk = Math.max(10, Math.round(accountBalance * (riskPerTrade / 100)));

    const createdJournalEntries: TradeJournalEntry[] = [];

    setSignals((prev) =>
      prev.map((s) => {
        if (closingIds.includes(s.id)) {
          const liveQ = quotes[s.instrumentId];
          const exitPrice = liveQ && liveQ.price > 0 ? liveQ.price : (s.currentMarketPrice || s.entryPrice || 0);
          const isBuy = (s.type || '').toUpperCase().includes('BUY');
          const riskDist = Math.max(0.0001, Math.abs(s.entryPrice - s.stopLoss));
          const move = isBuy ? (exitPrice - s.entryPrice) : (s.entryPrice - exitPrice);
          const rr = Math.round((move / riskDist) * 10) / 10;
          const finalPnl = s.pnl !== undefined
            ? Math.round(s.pnl * 100) / 100
            : Math.round(dollarRisk * rr * 100) / 100;
          const finalStatus: 'WIN' | 'LOSS' | 'BREAKEVEN' = finalPnl > 0 ? 'WIN' : finalPnl < 0 ? 'LOSS' : 'BREAKEVEN';
          const outcomeLabel = finalPnl > 0
            ? `Închis Manual Profit (+$${finalPnl.toFixed(2)})`
            : finalPnl < 0
            ? `Închis Manual Pierdere (-$${Math.abs(finalPnl).toFixed(2)})`
            : 'Închis Manual (BE)';

          const dKey = getLocalDateKey(s.createdAt);
          const timeStr = formatTimeFromDate(s.createdAt);

          const jEntry: TradeJournalEntry = {
            id: `sig_journal_${s.id}`,
            date: dKey,
            time: timeStr,
            instrumentId: s.instrumentId,
            symbol: s.symbol,
            instrumentName: s.instrumentName,
            direction: isBuy ? 'BUY' : 'SELL',
            executionType: s.executionType || (isBuy ? 'BUY MARKET' : 'SELL MARKET'),
            entryPrice: s.entryPrice,
            stopLoss: s.stopLoss,
            takeProfit: s.targetPrice3 || s.targetPrice2 || s.targetPrice1,
            exitPrice: exitPrice,
            rrAchieved: rr,
            pnl: finalPnl,
            status: finalStatus,
            outcomeLabel: outcomeLabel,
            setup: s.title || 'Manual Closed Trade (Close All)',
            notes: `Închis manual la comanda Închidere Totală ($${exitPrice})`,
            timeframe: s.timeframe,
            linkedSignalId: s.id,
            isManual: true,
            generatedAt: s.createdAt,
            entryDate: dKey,
            entryTime: timeStr,
            closedAt: nowIso,
            createdAt: s.createdAt,
          };
          createdJournalEntries.push(jEntry);

          return {
            ...s,
            status: 'CANCELLED',
            outcomeStatus: 'CANCELLED',
            cancelReasonRo: `Închis manual din interfață la $${exitPrice} (${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)})`,
            cancelReasonEn: `Manually closed from dashboard at $${exitPrice} (${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)})`,
            closedAt: nowIso,
            exitPrice: exitPrice,
            pnl: finalPnl,
            realizedProfit: finalPnl,
          };
        }
        return s;
      })
    );

    // Save all to manualTrades
    if (createdJournalEntries.length > 0) {
      setManualTrades((prev) => {
        const existingMap = new Map(prev.map((t) => [t.id, t]));
        for (const e of createdJournalEntries) {
          existingMap.set(e.id, e);
        }
        const updated = Array.from(existingMap.values()).filter((t) => !isDemoOrSampleTrade(t));
        try {
          localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, user?.id), JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }

    const updatedDeleted = Array.from(new Set([...deletedSignalIds, ...closingIds]));
    setDeletedSignalIds(updatedDeleted);
    try {
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(updatedDeleted));
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
          body: JSON.stringify({ signalIds: closingIds, journalEntries: createdJournalEntries }),
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
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, user?.id), JSON.stringify([]));
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(updatedDeleted));
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
        localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, user?.id), JSON.stringify(clean));
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
    const idsToDelete = new Set<string>([tradeId]);
    if (tradeId.startsWith('sig_journal_')) {
      idsToDelete.add(tradeId.replace('sig_journal_', ''));
    } else {
      idsToDelete.add(`sig_journal_${tradeId}`);
    }

    const foundInManual = manualTrades.find((t) => t.id === tradeId || t.linkedSignalId === tradeId);
    if (foundInManual?.linkedSignalId) {
      idsToDelete.add(foundInManual.linkedSignalId);
      idsToDelete.add(`sig_journal_${foundInManual.linkedSignalId}`);
    }

    // Also search signals
    const foundSignal = signals.find((s) => s.id === tradeId || `sig_journal_${s.id}` === tradeId || s.signal_id === tradeId);
    if (foundSignal) {
      idsToDelete.add(foundSignal.id);
      idsToDelete.add(`sig_journal_${foundSignal.id}`);
      if (foundSignal.signal_id) {
        idsToDelete.add(foundSignal.signal_id);
        idsToDelete.add(`sig_journal_${foundSignal.signal_id}`);
      }
    }

    const newDeletedJournalIds = Array.from(new Set([...deletedJournalTradeIds, ...Array.from(idsToDelete)]));
    setDeletedJournalTradeIds(newDeletedJournalIds);
    try {
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, user?.id), JSON.stringify(newDeletedJournalIds));
    } catch (e) {}

    // Update manual trades state
    setManualTrades((prev) => {
      const updated = prev.filter((t) => !idsToDelete.has(t.id) && (!t.linkedSignalId || !idsToDelete.has(t.linkedSignalId)) && !isDemoOrSampleTrade(t));
      try {
        localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, user?.id), JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Also remove from signals if it was an AI signal
    if (foundSignal || foundInManual?.linkedSignalId) {
      const sigIdToRemove = foundSignal?.id || foundInManual?.linkedSignalId;
      if (sigIdToRemove) {
        setSignals((prev) => {
          const updatedSignals = prev.filter((s) => s.id !== sigIdToRemove && !idsToDelete.has(s.id));
          try {
            localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_SIGNALS_KEY, user?.id), JSON.stringify(updatedSignals));
          } catch (e) {}
          return updatedSignals;
        });
        setDeletedSignalIds((prev) => {
          const updated = Array.from(new Set([...prev, sigIdToRemove]));
          try {
            localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    }

    // Persist permanent deletion to backend
    const token = authToken || localStorage.getItem('market_ai_auth_token');
    if (token) {
      fetch('/api/user/trade-journal/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tradeIds: Array.from(idsToDelete) }),
      }).catch((err) => console.warn('Backend delete trade failed:', err));

      fetch('/api/user/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deletedJournalTradeIds: newDeletedJournalIds,
        }),
      }).catch((err) => console.warn('Cloud sync deletedJournalTradeIds failed:', err));
    }
  };

  const handleClearAllManualTrades = () => {
    const allIds = new Set<string>();
    for (const t of manualTrades) {
      if (t && t.id) {
        allIds.add(t.id);
        allIds.add(`sig_journal_${t.id}`);
      }
      if (t && t.linkedSignalId) {
        allIds.add(t.linkedSignalId);
        allIds.add(`sig_journal_${t.linkedSignalId}`);
      }
    }
    for (const s of signals) {
      if (s && s.id) {
        allIds.add(s.id);
        allIds.add(`sig_journal_${s.id}`);
      }
    }

    const newDeletedJournalIds = Array.from(new Set([...deletedJournalTradeIds, ...Array.from(allIds)]));
    setDeletedJournalTradeIds(newDeletedJournalIds);
    setManualTrades([]);

    try {
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_JOURNAL_KEY, user?.id), JSON.stringify(newDeletedJournalIds));
      localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, user?.id), JSON.stringify([]));
    } catch (e) {}

    const token = authToken || localStorage.getItem('market_ai_auth_token');
    if (token) {
      fetch('/api/user/trade-journal/clear-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch((err) => console.warn('Backend clear all trades failed:', err));

      fetch('/api/user/sync-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tradeJournal: [],
          deletedJournalTradeIds: newDeletedJournalIds,
        }),
      }).catch((err) => console.warn('Cloud clear tradeJournal failed:', err));
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingSignal, setIsGeneratingSignal] = useState(false);
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [apiErrors, setApiErrors] = useState<{ londonStrategicEdge?: string }>({});

  const autoGeneratedRef = React.useRef(false);

  // Auto-generate fresh AI signals with progressive streaming into state
  const autoGenerate3Signals = useCallback(async (targetLang: 'ro' | 'en') => {
    const marketSchedule = getMarketScheduleStatus();
    if (marketSchedule.isClosed) {
      console.log('Piața este închisă pentru weekend. Generarea automată de semnale a fost omisă.');
      setIsGeneratingSignal(false);
      return;
    }

    setIsGeneratingSignal(true);
    try {
      // Prioritize flagship instruments first (NASDAQ, GOLD, DOW_JONES)
      const pairs: { id: InstrumentId; tf: TimeFrame; strat: string }[] = [
        { id: 'NASDAQ', tf: '1h', strat: 'Intraday Trend & Breakout' },
        { id: 'GOLD', tf: '4h', strat: 'Swing Trend & Safe Haven Demand' },
        { id: 'DOW_JONES', tf: '1h', strat: 'Intraday Trend & Breakout' },
        { id: 'SPX500', tf: '1h', strat: 'Intraday Trend & Breakout' },
        { id: 'NQ_F', tf: '1h', strat: 'Futures Intraday Momentum' },
        { id: 'GC_F', tf: '4h', strat: 'Gold Futures Breakout' },
        { id: 'YM_F', tf: '1h', strat: 'Dow Jones Futures Flow' },
        { id: 'ES_F', tf: '1h', strat: 'S&P 500 Futures Flow' },
        { id: 'EURUSD', tf: '1h', strat: 'London/NY FX Session Flow' },
        { id: 'GBPUSD', tf: '1h', strat: 'Cable Breakout & Volatility' },
        { id: 'USDJPY', tf: '1h', strat: 'Tokyo/NY Session Momentum' },
      ];

      // Stream each generated signal progressively into state as soon as it arrives
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
            if (data.signal) {
              setSignals((prev) => {
                if (prev.some((s) => s.id === data.signal.id)) return prev;
                return [data.signal, ...prev];
              });
              return (data.signal as TradingSignal);
            }
          }
        } catch (e) {
          console.warn(`Auto signal generation error for ${p.id}:`, e);
        }
        return null;
      });

      await Promise.all(promises);
    } finally {
      setIsGeneratingSignal(false);
    }
  }, [authToken, apiKeys]);

  const handleResetSignals = () => {
    setSignals([]);
    setDeletedSignalIds([]);
  };

  // Automated trade status & milestone evaluation loop
  useEffect(() => {
    if (signals.length === 0) return;

    setSignals((prevSignals) => {
      let hasChanges = false;
      const newlyCancelledIds: string[] = [];
      const milestoneJournalEntries: TradeJournalEntry[] = [];

      const updated = prevSignals.map((sig) => {
        const isClosedSignal =
          sig.status === 'CLOSED' ||
          sig.status === 'CANCELLED' ||
          sig.outcomeStatus === 'CANCELLED' ||
          sig.outcomeStatus === 'TP3_HIT' ||
          sig.outcomeStatus === 'SL_HIT' ||
          (typeof sig.outcomeStatus === 'string' && sig.outcomeStatus.startsWith('MANUAL_')) ||
          ((sig.isManualClose === true || sig.closedManually === true) && sig.closedAt !== undefined);

        if (isClosedSignal) {
          if (sig.outcomeStatus === 'PENDING' || sig.outcomeStatus === 'RUNNING' || !sig.outcomeStatus) {
            hasChanges = true;
            const effectivePnl = sig.pnl !== undefined ? sig.pnl : sig.realizedProfit;
            const isManual = sig.isManualClose === true || sig.closedManually === true;
            let termOutcome: NonNullable<TradingSignal['outcomeStatus']>;
            if (sig.status === 'CANCELLED') {
              termOutcome = 'CANCELLED';
            } else if (isManual) {
              termOutcome = effectivePnl !== undefined && effectivePnl > 0 ? 'MANUAL_PROFIT' : (effectivePnl !== undefined && effectivePnl < 0 ? 'MANUAL_LOSS' : 'MANUAL_BE');
            } else {
              termOutcome = effectivePnl !== undefined && effectivePnl > 0 ? 'TP1_HIT' : (effectivePnl !== undefined && effectivePnl < 0 ? 'SL_HIT' : 'CANCELLED');
            }
            return {
              ...sig,
              status: (sig.status === 'CANCELLED' ? 'CANCELLED' : 'CLOSED') as TradingSignal['status'],
              outcomeStatus: termOutcome,
            };
          }
          return sig;
        }

        const liveQuote = quotes[sig.instrumentId];
        const evalPrice = liveQuote && liveQuote.price > 0 ? liveQuote.price : (sig.currentMarketPrice || sig.entryPrice || 0);

        const evalResult = evaluateSignalOutcome(sig, evalPrice);

        const isNewlyCancelled = evalResult.outcomeStatus === 'CANCELLED' && sig.outcomeStatus !== 'CANCELLED';
        if (isNewlyCancelled) {
          newlyCancelledIds.push(sig.id);
        }

        const statusOrMilestoneChanged =
          evalResult.outcomeStatus !== sig.outcomeStatus ||
          evalResult.firstHitMilestone !== sig.firstHitMilestone ||
          evalResult.isEntryTriggered !== sig.isEntryTriggered ||
          evalResult.isBeHitAfterTp1 !== sig.isBeHitAfterTp1 ||
          evalResult.isBeHitAfterTp2 !== sig.isBeHitAfterTp2 ||
          (isNewlyCancelled && sig.status !== 'CANCELLED');

        if (statusOrMilestoneChanged) {
          hasChanges = true;
          const isBuy = (sig.type || '').toUpperCase().includes('BUY');
          const riskDist = Math.max(0.0001, Math.abs(sig.entryPrice - sig.stopLoss));
          const dollarRisk = Math.max(10, Math.round((user?.accountBalance || 100000) * ((user?.riskSettings?.riskPerTrade ?? 1.0) / 100)));

          let milestoneExit = sig.exitPrice;
          let calculatedPnl = sig.pnl;
          let milestoneStatus: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'RUNNING' = 'RUNNING';
          let milestoneLabel = '';

          if (evalResult.outcomeStatus === 'TP3_HIT') {
            milestoneExit = sig.targetPrice3 || evalPrice;
            const tp3Rr = sig.targetPrice3 ? Math.round((Math.abs(sig.targetPrice3 - sig.entryPrice) / riskDist) * 10) / 10 : 3.0;
            calculatedPnl = sig.pnl !== undefined ? sig.pnl : Math.round(dollarRisk * Math.max(3.0, tp3Rr) * 100) / 100;
            milestoneStatus = 'WIN';
            milestoneLabel = `TP3 Max Hit (+$${calculatedPnl.toFixed(2)}) 💎`;
          } else if (evalResult.outcomeStatus === 'TP2_HIT') {
            milestoneExit = sig.targetPrice2 || evalPrice;
            const tp2Rr = sig.targetPrice2 ? Math.round((Math.abs(sig.targetPrice2 - sig.entryPrice) / riskDist) * 10) / 10 : 2.0;
            calculatedPnl = sig.pnl !== undefined ? sig.pnl : Math.round(dollarRisk * Math.max(2.0, tp2Rr) * 100) / 100;
            milestoneStatus = 'WIN';
            milestoneLabel = `TP2 Hit (+$${calculatedPnl.toFixed(2)}) 🚀`;
          } else if (evalResult.outcomeStatus === 'TP1_HIT') {
            milestoneExit = sig.targetPrice1 || evalPrice;
            const tp1Rr = sig.targetPrice1 ? Math.round((Math.abs(sig.targetPrice1 - sig.entryPrice) / riskDist) * 10) / 10 : 1.0;
            calculatedPnl = sig.pnl !== undefined ? sig.pnl : Math.round(dollarRisk * Math.max(1.0, tp1Rr) * 100) / 100;
            milestoneStatus = 'WIN';
            milestoneLabel = `TP1 Securizat (+$${calculatedPnl.toFixed(2)}) 🎯`;
          } else if (evalResult.outcomeStatus === 'SL_HIT') {
            milestoneExit = sig.stopLoss;
            calculatedPnl = sig.pnl !== undefined ? sig.pnl : -dollarRisk;
            milestoneStatus = 'LOSS';
            milestoneLabel = `Stop Loss Hit (-$${Math.abs(calculatedPnl).toFixed(2)}) 🛑`;
          } else if (evalResult.isBeHitAfterTp1 || evalResult.isBeHitAfterTp2) {
            milestoneExit = sig.entryPrice;
            calculatedPnl = sig.pnl !== undefined ? sig.pnl : 0;
            milestoneStatus = 'BREAKEVEN';
            milestoneLabel = 'Break-Even Hit 🛡️';
          }

          if (milestoneStatus !== 'RUNNING') {
            const dKey = getLocalDateKey(sig.createdAt);
            const timeStr = formatTimeFromDate(sig.createdAt);
            const autoJEntry: TradeJournalEntry = {
              id: `sig_journal_${sig.id}`,
              date: dKey,
              time: timeStr,
              instrumentId: sig.instrumentId,
              symbol: sig.symbol,
              instrumentName: sig.instrumentName,
              direction: isBuy ? 'BUY' : 'SELL',
              executionType: sig.executionType || (isBuy ? 'BUY MARKET' : 'SELL MARKET'),
              entryPrice: sig.entryPrice,
              stopLoss: sig.stopLoss,
              takeProfit: sig.targetPrice3 || sig.targetPrice2 || sig.targetPrice1,
              exitPrice: milestoneExit || evalPrice,
              rrAchieved: calculatedPnl !== undefined ? Math.round((calculatedPnl / dollarRisk) * 10) / 10 : 0,
              pnl: calculatedPnl,
              status: milestoneStatus,
              outcomeLabel: milestoneLabel,
              setup: sig.title || 'Signal Automated Execution',
              notes: `Atingere milestone: ${evalResult.outcomeStatus}`,
              timeframe: sig.timeframe,
              linkedSignalId: sig.id,
              isManual: false,
              generatedAt: sig.createdAt,
              entryDate: dKey,
              entryTime: timeStr,
              closedAt: (evalResult.outcomeStatus === 'TP3_HIT' || evalResult.outcomeStatus === 'SL_HIT' || evalResult.isBeHitAfterTp1 || evalResult.isBeHitAfterTp2) ? (sig.closedAt || new Date().toISOString()) : undefined,
              createdAt: sig.createdAt,
            };
            milestoneJournalEntries.push(autoJEntry);
          }

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
            exitPrice: milestoneExit,
            pnl: calculatedPnl,
            realizedProfit: calculatedPnl,
            closedAt: (evalResult.outcomeStatus === 'TP3_HIT' || evalResult.outcomeStatus === 'SL_HIT' || evalResult.isBeHitAfterTp1 || evalResult.isBeHitAfterTp2) ? (sig.closedAt || new Date().toISOString()) : sig.closedAt,
          };
        }
        return sig;
      });

      if (milestoneJournalEntries.length > 0) {
        setManualTrades((prev) => {
          const map = new Map(prev.map((t) => [t.id, t]));
          for (const m of milestoneJournalEntries) {
            const existing = map.get(m.id);
            if (existing) {
              map.set(m.id, {
                ...existing,
                status: m.status,
                outcomeLabel: m.outcomeLabel,
                rrAchieved: m.rrAchieved,
                pnl: m.pnl,
                exitPrice: m.exitPrice,
                takeProfit: m.takeProfit,
                closedAt: m.closedAt || existing.closedAt,
              });
            } else {
              map.set(m.id, m);
            }
          }
          const updatedTrades = Array.from(map.values()).filter((t) => !isDemoOrSampleTrade(t));
          try {
            localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_MANUAL_TRADES_KEY, user?.id), JSON.stringify(updatedTrades));
          } catch (e) {}

          const token = authToken || localStorage.getItem('market_ai_auth_token');
          if (token) {
            fetch('/api/user/sync-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ tradeJournal: updatedTrades }),
            }).catch(() => {});
          }

          return updatedTrades;
        });
      }

      if (newlyCancelledIds.length > 0) {
        setDeletedSignalIds((prevDel) => {
          const nextDel = Array.from(new Set([...prevDel, ...newlyCancelledIds]));
          try {
            localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(nextDel));
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
  }, [quotes, user, authToken]);

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
              localStorage.setItem(getUserStorageKey(LOCAL_STORAGE_DELETED_SIGNALS_KEY, user?.id), JSON.stringify(nextDel));
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
    async (force = false, isUserInitiated = false) => {
      if (isUserInitiated) setIsRefreshing(true);
      try {
        const defaultLse = (import.meta as any).env?.VITE_LSE_API_KEY || '';
        const defaultTwelveData = (import.meta as any).env?.VITE_TWELVE_DATA_API_KEY || '';
        const queryParams = new URLSearchParams({
          lseKey: apiKeys.lseKey || defaultLse,
          twelveDataKey: apiKeys.twelveDataKey || defaultTwelveData,
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
        if (isUserInitiated) setIsRefreshing(false);
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

    // Dedicated WebSocket connection with seamless SSE fallback (no duplicate simultaneous streams)
    let eventSource: EventSource | null = null;
    let wsConnected = false;

    const stopSseFallback = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    const startSseFallback = () => {
      if (eventSource || isDisposed || wsConnected) return;
      try {
        const defaultLse = (import.meta as any).env?.VITE_LSE_API_KEY || '';
        const defaultTwelveData = (import.meta as any).env?.VITE_TWELVE_DATA_API_KEY || '';
        const queryParams = new URLSearchParams({
          lseKey: apiKeys.lseKey || defaultLse,
          twelveDataKey: apiKeys.twelveDataKey || defaultTwelveData,
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
          // Reconnect handled automatically by browser EventSource
        };
      } catch (e) {
        console.warn('EventSource initialization:', e);
      }
    };

    const connectWs = () => {
      if (isDisposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/market-ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('⚡ Connected to MarketAI Live WebSocket (LSE Real-Time Feed)');
          wsConnected = true;
          stopSseFallback();
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
          wsConnected = false;
          if (pingInterval) clearInterval(pingInterval);
          if (!isDisposed) {
            startSseFallback();
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          wsConnected = false;
          if (ws) ws.close();
          startSseFallback();
        };
      } catch (err) {
        wsConnected = false;
        console.warn('WS connect error:', err);
        startSseFallback();
        if (!isDisposed) {
          reconnectTimer = setTimeout(connectWs, 5000);
        }
      }
    };

    connectWs();

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

  // Verify economic calendar for today's high-impact USD events before the first signal generation of the day
  const checkUsdHighImpactNewsBeforeGeneration = async (
    targetInstrument: InstrumentId,
    action: () => void | Promise<any>
  ): Promise<boolean> => {
    try {
      const todayKey = new Date().toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' });
      const ackKey = getUserStorageKey(`market_ai_usd_news_ack_${todayKey}`, user?.id);
      const hasAcknowledgedToday = localStorage.getItem(ackKey) === 'true';

      // If user has already seen and confirmed the pop-up warning today, allow immediate generation
      if (hasAcknowledgedToday) {
        action();
        return true;
      }

      // Query economic calendar endpoint
      const res = await fetch(`/api/economic-calendar?lang=${lang}`);
      if (!res.ok) {
        // In case calendar endpoint is unreachable, fail-soft to allow generation
        action();
        return true;
      }

      const data = await res.json();
      const allEvents: EconomicNewsEvent[] = (data.events && Array.isArray(data.events)) ? data.events : [];

      // Filter for USD high-impact news today
      const usdHighImpactToday = allEvents.filter((e) => {
        const isUsd = (e.currency || '').toUpperCase() === 'USD';
        const isHigh = (e.impact || '').toUpperCase() === 'HIGH';
        const isToday = (e as any).isToday === true;
        return isUsd && isHigh && isToday;
      });

      if (usdHighImpactToday.length > 0) {
        setUsdWarningEvents(usdHighImpactToday);
        setUsdWarningInstrument(targetInstrument);
        setPendingSignalAction(() => () => { action(); });
        setIsUsdWarningModalOpen(true);
        return false;
      }

      // No high-impact USD news found today: mark as confirmed for today and proceed
      try {
        localStorage.setItem(ackKey, 'true');
      } catch (_) {}
      action();
      return true;
    } catch (err) {
      console.warn('Could not verify USD news calendar before signal generation:', err);
      action();
      return true;
    }
  };

  const handleConfirmUsdWarning = () => {
    const todayKey = new Date().toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' });
    const ackKey = getUserStorageKey(`market_ai_usd_news_ack_${todayKey}`, user?.id);
    try {
      localStorage.setItem(ackKey, 'true');
    } catch (_) {}
    setIsUsdWarningModalOpen(false);

    if (pendingSignalAction) {
      const pending = pendingSignalAction;
      setPendingSignalAction(null);
      pending();
    }
  };

  const handleCancelUsdWarning = () => {
    setIsUsdWarningModalOpen(false);
    setPendingSignalAction(null);
  };

  // Handle generating fresh AI signal via server Gemini 3.6 Flash
  const handleGenerateSignal = async (
    instrumentId: InstrumentId,
    timeframe: TimeFrame,
    strategy: string = 'Auto Smart Structure (Limit, Stop sau Market)',
    targetAccounts: string[] = ['all']
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

    const executeSignalFetch = async () => {
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
            targetAccounts,
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

    await checkUsdHighImpactNewsBeforeGeneration(instrumentId, executeSignalFetch);
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

    const executeCustomFetch = async () => {
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

    const allowed = await checkUsdHighImpactNewsBeforeGeneration(rule.instrumentId, executeCustomFetch);
    if (!allowed) {
      return null;
    }
    return null;
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
        onRefresh={() => fetchMarketQuotes(true, true)}
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
              user={user}
              deletedJournalTradeIds={deletedJournalTradeIds}
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

        {activeTab === 'scheduler' && (
          <div>
            <AutomatedTradeSchedulerSection
              user={user}
              authToken={authToken}
              quotes={quotes}
              lang={lang}
              onUpdateUser={(updated) => {
                setUser(updated);
                try {
                  localStorage.setItem('market_ai_user_profile', JSON.stringify(updated));
                } catch (_) {}
              }}
              onNavigateToSignals={() => setActiveTab('signals')}
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
              deletedJournalTradeIds={deletedJournalTradeIds}
              onSaveManualTrade={handleSaveManualTrade}
              onDeleteManualTrade={handleDeleteManualTrade}
              onClearAllManualTrades={handleClearAllManualTrades}
              onViewSignalDetails={(sig) => {
                setActiveTab('signals');
                setSelectedInstrument(sig.instrumentId);
              }}
              lang={lang}
              user={user}
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
        onAccountsUpdated={(newAccs) => setUser((prev) => (prev ? { ...prev, bridgeAccounts: newAccs } : prev))}
      />

      <NinjaTraderIntegrationModal
        isOpen={isNinjaTraderModalOpen}
        onClose={() => setIsNinjaTraderModalOpen(false)}
        lang={lang}
        authToken={authToken}
        user={user}
        onAccountsUpdated={(newAccs) => setUser((prev) => (prev ? { ...prev, bridgeAccounts: newAccs } : prev))}
      />

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteModalOpen}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        onConfirm={executeDeleteAllSignals}
        signalCount={signals.length}
        lang={lang}
      />

      <UsdHighImpactWarningModal
        isOpen={isUsdWarningModalOpen}
        onClose={handleCancelUsdWarning}
        onConfirm={handleConfirmUsdWarning}
        events={usdWarningEvents}
        selectedInstrument={usdWarningInstrument}
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
