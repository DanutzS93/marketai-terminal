import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Power,
  Zap,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Check,
  Cpu,
  History,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  InstrumentId,
  MarketQuote,
  UserProfile,
  TimeFrame,
  TradeSchedulerConfig,
  ScheduledTradeRow,
  ScheduledExecutionLog,
} from '../types';
import { INSTRUMENT_SPECS } from '../utils/lotCalculator';

interface AutomatedTradeSchedulerSectionProps {
  user: UserProfile | null;
  authToken: string | null;
  quotes: Record<InstrumentId, MarketQuote>;
  lang: 'ro' | 'en';
  onUpdateUser?: (updated: UserProfile) => void;
  onNavigateToSignals?: () => void;
}

const INSTRUMENTS_LIST: { id: InstrumentId; name: string; symbol: string; category: string; defaultSlots: [string, string, string] }[] = [
  { id: 'GOLD', name: 'Gold Spot (XAU/USD)', symbol: 'XAUUSD', category: 'METALS', defaultSlots: ['09:30', '15:30', '17:00'] },
  { id: 'NASDAQ', name: 'Nasdaq 100 Index (NAS100)', symbol: 'NAS100', category: 'INDICES', defaultSlots: ['09:30', '15:30', '17:00'] },
  { id: 'DOW_JONES', name: 'Dow Jones 30 (US30)', symbol: 'US30', category: 'INDICES', defaultSlots: ['15:30', '17:00', '20:00'] },
  { id: 'SPX500', name: 'S&P 500 Index (US500)', symbol: 'SPX500', category: 'INDICES', defaultSlots: ['15:30', '17:00', '20:00'] },
  { id: 'EURUSD', name: 'Euro / US Dollar', symbol: 'EURUSD', category: 'FOREX', defaultSlots: ['09:00', '14:30', '16:00'] },
  { id: 'GBPUSD', name: 'British Pound / US Dollar', symbol: 'GBPUSD', category: 'FOREX', defaultSlots: ['09:00', '14:30', '16:00'] },
  { id: 'USDJPY', name: 'US Dollar / Japanese Yen', symbol: 'USDJPY', category: 'FOREX', defaultSlots: ['08:00', '15:30', '23:00'] },
  { id: 'NQ_F', name: 'Nasdaq Futures (NQ.F / MNQ)', symbol: 'NQ.F', category: 'FUTURES', defaultSlots: ['15:30', '17:00', '19:00'] },
  { id: 'ES_F', name: 'S&P 500 Futures (ES.F / MES)', symbol: 'ES.F', category: 'FUTURES', defaultSlots: ['15:30', '17:00', '19:00'] },
  { id: 'YM_F', name: 'Dow Futures (YM.F / MYM)', symbol: 'YM.F', category: 'FUTURES', defaultSlots: ['15:30', '17:00', '19:00'] },
  { id: 'GC_F', name: 'Gold Futures (GC.F / MGC)', symbol: 'GC.F', category: 'FUTURES', defaultSlots: ['09:30', '15:30', '17:00'] },
];

export const AutomatedTradeSchedulerSection: React.FC<AutomatedTradeSchedulerSectionProps> = ({
  user,
  authToken,
  quotes,
  lang,
  onUpdateUser,
  onNavigateToSignals,
}) => {
  const isEn = lang === 'en';

  // Live Romanian / Server time (EET / UTC+2)
  const [currentRoTime, setCurrentRoTime] = useState<string>('');
  const [currentRoSeconds, setCurrentRoSeconds] = useState<string>('');
  const [currentRoDate, setCurrentRoDate] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ro-RO', { timeZone: 'Europe/Bucharest', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const parts = timeStr.split(':');
      setCurrentRoTime(`${parts[0]}:${parts[1]}`);
      setCurrentRoSeconds(`:${parts[2] || '00'}`);
      setCurrentRoDate(dateStr);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize schedule items state from user profile or default
  const [isSchedulerMasterEnabled, setIsSchedulerMasterEnabled] = useState<boolean>(() => {
    return user?.tradeScheduler?.enabled ?? false;
  });

  const [items, setItems] = useState<ScheduledTradeRow[]>(() => {
    const existingItems = user?.tradeScheduler?.items || [];
    const map = new Map<string, ScheduledTradeRow>();
    for (const it of existingItems) {
      if (it && it.instrumentId) map.set(it.instrumentId, it);
    }

    return INSTRUMENTS_LIST.map((inst) => {
      const ex = map.get(inst.id);
      return {
        instrumentId: inst.id,
        enabled: ex ? ex.enabled : false,
        timeSlot1: ex ? (ex.timeSlot1 ?? inst.defaultSlots[0]) : inst.defaultSlots[0],
        timeSlot2: ex ? (ex.timeSlot2 ?? inst.defaultSlots[1]) : inst.defaultSlots[1],
        timeSlot3: ex ? (ex.timeSlot3 ?? inst.defaultSlots[2]) : inst.defaultSlots[2],
        targetAccounts: ex?.targetAccounts || ['all'],
        timeframe: ex?.timeframe || '1h',
        strategy: ex?.strategy || 'Auto Smart Structure',
      };
    });
  });

  const [logs, setLogs] = useState<ScheduledExecutionLog[]>(() => {
    return user?.tradeScheduler?.logs || [];
  });

  // Individual hour slot enabled sliders (Ora 1, Ora 2, Ora 3)
  const [slot1Enabled, setSlot1Enabled] = useState<boolean>(() => {
    return user?.tradeScheduler?.slot1Enabled !== undefined ? user.tradeScheduler.slot1Enabled : true;
  });
  const [slot2Enabled, setSlot2Enabled] = useState<boolean>(() => {
    return user?.tradeScheduler?.slot2Enabled !== undefined ? user.tradeScheduler.slot2Enabled : true;
  });
  const [slot3Enabled, setSlot3Enabled] = useState<boolean>(() => {
    return user?.tradeScheduler?.slot3Enabled !== undefined ? user.tradeScheduler.slot3Enabled : true;
  });

  // Track changes and saving status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [testTriggerLoading, setTestTriggerLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Synchronize when user updates from server
  useEffect(() => {
    if (user?.tradeScheduler) {
      if (typeof user.tradeScheduler.enabled === 'boolean') {
        setIsSchedulerMasterEnabled(user.tradeScheduler.enabled);
      }
      if (user.tradeScheduler.slot1Enabled !== undefined) {
        setSlot1Enabled(user.tradeScheduler.slot1Enabled);
      }
      if (user.tradeScheduler.slot2Enabled !== undefined) {
        setSlot2Enabled(user.tradeScheduler.slot2Enabled);
      }
      if (user.tradeScheduler.slot3Enabled !== undefined) {
        setSlot3Enabled(user.tradeScheduler.slot3Enabled);
      }
      if (Array.isArray(user.tradeScheduler.items) && user.tradeScheduler.items.length > 0) {
        const map = new Map<string, ScheduledTradeRow>();
        for (const it of user.tradeScheduler.items) {
          if (it && it.instrumentId) map.set(it.instrumentId, it);
        }
        setItems(
          INSTRUMENTS_LIST.map((inst) => {
            const ex = map.get(inst.id);
            return {
              instrumentId: inst.id,
              enabled: ex ? ex.enabled : false,
              timeSlot1: ex ? (ex.timeSlot1 ?? inst.defaultSlots[0]) : inst.defaultSlots[0],
              timeSlot2: ex ? (ex.timeSlot2 ?? inst.defaultSlots[1]) : inst.defaultSlots[1],
              timeSlot3: ex ? (ex.timeSlot3 ?? inst.defaultSlots[2]) : inst.defaultSlots[2],
              targetAccounts: ex?.targetAccounts || ['all'],
              timeframe: ex?.timeframe || '1h',
              strategy: ex?.strategy || 'Auto Smart Structure',
            };
          })
        );
      }
      if (Array.isArray(user.tradeScheduler.logs)) {
        setLogs(user.tradeScheduler.logs);
      }
    }
  }, [user?.tradeScheduler]);

  // Show auto-dismissing toast
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Save handler
  const handleSaveSchedule = async (
    customMasterEnabled?: boolean,
    customItems?: ScheduledTradeRow[],
    customSlotOverrides?: { s1?: boolean; s2?: boolean; s3?: boolean }
  ) => {
    setIsSaving(true);
    const payloadItems = customItems || items;
    const payloadMaster = customMasterEnabled !== undefined ? customMasterEnabled : isSchedulerMasterEnabled;
    const s1 = customSlotOverrides?.s1 !== undefined ? customSlotOverrides.s1 : slot1Enabled;
    const s2 = customSlotOverrides?.s2 !== undefined ? customSlotOverrides.s2 : slot2Enabled;
    const s3 = customSlotOverrides?.s3 !== undefined ? customSlotOverrides.s3 : slot3Enabled;

    try {
      if (authToken) {
        const res = await fetch('/api/user/trade-schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            schedule: {
              enabled: payloadMaster,
              timezone: 'Europe/Bucharest',
              slot1Enabled: s1,
              slot2Enabled: s2,
              slot3Enabled: s3,
              items: payloadItems,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user && onUpdateUser) {
            onUpdateUser(data.user);
          }
          if (data.schedule?.logs) {
            setLogs(data.schedule.logs);
          }
        }
      }

      // Update local storage fallback
      if (user) {
        const updatedUser: UserProfile = {
          ...user,
          tradeScheduler: {
            enabled: payloadMaster,
            timezone: 'Europe/Bucharest',
            slot1Enabled: s1,
            slot2Enabled: s2,
            slot3Enabled: s3,
            items: payloadItems,
            logs,
          },
        };
        try {
          localStorage.setItem('market_ai_user_profile', JSON.stringify(updatedUser));
        } catch (_) {}
        if (onUpdateUser) onUpdateUser(updatedUser);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      showToast(isEn ? 'Schedule updated successfully!' : 'Programarea a fost salvată cu succes!');
    } catch (err) {
      console.error('Failed to save trade schedule:', err);
      showToast(isEn ? 'Failed to save schedule.' : 'Eroare la salvarea programării.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle individual hour slot slider ON / OFF
  const handleToggleSlot = (slotNum: 1 | 2 | 3) => {
    let nextS1 = slot1Enabled;
    let nextS2 = slot2Enabled;
    let nextS3 = slot3Enabled;

    if (slotNum === 1) {
      nextS1 = !slot1Enabled;
      setSlot1Enabled(nextS1);
    } else if (slotNum === 2) {
      nextS2 = !slot2Enabled;
      setSlot2Enabled(nextS2);
    } else if (slotNum === 3) {
      nextS3 = !slot3Enabled;
      setSlot3Enabled(nextS3);
    }

    handleSaveSchedule(isSchedulerMasterEnabled, items, { s1: nextS1, s2: nextS2, s3: nextS3 });
  };

  // Toggle individual instrument row ON/OFF
  const handleToggleItem = (instrumentId: InstrumentId) => {
    const updated = items.map((it) => {
      if (it.instrumentId === instrumentId) {
        return { ...it, enabled: !it.enabled };
      }
      return it;
    });
    setItems(updated);
    handleSaveSchedule(isSchedulerMasterEnabled, updated);
  };

  // Change slot time
  const handleTimeSlotChange = (
    instrumentId: InstrumentId,
    slotKey: 'timeSlot1' | 'timeSlot2' | 'timeSlot3',
    value: string
  ) => {
    const updated = items.map((it) => {
      if (it.instrumentId === instrumentId) {
        return { ...it, [slotKey]: value };
      }
      return it;
    });
    setItems(updated);
  };

  // Clear a slot
  const handleClearSlot = (
    instrumentId: InstrumentId,
    slotKey: 'timeSlot1' | 'timeSlot2' | 'timeSlot3'
  ) => {
    const updated = items.map((it) => {
      if (it.instrumentId === instrumentId) {
        return { ...it, [slotKey]: '' };
      }
      return it;
    });
    setItems(updated);
  };

  // Set preset hour on slot
  const handleApplyPreset = (
    instrumentId: InstrumentId,
    slotKey: 'timeSlot1' | 'timeSlot2' | 'timeSlot3',
    time: string
  ) => {
    const updated = items.map((it) => {
      if (it.instrumentId === instrumentId) {
        return { ...it, [slotKey]: time };
      }
      return it;
    });
    setItems(updated);
  };

  // Change target accounts
  const handleToggleTargetAccount = (instrumentId: InstrumentId, accountId: string) => {
    const updated = items.map((it) => {
      if (it.instrumentId === instrumentId) {
        let current = Array.isArray(it.targetAccounts) ? [...it.targetAccounts] : ['all'];
        if (accountId === 'all') {
          current = ['all'];
        } else {
          current = current.filter((x) => x !== 'all');
          if (current.includes(accountId)) {
            current = current.filter((x) => x !== accountId);
            if (current.length === 0) current = ['all'];
          } else {
            current.push(accountId);
          }
        }
        return { ...it, targetAccounts: current };
      }
      return it;
    });
    setItems(updated);
  };

  // Master switch toggle
  const handleToggleMaster = () => {
    const nextVal = !isSchedulerMasterEnabled;
    setIsSchedulerMasterEnabled(nextVal);
    handleSaveSchedule(nextVal, items);
  };

  // Bulk actions
  const handleEnableAll = () => {
    const updated = items.map((it) => ({ ...it, enabled: true }));
    setItems(updated);
    setIsSchedulerMasterEnabled(true);
    handleSaveSchedule(true, updated);
  };

  const handleDisableAll = () => {
    const updated = items.map((it) => ({ ...it, enabled: false }));
    setItems(updated);
    handleSaveSchedule(isSchedulerMasterEnabled, updated);
  };

  const handleResetRecommended = () => {
    const updated = INSTRUMENTS_LIST.map((inst) => ({
      instrumentId: inst.id,
      enabled: inst.id === 'GOLD' || inst.id === 'NASDAQ',
      timeSlot1: inst.defaultSlots[0],
      timeSlot2: inst.defaultSlots[1],
      timeSlot3: inst.defaultSlots[2],
      targetAccounts: ['all'],
      timeframe: '1h' as TimeFrame,
      strategy: 'Auto Smart Structure',
    }));
    setItems(updated);
    handleSaveSchedule(isSchedulerMasterEnabled, updated);
  };

  // Manual Test Trigger
  const handleTestTrigger = async (instrumentId: InstrumentId) => {
    setTestTriggerLoading(instrumentId);
    const item = items.find((i) => i.instrumentId === instrumentId);
    try {
      const res = await fetch('/api/user/trade-schedule/test-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          instrumentId,
          timeframe: item?.timeframe || '1h',
          strategy: item?.strategy || 'Auto Smart Structure',
          targetAccounts: item?.targetAccounts || ['all'],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          isEn
            ? `Test signal generated for ${instrumentId} and dispatched to EA!`
            : `Semnal de test generat cu succes pentru ${instrumentId} și expediat către EA!`,
          'success'
        );
        // Refresh logs
        if (authToken) {
          const schedRes = await fetch('/api/user/trade-schedule', {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (schedRes.ok) {
            const schedData = await schedRes.json();
            if (schedData.schedule?.logs) setLogs(schedData.schedule.logs);
          }
        }
      } else {
        showToast(data.error || 'Test trigger failed.', 'error');
      }
    } catch (e: any) {
      showToast('Eroare de conexiune la generarea testului.', 'error');
    } finally {
      setTestTriggerLoading(null);
    }
  };

  // Permanently clear scheduled execution logs from server and state
  const handleClearLogs = async () => {
    setLogs([]);
    try {
      if (authToken) {
        const res = await fetch('/api/user/trade-schedule/logs', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user && onUpdateUser) {
            onUpdateUser(data.user);
          }
        }
      }

      if (user) {
        const updatedUser: UserProfile = {
          ...user,
          tradeScheduler: {
            ...(user.tradeScheduler || {
              enabled: isSchedulerMasterEnabled,
              timezone: 'Europe/Bucharest',
              items,
            }),
            logs: [],
          },
        };
        try {
          localStorage.setItem('market_ai_user_profile', JSON.stringify(updatedUser));
        } catch (_) {}
        if (onUpdateUser) onUpdateUser(updatedUser);
      }
      showToast(isEn ? 'Execution logs cleared permanently!' : 'Jurnalul de execuții a fost golit definitiv!');
    } catch (e) {
      console.warn('Failed to clear logs on server:', e);
    }
  };

  // Count active instruments
  const activeCount = useMemo(() => items.filter((i) => i.enabled).length, [items]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-500/20'
              : 'bg-rose-950/95 text-rose-200 border-rose-500/50 shadow-rose-500/20'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header & Live Clock Card */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-950 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Clock className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              {isEn ? 'Automatic Signal Scheduling Engine' : 'Motor Automatizare Semnale & Trade-uri la Fix'}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>{isEn ? 'Automated Trade Scheduler' : 'Programare Trade-uri Automate'}</span>
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              {isEn
                ? 'Configure up to 3 exact hours per instrument when MarketAI will generate institutional signals and dispatch them directly to your MT5 & NinjaTrader EAs.'
                : 'Alege paritățile dorite și setează până la 3 ore fixe pe zi când dorești ca MarketAI să genereze automat semnalul și să îl trimită instant spre EA-ul tău de MT5 sau NinjaTrader.'}
            </p>
          </div>

          {/* Live Server Clock & Master Switch */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            {/* Live Romanian Clock Box */}
            <div className="flex flex-col items-center justify-center px-6 py-4 rounded-xl bg-black/50 border border-purple-500/30 backdrop-blur-md shadow-inner text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {isEn ? 'Platform Server Clock (EET)' : 'Ora României / Server (EET)'}
              </span>
              <div className="text-3xl md:text-4xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-300 tracking-tight">
                {currentRoTime || '--:--'}
                <span className="text-lg md:text-xl text-purple-400/80 font-normal">{currentRoSeconds}</span>
              </div>
              <span className="text-[10px] text-slate-400 capitalize mt-0.5">{currentRoDate}</span>
            </div>

            {/* Master Toggle Button */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-white/10 text-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isEn ? 'Master Scheduler' : 'Activare Generală'}
              </span>
              <button
                type="button"
                onClick={handleToggleMaster}
                className={`relative inline-flex h-9 w-20 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSchedulerMasterEnabled
                    ? 'bg-purple-600 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <span className="sr-only">Toggle Master Scheduler</span>
                <span
                  className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    isSchedulerMasterEnabled ? 'translate-x-11 text-purple-700' : 'translate-x-0 text-slate-600'
                  }`}
                >
                  <Power className="w-4 h-4 font-bold" />
                </span>
              </button>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isSchedulerMasterEnabled ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {isSchedulerMasterEnabled ? (isEn ? 'ACTIVE' : 'ACTIVAT') : (isEn ? 'OFF' : 'OPRIT')}
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEnableAll}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isEn ? 'Enable All (11)' : 'Activează Toate (11)'}
            </button>
            <button
              type="button"
              onClick={handleDisableAll}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 transition flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              {isEn ? 'Disable All' : 'Dezactivează Toate'}
            </button>
            <button
              type="button"
              onClick={handleResetRecommended}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isEn ? 'Load Recommended Hours' : 'Presetare Ore Volatilitate (09:30, 15:30, 17:00)'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 font-medium">
              <span className="text-purple-300 font-bold">{activeCount}</span> din 11 parități programate
            </div>
            <button
              type="button"
              onClick={() => handleSaveSchedule()}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 transition flex items-center gap-2 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>{isEn ? 'Saved!' : 'Salvat!'}</span>
                </>
              ) : isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isEn ? 'Saving...' : 'Se salvează...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEn ? 'Save Schedule' : 'Salvează Programarea'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Scheduling Table Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {isEn ? 'Scheduled Instruments Table' : 'Tabel Configurare Programare Automată'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            {isEn ? 'Signals are generated automatically at the configured hours.' : 'Semnalele se generează automat exact la orele bifate.'}
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-white/10 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-32 text-center">
                  <span className="flex items-center justify-center gap-1">
                    <Power className="w-3.5 h-3.5" />
                    <span>ON / OFF</span>
                  </span>
                </th>
                <th className="py-3.5 px-4 w-64">
                  {isEn ? 'Platform Instrument' : 'Paritate Platformă'}
                </th>
                <th className="py-3 px-3 text-center w-52 bg-slate-950/40">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isEn ? 'Hour 1 (Slot 1)' : 'Ora 1 (Slot 1)'}</span>
                    </span>

                    {/* ON / OFF Slider Switch */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSlot(1)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                          slot1Enabled
                            ? 'bg-purple-600 border-purple-400 shadow-sm shadow-purple-600/40'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                        title={slot1Enabled ? (isEn ? 'Slot 1 Active - Click to disable' : 'Intervalul 1 este Activat - click pentru oprire') : (isEn ? 'Slot 1 Disabled - Click to enable' : 'Intervalul 1 este Oprit - click pentru activare')}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                            slot1Enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${slot1Enabled ? 'text-purple-300' : 'text-slate-500'}`}>
                        {slot1Enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                </th>

                <th className="py-3 px-3 text-center w-52 bg-slate-950/40">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isEn ? 'Hour 2 (Slot 2)' : 'Ora 2 (Slot 2)'}</span>
                    </span>

                    {/* ON / OFF Slider Switch */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSlot(2)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                          slot2Enabled
                            ? 'bg-purple-600 border-purple-400 shadow-sm shadow-purple-600/40'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                        title={slot2Enabled ? (isEn ? 'Slot 2 Active - Click to disable' : 'Intervalul 2 este Activat - click pentru oprire') : (isEn ? 'Slot 2 Disabled - Click to enable' : 'Intervalul 2 este Oprit - click pentru activare')}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                            slot2Enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${slot2Enabled ? 'text-purple-300' : 'text-slate-500'}`}>
                        {slot2Enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                </th>

                <th className="py-3 px-3 text-center w-52 bg-slate-950/40">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isEn ? 'Hour 3 (Slot 3)' : 'Ora 3 (Slot 3)'}</span>
                    </span>

                    {/* ON / OFF Slider Switch */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSlot(3)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                          slot3Enabled
                            ? 'bg-purple-600 border-purple-400 shadow-sm shadow-purple-600/40'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                        title={slot3Enabled ? (isEn ? 'Slot 3 Active - Click to disable' : 'Intervalul 3 este Activat - click pentru oprire') : (isEn ? 'Slot 3 Disabled - Click to enable' : 'Intervalul 3 este Oprit - click pentru activare')}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                            slot3Enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${slot3Enabled ? 'text-purple-300' : 'text-slate-500'}`}>
                        {slot3Enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">
                  {isEn ? 'Target Accounts & Action' : 'Conturi Țintă & Test'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((row) => {
                const spec = INSTRUMENT_SPECS[row.instrumentId] || INSTRUMENT_SPECS.NASDAQ;
                const quote = quotes[row.instrumentId];
                const isEnabled = row.enabled;
                const isRowMasterActive = isSchedulerMasterEnabled && isEnabled;

                return (
                  <tr
                    key={row.instrumentId}
                    className={`transition-colors duration-150 ${
                      isRowMasterActive
                        ? 'bg-purple-950/15 hover:bg-purple-950/25'
                        : isEnabled
                        ? 'bg-slate-900/60 hover:bg-slate-900'
                        : 'bg-slate-950/40 hover:bg-slate-900/40 opacity-75'
                    }`}
                  >
                    {/* Column 1: ON / OFF Button */}
                    <td className="py-4 px-4 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleToggleItem(row.instrumentId)}
                        className={`inline-flex items-center justify-center gap-1.5 w-24 py-1.5 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                          isEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/10 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700/80'
                        }`}
                      >
                        {isEnabled ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>ON</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-500" />
                            <span>OFF</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Column 2: Instrument Name & Live Price */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black border ${
                            row.instrumentId === 'GOLD' || row.instrumentId === 'GC_F'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : row.instrumentId.includes('NAS') || row.instrumentId.includes('NQ')
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : row.instrumentId.includes('SPX') || row.instrumentId.includes('ES')
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : row.instrumentId.includes('DOW') || row.instrumentId.includes('YM')
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {spec.symbol.slice(0, 3)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">
                              {spec.symbol}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                              {spec.category}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px]" title={spec.name}>
                            {spec.name}
                          </div>
                          {quote && typeof quote.price === 'number' && (
                            <div className="text-[11px] font-mono font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                              <span>${quote.price.toLocaleString(undefined, { minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Hour 1 (Slot 1) */}
                    <td className={`py-4 px-3 align-middle text-center transition-opacity ${!slot1Enabled ? 'opacity-40 bg-black/10' : ''}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative inline-flex items-center">
                          <input
                            type="time"
                            value={row.timeSlot1 || ''}
                            onChange={(e) => handleTimeSlotChange(row.instrumentId, 'timeSlot1', e.target.value)}
                            disabled={!isEnabled || !slot1Enabled}
                            className={`w-32 px-3 py-1.5 rounded-lg text-sm font-mono font-bold text-center border focus:outline-none transition ${
                              isEnabled && slot1Enabled
                                ? 'bg-slate-900 border-purple-500/40 text-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-400'
                                : 'bg-slate-950/60 border-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                          />
                          {row.timeSlot1 && isEnabled && slot1Enabled && (
                            <button
                              type="button"
                              onClick={() => handleClearSlot(row.instrumentId, 'timeSlot1')}
                              className="absolute right-2 text-slate-500 hover:text-rose-400 transition"
                              title="Șterge ora"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {!slot1Enabled ? (
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            {isEn ? 'Interval Paused' : 'Interval Oprit'}
                          </span>
                        ) : isEnabled ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(row.instrumentId, 'timeSlot1', '09:30')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                            >
                              09:30
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(row.instrumentId, 'timeSlot1', '15:30')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                            >
                              15:30
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Column 4: Hour 2 (Slot 2) */}
                    <td className={`py-4 px-3 align-middle text-center transition-opacity ${!slot2Enabled ? 'opacity-40 bg-black/10' : ''}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative inline-flex items-center">
                          <input
                            type="time"
                            value={row.timeSlot2 || ''}
                            onChange={(e) => handleTimeSlotChange(row.instrumentId, 'timeSlot2', e.target.value)}
                            disabled={!isEnabled || !slot2Enabled}
                            className={`w-32 px-3 py-1.5 rounded-lg text-sm font-mono font-bold text-center border focus:outline-none transition ${
                              isEnabled && slot2Enabled
                                ? 'bg-slate-900 border-purple-500/40 text-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-400'
                                : 'bg-slate-950/60 border-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                          />
                          {row.timeSlot2 && isEnabled && slot2Enabled && (
                            <button
                              type="button"
                              onClick={() => handleClearSlot(row.instrumentId, 'timeSlot2')}
                              className="absolute right-2 text-slate-500 hover:text-rose-400 transition"
                              title="Șterge ora"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {!slot2Enabled ? (
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            {isEn ? 'Interval Paused' : 'Interval Oprit'}
                          </span>
                        ) : isEnabled ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(row.instrumentId, 'timeSlot2', '15:30')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                            >
                              15:30
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(row.instrumentId, 'timeSlot2', '17:00')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                            >
                              17:00
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Column 5: Hour 3 (Slot 3) */}
                    <td className={`py-4 px-3 align-middle text-center transition-opacity ${!slot3Enabled ? 'opacity-40 bg-black/10' : ''}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative inline-flex items-center">
                          <input
                            type="time"
                            value={row.timeSlot3 || ''}
                            onChange={(e) => handleTimeSlotChange(row.instrumentId, 'timeSlot3', e.target.value)}
                            disabled={!isEnabled || !slot3Enabled}
                            className={`w-32 px-3 py-1.5 rounded-lg text-sm font-mono font-bold text-center border focus:outline-none transition ${
                              isEnabled && slot3Enabled
                                ? 'bg-slate-900 border-purple-500/40 text-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-400'
                                : 'bg-slate-950/60 border-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                          />
                          {row.timeSlot3 && isEnabled && slot3Enabled && (
                            <button
                              type="button"
                              onClick={() => handleClearSlot(row.instrumentId, 'timeSlot3')}
                              className="absolute right-2 text-slate-500 hover:text-rose-400 transition"
                              title="Șterge ora"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {!slot3Enabled ? (
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            {isEn ? 'Interval Paused' : 'Interval Oprit'}
                          </span>
                        ) : isEnabled ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(row.instrumentId, 'timeSlot3', '17:00')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                            >
                              17:00
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(row.instrumentId, 'timeSlot3', '20:00')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white transition"
                            >
                              20:00
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Column 6: Target Accounts & Test Button */}
                    <td className="py-4 px-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Target accounts pills */}
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                          <button
                            type="button"
                            onClick={() => handleToggleTargetAccount(row.instrumentId, 'all')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                              !row.targetAccounts || row.targetAccounts.includes('all')
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Toate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTargetAccount(row.instrumentId, 'acc_1')}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                              row.targetAccounts?.includes('acc_1') && !row.targetAccounts.includes('all')
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Cont 1 (Principal MT5)"
                          >
                            C1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTargetAccount(row.instrumentId, 'acc_2')}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                              row.targetAccounts?.includes('acc_2') && !row.targetAccounts.includes('all')
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Cont 2 (MT5 Secundar)"
                          >
                            C2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTargetAccount(row.instrumentId, 'acc_3')}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                              row.targetAccounts?.includes('acc_3') && !row.targetAccounts.includes('all')
                                ? 'bg-orange-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Cont 3 (NinjaTrader 8)"
                          >
                            C3
                          </button>
                        </div>

                        {/* Test Trigger Button */}
                        <button
                          type="button"
                          onClick={() => handleTestTrigger(row.instrumentId)}
                          disabled={testTriggerLoading === row.instrumentId}
                          className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition disabled:opacity-50"
                          title="Testează generarea acum pe această paritate"
                        >
                          {testTriggerLoading === row.instrumentId ? (
                            <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Logs Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {isEn ? 'Recent Automated Execution Logs' : 'Jurnal Execuții Automate Programate'}
            </h3>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Clear Logs' : 'Golește Jurnalul'}</span>
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-medium">
            {isEn
              ? 'No scheduled trade executions yet. When a scheduled hour is reached, automatic runs will appear here.'
              : 'Nicio execuție automată înregistrată încă. Când va sosi ora programată, rulările automate vor apărea aici în timp real.'}
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {logs.slice(0, 20).map((log) => {
              const dateFormatted = new Date(log.timestamp).toLocaleTimeString('ro-RO', {
                timeZone: 'Europe/Bucharest',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {log.status === 'SUCCESS' ? (
                      <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : log.status === 'MARKET_CLOSED' ? (
                      <span className="p-1 rounded-full bg-amber-500/20 text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded-full bg-rose-500/20 text-rose-400">
                        <XCircle className="w-3.5 h-3.5" />
                      </span>
                    )}

                    <span className="font-extrabold text-white text-xs">{log.instrumentId}</span>
                    <span className="text-slate-400 font-mono">[{log.timeSlot}]</span>

                    {log.signalTitle && (
                      <span className="text-slate-300 font-medium truncate max-w-[280px]">
                        {log.signalTitle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    {log.message && <span className="text-slate-300 font-medium">{log.message}</span>}
                    <span className="font-mono text-purple-300">{dateFormatted} EET</span>
                    {onNavigateToSignals && (
                      <button
                        type="button"
                        onClick={onNavigateToSignals}
                        className="text-purple-400 hover:text-purple-300 underline flex items-center gap-1 font-semibold"
                      >
                        <span>Vezi Semnale</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
