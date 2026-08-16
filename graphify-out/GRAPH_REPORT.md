# Graph Report - .  (2026-08-14)

## Corpus Check
- 186 files · ~131,787 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 557 nodes · 728 edges · 44 communities (28 shown, 16 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Supabase Integration / Company-Scoped Ledger Query
- ledger/route.ts / dashboard-selector.tsx
- Action-Specific Microcopy / Copy Discipline
- @astryxdesign/core / @astryxdesign/theme-neutral
- Anti-Slop Design / Motion-Engine Bento 2.0
- overview/page.tsx / Dashboard Overview Page
- @astryxdesign/cli / eslint
- dom / dom.iterable
- Cobalt Theme / Code as Hero
- Keyboard First Hover Second / Microinteraction Four-Part Mod
- Photographic Macrostructure / Quote-Led Macrostructure
- Mega-Menu Panel / Announcement Banner and Retracting Nav
- Step Sequence / Annotated Screenshot
- eslint.config.mjs / eslintConfig
- Data Insights Chat Introduction / Data Chat Question and Ans
- tb_history_coverage / tb_ledger_balance_snapshots
- package.json / name
- Locked System Precedence / Opt-In Design-System Locking
- Astryx UI Workflow / Claude Project Instructions
- Security Invoker Dashboard Read Contracts / Dashboard Monthl
- Churn Rate by Contract Length Chart / Churn Rate by Contract
- Floating Navigation Four Laws / Floating-on-Scroll Morph Nav
- Inline Command Search Pill / Hidden Command-Palette Navigati
- Constant-Height Navigation Morph / Floating Navigation Cross
- Dataverse AI Wordmark Timestamped Copy / Dataverse AI Red Do
- Next.js Documentation Rule / Next.js Wordmark
- Optimistic Update with Rollback / Silent Success
- next.config.ts / nextConfig
- Placeholder Boxplots WebP Asset / Placeholder Heatmap WebP A
- tailwind.config.ts / config
- TypeScript Configuration / Vitest Configuration
- Product Card Grid
- Wordmark and Two-Link Navigation
- Side-Rail Navigation
- Specimen Macrostructure
- Map Diagram Macrostructure
- Document File Icon
- Globe Icon
- Dataverse AI Wordmark
- tb_trial_balance
- tb_tally_trial_balance_snapshots

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Get Public Environment` - 15 edges
3. `Executive Financial Dashboard` - 12 edges
4. `Create Supabase Server Client` - 12 edges
5. `Macrostructure Catalog` - 12 edges
6. `Header` - 10 edges
7. `List Organizations` - 10 edges
8. `List Companies` - 10 edges
9. `Get Dashboard Data` - 10 edges
10. `Get Trial Balance Data` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Tailwind Theme Configuration` --conceptually_related_to--> `High-Agency Frontend Skill`  [INFERRED]
  tailwind.config.ts → .agents/skills/design-taste-frontend-v1/SKILL.md
- `Next.js Wordmark` --conceptually_related_to--> `Next.js Documentation Rule`  [INFERRED]
  public/next.svg → AGENTS.md
- `TallyOne AI Wordmark` --conceptually_related_to--> `TallyBridge Executive Dashboard`  [INFERRED]
  public/5e4a8a19-f7b5-4e29-89a9-ad9d693b6111.png → README.md
- `Browser Window Icon` --conceptually_related_to--> `Data Insights Chat`  [INFERRED]
  public/window.svg → src/assets/ai chat.png
- `Handle Logout` --semantically_similar_to--> `Sidebar`  [INFERRED] [semantically similar]
  src/components/ui/Header.tsx → src/components/ui/Sidebar.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Company Context Navigation Flow** — src_app_dashboard_page_dashboardpage, src_components_dashboard_selector_dashboardselector, src_app_dashboard_overview_page_overviewpage, src_components_dashboard_dashboard, src_app_dashboard_trial_balance_page_trialbalancepage, src_app_dashboard_ledger_page_ledgerpage [INFERRED 0.85]
- **Supabase Authentication Flow** — src_app_login_page_loginpage, src_app_login_page_submit, src_app_auth_signout_route_post, package_supabase_integration [EXTRACTED 1.00]
- **Ledger Detail Data Flow** — src_app_dashboard_ledger_page_ledgerpage, src_components_ledger_detail_ledgerdetail, src_app_api_ledger_route_get, src_app_api_ledger_route_company_scoped_ledger_query, src_app_api_ledger_route_voucher_line_pagination [EXTRACTED 1.00]
- **Authenticated Supabase Request Flow** — src_middleware_middleware, src_lib_env_getpublicenv, src_lib_supabase_server_createsupabaseserverclient, src_lib_types_database [INFERRED 0.95]
- **Dashboard Reporting Data Flow** — src_lib_data_getdashboarddata, supabase_migrations_20260801000000_dashboard_movement_totals_tb_dashboard_movement_totals, supabase_migrations_20260727000000_dashboard_read_contracts_tb_dashboard_monthly_movement, supabase_migrations_20260727000000_dashboard_read_contracts_tb_dashboard_voucher_type_counts, src_lib_types_dashboarddata [EXTRACTED 1.00]
- **Trial Balance Reporting Flow** — src_components_trial_balance_trialbalance, src_lib_data_gettrialbalancedata, supabase_migrations_20260804000000_trial_balance_period_movement_tb_trial_balance, src_lib_types_trialbalancedata [INFERRED 0.95]
- **Reconciled Accounting Report Flow** — supabase_migrations_20260806000000_reconciled_history_tb_ledger_balance_snapshots, supabase_migrations_20260806000000_reconciled_history_tb_history_coverage, supabase_migrations_20260807000000_accounting_eligibility_tb_trial_balance, supabase_migrations_20260807000000_accounting_eligibility_tb_ledger_monthly_summary, supabase_migrations_20260807000000_accounting_eligibility_tb_ledger_voucher_lines [EXTRACTED 1.00]
- **Trial Balance Verification Flow** — supabase_migrations_20260807000000_accounting_eligibility_tb_trial_balance, supabase_migrations_20260806010000_tally_verification_snapshots_tb_tally_verification_snapshots, supabase_migrations_20260806020000_tally_trial_balance_snapshots_tb_tally_trial_balance_snapshots, supabase_migrations_20260807000000_accounting_eligibility_tb_trial_balance_verification [INFERRED 0.85]
- **Hallmark Design Governance Flow** — agents_skills_hallmark_skill_pre_flight_scan, agents_skills_hallmark_skill_design_context_gate, agents_skills_hallmark_skill_macrostructure_selection, agents_skills_hallmark_skill_project_memory_rotation, agents_skills_hallmark_skill_theme_route, agents_skills_hallmark_skill_hero_enrichment_hierarchy, agents_skills_hallmark_skill_slop_test [EXTRACTED 1.00]
- **Product Visual Proof Patterns** — agents_skills_hallmark_references_components_f5_annotated_screenshot_annotated_screenshot, agents_skills_hallmark_references_components_h2_split_diptych_split_diptych_hero, agents_skills_hallmark_references_components_h7_demo_video_clipped_by_viewport_edge_clipped_demo_video_hero, agents_skills_hallmark_references_components_h8_mockup_split_browser_framed_browser_framed_mockup_hero [INFERRED 0.85]
- **Editorial Correspondence Page Voice** — agents_skills_hallmark_references_components_h5_letter_hero_letter_hero, agents_skills_hallmark_references_components_ft6_letter_close_letter_close_footer, agents_skills_hallmark_references_components_ft1_mast_headed_mast_headed_footer [INFERRED 0.75]
- **Quiet Editorial Footer Family** — agents_skills_hallmark_references_components_ft1_mast_headed_mast_headed_footer, agents_skills_hallmark_references_components_ft2_inline_rule_single_line_inline_rule_footer, agents_skills_hallmark_references_components_ft4_dense_typographic_dense_typographic_footer [INFERRED 0.85]
- **Hallmark Navigation Pattern Family** — agents_skills_hallmark_references_components_n11_mega_menu_mega_menu_panel, agents_skills_hallmark_references_components_n12_banner_retract_announcement_banner_retracting_nav, agents_skills_hallmark_references_components_n13_inline_cmdk_pill_inline_command_search_pill, agents_skills_hallmark_references_components_n1b_saas_three_section_canonical_saas_three_section, agents_skills_hallmark_references_components_n2_floating_chip_floating_chip, agents_skills_hallmark_references_components_n3_side_rail_side_rail, agents_skills_hallmark_references_components_n4_hidden_behind_k_hidden_command_palette_navigation, agents_skills_hallmark_references_components_n5_floating_pill_floating_pill_navigation, agents_skills_hallmark_references_components_n6_newspaper_masthead_newspaper_masthead, agents_skills_hallmark_references_components_n7_brutal_slab_brutal_slab_navigation, agents_skills_hallmark_references_components_n8_terminal_command_terminal_command_navigation, agents_skills_hallmark_references_components_n9_edge_aligned_minimal_edge_aligned_minimal_navigation [INFERRED 0.95]
- **Hallmark Section Heading Pattern Family** — agents_skills_hallmark_references_components_s1_left_margin_numbered_left_margin_numbered_heading, agents_skills_hallmark_references_components_s2_hanging_hanging_heading, agents_skills_hallmark_references_components_s3_sticky_pinned_sticky_pinned_heading, agents_skills_hallmark_references_components_s4_inline_no_break_inline_no_break_heading, agents_skills_hallmark_references_components_s5_bottom_anchored_bottom_anchored_heading [INFERRED 0.95]
- **Hallmark Social Proof Pattern Family** — agents_skills_hallmark_references_components_t1_pull_quote_with_marginalia_pull_quote_with_marginalia, agents_skills_hallmark_references_components_t2_logo_wall_hairline_hairline_logo_wall, agents_skills_hallmark_references_components_t3_single_huge_quote_single_huge_quote, agents_skills_hallmark_references_components_t4_numbered_stat_strip_numbered_stat_strip [INFERRED 0.95]
- **Custom Theme Portability Flow** — agents_skills_hallmark_references_custom_theme_custom_theme_protocol, agents_skills_hallmark_references_custom_theme_oklch_palette_construction, agents_skills_hallmark_references_custom_theme_custom_axis_computation, agents_skills_hallmark_references_design_md_portable_design_system, agents_skills_hallmark_references_export_formats_tokens_css_source_of_truth [EXTRACTED 1.00]
- **Hero Enrichment Decision Flow** — agents_skills_hallmark_references_hero_enrichment_image_need_detection, agents_skills_hallmark_references_hero_enrichment_enrichment_hierarchy, agents_skills_hallmark_references_custom_craft_custom_craft, agents_skills_hallmark_references_imagery_kit_hallmark_imagery_kit, agents_skills_hallmark_references_hero_enrichment_hero_space_discipline [EXTRACTED 1.00]
- **Core Macrostructure Family** — agents_skills_hallmark_references_macrostructures_01_bento_grid_bento_grid, agents_skills_hallmark_references_macrostructures_02_long_document_long_document, agents_skills_hallmark_references_macrostructures_03_marquee_hero_marquee_hero, agents_skills_hallmark_references_macrostructures_04_stat_led_stat_led, agents_skills_hallmark_references_macrostructures_05_workbench_workbench, agents_skills_hallmark_references_macrostructures_06_conversational_faq_conversational_faq, agents_skills_hallmark_references_macrostructures_07_manifesto_manifesto [EXTRACTED 1.00]
- **Interaction Quality System** — agents_skills_hallmark_references_microinteractions_microinteraction_model, agents_skills_hallmark_references_microinteractions_timing_and_easing_canon, agents_skills_hallmark_references_microinteractions_reduced_motion_first_class_state, agents_skills_hallmark_references_microinteractions_keyboard_first_hover_second, agents_skills_hallmark_references_motion_motion_language [INFERRED 0.95]
- **Hallmark Pre-Emit Quality Pipeline** — agents_skills_hallmark_references_slop_test_pre_emit_self_critique, agents_skills_hallmark_references_slop_test_slop_test_58_gates, agents_skills_hallmark_references_responsive_mobile_non_negotiables, agents_skills_hallmark_references_structure_anti_repetition_rule [INFERRED 0.95]
- **Design DNA Extraction Flow** — agents_skills_hallmark_references_study_remote_url_safety, agents_skills_hallmark_references_study_five_step_design_extraction, agents_skills_hallmark_references_study_diagnosis_report, agents_skills_hallmark_references_study_design_md_emission_consent [EXTRACTED 1.00]
- **Hallmark Theme Catalog** — agents_skills_hallmark_references_themes_cobalt_cobalt_theme, agents_skills_hallmark_references_themes_hum_hum_theme, agents_skills_hallmark_references_themes_lumen_lumen_theme, agents_skills_hallmark_references_typography_typography_system [INFERRED 0.95]
- **Dashboard Visual Asset Set** — public_5e4a8a19_f7b5_4e29_89a9_ad9d693b6111_tallyone_ai_wordmark, public_bar_chart_churn_rate_by_contract_length, public_src_assets_ai_chat_data_insights_chat_intro, public_src_assets_ask_question_data_chat_answer, public_src_assets_bar_chart_churn_rate_by_contract_length, public_src_assets_csv_csv_download_icon, public_src_assets_dataverse_ai_high_resolution_logo_transparent_8_49_12_am_dataverse_ai_wordmark [INFERRED 0.85]
- **Project Design Governance** — agents_skills_hallmark_references_verbs_audit_hallmark_audit, agents_skills_hallmark_references_verbs_redesign_hallmark_redesign, agents_skills_high_end_visual_design_skill_high_end_visual_design, agents_astryx_ui_workflow, readme_dashboard_design_foundation [INFERRED 0.85]
- **Placement Insights Chat Flow** — src_assets_ai_chat_data_insights_chat, src_assets_ai_chat_suggested_placement_questions, src_assets_ai_chat_chat_input_composer, src_assets_ask_question_google_placement_query, src_assets_ask_question_google_placement_results, src_assets_ask_question_assistant_self_correction [INFERRED 0.85]
- **Dataverse AI Visual Identity** — src_assets_dataverse_ai_high_resolution_logo_transparent_dataverse_ai_wordmark, src_assets_dataverse_ai_high_resolution_logo_transparent_dataverse_ai_red_dot, src_assets_dataverse_ai_high_resolution_logo_transparent_8_49_12_am_dataverse_ai_wordmark_copy [EXTRACTED 1.00]
- **Data Analysis Visual Assets** — src_assets_ai_chat_placement_data_analysis, public_src_assets_bar_chart_churn_rate_by_contract_length, public_src_assets_csv_csv_download_icon, src_assets_mx2lljsona_digital_analysis_workspace [INFERRED 0.65]

## Communities (44 total, 16 thin omitted)

### Community 0 - "Supabase Integration / Company-Scoped Ledger Query"
Cohesion: 0.08
Nodes (30): Supabase Integration, Company-Scoped Ledger Query, Ledger Detail API GET, Voucher Line Pagination and Search, Sign-Out API POST, Ledger Page, Ledger Summary Loading State, Trial Balance Loading State (+22 more)

### Community 1 - "ledger/route.ts / dashboard-selector.tsx"
Cohesion: 0.09
Nodes (38): DashboardSelectorProps, As Of Form, formatBalance(), Ledger Monthly, money, Period Form, Query String Builder, Trial Balance (+30 more)

### Community 2 - "Action-Specific Microcopy / Copy Discipline"
Cohesion: 0.06
Nodes (45): Action-Specific Microcopy, Copy Discipline, Instructional Error Messages, Tone-Specific Voice, Custom Craft, Tier C Declarative Animation, Generated Still Discipline, Tier B Hand-Built SVG (+37 more)

### Community 3 - "@astryxdesign/core / @astryxdesign/theme-neutral"
Cohesion: 0.05
Nodes (41): @astryxdesign/core, @astryxdesign/theme-neutral, autoprefixer, clsx, framer-motion, lucide-react, next, next-themes (+33 more)

### Community 4 - "Anti-Slop Design / Motion-Engine Bento 2.0"
Cohesion: 0.06
Nodes (39): Anti-Slop Design, Motion-Engine Bento 2.0, Design Variance Motion Intensity and Visual Density, High-Agency Frontend Skill, Interactivity Isolation, AI Design Tells, AI Navigation and Footer Fingerprints, Default-Attractor Sameness (+31 more)

### Community 5 - "overview/page.tsx / Dashboard Overview Page"
Cohesion: 0.12
Nodes (27): Dashboard Overview Page, Dashboard Workspace Selection Page, Monthly Ledger Page, Trial Balance Page, Automated MIS Reports, Automated Email Triggers, TallyOne AI Landing Page, Natural-Language Financial Analysis (+19 more)

### Community 6 - "@astryxdesign/cli / eslint"
Cohesion: 0.06
Nodes (31): @astryxdesign/cli, eslint, eslint-config-next, jsdom, devDependencies, @astryxdesign/cli, eslint, eslint-config-next (+23 more)

### Community 7 - "dom / dom.iterable"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 8 - "Cobalt Theme / Code as Hero"
Cohesion: 0.08
Nodes (28): Cobalt Theme, Code as Hero, Working Command Palette, Hum Theme, Multi-Accent Surface System, Hum Not-AI Discipline, Physical Button Press Feedback, Lumen Apparatus Family (+20 more)

### Community 9 - "Keyboard First Hover Second / Microinteraction Four-Part Mod"
Cohesion: 0.08
Nodes (26): Keyboard First Hover Second, Microinteraction Four-Part Model, Named AI Motion Tells, Reduced Motion as First-Class State, Microinteraction Timing and Easing Canon, Compositor-Safe Motion, Hallmark Motion Language, Page-Load Orchestration (+18 more)

### Community 10 - "Photographic Macrostructure / Quote-Led Macrostructure"
Cohesion: 0.10
Nodes (23): Photographic Macrostructure, Quote-Led Macrostructure, Catalogue Macrostructure, Letter Macrostructure, Index-First Macrostructure, Narrative Workflow Macrostructure, Split Studio Macrostructure, Feature Stack Macrostructure (+15 more)

### Community 11 - "Mega-Menu Panel / Announcement Banner and Retracting Nav"
Cohesion: 0.10
Nodes (22): Mega-Menu Panel, Announcement Banner and Retracting Nav, Canonical SaaS Three-Section Navigation, Floating Navigation Chip, Floating Pill Navigation, Newspaper Masthead, Brutal Slab Navigation, Edge-Aligned Minimal Navigation (+14 more)

### Community 12 - "Step Sequence / Annotated Screenshot"
Cohesion: 0.12
Nodes (21): Step Sequence, Annotated Screenshot, Mast-Headed Footer, Inline-Rule Single-Line Footer, Index-Style Category Footer, Dense Typographic Footer, Statement Footer, Letter-Close Footer (+13 more)

### Community 13 - "eslint.config.mjs / eslintConfig"
Cohesion: 0.12
Nodes (15): eslintConfig, Astryx Design System, Financial Data Visualization, Next.js React Application Stack, TallyBridge Dashboard, PostCSS Configuration, Frontend Design Skills, geistMono (+7 more)

### Community 14 - "Data Insights Chat Introduction / Data Chat Question and Ans"
Cohesion: 0.14
Nodes (16): Data Insights Chat Introduction, Data Chat Question and Answer, CSV Download Icon, Vercel Triangle Logo, Browser Window Icon, Chat Input Composer, Data Insights Chat, Placement Data Analysis (+8 more)

### Community 15 - "tb_history_coverage / tb_ledger_balance_snapshots"
Cohesion: 0.13
Nodes (16): tb_history_coverage, tb_ledger_balance_snapshots, tb_ledger_monthly_summary, tb_ledger_voucher_lines, Reconciled tb_trial_balance, tb_tally_verification_snapshots, tb_trial_balance_verification, tb_dashboard_monthly_movement (+8 more)

### Community 16 - "package.json / name"
Cohesion: 0.17
Nodes (11): name, private, scripts, build, dev, lint, start, test (+3 more)

### Community 17 - "Locked System Precedence / Opt-In Design-System Locking"
Cohesion: 0.36
Nodes (8): Locked System Precedence, Opt-In Design-System Locking, Portable design.md System, DTCG Tokens Export, shadcn/ui Variable Export, Tailwind v4 Theme Export, Token Export Formats, tokens.css Source of Truth

### Community 18 - "Astryx UI Workflow / Claude Project Instructions"
Cohesion: 0.29
Nodes (7): Astryx UI Workflow, Claude Project Instructions, TallyOne AI Wordmark, Dashboard Design Foundation, High-Volume Query Integration Boundary, RLS-Protected Read-Only Security Model, TallyBridge Executive Dashboard

### Community 19 - "Security Invoker Dashboard Read Contracts / Dashboard Monthl"
Cohesion: 0.38
Nodes (7): Security Invoker Dashboard Read Contracts, Dashboard Monthly Movement RPC, Dashboard Voucher Type Counts RPC, Dashboard Movement Totals RPC, Signed Amount Debit Credit Classification, Ledger Voucher Lines View, Dashboard RPC Contract Restoration

### Community 20 - "Churn Rate by Contract Length Chart / Churn Rate by Contract"
Cohesion: 0.67
Nodes (4): Churn Rate by Contract Length Chart, Churn Rate by Contract Length Chart Copy, Annual and Quarterly Churn Parity, Monthly Contract Churn Peak

### Community 21 - "Floating Navigation Four Laws / Floating-on-Scroll Morph Nav"
Cohesion: 0.67
Nodes (3): Floating Navigation Four Laws, Floating-on-Scroll Morph Navigation, Single-DOM Navigation Crossfade

### Community 22 - "Inline Command Search Pill / Hidden Command-Palette Navigati"
Cohesion: 0.67
Nodes (3): Inline Command Search Pill, Hidden Command-Palette Navigation, Terminal Command Navigation

### Community 23 - "Constant-Height Navigation Morph / Floating Navigation Cross"
Cohesion: 0.67
Nodes (3): Constant-Height Navigation Morph, Floating Navigation Cross-Fade Morph, Scroll Handler Discipline

### Community 24 - "Dataverse AI Wordmark Timestamped Copy / Dataverse AI Red Do"
Cohesion: 0.67
Nodes (3): Dataverse AI Wordmark Timestamped Copy, Dataverse AI Red Dot Accent, Dataverse AI Wordmark

## Ambiguous Edges - Review These
- `Placeholder Boxplots WebP Asset` → `Placeholder Heatmap WebP Asset`  [AMBIGUOUS]
  public/boxplots.webp · relation: semantically_similar_to

## Knowledge Gaps
- **175 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+170 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Placeholder Boxplots WebP Asset` and `Placeholder Heatmap WebP Asset`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `Get Public Environment` connect `Supabase Integration / Company-Scoped Ledger Query` to `ledger/route.ts / dashboard-selector.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `Supabase Integration` connect `Supabase Integration / Company-Scoped Ledger Query` to `eslint.config.mjs / eslintConfig`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `dependencies` connect `@astryxdesign/core / @astryxdesign/theme-neutral` to `package.json / name`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `nextConfig`, `name`, `version` to the rest of the system?**
  _175 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Supabase Integration / Company-Scoped Ledger Query` be split into smaller, more focused modules?**
  _Cohesion score 0.07922705314009662 - nodes in this community are weakly interconnected._
- **Should `ledger/route.ts / dashboard-selector.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09082125603864734 - nodes in this community are weakly interconnected._