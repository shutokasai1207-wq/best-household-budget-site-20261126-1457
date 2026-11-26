// data.js — Sample household data for HomeLedger.
// The Sato family below is FICTIONAL sample data. The user can edit or
// delete every row from the Transactions page. Currency: Japanese yen (¥).
// Months are YYYY-MM; "today" for the sample is November 2026.

export const SAMPLE_MONTH = "2026-11";

// Category definitions. kind: "expense" or "income". Transactions store a
// categoryId, so renaming or recolouring a category follows every row.
export const DEFAULT_CATEGORIES = [
  { id: "food",        name: "食費",     color: "#2e7d5b", kind: "expense" },
  { id: "housing",     name: "住居費",   color: "#7a5c3e", kind: "expense" },
  { id: "utilities",   name: "光熱費",   color: "#c98a1b", kind: "expense" },
  { id: "transport",   name: "交通費",   color: "#3d6f8e", kind: "expense" },
  { id: "comms",       name: "通信費",   color: "#6a5f9e", kind: "expense" },
  { id: "daily",        name: "日用品",   color: "#8a7d5c", kind: "expense" },
  { id: "fun",          name: "娯楽・外食", color: "#b4552d", kind: "expense" },
  { id: "education",   name: "教育費",   color: "#4a7a8c", kind: "expense" },
  { id: "health",      name: "医療・健康", color: "#a34d6e", kind: "expense" },
  { id: "other",       name: "その他",   color: "#8b8b83", kind: "expense" },
  { id: "salary",      name: "給与",     color: "#2e7d5b", kind: "income" },
  { id: "side",        name: "副収入",   color: "#5c8a3c", kind: "income" },
];

// Monthly budget targets (¥) per expense category.
export const DEFAULT_BUDGETS = {
  food: 68000,
  housing: 98000,
  utilities: 22000,
  transport: 18000,
  comms: 16000,
  daily: 15000,
  fun: 30000,
  education: 25000,
  health: 12000,
  other: 10000,
};

// Recurring bills. dueDay is the day of the month. paidMonths lists the
// YYYY-MM months already marked paid.
export const DEFAULT_BILLS = [
  { id: "b-rent",    name: "家賃",          amount: 98000,  dueDay: 27, categoryId: "housing",   paidMonths: ["2026-11"] },
  { id: "b-electric",name: "電気代",        amount: 9200,   dueDay: 10, categoryId: "utilities", paidMonths: ["2026-11"] },
  { id: "b-gas",     name: "ガス代",        amount: 6800,   dueDay: 12, categoryId: "utilities", paidMonths: ["2026-11"] },
  { id: "b-water",   name: "水道代",        amount: 5400,   dueDay: 15, categoryId: "utilities", paidMonths: [] },
  { id: "b-mobile",  name: "携帯電話",      amount: 9800,   dueDay: 5,  categoryId: "comms",     paidMonths: ["2026-11"] },
  { id: "b-internet",name: "インターネット", amount: 5200,   dueDay: 8,  categoryId: "comms",     paidMonths: ["2026-11"] },
  { id: "b-insurance",name: "生命保険",     amount: 18400,  dueDay: 20, categoryId: "health",    paidMonths: [] },
  { id: "b-train",   name: "通勤定期券",    amount: 12400,  dueDay: 1,  categoryId: "transport", paidMonths: ["2026-11"] },
  { id: "b-school",  name: "習い事（ピアノ）", amount: 9000, dueDay: 7,  categoryId: "education", paidMonths: [] },
  { id: "b-stream",  name: "動画配信サービス", amount: 1490,  dueDay: 18, categoryId: "fun",       paidMonths: [] },
];

// Savings goals.
export const DEFAULT_GOALS = [
  { id: "g-travel",  name: "家族旅行（沖縄）", target: 300000, saved: 182000, color: "#2e7d5b" },
  { id: "g-car",     name: "車の買い替え",    target: 800000, saved: 245000, color: "#3d6f8e" },
  { id: "g-edu",     name: "教育資金",        target: 1200000, saved: 640000, color: "#c98a1b" },
  { id: "g-emergency", name: "緊急用貯金",    target: 500000, saved: 410000, color: "#6a5f9e" },
];

// A tiny deterministic generator so the six months of history are stable
// across reloads. Not cryptography — just stable sample data.
function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function monthList(endMonth, count) {
  const [y, m] = endMonth.split("-").map(Number);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// Typical monthly spend per category (¥), used to synthesise history.
const TYPICAL = {
  food: [4200, 5800, 3900, 6400, 5100, 7300, 4600, 5900],
  daily: [2400, 3100, 1800, 2900],
  fun: [3200, 4800, 2600, 5900, 2100],
  transport: [1800, 2400, 1500],
  utilities: [8900, 7200, 6100],
  health: [2100, 3400, 1800],
  other: [1500, 2600, 1200],
  education: [9000, 12500],
  comms: [9800, 5200],
};

const FOOD_LABELS = ["スーパー（まいばすけっと）", "スーパー（イオン）", "八百屋・魚屋", "コンビニ", "お米・まとめ買い", "ドラッグストア食品", "精肉店", "パン屋"];
const FUN_LABELS = ["映画館", "家族で外食", "カフェ", "本・雑誌", "ゲーム", "テーマパーク", "カラオケ", "スポーツ観戦"];

function buildSampleTransactions() {
  const txs = [];
  let n = 0;
  const id = () => `t-sample-${++n}`;
  const months = monthList("2026-11", 6); // 2026-06 .. 2026-11

  for (const month of months) {
    const [y, mo] = month.split("-").map(Number);
    const rnd = seededRandom(y * 100 + mo);
    const daysInMonth = new Date(y, mo, 0).getDate();

    // Income: salary on the 25th, child allowance on the 10th, side income mid-month.
    txs.push({ id: id(), date: `${month}-25`, categoryId: "salary", desc: "給与（佐藤）", amount: 486000, kind: "income" });
    txs.push({ id: id(), date: `${month}-10`, categoryId: "salary", desc: "児童手当", amount: 20000, kind: "income" });
    txs.push({ id: id(), date: `${month}-15`, categoryId: "side", desc: "副業（ライティング）", amount: 28000 + Math.floor(rnd() * 9000), kind: "income" });
    // Rent on the 27th (except current month's tail, keep it anyway).
    txs.push({ id: id(), date: `${month}-27`, categoryId: "housing", desc: "家賃", amount: 98000, kind: "expense" });

    for (const [cat, amounts] of Object.entries(TYPICAL)) {
      for (const base of amounts) {
        const day = 1 + Math.floor(rnd() * daysInMonth);
        const jitter = Math.round((rnd() - 0.5) * base * 0.3);
        let label = "買い物";
        if (cat === "food") label = FOOD_LABELS[Math.floor(rnd() * FOOD_LABELS.length)];
        if (cat === "fun") label = FUN_LABELS[Math.floor(rnd() * FUN_LABELS.length)];
        if (cat === "utilities") label = ["電気代", "ガス代", "水道代"][Math.floor(rnd() * 3)];
        if (cat === "comms") label = ["携帯電話", "インターネット"][Math.floor(rnd() * 2)];
        if (cat === "education") label = ["習い事（ピアノ）", "塾"][Math.floor(rnd() * 2)];
        if (cat === "health") label = ["病院・薬局", "歯科", "ドラッグストア"][Math.floor(rnd() * 3)];
        if (cat === "transport") label = ["電車・バス", "ガソリン", "駐車場"][Math.floor(rnd() * 3)];
        if (cat === "daily") label = ["日用品まとめ買い", "洗剤・消耗品", "100円ショップ"][Math.floor(rnd() * 3)];
        if (cat === "other") label = ["雑費", "ギフト", "修理"][Math.floor(rnd() * 3)];
        txs.push({
          id: id(),
          date: `${month}-${String(day).padStart(2, "0")}`,
          categoryId: cat,
          desc: label,
          amount: Math.max(300, base + jitter),
          kind: "expense",
        });
      }
    }
  }
  // Sort newest first by date.
  txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return txs;
}

export function buildDefaultState() {
  return {
    version: 1,
    month: SAMPLE_MONTH,
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    transactions: buildSampleTransactions(),
    budgets: { ...DEFAULT_BUDGETS },
    bills: JSON.parse(JSON.stringify(DEFAULT_BILLS)),
    goals: JSON.parse(JSON.stringify(DEFAULT_GOALS)),
  };
}
