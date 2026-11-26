// main.js — Router, forms, filters and boot for HomeLedger.
// Views render HTML; this file wires every control to the store so that
// each change saves to localStorage and re-renders the current page.

import { store, categoryById, monthLabel, prevMonth, nextMonth, formatYen,
  addTransaction, updateTransaction, deleteTransaction, restoreTransaction,
  setBudget, toggleBillPaid, contributeToGoal, addGoal, deleteGoal,
  addCategory, updateCategory, deleteCategory, setCurrentMonth,
  transactionsToCSV, parseTransactionsCSV, newId } from "./store.js";
import { renderDashboard, renderTransactions, renderBudgets, renderBills,
  renderGoals, renderReports } from "./views.js";

const viewEl = document.getElementById("view");
const toastEl = document.getElementById("toast");

// UI state that is not persisted: filters and the row being edited.
const ui = {
  filter: { category: "", kind: "", query: "", editing: null },
  lastDeleted: null,
};

function route() {
  const hash = window.location.hash || "#/";
  const page = hash.replace(/^#\/?/, "").split("?")[0] || "";
  const state = store.state;
  document.querySelectorAll(".nav-link").forEach((a) => {
    const target = a.getAttribute("href").replace(/^#\/?/, "") || "";
    a.classList.toggle("active", target === page);
    if (target === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  let html = "";
  if (page === "" || page === "dashboard") html = renderDashboard(state);
  else if (page === "transactions") html = renderTransactions(state, ui.filter);
  else if (page === "budgets") html = renderBudgets(state);
  else if (page === "bills") html = renderBills(state);
  else if (page === "goals") html = renderGoals(state);
  else if (page === "reports") html = renderReports(state);
  else html = `<section class="card"><h1>ページが見つかりません</h1><p>お探しのページはありません。<a href="#/">ダッシュボードに戻る</a></p></section>`;
  viewEl.innerHTML = html;
  afterRender(page);
  window.scrollTo(0, 0);
}

function rerender() {
  route();
}

// ---------- toast + undo ----------

let toastTimer = null;
function showToast(message, undoLabel, onUndo) {
  toastEl.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = message;
  toastEl.appendChild(span);
  if (undoLabel && onUndo) {
    const btn = document.createElement("button");
    btn.className = "btn btn-small btn-primary";
    btn.textContent = undoLabel;
    btn.addEventListener("click", () => {
      onUndo();
      hideToast();
    });
    toastEl.appendChild(btn);
  }
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}
function hideToast() {
  toastEl.hidden = true;
  toastEl.innerHTML = "";
}

// ---------- simulator ----------

function updateSimulator() {
  const form = document.getElementById("sim-form");
  if (!form) return;
  const result = document.getElementById("sim-result");
  const label = document.getElementById("sim-amount-label");
  const monthly = Number(form.monthly.value);
  const goal = store.state.goals.find((g) => g.id === form.goalId.value);
  label.textContent = formatYen(monthly);
  if (!goal) { result.textContent = ""; return; }
  const remain = Math.max(0, goal.target - goal.saved);
  if (remain <= 0) {
    result.textContent = `「${goal.name}」はすでに達成済みです。おめでとうございます！`;
    return;
  }
  const months = Math.ceil(remain / monthly);
  const now = new Date();
  const reach = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const reachLabel = `${reach.getFullYear()}年${reach.getMonth() + 1}月`;
  result.textContent = `毎月 ${formatYen(monthly)} ずつ積み立てると、あと約 ${months} か月（${reachLabel}ごろ）に「${goal.name}」へ届きます。残り ${formatYen(remain)}。`;
}

// ---------- after render: wire page-specific controls ----------

function afterRender(page) {
  if (page === "goals") updateSimulator();
}

// ---------- global event delegation ----------

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const state = store.state;

  if (action === "month-prev") setCurrentMonth(state, prevMonth(state.month));
  else if (action === "month-next") setCurrentMonth(state, nextMonth(state.month));
  else if (action === "bill-pay" || action === "bill-toggle") {
    toggleBillPaid(state, el.dataset.id, state.month);
    showToast("請求書を支払い済みにしました。");
  } else if (action === "tx-edit") {
    ui.filter.editing = state.transactions.find((t) => t.id === el.dataset.id) || null;
    rerender();
    document.getElementById("tx-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (action === "tx-cancel-edit") {
    ui.filter.editing = null;
    rerender();
  } else if (action === "tx-delete") {
    const removed = deleteTransaction(state, el.dataset.id);
    if (removed) {
      ui.lastDeleted = removed;
      showToast(`「${removed.desc}」を削除しました。`, "元に戻す", () => {
        restoreTransaction(store.state, removed);
        showToast("取引を復元しました。");
      });
    }
  } else if (action === "csv-export") {
    const csv = transactionsToCSV(state.transactions);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `homeledger-${state.month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("CSVを書き出しました。");
  } else if (action === "goal-delete") {
    if (window.confirm("この目標を削除しますか？")) deleteGoal(state, el.dataset.id);
  } else if (action === "cat-delete") {
    const cat = categoryById(state, el.dataset.id);
    if (cat && window.confirm(`カテゴリ「${cat.name}」を削除しますか？ その取引は「その他」に移動します。`)) {
      deleteCategory(state, el.dataset.id);
    }
  }
});

document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-action]");
  const state = store.state;
  if (!el) return;
  const action = el.dataset.action;

  if (action === "month-select") setCurrentMonth(state, el.value);
  else if (action === "filter-category") { ui.filter.category = el.value; rerender(); }
  else if (action === "filter-kind") { ui.filter.kind = el.value; rerender(); }
  else if (action === "budget-input") {
    const amount = Math.max(0, Math.round(Number(el.value) || 0));
    setBudget(state, el.dataset.id, amount);
    showToast("予算を保存しました。");
  } else if (action === "cat-color") {
    updateCategory(state, el.dataset.id, { color: el.value });
  } else if (action === "cat-rename") {
    const name = el.value.trim();
    if (name) updateCategory(state, el.dataset.id, { name });
    else rerender();
  }
});

document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  if (el.dataset.action === "filter-query") {
    ui.filter.query = el.value;
    // Re-render only the table part would be nicer; full re-render keeps
    // the input focused via a small trick: keep focus by id after render.
    const pos = el.selectionStart;
    rerender();
    const next = document.getElementById("filter-query");
    if (next) { next.focus(); next.setSelectionRange(pos, pos); }
  }
  if (el.id === "sim-monthly" || el.id === "sim-goal") updateSimulator();
});

// ---------- forms ----------

document.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const state = store.state;

  if (form.id === "tx-form") {
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const err = document.getElementById("tx-form-error");
    const desc = String(fd.get("desc") || "").trim();
    const date = String(fd.get("date") || "");
    if (!date || !desc || !Number.isFinite(amount) || amount <= 0) {
      err.textContent = "日付・内容・1円以上の金額をすべて入力してください。";
      err.hidden = false;
      return;
    }
    const patch = {
      date, kind: fd.get("kind"), categoryId: fd.get("categoryId"),
      desc, amount: Math.round(amount),
    };
    const editingId = form.dataset.editing;
    if (editingId) {
      updateTransaction(state, editingId, patch);
      ui.filter.editing = null;
      showToast("取引を更新しました。");
    } else {
      addTransaction(state, patch);
      showToast("取引を追加しました。");
    }
    rerender();
  } else if (form.id === "bill-form") {
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const dueDay = Math.min(31, Math.max(1, Number(fd.get("dueDay")) || 1));
    state.bills.push({
      id: newId("b"), name: String(fd.get("name")).trim(),
      amount: Math.round(amount), dueDay,
      categoryId: fd.get("categoryId"), paidMonths: [],
    });
    store.commit();
    showToast("請求書を追加しました。");
    rerender();
  } else if (form.id === "goal-form") {
    const fd = new FormData(form);
    const target = Math.max(1, Math.round(Number(fd.get("target")) || 0));
    const saved = Math.max(0, Math.min(target, Math.round(Number(fd.get("saved")) || 0)));
    addGoal(state, {
      name: String(fd.get("name")).trim(), target, saved,
      color: String(fd.get("color") || "#2e7d5b"),
    });
    showToast("目標を追加しました。");
    rerender();
  } else if (form.classList.contains("goal-contrib")) {
    const fd = new FormData(form);
    const amount = Math.round(Number(fd.get("amount")) || 0);
    if (amount <= 0) { showToast("1円以上の金額を入力してください。"); return; }
    const goal = contributeToGoal(state, form.dataset.goal, amount);
    if (goal) showToast(`「${goal.name}」に ${formatYen(amount)} 貯金しました。`);
    rerender();
  } else if (form.id === "cat-form") {
    const fd = new FormData(form);
    const name = String(fd.get("name")).trim();
    if (!name) return;
    addCategory(state, { name, kind: fd.get("kind"), color: String(fd.get("color") || "#2e7d5b") });
    showToast(`カテゴリ「${name}」を追加しました。`);
    rerender();
  }
});

// CSV import (file input change).
document.addEventListener("change", (e) => {
  if (e.target.id !== "csv-import") return;
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const { rows, errors } = parseTransactionsCSV(String(reader.result || ""));
    for (const row of rows) addTransaction(store.state, row);
    if (rows.length) showToast(`${rows.length}件の取引を取り込みました。${errors.length ? `（${errors.length}行はスキップ）` : ""}`);
    else showToast(errors.length ? `取り込めませんでした：${errors[0]}` : "取り込む行がありませんでした。");
    rerender();
  };
  reader.readAsText(file, "utf-8");
  e.target.value = "";
});

// ---------- boot ----------

// Escape dismisses the toast (and any open edit) without touching data.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideToast();
    if (ui.filter.editing) {
      ui.filter.editing = null;
      rerender();
    }
  }
});

store.init();
store.subscribe(() => rerender());
window.addEventListener("hashchange", route);
route();
