import React, { useState, useEffect } from 'react';
import { X, Terminal, Copy, Check, ShieldCheck, Cpu, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getMql5EaCode } from '../utils/mql5Template';
import { UserProfile } from '../types';

interface Mt5IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ro' | 'en';
  authToken?: string;
  user?: UserProfile | null;
}

export const Mt5IntegrationModal: React.FC<Mt5IntegrationModalProps> = ({
  isOpen,
  onClose,
  lang,
  authToken,
  user,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(
    user?.mt5ApiKey || user?.apiKeys?.mt5ApiKey || 'mt5_live_token_marketai2026'
  );
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  useEffect(() => {
    if (user?.mt5ApiKey) {
      setApiKey(user.mt5ApiKey);
    } else if (user?.apiKeys?.mt5ApiKey) {
      setApiKey(user.apiKeys.mt5ApiKey);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && authToken) {
      // Fetch user's personal MT5 API key via sync-data
      fetch('/api/user/sync-data', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.mt5ApiKey) {
            setApiKey(d.mt5ApiKey);
          } else if (d.user?.mt5ApiKey) {
            setApiKey(d.user.mt5ApiKey);
          } else if (d.apiKeys?.mt5ApiKey) {
            setApiKey(d.apiKeys.mt5ApiKey);
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
      const res = await fetch('/api/user/regenerate-mt5-key', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && data.mt5ApiKey) {
        setApiKey(data.mt5ApiKey);
      }
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const mt5Endpoint = `${currentOrigin}/api/mt5/signals`;
  const mt5UpdateEndpoint = `${currentOrigin}/api/mt5/update`;

  const mql5Code = getMql5EaCode(mt5Endpoint, mt5UpdateEndpoint, apiKey, currentOrigin);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 to-[#050914]/98 rounded-2xl shadow-2xl border border-white/15 w-full max-w-4xl overflow-hidden glass-specular-top text-slate-100 relative">
        {/* Ambient neon illumination glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#070D1A] via-indigo-950/40 to-[#070D1A] text-white p-5 flex items-center justify-between border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 shadow-inner">
              <Terminal className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {lang === 'ro' ? 'Conexiune Automată MetaTrader 5 (MT5 Bridge)' : 'MetaTrader 5 Auto-Trading Bridge'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold">
                  EA v4.50 Pro Risk
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {lang === 'ro'
                  ? 'Execuție automată semnale AI cu control strict al riscului (Daily Loss, Daily Target, Max Trades, Trailing Stop).'
                  : 'Automated AI signal execution with strict risk management (Daily Loss, Daily Target, Max Trades, Trailing Stop).'}
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

          {/* Connected MT5 Account Status Box */}
          {user?.mt5AccountNumber ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-emerald-300">
                      {lang === 'ro' ? 'Cont MT5 Conectat cu Succes' : 'MT5 Account Successfully Connected'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                      #{user.mt5AccountNumber}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    Server: <span className="font-semibold text-emerald-200">{user.mt5AccountServer || 'MT5 Live Server'}</span>
                    {user.mt5AccountCompany ? ` • ${user.mt5AccountCompany}` : ''}
                    {user.mt5AccountCurrency ? ` • Monedă: ${user.mt5AccountCurrency}` : ''}
                  </p>
                  <div className="flex items-center gap-4 mt-2 font-mono text-xs text-emerald-200">
                    <span>{lang === 'ro' ? 'Balanță:' : 'Balance:'} <strong className="text-white">${(user.accountBalance ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Equity: <strong className="text-white">${(user.equity ?? 100000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-1">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase font-mono shadow-md shadow-emerald-900/40 border border-emerald-400/30">
                  {lang === 'ro' ? 'LIVE SYNC ACTIV' : 'LIVE SYNC ACTIVE'}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {user.mt5LastConnectedAt ? `Sincronizat: ${new Date(user.mt5LastConnectedAt).toLocaleTimeString()}` : 'Conexiune Activă'}
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
                  {lang === 'ro' ? 'În Așteptare Conectare MT5...' : 'Awaiting MT5 EA Bridge Connection...'}
                </h3>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  {lang === 'ro'
                    ? 'Pentru a conecta contul tău MT5 și a afișa numărul de cont și balanța live, copiază codul MQL5 v4.00 de mai jos în MetaEditor (F4), compilează-l (F7) și atașează-l pe grafic.'
                    : 'To connect your MT5 account and display your account number and live balance, copy the MQL5 v4.00 code below into MetaEditor (F4), compile it (F7), and attach it to your chart.'}
                </p>
              </div>
            </div>
          )}

          {/* EA Code Update Notification */}
          <div className="p-3.5 rounded-xl bg-[#060B18]/80 border border-white/10 text-slate-300 flex items-start gap-2.5 backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-cyan-300 font-mono">
                {lang === 'ro' ? 'Noutăți EA v4.50 Pro Risk Engine:' : 'EA v4.50 Pro Risk Engine Highlights:'}
              </span>{' '}
              {lang === 'ro'
                ? 'Include acum calcul dinamic al mărimii lotului din % risc, oprire automată la Daily Loss & Daily Target, limită tranzacții/zi și per simbol, plus Smart Trailing Stop & Auto Break-Even sincronizate în timp real din panoul web.'
                : 'Now includes dynamic lot sizing from % risk, automatic trading halt on Daily Loss & Daily Target, max daily & symbol trade limits, plus Smart Trailing Stop & Auto Break-Even synced in real-time.'}
            </div>
          </div>
          
          {/* Endpoint & Token Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#060B18]/80 border border-white/10 p-4 rounded-xl backdrop-blur-md">
              <label className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 block mb-1">
                {lang === 'ro' ? 'Webhook Endpoint URL' : 'Webhook Endpoint URL'}
              </label>
              <div className="flex items-center gap-2 bg-[#040813] border border-white/10 rounded-lg p-2 shadow-inner">
                <input
                  type="text"
                  readOnly
                  value={mt5Endpoint}
                  className="w-full text-xs font-mono text-cyan-200 bg-transparent outline-hidden"
                />
                <button
                  onClick={() => handleCopy(mt5Endpoint, 'endpoint')}
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
                  {lang === 'ro' ? 'MT5 API Key Personal (Bearer Token)' : 'Personal MT5 API Key (Bearer Token)'}
                </label>
                {authToken && (
                  <button
                    onClick={handleRegenerateKey}
                    disabled={isRegenerating}
                    className="text-[10px] flex items-center gap-1 font-semibold font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
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

          {/* Instructions */}
          <div className="bg-[#060B18]/80 border border-white/10 rounded-xl p-4 text-slate-200 backdrop-blur-md">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-cyan-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              {lang === 'ro' ? 'Pași de configurare în MetaTrader 5:' : 'MetaTrader 5 Setup Guide:'}
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 font-medium">
              <li>
                {lang === 'ro'
                  ? 'Deschideți MetaTrader 5 și apăsați F4 pentru a deschide **MetaEditor**.'
                  : 'Open MetaTrader 5 and press F4 to launch **MetaEditor**.'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'Creați un fișier nou (`New -> Expert Advisor (template)`) și numiți-l `MarketAI_Bridge`.'
                  : 'Create a new file (`New -> Expert Advisor (template)`) and name it `MarketAI_Bridge`.'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'Ștergeți tot codul vechi și lipiți codul MQL5 v4.50 actualizat de mai jos. Apoi apăsați **Compile** (F7).'
                  : 'Clear all old code and paste the updated MQL5 v4.50 script below. Then click **Compile** (F7).'}
              </li>
              <li>
                {lang === 'ro'
                  ? 'În MT5, mergeți la **Tools -> Options -> Expert Advisors**, bifați **"Allow WebRequest for the listed URL"** și adăugați: '
                  : 'In MT5, go to **Tools -> Options -> Expert Advisors**, check **"Allow WebRequest for the listed URL"** and add: '}
                <code className="bg-[#040813] px-1.5 py-0.5 rounded border border-white/10 font-mono text-[11px] text-cyan-300">{currentOrigin}</code>
              </li>
              <li>
                {lang === 'ro'
                  ? 'Atașați Expert Advisor-ul pe graficele dorite (EURUSD, GBPUSD, USDJPY, NAS100, Gold etc.) și asigurați-vă că butonul **Algo Trading / AutoTrading** este activ (verde).'
                  : 'Attach the Expert Advisor to your charts (EURUSD, GBPUSD, USDJPY, NAS100, Gold etc.) and ensure **Algo Trading / AutoTrading** is enabled (green).'}
              </li>
            </ol>
          </div>

          {/* MQL5 Code Editor Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Cpu className="w-4 h-4 text-cyan-400" />
                {lang === 'ro' ? 'Cod Sursă MQL5 Actualizat v4.50 (Pro Risk Engine + Trailing Stop)' : 'Updated MQL5 Source Code v4.50 (Pro Risk Engine + Trailing Stop)'}
              </span>
              <button
                onClick={() => handleCopy(mql5Code, 'mql5')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg transition shadow-md shadow-cyan-900/30 border border-cyan-400/30 cursor-pointer"
              >
                {copiedSection === 'mql5' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>{lang === 'ro' ? 'Copiat!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{lang === 'ro' ? 'Copiază Codul MQL5 v4.50' : 'Copy MQL5 Code v4.50'}</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-[#040813] text-cyan-100/90 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 border border-white/10 leading-relaxed shadow-inner">
              <pre>{mql5Code}</pre>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-[#060B18]/90 px-6 py-4 border-t border-white/10 flex items-center justify-between relative z-10">
          <span className="text-xs text-slate-400 font-medium font-mono">
            {lang === 'ro' ? 'MT5 Bridge v4.50 • Execuție Automată, Control Risc & Trailing Stop' : 'MT5 Bridge v4.50 • Automated Execution, Risk Guard & Trailing Stop'}
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
