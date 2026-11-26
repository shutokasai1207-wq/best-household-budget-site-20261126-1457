// charts.js — Hand-drawn SVG charts for HomeLedger.
// No chart library: every chart is plain SVG built from the numbers.
// All functions return an SVG string; callers insert it into the page.

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Donut chart of spending by category.
// slices: [{ label, value, color }]. size in px.
export function donutChart(slices, size = 220) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const inner = r * 0.62;
  if (total <= 0) {
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="支出データがありません">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8e2d4" stroke-width="26"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" font-size="14" fill="#8b8578">データなし</text>
    </svg>`;
  }
  let angle = -Math.PI / 2;
  const paths = [];
  for (const s of slices) {
    const frac = s.value / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    if (frac >= 0.999) {
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${esc(s.color)}" stroke-width="26"/>`);
      continue;
    }
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    paths.push(`<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${esc(s.color)}" stroke-width="26"><title>${esc(s.label)} ${Math.round(frac * 100)}%</title></path>`);
  }
  const pct = slices.length ? Math.round((slices[0].value / total) * 100) : 0;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="カテゴリ別支出の円グラフ">
    ${paths.join("")}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" fill="#8b8578">今月の支出</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="17" font-weight="700" fill="#22301f">¥${total.toLocaleString("ja-JP")}</text>
    <text x="${cx}" y="${cy + 38}" text-anchor="middle" font-size="11" fill="#8b8578">最大 ${esc(slices[0] ? slices[0].label : "")} ${pct}%</text>
  </svg>`;
}

// Horizontal bars comparing budget vs actual per category.
// rows: [{ label, color, budget, actual }]
export function budgetBars(rows, width = 560) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.budget, r.actual)));
  const rowH = 34;
  const height = rows.length * rowH + 8;
  const labelW = 92;
  const barW = width - labelW - 118;
  let y = 8;
  const parts = [`<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="予算と実績の棒グラフ">`];
  for (const r of rows) {
    const bw = Math.max(2, (r.budget / max) * barW);
    const aw = Math.max(2, (r.actual / max) * barW);
    const over = r.actual > r.budget;
    parts.push(`<text x="0" y="${y + 13}" font-size="12" fill="#3a3a32">${esc(r.label)}</text>`);
    parts.push(`<rect x="${labelW}" y="${y}" width="${bw}" height="9" rx="4" fill="#e3dcc9"/>`);
    parts.push(`<rect x="${labelW}" y="${y + 11}" width="${aw}" height="9" rx="4" fill="${over ? "#b4552d" : esc(r.color)}"/>`);
    parts.push(`<text x="${labelW + barW + 8}" y="${y + 13}" font-size="11" fill="#6b655a">¥${r.actual.toLocaleString("ja-JP")} / ¥${r.budget.toLocaleString("ja-JP")}</text>`);
    y += rowH;
  }
  parts.push("</svg>");
  return parts.join("");
}

// Monthly trend chart: grouped bars, income vs spending, last N months.
// points: [{ label, income, spending }]
export function trendChart(points, width = 560, height = 240) {
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.spending]));
  const padL = 52;
  const padB = 26;
  const padT = 14;
  const innerW = width - padL - 12;
  const innerH = height - padT - padB;
  const groupW = innerW / points.length;
  const barW = Math.min(26, (groupW - 14) / 2);
  const parts = [`<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="月別収支の推移グラフ">`];
  // gridlines
  for (let g = 0; g <= 3; g++) {
    const v = (max / 3) * g;
    const y = padT + innerH - (v / max) * innerH;
    parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - 12}" y2="${y.toFixed(1)}" stroke="#ece6d6" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#8b8578">¥${Math.round(v / 10000)}万</text>`);
  }
  // zero baseline, drawn over the gridlines so bars sit on a clear floor.
  parts.push(`<line x1="${padL}" y1="${(padT + innerH).toFixed(1)}" x2="${width - 12}" y2="${(padT + innerH).toFixed(1)}" stroke="#d9d2bd" stroke-width="1.5"/>`);
  points.forEach((p, i) => {
    const gx = padL + i * groupW + (groupW - barW * 2 - 4) / 2;
    const ih = (p.income / max) * innerH;
    const sh = (p.spending / max) * innerH;
    parts.push(`<rect x="${gx.toFixed(1)}" y="${(padT + innerH - ih).toFixed(1)}" width="${barW}" height="${ih.toFixed(1)}" rx="3" fill="#2e7d5b"><title>${esc(p.label)} 収入 ¥${p.income.toLocaleString("ja-JP")}</title></rect>`);
    parts.push(`<rect x="${(gx + barW + 4).toFixed(1)}" y="${(padT + innerH - sh).toFixed(1)}" width="${barW}" height="${sh.toFixed(1)}" rx="3" fill="#c98a1b"><title>${esc(p.label)} 支出 ¥${p.spending.toLocaleString("ja-JP")}</title></rect>`);
    parts.push(`<text x="${(padL + i * groupW + groupW / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#6b655a">${esc(p.label)}</text>`);
  });
  parts.push("</svg>");
  return parts.join("");
}

// Simple progress bar (HTML, not SVG) used for goals and budgets.
export function progressBar(pct, color, label) {
  const clamped = Math.max(0, Math.min(100, pct));
  return `<div class="progress" role="progressbar" aria-valuenow="${Math.round(clamped)}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label || "")}">
    <div class="progress-fill" style="width:${clamped.toFixed(1)}%;background:${esc(color)}"></div>
  </div>`;
}
