import React, { useState } from 'react';
import {
  Activity,
  RefreshCw,
  Key,
  Calculator,
  Globe,
  Zap,
  Menu,
  X,
  BarChart2,
  Sparkles,
  Sliders,
  Newspaper,
  LayoutGrid,
  User,
  LogOut,
  Share2,
  CheckCircle,
  ShieldCheck,
  Clock,
  Lock,
  Terminal,
  Cpu,
  CalendarDays,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { MarketQuote, InstrumentId, UserProfile, SubscriptionTier } from '../types';
import { getMarketScheduleStatus } from '../utils/marketSchedule';
import { isTabLocked, canAccessEaExecution, TIER_CONFIGS } from '../utils/subscriptionTiers';

export type ActiveTab = 'overview' | 'signals' | 'scheduler' | 'journal' | 'rules' | 'risk' | 'macro';

interface HeaderProps {
  quotes: Record<InstrumentId, MarketQuote>;
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenKeysModal: () => void;
  onOpenCalcModal?: () => void;
  onOpenMt5Modal: () => void;
  onOpenNinjaTraderModal?: () => void;
  onOpenAdminCrmModal?: () => void;
  onOpenDailyBriefingModal?: () => void;
  lang: 'ro' | 'en';
  onToggleLang: () => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  signalsCount?: number;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onCopyInviteLink: () => void;
  inviteCopied?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  quotes,
  selectedInstrument,
  onSelectInstrument,
  onRefresh,
  isRefreshing,
  onOpenKeysModal,
  onOpenCalcModal,
  onOpenMt5Modal,
  onOpenNinjaTraderModal,
  onOpenAdminCrmModal,
  onOpenDailyBriefingModal,
  lang,
  onToggleLang,
  activeTab,
  onTabChange,
  signalsCount = 0,
  user,
  onOpenAuthModal,
  onLogout,
  onCopyInviteLink,
  inviteCopied = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.username.toLowerCase() === 'admin';
  const userTier: SubscriptionTier = user?.subscriptionTier || 'diamond';
  const tierConfig = TIER_CONFIGS[userTier] || TIER_CONFIGS.diamond;
  const hasEaAccess = canAccessEaExecution(userTier, isAdmin);

  const handleMt5Click = () => {
    if (!hasEaAccess) {
      onTabChange('risk');
      setIsMenuOpen(false);
      return;
    }
    onOpenMt5Modal();
    setIsMenuOpen(false);
  };

  const handleNinjaTraderClick = () => {
    if (!hasEaAccess) {
      onTabChange('risk');
      setIsMenuOpen(false);
      return;
    }
    if (onOpenNinjaTraderModal) onOpenNinjaTraderModal();
    setIsMenuOpen(false);
  };


  const isMt5Linked = Boolean(user?.mt5AccountNumber);
  const balanceValue = typeof user?.accountBalance === 'number' ? user.accountBalance : (isMt5Linked ? null : 100000);
  const equityValue = typeof user?.equity === 'number' ? user.equity : (balanceValue !== null ? balanceValue : null);

  const navItems: {
    id: ActiveTab;
    labelRo: string;
    labelEn: string;
    shortLabelRo?: string;
    shortLabelEn?: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'overview',
      labelRo: 'Cotații Piață',
      labelEn: 'Market Quotes',
      shortLabelRo: 'Cotații',
      shortLabelEn: 'Quotes',
      icon: <BarChart2 className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'signals',
      labelRo: 'Semnale Live AI',
      labelEn: 'Live AI Signals',
      shortLabelRo: 'Semnale AI',
      shortLabelEn: 'AI Signals',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      badge: signalsCount,
    },
    {
      id: 'scheduler',
      labelRo: 'Programare Trade-uri Automate',
      labelEn: 'Automated Trade Scheduler',
      shortLabelRo: 'Programare',
      shortLabelEn: 'Scheduler',
      icon: <Clock className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'journal',
      labelRo: 'Jurnal de tranzacționare',
      labelEn: 'Trading Journal',
      shortLabelRo: 'Jurnal',
      shortLabelEn: 'Journal',
      icon: <CalendarDays className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'rules',
      labelRo: 'Reguli Personalizate',
      labelEn: 'Custom Rules',
      shortLabelRo: 'Reguli Custom',
      shortLabelEn: 'Custom Rules',
      icon: <Sliders className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'risk',
      labelRo: 'Reguli Risc & Motor EA',
      labelEn: 'Risk Rules & EA Engine',
      shortLabelRo: 'Risc & EA MT5',
      shortLabelEn: 'Risk & EA MT5',
      icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'macro',
      labelRo: 'Știri & Macro',
      labelEn: 'Macro & News',
      shortLabelRo: 'Știri & Macro',
      shortLabelEn: 'News & Macro',
      icon: <Newspaper className="w-4 h-4 text-emerald-400" />,
    },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onTabChange(tab);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      {/* Top Navbar in Liquid Frosted Glass */}
      <div className="bg-[#0B1326]/75 backdrop-blur-2xl text-white px-4 sm:px-6 py-2.5 border-b border-white/10 flex items-center justify-between gap-3 shadow-2xl relative">
        {/* Subtle top edge specular reflection */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center font-black text-lg sm:text-xl italic text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-400/40">
            Σ
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1 font-sans">
                MARKET<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-300">AI</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-mono font-extrabold px-2 py-0.5 rounded-full liquid-indigo text-indigo-200 border border-indigo-400/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                  TERMINAL PRO
                </span>
              </h1>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 hidden md:flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{lang === 'ro' ? 'Terminal Analiză & Execuție AI • LSE Quant Feed • Live Data' : 'AI Analysis & Execution Terminal • LSE Quant Feed • Live Data'}</span>
            </p>
          </div>
        </div>

        {/* Center Desktop Navigation Items */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/10 backdrop-blur-xl shadow-inner">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isLocked = isTabLocked(item.id, userTier, isAdmin);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'liquid-indigo text-white font-bold shadow-[0_0_15px_rgba(99,102,241,0.35)] border border-indigo-400/40'
                    : isLocked
                    ? 'text-slate-400/80 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title={isLocked ? (lang === 'ro' ? 'Funcție Blocată în Pachetul Curent' : 'Feature Locked in Current Tier') : undefined}
              >
                {item.icon}
                <span>{lang === 'ro' ? item.labelRo : item.labelEn}</span>
                {isLocked && (
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-0.5" />
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      isActive ? 'bg-white text-indigo-950 font-black' : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Language Toggle & 3-Line Dropdown Menu Button */}
        <div className="flex items-center gap-2">
          {/* Language Switcher (Always visible and accessible) */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-white/25 text-xs font-bold text-slate-200 font-mono transition cursor-pointer backdrop-blur-md shadow-xs active:scale-95"
            title={lang === 'ro' ? 'Comută în Limba Engleză (EN)' : 'Switch to Romanian (RO)'}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>{lang.toUpperCase()}</span>
          </button>

          {/* 3-Horizontal-Lines Dropdown Menu Button */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer border text-xs font-semibold shadow-md active:scale-95 ${
                isMenuOpen
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/40'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/10 hover:border-white/25'
              }`}
              title={lang === 'ro' ? 'Meniu Platformă & Cont' : 'Platform & Account Menu'}
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <X className="w-4 h-4 text-white" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <Menu className="w-4 h-4 text-indigo-300" />
                </div>
              )}
            </button>

            {/* Backdrop for click-outside dismissal */}
            {isMenuOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                onClick={() => setIsMenuOpen(false)}
              />
            )}

            {/* Dropdown Menu Panel (Opens Downward Over Page) */}
            {isMenuOpen && (
              <div
                style={{ position: 'absolute' }}
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0A1224]/95 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-3.5 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-80px)] overflow-y-auto no-scrollbar text-white"
              >
                {/* 1. User Profile Header */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 flex items-center justify-between backdrop-blur-md">
                  {user ? (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white text-sm shadow-md border border-indigo-400/30 shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-white truncate max-w-[120px]">{user.username}</span>
                          {isAdmin ? (
                            <span className="text-[9px] liquid-amber text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 uppercase font-mono font-bold">
                              ADMIN
                            </span>
                          ) : (
                            <span className="text-[9px] liquid-emerald text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40 uppercase font-mono flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{user.subscriptionDaysLeft ?? 30}d</span>
                            </span>
                          )}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border uppercase font-mono font-bold flex items-center gap-0.5 ${tierConfig.badgeBg} ${tierConfig.badgeText} ${tierConfig.badgeBorder}`}>
                            <span>{tierConfig.iconText}</span>
                            <span>{userTier.toUpperCase()}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {lang === 'ro' ? 'Cont Sincronizat în Cloud' : 'Cloud Synchronized Account'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAuthModal();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 border border-indigo-400/40 cursor-pointer"
                    >
                      <User className="w-4 h-4" />
                      <span>{lang === 'ro' ? 'Conectare / Înregistrare' : 'Sign In / Register'}</span>
                    </button>
                  )}

                  {user && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white transition cursor-pointer border border-rose-500/25 shrink-0"
                      title={lang === 'ro' ? 'Deconectare' : 'Logout'}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 2. Live Market Schedule Status Badge */}
                {(() => {
                  const schedule = getMarketScheduleStatus();
                  return schedule.isClosed ? (
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded-xl liquid-amber text-xs font-bold text-amber-300 border border-amber-500/40"
                      title={`${schedule.reasonRo} (${schedule.userTimezone})`}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{lang === 'ro' ? 'Piață Închisă (Weekend)' : 'Market Closed (Weekend)'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400/80">Luni 01:00</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded-xl liquid-emerald text-xs font-bold text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      title={lang === 'ro' ? 'Piață Deschisă (Tranzacționare Live)' : 'Market Open (Live Trading)'}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                        <span>{lang === 'ro' ? 'Piață Deschisă' : 'Market Open'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider">
                        {lang === 'ro' ? 'Sesiune Live' : 'Live Session'}
                      </span>
                    </div>
                  );
                })()}

                {/* 3. Live MT5 Account Balance & Equity Card (if user logged in) */}
                {user && (
                  <div
                    onClick={() => {
                      setIsMenuOpen(false);
                      onTabChange('risk');
                    }}
                    className="cursor-pointer bg-slate-900/90 hover:bg-slate-800/90 p-2.5 rounded-xl border border-emerald-500/30 hover:border-emerald-400 transition shadow-md backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wide">
                          {user?.mt5AccountNumber ? `MT5 #${user.mt5AccountNumber}` : 'MT5 LIVE ACCOUNT'}
                        </span>
                        {user?.mt5AccountServer && (
                          <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-950 border border-white/5">
                            {user.mt5AccountServer}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-cyan-300 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        {lang === 'ro' ? 'Risc & EA' : 'Risk & EA'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2 rounded-lg border border-white/5 font-mono text-xs">
                      <div>
                        <span className="text-[9.5px] text-slate-400 block">{lang === 'ro' ? 'Balanță Cont:' : 'Balance:'}</span>
                        <span className="text-xs font-bold text-white">
                          {balanceValue !== null ? `$${balanceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (lang === 'ro' ? 'Sincronizare...' : 'Syncing...')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-slate-400 block">Equity:</span>
                        <span className="text-xs font-bold text-emerald-300">
                          {equityValue !== null ? `$${equityValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (lang === 'ro' ? 'Sincronizare...' : 'Syncing...')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Action Buttons List */}
                <div className="space-y-1.5 pt-1">
                  {/* Admin CRM Button */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (onOpenAdminCrmModal) onOpenAdminCrmModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl liquid-amber border border-amber-500/50 text-xs font-black text-amber-300 transition shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer hover:border-amber-400"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>ADMIN CRM DASHBOARD</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  )}

                  {/* Copy Invite Link */}
                  <button
                    onClick={() => {
                      onCopyInviteLink();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl liquid-emerald border border-emerald-500/40 text-xs font-semibold text-emerald-300 transition cursor-pointer hover:border-emerald-400"
                  >
                    <div className="flex items-center gap-2">
                      {inviteCopied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-emerald-400" />}
                      <span>{inviteCopied ? (lang === 'ro' ? 'Link Copiat în Clipboard!' : 'Invite Link Copied!') : (lang === 'ro' ? 'Copiază Link Invitație' : 'Copy Invite Link')}</span>
                    </div>
                  </button>

                  {/* Daily Macro Briefing */}
                  {onOpenDailyBriefingModal && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenDailyBriefingModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-indigo-500/20 hover:from-indigo-500/30 hover:to-cyan-500/30 text-cyan-200 hover:text-white font-semibold text-xs transition border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-300" />
                        <span>{lang === 'ro' ? 'Raport Macro Zilnic 📰' : 'Daily Macro Briefing 📰'}</span>
                      </div>
                    </button>
                  )}

                  {/* Refresh Data */}
                  <button
                    onClick={() => {
                      onRefresh();
                    }}
                    disabled={isRefreshing}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs transition shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer border border-indigo-400/40"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>{lang === 'ro' ? 'Actualizează Cotațiile Live' : 'Refresh Live Quotes'}</span>
                    </div>
                  </button>

                  {/* API Keys Configuration */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenKeysModal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-white/20 text-slate-200 font-semibold text-xs transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>{lang === 'ro' ? 'Configurare Chei API' : 'API Keys Settings'}</span>
                    </div>
                  </button>
                </div>

                {/* 5. Quick Modals Grid (MT5 & NinjaTrader) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                  <button
                    onClick={handleMt5Click}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl liquid-indigo border border-indigo-500/30 text-indigo-200 font-semibold cursor-pointer hover:border-indigo-400"
                  >
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>MT5 Bridge</span>
                    {!hasEaAccess && <Lock className="w-3 h-3 text-amber-400" />}
                  </button>

                  {onOpenNinjaTraderModal && (
                    <button
                      onClick={handleNinjaTraderClick}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl liquid-amber border border-orange-500/30 text-orange-200 font-semibold cursor-pointer hover:border-orange-400"
                    >
                      <Cpu className="w-3.5 h-3.5 text-orange-400" />
                      <span>NinjaTrader</span>
                      {!hasEaAccess && <Lock className="w-3 h-3 text-amber-400" />}
                    </button>
                  )}
                </div>

                {/* 6. Mobile Navigation Menu (for < lg screen sizes) */}
                <div className="lg:hidden pt-2 border-t border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                    {lang === 'ro' ? 'Meniu Navigare' : 'Navigation Menu'}
                  </span>
                  {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const isLocked = isTabLocked(item.id, userTier, isAdmin);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isActive
                            ? 'liquid-indigo text-white shadow-md border border-indigo-400/40'
                            : isLocked
                            ? 'text-slate-400/70 hover:bg-white/5 hover:text-white'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {item.icon}
                          <span>{lang === 'ro' ? item.labelRo : item.labelEn}</span>
                          {isLocked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-500/30 text-indigo-300 font-bold border border-indigo-400/30">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE HORIZONTAL NAVIGATION ROW (Directly visible on Mobile & Tablet in Header) */}
      <nav
        id="mobile-navigation-row"
        aria-label={lang === 'ro' ? 'Rând Navigare Mobil' : 'Mobile Navigation Bar'}
        className="lg:hidden bg-[#070D1A]/90 backdrop-blur-xl border-b border-white/10 px-2.5 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 shadow-inner select-none"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isLocked = isTabLocked(item.id, userTier, isAdmin);
          return (
            <button
              id={`mobile-nav-btn-${item.id}`}
              key={`mobile-nav-${item.id}`}
              onClick={() => handleNavClick(item.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 cursor-pointer ${
                isActive
                  ? 'liquid-indigo text-white font-bold shadow-md shadow-indigo-600/30 border border-indigo-400/50 ring-1 ring-indigo-400/50'
                  : isLocked
                  ? 'text-slate-400/80 hover:text-white bg-slate-900/70 border border-white/5'
                  : 'text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-800/80 border border-white/5'
              }`}
            >
              {item.icon}
              <span>{lang === 'ro' ? item.shortLabelRo || item.labelRo : item.shortLabelEn || item.labelEn}</span>
              {isLocked && <Lock className="w-3 h-3 text-amber-400 shrink-0 ml-0.5" />}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                    isActive ? 'bg-white text-indigo-950' : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* SECOND HEADER BAR: TRADING ACCOUNTS & AUTOMATED BRIDGES (Centered) */}
      <div
        id="trading-bridges-subbar"
        className="bg-[#080E1E]/95 backdrop-blur-2xl border-b border-white/10 px-3 sm:px-6 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-center gap-2.5 sm:gap-4 flex-wrap relative z-20 select-none"
      >
        {/* MT5 Account Pill with Live Balance & Equity */}
        <button
          onClick={() => onTabChange('risk')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/95 border border-emerald-500/40 hover:border-emerald-400 transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.15)] group backdrop-blur-md cursor-pointer"
          title={
            user?.mt5AccountNumber
              ? `${lang === 'ro' ? 'Cont MT5 Conectat' : 'Connected MT5 Account'}: #${user.mt5AccountNumber} (${user.mt5AccountServer || 'Server MT5'}) • Click ${lang === 'ro' ? 'pentru Configurare Risc' : 'for Risk Settings'}`
              : lang === 'ro'
              ? 'MT5 Balanță & Equity Live - Click pentru Configurare Risc'
              : 'MT5 Live Balance & Equity - Click for Risk Configuration'
          }
        >
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-tight leading-tight flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-400" />
                {user?.mt5AccountNumber ? `MT5 #${user.mt5AccountNumber}` : 'MT5 LIVE'}
              </span>
              {user?.mt5AccountServer && (
                <span className="text-[8px] font-mono text-slate-400 leading-none truncate max-w-[90px]">
                  {user.mt5AccountServer}
                </span>
              )}
            </div>
          </div>
          <div className="h-3.5 w-px bg-white/15"></div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-sans font-medium">{lang === 'ro' ? 'Bal:' : 'Bal:'}</span>
              <span className="font-bold text-white">
                {balanceValue !== null ? `$${balanceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (lang === 'ro' ? 'Sync...' : 'Sync...')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-sans font-medium">Eq:</span>
              <span className="font-bold text-emerald-300">
                {equityValue !== null ? `$${equityValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (lang === 'ro' ? 'Sync...' : 'Sync...')}
              </span>
            </div>
          </div>
        </button>

        {/* MT5 Bridge Modal Button */}
        <button
          onClick={handleMt5Click}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-indigo border border-indigo-500/40 hover:border-indigo-400 text-xs font-semibold text-indigo-200 hover:text-white transition-all shadow-[0_0_12px_rgba(99,102,241,0.2)] cursor-pointer"
          title="MetaTrader 5 Auto-Trading Bridge & EA Connector"
        >
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span>MT5 Bridge</span>
          {hasEaAccess ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          ) : (
            <Lock className="w-3 h-3 text-amber-400" />
          )}
        </button>

        {/* NinjaTrader Bridge Modal Button */}
        {onOpenNinjaTraderModal && (
          <button
            onClick={handleNinjaTraderClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-amber border border-orange-500/40 hover:border-orange-400 text-xs font-semibold text-orange-200 hover:text-white transition-all shadow-[0_0_12px_rgba(249,115,22,0.2)] cursor-pointer"
            title="NinjaTrader 8 Auto-Trading Bridge (Futures & Prop Firms)"
          >
            <Cpu className="w-3.5 h-3.5 text-orange-400" />
            <span>NinjaTrader 8 Bridge</span>
            {hasEaAccess ? (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
            ) : (
              <Lock className="w-3 h-3 text-amber-400" />
            )}
          </button>
        )}

        {/* API Keys Modal Button */}
        <button
          onClick={onOpenKeysModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 border border-white/10 hover:border-amber-400/50 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer"
          title="Configurare Chei API (Gemini AI & London Strategic Edge)"
        >
          <Key className="w-3.5 h-3.5 text-amber-400" />
          <span>{lang === 'ro' ? 'Chei API' : 'API Keys'}</span>
        </button>

        {/* Calculator Lot & Risc Modal Button */}
        {onOpenCalcModal && (
          <button
            onClick={onOpenCalcModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 border border-white/10 hover:border-cyan-400/50 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer"
            title={lang === 'ro' ? 'Calculator Lot, Risc & P&L' : 'Lot & Risk Calculator'}
          >
            <Calculator className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lang === 'ro' ? 'Calculator Lot' : 'Lot Calculator'}</span>
          </button>
        )}
      </div>

      {/* Sub-Header Live Market Ticker in Frosted Liquid Glass */}
      <div className="bg-[#070D18]/90 backdrop-blur-2xl border-b border-white/10 px-3 sm:px-4 py-1.5 text-xs flex items-center justify-between overflow-x-auto gap-4 shadow-inner text-slate-200">
        <div className="flex items-center gap-3 sm:gap-6 min-w-max">
          <div className="flex items-center gap-2 font-mono select-none">
            {/* Glowing & Pulsing Blue Dot with Ping Halo */}
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
            </span>
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-cyan-300 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
              LIVE QUANT FEED:
            </span>
          </div>

          {(['NASDAQ', 'SPX500', 'DOW_JONES', 'GOLD', 'NQ_F', 'ES_F', 'YM_F', 'GC_F', 'EURUSD', 'GBPUSD', 'USDJPY'] as InstrumentId[]).map((id) => {
            const q = quotes[id];
            const hasRealPrice = Boolean(q && typeof q.price === 'number' && q.price > 0 && !isNaN(q.price));
            const isPositive = hasRealPrice && (q.changePercent || 0) >= 0;
            const isSelected = selectedInstrument === id;

            const displayLabel =
              id === 'NASDAQ'
                ? 'NAS100'
                : id === 'SPX500'
                ? 'SPX500'
                : id === 'DOW_JONES'
                ? 'US30'
                : id === 'GOLD'
                ? 'XAU'
                : id === 'NQ_F'
                ? 'NQ.F'
                : id === 'ES_F'
                ? 'ES.F'
                : id === 'YM_F'
                ? 'DOW.F'
                : id === 'GC_F'
                ? 'GC.F'
                : id === 'EURUSD'
                ? 'EUR/USD'
                : id === 'GBPUSD'
                ? 'GBP/USD'
                : 'USD/JPY';

            const formattedPrice =
              !hasRealPrice
                ? '-'
                : id === 'EURUSD' || id === 'GBPUSD'
                ? `${q.price.toFixed(5)}`
                : id === 'USDJPY'
                ? `${q.price.toFixed(3)}`
                : `$${q.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            const btnClass = isSelected
              ? 'liquid-indigo border border-indigo-400/50 text-white font-bold shadow-[0_0_15px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/40'
              : 'bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border border-white/5 hover:border-white/15';

            return (
              <button
                key={id}
                onClick={() => onSelectInstrument(id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-lg transition-colors duration-150 text-xs cursor-pointer ${btnClass}`}
              >
                <span className="font-semibold text-slate-400">{displayLabel}:</span>
                <span className={`font-mono font-bold ${
                  !hasRealPrice
                    ? 'text-slate-400'
                    : isPositive
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}>
                  {formattedPrice}
                </span>
                {hasRealPrice ? (
                  <span
                    className={`text-[10px] font-medium font-mono px-1.5 py-0.5 rounded border ${
                      isPositive
                        ? 'liquid-emerald text-emerald-300 border-emerald-500/30'
                        : 'liquid-rose text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {q.changePercent}%
                  </span>
                ) : (
                  <span className="text-[10px] font-medium font-mono px-1.5 py-0.5 rounded border bg-slate-800/40 text-slate-500 border-white/5">
                    -
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold min-w-max">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> LSE FEED • 12ms
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
