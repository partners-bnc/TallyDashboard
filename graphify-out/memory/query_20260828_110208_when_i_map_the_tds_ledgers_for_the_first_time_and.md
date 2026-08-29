---
type: "query"
date: "2026-08-28T11:02:08.228674+00:00"
question: "when I map the tds ledgers for the first time and get back to the dashboard, I only see tds outstanding kpi and other are still missing, why is that happening"
contributor: "graphify"
source_nodes: ["Dashboard Metric Card", "Get Dashboard Data", "History Coverage", "overview/page.tsx"]
---

# Q: when I map the tds ledgers for the first time and get back to the dashboard, I only see tds outstanding kpi and other are still missing, why is that happening

## Answer

Expanded from original query via vocab: [dashboard, data, history, ledger, metric, report, reports]. The graph showed dashboard metrics depend on dashboard data/history and that dashboard overview is a separate route. Source inspection then identified missing dashboard overview invalidation after compliance mapping; TDS mapping also only populates TDS compliance decisions, not GST, promoters, AP, or OPEX mappings.

## Source Nodes

- Dashboard Metric Card
- Get Dashboard Data
- History Coverage
- overview/page.tsx