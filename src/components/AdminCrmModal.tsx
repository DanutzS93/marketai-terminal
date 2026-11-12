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
import { UserProfile, InviteCodeItem, SubscriptionTier } from '../types';
import { TIER_CONFIGS } from '../utils/subscriptionTiers';

interface AdminCrmModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  lang: 'ro' | 'en';
  onUserUpdated?: (user: UserProfile) => void;
}

export const AdminCrmModal: React.FC<AdminCrmModalProps> = ({
  isOpen,
  onClose,
  authToken,
  lang,
  onUserUpdated,
}) => {
  const isRo = lang === 'ro';
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
        setSuccessMsg(data.message || (isRo ? 'Migrare finalizată cu succes!' : 'Migration completed successfully!'));
        fetchSupabaseStatus();
      } else {
        setErrorMsg(data.error || (isRo ? 'Migrarea a eșuat. Asigurați-vă că ați creat tabelele în Supabase.' : 'Migration failed. Make sure tables are created in Supabase.'));
      }
    } catch (e) {
      setErrorMsg(isRo ? 'Eroare de rețea la migrare.' : 'Network error during migration.');
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
  const [addTier, setAddTier] = useState<SubscriptionTier>('diamond');

  // Handle Set User Subscription Tier (Basic, Gold, Diamond)
  const handleChangeTier = async (userId: string, newTier: SubscriptionTier) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-tier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ tier: newTier }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, subscriptionTier: newTier } : u))
        );
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
        setSuccessMsg(isRo ? `Pachetul de acces a fost actualizat la ${newTier.toUpperCase()}!` : `Access tier updated to ${newTier.toUpperCase()}!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const err = await res.json();
        alert(err.error || (isRo ? 'Eroare la modificarea pachetului.' : 'Error changing package tier.'));
      }
    } catch (e) {
      alert(isRo ? 'Eroare de rețea la actualizarea pachetului.' : 'Network error updating tier.');
    }
  };

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
          tier: addTier,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || (isRo ? 'Cont creat / restabilit cu succes în Cloud Database!' : 'Account created / restored successfully in Cloud Database!'));
        setShowAddUserModal(false);
        setAddUsername('');
        setAddPassword('');
        fetchAdminData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(data.error || (isRo ? 'Eroare la crearea utilizatorului.' : 'Error creating user.'));
      }
    } catch (err) {
      setErrorMsg(isRo ? 'Eroare de rețea.' : 'Network error.');
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
        setErrorMsg(err.error || (isRo ? 'Nu s-au putut încărca utilizatorii.' : 'Could not load users.'));
      }

      if (invitesRes.ok) {
        const iData = await invitesRes.json();
        if (Array.isArray(iData.inviteCodes)) setInviteCodes(iData.inviteCodes);
      }
    } catch (err) {
      setErrorMsg(isRo ? 'Eroare la conectarea cu serverul admin.' : 'Error connecting to admin server.');
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
        setSuccessMsg(isRo ? `Abonamentul utilizatorului a fost prelungit cu ${days} zile!` : `User subscription extended by ${days} days!`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || (isRo ? 'Eroare la prelungirea abonamentului.' : 'Error extending subscription.'));
      }
    } catch (err) {
      alert(isRo ? 'Eroare de rețea.' : 'Network error.');
    }
  };

  // Handle Toggle Block User Status
  const handleToggleBlockUser = async (userId: string, username: string) => {
    if (!authToken) return;
    const confirmText = isRo
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
        alert(err.error || (isRo ? 'Eroare la modificarea statusului.' : 'Error changing status.'));
      }
    } catch (err) {
      alert(isRo ? 'Eroare de rețea.' : 'Network error.');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!authToken) return;
    const confirmDelete = isRo
      ? `Sunteți sigur că doriți ștergerea definitivă a utilizatorului ${username}?`
      : `Are you sure you want to permanently delete user ${username}?`;
    if (!window.confirm(confirmDelete)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        setSuccessMsg(isRo ? `Utilizatorul ${username} a fost șters.` : `User ${username} has been deleted.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || (isRo ? 'Eroare la ștergere.' : 'Error deleting user.'));
      }
    } catch (err) {
      alert(isRo ? 'Eroare de rețea.' : 'Network error.');
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
        setSuccessMsg(isRo ? 'Codul de invitație a fost creat cu succes!' : 'Invite code created successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || (isRo ? 'Eroare la crearea codului de invitație.' : 'Error creating invite code.'));
      }
    } catch (e) {
      alert(isRo ? 'Eroare de rețea.' : 'Network error.');
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
        alert(isRo ? 'Eroare la schimbarea statusului codului.' : 'Error changing code status.');
      }
    } catch (e) {
      alert(isRo ? 'Eroare de rețea.' : 'Network error.');
    }
  };

  // Delete Invite Code
  const handleDeleteCode = async (code: string) => {
    const confirmDelete = isRo
      ? `Dorești să ștergi codul de invitație ${code}?`
      : `Are you sure you want to delete invite code ${code}?`;
    if (!window.confirm(confirmDelete)) return;
    setInviteCodes((prev) => prev.filter((item) => item.code !== code));
    try {
      const res = await fetch(`/api/admin/invite-codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        fetchAdminData();
      } else {
        alert(isRo ? 'Eroare la ștergerea codului.' : 'Error deleting code.');
        fetchAdminData();
      }
    } catch (e) {
      alert(isRo ? 'Eroare de rețea.' : 'Network error.');
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
                <h2 className="text-lg font-black text-white tracking-wide">
                  {isRo ? 'ADMIN CRM & CONTROL SUBSCRIPȚII' : 'ADMIN CRM & SUBSCRIPTION CONTROL'}
                </h2>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider">
                  MASTER PANEL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRo
                  ? 'Gestiune utilizatori, reînnoire abonamente lunare (30 zile), blocare acces neplată și generare coduri de invitație.'
                  : 'User management, monthly renewal (30 days), payment access lock, and invite codes generation.'}
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isRo ? 'Total Abonați' : 'Total Users'}
              </span>
              <span className="text-xl font-black text-white">{totalUsers}</span>
            </div>
            <Users className="w-6 h-6 text-indigo-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                {isRo ? 'Abonamente Active' : 'Active Subs'}
              </span>
              <span className="text-xl font-black text-emerald-400">{activeSubs}</span>
            </div>
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                {isRo ? 'Abonamente Expirate' : 'Expired Subs'}
              </span>
              <span className="text-xl font-black text-amber-400">{expiredSubs}</span>
            </div>
            <Clock className="w-6 h-6 text-amber-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                {isRo ? 'Acces Blocat' : 'Blocked Access'}
              </span>
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
              <span>{isRo ? 'Gestiune Utilizatori & Subscripții' : 'Users & Subscriptions'} ({users.length})</span>
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
              <span>{isRo ? 'Coduri Invitație' : 'Invite Codes'} ({inviteCodes.length})</span>
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
              <span>{isRo ? 'Bază de Date Supabase' : 'Supabase Database'}</span>
            </button>
          </div>

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-xs font-bold"
            title={isRo ? 'Reîmprospătează datele' : 'Refresh data'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRo ? 'Actualizează' : 'Refresh'}</span>
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
                  placeholder={isRo ? 'Caută utilizator după nume sau cod de invitație...' : 'Search user by name or invite code...'}
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
                <span>{isRo ? 'Adaugă / Restabilește Cont' : 'Add / Restore Account'}</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="p-3.5">{isRo ? 'Utilizator' : 'User'}</th>
                      <th className="p-3.5">{isRo ? 'Data Înregistrării' : 'Registration Date'}</th>
                      <th className="p-3.5">{isRo ? 'Cod Invitație' : 'Invite Code'}</th>
                      <th className="p-3.5 text-center">{isRo ? 'Zile Rămase' : 'Days Left'}</th>
                      <th className="p-3.5 text-center">{isRo ? 'Status Acces' : 'Access Status'}</th>
                      <th className="p-3.5 text-center">{isRo ? 'Pachet Platformă' : 'Platform Tier'}</th>
                      <th className="p-3.5 text-right">{isRo ? 'Acțiuni CRM Admin' : 'Admin Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          {isRo ? 'Nu au fost găsiți utilizatori conform căutării.' : 'No users found matching search query.'}
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
                              {new Date(u.createdAt).toLocaleDateString(isRo ? 'ro-RO' : 'en-US', {
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
                                <span className="text-emerald-400 font-bold">{isRo ? 'Nelimitat' : 'Unlimited'}</span>
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
                                  <span>{daysLeft} {isRo ? 'zile' : 'days'}</span>
                                </span>
                              )}
                            </td>

                            {/* Access Status */}
                            <td className="p-3.5 text-center">
                              {isBlocked ? (
                                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1">
                                  <Ban className="w-3 h-3" />
                                  <span>{isRo ? 'BLOCAT NEPLATĂ' : 'BLOCKED'}</span>
                                </span>
                              ) : isExpired ? (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{isRo ? 'EXPIRAT' : 'EXPIRED'}</span>
                                </span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{isRo ? 'ACTIV 30 ZILE' : 'ACTIVE 30 DAYS'}</span>
                                </span>
                              )}
                            </td>

                            {/* Subscription Tier Selector */}
                            <td className="p-3.5 text-center">
                              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
                                <button
                                  onClick={() => handleChangeTier(u.id, 'basic')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                    (u.subscriptionTier || 'diamond') === 'basic'
                                      ? 'bg-slate-700 text-white shadow-sm border border-slate-500 font-extrabold'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                  title={isRo ? 'Pachet Basic (Doar semnale, jurnal, cotații, știri)' : 'Basic Package (Signals, journal, quotes, news only)'}
                                >
                                  <span>🛡️</span>
                                  <span>Basic</span>
                                </button>
                                <button
                                  onClick={() => handleChangeTier(u.id, 'gold')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                    (u.subscriptionTier || 'diamond') === 'gold'
                                      ? 'bg-amber-500/25 text-amber-300 shadow-sm border border-amber-400/40 font-extrabold'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                  title={isRo ? 'Pachet Gold (Include MT5/Ninja EA, fără Scheduler)' : 'Gold Package (Includes MT5/Ninja EA, no Scheduler)'}
                                >
                                  <span>🥇</span>
                                  <span>Gold</span>
                                </button>
                                <button
                                  onClick={() => handleChangeTier(u.id, 'diamond')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                    (u.subscriptionTier || 'diamond') === 'diamond'
                                      ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 text-cyan-200 shadow-sm border border-cyan-400/40 font-black'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                  title={isRo ? 'Pachet Diamond (Acces complet la toate funcțiile)' : 'Diamond Package (Full access to all features)'}
                                >
                                  <span>💎</span>
                                  <span>Diamond</span>
                                </button>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              {u.role !== 'admin' && (
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Extend +30 Days Button */}
                                  <button
                                    onClick={() => handleExtendSubscription(u.id, 30)}
                                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                    title={isRo ? 'Adaugă 30 de zile la abonament' : 'Add 30 days to subscription'}
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{isRo ? '+30 Zile' : '+30 Days'}</span>
                                  </button>

                                  {/* Block / Unblock Toggle */}
                                  <button
                                    onClick={() => handleToggleBlockUser(u.id, u.username)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border flex items-center gap-1 ${
                                      isBlocked
                                        ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40'
                                        : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                                    }`}
                                    title={isBlocked ? (isRo ? 'Deblochează accesul' : 'Unblock access') : (isRo ? 'Blochează accesul în caz de neplată' : 'Block access')}
                                  >
                                    {isBlocked ? (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                                        <span>{isRo ? 'Deblochează' : 'Unblock'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Ban className="w-3.5 h-3.5 text-rose-400" />
                                        <span>{isRo ? 'Blochează' : 'Block'}</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Delete User Button */}
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition border border-slate-700"
                                    title={isRo ? 'Șterge contul' : 'Delete account'}
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
                <span>{isRo ? 'Generare Cod Nou de Invitație Personalizat & Setare Valabilitate' : 'Generate Custom Invite Code & Set Expiry'}</span>
              </h3>

              <form onSubmit={handleCreateInviteCode} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isRo ? 'Cod Invitație (Ex: ION2026):' : 'Invite Code (e.g. VIP2026):'}
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
                      {isRo ? 'Notă / Nume Client (Opțional):' : 'Note / Client Name (Optional):'}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alex Popa"
                      value={codeNote}
                      onChange={(e) => setCodeNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isRo ? 'Valabilitate & Regim Folosire:' : 'Validity & Usage Terms:'}
                    </label>
                    <select
                      value={validityType}
                      onChange={(e) => setValidityType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-amber-400 font-semibold text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="30days">{isRo ? '30 Zile Valabilitate (Standard)' : '30 Days Validity (Standard)'}</option>
                      <option value="10days">{isRo ? '10 Zile Valabilitate' : '10 Days Validity'}</option>
                      <option value="5days">{isRo ? '5 Zile Valabilitate' : '5 Days Validity'}</option>
                      <option value="1use">{isRo ? '⚡ O Singură Folosire (Devine Inactiv Imediat)' : '⚡ Single Use (Expires Immediately)'}</option>
                      <option value="unlimited">{isRo ? 'Fără Expirare (Nelimitat)' : 'No Expiration (Unlimited)'}</option>
                      <option value="custom">{isRo ? 'Personalizat (Setează Zile / Utilizări)' : 'Custom (Set Days / Uses)'}</option>
                    </select>
                  </div>
                </div>

                {/* Additional inputs if custom */}
                {validityType === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isRo ? 'Valabilitate Zile:' : 'Validity Days:'}
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 14"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isRo ? 'Limita Maximă de Utilizări:' : 'Maximum Uses Limit:'}
                      </label>
                      <input
                        type="number"
                        placeholder={isRo ? 'Ex: 5 utilizări (Gol pt. Nelimitat)' : 'e.g. 5 uses (Empty for Unlimited)'}
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
                        <span>{isRo ? 'Generare Cod Personalizat' : 'Generate Custom Code'}</span>
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
                          ? (isRo ? 'Generare Cod cu O Singură Folosire' : 'Generate Single-Use Code')
                          : (isRo ? 'Generare Cod Invitație' : 'Generate Invite Code')}
                      </span>
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Existing Codes Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>{isRo ? 'Lista Coduri de Invitație' : 'Invite Codes List'} ({inviteCodes.length})</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {isRo
                    ? 'Sistemul dezactivează automat codurile când expiră sau sunt folosite'
                    : 'System automatically disables codes when expired or used'}
                </span>
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
                              <span>{isRo ? 'INACTIV' : 'INACTIVE'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{isRo ? 'ACTIV' : 'ACTIVE'}</span>
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
                          <span className="text-slate-500">{isRo ? 'Utilizări:' : 'Uses:'}</span>
                          <span className="text-white font-bold">
                            {item.usesCount} / {item.maxUses ? item.maxUses : '∞'}
                            {item.maxUses === 1 && (isRo ? ' (O singură folosire)' : ' (Single use)')}
                          </span>
                        </div>

                        {item.validityDays && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">{isRo ? 'Valabilitate:' : 'Validity:'}</span>
                            <span className="text-indigo-300 font-bold">{item.validityDays} {isRo ? 'zile' : 'days'}</span>
                          </div>
                        )}

                        {item.expiresAt && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">{isRo ? 'Expiră la:' : 'Expires at:'}</span>
                            <span className={isTimeExpired ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {new Date(item.expiresAt).toLocaleDateString(isRo ? 'ro-RO' : 'en-US')}
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
                              <span className="text-emerald-400">{isRo ? 'Copiat!' : 'Copied!'}</span>
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
                          {item.isActive === false ? (isRo ? 'Activează' : 'Activate') : (isRo ? 'Dezactivează' : 'Deactivate')}
                        </button>

                        <button
                          onClick={() => handleDeleteCode(item.code)}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/30 transition"
                          title={isRo ? 'Șterge codul' : 'Delete code'}
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
                  <h3 className="text-sm font-bold text-white">
                    {isRo ? 'Bază de Date Supabase (PostgreSQL)' : 'Supabase Database (PostgreSQL)'}
                  </h3>
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
                      {supabaseStatus?.tablesExist
                        ? (isRo ? 'Tabele Supabase Active ✓' : 'Supabase Tables Active ✓')
                        : (isRo ? 'Așteaptă Creare Tabele (SQL)' : 'Awaiting Tables Creation (SQL)')}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                      supabaseStatus?.isConfigured
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {supabaseStatus?.isConfigured
                      ? (isRo ? 'Conectat la Supabase' : 'Connected to Supabase')
                      : (isRo ? 'Neconectat (Setați SUPABASE_URL & KEY)' : 'Disconnected (Set SUPABASE_URL & KEY)')}
                  </span>
                </div>
              </div>

              {!supabaseStatus?.tablesExist && supabaseStatus?.isConfigured && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{isRo ? 'Pasul 1 Necesar: Crearea Tabelelor în Supabase Dashboard' : 'Required Step 1: Create Tables in Supabase Dashboard'}</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    {isRo
                      ? 'Credențialele Supabase sunt configurate! Pentru ca baza de date să funcționeze și să poată primi datele, deschideți panoul dumneavoastră Supabase, mergeți la SQL Editor, lipiți scriptul SQL de mai jos și apăsați Run.'
                      : 'Supabase credentials are configured! In your Supabase dashboard, navigate to SQL Editor, paste the SQL schema below and click Run.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-slate-300 block">
                    {isRo ? 'Stare Credențiale Supabase' : 'Supabase Credentials Status'}
                  </span>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>URL Supabase (SUPABASE_URL):</span>
                    <span className={supabaseStatus?.hasSupabaseUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {supabaseStatus?.hasSupabaseUrl ? (isRo ? 'Configurat ✓' : 'Configured ✓') : (isRo ? 'Lipsă ✗' : 'Missing ✗')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Cheie Anon / Service (SUPABASE_KEY):</span>
                    <span className={supabaseStatus?.hasSupabaseKey ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {supabaseStatus?.hasSupabaseKey ? (isRo ? 'Configurat ✓' : 'Configured ✓') : (isRo ? 'Lipsă ✗' : 'Missing ✗')}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-slate-300 block">
                    {isRo ? 'Înregistrări Pregătite pentru Migrare' : 'Records Ready for Migration'}
                  </span>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>{isRo ? 'Total Utilizatori:' : 'Total Users:'}</span>
                    <span className="text-white font-bold">{supabaseStatus?.totalUsersCount || users.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>{isRo ? 'Total Coduri Invitație:' : 'Total Invite Codes:'}</span>
                    <span className="text-white font-bold">{supabaseStatus?.totalInviteCodesCount || inviteCodes.length}</span>
                  </div>
                </div>
              </div>

              {/* Migrate Action Button */}
              <div className="pt-2 flex items-center justify-between bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isRo ? 'Migrează / Importă Toate Datele în Supabase' : 'Migrate / Import All Data into Supabase'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isRo
                      ? 'Mutați toți utilizatorii, abonamentele, semnalele și codurile de invitație în tabelele Supabase (app_users și app_invite_codes).'
                      : 'Move all users, subscriptions, signals, and invite codes into Supabase tables (app_users & app_invite_codes).'}
                  </p>
                </div>
                <button
                  onClick={handleMigrateToSupabase}
                  disabled={migrating || !supabaseStatus?.isConfigured}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
                  <span>{migrating ? (isRo ? 'Se migrează...' : 'Migrating...') : (isRo ? 'Efectuează Migrarea' : 'Run Migration')}</span>
                </button>
              </div>

              {/* SQL Schema Script Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    {isRo ? '1. Script SQL pentru creare tabele în Supabase (SQL Editor):' : '1. SQL Script for creating tables in Supabase (SQL Editor):'}
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
                    <span>{copiedSql ? (isRo ? 'Copiat!' : 'Copied!') : (isRo ? 'Copiază Scriptul SQL' : 'Copy SQL Script')}</span>
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
                <h3 className="text-sm font-bold text-white">
                  {isRo ? 'Adaugă sau Restabilește Cont Utilizator' : 'Add or Restore User Account'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {isRo
                ? 'Creează un cont nou direct în Cloud Database sau restabilește un utilizator existent după resetarea sesiunii.'
                : 'Create a new account directly in Cloud DB or restore an existing user account.'}
            </p>

            <form onSubmit={handleCreateOrRestoreUser} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  {isRo ? 'Nume Utilizator' : 'Username'}
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
                  {isRo ? 'Parolă Nouă / Restabilită' : 'New / Restored Password'}
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
                    {isRo ? 'Zile Abonament' : 'Subscription Days'}
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
                    {isRo ? 'Cod Invitație' : 'Invite Code'}
                  </label>
                  <input
                    type="text"
                    value={addInviteCode}
                    onChange={(e) => setAddInviteCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                  {isRo ? 'Pachet Acces Platformă' : 'Platform Access Tier'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddTier('basic')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      addTier === 'basic'
                        ? 'bg-slate-700 text-white border-slate-500 shadow-md font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>🛡️</span>
                    <span>Basic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTier('gold')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      addTier === 'gold'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-md font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>🥇</span>
                    <span>Gold</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTier('diamond')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      addTier === 'diamond'
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 shadow-md font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>💎</span>
                    <span>Diamond</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  {isRo ? 'Anulează' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRo ? 'Salvează în Cloud' : 'Save to Cloud'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
