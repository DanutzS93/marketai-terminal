import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ShieldCheck, Cpu, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
import { getNinjaTraderScript } from '../utils/ninjaTraderTemplate';
import { UserProfile } from '../types';

interface NinjaTraderIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
  authToken?: string;
  user?: UserProfile | null;
}

export const NinjaTraderIntegrationModal: React.FC<NinjaTraderIntegrationModalProps> = ({
  isOpen,
  onClose,
  lang,
  authToken,
  user,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(
    user?.ninjaTraderApiKey || user?.apiKeys?.ninjaTraderApiKey || 'nt8_live_token_marketai'
  );
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  useEffect(() => {
    if (user?.ninjaTraderApiKey) {
      setApiKey(user.ninjaTraderApiKey);
    } else if (user?.apiKeys?.ninjaTraderApiKey) {
      setApiKey(user.apiKeys.ninjaTraderApiKey);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && authToken) {
      fetch('/api/user/sync-data', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ninjaTraderApiKey) {
            setApiKey(d.ninjaTraderApiKey);
          } else if (d.user?.ninjaTraderApiKey) {
            setApiKey(d.user.ninjaTraderApiKey);
          } else if (d.apiKeys?.ninjaTraderApiKey) {
            setApiKey(d.apiKeys.ninjaTraderApiKey);
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }, [isOpen, authToken]);

  const handleRegenerateKey = async () => {
    if (!authToken || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/user/regenerate-ninjatrader-key', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && data.ninjaTraderApiKey) {
        setApiKey(data.ninjaTraderApiKey);
      }
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const signalsEndpoint = `${currentOrigin}/api/ninjatrader/signals`;
  const accountEndpoint = `${currentOrigin}/api/ninjatrader/account`;
  const updateEndpoint = `${currentOrigin}/api/ninjatrader/update`;

  const ninjaScriptCode = getNinjaTraderScript(
    signalsEndpoint,
    accountEndpoint,
    updateEndpoint,
    apiKey,
    currentOrigin
  );

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 to-[#050914]/98 rounded-2xl shadow-2xl border border-white/15 w-full max-w-4xl overflow-hidden glass-specular-top text-slate-100 relative">
        {/* Ambient illumination glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />
        
        {/* Header with NinjaTrader Brand Style */}
        <div className="bg-gradient-to-r from-[#070D1A] via-orange-950/30 to-[#070D1A] text-white p-5 flex items-center justify-between border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-400/30 text-orange-400 shadow-inner">
              <Cpu className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {lang === 'ro' ? 'Conexiune Automată NinjaTrader 8 (NT8 Bridge)' : 'NinjaTrader 8 Auto-Trading Bridge'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 font-mono text-[10px] font-bold">
                  NinjaScript v2.4 Pro Futures
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {lang === 'ro'
                  ? 'Copiază automat semnalele AI pe NinjaTrader 8 (NQ, MNQ, ES, MES, YM, GC). Compatibil cu conturi personale & Prop Firms (Apex, Topstep, MyFundedFutures).'
                  : 'Automated AI trade copier for NinjaTrader 8 (NQ, MNQ, ES, MES, YM, GC). Fully compatible with Personal & Prop Firms (Apex, Topstep, MyFundedFutures).'}
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

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans relative z-10">

          {/* Connected NinjaTrader Account Status Box */}
          {user?.ninjaTraderAccountNumber ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-emerald-300">
                      {lang === 'ro' ? 'Cont NinjaTrader 8 Conectat cu Succes' : 'NinjaTrader 8 Account Successfully Connected'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                      {user.ninjaTraderAccountName || `#${user.ninjaTraderAccountNumber}`}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    Platformă: <span className="font-semibold text-emerald-200">NinjaTrader 8 (Live Strategy Active)</span>
                    {user.ninjaTraderAccountCurrency ? ` • Monedă: ${user.ninjaTraderAccountCurrency}` : ' • USD'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 font-mono text-xs text-emerald-200">
                    <span>{lang === 'ro' ? 'Balanță / Cash:' : 'Balance / Cash:'} <strong className="text-white">${(user.accountBalance ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Equity / Buying Power: <strong className="text-white">${(user.equity ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-1">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase font-mono shadow-md shadow-emerald-900/40 border border-emerald-400/30">
                  {lang === 'ro' ? 'NINJA BRIDGE ACTIV' : 'NINJA BRIDGE ACTIVE'}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {user.ninjaTraderLastConnectedAt ? `Sincronizat: ${new Date(user.ninjaTraderLastConnectedAt).toLocaleTimeString()}` : 'Conexiune Activă'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-100 flex items-start gap-3 backdrop-blur-md">
              <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-orange-300">
                  {lang === 'ro' ? 'În Așteptare Conectare NinjaTrader 8...' : 'Awaiting NinjaTrader 8 Strategy Connection...'}
                </h3>
                <p className="text-xs text-orange-200/80 mt-1 leading-relaxed">
                  {lang === 'ro'
                    ? 'Pentru a trimite semnalele pe NinjaTrader 8 și a sincroniza automat balanța și trade-urile, deschideți NinjaScript Editor (F5), creați o strategie nouă numită MarketAI_NinjaTrader_Bridge, lipiți codul C# de mai jos și activați strategia pe grafic.'
                    : 'To copy trades to NinjaTrader 8 and synchronize account balance and execution status, open NinjaScript Editor (F5), create a new Strategy named MarketAI_NinjaTrader_Bridge, paste the C# code below, and enable the strategy on your chart.'}
                </p>
              </div>
            </div>
          )}

          {/* Futures & Prop Firm Mapping Highlights */}
          <div className="p-3.5 rounded-xl bg-[#060B18]/80 border border-white/10 text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs backdrop-blur-md">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-300 font-mono">
                {lang === 'ro' ? 'Mapare Automată Futures & Micro:' : 'Automatic Futures & Micro Mapping:'}
              </span>
              <span className="text-slate-300 font-mono">
                Nas100 ➔ NQ / MNQ • Dow ➔ YM / MYM • S&P ➔ ES / MES • Gold ➔ GC / MGC
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 font-medium text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 font-mono">
              <Layers className="w-3.5 h-3.5" />
              <span>Apex • Topstep • MFF • Bulenox</span>
            </div>
          </div>
          
          {/* Endpoint & Token Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#060B18]/80 border border-white/10 p-4 rounded-xl backdrop-blur-md">
              <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 block mb-1">
                {lang === 'ro' ? 'NinjaTrader REST Signals URL' : 'NinjaTrader REST Signals URL'}
              </label>
              <div className="flex items-center gap-2 bg-[#040813] border border-white/10 rounded-lg p-2 shadow-inner">
                <input
                  type="text"
                  readOnly
                  value={signalsEndpoint}
                  className="w-full text-xs font-mono text-cyan-200 bg-transparent outline-hidden"
                />
                <button
                  onClick={() => handleCopy(signalsEndpoint, 'endpoint')}
                  className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition shrink-0 cursor-pointer"
                  title="Copy Endpoint"
                >
                  {copiedSection === 'endpoint' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-[#060B18]/80 border border-white/10 p-4 rounded-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                  {lang === 'ro' ? 'NinjaTrader API Key (Bearer Token)' : 'Personal NinjaTrader API Key (Bearer Token)'}
                </label>
                {authToken && (
                  <button
                    onClick={handleRegenerateKey}
                    disabled={isRegenerating}
                    className="text-[10px] flex items-center gap-1 font-semibold font-mono text-orange-400 hover:text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 transition disabled:opacity-50 cursor-pointer"
                    title={lang === 'ro' ? 'Generează o cheie API nouă' : 'Regenerate new API key'}
                  >
                    <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {lang === 'ro' ? 'Regenerează' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 bg-[#040813] border border-white/10 rounded-lg p-2 shadow-inner">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="w-full text-xs font-mono text-cyan-200 bg-transparent outline-hidden"
                />
                <button
                  onClick={() => handleCopy(apiKey, 'apikey')}
                  className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition shrink-0 cursor-pointer"
                  title="Copy API Key"
                >
                  {copiedSection === 'apikey' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="bg-[#060B18]/80 border border-white/10 rounded-xl p-4 text-slate-200 backdrop-blur-md">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-orange-300 font-mono">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              {lang === 'ro' ? 'Pași rapizi de instalare în NinjaTrader 8:' : 'NinjaTrader 8 Quick Setup Guide:'}
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 font-medium">
              <li>
                {lang === 'ro'
                  ? 'Deschideți NinjaTrader 8 și apăsați **Tools -> New NinjaScript -> Strategy...** (sau apăsați **F5** pentru NinjaScript Editor).'
                  : 'Open NinjaTrader 8 and select **Tools -> New NinjaScript -> Strategy...** (or press **F5** to open the NinjaScript Editor).'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'Denumiți strategia: `MarketAI_NinjaTrader_Bridge` și dați click pe Next până la Finish.'
                  : 'Name the Strategy: `MarketAI_NinjaTrader_Bridge` and click Next until Finish.'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'Ștergeți conținutul generat implicit, lipiți codul C# complet de mai jos și apăsați **F5 (Compile)**. Sunetul de clopoțel confirmă compilarea fără erori.'
                  : 'Clear the default template code, paste the complete C# code below, and press **F5 (Compile)**. A chime confirms successful build.'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'Deschideți un grafic (de ex. NQ, MNQ, ES, MES, YM sau GC), faceți click dreapta -> **Strategies** și adăugați `MarketAI_NinjaTrader_Bridge`.'
                  : 'Open any chart (e.g. NQ, MNQ, ES, MES, YM, GC), right-click the chart -> **Strategies**, and select `MarketAI_NinjaTrader_Bridge`.'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'Verificați că API Key-ul dvs. este introdus, setați mărimea contractelor (Contracts Size) și bifați **Enabled = True**. Semnalele se execută automat!'
                  : 'Verify your API Key in properties, set your Contracts Size, and check **Enabled = True**. Signals will be executed automatically!'}
              </li>
            </ol>
          </div>

          {/* C# NinjaScript Code Editor Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Cpu className="w-4 h-4 text-orange-400" />
                {lang === 'ro' ? 'Cod Sursă C# NinjaScript (Zero Dependințe Externe, Standalone)' : 'C# NinjaScript Source Code (Zero External Dependencies, Standalone)'}
              </span>
              <button
                onClick={() => handleCopy(ninjaScriptCode, 'csharp')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg transition shadow-md shadow-orange-950/40 border border-orange-400/30 cursor-pointer"
              >
                {copiedSection === 'csharp' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>{lang === 'ro' ? 'Copiat!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{lang === 'ro' ? 'Copiază Codul C# NinjaScript' : 'Copy C# NinjaScript Code'}</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-[#040813] text-orange-100/90 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 border border-white/10 leading-relaxed shadow-inner">
              <pre>{ninjaScriptCode}</pre>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-[#060B18]/90 px-6 py-4 border-t border-white/10 flex items-center justify-between relative z-10">
          <span className="text-xs text-slate-400 font-medium font-mono">
            {lang === 'ro' ? 'NinjaTrader 8 Bridge v2.4 • Suport E-mini, Micro & Prop Firms' : 'NinjaTrader 8 Bridge v2.4 • E-mini, Micro & Prop Firms Support'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-medium text-xs rounded-xl transition cursor-pointer"
          >
            {lang === 'ro' ? 'Închidere' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
