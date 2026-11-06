import React, { useState, useEffect } from 'react';
import {
  X,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Download,
  Lock,
  Layers,
  Save,
  Server,
  Wallet,
  CheckSquare,
  Square,
} from 'lucide-react';
import { getMql5EaCode, MT5_EA_VERSION } from '../utils/mql5Template';
import { getNinjaTraderScript } from '../utils/ninjaTraderTemplate';
import { UserProfile, BridgeAccount } from '../types';

interface BridgeIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
  authToken?: string;
  user?: UserProfile | null;
  initialSlot?: number; // 1, 2, or 3
  initialPlatform?: 'MT5' | 'NINJATRADER';
  onAccountsUpdated?: (accounts: BridgeAccount[]) => void;
}

export const BridgeIntegrationModal: React.FC<BridgeIntegrationModalProps> = ({
  isOpen,
  onClose,
  lang,
  authToken,
  user,
  initialSlot = 1,
  initialPlatform,
  onAccountsUpdated,
}) => {
  const [activeSlot, setActiveSlot] = useState<number>(initialSlot);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Initialize 3 default accounts if none exist in user profile
  const [accounts, setAccounts] = useState<BridgeAccount[]>(() => {
    if (user?.bridgeAccounts && Array.isArray(user.bridgeAccounts) && user.bridgeAccounts.length > 0) {
      return user.bridgeAccounts;
    }
    const primaryMt5Key = user?.mt5ApiKey || user?.apiKeys?.mt5ApiKey || '';
    const primaryNtKey = user?.ninjaTraderApiKey || user?.apiKeys?.ninjaTraderApiKey || '';
    return [
      {
        id: 'acc_1',
        slot: 1,
        name: 'Cont 1 (Principal MT5)',
        platform: 'MT5',
        apiKey: primaryMt5Key,
        accountNumber: user?.mt5AccountNumber,
        accountServer: user?.mt5AccountServer,
        accountCurrency: user?.mt5AccountCurrency,
        balance: user?.accountBalance,
        equity: user?.equity,
        lastConnectedAt: user?.mt5LastConnectedAt,
        status: 'active',
      },
      {
        id: 'acc_2',
        slot: 2,
        name: 'Cont 2 (MT5 Secundar)',
        platform: 'MT5',
        apiKey: '',
        status: 'active',
      },
      {
        id: 'acc_3',
        slot: 3,
        name: 'Cont 3 (NinjaTrader 8)',
        platform: 'NINJATRADER',
        apiKey: primaryNtKey,
        accountNumber: user?.ninjaTraderAccountNumber,
        accountServer: user?.ninjaTraderAccountName,
        accountCurrency: user?.ninjaTraderAccountCurrency,
        lastConnectedAt: user?.ninjaTraderLastConnectedAt,
        status: 'active',
      },
    ];
  });

  // Sync state when user profile updates
  useEffect(() => {
    if (user?.bridgeAccounts && Array.isArray(user.bridgeAccounts) && user.bridgeAccounts.length > 0) {
      setAccounts(user.bridgeAccounts);
    }
  }, [user]);

  // If initialSlot or initialPlatform changes on modal open, switch tab
  useEffect(() => {
    if (isOpen) {
      if (initialPlatform) {
        const found = accounts.find((a) => a.platform === initialPlatform);
        if (found) {
          setActiveSlot(found.slot);
          return;
        }
      }
      if (initialSlot >= 1 && initialSlot <= 3) {
        setActiveSlot(initialSlot);
      }
    }
  }, [isOpen, initialSlot, initialPlatform]);

  // Fetch fresh accounts from server on open
  useEffect(() => {
    if (isOpen && authToken) {
      fetch('/api/user/bridge-accounts', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.bridgeAccounts) && data.bridgeAccounts.length > 0) {
            setAccounts(data.bridgeAccounts);
            if (onAccountsUpdated) onAccountsUpdated(data.bridgeAccounts);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, authToken]);

  if (!isOpen) return null;

  const currentAccount = accounts.find((a) => a.slot === activeSlot) || accounts[0];
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://marketaitrader.eu';

  const mt5Endpoint = `${currentOrigin}/api/mt5/signals`;
  const mt5UpdateEndpoint = `${currentOrigin}/api/mt5/update`;

  const ntSignalsEndpoint = `${currentOrigin}/api/ninjatrader/signals`;
  const ntAccountEndpoint = `${currentOrigin}/api/ninjatrader/account`;
  const ntUpdateEndpoint = `${currentOrigin}/api/ninjatrader/update`;

  const mql5Code = getMql5EaCode(
    mt5Endpoint,
    mt5UpdateEndpoint,
    currentAccount?.apiKey || '',
    currentOrigin,
    currentAccount?.name || `Cont ${activeSlot}`
  );

  const ninjaScriptCode = getNinjaTraderScript(
    ntSignalsEndpoint,
    ntAccountEndpoint,
    ntUpdateEndpoint,
    currentAccount?.apiKey || '',
    currentOrigin,
    currentAccount?.name || `Cont ${activeSlot}`
  );

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadMql5 = () => {
    const filename = `MarketAI_Bridge_Cont${activeSlot}.mq5`;
    const element = document.createElement('a');
    const file = new Blob([mql5Code], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleUpdateCurrentAccount = (updates: Partial<BridgeAccount>) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.slot === activeSlot ? { ...acc, ...updates } : acc))
    );
  };

  const handleSaveChanges = async () => {
    if (!authToken || isSaving) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch('/api/user/bridge-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ bridgeAccounts: accounts }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.bridgeAccounts)) {
        setAccounts(data.bridgeAccounts);
        if (onAccountsUpdated) onAccountsUpdated(data.bridgeAccounts);
        setSaveSuccessMsg(lang === 'ro' ? 'Configurația conturilor a fost salvată!' : 'Account configuration saved!');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error('Failed to save bridge accounts:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!authToken || isRegenerating || !currentAccount) return;
    const confirmMsg =
      lang === 'ro'
        ? `Sigur doriți să regenerați cheia API pentru ${currentAccount.name}? Va fi necesară actualizarea cheii în terminalul EA / NinjaTrader.`
        : `Are you sure you want to regenerate the API key for ${currentAccount.name}? You will need to update the key in your terminal.`;
    if (!window.confirm(confirmMsg)) return;

    setIsRegenerating(true);
    try {
      const res = await fetch('/api/user/regenerate-bridge-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ accountId: currentAccount.id }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.bridgeAccounts)) {
        setAccounts(data.bridgeAccounts);
        if (onAccountsUpdated) onAccountsUpdated(data.bridgeAccounts);
        setSaveSuccessMsg(lang === 'ro' ? 'Cheie API nouă generată cu succes!' : 'New API key generated successfully!');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error('Failed to regenerate key:', e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const isConnected = !!(
    currentAccount?.accountNumber ||
    (currentAccount?.lastConnectedAt &&
      Date.now() - new Date(currentAccount.lastConnectedAt).getTime() < 86400000)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/98 to-[#050914]/98 rounded-2xl shadow-2xl border border-white/15 w-full max-w-5xl overflow-hidden glass-specular-top text-slate-100 relative">
        {/* Ambient neon illumination glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Header */}
        <div className="bg-gradient-to-r from-[#070D1A] via-indigo-950/40 to-[#070D1A] text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 shadow-inner">
              <Layers className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {lang === 'ro' ? 'Conexiuni EA Multi-Cont (MT5 & NinjaTrader)' : 'Multi-Account EA Bridge (MT5 & NinjaTrader)'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-mono text-[10px] font-bold">
                  3 Conturi Suportate
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {lang === 'ro'
                  ? 'Conectați până la 3 conturi simultan. Selectați pe pagina de semnale conturile țintă către care se trimite comanda.'
                  : 'Connect up to 3 trading accounts simultaneously. Select target accounts on the signal generation page.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Slots Tabs (Cont 1, Cont 2, Cont 3) */}
        <div className="bg-slate-950/70 border-b border-white/10 px-4 py-2 flex flex-wrap items-center gap-2 relative z-10">
          {accounts.map((acc) => {
            const isTabActive = acc.slot === activeSlot;
            const hasConnection = !!(
              acc.accountNumber ||
              (acc.lastConnectedAt && Date.now() - new Date(acc.lastConnectedAt).getTime() < 86400000)
            );
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setActiveSlot(acc.slot)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                  isTabActive
                    ? 'bg-gradient-to-r from-indigo-600/40 to-indigo-700/40 border-indigo-400/60 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800/60 hover:border-white/15'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasConnection ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                <span className="font-bold">Slot {acc.slot}:</span>
                <span className="max-w-[130px] sm:max-w-[170px] truncate">{acc.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                    acc.platform === 'MT5'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                      : 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                  }`}
                >
                  {acc.platform}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto font-sans relative z-10">
          {/* Account Settings Configuration Bar */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Account Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  {lang === 'ro' ? 'Nume / Etichetă Cont' : 'Account Name / Label'}
                </label>
                <input
                  type="text"
                  value={currentAccount?.name || ''}
                  onChange={(e) => handleUpdateCurrentAccount({ name: e.target.value })}
                  placeholder={`Cont ${activeSlot}`}
                  className="w-full bg-slate-950 text-white text-xs px-3 py-2 rounded-lg border border-white/15 focus:outline-none focus:border-indigo-400 font-semibold"
                />
              </div>

              {/* Platform Selector (MT5 vs NinjaTrader) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  {lang === 'ro' ? 'Platformă Conectată' : 'Connected Platform'}
                </label>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/15">
                  <button
                    type="button"
                    onClick={() => handleUpdateCurrentAccount({ platform: 'MT5' })}
                    className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition ${
                      currentAccount?.platform === 'MT5'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    MetaTrader 5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateCurrentAccount({ platform: 'NINJATRADER' })}
                    className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition ${
                      currentAccount?.platform === 'NINJATRADER'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    NinjaTrader 8
                  </button>
                </div>
              </div>

              {/* Status Toggle */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  {lang === 'ro' ? 'Status Slot Cont' : 'Account Slot Status'}
                </label>
                <select
                  value={currentAccount?.status || 'active'}
                  onChange={(e) => handleUpdateCurrentAccount({ status: e.target.value as 'active' | 'inactive' })}
                  className="w-full bg-slate-950 text-white text-xs px-3 py-2 rounded-lg border border-white/15 focus:outline-none focus:border-indigo-400 font-semibold cursor-pointer"
                >
                  <option value="active">{lang === 'ro' ? '🟢 Activ (Primește Semnale)' : '🟢 Active (Receives Signals)'}</option>
                  <option value="inactive">{lang === 'ro' ? '⚪ În pauză / Dezactivat' : '⚪ Paused / Inactive'}</option>
                </select>
              </div>
            </div>

            {/* Save Button */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer border border-indigo-400/40"
              >
                <Save className="w-4 h-4 text-amber-300" />
                <span>{isSaving ? (lang === 'ro' ? 'Se salvează...' : 'Saving...') : (lang === 'ro' ? 'Salvează Configurația' : 'Save Changes')}</span>
              </button>
            </div>
          </div>

          {saveSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Connected Account Live Status */}
          {isConnected ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-emerald-300">
                      {currentAccount.platform} {lang === 'ro' ? 'Conectat cu Succes' : 'Successfully Connected'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                      #{currentAccount.accountNumber || 'Conectat'}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">({currentAccount.name})</span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    Server / Broker: <span className="font-semibold text-emerald-200">{currentAccount.accountServer || 'Live Broker Terminal'}</span>
                    {currentAccount.accountCompany ? ` • ${currentAccount.accountCompany}` : ''}
                    {currentAccount.accountCurrency ? ` • Monedă: ${currentAccount.accountCurrency}` : ''}
                  </p>
                  <div className="flex items-center gap-4 mt-2 font-mono text-xs text-emerald-200">
                    <span>{lang === 'ro' ? 'Balanță:' : 'Balance:'} <strong className="text-white">${(currentAccount.balance ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Equity: <strong className="text-white">${(currentAccount.equity ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-1">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase font-mono shadow-md shadow-emerald-900/40 border border-emerald-400/30">
                  {lang === 'ro' ? 'LIVE SYNC ACTIV' : 'LIVE SYNC ACTIVE'}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {currentAccount.lastConnectedAt
                    ? `Sincronizat: ${new Date(currentAccount.lastConnectedAt).toLocaleTimeString()}`
                    : 'Conexiune Activă'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-100 flex items-start gap-3 backdrop-blur-md">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-300">
                  {lang === 'ro'
                    ? `În Așteptare Conectare ${currentAccount.platform} pentru ${currentAccount.name}...`
                    : `Awaiting ${currentAccount.platform} connection for ${currentAccount.name}...`}
                </h3>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  {currentAccount.platform === 'MT5'
                    ? (lang === 'ro'
                        ? `Descărcați fișierul EA MarketAI_Bridge_Cont${activeSlot}.mq5 de mai jos sau copiați cheia InpApiKey în setările EA-ului din MT5 pentru acest cont.`
                        : `Download the EA file below or enter the InpApiKey in your MT5 Expert Advisor inputs.`)
                    : (lang === 'ro'
                        ? `Copiați scriptul NinjaScript de mai jos în NinjaTrader 8 (Tools -> NinjaScript Editor) și porniți strategia cu cheia API asociată.`
                        : `Copy the NinjaScript code below into NinjaTrader 8 and start the strategy with this account's API key.`)}
                </p>
              </div>
            </div>
          )}

          {/* Dedicated API Key for this Slot */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider">
                  {lang === 'ro' ? `Cheie API Dedicată: ${currentAccount.name}` : `Dedicated API Key: ${currentAccount.name}`}
                </span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">
                {currentAccount.platform === 'MT5' ? 'InpApiKey' : 'MarketAiApiKey'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/60 rounded-lg px-3 py-2 border border-white/10 font-mono text-xs text-emerald-400 select-all truncate">
                {currentAccount.apiKey || (lang === 'ro' ? 'Generare în curs...' : 'Generating...')}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentAccount.apiKey || '', 'api-key')}
                className="px-3 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 text-indigo-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copiedSection === 'api-key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'api-key' ? (lang === 'ro' ? 'Copiat!' : 'Copied!') : (lang === 'ro' ? 'Copiază Cheia' : 'Copy Key')}</span>
              </button>
              <button
                type="button"
                onClick={handleRegenerateKey}
                disabled={isRegenerating}
                className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-50"
                title={lang === 'ro' ? 'Regenerează cheia API pentru acest slot' : 'Regenerate API key for this slot'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline">{lang === 'ro' ? 'Regenerează' : 'Regenerate'}</span>
              </button>
            </div>
          </div>

          {/* Platform Specific Code & Downloads */}
          {currentAccount.platform === 'MT5' ? (
            /* MT5 Section */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-blue-950/30 border border-blue-500/25">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span>{lang === 'ro' ? `Expert Advisor MT5 pentru ${currentAccount.name}` : `MT5 Expert Advisor for ${currentAccount.name}`}</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {lang === 'ro'
                      ? `Fișierul .mq5 vine gata configurat cu cheia unică a acestui cont (${currentAccount.name}).`
                      : `The .mq5 file comes pre-configured with this account's unique API key.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadMql5}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 border border-blue-400/40 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{lang === 'ro' ? `Descarcă EA (Cont ${activeSlot})` : `Download EA (Slot ${activeSlot})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(mql5Code, 'mql5-code')}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 text-xs font-semibold transition cursor-pointer"
                  >
                    {copiedSection === 'mql5-code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSection === 'mql5-code' ? (lang === 'ro' ? 'Copiat!' : 'Copied!') : (lang === 'ro' ? 'Copiază Cod' : 'Copy Code')}</span>
                  </button>
                </div>
              </div>

              {/* Instructions Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                  <div className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-center leading-5 text-white">1</span>
                    <span>{lang === 'ro' ? 'Copiază / Salvează' : 'Download / Save'}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'ro'
                      ? `Descarcă fișierul MarketAI_Bridge_Cont${activeSlot}.mq5 sau deschide MetaEditor (F4) și creează un Expert Advisor nou.`
                      : `Download the .mq5 file or create a new Expert Advisor in MetaEditor (F4).`}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                  <div className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-center leading-5 text-white">2</span>
                    <span>{lang === 'ro' ? 'Permisiuni WebRequest' : 'Allow WebRequest'}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'ro'
                      ? `În MT5: Tools -> Options -> Expert Advisors -> Bifați "Allow WebRequest" și adăugați ${currentOrigin}`
                      : `In MT5: Tools -> Options -> Expert Advisors -> Enable "Allow WebRequest" and add ${currentOrigin}`}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                  <div className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-center leading-5 text-white">3</span>
                    <span>{lang === 'ro' ? 'Atașează pe Grafic' : 'Attach to Chart'}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'ro'
                      ? 'Compilați (F7), trageți EA-ul pe graficul instrumentului dorit și bifați "Allow Algo Trading".'
                      : 'Compile (F7), drag EA to your chart, and enable "Allow Algo Trading".'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* NinjaTrader Section */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-orange-950/30 border border-orange-500/25">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-orange-400" />
                    <span>{lang === 'ro' ? `Strategie NinjaScript C# pentru ${currentAccount.name}` : `NinjaScript C# Strategy for ${currentAccount.name}`}</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {lang === 'ro'
                      ? `Codul C# include cheia de autorizare Bearer preconfigurată pentru ${currentAccount.name}.`
                      : `The C# code includes pre-configured Bearer token for ${currentAccount.name}.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(ninjaScriptCode, 'nt-code')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-900/30 border border-orange-400/40 transition cursor-pointer"
                  >
                    {copiedSection === 'nt-code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSection === 'nt-code' ? (lang === 'ro' ? 'Copiat!' : 'Copied!') : (lang === 'ro' ? 'Copiază NinjaScript C#' : 'Copy NinjaScript C#')}</span>
                  </button>
                </div>
              </div>

              {/* NT8 Instructions Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                  <div className="font-bold text-orange-300 font-mono flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-orange-600/40 text-center leading-5 text-white">1</span>
                    <span>{lang === 'ro' ? 'NinjaScript Editor' : 'NinjaScript Editor'}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'ro'
                      ? 'În NinjaTrader 8: New -> NinjaScript Editor -> Strategies -> Clic dreapta "New Strategy".'
                      : 'In NinjaTrader 8: New -> NinjaScript Editor -> Strategies -> Right click "New Strategy".'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                  <div className="font-bold text-orange-300 font-mono flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-orange-600/40 text-center leading-5 text-white">2</span>
                    <span>{lang === 'ro' ? 'Lipiți Codul & Compilați' : 'Paste Code & Compile'}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'ro'
                      ? 'Lipiți codul C# copiat mai sus și apăsați F5 (Compile). Așteptați sunetul de confirmare.'
                      : 'Paste the copied C# code and press F5 (Compile). Wait for the chime.'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-1">
                  <div className="font-bold text-orange-300 font-mono flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-orange-600/40 text-center leading-5 text-white">3</span>
                    <span>{lang === 'ro' ? 'Activați pe Chart' : 'Enable on Chart'}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'ro'
                      ? 'Deschideți graficul (NQ, ES, YM, GC), apăsați Ctrl+S, selectați MarketAI_NinjaTrader_Bridge și bifați Enabled.'
                      : 'Open chart, press Ctrl+S, select MarketAI_NinjaTrader_Bridge and check Enabled.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* All 3 Accounts Quick Status Overview */}
          <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-white/10">
            <h4 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider mb-3 flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lang === 'ro' ? 'Privire de Ansamblu: Toate cele 3 Conturi' : 'Overview: All 3 Connected Accounts'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {accounts.map((acc) => {
                const isAccConn = !!(
                  acc.accountNumber ||
                  (acc.lastConnectedAt && Date.now() - new Date(acc.lastConnectedAt).getTime() < 86400000)
                );
                return (
                  <div
                    key={acc.id}
                    onClick={() => setActiveSlot(acc.slot)}
                    className={`p-3 rounded-lg border transition cursor-pointer ${
                      acc.slot === activeSlot
                        ? 'bg-indigo-950/40 border-indigo-500/50'
                        : 'bg-slate-900/40 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{acc.name}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase font-bold ${
                          acc.platform === 'MT5' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'
                        }`}
                      >
                        {acc.platform}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] font-mono">
                      <span className="text-slate-400">{acc.accountNumber ? `#${acc.accountNumber}` : 'Neconectat'}</span>
                      <span className={isAccConn ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {isAccConn ? (lang === 'ro' ? 'Conectat' : 'Connected') : (lang === 'ro' ? 'Inactiv' : 'Offline')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#070D1A] px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 relative z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'ro' ? 'Conexiune criptată TLS & Token Bearer izolat per utilizator' : 'Encrypted TLS connection with isolated Bearer token per account'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition cursor-pointer"
          >
            {lang === 'ro' ? 'Închide' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
