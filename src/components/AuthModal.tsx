import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserPlus, LogIn, Lock, User, KeyRound, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAuthSuccess: (user: UserProfile, token: string) => void;
  lang: 'ro' | 'en';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  lang,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Extract ?invite=... query param automatically on load
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const inviteParam = urlParams.get('invite') || urlParams.get('code');
      if (inviteParam) {
        setInviteCode(inviteParam.trim());
      }
    } catch (e) {
      // ignore
    }
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg(
        lang === 'ro'
          ? 'Vă rugăm să introduceți utilizatorul și parola.'
          : 'Please enter both username and password.'
      );
      return;
    }

    if (mode === 'register' && !inviteCode.trim()) {
      setErrorMsg(
        lang === 'ro'
          ? 'Înregistrarea este permisă doar pe bază de invitație! Introduceți codul de invitație.'
          : 'Registration is invite-only! Please enter a valid invitation code.'
      );
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          inviteCode: inviteCode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user && data.token) {
        try {
          localStorage.setItem('market_ai_auth_token', data.token);
        } catch (e) {
          console.warn('Could not save auth token to localStorage:', e);
        }
        setSuccessMsg(
          mode === 'register'
            ? (lang === 'ro' ? 'Cont creat cu succes! Sincronizare în curs...' : 'Account created! Synchronizing...')
            : (lang === 'ro' ? 'Autentificare reușită!' : 'Login successful!')
        );
        setTimeout(() => {
          onAuthSuccess(data.user, data.token);
        }, 400);
      } else {
        setErrorMsg(data.error || (lang === 'ro' ? 'A apărut o eroare la autentificare.' : 'Authentication error.'));
      }
    } catch (err: any) {
      setErrorMsg(
        lang === 'ro'
          ? 'Eroare de rețea. Verificați conexiunea și încercați din nou.'
          : 'Network error. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0A1326]/95 to-[#040813]/98 border border-white/15 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative glass-specular-top text-slate-100">
        {/* Ambient neon illumination glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10" />

        {/* Top Header Badge */}
        <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/40 to-[#0A1326]/80 p-6 border-b border-white/10 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-cyan-500/20 border border-white/20">
                Σ
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
                  MARKET<span className="text-cyan-400">AI</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wide font-mono">
                  {lang === 'ro' ? 'SISTEM PE BAZĂ DE INVITAȚIE' : 'INVITE ONLY PLATFORM'}
                </span>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {lang === 'ro'
              ? 'Conectează-te sau creează un cont securizat pe bază de invitație pentru a accesa semnalele AI sincronizate în cloud.'
              : 'Sign in or create an invite-only account to access cloud-synced AI trading signals.'}
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-[#060B18]/70 border-b border-white/10 gap-1 relative z-10">
          <button
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 text-white shadow-md shadow-indigo-950/50 border border-cyan-400/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{lang === 'ro' ? 'Înregistrare (Invitație)' : 'Register (Invite)'}</span>
          </button>

          <button
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 text-white shadow-md shadow-indigo-950/50 border border-cyan-400/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{lang === 'ro' ? 'Conectare Existenta' : 'Sign In'}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 relative z-10">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang === 'ro' ? 'Nume Utilizator / Email:' : 'Username / Email:'}</span>
            </label>
            <input
              type="text"
              required
              placeholder={lang === 'ro' ? 'nume_utilizator' : 'username'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#060B18]/90 border border-white/10 rounded-xl py-2.5 px-3.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition placeholder:text-slate-600 shadow-inner"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang === 'ro' ? 'Parolă Cont:' : 'Account Password:'}</span>
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#060B18]/90 border border-white/10 rounded-xl py-2.5 px-3.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition placeholder:text-slate-600 shadow-inner"
            />
          </div>

          {/* Invite Code Input (For Register) */}
          {mode === 'register' && (
            <div className="bg-indigo-950/40 border border-indigo-400/30 p-3.5 rounded-xl space-y-1.5 backdrop-blur-md shadow-inner">
              <label className="block text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'ro' ? 'Cod de Invitație Acces VIP:' : 'VIP Invitation Code:'}</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: TRADING2026"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full bg-[#040813] border border-amber-400/30 rounded-xl py-2 px-3 text-amber-300 font-mono text-sm uppercase focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition placeholder:text-slate-600 shadow-inner"
              />
              <p className="text-[10px] text-slate-300 leading-tight">
                {lang === 'ro'
                  ? 'Introduceți codul primit de la persoana care v-a trimis link-ul (Ex: TRADING2026 sau VIP2026).'
                  : 'Enter the invite code received from the person who shared the link (e.g., TRADING2026 or VIP2026).'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:via-blue-500 hover:to-cyan-500 text-white font-bold text-sm transition shadow-lg shadow-cyan-900/30 border border-cyan-400/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? (
              <span className="animate-pulse">{lang === 'ro' ? 'Procesare...' : 'Processing...'}</span>
            ) : mode === 'register' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{lang === 'ro' ? 'Creează Contul pe Baza de Invitație' : 'Create Account with Invite'}</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{lang === 'ro' ? 'Conectare în Cont' : 'Sign In to Account'}</span>
              </>
            )}
          </button>

          <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {lang === 'ro'
                ? 'Datele și semnalele dvs. sunt stocate și securizate în Cloud'
                : 'Your data and signals are securely synchronized in Cloud'}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
