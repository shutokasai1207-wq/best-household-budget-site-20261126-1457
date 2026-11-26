// views.js — Page renderers for HomeLedger (part 1: dashboard, transactions).
// Each function takes the store state and returns an HTML string.
// Event wiring lives in main.js; these functions only describe the page.

import {
  categoryById, monthTotals, spendingByCategory, monthLabel, prevMonth,
  nextMonth, formatYen, formatSignedYen, withRunningBalance, availableMonths,
} from "./store.js";
import { donutChart, budgetBars, trendChart, progressBar } from "./charts.js";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function monthNav(state) {
  const months = availableMonths(state);
  const opts = months.map((m) => `<option value="${m}" ${m === state.month ? "selected" : ""}>${monthLabel(m)}</option>`).join("");
  return `<div class="month-nav" role="group" aria-label="表示する月">
    <button class="btn btn-ghost" data-action="month-prev" aria-label="前の月">‹ 前月</button>
    <label class="month-picker">表示月
      <select id="month-select" data-action="month-select">${opts}</select>
    </label>
    <button class="btn btn-ghost" data-action="month-next" aria-label="次の月">翌月 ›</button>
  </div>`;
}

function statCard(label, value, sub, tone) {
  return `<div class="stat ${tone || ""}">
    <div class="stat-label">${esc(label)}</div>
    <div class="stat-value">${esc(value)}</div>
    <div class="stat-sub">${sub || ""}</div>
  </div>`;
}

// ---------- Dashboard ----------

export function renderDashboard(state) {
  const month = state.month;
  const t = monthTotals(state, month);
  const prev = monthTotals(state, prevMonth(month));
  const savingsRate = t.income > 0 ? Math.round(((t.income - t.spending) / t.income) * 100) : 0;
  const spendMap = spendingByCategory(state, month);
  const prevMap = spendingByCategory(state, prevMonth(month));

  const slices = [...spendMap.entries()]
    .map(([id, v]) => ({ label: (categoryById(state, id) || {}).name || id, value: v, color: (categoryById(state, id) || {}).color || "#888" }))
    .sort((a, b) => b.value - a.value);

  const budgetRows = state.categories
    .filter((c) => c.kind === "expense" && state.budgets[c.id] != null)
    .map((c) => ({ label: c.name, color: c.color, budget: state.budgets[c.id], actual: spendMap.get(c.id) || 0 }))
    .sort((a, b) => b.actual - a.actual);

  // Upcoming bills for the selected month (unpaid, sorted by due day).
  const today = new Date();
  const upcoming = state.bills
    .filter((b) => !b.paidMonths.includes(month))
    .sort((a, b) => a.dueDay - b.dueDay);
  const upcomingHtml = upcoming.length === 0
    ? `<p class="empty">今月の請求書はすべて支払い済みです。よくできました！</p>`
    : `<ul class="bill-list">${upcoming.map((b) => {
        const dueDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, b.dueDay);
        const soon = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` && dueDate - today < 7 * 86400000 && dueDate >= today;
        return `<li class="bill-row ${soon ? "due-soon" : ""}">
          <span class="bill-name">${esc(b.name)}</span>
          <span class="bill-due">${b.dueDay}日まで${soon ? " ・ もうすぐ" : ""}</span>
          <span class="bill-amount">${formatYen(b.amount)}</span>
          <button class="btn btn-small" data-action="bill-pay" data-id="${b.id}">支払う</button>
        </li>`;
      }).join("")}</ul>`;

  // Month-over-month comparison per category.
  const cats = [...new Set([...spendMap.keys(), ...prevMap.keys()])]
    .map((id) => ({
      name: (categoryById(state, id) || {}).name || id,
      color: (categoryById(state, id) || {}).color || "#888",
      cur: spendMap.get(id) || 0,
      prev: prevMap.get(id) || 0,
    }))
    .filter((c) => c.cur > 0 || c.prev > 0)
    .sort((a, b) => b.cur - a.cur);
  const momRows = cats.map((c) => {
    const diff = c.cur - c.prev;
    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
    const cls = diff > 0 ? "up" : diff < 0 ? "down" : "";
    return `<tr><td><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</td>
      <td class="num">${formatYen(c.cur)}</td><td class="num">${formatYen(c.prev)}</td>
      <td class="num ${cls}">${arrow} ${formatSignedYen(diff)}</td></tr>`;
  }).join("");

  const legend = slices.map((s) => `<li><span class="dot" style="background:${esc(s.color)}"></span>${esc(s.label)} <b>${formatYen(s.value)}</b>（${Math.round((s.value / Math.max(1, t.spending)) * 100)}%）</li>`).join("");

  return `
  <section class="page-head">
    <div>
      <h1>ダッシュボード</h1>
      <p class="lede">${monthLabel(month)}の家計をひと目で。サンプルデータ（架空の佐藤家）で表示しています。</p>
    </div>
    ${monthNav(state)}
  </section>

  <div class="stats">
    ${statCard("収入", formatYen(t.income), `前月 ${formatYen(prev.income)}`, "")}
    ${statCard("支出", formatYen(t.spending), `前月 ${formatYen(prev.spending)}`, t.spending > prev.spending ? "warn" : "")}
    ${statCard("収支", formatYen(t.balance), t.balance >= 0 ? "黒字です" : "赤字です", t.balance >= 0 ? "good" : "bad")}
    ${statCard("貯蓄率", `${savingsRate}%`, `目標 20% ${savingsRate >= 20 ? "・達成" : "・あと少し"}`, savingsRate >= 20 ? "good" : "")}
  </div>

  <div class="grid-2">
    <section class="card">
      <h2>カテゴリ別支出</h2>
      <div class="donut-wrap">${donutChart(slices)}
        <ul class="legend">${legend || '<li class="empty">この月の支出はまだありません。</li>'}</ul>
      </div>
    </section>
    <section class="card">
      <h2>予算と実績</h2>
      ${budgetBars(budgetRows)}
      <p class="card-note"><a href="#/budgets">予算を編集する →</a></p>
    </section>
  </div>

  <div class="grid-2">
    <section class="card">
      <h2>未払いの請求書</h2>
      ${upcomingHtml}
      <p class="card-note"><a href="#/bills">請求書一覧を見る →</a></p>
    </section>
    <section class="card">
      <h2>前月との比較</h2>
      <table class="table">
        <thead><tr><th>カテゴリ</th><th class="num">今月</th><th class="num">前月</th><th class="num">増減</th></tr></thead>
        <tbody>${momRows || '<tr><td colspan="4" class="empty">比較できるデータがありません。</td></tr>'}</tbody>
      </table>
    </section>
  </div>`;
}

// ---------- Transactions ----------

export function renderTransactions(state, filter) {
  const month = state.month;
  let txs = state.transactions.filter((t) => t.date.slice(0, 7) === month);
  if (filter.category) txs = txs.filter((t) => t.categoryId === filter.category);
  if (filter.kind) txs = txs.filter((t) => t.kind === filter.kind);
  if (filter.query) {
    const q = filter.query.toLowerCase();
    txs = txs.filter((t) => t.desc.toLowerCase().includes(q) || (categoryById(state, t.categoryId) || {}).name?.toLowerCase().includes(q));
  }
  txs.sort((a, b) => (a.date < b.date ? -1 : 1));

  const opening = state.transactions
    .filter((t) => t.date.slice(0, 7) < month)
    .reduce((s, t) => s + (t.kind === "income" ? t.amount : -t.amount), 0);
  const withBal = withRunningBalance(txs, opening).reverse();

  const catOpts = `<option value="">すべてのカテゴリ</option>` + state.categories
    .map((c) => `<option value="${c.id}" ${filter.category === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("");

  const rows = withBal.map((t) => {
    const cat = categoryById(state, t.categoryId);
    return `<tr>
      <td>${esc(t.date)}</td>
      <td><span class="dot" style="background:${esc(cat?.color || "#888")}"></span>${esc(cat?.name || t.categoryId)}</td>
      <td>${esc(t.desc)}</td>
      <td class="num ${t.kind === "income" ? "income" : "expense"}">${t.kind === "income" ? "+" : "−"}${formatYen(t.amount)}</td>
      <td class="num">${formatYen(t.balanceAfter)}</td>
      <td class="row-actions">
        <button class="btn btn-small" data-action="tx-edit" data-id="${t.id}">編集</button>
        <button class="btn btn-small btn-danger" data-action="tx-delete" data-id="${t.id}">削除</button>
      </td>
    </tr>`;
  }).join("");

  const editing = filter.editing;
  const formTitle = editing ? "取引を編集" : "取引を追加";
  const form = `
  <form id="tx-form" class="card form-card" data-editing="${editing ? editing.id : ""}">
    <h2>${formTitle}</h2>
    <div class="form-grid">
      <label>日付 <input type="date" name="date" required value="${editing ? editing.date : `${month}-27`}"></label>
      <label>種別
        <select name="kind">
          <option value="expense" ${editing?.kind === "expense" || !editing ? "selected" : ""}>支出</option>
          <option value="income" ${editing?.kind === "income" ? "selected" : ""}>収入</option>
        </select>
      </label>
      <label>カテゴリ
        <select name="categoryId">
          ${state.categories.map((c) => `<option value="${c.id}" ${editing?.categoryId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
      </label>
      <label>内容 <input type="text" name="desc" required maxlength="80" placeholder="例：スーパーで買い物" value="${editing ? esc(editing.desc) : ""}"></label>
      <label>金額（円） <input type="number" name="amount" required min="1" max="100000000" step="1" inputmode="numeric" placeholder="5000" value="${editing ? editing.amount : ""}"></label>
    </div>
    <p class="form-error" id="tx-form-error" role="alert" hidden></p>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">${editing ? "保存する" : "追加する"}</button>
      ${editing ? '<button type="button" class="btn btn-ghost" data-action="tx-cancel-edit">キャンセル</button>' : ""}
    </div>
  </form>`;

  return `
  <section class="page-head">
    <div>
      <h1>取引一覧</h1>
      <p class="lede">${monthLabel(month)}の入出金。追加・編集・削除するとダッシュボードと残高にすぐ反映されます。</p>
    </div>
    ${monthNav(state)}
  </section>

  <div class="toolbar card">
    <label>カテゴリ <select id="filter-category" data-action="filter-category">${catOpts}</select></label>
    <label>種別
      <select id="filter-kind" data-action="filter-kind">
        <option value="">すべて</option>
        <option value="expense" ${filter.kind === "expense" ? "selected" : ""}>支出のみ</option>
        <option value="income" ${filter.kind === "income" ? "selected" : ""}>収入のみ</option>
      </select>
    </label>
    <label class="search">検索 <input type="search" id="filter-query" data-action="filter-query" placeholder="内容・カテゴリで検索" value="${esc(filter.query || "")}"></label>
    <span class="toolbar-spacer"></span>
    <button class="btn" data-action="csv-export">CSVで書き出す</button>
    <label class="btn btn-file">CSVを取り込む <input type="file" id="csv-import" accept=".csv,text/csv" hidden></label>
  </div>

  ${form}

  <section class="card">
    <h2>${monthLabel(month)}の取引（${txs.length}件）</h2>
    ${txs.length === 0
      ? `<p class="empty">この条件の取引はありません。「取引を追加」から1件目を入力してみましょう。</p>`
      : `<div class="table-wrap"><table class="table">
        <thead><tr><th>日付</th><th>カテゴリ</th><th>内容</th><th class="num">金額</th><th class="num">残高</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`}
    <p class="card-note">残高は月始めからの累計です。削除した取引はトーストの「元に戻す」で復元できます。</p>
  </section>`;
}

// ---------- Budgets + category manager ----------

export function renderBudgets(state) {
  const month = state.month;
  const spendMap = spendingByCategory(state, month);
  const totalBudget = Object.values(state.budgets).reduce((a, b) => a + b, 0);
  const totalSpent = [...spendMap.values()].reduce((a, b) => a + b, 0);

  const rows = state.categories
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const budget = state.budgets[c.id] ?? 0;
      const actual = spendMap.get(c.id) || 0;
      const pct = budget > 0 ? (actual / budget) * 100 : actual > 0 ? 100 : 0;
      const over = budget > 0 && actual > budget;
      return `<div class="budget-row ${over ? "over" : ""}">
        <div class="budget-head">
          <span class="budget-name"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</span>
          <span class="budget-figures">${formatYen(actual)} / ${formatYen(budget)}</span>
        </div>
        ${progressBar(pct, over ? "#b4552d" : c.color, `${c.name}の予算達成率`)}
        <div class="budget-foot">
          <span class="${over ? "warn-text" : ""}">${over ? `予算を ${formatYen(actual - budget)} オーバーしています` : budget - actual > 0 ? `あと ${formatYen(budget - actual)} 使えます` : "予算未設定"}</span>
          <label class="budget-edit">月予算（円）
            <input type="number" min="0" max="10000000" step="1000" value="${budget}" data-action="budget-input" data-id="${c.id}" inputmode="numeric">
          </label>
        </div>
      </div>`;
    }).join("");

  const catRows = state.categories.map((c) => `<tr>
      <td><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</td>
      <td>${c.kind === "income" ? "収入" : "支出"}</td>
      <td><input type="color" value="${esc(c.color)}" data-action="cat-color" data-id="${c.id}" aria-label="${esc(c.name)}の色"></td>
      <td><input type="text" value="${esc(c.name)}" maxlength="20" data-action="cat-rename" data-id="${c.id}" aria-label="${esc(c.name)}の名前"></td>
      <td><button class="btn btn-small btn-danger" data-action="cat-delete" data-id="${c.id}" ${state.categories.length <= 2 ? "disabled" : ""}>削除</button></td>
    </tr>`).join("");

  return `
  <section class="page-head">
    <div>
      <h1>予算</h1>
      <p class="lede">${monthLabel(month)}のカテゴリ別予算。金額を変えると進捗バーがすぐ変わります。</p>
    </div>
    ${monthNav(state)}
  </section>

  <div class="stats">
    ${statCard("月予算の合計", formatYen(totalBudget), "全カテゴリの合計", "")}
    ${statCard("今月の支出", formatYen(totalSpent), `予算の ${totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0}% を使用`, totalSpent > totalBudget ? "warn" : "good")}
    ${statCard("予算残り", formatYen(Math.max(0, totalBudget - totalSpent)), totalSpent > totalBudget ? `予算を ${formatYen(totalSpent - totalBudget)} オーバー` : "予算内です", totalSpent > totalBudget ? "bad" : "good")}
  </div>

  <section class="card"><h2>カテゴリ別予算</h2>${rows}
    <p class="card-note">予算は月ごとに同じ金額を使います。金額を入力して Enter か、欄を離れると保存されます。</p>
  </section>

  <section class="card">
    <h2>カテゴリ管理</h2>
    <p class="card-note">名前や色を変えると、過去の取引もすべて新しい名前・色で表示されます。削除したカテゴリの取引は「その他」に移動します。</p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>カテゴリ</th><th>種別</th><th>色</th><th>名前</th><th></th></tr></thead>
      <tbody>${catRows}</tbody>
    </table></div>
    <form id="cat-form" class="inline-form">
      <input type="text" name="name" required maxlength="20" placeholder="新しいカテゴリ名（例：ペット）">
      <select name="kind"><option value="expense">支出</option><option value="income">収入</option></select>
      <input type="color" name="color" value="#2e7d5b" aria-label="色">
      <button type="submit" class="btn btn-primary">カテゴリを追加</button>
    </form>
  </section>`;
}

// ---------- Bills ----------

export function renderBills(state) {
  const month = state.month;
  const today = new Date();
  const isCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const sorted = [...state.bills].sort((a, b) => a.dueDay - b.dueDay);
  const paidTotal = sorted.filter((b) => b.paidMonths.includes(month)).reduce((s, b) => s + b.amount, 0);
  const unpaidTotal = sorted.filter((b) => !b.paidMonths.includes(month)).reduce((s, b) => s + b.amount, 0);

  const rows = sorted.map((b) => {
    const paid = b.paidMonths.includes(month);
    const dueDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, b.dueDay);
    const soon = !paid && isCurrentMonth && dueDate >= today && dueDate - today < 7 * 86400000;
    const overdue = !paid && isCurrentMonth && dueDate < today;
    const cat = categoryById(state, b.categoryId);
    return `<li class="bill-row ${paid ? "paid" : ""} ${soon ? "due-soon" : ""} ${overdue ? "overdue" : ""}">
      <span class="bill-name"><span class="dot" style="background:${esc(cat?.color || "#888")}"></span>${esc(b.name)}</span>
      <span class="bill-due">${b.dueDay}日${overdue ? " ・ 期限切れ" : soon ? " ・ もうすぐ" : ""}</span>
      <span class="bill-amount">${formatYen(b.amount)}</span>
      <button class="btn btn-small ${paid ? "btn-ghost" : "btn-primary"}" data-action="bill-toggle" data-id="${b.id}" aria-pressed="${paid}">
        ${paid ? "支払い済み ✓" : "支払う"}
      </button>
    </li>`;
  }).join("");

  return `
  <section class="page-head">
    <div>
      <h1>請求書</h1>
      <p class="lede">${monthLabel(month)}の定期請求。支払いボタンを押すと今月分が支払い済みになります。</p>
    </div>
    ${monthNav(state)}
  </section>

  <div class="stats">
    ${statCard("未払い合計", formatYen(unpaidTotal), `${sorted.filter((b) => !b.paidMonths.includes(month)).length}件が未払い`, unpaidTotal > 0 ? "warn" : "good")}
    ${statCard("支払い済み", formatYen(paidTotal), `${sorted.filter((b) => b.paidMonths.includes(month)).length}件が支払い済み`, "good")}
    ${statCard("請求書の件数", `${sorted.length}件`, `月額合計 ${formatYen(paidTotal + unpaidTotal)}`, "")}
  </div>

  <section class="card">
    <h2>定期請求一覧</h2>
    <ul class="bill-list">${rows}</ul>
    <p class="card-note">支払い状態は月ごとに記録されます。来月になるとまた未払いとして表示されます。</p>
  </section>

  <section class="card">
    <h2>請求書を追加</h2>
    <form id="bill-form" class="inline-form">
      <input type="text" name="name" required maxlength="40" placeholder="請求書の名前（例：新聞代）">
      <label>金額（円） <input type="number" name="amount" required min="1" max="10000000" step="1" inputmode="numeric"></label>
      <label>支払日 <input type="number" name="dueDay" required min="1" max="31" value="1" inputmode="numeric"></label>
      <select name="categoryId">${state.categories.filter((c) => c.kind === "expense").map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <button type="submit" class="btn btn-primary">追加する</button>
    </form>
  </section>`;
}

// ---------- Goals ----------

export function renderGoals(state) {
  const cards = state.goals.map((g) => {
    const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
    const remain = Math.max(0, g.target - g.saved);
    return `<article class="card goal-card">
      <h2><span class="dot" style="background:${esc(g.color)}"></span>${esc(g.name)}</h2>
      <div class="goal-figures">
        <span class="goal-saved">${formatYen(g.saved)}</span>
        <span class="goal-target">/ 目標 ${formatYen(g.target)}</span>
      </div>
      ${progressBar(pct, g.color, `${g.name}の達成率`)}
      <p class="goal-pct">${Math.round(pct)}% 達成・残り ${formatYen(remain)}</p>
      <form class="inline-form goal-contrib" data-goal="${g.id}">
        <label>拠出する金額（円） <input type="number" name="amount" required min="1" max="10000000" step="1" placeholder="10000" inputmode="numeric"></label>
        <button type="submit" class="btn btn-primary">貯金する</button>
      </form>
      <button class="btn btn-small btn-danger" data-action="goal-delete" data-id="${g.id}">この目標を削除</button>
    </article>`;
  }).join("");

  // What-if simulator: pick the first goal with remaining amount.
  const simGoal = state.goals.find((g) => g.saved < g.target) || state.goals[0];
  const sim = simGoal ? `
  <section class="card">
    <h2>貯金シミュレータ（もしも計算）</h2>
    <p class="card-note">毎月いくら積み立てれば、いつ目標に届くか計算します。</p>
    <form id="sim-form" class="sim-form">
      <label>目標
        <select name="goalId" id="sim-goal">
          ${state.goals.map((g) => `<option value="${g.id}" ${g.id === simGoal.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}
        </select>
      </label>
      <label>毎月の積立額 <span id="sim-amount-label">¥20,000</span>
        <input type="range" name="monthly" id="sim-monthly" min="1000" max="200000" step="1000" value="20000">
      </label>
      <p class="sim-result" id="sim-result" aria-live="polite"></p>
    </form>
  </section>` : `<p class="empty">目標がありません。下のフォームから追加してください。</p>`;

  return `
  <section class="page-head">
    <div>
      <h1>貯金目標</h1>
      <p class="lede">目標に向けてコツコツ貯める。拠出すると進捗バーがすぐ伸びます。</p>
    </div>
  </section>

  <div class="grid-2">${cards || '<p class="empty">目標がありません。下のフォームから追加してください。</p>'}</div>

  ${sim}

  <section class="card">
    <h2>新しい目標</h2>
    <form id="goal-form" class="inline-form">
      <input type="text" name="name" required maxlength="40" placeholder="目標の名前（例：新車）">
      <label>目標金額（円） <input type="number" name="target" required min="1" max="100000000" step="1" inputmode="numeric"></label>
      <label>今ある金額（円） <input type="number" name="saved" min="0" max="100000000" step="1" value="0" inputmode="numeric"></label>
      <input type="color" name="color" value="#2e7d5b" aria-label="色">
      <button type="submit" class="btn btn-primary">目標を追加</button>
    </form>
  </section>`;
}

// ---------- Reports ----------

export function renderReports(state) {
  // Last 6 months ending at the selected month.
  const months = [];
  {
    const [y, m] = state.month.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }
  const points = months.map((mo) => {
    const t = monthTotals(state, mo);
    return { label: `${Number(mo.slice(5, 7))}月`, income: t.income, spending: t.spending };
  });
  const cur = monthTotals(state, state.month);
  const prev = monthTotals(state, prevMonth(state.month));
  const spendMap = spendingByCategory(state, state.month);
  const topCat = [...spendMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCatName = topCat ? (categoryById(state, topCat[0]) || {}).name : "—";

  const insights = [];
  const diff = cur.spending - prev.spending;
  insights.push(diff > 0
    ? `支出は前月より ${formatYen(diff)} 増えました。増えたカテゴリをダッシュボードの比較表で確認しましょう。`
    : diff < 0
      ? `支出は前月より ${formatYen(-diff)} 減りました。この調子で貯蓄を増やせます。`
      : "支出は前月とほぼ同じです。");
  if (topCat) insights.push(`今月いちばん多い支出は「${topCatName}」で ${formatYen(topCat[1])}、支出全体の ${Math.round((topCat[1] / Math.max(1, cur.spending)) * 100)}% を占めます。`);
  const rate = cur.income > 0 ? Math.round(((cur.income - cur.spending) / cur.income) * 100) : 0;
  insights.push(rate >= 20
    ? `貯蓄率 ${rate}% は目標の 20% を超えています。余裕分を貯金目標へ回すと目標達成が早まります。`
    : `貯蓄率 ${rate}% は目標の 20% に届いていません。娯楽・外食など変動費の見直しが効きます。`);
  const avgSpend = Math.round(points.reduce((s, p) => s + p.spending, 0) / points.length);
  insights.push(`直近6か月の平均支出は ${formatYen(avgSpend)} です。`);

  // Annual summary: 12 months ending at the selected month.
  const yearMonths = [];
  {
    const [y, m] = state.month.split("-").map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      yearMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }
  const yearRows = yearMonths.map((mo) => {
    const t = monthTotals(state, mo);
    return { month: mo, ...t };
  });
  const withData = yearRows.filter((r) => r.income > 0 || r.spending > 0);
  const best = withData.reduce((a, b) => (b.balance > a.balance ? b : a), withData[0] || { month: "—", balance: 0 });
  const worst = withData.reduce((a, b) => (b.balance < a.balance ? b : a), withData[0] || { month: "—", balance: 0 });
  const yearIncome = yearRows.reduce((s, r) => s + r.income, 0);
  const yearSpend = yearRows.reduce((s, r) => s + r.spending, 0);

  const yearTable = yearRows.map((r) => `<tr>
    <td>${monthLabel(r.month)}</td><td class="num">${formatYen(r.income)}</td>
    <td class="num">${formatYen(r.spending)}</td>
    <td class="num ${r.balance >= 0 ? "income" : "expense"}">${formatYen(r.balance)}</td>
  </tr>`).join("");

  return `
  <section class="page-head">
    <div>
      <h1>レポート</h1>
      <p class="lede">${monthLabel(state.month)}までの家計の流れと、1年分のまとめです。</p>
    </div>
    ${monthNav(state)}
  </section>

  <section class="card">
    <h2>直近6か月の収支</h2>
    ${trendChart(points)}
    <p class="legend-inline"><span class="dot" style="background:#2e7d5b"></span>収入 <span class="dot" style="background:#c98a1b"></span>支出</p>
  </section>

  <div class="grid-2">
    <section class="card">
      <h2>今月の支出内訳</h2>
      <ul class="legend">${[...spendMap.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => {
        const c = categoryById(state, id);
        return `<li><span class="dot" style="background:${esc(c?.color || "#888")}"></span>${esc(c?.name || id)} <b>${formatYen(v)}</b>（${Math.round((v / Math.max(1, cur.spending)) * 100)}%）</li>`;
      }).join("") || '<li class="empty">支出がありません。</li>'}</ul>
    </section>
    <section class="card">
      <h2>家計からの気づき</h2>
      <ul class="insights">${insights.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </section>
  </div>

  <section class="card">
    <h2>年間サマリ（${monthLabel(yearMonths[0])} 〜 ${monthLabel(state.month)}）</h2>
    <div class="stats">
      ${statCard("年間の収入", formatYen(yearIncome), "12か月合計", "")}
      ${statCard("年間の支出", formatYen(yearSpend), "12か月合計", "")}
      ${statCard("年間の収支", formatYen(yearIncome - yearSpend), "12か月合計", yearIncome - yearSpend >= 0 ? "good" : "bad")}
    </div>
    <p>いちばんよかった月：<b>${monthLabel(best.month)}（収支 ${formatYen(best.balance)}）</b> ／ いちばん厳しかった月：<b>${monthLabel(worst.month)}（収支 ${formatYen(worst.balance)}）</b></p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>月</th><th class="num">収入</th><th class="num">支出</th><th class="num">収支</th></tr></thead>
      <tbody>${yearTable}</tbody>
    </table></div>
  </section>`;
}
