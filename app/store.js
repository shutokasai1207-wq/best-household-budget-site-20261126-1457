// store.js — State, persistence and derived figures for HomeLedger.
// All state lives in one object. It is saved to localStorage on every
// change, with an in-memory fallback when storage is unavailable (for
// example in a private window). Nothing here touches the network.

import { buildDefaultState, SAMPLE_MONTH } from "./data.js";

const STORAGE_KEY = "homeledger-state-v1";

let memoryStore = null; // in-memory fallback
let storageOK = true;

function loadRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    storageOK = false;
  }
  return null;
}

function saveRaw(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageOK = true;
  } catch (e) {
    storageOK = false;
    memoryStore = state;
  }
}

export function storageAvailable() {
  return storageOK;
}

// The single store. Views read from it and call the mutators below;
// every mutator saves and notifies subscribers.
export const store = {
  state: null,
  listeners: new Set(),

  init() {
    const saved = loadRaw();
    this.state = saved && saved.version === 1 ? saved : buildDefaultState();
    if (!saved) saveRaw(this.state);
    return this.state;
  },

  resetToSample() {
    this.state = buildDefaultState();
    this.commit();
  },

  clearAll() {
    const s = this.state;
    s.transactions = [];
    s.bills = s.bills.map((b) => ({ ...b, paidMonths: [] }));
    s.goals = s.goals.map((g) => ({ ...g, saved: 0 }));
    this.commit();
  },

  commit() {
    saveRaw(this.state);
    for (const fn of this.listeners) fn(this.state);
  },

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
};

// ---------- lookups ----------

export function categoryById(state, id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function transactionsInMonth(state, month) {
  return state.transactions.filter((t) => monthOf(t.date) === month);
}

export function monthTotals(state, month) {
  let income = 0;
  let spending = 0;
  for (const t of state.transactions) {
    if (monthOf(t.date) !== month) continue;
    if (t.kind === "income") income += t.amount;
    else spending += t.amount;
  }
  return { income, spending, balance: income - spending };
}

export function spendingByCategory(state, month) {
  const map = new Map();
  for (const t of state.transactions) {
    if (t.kind !== "expense" || monthOf(t.date) !== month) continue;
    map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
  }
  return map;
}

// Running balance of a list sorted newest-first: the balance after each row.
export function withRunningBalance(txs, openingBalance) {
  let balance = openingBalance;
  const sorted = [...txs].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((t) => {
    balance += t.kind === "income" ? t.amount : -t.amount;
    return { ...t, balanceAfter: balance };
  });
}

// All months present in the data, oldest first, plus the current month.
export function availableMonths(state) {
  const set = new Set(state.transactions.map((t) => monthOf(t.date)));
  set.add(state.month);
  set.add(SAMPLE_MONTH);
  return [...set].sort();
}

export function prevMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export function formatYen(n) {
  const sign = n < 0 ? "−" : "";
  return `${sign}¥${Math.abs(Math.round(n)).toLocaleString("ja-JP")}`;
}

export function formatSignedYen(n) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}¥${Math.abs(Math.round(n)).toLocaleString("ja-JP")}`;
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ---------- mutations (all commit + persist) ----------

export function addTransaction(state, tx) {
  const row = { ...tx, id: newId("t") };
  state.transactions.push(row);
  store.commit();
  return row;
}

export function updateTransaction(state, id, patch) {
  const row = state.transactions.find((t) => t.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  store.commit();
  return row;
}

export function deleteTransaction(state, id) {
  const idx = state.transactions.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const [removed] = state.transactions.splice(idx, 1);
  store.commit();
  return removed;
}

export function restoreTransaction(state, row) {
  state.transactions.push(row);
  store.commit();
}

export function setBudget(state, categoryId, amount) {
  state.budgets[categoryId] = amount;
  store.commit();
}

export function toggleBillPaid(state, billId, month) {
  const bill = state.bills.find((b) => b.id === billId);
  if (!bill) return null;
  const i = bill.paidMonths.indexOf(month);
  if (i >= 0) bill.paidMonths.splice(i, 1);
  else bill.paidMonths.push(month);
  store.commit();
  return bill;
}

export function contributeToGoal(state, goalId, amount) {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return null;
  goal.saved = Math.max(0, Math.min(goal.target, goal.saved + amount));
  store.commit();
  return goal;
}

export function addGoal(state, goal) {
  const row = { ...goal, id: newId("g") };
  state.goals.push(row);
  store.commit();
  return row;
}

export function deleteGoal(state, goalId) {
  const idx = state.goals.findIndex((g) => g.id === goalId);
  if (idx < 0) return false;
  state.goals.splice(idx, 1);
  store.commit();
  return true;
}

export function addCategory(state, cat) {
  const row = { ...cat, id: newId("c") };
  state.categories.push(row);
  store.commit();
  return row;
}

export function updateCategory(state, id, patch) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return null;
  Object.assign(cat, patch);
  store.commit();
  return cat;
}

export function deleteCategory(state, id) {
  // Transactions of a deleted category move to "その他" (other).
  const other = state.categories.find((c) => c.id === "other");
  for (const t of state.transactions) {
    if (t.categoryId === id) t.categoryId = other ? other.id : "other";
  }
  const idx = state.categories.findIndex((c) => c.id === id);
  if (idx < 0) return false;
  state.categories.splice(idx, 1);
  delete state.budgets[id];
  store.commit();
  return true;
}

export function setCurrentMonth(state, month) {
  state.month = month;
  store.commit();
}

// ---------- CSV ----------

export function transactionsToCSV(txs) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ["日付,カテゴリ,内容,種別,金額（円）"];
  for (const t of [...txs].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const cat = categoryById(store.state, t.categoryId);
    lines.push([t.date, cat ? cat.name : t.categoryId, t.desc, t.kind === "income" ? "収入" : "支出", t.amount].map(esc).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// Parse CSV text into transaction rows. Returns { rows, errors }.
// Tolerates a UTF-8 BOM (our own export writes one) and an optional header.
export function parseTransactionsCSV(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const rows = [];
  const errors = [];
  const lines = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows, errors: ["ファイルが空です"] };
  const header = lines[0];
  const start = /日付/.test(header) ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const parts = splitCSVLine(lines[i]);
    if (parts.length < 5) {
      errors.push(`${i + 1}行目：列が足りません`);
      continue;
    }
    const [date, catName, desc, kindLabel, amountStr] = parts.map((p) => p.trim());
    const amount = Number(amountStr.replace(/[¥,]/g, ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0) {
      errors.push(`${i + 1}行目：日付か金額が正しくありません`);
      continue;
    }
    const kind = kindLabel.includes("収入") ? "income" : "expense";
    let cat = store.state.categories.find((c) => c.name === catName && c.kind === kind);
    if (!cat) {
      cat = store.state.categories.find((c) => c.name === catName);
    }
    rows.push({
      date,
      categoryId: cat ? cat.id : "other",
      desc: desc || "（内容なし）",
      amount: Math.round(amount),
      kind,
    });
  }
  return { rows, errors };
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
