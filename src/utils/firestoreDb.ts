import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  disableNetwork,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import firebaseConfigData from '../../firebase-applet-config.json';
import {
  saveUserToSupabase,
  deleteUserFromSupabase,
  fetchUsersFromSupabase,
  saveInviteCodeToSupabase,
  deleteInviteCodeFromSupabase,
  fetchInviteCodesFromSupabase,
  isSupabaseConfigured,
} from './supabaseDb';

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfigData) : getApp();

export const firestoreDb = firebaseConfigData.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(firebaseApp);

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

// In-memory cache synced with Firestore for fast synchronous access
let usersCache: Record<string, StoredUser> = readLocalUsersFile();
let inviteCodesCache: Record<string, StoredInviteCode> = readLocalInviteCodesFile();
let isInitialized = false;
let isInitializing = false;
let isQuotaExhausted = false;

function withTimeout<T>(promise: Promise<T>, ms: number = 3000, fallbackName: string = 'Firestore'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${fallbackName} request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

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

  return { ...user, signals: cleanSignals || [], tradeJournal: cleanTradeJournal };
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
    const sanitized: Record<string, StoredUser> = {};
    for (const [k, v] of Object.entries(users)) {
      sanitized[k] = sanitizeUserObj(v as StoredUser);
    }
    fs.writeFile(DB_FILE, JSON.stringify(sanitized), 'utf-8', (err) => {
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

export async function initFirestoreCache(): Promise<void> {
  if (isInitialized) return;
  if (isInitializing) {
    return;
  }

  isInitializing = true;
  try {
    // 1. Read local file users as base
    const localUsers = readLocalUsersFile();
    let mergedUsers: Record<string, StoredUser> = { ...localUsers };

    // 1.5. Read Supabase users first if Supabase is live & configured
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
    } else if (!isQuotaExhausted) {
      // 2. Read Firestore users only if Supabase is not configured
      try {
        const usersSnap = await withTimeout(getDocs(collection(firestoreDb, 'users')), 2000, 'getDocs(users)');
        usersSnap.forEach((docSnap) => {
          const fsUser = docSnap.data() as StoredUser;
          if (mergedUsers[fsUser.id]) {
            mergedUsers[fsUser.id] = {
              ...mergedUsers[fsUser.id],
              ...fsUser,
              signals: fsUser.signals?.length ? fsUser.signals : mergedUsers[fsUser.id].signals,
              customRules: fsUser.customRules?.length ? fsUser.customRules : mergedUsers[fsUser.id].customRules,
            };
          } else {
            mergedUsers[fsUser.id] = fsUser;
          }
        });
      } catch (err: any) {
        isQuotaExhausted = true;
        disableNetwork(firestoreDb).catch(() => {});
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
      };
      mergedUsers[adminId] = adminUser;
    } else if (!adminUser.passwordHash) {
      adminUser.passwordHash = Buffer.from('admin2026').toString('base64');
    }

    usersCache = mergedUsers;
    writeLocalUsersFile(mergedUsers);

    // Sync any missing local users to Firestore in background
    if (!isQuotaExhausted) {
      for (const u of Object.values(mergedUsers)) {
        try {
          await withTimeout(setDoc(doc(firestoreDb, 'users', u.id), u), 1500, `setDoc(user ${u.id})`);
        } catch (e: any) {
          if (String(e?.message || e).includes('RESOURCE_EXHAUSTED')) {
            isQuotaExhausted = true;
            disableNetwork(firestoreDb).catch(() => {});
            break;
          }
        }
      }
    }

    // 4. Invite Codes Synchronization
    const localCodes = readLocalInviteCodesFile();
    let mergedCodes: Record<string, StoredInviteCode> = { ...localCodes };

    if (!isQuotaExhausted) {
      try {
        const codesSnap = await withTimeout(getDocs(collection(firestoreDb, 'inviteCodes')), 3000, 'getDocs(inviteCodes)');
        codesSnap.forEach((docSnap) => {
          const fsCode = docSnap.data() as StoredInviteCode;
          mergedCodes[fsCode.code] = { ...mergedCodes[fsCode.code], ...fsCode };
        });
      } catch (err: any) {
        if (String(err?.message || err).includes('RESOURCE_EXHAUSTED')) {
          isQuotaExhausted = true;
          disableNetwork(firestoreDb).catch(() => {});
        }
      }
    }

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

    if (!isQuotaExhausted) {
      for (const codeObj of Object.values(mergedCodes)) {
        try {
          await withTimeout(setDoc(doc(firestoreDb, 'inviteCodes', codeObj.code), codeObj), 1500, `setDoc(invite ${codeObj.code})`);
        } catch (e: any) {
          if (String(e?.message || e).includes('RESOURCE_EXHAUSTED')) {
            isQuotaExhausted = true;
            disableNetwork(firestoreDb).catch(() => {});
            break;
          }
        }
      }
    }

    isInitialized = true;
    console.log(`✅ Firestore database connected & synchronized successfully! Total users: ${Object.keys(usersCache).length}`);
  } catch (err: any) {
    console.error('❌ Firestore initialization error:', err);
  } finally {
    isInitializing = false;
  }
}

export function getUsersFromCache(): Record<string, StoredUser> {
  return usersCache;
}

// High-performance write debouncing & batching for disk and cloud
const pendingPersistUsers = new Map<string, StoredUser>();
let persistTimer: NodeJS.Timeout | null = null;

async function flushPendingUsers() {
  if (pendingPersistUsers.size === 0) return;
  const toSave = Array.from(pendingPersistUsers.values());
  pendingPersistUsers.clear();

  // 1. Single asynchronous disk write for all batched users
  writeLocalUsersFile(usersCache);

  // 2. Persist each user in background without blocking web requests
  for (const user of toSave) {
    if (isSupabaseConfigured()) {
      saveUserToSupabase(user).catch((e) => console.warn('Supabase save background error:', e));
    }

    if (!isQuotaExhausted) {
      try {
        const cleanUser = JSON.parse(JSON.stringify(user));
        await withTimeout(setDoc(doc(firestoreDb, 'users', user.id), cleanUser), 2000, `setDoc(user ${user.id})`);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || msg.includes('timed out')) {
          isQuotaExhausted = true;
          disableNetwork(firestoreDb).catch(() => {});
          console.warn(`[Firestore Offline/Timeout] Daily write limit or timeout reached for user ${user.id}. Stored in local disk & Supabase.`);
          break;
        }
      }
    }
  }
}

export async function saveUserToFirestore(user: StoredUser, immediate = false): Promise<void> {
  // Update in-memory cache instantaneously (0ms latency for all callers)
  usersCache[user.id] = user;
  pendingPersistUsers.set(user.id, user);

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
      }, 300);
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

  if (isQuotaExhausted) return;
  try {
    await withTimeout(deleteDoc(doc(firestoreDb, 'users', userId)), 2000, `deleteDoc(user ${userId})`);
    console.log(`✅ User ${userId} deleted from Firestore!`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || msg.includes('timed out')) {
      isQuotaExhausted = true;
      disableNetwork(firestoreDb).catch(() => {});
      console.warn(`[Firestore Offline/Timeout] Daily write limit or timeout reached for user ${userId}. Removed from local disk & Supabase.`);
      return;
    }
    console.warn(`⚠️ Could not delete user ${userId} from Firestore:`, msg);
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

  if (isQuotaExhausted) return;
  try {
    await withTimeout(setDoc(doc(firestoreDb, 'inviteCodes', inviteCode.code), inviteCode), 2000, `setDoc(invite ${inviteCode.code})`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || msg.includes('timed out')) {
      isQuotaExhausted = true;
      disableNetwork(firestoreDb).catch(() => {});
      console.warn(`[Firestore Offline/Timeout] Daily write limit or timeout reached for invite code ${inviteCode.code}. Stored in local disk.`);
      return;
    }
    console.warn(`⚠️ Could not save invite code ${inviteCode.code} to Firestore:`, msg);
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

  if (isQuotaExhausted) return;
  try {
    await withTimeout(deleteDoc(doc(firestoreDb, 'inviteCodes', code)), 2000, `deleteDoc(invite ${code})`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit exceeded') || msg.includes('timed out')) {
      isQuotaExhausted = true;
      disableNetwork(firestoreDb).catch(() => {});
      console.warn(`[Firestore Offline/Timeout] Daily write limit or timeout reached for invite code ${code}. Removed from local disk.`);
      return;
    }
    console.warn(`⚠️ Could not delete invite code ${code} from Firestore:`, msg);
  }
}

