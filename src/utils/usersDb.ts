import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  isSupabaseConfigured,
  fetchUsersFromSupabase,
  saveUserToSupabase,
  deleteUserFromSupabase,
  fetchInviteCodesFromSupabase,
  saveInviteCodeToSupabase,
  deleteInviteCodeFromSupabase,
} from './supabaseDb';

/**
 * Secure password hashing using Node.js scrypt with cryptographic salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password.trim(), salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies password against stored hash.
 * Supports both modern scrypt hashes and backward-compatible legacy Base64 hashes.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const trimmed = password.trim();

  // If using modern scrypt hash
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    const keyBuffer = Buffer.from(key, 'hex');
    const derived = crypto.scryptSync(trimmed, salt, 64);
    return keyBuffer.length === derived.length && crypto.timingSafeEqual(keyBuffer, derived);
  }

  // Backward compatibility: legacy base64 hash
  const legacyHash = Buffer.from(trimmed).toString('base64');
  return storedHash === legacyHash;
}

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  inviteCodeUsed: string;
  createdAt: string;
  token: string;
  tokens?: string[];
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
  mt5OpenPositions?: any[];
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
const DB_BACKUP_FILE = path.join(process.cwd(), 'users_cloud_db.json.bak');
const INVITE_CODES_FILE = path.join(process.cwd(), 'invite_codes_db.json');
const INVITE_CODES_BACKUP_FILE = path.join(process.cwd(), 'invite_codes_db.json.bak');

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

  let tokens = Array.isArray(user.tokens)
    ? user.tokens.filter((t) => t && typeof t === 'string' && t !== 'SYSTEM_ADMIN_TOKEN' && !t.startsWith('tok_usr_admin_fake'))
    : [];
  let userToken = user.token;
  if (userToken === 'SYSTEM_ADMIN_TOKEN' || (typeof userToken === 'string' && userToken.startsWith('tok_usr_admin_fake'))) {
    userToken = tokens.length > 0 ? tokens[tokens.length - 1] : '';
  }
  if (userToken && !tokens.includes(userToken)) {
    tokens.push(userToken);
  }
  if (tokens.length > 50) {
    tokens = tokens.slice(-50);
  }

  return {
    ...user,
    token: userToken || (tokens.length > 0 ? tokens[tokens.length - 1] : ''),
    tokens,
    signals: cleanSignals || [],
    deletedSignalIds: deletedIds,
    tradeJournal: cleanTradeJournal,
  };
}

function parseUsersJsonSafe(raw: string): Record<string, StoredUser> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const sanitized: Record<string, StoredUser> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object') {
          sanitized[k] = sanitizeUserObj(v as StoredUser);
        }
      }
      return sanitized;
    }
  } catch (e) {
    console.warn('⚠️ JSON parse error on users DB payload:', e);
  }
  return null;
}

function readLocalUsersFile(): Record<string, StoredUser> {
  // 1. Try reading primary DB file
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      if (data && data.trim().length > 0) {
        const parsed = parseUsersJsonSafe(data);
        if (parsed && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not read primary users_cloud_db.json:', e);
    }
  }

  // 2. Fallback to backup if primary failed or was corrupted
  if (fs.existsSync(DB_BACKUP_FILE)) {
    try {
      const bakData = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
      const bakParsed = parseUsersJsonSafe(bakData);
      if (bakParsed && Object.keys(bakParsed).length > 0) {
        console.warn('⚠️ Restored users from backup file users_cloud_db.json.bak!');
        return bakParsed;
      }
    } catch (bakErr) {
      console.warn('⚠️ Could not read users backup file:', bakErr);
    }
  }

  return {};
}

function writeAtomicJsonFile(filePath: string, backupPath: string, data: any): void {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  try {
    const jsonStr = JSON.stringify(data);

    // Write to unique temporary file first
    fs.writeFileSync(tmpPath, jsonStr, 'utf-8');

    // Create / update backup copy of current valid file before replacement
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, backupPath);
      } catch (cpErr) {
        // Non-blocking backup warning
      }
    }

    // Atomic rename replaces the target file in one POSIX operation
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (renameErr: any) {
      if (renameErr && (renameErr.code === 'EBUSY' || renameErr.code === 'EXDEV' || renameErr.code === 'EPERM')) {
        // Fallback for mounted files / docker volume mounts: copy directly over the mount point
        fs.copyFileSync(tmpPath, filePath);
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      } else {
        throw renameErr;
      }
    }
  } catch (e) {
    console.error(`❌ Atomic write failed for ${filePath}:`, e);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

// Non-blocking async variant used by the hot write path (debounced flush).
// Compact JSON + fs.promises keeps the Node event loop free so MT5 WebRequest
// polls are answered quickly (prevents WinINet read timeouts -> MT5 code 1003).
let asyncWriteInFlight: Promise<void> | null = null;
let asyncWriteQueued = false;

async function writeAtomicJsonFileAsync(filePath: string, backupPath: string, data: any): Promise<void> {
  const jsonStr = JSON.stringify(data);
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  try {
    await fs.promises.writeFile(tmpPath, jsonStr, 'utf-8');
    try {
      await fs.promises.copyFile(filePath, backupPath);
    } catch (_) {
      // primary may not exist yet; backup is best-effort
    }
    try {
      await fs.promises.rename(tmpPath, filePath);
    } catch (renameErr: any) {
      if (renameErr && (renameErr.code === 'EBUSY' || renameErr.code === 'EXDEV' || renameErr.code === 'EPERM')) {
        await fs.promises.copyFile(tmpPath, filePath);
        await fs.promises.unlink(tmpPath).catch(() => {});
      } else {
        throw renameErr;
      }
    }
  } catch (e) {
    console.error(`❌ Async atomic write failed for ${filePath}:`, e);
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}

async function writeLocalUsersFileAsync(): Promise<void> {
  // Serialize writes: if one is running, mark a follow-up and let it pick up the latest cache
  if (asyncWriteInFlight) {
    asyncWriteQueued = true;
    return asyncWriteInFlight;
  }
  asyncWriteInFlight = (async () => {
    do {
      asyncWriteQueued = false;
      const users = usersCache;
      if (!users || Object.keys(users).length === 0) break;
      await writeAtomicJsonFileAsync(DB_FILE, DB_BACKUP_FILE, users);
    } while (asyncWriteQueued);
  })().finally(() => {
    asyncWriteInFlight = null;
  });
  return asyncWriteInFlight;
}

function writeLocalUsersFile(users: Record<string, StoredUser>): void {
  if (!users || typeof users !== 'object' || Object.keys(users).length === 0) {
    // Safety guard: never overwrite DB with an empty object if cache was populated
    if (usersCache && Object.keys(usersCache).length > 0) {
      console.warn('⚠️ Aborting writeLocalUsersFile: Attempted to write empty users DB over populated cache!');
      return;
    }
  }
  writeAtomicJsonFile(DB_FILE, DB_BACKUP_FILE, users);
}

function readLocalInviteCodesFile(): Record<string, StoredInviteCode> {
  if (fs.existsSync(INVITE_CODES_FILE)) {
    try {
      const data = fs.readFileSync(INVITE_CODES_FILE, 'utf-8');
      if (data && data.trim().length > 0) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('⚠️ Could not read invite_codes_db.json:', e);
    }
  }

  if (fs.existsSync(INVITE_CODES_BACKUP_FILE)) {
    try {
      const bakData = fs.readFileSync(INVITE_CODES_BACKUP_FILE, 'utf-8');
      const parsed = JSON.parse(bakData);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {}
  }

  return {};
}

function writeLocalInviteCodesFile(codes: Record<string, StoredInviteCode>): void {
  writeAtomicJsonFile(INVITE_CODES_FILE, INVITE_CODES_BACKUP_FILE, codes);
}

/**
 * Initialize cache from Supabase (primary) and local disk (fallback)
 */
export async function initUsersDbCache(): Promise<void> {
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
      const initialAdminPass = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('hex');
      if (!process.env.ADMIN_INITIAL_PASSWORD) {
        console.log(`🔑 [SECURITY] Initial admin password generated: ${initialAdminPass} (Set ADMIN_INITIAL_PASSWORD env var to customize)`);
      }
      adminUser = {
        id: adminId,
        username: 'admin',
        passwordHash: hashPassword(initialAdminPass),
        inviteCodeUsed: 'SYSTEM_ADMIN',
        createdAt: new Date().toISOString(),
        token: `tok_${crypto.randomBytes(24).toString('hex')}`,
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
      const initialAdminPass = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('hex');
      adminUser.passwordHash = hashPassword(initialAdminPass);
      if (!process.env.ADMIN_INITIAL_PASSWORD) {
        console.log(`🔑 [SECURITY] Initial admin password generated: ${initialAdminPass}`);
      }
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

/**
 * Resolves a user by auth session token, checking primary token, multi-session tokens array,
 * and persistent system admin token. Prevents premature session invalidation across devices.
 */
export function findUserByAuthToken(
  token: string | undefined | null,
  users?: Record<string, StoredUser>
): StoredUser | null {
  if (!token) return null;
  const clean = String(token).trim();
  if (!clean || clean === 'SYSTEM_ADMIN_TOKEN' || clean.startsWith('tok_usr_admin_fake')) return null;
  const db = users || getUsersFromCache();
  for (const u of Object.values(db)) {
    if (!u) continue;
    if (u.token === clean) return u;
    if (Array.isArray(u.tokens) && u.tokens.includes(clean)) return u;
    // SECURITY: never authenticate by token prefix or hard-coded value - only exact random session tokens
  }
  return null;
}

// High-performance write debouncing & batching for disk and Supabase
const pendingPersistUsers = new Map<string, StoredUser>();
let persistTimer: NodeJS.Timeout | null = null;

async function flushPendingUsers() {
  if (pendingPersistUsers.size === 0) return;
  const toSave = Array.from(pendingPersistUsers.values());
  pendingPersistUsers.clear();

  // 1. Single non-blocking disk write for all batched users
  await writeLocalUsersFileAsync();

  // 2. Persist each user in background to Supabase without blocking web requests
  for (const user of toSave) {
    if (isSupabaseConfigured()) {
      saveUserToSupabase(user).catch((e) => console.warn('Supabase save background error:', e));
    }
  }
}

// Flush pending disk writes synchronously on process termination to prevent data loss
if (typeof process !== 'undefined') {
  const syncFlushOnExit = () => {
    if (pendingPersistUsers.size > 0) {
      pendingPersistUsers.clear();
      writeLocalUsersFile(usersCache);
    }
  };
  process.on('SIGINT', () => { syncFlushOnExit(); process.exit(0); });
  process.on('SIGTERM', () => { syncFlushOnExit(); process.exit(0); });
  process.on('beforeExit', () => { syncFlushOnExit(); });
}

export const initFirestoreCache = initUsersDbCache;

export async function saveUserToDb(user: StoredUser, immediate = false): Promise<void> {
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
export const saveUserToFirestore = saveUserToDb;

export async function deleteUserFromDb(userId: string): Promise<void> {
  delete usersCache[userId];
  writeLocalUsersFile(usersCache);

  // Delete from Supabase if configured
  if (isSupabaseConfigured()) {
    deleteUserFromSupabase(userId).catch((e) => console.warn('Supabase delete background error:', e));
  }
}
export const deleteUserFromFirestore = deleteUserFromDb;

export function getInviteCodesFromCache(): Record<string, StoredInviteCode> {
  return inviteCodesCache;
}

export async function saveInviteCodeToDb(inviteCode: StoredInviteCode): Promise<void> {
  inviteCodesCache[inviteCode.code] = inviteCode;
  writeLocalInviteCodesFile(inviteCodesCache);

  if (isSupabaseConfigured()) {
    saveInviteCodeToSupabase(inviteCode).catch((e) => console.warn('Supabase invite save background error:', e));
  }
}
export const saveInviteCodeToFirestore = saveInviteCodeToDb;

export async function deleteInviteCodeFromDb(code: string): Promise<void> {
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
export const deleteInviteCodeFromFirestore = deleteInviteCodeFromDb;
