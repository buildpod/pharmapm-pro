# Calendar Integration — Architectural Specification

> **Status:** Spec phase, not implemented. Authored M29 (2026-05-21).
> **Sibling specs:** `AGENT_AS_RESOURCE.md` (M27, ✅), `TRANSPARENCY_MODEL.md` (M28, ✅).
> **Pattern:** M20.4 — data model + lifecycle + worked example BEFORE code.
> **Standards basis:** RFC 5545 (iCalendar), RFC 4791 (CalDAV), Microsoft Graph Calendar API, Google Calendar API. These are stable, well-documented standards — no external synthesis round needed.

This document specifies how AivelloStudio RIM connects project meetings and team availability to the calendars people actually live in — **without compromising the EU-sovereignty positioning**. The design leads with open standards (iCalendar / CalDAV) so the product works for sovereignty-conscious EU buyers with zero US-SaaS dependency, and offers M365 / Google as optional plugins for enterprises already committed to those stacks.

---

## 1. Why this matters

### 1.1 The gap today

Resources page has `RecurringMeeting` records (title, cadence, attendees) and `Absence` records. They are **islands** — they don't appear in anyone's real calendar, and the team's real calendars don't inform the project. A PM schedules a SteerCo in the tool, then manually re-creates it in Outlook. Double entry; drift; missed meetings.

### 1.2 What "true sync" requires

Three honest levels, increasing in cost and capability:
1. **Push out** — project meetings appear in members' calendars (one-way, us→them)
2. **Pull in** — members' availability appears in the project (one-way, them→us)
3. **Two-way** — changes in either place reconcile

Plus the *value-add* the incumbents miss: **meeting → decision → task lineage** (a SteerCo produces decisions and actions; those should flow into the Decisions register + Tasks automatically) and **capacity/load** (who is over-committed across meetings + delivery work).

### 1.3 Sovereignty rationale (CADA)

EU CADA's autonomy pillar will push public-sector + regulated buyers toward sovereignty-assessed tooling. A calendar integration that **defaults to open standards (iCalendar / CalDAV) hosted on EU infrastructure**, with US-SaaS calendar APIs as clearly-optional plugins, is CADA-aligned by construction. The opposite — hard-wiring Google/Microsoft as the only path — is exactly the US-dependency CADA discourages. **Lead open; offer proprietary.**

---

## 2. Integration tiers

Implement in this order. Each tier is independently shippable and useful.

| Tier | Direction | Standard | Dependency | Sovereignty |
|---|---|---|---|---|
| **T1 — ICS export** | us → them | RFC 5545 | none (file generation) | ✅ pristine |
| **T2 — ICS feed subscribe** | us → them (live) | RFC 5545 webcal | none (we host a feed URL) | ✅ pristine |
| **T3 — ICS feed import** | them → us (read) | RFC 5545 | none (parse published feeds) | ✅ pristine |
| **T4 — CalDAV two-way** | both | RFC 4791 | CalDAV server (Nextcloud, Radicale — EU self-hostable) | ✅ EU-sovereign |
| **T5 — M365 Graph** | both | MS Graph API | Microsoft OAuth | ⚠️ US-SaaS, optional plugin |
| **T6 — Google Calendar** | both | Google Calendar API | Google OAuth | ⚠️ US-SaaS, optional plugin |

**T1–T4 cover the sovereignty path completely.** T5/T6 are pragmatic additions for enterprises already locked into those ecosystems — gated behind an explicit "connect external calendar (US-hosted)" action so the choice is conscious.

---

## 3. Data model

### 3.1 Extend `RecurringMeeting`

```ts
interface RecurringMeeting {
  // existing: id, title, cadence, attendees, projectId...
  // NEW:
  startDateTime?: string;        // ISO 8601 with timezone
  durationMinutes?: number;
  timezone?: string;             // IANA tz, e.g. "Europe/Berlin"
  rrule?: string;                // RFC 5545 RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO"
  location?: string;             // room or video link
  externalRefs?: ExternalCalendarRef[];  // mirror ids in synced calendars
  producesDecisions?: boolean;   // SteerCo-type meetings flag this
}
```

### 3.2 New: `CalendarLink` — a member's connected calendar

```ts
type CalendarProvider = "ics-feed" | "caldav" | "m365" | "google";

interface CalendarLink {
  id: string;
  resourceId: string;            // the person (Resource, kind: "human")
  projectId: string;
  provider: CalendarProvider;
  direction: "in" | "out" | "two-way";
  // connection
  feedUrl?: string;              // ICS feed / CalDAV collection URL
  credentialRef?: string;        // encrypted ref for CalDAV/OAuth (never plaintext)
  // sovereignty flag surfaced in UI
  isUSHosted: boolean;           // true for m365/google — shown to the user
  lastSyncedAt?: string;
  syncStatus: "ok" | "stale" | "error";
  active: boolean;
}
```

### 3.3 New: `AvailabilityBlock` — derived, read-only

```ts
interface AvailabilityBlock {
  resourceId: string;
  startDateTime: string;
  endDateTime: string;
  kind: "busy" | "tentative" | "out-of-office";
  sourceCalendarLinkId: string;  // provenance
  // we store free/busy only — NEVER meeting titles/content from
  // imported calendars (privacy + GDPR: we don't need the content)
}
```

**Privacy principle:** when importing a member's calendar, we ingest **free/busy
only** — start/end/busy-state. We never store the titles or content of their
personal meetings. This is both a GDPR data-minimisation stance and a trust
signal.

---

## 4. Lifecycle

### 4.1 ICS export (T1)

1. PM clicks "Export to calendar" on a meeting (or the whole project schedule).
2. System generates an RFC 5545 `.ics` file with `VEVENT` blocks (incl. RRULE
   for recurring) and triggers download.
3. User imports into any calendar app. One-time snapshot.

### 4.2 ICS feed subscribe (T2)

1. System exposes a per-project (or per-member) `webcal://` feed URL.
2. User subscribes once in their calendar app.
3. Calendar app polls the feed; project meeting changes propagate automatically.
4. No credentials needed (feed is a read-only signed URL).

### 4.3 ICS / CalDAV import (T3/T4)

1. Member adds a `CalendarLink` (feed URL or CalDAV collection + encrypted creds).
2. System polls (T3) or syncs (T4) and derives `AvailabilityBlock` records
   (free/busy only).
3. Availability surfaces in the project's scheduling views.

### 4.4 M365 / Google (T5/T6 — optional)

1. Member clicks "Connect external calendar" → explicit warning: "this provider
   is US-hosted; availability data will sync via [Microsoft/Google]."
2. OAuth flow → token stored encrypted (`credentialRef`).
3. Two-way sync via the provider API.

### 4.5 Meeting → Decision → Task flow (the value-add)

For meetings flagged `producesDecisions: true` (SteerCo, CCB, design reviews):
1. After the meeting, the PM opens a "Meeting outcomes" panel.
2. Captures: decisions made → each creates a `DecisionRecord` (M25) pre-linked to
   the meeting; action items → each creates a `Task` with owner + due date.
3. The meeting record now shows "produced: 3 decisions, 5 actions" with links.
4. Closes the loop: our Decisions register currently has no inbound flow from
   meetings; this is it.

### 4.6 Capacity / load view

Derived per member from `RecurringMeeting` attendance + `AvailabilityBlock` +
owned-task workload:
- "Vineet: 6h meetings/week + 14 open tasks (3 critical) = high load"
- Availability heatmap across the team → "when can the SteerCo actually gather?"
- Over-commitment flag when one person owns > N critical tasks AND > X meeting
  hours.

---

## 5. UI surfaces (sketch only — no code)

- **Resources page → Meetings:** each meeting gets "Export .ics" + "Connected"
  status. Per-member "Connect calendar" with provider picker (open-standard
  options first, US-hosted options flagged below a divider).
- **New "Schedule" or "Availability" view:** team free/busy heatmap; best-meeting-
  time finder; per-member load bar.
- **Meeting detail → "Outcomes" panel:** capture decisions + actions post-meeting
  → push to Decisions + Tasks.
- **Sovereignty indicator:** any US-hosted calendar link shows a small "US-hosted"
  chip — transparency, not friction.
- **Dashboard tie-in:** "Next SteerCo: 12 Jun · 5 attendees · 2 conflicts" card.

---

## 6. Worked example

> **Setup:** Veeva RIM project. Weekly SteerCo, Mondays 14:00 Europe/Berlin,
> `producesDecisions: true`. Sponsor uses Outlook (M365); PM uses Nextcloud
> (CalDAV); two leads publish ICS feeds.
>
> **Flow:**
> 1. PM creates the SteerCo `RecurringMeeting` with `rrule: FREQ=WEEKLY;BYDAY=MO`.
> 2. Sponsor connects M365 (gets the "US-hosted" chip); PM connects Nextcloud
>    CalDAV (sovereign); leads subscribe to the project ICS feed.
> 3. Availability view shows all four members' free/busy → confirms 14:00 Monday
>    is conflict-free.
> 4. After the meeting, PM opens Outcomes: logs Decision "Approve revised Go-Live
>    2026-09-02" (→ DecisionRecord, pre-linked) + 3 action items (→ Tasks with
>    owners).
> 5. Dashboard "Next SteerCo" card + Decisions register + Tasks all reflect it.
>    Sponsor sees the meeting in Outlook; leads see it in their apps. No double
>    entry.

---

## 7. Non-goals (explicit)

- **Full calendar app.** We are not building a calendar UI to rival Outlook. We
  sync + surface availability; people keep their own calendar app.
- **Storing meeting content from imported calendars.** Free/busy only (§3.3).
- **Video conferencing.** We store a link; we don't host calls.
- **Scheduling-assistant AI.** Best-time-finder is deterministic free/busy
  intersection, not an AI agent (that would be an M27 AgentRun if ever added).
- **Room/resource booking systems.** Out of scope; we reference a location string.
- **Real-time push (websockets).** Polling cadence is fine for project meetings;
  sub-minute sync is unnecessary.

---

## 8. Punch list — implementation items

| ID | Severity | Item | Cost |
|---|---|---|---|
| **PC-1** | P1 | Extend `RecurringMeeting` (startDateTime, duration, tz, rrule, location). Migration for existing records. | 0.5 module |
| **PC-2** | P1 | T1 ICS export — RFC 5545 VEVENT generation + download. Per-meeting + whole-project. | 1 module |
| **PC-3** | P2 | T2 ICS feed — hosted signed webcal feed URL per project/member. (Needs backend — gated on M32.) | 1 module |
| **PC-4** | P2 | T3 ICS import + `AvailabilityBlock` derivation (free/busy only). | 1 module |
| **PC-5** | P2 | `CalendarLink` entity + Resources UI to connect/manage, with US-hosted flag. | 1 module |
| **PC-6** | P2 | Availability heatmap + best-time finder (deterministic free/busy intersection). | 1 module |
| **PC-7** | P2 | Capacity/load view (meetings + owned-task workload + over-commit flag). | 1 module |
| **PC-8** | P1 | Meeting→Decision→Task outcomes panel (closes the Decisions inbound loop). High value, no external dep. | 1 module |
| **PC-9** | P3 | T4 CalDAV two-way (Nextcloud/Radicale). Gated on M32 backend + credential store. | 2 modules |
| **PC-10** | P3 | T5 M365 Graph plugin (OAuth, two-way). Optional, US-hosted. | 2 modules |
| **PC-11** | P3 | T6 Google Calendar plugin (OAuth, two-way). Optional, US-hosted. | 2 modules |
| **PC-12** | P3 | Dashboard "Next meeting" card + conflict count. | 0.5 module |

**Aggregate:** ~13–15 modules full; but **PC-1 + PC-2 + PC-8 = a genuinely useful
MVP at ~2.5 modules** with zero backend dependency and full sovereignty. PC-8
(meeting→decision→task) is the highest value-per-effort — it needs no calendar
sync at all, just closes an existing loop.

---

## 9. Open design questions (need Vineet's call before implementation)

1. **MVP scope** — ship PC-1/2/8 first (export + outcomes loop, no backend), or
   wait for M32 backend to do the full sync story? Recommendation: PC-1/2/8 now;
   they're sovereign, backend-free, and high-value.
2. **Feed hosting** — ICS feeds (T2) need a hosted URL → depends on M32 backend
   choice (Hetzner/OVH). Confirm sovereign host before PC-3.
3. **Per-project vs per-member calendars** — does a member connect once
   (all projects) or per-project? Recommendation: per-member connection,
   project-filtered views.
4. **Free/busy granularity** — store exact busy blocks, or coarse day-level
   availability? Recommendation: exact blocks (more useful, same privacy posture
   since we drop titles).
5. **M365/Google priority** — build these at all in v1, or stay open-standard-
   only until a buyer demands proprietary sync? Recommendation: defer T5/T6 until
   a paying customer needs them; lead sovereign.

---

**Last updated:** 2026-05-21 (spec authored, no implementation).
**Status:** All three architectural specs now locked — `AGENT_AS_RESOURCE`,
`TRANSPARENCY_MODEL`, `CALENDAR_INTEGRATION`.
**Next:** Vineet answers the open questions across all three specs + the
NotebookLM UX audit returns. Then implementation begins. Likely first
implementation module: **PA-1 (Resource.kind) + PT-1 (CostBaseline)** as the
foundational data-model pair, since agents + transparency + (eventually)
calendar all hang off a generalised Resource + a frozen baseline. PC-8
(meeting→decision→task) is a strong low-dependency early win.
