# PharmaPM Pro — Project Context for Design

## What it is

A project management tool built specifically for pharma regulatory implementations — Veeva RIM, Veeva Vault, Documentum migrations, GxP / GAMP 5 / FDA / EMA compliance projects. Replaces patchwork of MS Project + Smartsheet + email threads + Confluence pages that pharma PMs currently piece together.

## Who uses it

- **Project Managers** running 6–18-month regulated implementations
- **SteerCo members** (VP Regulatory, VP Quality, Sponsors) reviewing weekly
- **Auditors / inspectors** reading after the fact for FDA / EMA submissions
- **Functional leads** (validation lead, data migration lead, training lead)

Not used by: developers, marketing teams, individual contributors looking for personal task management. Not a consumer app.

## What makes the design hard

1. **Information density requirement** — pharma PMs want to see a lot per screen. 18 tasks visible without scroll, full RAID column on Risks, full RACI breakdown on Documents. Reducing density loses the audience.

2. **Regulatory tone** — this is software that ends up referenced in FDA inspection responses. It cannot read as "fun" or "playful." It must read as audit-defensible.

3. **Status discipline** — every record has state (Open / In Progress / Resolved / Approved / Pending / Superseded / At Risk / Blocked). Status colors must mean ONE thing across the product — rose for blocking, amber for soft conflict, blue for info, emerald for success, slate for neutral.

4. **Plain language** — PMs aren't engineers. No "cascade", "FS-rule", "topological sort", "back-edge" in any UI string. Always "downstream impact", "tasks that loop back", "links between them".

5. **Dependency-aware schedules** — moving a date can cascade through dependent tasks/milestones. The UI must surface that downstream impact before commit, with selective accept/reject per shift. None of the mid-market tools (Asana, Monday, Smartsheet) do this well.

## Comparable products

- **Veeva RIM** — the actual industry incumbent. Dated UI, but feature-rich.
- **MS Project / Primavera P6** — enterprise scheduling. Powerful but old-school.
- **Linear** — best-in-class info density + keyboard-driven workflow. Different domain (software dev) but the right density model.
- **Stripe Dashboard** — financial precision + restrained design. Different domain but the right tone.
- **Smartsheet / Asana / Monday** — these are what we're NOT trying to be. Too consumer-friendly.

## What we're explicitly NOT trying to be

- A landing page for the product
- A marketing showcase
- A Figma portfolio piece
- A consumer-friendly to-do app
- A "fun" or "playful" interface
- Mobile-first (it's desktop-first; mobile gets a thin read-only view)

## The aesthetic target

**Veeva Vault meets Linear meets Stripe Dashboard.** Warm off-white background (not pure white, not blue-gray). Source Serif 4 for serious typographic anchors (page titles, KPI heroes). Inter Tight for everything else. JetBrains Mono for dates / IDs / numerics. Deep teal accent (the design-token color `--color-accent-700`) for primary actions. Navy for the brand. No bootstrap blues, no rainbows.

## What the design system enforces

- 8px spacing grid — strict, no half-pixels
- 5 status colors only (ok / warn / risk / info / neutral) — no inventing
- 3 typeface roles only — display (Source Serif 4), UI (Inter Tight), mono (JetBrains Mono)
- Cards use border OR shadow — never both
- Status pills use only the 5 token classes — no Tailwind ad-hoc colors

## What good looks like

A PM opens the page. Within 3 seconds, they see:
1. Which workstream is on track and which is at risk
2. Where their personal owned tasks sit in the priority order
3. How many days until Go-Live
4. Which decisions are blocked waiting for approvals

If the page can't communicate those four things in 3 seconds, the design has failed regardless of how visually polished it is.
