import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  KeyRound,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  UserCheck,
  Copy,
  ExternalLink,
  Trash2,
  Calendar,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, InviteCodeItem } from '../types';

interface AdminCrmModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  lang: 'ro' | 'en';
}

export const AdminCrmModal: React.FC<AdminCrmModalProps> = ({
  isOpen,
  onClose,
  authToken,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'database'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Supabase status state
  const [supabaseStatus, setSupabaseStatus] = useState<{
    isConfigured: boolean;
    tablesExist?: boolean;
    tableErrorMsg?: string;
    sqlSchema: string;
    totalUsersCount: number;
    totalInviteCodesCount: number;
    hasSupabaseUrl: boolean;
    hasSupabaseKey: boolean;
  } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const fetchSupabaseStatus = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/admin/supabase-status', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch (e) {
      console.error('Error fetching Supabase status:', e);
    }
  };

  const handleMigrateToSupabase = async () => {
    if (!authToken) return;
    setMigrating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/migrate-to-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Migrare finalizată cu succes!');
        fetchSupabaseStatus();
      } else {
        setErrorMsg(data.error || 'Migrarea a eșuat. Asigurați-vă că ați creat tabelele în Supabase.');
      }
    } catch (e) {
      setErrorMsg('Eroare de rețea la migrare.');
    } finally {
      setMigrating(false);
    }
  };


  // Form state for creating invite codes
  const [newCode, setNewCode] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const [validityType, setValidityType] = useState<'1use' | '5days' | '10days' | '30days' | 'unlimited' | 'custom'>('30days');
  const [customDays, setCustomDays] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state for adding / restoring user account manually
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addDays, setAddDays] = useState(30);
  const [addInviteCode, setAddInviteCode] = useState('ADMIN_RESTORE');

  // Handle Create or Restore User
  const handleCreateOrRestoreUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername || !addPassword || !authToken) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          username: addUsername.trim(),
          password: addPassword.trim(),
          days: Number(addDays) || 30,
          inviteCode: addInviteCode.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Cont creat / restabilit cu succes în Cloud Firestore!');
        setShowAddUserModal(false);
        setAddUsername('');
        setAddPassword('');
        fetchAdminData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(data.error || 'Eroare la crearea utilizatorului.');
      }
    } catch (err) {
      setErrorMsg('Eroare de rețea.');
    } finally {
      setLoading(false);
    }
  };

  // Load Admin Data on open
  const fetchAdminData = async () => {
    if (!authToken) return;
    setLoading(true);
    setErrorMsg('');

    try {
      fetchSupabaseStatus();
      const [usersRes, invitesRes] = await Promise.all([
        fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/admin/invite-codes', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        if (Array.isArray(uData.users)) setUsers(uData.users);
      } else {
        const err = await usersRes.json();
        setErrorMsg(err.error || 'Nu s-au putut încărca utilizatorii.');
      }

      if (invitesRes.ok) {
        const iData = await invitesRes.json();
        if (Array.isArray(iData.inviteCodes)) setInviteCodes(iData.inviteCodes);
      }
    } catch (err) {
      setErrorMsg('Eroare la conectarea cu serverul admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Extending User Subscription by N days
  const handleExtendSubscription = async (userId: string, days: number = 30) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/extend-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ days }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Abonamentul utilizatorului a fost prelungit cu ${days} zile!`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || 'Eroare la prelungirea abonamentului.');
      }
    } catch (err) {
      alert('Eroare de rețea.');
    }
  };

  // Handle Toggle Block User Status
  const handleToggleBlockUser = async (userId: string, username: string) => {
    if (!authToken) return;
    const confirmText = lang === 'ro'
      ? `Sigur doriți să schimbați statusul accesului pentru ${username}?`
      : `Are you sure you want to toggle access status for ${username}?`;
    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || 'Eroare la modificarea statusului.');
      }
    } catch (err) {
      alert('Eroare de rețea.');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!authToken) return;
    if (!window.confirm(`Sunteți sigur că doriți ștergerea definitivă a utilizatorului ${username}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        setSuccessMsg(`Utilizatorul ${username} a fost șters.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || 'Eroare la ștergere.');
      }
    } catch (err) {
      alert('Eroare de rețea.');
    }
  };

  // Handle Create New Invite Code
  const handleCreateInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    let computedMaxUses: number | undefined = undefined;
    let computedValidityDays: number | undefined = undefined;

    if (validityType === '1use') {
      computedMaxUses = 1;
      computedValidityDays = undefined;
    } else if (validityType === '5days') {
      computedValidityDays = 5;
      computedMaxUses = maxUses ? parseInt(maxUses, 10) : undefined;
    } else if (validityType === '10days') {
      computedValidityDays = 10;
      computedMaxUses = maxUses ? parseInt(maxUses, 10) : undefined;
    } else if (validityType === '30days') {
      computedValidityDays = 30;
      computedMaxUses = maxUses ? parseInt(maxUses, 10) : undefined;
    } else if (validityType === 'custom') {
      computedValidityDays = customDays ? parseInt(customDays, 10) : undefined;
      computedMaxUses = maxUses ? parseInt(maxUses, 10) : undefined;
    } else if (validityType === 'unlimited') {
      computedValidityDays = undefined;
      computedMaxUses = maxUses ? parseInt(maxUses, 10) : undefined;
    }

    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          code: newCode.trim(),
          note: codeNote.trim(),
          maxUses: computedMaxUses,
          validityDays: computedValidityDays,
        }),
      });

      if (res.ok) {
        setNewCode('');
        setCodeNote('');
        setMaxUses('');
        setCustomDays('');
        setSuccessMsg('Codul de invitație a fost creat cu succes!');
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || 'Eroare la crearea codului de invitație.');
      }
    } catch (e) {
      alert('Eroare de rețea.');
    }
  };

  // Toggle Invite Code Active Status
  const handleToggleCodeStatus = async (code: string) => {
    try {
      const res = await fetch(`/api/admin/invite-codes/${encodeURIComponent(code)}/toggle-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        fetchAdminData();
      } else {
        alert('Eroare la schimbarea statusului codului.');
      }
    } catch (e) {
      alert('Eroare de rețea.');
    }
  };

  // Delete Invite Code
  const handleDeleteCode = async (code: string) => {
    if (!window.confirm(`Dorești să ștergi codul de invitație ${code}?`)) return;
    setInviteCodes((prev) => prev.filter((item) => item.code !== code));
    try {
      const res = await fetch(`/api/admin/invite-codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        fetchAdminData();
      } else {
        alert('Eroare la ștergerea codului.');
        fetchAdminData();
      }
    } catch (e) {
      alert('Eroare de rețea.');
      fetchAdminData();
    }
  };

  // Copy full invite link
  const copyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}?invite=${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Computed Stats
  const totalUsers = users.filter((u) => u.role !== 'admin').length;
  const activeSubs = users.filter((u) => u.role !== 'admin' && u.status !== 'blocked' && (u.subscriptionDaysLeft || 0) > 0).length;
  const expiredSubs = users.filter((u) => u.role !== 'admin' && (u.subscriptionDaysLeft || 0) <= 0).length;
  const blockedUsers = users.filter((u) => u.status === 'blocked').length;

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.inviteCodeUsed && u.inviteCodeUsed.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-500/50 rounded-2xl flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">ADMIN CRM & CONTROL SUBSCRIPȚII</h2>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider">
                  MASTER PANEL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestiune utilizatori, reînnoire abonamente lunare (30 zile), blocare acces neplată și generare coduri de invitație.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Abonați</span>
              <span className="text-xl font-black text-white">{totalUsers}</span>
            </div>
            <Users className="w-6 h-6 text-indigo-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Abonamente Active</span>
              <span className="text-xl font-black text-emerald-400">{activeSubs}</span>
            </div>
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Abonamente Expirate</span>
              <span className="text-xl font-black text-amber-400">{expiredSubs}</span>
            </div>
            <Clock className="w-6 h-6 text-amber-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Acces Blocat</span>
              <span className="text-xl font-black text-rose-400">{blockedUsers}</span>
            </div>
            <Ban className="w-6 h-6 text-rose-400" />
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Gestiune Utilizatori & Subscripții ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'invites'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Coduri Invitație ({inviteCodes.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('database');
                fetchSupabaseStatus();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'database'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Bază de Date Supabase</span>
            </button>
          </div>

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-xs font-bold"
            title="Reîmprospătează datele"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizează</span>
          </button>
        </div>

        {/* Success/Error Alerts */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: USERS CRM TABLE */}
        {activeTab === 'users' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Search filter & Action Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Caută utilizator după nume sau cod de invitație..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Adaugă / Restabilește Cont</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="p-3.5">Utilizator</th>
                      <th className="p-3.5">Data Înregistrării</th>
                      <th className="p-3.5">Cod Invitație</th>
                      <th className="p-3.5 text-center">Zile Rămase</th>
                      <th className="p-3.5 text-center">Status Acces</th>
                      <th className="p-3.5 text-right">Acțiuni CRM Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nu au fost găsiți utilizatori conform căutării.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isBlocked = u.status === 'blocked';
                        const daysLeft = u.subscriptionDaysLeft ?? 0;
                        const isExpired = daysLeft <= 0 && u.role !== 'admin';

                        return (
                          <tr key={u.id} className="hover:bg-slate-900/50 transition">
                            {/* Username & Role */}
                            <td className="p-3.5 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-900/50 border border-indigo-700/50 flex items-center justify-center font-bold text-indigo-300 text-xs shrink-0">
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-200">{u.username}</span>
                                    {u.role === 'admin' ? (
                                      <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border border-amber-500/30 uppercase">
                                        ADMIN
                                      </span>
                                    ) : (
                                      <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border border-indigo-400/30 uppercase">
                                        VIP
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500">{u.id}</span>
                                </div>
                              </div>
                            </td>

                            {/* Registered Date */}
                            <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                              {new Date(u.createdAt).toLocaleDateString('ro-RO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>

                            {/* Invite Code Used */}
                            <td className="p-3.5">
                              <span className="bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px] px-2 py-1 rounded">
                                {u.inviteCodeUsed || 'N/A'}
                              </span>
                            </td>

                            {/* Days Left */}
                            <td className="p-3.5 text-center">
                              {u.role === 'admin' ? (
                                <span className="text-emerald-400 font-bold">Nelimitat</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-full text-[11px] ${
                                    daysLeft > 7
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : daysLeft > 0
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>{daysLeft} zile</span>
                                </span>
                              )}
                            </td>

                            {/* Access Status */}
                            <td className="p-3.5 text-center">
                              {isBlocked ? (
                                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1">
                                  <Ban className="w-3 h-3" />
                                  <span>BLOCAT NEPLATĂ</span>
                                </span>
                              ) : isExpired ? (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>EXPIRAT</span>
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>ACTIV 30 ZILE</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              {u.role !== 'admin' && (
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Extend +30 Days Button */}
                                  <button
                                    onClick={() => handleExtendSubscription(u.id, 30)}
                                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                    title="Adaugă 30 de zile la abonament"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>+30 Zile</span>
                                  </button>

                                  {/* Block / Unblock Toggle */}
                                  <button
                                    onClick={() => handleToggleBlockUser(u.id, u.username)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border flex items-center gap-1 ${
                                      isBlocked
                                        ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40'
                                        : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                                    }`}
                                    title={isBlocked ? 'Deblochează accesul' : 'Blochează accesul în caz de neplată'}
                                  >
                                    {isBlocked ? (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Deblochează</span>
                                      </>
                                    ) : (
                                      <>
                                        <Ban className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Blochează</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Delete User Button */}
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition border border-slate-700"
                                    title="Șterge contul"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GENERATE & VIEW INVITE CODES */}
        {activeTab === 'invites' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Create Code Form */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 p-5 rounded-2xl space-y-4">
              <h3 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Generare Cod Nou de Invitație Personalizat & Setare Valabilitate</span>
              </h3>

              <form onSubmit={handleCreateInviteCode} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Cod Invitație (Ex: ION2026):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: VIP-DANUTZ"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-amber-300 font-mono text-xs uppercase focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Notă / Nume Client (Opțional):
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Pentru Alex Popa"
                      value={codeNote}
                      onChange={(e) => setCodeNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Valabilitate & Regim Folosire:
                    </label>
                    <select
                      value={validityType}
                      onChange={(e) => setValidityType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-amber-400 font-semibold text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="30days">30 Zile Valabilitate (Standard)</option>
                      <option value="10days">10 Zile Valabilitate</option>
                      <option value="5days">5 Zile Valabilitate</option>
                      <option value="1use">⚡ O Singură Folosire (Devine Inactiv Imadiat)</option>
                      <option value="unlimited">Fără Expirare (Nelimitat)</option>
                      <option value="custom">Personalizat (Setează Zile / Utilizări)</option>
                    </select>
                  </div>
                </div>

                {/* Additional inputs if custom */}
                {validityType === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Valabilitate Zile:
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 14 zile"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Limita Maximă de Utilizări:
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 5 utilizări (Gol pt. Nelimitat)"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex items-end sm:col-start-3">
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Generare Cod Personalizat</span>
                      </button>
                    </div>
                  </div>
                )}

                {validityType !== 'custom' && (
                  <div className="flex justify-end pt-2 border-t border-slate-800/60">
                    <button
                      type="submit"
                      className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>
                        {validityType === '1use'
                          ? 'Generare Cod cu O Singură Folosire'
                          : 'Generare Cod Invitație'}
                      </span>
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Existing Codes Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Lista Coduri de Invitație ({inviteCodes.length})</span>
                <span className="text-[10px] text-slate-500 font-normal">Sistemul dezactivează automat codurile când expiră sau sunt folosite</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inviteCodes.map((item) => {
                  const isMaxUsesReached = Boolean(item.maxUses && item.usesCount >= item.maxUses);
                  const isTimeExpired = Boolean(item.expiresAt && new Date(item.expiresAt).getTime() < Date.now());
                  const isInactive = item.isActive === false || isMaxUsesReached || isTimeExpired;

                  return (
                    <div
                      key={item.code}
                      className={`p-4 rounded-2xl border space-y-3 relative group transition ${
                        isInactive
                          ? 'bg-slate-950/60 border-rose-950/50 opacity-80'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                          {item.code}
                        </span>

                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded border flex items-center gap-1 ${
                            isInactive
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isInactive ? (
                            <>
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>INACTIV</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>ACTIV</span>
                            </>
                          )}
                        </span>
                      </div>

                      {item.note && (
                        <p className="text-xs text-slate-300 font-medium italic">
                          "{item.note}"
                        </p>
                      )}

                      <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-900 pt-2 font-mono">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Utilizări:</span>
                          <span className="text-white font-bold">
                            {item.usesCount} / {item.maxUses ? item.maxUses : '∞'}
                            {item.maxUses === 1 && ' (O singură folosire)'}
                          </span>
                        </div>

                        {item.validityDays && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Valabilitate:</span>
                            <span className="text-indigo-300 font-bold">{item.validityDays} zile</span>
                          </div>
                        )}

                        {item.expiresAt && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Expiră la:</span>
                            <span className={isTimeExpired ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {new Date(item.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500 gap-1">
                        <button
                          onClick={() => copyInviteLink(item.code)}
                          className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/30 transition"
                        >
                          {copiedCode === item.code ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiat!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Link</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleToggleCodeStatus(item.code)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                            item.isActive === false
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                        >
                          {item.isActive === false ? 'Activează' : 'Dezactivează'}
                        </button>

                        <button
                          onClick={() => handleDeleteCode(item.code)}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/30 transition"
                          title="Șterge codul"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUPABASE DATABASE & MIGRATION */}
        {activeTab === 'database' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Bază de Date Supabase (PostgreSQL)</h3>
                </div>
                <div className="flex items-center gap-2">
                  {supabaseStatus?.isConfigured && (
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                        supabaseStatus?.tablesExist
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          supabaseStatus?.tablesExist ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                        }`}
                      />
                      {supabaseStatus?.tablesExist ? 'Tabele Supabase Active ✓' : 'Așteaptă Creare Tabele (SQL)'}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                      supabaseStatus?.isConfigured
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {supabaseStatus?.isConfigured ? 'Conectat la Supabase' : 'Neconectat (Setați SUPABASE_URL & KEY)'}
                  </span>
                </div>
              </div>

              {!supabaseStatus?.tablesExist && supabaseStatus?.isConfigured && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Pasul 1 Necesar: Crearea Tabelelor în Supabase Dashboard</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    Credențialele Supabase sunt configurate! Pentru ca baza de date să funcționeze și să poată primi datele, deschideți panoul dumneavoastră Supabase, mergeți la <strong>SQL Editor</strong>, lipiți scriptul SQL de mai jos și apăsați <strong>Run</strong>.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-slate-300 block">Stare Credențiale Supabase</span>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>URL Supabase (SUPABASE_URL):</span>
                    <span className={supabaseStatus?.hasSupabaseUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {supabaseStatus?.hasSupabaseUrl ? 'Configurat ✓' : 'Lipsă ✗'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Cheie Anon / Service (SUPABASE_KEY):</span>
                    <span className={supabaseStatus?.hasSupabaseKey ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {supabaseStatus?.hasSupabaseKey ? 'Configurat ✓' : 'Lipsă ✗'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-slate-300 block">Înregistrări Pregătite pentru Migrare</span>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Total Utilizatori:</span>
                    <span className="text-white font-bold">{supabaseStatus?.totalUsersCount || users.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Total Coduri Invitație:</span>
                    <span className="text-white font-bold">{supabaseStatus?.totalInviteCodesCount || inviteCodes.length}</span>
                  </div>
                </div>
              </div>

              {/* Migrate Action Button */}
              <div className="pt-2 flex items-center justify-between bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-white">Migrează / Importă Toate Datele în Supabase</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mutați toți utilizatorii, abonamentele, semnalele și codurile de invitație în tabelele Supabase (`app_users` și `app_invite_codes`).
                  </p>
                </div>
                <button
                  onClick={handleMigrateToSupabase}
                  disabled={migrating || !supabaseStatus?.isConfigured}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
                  <span>{migrating ? 'Se migrează...' : 'Efectuează Migrarea Now'}</span>
                </button>
              </div>

              {/* SQL Schema Script Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    1. Script SQL pentru creare tabele în Supabase (SQL Editor):
                  </span>
                  <button
                    onClick={() => {
                      if (supabaseStatus?.sqlSchema) {
                        navigator.clipboard.writeText(supabaseStatus.sqlSchema);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 3000);
                      }
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{copiedSql ? 'Copiat!' : 'Copiază Scriptul SQL'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={supabaseStatus?.sqlSchema || ''}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-emerald-400 font-mono focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL OVERLAY FOR CREATING OR RESTORING A USER ACCOUNT */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Adaugă sau Restabilește Cont Utilizator</h3>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Creează un cont nou direct în Cloud Firestore sau restabilește un utilizator existent după resetarea sesiunii.
            </p>

            <form onSubmit={handleCreateOrRestoreUser} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nume Utilizator
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: popescu_ion"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Parolă Nouă / Restabilită
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Parola123!"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Zile Abonament
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addDays}
                    onChange={(e) => setAddDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Cod Invitație
                  </label>
                  <input
                    type="text"
                    value={addInviteCode}
                    onChange={(e) => setAddInviteCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvează în Cloud</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
