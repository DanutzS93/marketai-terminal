import fs from 'fs';
import path from 'path';
import {
  isSupabaseConfigured,
  fetchUsersFromSupabase,
  saveUserToSupabase,
  deleteUserFromSupabase,
  fetchInviteCodesFromSupabase,
  saveInviteCodeToSupabase,
  deleteInviteCodeFromSupabase,
} from './supabaseDb';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  inviteCodeUsed: string;
  createdAt: string;
  token: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'blocked';
  subscriptionExpiresAt?: string;
  signals?: any[];
  tradeJournal?: any[];
  deletedSignalIds?: string[];
  customRules?: any[];
  accountBalance?: number;
  equity?: number;
  leverage?: number;
  mt5AccountNumber?: string | number;
  mt5AccountServer?: string;
  mt5AccountCurrency?: string;
  mt5AccountCompany?: string;
  mt5LastConnectedAt?: string;
  mt5ApiKey?: string;
  ninjaTraderAccountNumber?: string | number;
  ninjaTraderAccountName?: string;
  ninjaTraderAccountCurrency?: string;
  ninjaTraderLastConnectedAt?: string;
  ninjaTraderApiKey?: string;
  riskSettings?: any;
  apiKeys?: {
    geminiApiKey?: string;
    lseKey?: string;
    mt5ApiKey?: string;
    ninjaTraderApiKey?: string;
  };
  mt5ProcessedSignalIds?: string[];
  ninjaTraderProcessedSignalIds?: string[];
}

export interface StoredInviteCode {
  code: string;
  createdByName: string;
  createdAt: string;
  usesCount: number;
  maxUses?: number;
  validityDays?: number;
  expiresAt?: string;
  isActive?: boolean;
  note?: string;
}

const DB_FILE = path.join(process.cwd(), 'users_cloud_db.json');
const INVITE_CODES_FILE = path.join(process.cwd(), 'invite_codes_db.json');

// In-memory cache synced with Supabase and local disk for fast 0ms access
let usersCache: Record<string, StoredUser> = readLocalUsersFile();
let inviteCodesCache: Record<string, StoredInviteCode> = readLocalInviteCodesFile();
let isInitialized = false;
let isInitializing = false;

function sanitizeUserObj(user: StoredUser): StoredUser {
  if (!user) return user;

  let cleanSignals = user.signals;
  if (user.signals && Array.isArray(user.signals)) {
    const deletedSet = new Set(user.deletedSignalIds || []);
    cleanSignals = user.signals
      .filter((sig) => sig && sig.id && !deletedSet.has(sig.id))
      .map((sig) => {
        const clean = { ...sig };
        const cleanStr = (s?: string) => {
          if (!s) return s;
          return s
            .replace(/\[ICT SILVER BULLET\]/gi, '[SCALP INSTITUȚIONAL]')
            .replace(/ICT Silver Bullet/gi, 'Scalp Instituțional')
            .replace(/ICT SILVER BULLET/gi, 'SCALP INSTITUȚIONAL')
            .replace(/ICT 1-Hour Window/gi, 'Fereastră de 1 oră')
            .replace(/ICT Session Window/gi, 'Fereastră de Scalp Instituțional');
        };

        if (clean.title) clean.title = cleanStr(clean.title);
        if (clean.titleRo) clean.titleRo = cleanStr(clean.titleRo);
        if (clean.titleEn) clean.titleEn = cleanStr(clean.titleEn);
        if (clean.summary) clean.summary = cleanStr(clean.summary);
        if (clean.summaryRo) clean.summaryRo = cleanStr(clean.summaryRo);
        if (clean.summaryEn) clean.summaryEn = cleanStr(clean.summaryEn);
        if (clean.macroFactors && Array.isArray(clean.macroFactors)) {
          clean.macroFactors = clean.macroFactors.map((m: string) => cleanStr(m));
        }
        if (clean.indicators && clean.indicators.volatility) {
          clean.indicators = { ...clean.indicators, volatility: cleanStr(clean.indicators.volatility) };
        }
        return clean;
      });
  }

  // Cap deletedSignalIds to most recent 150 to keep DB compact & prevent memory bloat
  let deletedIds = user.deletedSignalIds || [];
  if (Array.isArray(deletedIds) && deletedIds.length > 150) {
    deletedIds = deletedIds.slice(-150);
  }

  // Filter out any demo, dummy, or sample trades from the trade journal
  const cleanTradeJournal = (user.tradeJournal || []).filter(
    (t: any) =>
      t &&
      t.id &&
      !t.id.startsWith('sample_trade') &&
      !t.id.startsWith('dummy_') &&
      !t.id.startsWith('demo_') &&
      !String(t.id).includes('sample')
  );

  return { ...user, signals: cleanSignals || [], deletedSignalIds: deletedIds, tradeJournal: cleanTradeJournal };
}

function readLocalUsersFile(): Record<string, StoredUser> {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const sanitized: Record<string, StoredUser> = {};
      for (const [k, v] of Object.entries(parsed)) {
        sanitized[k] = sanitizeUserObj(v as StoredUser);
      }
      return sanitized;
    }
  } catch (e) {
    console.warn('⚠️ Could not read users_cloud_db.json:', e);
  }
  return {};
}

function writeLocalUsersFile(users: Record<string, StoredUser>): void {
  try {
    fs.writeFile(DB_FILE, JSON.stringify(users, null, 2), 'utf-8', (err) => {
      if (err) console.warn('⚠️ Could not write users_cloud_db.json:', err);
    });
  } catch (e) {
    console.warn('⚠️ Could not write users_cloud_db.json:', e);
  }
}

function readLocalInviteCodesFile(): Record<string, StoredInviteCode> {
  try {
    if (fs.existsSync(INVITE_CODES_FILE)) {
      const data = fs.readFileSync(INVITE_CODES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('⚠️ Could not read invite_codes_db.json:', e);
  }
  return {};
}

function writeLocalInviteCodesFile(codes: Record<string, StoredInviteCode>): void {
  try {
    fs.writeFileSync(INVITE_CODES_FILE, JSON.stringify(codes, null, 2), 'utf-8');
  } catch (e) {
    console.warn('⚠️ Could not write invite_codes_db.json:', e);
  }
}

/**
 * Initialize cache from Supabase (primary) and local disk (fallback)
 */
export async function initFirestoreCache(): Promise<void> {
  if (isInitialized) return;
  if (isInitializing) return;

  isInitializing = true;
  try {
    // 1. Read local file users as base
    const localUsers = readLocalUsersFile();
    let mergedUsers: Record<string, StoredUser> = { ...localUsers };

    // 2. Read Supabase users first if Supabase is live & configured
    if (isSupabaseConfigured()) {
      try {
        const supabaseUsers = await fetchUsersFromSupabase();
        if (supabaseUsers) {
          for (const sbUser of Object.values(supabaseUsers)) {
            if (mergedUsers[sbUser.id]) {
              mergedUsers[sbUser.id] = {
                ...mergedUsers[sbUser.id],
                ...sbUser,
                signals: sbUser.signals?.length ? sbUser.signals : mergedUsers[sbUser.id].signals,
                customRules: sbUser.customRules?.length ? sbUser.customRules : mergedUsers[sbUser.id].customRules,
                tradeJournal: sbUser.tradeJournal?.length ? sbUser.tradeJournal : mergedUsers[sbUser.id].tradeJournal,
              };
            } else {
              mergedUsers[sbUser.id] = sbUser;
            }
          }
          console.log(`✅ Supabase Database Active: Loaded ${Object.keys(supabaseUsers).length} users from Supabase!`);
        }
      } catch (err) {
        console.warn('⚠️ Supabase sync note:', err);
      }
    }

    // 3. Ensure default admin user exists and has passwordHash set
    let adminUser = Object.values(mergedUsers).find(
      (u) => u.role === 'admin' || u.username.toLowerCase() === 'admin'
    );
    if (!adminUser) {
      const adminId = 'usr_admin_001';
      adminUser = {
        id: adminId,
        username: 'admin',
        passwordHash: Buffer.from('admin2026').toString('base64'),
        inviteCodeUsed: 'SYSTEM_ADMIN',
        createdAt: new Date().toISOString(),
        token: `tok_${adminId}_${Date.now()}`,
        role: 'admin',
        status: 'active',
        subscriptionExpiresAt: '2099-12-31T23:59:59.000Z',
        signals: [],
        customRules: [],
        apiKeys: {},
        tradeJournal: [],
      };
      mergedUsers[adminId] = adminUser;
    } else if (!adminUser.passwordHash) {
      adminUser.passwordHash = Buffer.from('admin2026').toString('base64');
    }

    usersCache = mergedUsers;
    writeLocalUsersFile(mergedUsers);

    // 4. Invite Codes Synchronization
    const localCodes = readLocalInviteCodesFile();
    let mergedCodes: Record<string, StoredInviteCode> = { ...localCodes };

    if (isSupabaseConfigured()) {
      try {
        const supabaseCodes = await fetchInviteCodesFromSupabase();
        if (supabaseCodes) {
          for (const sbCode of Object.values(supabaseCodes)) {
            mergedCodes[sbCode.code] = { ...mergedCodes[sbCode.code], ...sbCode };
          }
          console.log(`✅ Loaded ${Object.keys(supabaseCodes).length} invite codes from Supabase database!`);
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch invite codes from Supabase:', err);
      }
    }

    const defaultCodes: Record<string, StoredInviteCode> = {
      TRADING2026: { code: 'TRADING2026', createdByName: 'Admin', createdAt: new Date().toISOString(), usesCount: 0, note: 'Cod Implicat Public VIP' },
      VIP2026: { code: 'VIP2026', createdByName: 'Admin', createdAt: new Date().toISOString(), usesCount: 0, note: 'Cod VIP Oferta Speciala' },
      GOLD2026: { code: 'GOLD2026', createdByName: 'Admin', createdAt: new Date().toISOString(), usesCount: 0, note: 'Cod Membri Gold' },
      ADMIN2026: { code: 'ADMIN2026', createdByName: 'System', createdAt: new Date().toISOString(), usesCount: 0, note: 'Cod Admin Acces Sistem' },
    };

    for (const [codeKey, codeObj] of Object.entries(defaultCodes)) {
      if (!mergedCodes[codeKey]) {
        mergedCodes[codeKey] = codeObj;
      }
    }

    inviteCodesCache = mergedCodes;
    writeLocalInviteCodesFile(mergedCodes);

    // Sync any missing invite codes or admin user to Supabase
    if (isSupabaseConfigured()) {
      for (const u of Object.values(mergedUsers)) {
        saveUserToSupabase(u).catch(() => {});
      }
      for (const c of Object.values(mergedCodes)) {
        saveInviteCodeToSupabase(c).catch(() => {});
      }
    }

    isInitialized = true;
    console.log(`✅ Database connected & synchronized successfully (Supabase + Local Disk)! Total users: ${Object.keys(usersCache).length}`);
  } catch (err: any) {
    console.error('❌ Database initialization error:', err);
  } finally {
    isInitializing = false;
  }
}

export function getUsersFromCache(): Record<string, StoredUser> {
  return usersCache;
}

// High-performance write debouncing & batching for disk and Supabase
const pendingPersistUsers = new Map<string, StoredUser>();
let persistTimer: NodeJS.Timeout | null = null;

async function flushPendingUsers() {
  if (pendingPersistUsers.size === 0) return;
  const toSave = Array.from(pendingPersistUsers.values());
  pendingPersistUsers.clear();

  // 1. Single disk write for all batched users
  writeLocalUsersFile(usersCache);

  // 2. Persist each user in background to Supabase without blocking web requests
  for (const user of toSave) {
    if (isSupabaseConfigured()) {
      saveUserToSupabase(user).catch((e) => console.warn('Supabase save background error:', e));
    }
  }
}

export async function saveUserToFirestore(user: StoredUser, immediate = false): Promise<void> {
  const sanitized = sanitizeUserObj(user);
  // Update in-memory cache instantaneously (0ms latency for all callers)
  usersCache[sanitized.id] = sanitized;
  pendingPersistUsers.set(sanitized.id, sanitized);

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await flushPendingUsers();
  } else {
    if (!persistTimer) {
      persistTimer = setTimeout(() => {
        persistTimer = null;
        flushPendingUsers().catch((e) => console.warn('Background flush error:', e));
      }, 1500);
    }
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  delete usersCache[userId];
  writeLocalUsersFile(usersCache);

  // Delete from Supabase if configured
  if (isSupabaseConfigured()) {
    deleteUserFromSupabase(userId).catch((e) => console.warn('Supabase delete background error:', e));
  }
}

export function getInviteCodesFromCache(): Record<string, StoredInviteCode> {
  return inviteCodesCache;
}

export async function saveInviteCodeToFirestore(inviteCode: StoredInviteCode): Promise<void> {
  inviteCodesCache[inviteCode.code] = inviteCode;
  writeLocalInviteCodesFile(inviteCodesCache);

  if (isSupabaseConfigured()) {
    saveInviteCodeToSupabase(inviteCode).catch((e) => console.warn('Supabase invite save background error:', e));
  }
}

export async function deleteInviteCodeFromFirestore(code: string): Promise<void> {
  delete inviteCodesCache[code];
  writeLocalInviteCodesFile(inviteCodesCache);

  if (isSupabaseConfigured()) {
    try {
      await deleteInviteCodeFromSupabase(code);
    } catch (e) {
      console.warn('Supabase invite delete error:', e);
    }
  }
}
