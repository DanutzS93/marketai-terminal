import fs from "fs";
import { unifyJournalEntries, getDailyJournalMap } from "../src/utils/tradeJournalUtils";

const dotenv = fs.readFileSync(".env", "utf8");
let sbUrl = "", sbKey = "";
for (const line of dotenv.split("\n")) {
  if (line.startsWith("SUPABASE_URL=")) sbUrl = line.split("=")[1].replace(/"/g, "").trim();
  if (line.startsWith("SUPABASE_KEY=")) sbKey = line.split("=")[1].replace(/"/g, "").trim();
}

if (!sbUrl || !sbKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
  process.exit(1);
}

async function run() {
  console.log("1. Fetching fresh admin record from Supabase...");
  const res = await fetch(`${sbUrl}/rest/v1/app_users?id=eq.usr_admin_001`, {
    headers: {
      "apikey": sbKey,
      "Authorization": `Bearer ${sbKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch admin from Supabase: ${res.status} ${res.statusText}`);
  }

  const rows = await res.json();
  if (!rows || rows.length === 0) {
    throw new Error("Admin user usr_admin_001 not found in Supabase");
  }

  const adminRow = rows[0];
  const data = adminRow.data || {};

  // Preserve all sensitive & live data exactly
  const tokens = data.tokens || [];
  const openPositions = data.mt5OpenPositions || [];
  const openOrders = data.mt5OpenOrders || [];
  const equity = data.equity;
  const balance = data.accountBalance;

  console.log(`Current state: ${tokens.length} active tokens, Equity: $${equity}, Balance: $${balance}, Positions: ${openPositions.length}`);

  // 1. Trade Journal Fixes & Additions
  const tradeJournal = Array.isArray(data.tradeJournal) ? [...data.tradeJournal] : [];

  // Fix Friday inverted trade
  const frTrade = tradeJournal.find((j: any) => j.id === "sig_journal_sig_1793974001794_gold");
  if (frTrade) {
    console.log("Correcting inverted PnL/RR on Friday trade sig_journal_sig_1793974001794_gold...");
    frTrade.pnl = -727.65;
    frTrade.rrAchieved = -0.7;
    frTrade.status = "LOSS";
  }

  // 2. Monday Trades
  const mondayTrades = [
    {
      id: "sig_journal_sig_1794209404503_nq_f",
      symbol: "NQ.F",
      instrumentId: "NQ_F",
      instrumentName: "Nasdaq 100 Futures",
      direction: "BUY",
      entryPrice: 26920.19,
      exitPrice: 27550.19,
      stopLoss: 26740.19,
      takeProfit: 27550.19,
      executionType: "BUY LIMIT",
      status: "WIN",
      pnl: 2227.48,
      rrAchieved: 2.1,
      outcomeLabel: "TP3 Max Hit (+$2227.48) 💎",
      date: "2026-11-09",
      time: "09:30",
      entryDate: "2026-11-09",
      entryTime: "09:30",
      closedAt: "2026-11-09T14:37:09.000Z",
      notes: "TP3 atins la 27550.19 (+$2227.48)",
      linkedSignalId: "sig_1794209404503_nq_f",
      setup: "Breakout Buy Limit la Suport (NQ.F)",
      timeframe: "1h",
      isManual: false,
      generatedAt: "2026-11-09T07:30:04.503Z",
      createdAt: "2026-11-09T07:30:04.503Z",
    },
    {
      id: "sig_journal_sig_1794209404453_gold",
      symbol: "XAU/USD",
      instrumentId: "GOLD",
      instrumentName: "Gold Spot (XAU/USD)",
      direction: "BUY",
      entryPrice: 4093.94,
      exitPrice: 4121.38,
      stopLoss: 4075.94,
      takeProfit: 4156.94,
      executionType: "BUY LIMIT",
      status: "WIN",
      pnl: 1631.94,
      rrAchieved: 1.5,
      outcomeLabel: "TP1 Securizat + BE Runner (+$1631.94) 🎯",
      date: "2026-11-09",
      time: "09:30",
      entryDate: "2026-11-09",
      entryTime: "09:30",
      closedAt: "2026-11-09T16:25:34.000Z",
      notes: "TP1 securizat + BE runner închis pe profit (+$1631.94)",
      linkedSignalId: "sig_1794209404453_gold",
      setup: "Pullback Buy Limit la Suport (XAU/USD)",
      timeframe: "1h",
      isManual: false,
      generatedAt: "2026-11-09T07:30:04.453Z",
      createdAt: "2026-11-09T07:30:04.453Z",
    },
    {
      id: "sig_journal_sig_1794239403245_nq_f",
      symbol: "NQ.F",
      instrumentId: "NQ_F",
      instrumentName: "Nasdaq 100 Futures",
      direction: "BUY",
      entryPrice: 27927.07,
      exitPrice: 27876.60,
      stopLoss: 27747.07,
      takeProfit: 28557.07,
      executionType: "BUY STOP",
      status: "LOSS",
      pnl: -301.26,
      rrAchieved: -0.3,
      outcomeLabel: "Închis Manual Pierdere (-$301.26) ✋",
      date: "2026-11-09",
      time: "17:50",
      entryDate: "2026-11-09",
      entryTime: "17:50",
      closedAt: "2026-11-09T16:25:34.000Z",
      notes: "Închis manual pe pierdere (-$301.26)",
      linkedSignalId: "sig_1794239403245_nq_f",
      setup: "Breakout Buy Stop la Rezistență (NQ.F)",
      timeframe: "1h",
      isManual: true,
      generatedAt: "2026-11-09T15:50:03.245Z",
      createdAt: "2026-11-09T15:50:03.245Z",
    },
  ];

  for (const mt of mondayTrades) {
    const existingIdx = tradeJournal.findIndex((j: any) => j.id === mt.id || j.linkedSignalId === mt.linkedSignalId);
    if (existingIdx >= 0) {
      console.log(`Updating existing entry ${mt.id}...`);
      tradeJournal[existingIdx] = { ...tradeJournal[existingIdx], ...mt };
    } else {
      console.log(`Adding Monday trade ${mt.id}...`);
      tradeJournal.push(mt);
    }
  }

  // 3. Update Signals
  const signals = Array.isArray(data.signals) ? [...data.signals] : [];
  const sGold = signals.find((s: any) => s.id === "sig_1794209404453_gold");
  if (sGold) {
    sGold.pnl = 1631.94;
    sGold.realizedProfit = 1631.94;
    sGold.status = "CLOSED";
    sGold.outcomeStatus = "MANUAL_PROFIT";
  }

  const sNq = signals.find((s: any) => s.id === "sig_1794209404503_nq_f");
  if (sNq) {
    sNq.pnl = 2227.48;
    sNq.realizedProfit = 2227.48;
    sNq.status = "CLOSED";
    sNq.outcomeStatus = "MANUAL_PROFIT";
  }

  const sNqLoss = signals.find((s: any) => s.id === "sig_1794239403245_nq_f");
  if (sNqLoss) {
    sNqLoss.pnl = -301.26;
    sNqLoss.realizedProfit = -301.26;
    sNqLoss.status = "CLOSED";
    sNqLoss.outcomeStatus = "MANUAL_LOSS";
  }

  const sGoldCancel = signals.find((s: any) => s.id === "sig_1794239403239_gold");
  if (sGoldCancel) {
    sGoldCancel.status = "CANCELLED";
    sGoldCancel.outcomeStatus = "CANCELLED";
  }

  // 4. Update data object
  const updatedData = {
    ...data,
    tradeJournal,
    signals,
    tokens, // preserved
    mt5OpenPositions: openPositions, // preserved
    mt5OpenOrders: openOrders, // preserved
    equity, // preserved
    accountBalance: balance, // preserved
    _lastPersistedTime: new Date().toISOString(),
  };

  console.log("2. Uploading patched data to Supabase usr_admin_001...");
  const patchRes = await fetch(`${sbUrl}/rest/v1/app_users?id=eq.usr_admin_001`, {
    method: "PATCH",
    headers: {
      "apikey": sbKey,
      "Authorization": `Bearer ${sbKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      data: updatedData,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Failed to patch Supabase: ${patchRes.status} ${errText}`);
  }

  console.log("✅ Supabase usr_admin_001 successfully updated!");

  // 5. Update local users_cloud_db.json
  if (fs.existsSync("users_cloud_db.json")) {
    try {
      const localDb = JSON.parse(fs.readFileSync("users_cloud_db.json", "utf8"));
      if (localDb["usr_admin_001"]) {
        localDb["usr_admin_001"].tradeJournal = tradeJournal;
        localDb["usr_admin_001"].signals = signals;
        if (localDb["usr_admin_001"].data) {
          localDb["usr_admin_001"].data.tradeJournal = tradeJournal;
          localDb["usr_admin_001"].data.signals = signals;
        }
        fs.writeFileSync("users_cloud_db.json", JSON.stringify(localDb, null, 2));
        console.log("✅ users_cloud_db.json synchronized!");
      }
    } catch (e: any) {
      console.warn("Notice: could not update users_cloud_db.json:", e.message);
    }
  }

  // 6. Validation
  const unified = unifyJournalEntries(signals, tradeJournal, undefined, updatedData);
  const daily = getDailyJournalMap(unified);
  console.log("\n📊 Rezumat Validat Jurnal Trading:");
  for (const [date, summary] of Object.entries(daily)) {
    console.log(`📅 Data: ${date} | Total RR: ${summary.totalRR}R | Total PnL: $${summary.totalPnl} | W: ${summary.winCount} | L: ${summary.lossCount} | BE: ${summary.beCount}`);
    for (const t of summary.trades) {
      console.log(`   👉 ${t.symbol} [${t.status}] RR: ${t.rrAchieved}R, PnL: $${t.pnl} | ${t.outcomeLabel}`);
    }
  }
}

run().catch((e) => {
  console.error("FATAL ERROR in patch script:", e);
  process.exit(1);
});
