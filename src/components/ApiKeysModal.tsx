import React, { useState } from 'react';
import {
  X,
  Key,
  CheckCircle,
  Sparkles,
  ShieldCheck,
  Lock,
  ExternalLink,
  AlertCircle,
  Loader2,
  Activity,
} from 'lucide-react';
import { UserApiKeys, UserProfile } from '../types';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: UserApiKeys;
  onSaveKeys: (keys: UserApiKeys) => void;
  lang: 'ro' | 'en';
  user?: UserProfile | null;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onSaveKeys,
  lang,
  user,
}) => {
  if (!isOpen) return null;

  const isAdmin = user?.role === 'admin' || user?.username.toLowerCase() === 'admin';
  const [geminiApiKey, setGeminiApiKey] = useState(apiKeys.geminiApiKey || '');
  const [lseKey, setLseKey] = useState(apiKeys.lseKey || 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingLse, setIsTestingLse] = useState(false);
  const [lseTestResult, setLseTestResult] = useState<{ success: boolean; message: string; usage?: any } | null>(null);

  const handleTestConnection = async () => {
    if (!geminiApiKey.trim() && !isAdmin) {
      setTestResult({
        success: false,
        message:
          lang === 'ro'
            ? 'Vă rugăm să introduceți cheia Gemini API înainte de testare.'
            : 'Please enter your Gemini API Key before testing.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const token = user?.token || localStorage.getItem('market_ai_auth_token') || '';
      const res = await fetch('/api/test-gemini-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          apiKey: geminiApiKey.trim(),
          lang,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || (lang === 'ro' ? 'Conexiunea la API a eșuat.' : 'API connection failed.'),
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message:
          lang === 'ro'
            ? 'Eroare de rețea sau serverul nu a răspuns.'
            : 'Network error or server failed to respond.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestLseConnection = async () => {
    setIsTestingLse(true);
    setLseTestResult(null);

    try {
      const res = await fetch('/api/test-lse-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: lseKey.trim(),
          lang,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLseTestResult({
          success: true,
          message: data.message,
          usage: data.usage,
        });
      } else {
        setLseTestResult({
          success: false,
          message: data.error || (lang === 'ro' ? 'Conexiunea la London Strategic Edge a eșuat.' : 'LSE connection failed.'),
        });
      }
    } catch (err) {
      setLseTestResult({
        success: false,
        message:
          lang === 'ro'
            ? 'Eroare de rețea la contactarea London Strategic Edge.'
            : 'Network error connecting to London Strategic Edge.',
      });
    } finally {
      setIsTestingLse(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKeys({
      ...apiKeys,
      geminiApiKey: geminiApiKey.trim(),
      lseKey: lseKey.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl overflow-y-auto p-2 sm:p-4 md:p-6 flex justify-center items-start sm:items-center min-h-screen py-4 sm:py-8 animate-fadeIn"
    >
      <div className="bg-gradient-to-b from-[#0A1326]/95 to-[#050914]/98 border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-6 relative my-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col shrink-0 text-slate-100 glass-specular-top overflow-hidden">
        {/* Ambient neon illumination glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 shrink-0 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white tracking-wide">
                {lang === 'ro' ? 'Configurare Chei API' : 'API Keys Configuration'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono">
                {lang === 'ro'
                  ? 'Gemini AI (Inteligență Artificială) • LSE (Cotații Live)'
                  : 'Gemini AI (Personal Key) • LSE (Live Quotes Feed)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
            title={lang === 'ro' ? 'Închide fereastra' : 'Close window'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 my-3 sm:my-4 text-xs overflow-y-auto pr-1 font-sans relative z-10">
          {/* Instructions Box */}
          <div className="bg-[#060B18]/80 border border-white/10 p-4 rounded-xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wide flex items-center gap-1.5 font-mono">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {lang === 'ro'
                    ? 'Ghid Pas cu Pas: Cum obții gratuit cheia Gemini AI'
                    : 'Step-by-Step Guide: How to get a free Gemini AI key'}
                </span>
              </h4>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition"
              >
                <span>Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ol className="space-y-2 text-[11px] text-slate-300 list-decimal list-inside leading-relaxed font-sans">
              <li>
                <strong className="text-white">
                  {lang === 'ro' ? 'Accesează Google AI Studio:' : 'Open Google AI Studio:'}
                </strong>{' '}
                {lang === 'ro'
                  ? 'Apasă pe butonul albastru de mai sus sau intră pe '
                  : 'Click the button above or visit '}
                <span className="text-cyan-300 font-mono">aistudio.google.com/app/apikey</span>.
              </li>
              <li>
                <strong className="text-white">
                  {lang === 'ro' ? 'Autentifică-te:' : 'Log in:'}
                </strong>{' '}
                {lang === 'ro'
                  ? 'Conectează-te cu contul tău Google (Gmail).'
                  : 'Sign in with your Google account (Gmail).'}
              </li>
              <li>
                <strong className="text-white">
                  {lang === 'ro' ? 'Creează Cheia:' : 'Create Key:'}
                </strong>{' '}
                {lang === 'ro'
                  ? 'Apasă pe butonul "Create API key" -> alege "Create API key in new project".'
                  : 'Click "Create API key" -> select "Create API key in new project".'}
              </li>
              <li>
                <strong className="text-white">
                  {lang === 'ro' ? 'Copiază Cheia:' : 'Copy Key:'}
                </strong>{' '}
                {lang === 'ro'
                  ? 'Copiază textul generat (începe cu "AIzaSy...").'
                  : 'Copy the generated key (starts with "AIzaSy...").'}
              </li>
              <li>
                <strong className="text-white">
                  {lang === 'ro' ? 'Salvează în Aplicație:' : 'Save in Application:'}
                </strong>{' '}
                {lang === 'ro'
                  ? 'Lipește cheia în câmpul de mai jos și apasă pe "Salvează Cheia Gemini AI".'
                  : 'Paste the key in the input below and click "Save Gemini AI Key".'}
              </li>
            </ol>

            <div className="bg-emerald-500/10 border border-emerald-500/25 p-2.5 rounded-lg text-[10px] text-emerald-300 flex items-center gap-2 backdrop-blur-xs">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {lang === 'ro'
                  ? 'Cheia este 100% gratuită, personală și este stocată în siguranță pe contul tău.'
                  : 'The key is 100% free, personal, and securely stored for your account.'}
              </span>
            </div>
          </div>

          {/* Gemini AI Custom Key Input & Connection Tester */}
          <div className="bg-[#080E1E]/80 border border-white/10 p-4 rounded-xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <label className="text-cyan-300 font-semibold flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ro' ? 'Cheie API Gemini AI (Google AI Studio):' : 'Gemini AI API Key (Google AI Studio):'}</span>
              </label>
              <span
                className={`text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                  geminiApiKey
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : isAdmin
                    ? 'text-indigo-300 bg-indigo-500/20 border-indigo-500/40'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                }`}
              >
                {geminiApiKey
                  ? lang === 'ro'
                    ? 'CHEIE INTRODUSĂ'
                    : 'KEY ADDED'
                  : isAdmin
                  ? lang === 'ro'
                    ? 'ADMIN: PRE-CONFIGURATĂ PE SERVER'
                    : 'ADMIN: PRE-CONFIGURED ON SERVER'
                  : lang === 'ro'
                  ? 'OBLIGATORIE PT UTILIZATORI'
                  : 'REQUIRED FOR USERS'}
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="password"
                placeholder={isAdmin ? 'Cheie master integrată pe server (Opțional personală)' : 'AIzaSy...'}
                value={geminiApiKey}
                onChange={(e) => {
                  setGeminiApiKey(e.target.value);
                  setTestResult(null);
                }}
                className="w-full bg-[#040813] border border-white/10 rounded-xl py-2.5 px-3 text-cyan-200 font-mono text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition placeholder:text-slate-600 shadow-inner"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-slate-400 leading-relaxed flex-1">
                  {isAdmin
                    ? lang === 'ro'
                      ? 'Contul Admin folosește cheia master Gemini integrată. Opțional poți testa sau introduce una personală.'
                      : 'Admin uses master server Gemini key. Optionally test or enter a custom key.'
                    : lang === 'ro'
                    ? 'Introduceți cheia API Gemini personală și apăsați butonul de verificare conexiune.'
                    : 'Enter your personal Gemini key and click test connection.'}
                </p>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-400/30 text-xs font-bold font-mono transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                      <span>{lang === 'ro' ? 'Se verifică...' : 'Testing...'}</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{lang === 'ro' ? 'Testează Conexiunea' : 'Test Connection'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Connection Alert Box */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition backdrop-blur-md animate-in fade-in ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {testResult.success
                      ? lang === 'ro'
                        ? '✓ Conexiune Reușită!'
                        : '✓ Connection Successful!'
                      : lang === 'ro'
                      ? '✕ Eroare Comunicare API:'
                      : '✕ API Communication Error:'}
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed font-mono">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* London Strategic Edge Live Market Feed Configuration */}
          <div className="bg-[#080E1E]/80 border border-white/10 p-4 rounded-xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <label className="text-emerald-300 font-semibold flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {lang === 'ro'
                    ? 'Cheie API London Strategic Edge (Cotații Live):'
                    : 'London Strategic Edge API Key (Live Feed):'}
                </span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>50 GB / LUNĂ</span>
                </span>
                <a
                  href="https://www.londonstrategicedge.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30 transition"
                  title="London Strategic Edge"
                >
                  <span>Portal</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="lse_live_..."
                  value={lseKey}
                  onChange={(e) => {
                    setLseKey(e.target.value);
                    setLseTestResult(null);
                  }}
                  className="w-full bg-[#040813] border border-white/10 rounded-xl py-2.5 px-3 text-emerald-300 font-mono text-xs sm:text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition placeholder:text-slate-600 shadow-inner pr-20"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLseKey('lse_live_9d965aeeefa18fa9c7225990bf4e4f4c');
                    setLseTestResult(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 hover:text-cyan-300 bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 transition cursor-pointer"
                  title={lang === 'ro' ? 'Restaurează cheia furnizată' : 'Restore provided key'}
                >
                  {lang === 'ro' ? 'Resetare' : 'Reset'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-slate-400 leading-relaxed flex-1">
                  {lang === 'ro'
                    ? 'Transmisie WebSocket ultra-rapidă (NAS100, SPX500, US30, Aur, Futures, Forex) cu fallback automat REST Vault.'
                    : 'Ultra-fast WebSocket streaming (NAS100, SPX500, US30, Gold, Futures, Forex) with automatic REST Vault fallback.'}
                </p>
                <button
                  type="button"
                  onClick={handleTestLseConnection}
                  disabled={isTestingLse}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-400/30 text-xs font-bold font-mono transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 shadow-sm self-start sm:self-auto"
                >
                  {isTestingLse ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                      <span>{lang === 'ro' ? 'Se verifică...' : 'Testing...'}</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{lang === 'ro' ? 'Testează Conexiunea LSE' : 'Test LSE Connection'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* LSE Test Connection Alert Box */}
            {lseTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition backdrop-blur-md animate-in fade-in ${
                  lseTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {lseTestResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {lseTestResult.success
                      ? lang === 'ro'
                        ? '✓ Conexiune Reușită la LSE!'
                        : '✓ LSE Connection Successful!'
                      : lang === 'ro'
                      ? '✕ Eroare Comunicare LSE:'
                      : '✕ LSE Communication Error:'}
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed font-mono">{lseTestResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Save & Close Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold transition border border-white/10 text-center cursor-pointer"
            >
              {lang === 'ro' ? 'Închide' : 'Close'}
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:via-blue-500 hover:to-cyan-500 text-white font-bold transition shadow-lg shadow-cyan-900/30 border border-cyan-400/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>{lang === 'ro' ? 'Chei Salvate cu Succes!' : 'Keys Saved Successfully!'}</span>
                </>
              ) : (
                <span>{lang === 'ro' ? 'Salvează Cheile API (Gemini & LSE)' : 'Save API Keys (Gemini & LSE)'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


