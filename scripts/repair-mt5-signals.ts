import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
  console.log('Fetching users from Supabase...');
  const { data: users, error } = await supabase.from('app_users').select('*');
  if (error || !users) {
    console.error('Failed to fetch users:', error);
    return;
  }

  for (const u of users) {
    const userData = u.data || {};
    const signals = userData.signals || [];
    const openOrders = Array.isArray(userData.mt5OpenOrders) ? userData.mt5OpenOrders : [];
    const openPositions = Array.isArray(userData.mt5OpenPositions) ? userData.mt5OpenPositions : [];

    console.log(`\nChecking user ${userData.username || u.username || u.id} (MT5 #${userData.mt5AccountNumber}):`);
    console.log(` - Signals: ${signals.length}, Open Orders: ${openOrders.length}, Open Positions: ${openPositions.length}`);

    const pendingSigIds = new Set(openOrders.map((o: any) => String(o?.signalId || '')));
    const openPosMap = new Map<string, any>();
    for (const p of openPositions) {
      if (p && p.signalId) openPosMap.set(String(p.signalId), p);
    }

    let changed = false;

    for (const sig of signals) {
      const sId = String(sig.id);

      // Case 1: Actively waiting as pending limit/stop order in MT5
      if (pendingSigIds.has(sId)) {
        console.log(` [REPAIR PENDING] Signal ${sig.id} (${sig.symbol} ${sig.executionType}) is in mt5OpenOrders. Resetting to PENDING.`);
        sig.status = 'ACTIVE';
        sig.outcomeStatus = 'PENDING';
        sig.isEntryTriggered = false;
        delete sig.isManualClose;
        delete sig.closedManually;
        delete sig.realizedProfit;
        delete sig.closedAt;
        delete sig.pnl;
        changed = true;
      }
      // Case 2: Actively running open position in MT5
      else if (openPosMap.has(sId)) {
        const p = openPosMap.get(sId);
        console.log(` [REPAIR RUNNING] Signal ${sig.id} (${sig.symbol} ${sig.executionType}) is open in MT5 (Profit: $${p.profit}). Resetting to RUNNING.`);
        sig.status = 'RUNNING';
        const isBuy = (sig.type || '').toUpperCase().includes('BUY');
        const isTp1Passed = sig.targetPrice1 && (isBuy ? p.currentPrice >= sig.targetPrice1 : p.currentPrice <= sig.targetPrice1);
        if (isTp1Passed || sig.firstHitMilestone === 'TP1' || sig.outcomeStatus === 'TP1_HIT') {
          sig.outcomeStatus = 'TP1_HIT';
          sig.firstHitMilestone = 'TP1';
        } else if (!['TP1_HIT', 'TP2_HIT'].includes(sig.outcomeStatus || '')) {
          sig.outcomeStatus = 'RUNNING';
        }
        sig.isEntryTriggered = true;
        sig.liveProfit = typeof p.profit === 'number' ? p.profit : sig.liveProfit;
        delete sig.isManualClose;
        delete sig.closedManually;
        delete sig.realizedProfit;
        delete sig.closedAt;
        delete sig.pnl;
        changed = true;
      }
    }

    // Clean up erroneous journal entries for trades that are still open or pending
    if (Array.isArray(userData.tradeJournal)) {
      const initialJLen = userData.tradeJournal.length;
      userData.tradeJournal = userData.tradeJournal.filter((j: any) => {
        const linkedId = j.linkedSignalId ? String(j.linkedSignalId) : (j.id ? String(j.id).replace('sig_journal_', '') : '');
        if (linkedId && (pendingSigIds.has(linkedId) || openPosMap.has(linkedId))) {
          console.log(` [REPAIR JOURNAL] Removing prematurely created journal entry ${j.id} for active/pending signal ${linkedId}`);
          changed = true;
          return false;
        }
        return true;
      });
    }

    if (changed) {
      console.log(`Saving repaired user ${u.username || u.id} to Supabase...`);
      const { error: saveErr } = await supabase
        .from('app_users')
        .update({ data: userData })
        .eq('id', u.id);

      if (saveErr) {
        console.error(`Error saving user ${u.id}:`, saveErr);
      } else {
        console.log(`✅ Successfully repaired user ${u.username || u.id}!`);
      }
    } else {
      console.log(`No repair needed for user ${u.username || u.id}.`);
    }
  }

  console.log('\nRepair completed.');
}

repair().catch(console.error);
