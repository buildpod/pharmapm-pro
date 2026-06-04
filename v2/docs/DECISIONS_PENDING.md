# Pending Decisions — Spec Implementation Gates

> **Purpose:** All open design questions from the three architectural specs
> (M27 AGENT_AS_RESOURCE, M28 TRANSPARENCY_MODEL, M29 CALENDAR_INTEGRATION),
> collected in one place with a recommendation on each. None block the specs;
> all gate the *first implementation module* of their area. Answer in one pass.
>
> **How to use:** for each, either accept the recommendation (write "✓") or
> override (write your call). Once answered, implementation can start with no
> further back-and-forth.

---

## A — Agent-as-Resource (M27 §9)

| # | Question | Recommendation | Your call |
|---|---|---|---|
| **A1** | `AgentRun` as a top-level store entity, or a sub-entity under the agent Resource? | **Top-level.** Easier filtering + audit; matches the `Document.decisions[]` precedent. | |
| **A2** | API credential storage — encrypted-in-repo, Vault, or out-of-band? | **Encrypted-in-repo for v1**, revisit at M32 (auth/backend). Don't block on infra we don't have yet. | |
| **A3** | Token telemetry pipeline — real-time Claude Code hook, or post-hoc import from vendor console? | **Post-hoc import for v1.** No real-time wiring; backfill `authoritativeCost` from billing API later (PA-20). | |
| **A4** | Multi-project agent cost attribution — split, or attribute to the triggering project? | **Per-run attribution to one project** (the linked task/module's project). Multi-project agents get one Resource record per project. | |
| **A5** | Reviewer assignment — auto-pick (e.g. task stakeholder) or always manual? | **Manual for v1.** Auto-assignment is a later refinement once we see real review patterns. | |

---

## B — Transparency Model / EVM (M28 §11)

| # | Question | Recommendation | Your call |
|---|---|---|---|
| **B1** | PV curve shape — linear spread of each item's budget across its window, or S-curve? | **Linear for v1** (simpler, defensible). S-curve as an opt-in later — implementation projects are genuinely back-loaded, so revisit if forecasts read wrong. | |
| **B2** | Budget granularity for EV — per-task budgets, or per-workstream spread by progress? | **Per-workstream for v1** (far less data entry, coarse but honest). Per-task opt-in for teams that want precision. | |
| **B3** | Default EAC variant for the headline number — EAC₂ (BAC/CPI, PMBOK default) or conservative EAC₃? | **Show the range; headline EAC₂.** But given pharma's risk-averse culture, surface EAC₃ prominently as the "conservative" bound — don't bury it. | |
| **B4** | Confidence score formula — exact weighting of CPI / SPI(t) / forecast-breach into 0–100? | **Define explicitly, document it, no black box.** Draft: `100 × clamp(0.4·min(CPI,1) + 0.4·min(SPI(t),1) + 0.2·(1 − forecastBreach%))`. Tune after first real data. Needs your sign-off on the weighting. | |
| **B5** | Re-baseline trigger policy — what scope-change threshold warrants a new `CostBaseline`? | **Manual + audited only; never automatic.** A re-baseline is a deliberate governance act. | |

---

## C — Calendar Integration (M29 §9)

| # | Question | Recommendation | Your call |
|---|---|---|---|
| **C1** | MVP scope — ship PC-1/2/8 (export + outcomes loop, no backend) now, or wait for M32 backend for full sync? | **Ship PC-1/2/8 now.** Sovereign, backend-free, high value. PC-8 (meeting→decision→task) is the standout — closes an existing loop with zero external dependency. | |
| **C2** | ICS feed hosting (T2) — depends on backend host. Confirm sovereign host? | **Defer until M32 backend chosen** (Hetzner/OVH per earlier discussion). PC-3 waits on that. | |
| **C3** | Per-project vs per-member calendar connection? | **Per-member connection, project-filtered views.** A person connects once; sees their meetings filtered per project. | |
| **C4** | Free/busy granularity — exact busy blocks, or coarse day-level? | **Exact blocks.** More useful for best-time-finding; same privacy posture (we drop titles either way). | |
| **C5** | M365/Google (T5/T6) — build in v1, or stay open-standard-only until a buyer demands proprietary sync? | **Defer T5/T6 until a paying customer needs them.** Lead sovereign; don't spend the modules speculatively. | |

---

## Cross-cutting implementation sequencing (my recommendation)

Once these are answered, the dependency-ordered first build:

1. **PA-1** — generalise `TeamMember` → `Resource { kind }`. Foundational; agents + calendar both hang off it.
2. **PT-1 + PT-2** — `CostBaseline` entity + per-workstream budgets. Foundational for all EVM.
3. **PT-3** — EVM core compute (PV/EV/AC/CV/SV/CPI/SPI) + tests verified vs PMBOK.
4. **PC-8** — meeting→decision→task outcomes loop. Independent high-value win; can slot anywhere.
5. **PA-2/3** — AgentDefinition + AgentRun entities (after Resource.kind exists).
6. Then the surface work (Costs EVM strip, Resources agent tab, dashboard confidence re-grounding) interleaves.

**The convergence point:** Costs page + dashboard. Agents (AI-Compute cost lines),
transparency (EVM + forecast), and the confidence score all meet there. Build the
data layers first (PA-1, PT-1/2/3), then the Costs/dashboard surface absorbs all
three streams at once.

**Gating note:** several P3 items (tamper-evident chain PA-16, AI Gateway PA-17,
CalDAV PC-9, ICS feed PC-3, M365/Google PC-10/11) depend on the **M32 backend**
(Path C). Until M32, the product is demo/pilot-grade — fully functional for
showing + piloting, not yet inspection-grade for regulated production. This is
stated honestly across the specs, not hidden.

---

**Last updated:** 2026-05-21.
**Status:** awaiting Vineet's 15 calls + the NotebookLM UX audit. Implementation
begins once both are in.
