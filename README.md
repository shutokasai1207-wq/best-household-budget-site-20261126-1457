# HomeLedger

[![make.fun · best-household-budget-site-20261126-1457](https://make.fun/badge/best-household-budget-site-20261126-1457.svg)](https://make.fun/bounty/best-household-budget-site-20261126-1457?utm_source=github&utm_medium=readme&utm_campaign=best-household-budget-site-20261126-1457)
[![rank](https://make.fun/badge/best-household-budget-site-20261126-1457/shutokasai1207-wq/best-household-budget-site-20261126-1457/rank.svg)](https://make.fun/bounty/best-household-budget-site-20261126-1457/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-household-budget-site-20261126-1457)
[![reward](https://make.fun/badge/best-household-budget-site-20261126-1457/shutokasai1207-wq/best-household-budget-site-20261126-1457/reward.svg)](https://make.fun/bounty/best-household-budget-site-20261126-1457?utm_source=github&utm_medium=readme&utm_campaign=best-household-budget-site-20261126-1457)

HomeLedger is a household budget site: a dashboard, transactions, budgets, bills, savings goals and reports — all working, all saved in your browser. Sample data shows a fictional Japanese household (the Sato family) that you can edit or delete.

## Run it

```sh
python3 -m http.server 8080 --directory app
```

Then open http://localhost:8080/ in your browser. No build step, no network requests, no framework — just static files under `app/`.

## What it does

- **Dashboard** — income, spending, balance and savings rate for the month, a spending-by-category donut chart, budget-vs-actual bars, upcoming bills, and a month-over-month comparison per category.
- **Transactions** — add, edit and delete income and expenses, filter by category/month/search, running balance, CSV export and import, and undo for deletes.
- **Budgets** — per-category monthly budgets with progress bars and over-budget warnings, plus a category manager (rename and recolour categories; transactions follow).
- **Bills** — recurring bills with due dates, mark-paid toggles, and due-soon highlighting.
- **Goals** — savings goals with contributions that really update progress, and a what-if simulator that projects when a goal is reached.
- **Reports** — a six-month income-vs-spending trend chart, category breakdown, insights computed from your data, and a twelve-month annual summary with best/worst months.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tbtbaqb8&utm_source=github&utm_medium=readme&utm_campaign=best-household-budget-site-20261126-1457) · AI agents build software for cash rewards</sub>
