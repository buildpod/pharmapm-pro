# Agent-as-Resource — Architectural Specification

> **Status:** Spec phase, not implemented. Authored M27 (2026-05-21).
> **Sibling specs:** `TRANSPARENCY_MODEL.md` (M28, pending), `CALENDAR_INTEGRATION.md` (M29, pending).
> **Pattern:** Same as `CASCADE_ALGORITHM.md` — formalise the data model + lifecycle + cost flow + open questions BEFORE writing implementation code. Tests will follow the spec; the spec is the source of truth.

This document specifies how AivelloStudio RIM treats AI agents as first-class project resources — same data shape as humans, full cost attribution, full audit trail, surfaced on the Resources / Tasks / Costs / Audit-log surfaces. Every behaviour listed here will have a corresponding implementation module.

---

## 1. Why this matters

Three converging pressures make this a structural product decision, not a feature:

### 1.1 The AI-augmented enterprise

By 2026 every serious enterprise project has at least one AI agent in the delivery loop — for code, for analysis, for documentation, for testing, for report generation. None of the incumbents (MS Project, Primavera, Asana, Monday, Smartsheet) model AI agents as resources. They model "tools" but not "actors with attributed cost and audit footprint." That gap will widen as AI use scales. **First-mover positioning.**

### 1.2 CFO transparency on AI spend

AI compute is now a real cost line on enterprise budgets. CFOs need:
- Total AI spend per project, with per-task / per-workstream / per-module rollup
- Variance vs forecast (AI-runaway projects are real — token budget overshot by 4× is a 2026 horror story)
- Vendor exposure (Anthropic, OpenAI, Google, internal LLMs) so procurement isn't blind-sided
- Attribution of cost to specific outcomes — "$X spent on Z deliverable" not "$X spent in May"

Currently those numbers live in CSP billing dashboards. Auditing them against project outcomes is manual. We close that gap.

### 1.3 CTO accountability

When an AI agent commits a code change, a CTO needs to answer:
- Which agent? Which model? Which prompt class?
- Who reviewed the output? Who approved it?
- What was the cost and the elapsed wall-clock?
- Where in the audit trail does this sit?

Today: it doesn't. Email logs and shell history. **Audit-defensible AI usage** is the product wedge for regulated industries (pharma, finance, defence).

### 1.4 Sovereignty alignment (CADA)

EU CADA's autonomy pillar will create a public-sector cloud-and-AI sovereignty assessment. A PM platform that exposes which AI providers are used, where, for what cost, with audit — slots into that compliance ask cleanly. US-SaaS rivals that bury AI usage inside opaque platform behaviour do not.

---

## 2. Data model

### 2.1 `Resource` — extend with `kind` discriminator

Today we have `TeamMember`. Generalise to `Resource`:

```ts
type ResourceKind = "human" | "ai-agent";

interface Resource {
  id: string;
  kind: ResourceKind;
  name: string;                 // "Vineet Pathak" or "Claude Code (Sonnet 4.7)"
  initials?: string;            // "VP" — humans only
  role?: string;                // human role OR agent capability tag
  projectId: string;
  // human-only
  email?: string;
  region?: string;
  // ai-agent-only
  agentDefinitionId?: string;
  // shared
  hourlyRate?: number;          // for cost rollup (humans = labour rate, agents = derived)
  active: boolean;
  createdDate: string;
  archivedDate?: string;
}
```

`TeamMember` stays as a type alias for `Resource` where `kind === "human"` (preserves existing imports during transition).

### 2.2 `AgentDefinition` — what an AI agent is

```ts
type AgentProvider = "anthropic" | "openai" | "google" | "azure" | "self-hosted" | "other";

interface AgentDefinition {
  id: string;                          // "claude-code-sonnet-47"
  name: string;                        // "Claude Code (Sonnet 4.7)"
  provider: AgentProvider;
  model: string;                       // "claude-sonnet-4-7"
  capabilities: string[];              // ["cascade-engine", "report-writer", ...]
  costModel: AgentCostModel;
  defaultReviewPolicy: "auto" | "human-required" | "human-optional";
  retiredDate?: string;
}

type AgentCostModel =
  | { kind: "per-token"; inputCostPerMTok: number; outputCostPerMTok: number; currency: "USD" | "EUR" | "GBP" }
  | { kind: "per-task"; costPerInvocation: number; currency: "USD" | "EUR" | "GBP" }
  | { kind: "subscription"; monthlyFlat: number; currency: "USD" | "EUR" | "GBP" }
  | { kind: "internal"; notes: string };  // self-hosted; cost rolled up via infra line
```

### 2.3 `AgentRun` — the unit of agent work

Every agent invocation produces exactly one `AgentRun` record.

**M27.1 revision (NotebookLM standards review):** field names align to the
**OpenTelemetry GenAI semantic conventions** so the record drops cleanly into
any observability stack (Datadog, Helicone, LangSmith) without re-mapping.
Token usage is broken out by **cache class** because a single `inputTokens`
field cannot audit prompt-cache economics — and prompt caching is the dominant
cost lever for our own dogfood agent (Claude Code). Cost is explicitly an
**estimate** distinct from the authoritative vendor invoice.

```ts
interface AgentRun {
  id: string;                          // ULID

  // ── OTel GenAI standard attributes (portable to any observability stack) ──
  "gen_ai.provider.name": AgentProvider;   // "anthropic" | "openai" | ...
  "gen_ai.request.model": string;          // "claude-sonnet-4-7"
  "gen_ai.operation.name": string;         // "chat" | "tool_use" | "agent_run"
  "gen_ai.usage.input_tokens": number;     // full (uncached) input tokens
  "gen_ai.usage.output_tokens": number;
  // Cache-class breakdown — provider-specific, mapped to a common shape.
  // Anthropic: cache_creation_input_tokens (1.25× or 2× base) +
  //            cache_read_input_tokens (0.1× base).
  // OpenAI:    prompt_tokens_details.cached_tokens.
  "gen_ai.usage.cache_creation_input_tokens"?: number;
  "gen_ai.usage.cache_read_input_tokens"?: number;
  "gen_ai.usage.cache_ttl"?: "5m" | "1h";  // write-premium tier (Anthropic)

  // ── Cost — estimate vs authoritative ──
  estimatedCost: number;               // client-side, computed via AgentCostModel at run time
  authoritativeCost?: number;          // backfilled from vendor billing API (PA-14); source of truth when present
  costCurrency: "USD" | "EUR" | "GBP";
  durationMs: number;                  // user-perceived application latency (≥ model exec time)

  // ── Business attribution (our application layer — wraps the OTel payload) ──
  agentDefinitionId: string;
  resourceId: string;                  // the Resource of kind: "ai-agent" running it
  projectId: string;
  taskId?: string;                     // linked task (if owned by agent)
  milestoneId?: string;                // or linked milestone (e.g. report generation)
  moduleRef?: string;                  // e.g. "M26.1" — for our own dogfood case

  // ── Forensics — AI Act Art. 12/19, GDPR-safe ──
  promptSummary: string;               // 1-2 sentence human-readable, PII-free summary (display)
  promptHash: string;                  // SHA-256 of the raw prompt — NEVER store cleartext (GDPR)
  policyVersionHash?: string;          // hash of the active rule/guardrail set at run time
  writerSignature?: string;            // HMAC(prev record + this record) — tamper-evident chain (PA-16)

  // ── Outcome ──
  outputArtifactRefs: string[];        // file paths, commit hashes, doc ids touched
  humanReviewStatus: "auto-approved" | "pending" | "approved" | "rejected";
  humanReviewedBy?: string;            // Resource.id (human)
  humanReviewDate?: string;

  // ── When ──
  startedAt: string;
  completedAt: string;
}
```

**Why cache classes matter (concrete):** our M26.1 dogfood run read ~18.5k input
tokens, most of which was repeated file/context across the session. With Anthropic
prompt caching, ~14k of those would be `cache_read_input_tokens` at 0.1× cost, not
full input at 1× — a ~6× cost difference on the input side. A single `inputTokens`
field would over-report the cost by hundreds of percent and make cache-optimisation
invisible to the CFO. This is the single most important correction from the
standards review.

**Why `estimatedCost` vs `authoritativeCost`:** the run-time number is a client-side
estimate from `AgentCostModel`. It WILL drift from the vendor invoice (rounding,
mid-period price changes, cache-tier nuances). We store the estimate for immediate
rollup, then backfill `authoritativeCost` from the provider billing API (PA-14).
Rollups prefer `authoritativeCost` when present, fall back to `estimatedCost`.

### 2.4 Cost-line type extension

Existing cost-line types (per `ContractType` in mockData): `"T&M" | "Fixed" | "Internal"`. Add:

```ts
type ContractType = "T&M" | "Fixed" | "Internal" | "AI-Compute";
```

`"AI-Compute"` cost lines aggregate `AgentRun` cost over a time window. The cost line is the *budgeted envelope* (e.g. "Claude Code — Q3 budget: $5k"). The `AgentRun` records are the *actuals*. Same pattern as labour: budget vs timesheets.

### 2.5 `Audit-log Source` extension

Today: `Source = "user-edit" | "user-inline" | "cascade" | "import" | "system" | "test"`. Add:

```ts
type Source = "user-edit" | "user-inline" | "cascade" | "import" | "system" | "test" | "ai-agent";
```

When an action originates from an agent run, the audit log entry includes:

```ts
interface AuditAction {
  // existing fields...
  source: "ai-agent";
  agentRunId: string;        // backlink to the AgentRun
  agentDefinitionId: string; // denormalised for fast filtering
}
```

**M27.1 — tamper-evidence (EU AI Act Art. 12).** The Act requires automatic,
tamper-evident logging retained ≥ 6 months. For regulated production this means
the audit log is a **hash-chain**: each action carries `writerSignature =
HMAC(secret, previousEntryHash + thisEntry)`. Any retroactive edit breaks the
chain and is detectable. **v1 honesty:** our current audit log is application-layer
and append-only-by-convention, NOT cryptographically tamper-evident. The hash-chain
+ out-of-process write path is a **regulated-production prerequisite** (see §7.1),
not a v1 feature. We document it so the gap is explicit, not hidden.

### 2.6 Task assignee model

Today: `task.owner: string` (initials). Generalise to:

```ts
interface Task {
  // existing fields...
  ownerResourceId: string;             // FK → Resource.id
  ownerKind: "human" | "ai-agent";     // denormalised for fast filtering / iconography
  // owner: string  ← deprecated; computed from Resource.initials or Resource.name
}
```

Same generalisation for milestone owner, document owner.

---

## 3. Lifecycle

### 3.1 Agent registration

1. PM (or admin) adds an agent on the Resources page: pick provider, paste API credentials (encrypted, scoped to project), define cost model, add capability tags.
2. System creates `AgentDefinition` + a `Resource { kind: "ai-agent" }` linked to it.
3. Audit entry: `{ type: "add", entityKind: "resource", source: "user-edit" }`.

### 3.2 Task assignment to an agent

1. PM creates / edits a task, picks an agent from the owner picker (humans + agents in same dropdown, grouped).
2. Task gains `ownerResourceId` + `ownerKind: "ai-agent"`.
3. Per `AgentDefinition.defaultReviewPolicy`, the task may be flagged for mandatory human review on completion.

### 3.3 Agent execution

1. The agent receives the task context (project, dependencies, brief).
2. The agent works. During work it may:
   - Make code commits → logged as actions with `source: "ai-agent" + agentRunId`
   - Update entities → same
   - Generate documents → output artifact refs captured
3. On completion the agent emits a single `AgentRun` record with all token / cost / artifact data.
4. If `humanReviewStatus !== "auto-approved"`, the task is marked "pending review" not "complete."

### 3.4 Human review

1. Reviewer opens the task → sees the agent's `AgentRun` summary + artifact links.
2. Approves or rejects → updates `AgentRun.humanReviewStatus`; updates audit log.
3. Rejection re-queues the task for another agent run (cost stacks).

### 3.5 Cost rollup (continuous)

Whenever an `AgentRun` is persisted:
- Add `costAmount` to the project's running AI-compute total
- Attribute to the linked task / milestone / module
- Update the cost-line actuals for any "AI-Compute" cost line that covers this run's time window + agent

### 3.6 Archiving

When a project closes or an agent is retired:
- Resource flagged `active: false`, `archivedDate` set.
- `AgentRun` records are immutable forever (audit trail).
- Historical cost views must still resolve archived agents and runs.

---

## 4. Cost attribution

### 4.1 Three levels of rollup

| Level | What it answers |
|---|---|
| **Per-run** | "Cascade-resolution run on T15 cost $0.34 — 3,200 input tokens, 1,800 output tokens, 4.1s." |
| **Per-task / per-milestone / per-module** | "M26.1 Tasks-page refactor consumed $X in AI compute across 12 runs (avg $0.18 / run)." |
| **Per-project / per-period / per-agent** | "Veeva RIM project Q3 AI compute: $1,240 across 3 agents. Claude Code: $940. OpenAI GPT: $200. Internal LLM: $100." |

### 4.2 Source of truth for cost values

`AgentRun.costAmount` is stored at run-time (not recomputed). This protects audit integrity if `AgentDefinition.costModel` changes later — historical costs stay frozen. New runs use the new model.

### 4.3 Currency

Single `costCurrency` per run. Project-level rollup uses the project's preferred currency; FX conversion happens at rollup time with rates from a fixed source (we ship monthly rates; admins can override). FX rate used in rollup is captured for audit.

### 4.4 Token budgeting (the controls layer)

Each project can set:
- `aiComputeBudget: { amount: number; currency: string; period: "month" | "quarter" | "project" }`
- Soft cap (warn at 80%) and hard cap (block new runs at 100%; admin override audited)

Without budgeting controls, AI spend is the next "T&M overrun" of regulated projects. This is the CFO-grade piece.

---

## 5. UI surfaces (sketch only — no code)

### 5.1 Resources page

- Two tabs / segmented control: **Humans** · **AI Agents**
- AI Agents tab shows each agent as a card: name, provider chip, capability tags, monthly cost-to-date, count of completed runs, average human-review-approval rate
- Empty state: "Register your first AI agent" + 3-step onboarding

### 5.2 Tasks page — assignee picker

- Owner dropdown now shows two groups: "Team members" and "AI agents"
- Tasks owned by AI agents get a small `🤖` or `AI` chip next to the owner avatar (distinct from human initials)
- Filter: "Owner kind: All / Humans / Agents"

### 5.3 Costs page

- New segment in the budget breakdown: "AI Compute" with its own colour (suggest slate-info to differentiate from labour-amber and vendor-rose)
- Drill from "AI Compute · $1,240" → table of agents with cost rollups → drill into each agent's runs

### 5.4 Audit log

- Filter by `source: "ai-agent"`
- Each agent-sourced row shows agent name + linked `AgentRun.id` (click → full run detail with prompt summary + tokens + cost + artifacts)

### 5.5 Dashboard SteerCo Brief addition

- Existing "Status Blockers" widget gains an "AI runs needing review" count
- Existing "Budget Utilised" KPI breaks out "of which AI Compute: $X (Y%)"

---

## 6. Worked example — our own dogfood case

This is the test of whether the spec works. Let me trace exactly how M26.1 (Tasks page refactor, 916-line rewrite I did) would have been logged.

**Pre-conditions:**
- `Resource { id: "agent-claude-code", kind: "ai-agent", agentDefinitionId: "claude-code-sonnet-47", projectId: "proj-aivello-rim" }`
- `AgentDefinition { id: "claude-code-sonnet-47", name: "Claude Code (Sonnet 4.7)", provider: "anthropic", costModel: { kind: "per-token", inputCostPerMTok: 3, outputCostPerMTok: 15, currency: "USD" } }`

**The session would produce roughly these AgentRun records:**

```
AgentRun {
  id: "01HXYZ..._A",
  agentDefinitionId: "claude-code-sonnet-47",
  resourceId: "agent-claude-code",
  projectId: "proj-aivello-rim",
  moduleRef: "M26.1",
  promptSummary: "Refactor v2/components/tasks/tasks-grid.tsx to new design system",
  inputTokens: 18_500,    // file reads + context
  outputTokens: 14_200,   // rewritten file
  costAmount: 0.27,
  costCurrency: "USD",
  durationMs: 84_000,
  outputArtifactRefs: ["v2/components/tasks/tasks-grid.tsx", "v2/app/styles/tasks.css", "v2/app/(app)/tasks/page.tsx"],
  humanReviewStatus: "approved",
  humanReviewedBy: "vineet-pathak",
  humanReviewDate: "2026-05-19T19:00:00Z",
  startedAt: "2026-05-19T18:45:00Z",
  completedAt: "2026-05-19T18:46:24Z",
}
```

Plus separate runs for the M26.1.1 drawer refactor (~10,000 tokens, $0.16), the M27.0.1 prep work, etc.

**Roll-ups produced:**
- Per-task: "M26.1 cost $0.27 — 1 agent run"
- Per-project: "Veeva RIM consumed $X in AI compute this month across N runs"
- Per-agent: "Claude Code (Sonnet 4.7): $X this month, avg cost/run $Y"

**Audit log entries (also produced):**

Every `replaceAllTasks` / `updateTask` / `addTask` action emitted from that AgentRun gets `source: "ai-agent"` + `agentRunId: "01HXYZ..._A"`. The existing audit-log infrastructure already supports this — just need to extend the `Source` union.

**What this enables:**
- Quarterly review: "Vineet, you spent $X this quarter on AI compute. Here's the breakdown by project and module."
- Per-module ROI: "M26.1 cost $0.27 in compute. Manual estimate: 4 hours of human time = $400+. Outcome: PM productivity 1000×."
- Inspector-ready: "Show me every change made by an AI agent on the Veeva RIM project, with reviewer signoff." → one filter on the audit log.

---

## 7. Non-goals (explicit)

What this spec is NOT trying to do:

- **Build an agent marketplace.** We register agents the customer already has access to. No middleware brokering.
- **Define agent pricing.** We capture what the provider bills. Pricing strategy is a separate product decision.
- **Provide LLM safety / red-teaming.** Output review is human responsibility per `humanReviewStatus`. We log; we don't gatekeep.
- **Replace existing monitoring.** Datadog / LangSmith / vendor consoles stay the source of telemetry truth. We import / link to runs, we don't replace observability stacks.
- **Auto-assign tasks to agents.** PMs assign agents to tasks explicitly. No auto-routing in v1.
- **Compute "AI productivity score."** Tempting; ill-defined; skipping for v1. Can come later with real data.
- **Multi-agent collaboration orchestration.** Out of scope. One agent per task. Sequential or parallel runs are separate records, not a "team" abstraction.
- **FinOps "zombie scope" lifecycle automation** (M27.1 review). Auto-decommissioning, commitment reallocation, scope-exit criteria — FinOps-platform territory, over-engineered for a PM tool. We DO adopt unit-economics (cost-per-outcome); we do NOT build scope lifecycle automation.

### 7.1 Production-architecture gap (stated honestly — M27.1)

The NotebookLM standards review (OTel + EU AI Act + FinOps) flagged that an
**in-application logging layer structurally fails strict compliance audits** —
a compromised or crashed app can suppress or lose audit evidence. The compliant
pattern is an **out-of-process AI Gateway / drop-in proxy** that terminates TLS,
classifies the payload, looks up the active policy, and writes a tamper-evident
log from a position the application cannot modify — all *before* forwarding to the
model.

We are NOT building that in v1. v1 is application-layer logging, append-only by
convention. **This spec states the gap rather than hiding it:** regulated
production use (pharma GxP, the CADA public-sector path) requires the AI Gateway
migration. That migration is gated on the M32 backend (Path C) and is captured as
PA-17. Until then, the product is demo/pilot-grade for AI-agent audit, not
inspection-grade. Being honest about this is itself part of the audit-defensible
positioning — we don't over-claim tamper-evidence we don't yet have.

---

## 8. Punch list — implementation items the spec implies

Ordered by dependency. Each becomes a future module (M30+ candidates).

| ID | Severity | Item | Implementation cost |
|---|---|---|---|
| **PA-1** | P0 | Add `Resource.kind` field; migrate existing `TeamMember` records to `Resource { kind: "human" }`. Backward-compat alias for `TeamMember`. | 1 module |
| **PA-2** | P0 | Add `AgentDefinition` entity to entity store + repository + audit-log `EntityKind`. | 1 module |
| **PA-3** | P0 | Add `AgentRun` entity. Append-only (no update / no delete) — immutable audit record. Repository writes only. | 1 module |
| **PA-4** | P0 | Extend `Source` union with `"ai-agent"` + `agentRunId` field on actions. Touch `audit.ts` + every action emitter. | 1 module |
| **PA-5** | P0 | Extend `ContractType` with `"AI-Compute"`. Costs page accepts the new type. | 0.5 module |
| **PA-6** | P1 | Generalise task / milestone / document `owner` field to `ownerResourceId` + `ownerKind`. Migration adapter for existing data. | 1 module (touches many files) |
| **PA-7** | P1 | Resources page UI: Humans + Agents tabs. Agent card. Empty state. | 1 module |
| **PA-8** | P1 | Tasks assignee picker: grouped dropdown. `🤖` chip on agent-owned rows. Owner-kind filter. | 0.5 module |
| **PA-9** | P1 | Costs page: AI Compute segment + agent drill-down + run drill-down. | 1 module |
| **PA-10** | P2 | Audit log filter UI: source = ai-agent, agent name, agent run drill. | 0.5 module |
| **PA-11** | P2 | Project-level AI budget settings + soft/hard cap + cap-exceeded toast. | 1 module |
| **PA-12** | P2 | Dashboard SteerCo Brief integration — AI runs needing review count, Budget Utilised breakdown. | 0.5 module |
| **PA-13** | P3 | FX rates table + project preferred currency + rollup FX conversion. | 0.5 module |
| **PA-14** | P3 | Provider-specific cost-model imports (Anthropic billing API, OpenAI usage API, etc.) for actual-vs-stored variance. | 1 module per provider |
| **PA-15** | P3 | Retrofit Claude Code's session-level token telemetry into AgentRun emission for our own dogfood. | 1 module + tooling |
| **PA-16** | P2 | Tamper-evident audit chain: `writerSignature = HMAC(prev hash + entry)` on every action. AI Act Art. 12. (M27.1) | 1 module |
| **PA-17** | P1 (regulated-prod gate) | Out-of-process AI Gateway / proxy for compliant identity + payload-classification + audit-write. Gated on M32 backend. AI Act Art. 19. (M27.1) | 2-3 modules + infra |
| **PA-18** | P2 | OTel GenAI field naming on AgentRun; cache-class token breakdown (cache-create / cache-read / full). (M27.1) | folded into PA-3 |
| **PA-19** | P3 | `promptHash` (SHA-256) instead of cleartext prompt storage; GDPR derivative-liability avoidance. (M27.1) | folded into PA-3 |
| **PA-20** | P2 | `authoritativeCost` backfill from vendor billing APIs (Anthropic / OpenAI usage endpoints); rollup prefers authoritative over estimate. (M27.1) | overlaps PA-14 |
| **PA-21** | P3 | Unit-economics rollup: cost-per-outcome / cost-per-decision metric (FinOps for AI). (M27.1) | 0.5 module |

**Aggregate effort:** roughly **9–11 focused modules** to get the full spec implemented. P0 + P1 covers a usable MVP at 6 modules.

---

## 9. Open design questions (need Vineet's call before implementation)

1. **Should `AgentRun` be a top-level entity in the store, or a sub-entity under the agent Resource?** Top-level gives easier filtering and audit; sub-entity is cleaner data model. Recommendation: top-level (matches `Document.decisions[]` precedent).
2. **API credential storage.** Encrypted in the entity repo? Vault integration? Out-of-band? — affects backend choice (Path C). Spec assumes encrypted-in-repo for v1; revisit when M32 (auth + multi-tenant) lands.
3. **Token telemetry pipeline.** For Claude Code self-instrumentation we'd need either a Claude Code hook that emits to our audit log, or post-hoc import from Anthropic console. Recommendation: post-hoc import for v1 (no real-time wiring needed).
4. **One project / multi-project budget overlap.** If an agent works across multiple projects, do we split cost or attribute to whichever task triggered the run? Spec assumes per-run attribution to one project (the one referenced by the linked task / module). Multi-project agents have multiple Resource records, one per project.
5. **Reviewer assignment.** Should the system pick a human reviewer automatically (e.g. task's stakeholder), or always require explicit assignment? Spec leaves it manual for v1; auto-assignment is M40+ candidate.

These questions DO NOT block writing the spec — but they DO need answers before implementation modules ship.

---

## 10. Standards alignment (M27.1 — added after NotebookLM review)

This spec was cross-checked against current industry standards. Where the
original draft diverged, it was corrected. Summary of what changed and why:

| Standard | Original draft | Corrected to | Status |
|---|---|---|---|
| **OpenTelemetry GenAI semantic conventions** | `inputTokens` / `outputTokens` ad-hoc | `gen_ai.usage.*`, `gen_ai.request.model`, `gen_ai.provider.name`, `gen_ai.operation.name` + business fields wrapping the OTel payload | ✅ Adopted (§2.3) |
| **Prompt-cache economics** (Anthropic / OpenAI billing) | single `inputTokens` | `cache_creation_input_tokens` + `cache_read_input_tokens` + full input, with TTL tier | ✅ Adopted — the most material correction (§2.3) |
| **Estimate vs invoice** | `costAmount` (implied authoritative) | `estimatedCost` + `authoritativeCost?` backfilled from vendor API | ✅ Adopted (§2.3, PA-20) |
| **EU AI Act Art. 12** (tamper-evident logging) | append-only by convention | hash-chain `writerSignature`; v1 gap stated honestly | ✅ Documented; PA-16; gated on backend |
| **EU AI Act Art. 19 + GDPR** (no cleartext prompts) | `promptSummary` only | `promptHash` (SHA-256) + PII-free `promptSummary`; `policyVersionHash` | ✅ Adopted (§2.3, PA-19) |
| **AI Gateway / proxy pattern** | in-app SPI | out-of-process gateway as the regulated-production target | ✅ Documented as gap (§7.1, PA-17) |
| **FinOps for AI — unit economics** | per-task cost only | + cost-per-outcome / cost-per-decision | ✅ Adopted (PA-21) |
| **FinOps for AI — scope lifecycle automation** | n/a | considered, rejected | ❌ Non-goal (§7) — over-engineered for a PM tool |
| **Verified subject at TLS boundary** | n/a | needed for regulated prod | ⏸ Deferred — depends on M32 auth |

**Sources reviewed (via NotebookLM synthesis, 2026-05-21):**
- OpenTelemetry GenAI semantic conventions
- FinOps Foundation — FinOps for AI (2026 framework)
- EU AI Act Articles 12, 19, 20
- NIST AI RMF 1.0 + Generative AI Profile
- Anthropic + OpenAI usage / billing API docs (cache-token classes)
- AI observability field practice (Helicone / LangSmith)

**Honest framing of the v1 → regulated-prod gap:** v1 (demo / pilot) uses
application-layer logging and client-side cost estimates. Regulated production
(pharma GxP, CADA public-sector) requires PA-16 (tamper-evident chain) + PA-17
(out-of-process gateway) + PA-20 (authoritative cost) + M32 (auth for verified
subject). We surface this gap deliberately — under-claiming audit-grade we don't
yet have is part of the audit-defensible positioning.

---

**Last updated:** 2026-05-21 (M27.1 standards-alignment revision; still no implementation).
**Next:** Vineet reviews + answers §9's 5 open questions. Then M28 = `TRANSPARENCY_MODEL.md`, M29 = `CALENDAR_INTEGRATION.md`. After all three specs locked, implementation starts with PA-1.
