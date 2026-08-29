---
type: "query"
date: "2026-08-28T11:53:50.023008+00:00"
question: "I do not understand why the bug appeared because once I mapped the tiers, the KPI results were already cached and stored. Why would going back show blank KPIs? If it was cached it should show the same data, right? Why was it showing zero?"
contributor: "graphify"
source_nodes: ["Dashboard Overview Page", "Get Dashboard Data", "Dashboard Metric Card", "History Coverage"]
---

# Q: I do not understand why the bug appeared because once I mapped the tiers, the KPI results were already cached and stored. Why would going back show blank KPIs? If it was cached it should show the same data, right? Why was it showing zero?

## Answer

Expanded from original query via vocab: [dashboard, data, history, metric, overview, page]. The dashboard did not have one durable KPI cache. The browser Router Cache stored an RSC page snapshot; mapping revalidation could discard the previously good snapshot. The next overview render independently queried accounting totals and TDS. The pre-fix accounting path treated missing totals as zero with optional chaining and nullish fallbacks, while TDS could succeed separately. The resulting zero page snapshot could then be retained by dynamic staleTimes. A refresh bypassed that client snapshot and queried again. Source: Dashboard Overview Page, Get Dashboard Data, Dashboard Metric Card, History Coverage.

## Source Nodes

- Dashboard Overview Page
- Get Dashboard Data
- Dashboard Metric Card
- History Coverage