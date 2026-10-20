import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StoredUser, StoredInviteCode } from './firestoreDb';

let supabaseClient: SupabaseClient | null = null;
let lastSupabaseFailureTime = 0;
const SUPABASE_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown on network/fetch failures

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    // If in cooldown due to recent network failure, skip
    if (Date.now() - lastSupabaseFailureTime < SUPABASE_COOLDOWN_MS) {
      return null;
    }
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  // Validate URL format
  try {
    const url = new URL(supabaseUrl);
    if (!url.protocol.startsWith('http') || !url.hostname || url.hostname.includes('example.com') || url.hostname.includes('placeholder')) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    return supabaseClient;
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

function handleSupabaseNetworkError(err: any, contextMsg: string) {
  const msg = String(err?.message || err);
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
    lastSupabaseFailureTime = Date.now();
    console.warn(`⚠️ [Supabase Offline] ${contextMsg}: Network/fetch unreachable. Pausing sync for 60s.`);
  } else {
    console.warn(`⚠️ ${contextMsg}:`, msg);
  }
}

/**
 * SQL Schema for Supabase SQL Editor
 */
export const SUPABASE_SQL_SCHEMA = `-- Copiați și rulați acest SQL în Supabase -> SQL Editor:

CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TEXT,
  subscription_expires_at TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_invite_codes (
  code TEXT PRIMARY KEY,
  created_by_name TEXT,
  created_at TEXT,
  uses_count INT DEFAULT 0,
  max_uses INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activează securitatea RLS sau permisiuni de bază
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for app_users" ON public.app_users FOR ALL USING (true);
CREATE POLICY "Allow public select for app_invite_codes" ON public.app_invite_codes FOR ALL USING (true);
`;

/**
 * Check if app_users table exists in Supabase
 */
export async function checkSupabaseTablesExist(): Promise<{ tablesExist: boolean; errorMsg?: string }> {
  const client = getSupabaseClient();
  if (!client) return { tablesExist: false, errorMsg: 'Credențialele Supabase nu sunt configurate sau sunt temporar indisponibile.' };

  try {
    const { error } = await client.from('app_users').select('id').limit(1);
    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        return {
          tablesExist: false,
          errorMsg: "Tabela 'app_users' nu există încă în Supabase. Executați scriptul SQL în Supabase -> SQL Editor.",
        };
      }
      if (error.message.includes('fetch failed')) {
        lastSupabaseFailureTime = Date.now();
      }
      return { tablesExist: false, errorMsg: error.message };
    }
    return { tablesExist: true };
  } catch (err: any) {
    handleSupabaseNetworkError(err, 'Check tables exist');
    return { tablesExist: false, errorMsg: err?.message || String(err) };
  }
}

/**
 * Migrate all users and invite codes from current local cache / Firestore to Supabase
 */
export async function migrateAllDataToSupabase(
  users: Record<string, StoredUser>,
  inviteCodes: Record<string, StoredInviteCode>
): Promise<{ success: boolean; usersMigrated: number; inviteCodesMigrated: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      usersMigrated: 0,
      inviteCodesMigrated: 0,
      error: 'Supabase credentials missing or service unreachable.',
    };
  }

  // First verify if tables exist
  const tableCheck = await checkSupabaseTablesExist();
  if (!tableCheck.tablesExist) {
    return {
      success: false,
      usersMigrated: 0,
      inviteCodesMigrated: 0,
      error: tableCheck.errorMsg || 'Tabelele nu au fost create în Supabase. Rulați mai întâi scriptul SQL.',
    };
  }

  let usersMigrated = 0;
  let inviteCodesMigrated = 0;

  try {
    // 1. Upsert users
    const userEntries = Object.values(users);
    for (const u of userEntries) {
      const { error } = await client.from('app_users').upsert(
        {
          id: u.id,
          username: u.username,
          role: u.role || 'user',
          status: u.status || 'active',
          created_at: u.createdAt,
          subscription_expires_at: u.subscriptionExpiresAt || null,
          data: u,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        handleSupabaseNetworkError(error, `Migrate user ${u.username}`);
      } else {
        usersMigrated++;
      }
    }

    // 2. Upsert invite codes
    const inviteEntries = Object.values(inviteCodes);
    for (const c of inviteEntries) {
      const { error } = await client.from('app_invite_codes').upsert(
        {
          code: c.code,
          created_by_name: c.createdByName || 'Admin',
          created_at: c.createdAt,
          uses_count: c.usesCount || 0,
          max_uses: c.maxUses || 1,
          is_active: c.isActive !== false,
          data: c,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'code' }
      );

      if (error) {
        handleSupabaseNetworkError(error, `Migrate invite code ${c.code}`);
      } else {
        inviteCodesMigrated++;
      }
    }

    return {
      success: true,
      usersMigrated,
      inviteCodesMigrated,
    };
  } catch (err: any) {
    handleSupabaseNetworkError(err, 'Migration');
    return {
      success: false,
      usersMigrated,
      inviteCodesMigrated,
      error: err?.message || String(err),
    };
  }
}

/**
 * Fetch users from Supabase if configured
 */
export async function fetchUsersFromSupabase(): Promise<Record<string, StoredUser> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('app_users').select('*');
    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        console.warn(`⚠️ Supabase table 'public.app_users' does not exist yet. Please run the SQL schema in Supabase SQL Editor.`);
      } else {
        handleSupabaseNetworkError(error, 'Fetch app_users');
      }
      return null;
    }

    const result: Record<string, StoredUser> = {};
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.data) {
          result[row.id] = row.data as StoredUser;
        }
      }
    }
    return result;
  } catch (err) {
    handleSupabaseNetworkError(err, 'Fetch users');
    return null;
  }
}

/**
 * Save user to Supabase if configured
 */
export async function saveUserToSupabase(user: StoredUser): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_users').upsert(
      {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
        status: user.status || 'active',
        created_at: user.createdAt,
        subscription_expires_at: user.subscriptionExpiresAt || null,
        data: user,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        console.warn(`⚠️ Supabase table 'public.app_users' does not exist yet. Please run the SQL schema in Supabase SQL Editor.`);
      } else {
        handleSupabaseNetworkError(error, `Save user ${user.id}`);
      }
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseNetworkError(err, `Save user ${user.id}`);
    return false;
  }
}

/**
 * Delete user from Supabase if configured
 */
export async function deleteUserFromSupabase(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_users').delete().eq('id', userId);
    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        console.warn(`⚠️ Supabase table 'public.app_users' does not exist yet.`);
      } else {
        handleSupabaseNetworkError(error, `Delete user ${userId}`);
      }
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseNetworkError(err, `Delete user ${userId}`);
    return false;
  }
}

/**
 * Fetch invite codes from Supabase if configured
 */
export async function fetchInviteCodesFromSupabase(): Promise<Record<string, StoredInviteCode> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from('app_invite_codes').select('*');
    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        console.warn(`⚠️ Supabase table 'public.app_invite_codes' does not exist yet.`);
      } else {
        handleSupabaseNetworkError(error, 'Fetch app_invite_codes');
      }
      return null;
    }

    const result: Record<string, StoredInviteCode> = {};
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.data) {
          result[row.code] = row.data as StoredInviteCode;
        }
      }
    }
    return result;
  } catch (err) {
    handleSupabaseNetworkError(err, 'Fetch invite codes');
    return null;
  }
}

/**
 * Save invite code to Supabase if configured
 */
export async function saveInviteCodeToSupabase(inviteCode: StoredInviteCode): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_invite_codes').upsert(
      {
        code: inviteCode.code,
        created_by_name: inviteCode.createdByName || 'Admin',
        created_at: inviteCode.createdAt,
        uses_count: inviteCode.usesCount || 0,
        max_uses: inviteCode.maxUses || 1,
        is_active: inviteCode.isActive !== false,
        data: inviteCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'code' }
    );

    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        console.warn(`⚠️ Supabase table 'public.app_invite_codes' does not exist yet.`);
      } else {
        handleSupabaseNetworkError(error, `Save invite code ${inviteCode.code}`);
      }
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseNetworkError(err, `Save invite code ${inviteCode.code}`);
    return false;
  }
}

/**
 * Delete invite code from Supabase if configured
 */
export async function deleteInviteCodeFromSupabase(code: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('app_invite_codes').delete().eq('code', code);
    if (error) {
      if (
        error.message.includes('Could not find the table') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST301' ||
        error.message.includes('does not exist')
      ) {
        console.warn(`⚠️ Supabase table 'public.app_invite_codes' does not exist yet.`);
      } else {
        handleSupabaseNetworkError(error, `Delete invite code ${code}`);
      }
      return false;
    }
    return true;
  } catch (err) {
    handleSupabaseNetworkError(err, `Delete invite code ${code}`);
    return false;
  }
}


