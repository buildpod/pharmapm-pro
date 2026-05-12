// Mock data for Veeva RIM Implementation — Phase 2
// Used across all dashboard views in M3+

export const project = {
  name: "Veeva RIM Implementation",
  client: "AivelloStudio Demo Corp",
  phase: "Phase 2 — Configuration & Testing",
  startDate: "2026-01-06",
  goLiveDate: "2026-09-02",
  methodology: "GAMP 5 / CSV",
};

// ─── Phases ───────────────────────────────────────────────────────────────────

export type Phase = {
  id: string;
  name: string;
  shortName: string;
  pct: number; // 0–100
  status: "complete" | "active" | "pending";
};

export const phases: Phase[] = [
  { id: "p1", name: "Project Initiation",       shortName: "Initiation",   pct: 100, status: "complete" },
  { id: "p2", name: "Requirements & Design",     shortName: "Design",       pct: 90,  status: "complete" },
  { id: "p3", name: "Configuration & Dev",       shortName: "Config",       pct: 45,  status: "active"   },
  { id: "p4", name: "Testing (IQ/OQ/UAT)",       shortName: "Testing",      pct: 0,   status: "pending"  },
  { id: "p5", name: "Training",                  shortName: "Training",     pct: 0,   status: "pending"  },
  { id: "p6", name: "Go-Live & Hypercare",        shortName: "Go-Live",      pct: 0,   status: "pending"  },
];

// ─── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneStatus = "complete" | "in-progress" | "pending" | "at-risk";

export type Milestone = {
  id: string;
  name: string;
  phase: string;
  plannedDate: string;   // milestone target completion date (= plannedEnd in domain)
  forecastDate: string;
  status: MilestoneStatus;
  locked: boolean;
  owner: string;
  // Scheduling fields (required by cascade / backward-scheduling domain functions)
  predecessor?: string;  // id of predecessor milestone, e.g. "m2"
  duration?: number;     // working days (inclusive: 1 = single day)
  lag?: number;          // extra working-day gap after predecessor.plannedEnd
};

export const milestones: Milestone[] = [
  { id: "m1",  name: "Project Kick-off",                   phase: "Initiation",  plannedDate: "2026-01-12", forecastDate: "2026-01-12", status: "complete",    locked: true,  owner: "VP", duration: 1                                   },
  { id: "m2",  name: "Functional Requirements Approved",   phase: "Design",      plannedDate: "2026-02-14", forecastDate: "2026-02-14", status: "complete",    locked: true,  owner: "VP", duration: 20, predecessor: "m1", lag: 0          },
  { id: "m3",  name: "System Design Document Signed",      phase: "Design",      plannedDate: "2026-03-10", forecastDate: "2026-03-12", status: "complete",    locked: true,  owner: "SL", duration: 10, predecessor: "m2", lag: 2          },
  { id: "m4",  name: "Data Migration Plan Approved",       phase: "Design",      plannedDate: "2026-03-28", forecastDate: "2026-04-04", status: "complete",    locked: false, owner: "AR", duration: 15, predecessor: "m2", lag: 0          },
  { id: "m5",  name: "Vault Configuration — Sprint 1",     phase: "Config",      plannedDate: "2026-04-30", forecastDate: "2026-04-30", status: "complete",    locked: false, owner: "KM", duration: 20, predecessor: "m3", lag: 1          },
  { id: "m6",  name: "Vault Configuration — Sprint 2",     phase: "Config",      plannedDate: "2026-05-30", forecastDate: "2026-06-06", status: "in-progress", locked: false, owner: "KM", duration: 20, predecessor: "m5", lag: 0          },
  { id: "m7",  name: "Design Specification Approval",      phase: "Config",      plannedDate: "2026-06-02", forecastDate: "2026-06-09", status: "at-risk",     locked: false, owner: "VP", duration:  5, predecessor: "m6", lag: 0          },
  { id: "m8",  name: "Configuration Complete",             phase: "Config",      plannedDate: "2026-06-30", forecastDate: "2026-07-07", status: "pending",     locked: false, owner: "KM", duration:  5, predecessor: "m7", lag: 1          },
  { id: "m9",  name: "IQ Protocol Approved",               phase: "Testing",     plannedDate: "2026-07-15", forecastDate: "2026-07-15", status: "pending",     locked: false, owner: "QA", duration: 10, predecessor: "m8", lag: 1          },
  { id: "m10", name: "UAT Start",                          phase: "Testing",     plannedDate: "2026-08-01", forecastDate: "2026-08-01", status: "pending",     locked: false, owner: "VP", duration:  1, predecessor: "m9", lag: 0          },
  { id: "m11", name: "Training Materials Ready",           phase: "Training",    plannedDate: "2026-08-20", forecastDate: "2026-08-20", status: "pending",     locked: false, owner: "HR", duration: 15, predecessor: "m8", lag: 0          },
  { id: "m12", name: "UAT Sign-off",                       phase: "Testing",     plannedDate: "2026-08-28", forecastDate: "2026-08-28", status: "pending",     locked: false, owner: "VP", duration: 20, predecessor: "m10", lag: 0         },
  { id: "m13", name: "Go-Live",                            phase: "Go-Live",     plannedDate: "2026-09-02", forecastDate: "2026-09-02", status: "pending",     locked: true,  owner: "VP", duration:  1, predecessor: "m12", lag: 1         },
];

// ─── Risks ────────────────────────────────────────────────────────────────────

export type RiskStatus = "open" | "mitigated" | "closed";

export type Risk = {
  id: string;
  title: string;
  category: string;
  probability: number; // 1–5
  impact: number;      // 1–5
  score: number;       // probability × impact
  status: RiskStatus;
  owner: string;
  mitigation: string;
};

export const risks: Risk[] = [
  { id: "r1", title: "Data migration complexity exceeds estimate",   category: "Technical",     probability: 4, impact: 5, score: 20, status: "open",      owner: "AR", mitigation: "Engage specialist DM vendor; add 2-week buffer" },
  { id: "r2", title: "Validation timeline slippage",                 category: "Compliance",    probability: 3, impact: 4, score: 12, status: "open",      owner: "QA", mitigation: "Front-load IQ protocol drafting in Sprint 2" },
  { id: "r3", title: "End-user adoption resistance",                 category: "Change Mgmt",   probability: 3, impact: 3, score: 9,  status: "open",      owner: "HR", mitigation: "Run change champions programme from Sprint 3" },
  { id: "r4", title: "Veeva Vault upgrade mid-project",              category: "Technical",     probability: 2, impact: 4, score: 8,  status: "mitigated", owner: "KM", mitigation: "Locked to v24R2; change freeze confirmed with vendor" },
  { id: "r5", title: "Integration testing scope creep",              category: "Scope",         probability: 2, impact: 3, score: 6,  status: "open",      owner: "VP", mitigation: "Strict change control board from Sprint 2 onwards" },
  { id: "r6", title: "Key SME availability during UAT",              category: "Resource",      probability: 3, impact: 3, score: 9,  status: "open",      owner: "VP", mitigation: "Reserve SME calendars 8 weeks ahead" },
];

// ─── Documents ────────────────────────────────────────────────────────────────

export type DecisionStatus = "approved" | "rejected" | "pending";

export type Decision = {
  person: string;
  initials: string;
  role: string;
  status: DecisionStatus;
  date?: string;
};

export type DocumentStatus = "draft" | "in-review" | "reviewed" | "approved" | "rejected";

export type DocumentPhase = "Planning" | "Configuration" | "Validation" | "Training" | "Go-Live";

export type Document = {
  id: string;
  name: string;
  abbreviation?: string;     // e.g. "VMP", "URS", "DAP"
  type: string;
  phase: DocumentPhase;
  version: string;
  status: DocumentStatus;
  dueDate: string;
  description?: string;      // short plain-language description, surfaced on the card
  owner: string;             // RACI Responsible — who is delivering this document (initials)
  reviewers: Decision[];     // RACI Consulted — provide input / feedback
  approvers: Decision[];     // RACI Accountable — sign off
};

export const documents: Document[] = [
  // ── Planning phase ─────────────────────────────────────────────────
  {
    id: "d5",
    name: "Validation Master Plan",
    abbreviation: "VMP",
    type: "Compliance",
    phase: "Planning",
    version: "1.0",
    status: "approved",
    dueDate: "2026-02-28",
    description: "Master governing document for the CSV / GAMP 5 validation strategy.",
    owner: "VP",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "approved", date: "2026-02-15" },
      { person: "Karen Mills",  initials: "KM", role: "QA Director",  status: "approved", date: "2026-02-20" },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "approved", date: "2026-02-28" },
    ],
  },
  {
    id: "d6",
    name: "User Requirements Specification",
    abbreviation: "URS",
    type: "Business",
    phase: "Planning",
    version: "2.0",
    status: "approved",
    dueDate: "2026-01-30",
    description: "Business-level requirements driving the Veeva RIM configuration.",
    owner: "SL",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "approved", date: "2026-01-22" },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "approved", date: "2026-01-30" },
    ],
  },
  {
    id: "d7",
    name: "Risk Management Plan",
    abbreviation: "RMP",
    type: "Compliance",
    phase: "Planning",
    version: "1.1",
    status: "in-review",
    dueDate: "2026-05-18",
    description: "Project-wide risk identification, scoring, and mitigation framework.",
    owner: "SL",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "approved", date: "2026-05-09" },
      { person: "Karen Mills",  initials: "KM", role: "QA Director",  status: "pending"  },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "pending"  },
    ],
  },

  // ── Configuration phase ────────────────────────────────────────────
  {
    id: "d1",
    name: "Functional Requirements Specification",
    abbreviation: "FRS",
    type: "Validation",
    phase: "Configuration",
    version: "2.1",
    status: "in-review",
    dueDate: "2026-05-20",
    description: "Detailed functional behaviour the configured system must satisfy.",
    owner: "AR",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "approved", date: "2026-05-10" },
      { person: "Arjun Rao",    initials: "AR", role: "Tech Lead",    status: "pending"  },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "pending"  },
      { person: "Karen Mills",   initials: "KM", role: "QA Director", status: "pending"  },
    ],
  },
  {
    id: "d2",
    name: "System Design Document",
    abbreviation: "SDD",
    type: "Technical",
    phase: "Configuration",
    version: "1.3",
    status: "in-review",
    dueDate: "2026-05-25",
    description: "Architecture, integrations, and configuration topology for the Vault instance.",
    owner: "AR",
    reviewers: [
      { person: "Arjun Rao",    initials: "AR", role: "Tech Lead",    status: "pending"  },
      { person: "Karen Mills",  initials: "KM", role: "QA Director",  status: "pending"  },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "pending"  },
    ],
  },
  {
    id: "d3",
    name: "Data Migration Plan",
    abbreviation: "DMP",
    type: "Technical",
    phase: "Configuration",
    version: "1.0",
    status: "in-review",
    dueDate: "2026-05-30",
    description: "Source-to-target mapping, cutover sequencing, and reconciliation strategy.",
    owner: "AR",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "approved", date: "2026-05-08" },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "pending"  },
      { person: "Arjun Rao",    initials: "AR", role: "Tech Lead",    status: "pending"  },
      { person: "Karen Mills",  initials: "KM", role: "QA Director",  status: "pending"  },
    ],
  },
  {
    id: "d8",
    name: "Data Analysis Plan",
    abbreviation: "DAP",
    type: "Technical",
    phase: "Configuration",
    version: "0.2",
    status: "draft",
    dueDate: "2026-06-10",
    description: "Analytical procedures, statistical methods, and reporting rules for in-system data.",
    owner: "AR",
    reviewers: [
      { person: "Arjun Rao",    initials: "AR", role: "Tech Lead",    status: "pending"  },
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "pending"  },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "pending"  },
    ],
  },

  // ── Validation phase ───────────────────────────────────────────────
  {
    id: "d4",
    name: "Installation Qualification Protocol",
    abbreviation: "IQ Protocol",
    type: "Validation",
    phase: "Validation",
    version: "0.1",
    status: "draft",
    dueDate: "2026-07-01",
    description: "Evidence that the system is installed correctly in the production environment.",
    owner: "QA",
    reviewers: [],
    approvers: [],
  },
  {
    id: "d9",
    name: "Operational Qualification Protocol",
    abbreviation: "OQ Protocol",
    type: "Validation",
    phase: "Validation",
    version: "0.3",
    status: "draft",
    dueDate: "2026-07-10",
    description: "Evidence that the system operates per FRS across functional ranges.",
    owner: "QA",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "pending"  },
    ],
    approvers: [],
  },
  {
    id: "d10",
    name: "Performance Qualification Protocol",
    abbreviation: "PQ Protocol",
    type: "Validation",
    phase: "Validation",
    version: "0.1",
    status: "draft",
    dueDate: "2026-07-30",
    description: "Evidence that the system performs as required under real-world workflows.",
    owner: "QA",
    reviewers: [],
    approvers: [],
  },
  {
    id: "d11",
    name: "Traceability Matrix",
    abbreviation: "TM",
    type: "Validation",
    phase: "Validation",
    version: "1.0",
    status: "in-review",
    dueDate: "2026-06-25",
    description: "End-to-end trace from URS requirements through to IQ/OQ/PQ test evidence.",
    owner: "QA",
    reviewers: [
      { person: "Sarah Lee",    initials: "SL", role: "QA Lead",      status: "pending"  },
      { person: "Karen Mills",  initials: "KM", role: "QA Director",  status: "pending"  },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",          status: "pending"  },
    ],
  },

  // ── Training phase ─────────────────────────────────────────────────
  {
    id: "d12",
    name: "Training Plan",
    abbreviation: "TP",
    type: "Training",
    phase: "Training",
    version: "0.5",
    status: "draft",
    dueDate: "2026-07-20",
    description: "Role-based training curriculum, materials, and completion tracking approach.",
    owner: "HR",
    reviewers: [
      { person: "Hannah Ross",   initials: "HR", role: "Training Lead", status: "pending" },
    ],
    approvers: [
      { person: "Vineet Pathak", initials: "VP", role: "PM",            status: "pending" },
    ],
  },

  // ── Go-Live phase ──────────────────────────────────────────────────
  {
    id: "d13",
    name: "Go-Live Readiness Checklist",
    abbreviation: "GLC",
    type: "Go-Live",
    phase: "Go-Live",
    version: "0.1",
    status: "draft",
    dueDate: "2026-08-25",
    description: "Cut-over criteria, hypercare staffing, rollback triggers, and exec sign-off.",
    owner: "VP",
    reviewers: [],
    approvers: [],
  },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus   = "Not Started" | "In Progress" | "Complete" | "Blocked" | "On Hold";
export type TaskPriority = "Critical" | "High" | "Medium" | "Low";

export type Task = {
  id: string;
  name: string;
  workstream: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;      // 0–100
  milestoneId?: string;  // links to a milestone id
  owner: string;
  dueDate: string;
  dependsOn?: string[];  // task ids this task is blocked by
};

export const tasks: Task[] = [
  // ── Configuration ──────────────────────────────────────────────────
  { id: "t1",  workstream: "Configuration",    name: "Set up user roles & permission profiles",     priority: "Critical", status: "In Progress",  progress: 75, milestoneId: "m6",  owner: "VP",  dueDate: "2026-05-25" },
  { id: "t2",  workstream: "Configuration",    name: "Configure submission workspace settings",      priority: "High",     status: "In Progress",  progress: 60, milestoneId: "m6",  owner: "KM",  dueDate: "2026-05-30", dependsOn: ["t1"] },
  { id: "t3",  workstream: "Configuration",    name: "Set up workflow lifecycle rules",              priority: "High",     status: "In Progress",  progress: 40, milestoneId: "m6",  owner: "KM",  dueDate: "2026-05-30", dependsOn: ["t1"] },
  { id: "t4",  workstream: "Configuration",    name: "Configure document templates & renditions",   priority: "Medium",   status: "Not Started",  progress:  0, milestoneId: "m7",  owner: "KM",  dueDate: "2026-06-02", dependsOn: ["t2", "t3"] },

  // ── Validation ─────────────────────────────────────────────────────
  { id: "t5",  workstream: "Validation",       name: "Draft IQ protocol document",                  priority: "Critical", status: "In Progress",  progress: 30, milestoneId: "m9",  owner: "QA",  dueDate: "2026-06-15", dependsOn: ["t1"] },
  { id: "t6",  workstream: "Validation",       name: "Prepare OQ test scripts",                     priority: "High",     status: "Not Started",  progress:  0, milestoneId: "m9",  owner: "QA",  dueDate: "2026-07-01", dependsOn: ["t5"] },
  { id: "t7",  workstream: "Validation",       name: "UAT test case design & traceability matrix",  priority: "High",     status: "Not Started",  progress:  0, milestoneId: "m10", owner: "QA",  dueDate: "2026-07-20", dependsOn: ["t6"] },
  { id: "t8",  workstream: "Validation",       name: "Validation summary report template",          priority: "Medium",   status: "Not Started",  progress:  0, milestoneId: "m12", owner: "QA",  dueDate: "2026-08-15", dependsOn: ["t7"] },

  // ── Data Migration ─────────────────────────────────────────────────
  { id: "t9",  workstream: "Data Migration",   name: "Source data extraction & field mapping",      priority: "Critical", status: "In Progress",  progress: 50, milestoneId: "m4",  owner: "AR",  dueDate: "2026-05-15" },
  { id: "t10", workstream: "Data Migration",   name: "Data cleansing & transformation rules",       priority: "High",     status: "Not Started",  progress:  0, milestoneId: "m8",  owner: "AR",  dueDate: "2026-06-15", dependsOn: ["t9"] },
  { id: "t11", workstream: "Data Migration",   name: "Migration dry-run execution & reconciliation",priority: "High",     status: "Not Started",  progress:  0, milestoneId: "m8",  owner: "AR",  dueDate: "2026-06-30", dependsOn: ["t10"] },
  { id: "t12", workstream: "Data Migration",   name: "Data integrity verification scripts",         priority: "Medium",   status: "Blocked",      progress:  0, milestoneId: "m8",  owner: "AR",  dueDate: "2026-06-20", dependsOn: ["t9"] },

  // ── Training ───────────────────────────────────────────────────────
  { id: "t13", workstream: "Training",         name: "Develop end-user training materials",         priority: "High",     status: "Not Started",  progress:  0, milestoneId: "m11", owner: "HR",  dueDate: "2026-07-15", dependsOn: ["t4"] },
  { id: "t14", workstream: "Training",         name: "Record system walkthrough videos",            priority: "Medium",   status: "Not Started",  progress:  0, milestoneId: "m11", owner: "HR",  dueDate: "2026-07-30", dependsOn: ["t13"] },
  { id: "t15", workstream: "Training",         name: "Schedule & confirm training sessions",        priority: "Medium",   status: "Not Started",  progress:  0, milestoneId: "m11", owner: "HR",  dueDate: "2026-08-10", dependsOn: ["t13", "t14"] },

  // ── Project Management ─────────────────────────────────────────────
  { id: "t16", workstream: "Project Mgmt",     name: "Weekly steering committee status reports",    priority: "Medium",   status: "In Progress",  progress: 80,                      owner: "VP",  dueDate: "2026-09-02" },
  { id: "t17", workstream: "Project Mgmt",     name: "Risk register review & maintenance",          priority: "High",     status: "In Progress",  progress: 65,                      owner: "VP",  dueDate: "2026-09-02" },
  { id: "t18", workstream: "Project Mgmt",     name: "Change control log & CCB minutes",           priority: "Low",      status: "In Progress",  progress: 70,                      owner: "VP",  dueDate: "2026-09-02" },
];

// ─── Cost lines ───────────────────────────────────────────────────────────────

export type ContractType = "T&M" | "Fixed" | "Internal";

export type CostLine = {
  id: string;
  category: string;
  description: string;
  budgetK: number;    // $k budgeted
  actualK: number;    // $k spent to date
  contractType: ContractType;
  owner: string;
};

export const costLines: CostLine[] = [
  { id: "c1", category: "Implementation", description: "Veeva Vault configuration & development", budgetK: 650, actualK: 340, contractType: "Fixed",    owner: "KM" },
  { id: "c2", category: "Validation",     description: "CSV / GAMP 5 validation services",        budgetK: 320, actualK: 140, contractType: "T&M",      owner: "QA" },
  { id: "c3", category: "Migration",      description: "Data migration specialist vendor",         budgetK: 280, actualK:  85, contractType: "Fixed",    owner: "AR" },
  { id: "c4", category: "Integration",    description: "ERP & eTMF integration development",       budgetK: 220, actualK:  65, contractType: "T&M",      owner: "AR" },
  { id: "c5", category: "Training",       description: "End-user training & change management",    budgetK: 180, actualK:   0, contractType: "T&M",      owner: "HR" },
  { id: "c6", category: "License",        description: "Veeva Vault annual licence (pro-rated)",   budgetK: 200, actualK: 110, contractType: "Fixed",    owner: "VP" },
  { id: "c7", category: "Internal",       description: "Internal PM & governance overhead",        budgetK: 150, actualK:  40, contractType: "Internal", owner: "VP" },
  // Total budget: 2 000 $k  ·  Total actual: 780 $k (39%) — matches budgetTrend May figure
];

// ─── Budget ───────────────────────────────────────────────────────────────────

export type BudgetMonth = {
  month: string;   // "Jan", "Feb", …
  planned: number; // cumulative $k
  actual: number;  // cumulative $k
};

export const budgetTrend: BudgetMonth[] = [
  { month: "Jan", planned: 120, actual: 115 },
  { month: "Feb", planned: 260, actual: 248 },
  { month: "Mar", planned: 420, actual: 395 },
  { month: "Apr", planned: 620, actual: 590 },
  { month: "May", planned: 820, actual: 780 },
  { month: "Jun", planned: 1020, actual: 0  }, // forecast only
];

// ─── Risk trend ───────────────────────────────────────────────────────────────

export type RiskTrendMonth = {
  month: string;
  open: number;
  mitigated: number;
};

export const riskTrend: RiskTrendMonth[] = [
  { month: "Jan", open: 2, mitigated: 0 },
  { month: "Feb", open: 4, mitigated: 1 },
  { month: "Mar", open: 5, mitigated: 1 },
  { month: "Apr", open: 6, mitigated: 2 },
  { month: "May", open: 5, mitigated: 3 },
  { month: "Jun", open: 4, mitigated: 3 },
];

// ─── Team Members ────────────────────────────────────────────────────────────

export type SteerCoRole = "mandatory" | "optional";

export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  role: string;
  workstream: string;         // primary workstream; "Executive" for SteerCo-only members
  steercoRole?: SteerCoRole;
};

export const teamMembers: TeamMember[] = [
  // Project operators (match initials used across milestones/tasks/risks/docs)
  { id: "tm1", initials: "VP", name: "Vineet Pathak",   role: "Project Manager",        workstream: "Project Mgmt",   steercoRole: "mandatory" },
  { id: "tm2", initials: "KM", name: "Karen Mills",     role: "Config Lead / QA Dir",   workstream: "Configuration",  steercoRole: "optional"  },
  { id: "tm3", initials: "QA", name: "Priya Sharma",    role: "Validation Lead",        workstream: "Validation",     steercoRole: "optional"  },
  { id: "tm4", initials: "AR", name: "Arjun Rao",       role: "Data Migration Lead",    workstream: "Data Migration", steercoRole: "optional"  },
  { id: "tm5", initials: "SL", name: "Sarah Lee",       role: "QA Lead",                workstream: "Validation"                               },
  { id: "tm6", initials: "HR", name: "Hannah Ross",     role: "Training Lead",          workstream: "Training",       steercoRole: "optional"  },
  // SteerCo executives (no operational tasks in mock data)
  { id: "tm7", initials: "JO", name: "James Okonkwo",   role: "Project Sponsor",        workstream: "Executive",      steercoRole: "mandatory" },
  { id: "tm8", initials: "AM", name: "Dr. Anna Müller", role: "Business Owner",         workstream: "Executive",      steercoRole: "mandatory" },
  { id: "tm9", initials: "RT", name: "Robert Tan",      role: "IT Director",            workstream: "Executive",      steercoRole: "mandatory" },
];

// ─── Absences ────────────────────────────────────────────────────────────────

export type AbsenceReason = "Vacation" | "Public Holiday" | "Conference" | "Sick Leave" | "Other";

export type Absence = {
  id: string;
  memberId: string;   // TeamMember.id
  startDate: string;  // ISO date (Mon)
  endDate: string;    // ISO date (Fri)
  reason: AbsenceReason;
  note?: string;
};

export const absences: Absence[] = [
  { id: "ab1", memberId: "tm3", startDate: "2026-05-18", endDate: "2026-05-20", reason: "Sick Leave" },
  { id: "ab2", memberId: "tm4", startDate: "2026-05-25", endDate: "2026-05-29", reason: "Vacation" },
  { id: "ab3", memberId: "tm2", startDate: "2026-06-01", endDate: "2026-06-05", reason: "Conference", note: "Veeva Summit 2026" },
  { id: "ab4", memberId: "tm6", startDate: "2026-06-08", endDate: "2026-06-12", reason: "Vacation" },
  { id: "ab5", memberId: "tm7", startDate: "2026-06-22", endDate: "2026-07-03", reason: "Vacation" },
];

// ─── Recurring Meetings ──────────────────────────────────────────────────────

export type MeetingFrequency = "weekly" | "bi-weekly" | "monthly";
export type AttendeeRole = "mandatory" | "optional";

export type MeetingAttendee = {
  memberId: string;
  role: AttendeeRole;
};

export type RecurringMeeting = {
  id: string;
  name: string;
  type: "steerco" | "workstream" | "governance";
  workstream?: string;
  frequency: MeetingFrequency;
  dayOfWeek: string;
  durationMins: number;
  attendees: MeetingAttendee[];
  nextDate: string;
};

export const recurringMeetings: RecurringMeeting[] = [
  {
    id: "mtg1",
    name: "Steering Committee",
    type: "steerco",
    frequency: "bi-weekly",
    dayOfWeek: "Monday",
    durationMins: 60,
    nextDate: "2026-05-18",
    attendees: [
      { memberId: "tm1", role: "mandatory" },
      { memberId: "tm7", role: "mandatory" },
      { memberId: "tm8", role: "mandatory" },
      { memberId: "tm9", role: "mandatory" },
      { memberId: "tm2", role: "optional"  },
      { memberId: "tm3", role: "optional"  },
      { memberId: "tm4", role: "optional"  },
      { memberId: "tm6", role: "optional"  },
    ],
  },
  {
    id: "mtg2",
    name: "Configuration Sync",
    type: "workstream",
    workstream: "Configuration",
    frequency: "weekly",
    dayOfWeek: "Tuesday",
    durationMins: 30,
    nextDate: "2026-05-12",
    attendees: [
      { memberId: "tm1", role: "mandatory" },
      { memberId: "tm2", role: "mandatory" },
    ],
  },
  {
    id: "mtg3",
    name: "Validation Sync",
    type: "workstream",
    workstream: "Validation",
    frequency: "weekly",
    dayOfWeek: "Wednesday",
    durationMins: 30,
    nextDate: "2026-05-13",
    attendees: [
      { memberId: "tm1", role: "mandatory" },
      { memberId: "tm3", role: "mandatory" },
      { memberId: "tm5", role: "mandatory" },
    ],
  },
  {
    id: "mtg4",
    name: "Data Migration Sync",
    type: "workstream",
    workstream: "Data Migration",
    frequency: "weekly",
    dayOfWeek: "Thursday",
    durationMins: 30,
    nextDate: "2026-05-14",
    attendees: [
      { memberId: "tm1", role: "mandatory" },
      { memberId: "tm4", role: "mandatory" },
    ],
  },
  {
    id: "mtg5",
    name: "Training Sync",
    type: "workstream",
    workstream: "Training",
    frequency: "bi-weekly",
    dayOfWeek: "Friday",
    durationMins: 30,
    nextDate: "2026-05-15",
    attendees: [
      { memberId: "tm1", role: "mandatory" },
      { memberId: "tm6", role: "mandatory" },
    ],
  },
  {
    id: "mtg6",
    name: "Change Control Board",
    type: "governance",
    frequency: "monthly",
    dayOfWeek: "Wednesday",
    durationMins: 45,
    nextDate: "2026-06-03",
    attendees: [
      { memberId: "tm1", role: "mandatory" },
      { memberId: "tm2", role: "mandatory" },
      { memberId: "tm3", role: "mandatory" },
      { memberId: "tm4", role: "optional"  },
      { memberId: "tm9", role: "optional"  },
    ],
  },
];

// ─── Derived KPIs ─────────────────────────────────────────────────────────────

export function getKpis() {
  const today = new Date("2026-05-11");
  const goLive = new Date(project.goLiveDate);
  const daysToGoLive = Math.ceil((goLive.getTime() - today.getTime()) / 86_400_000);

  const openRisks = risks.filter((r) => r.status === "open");
  const highRisks = openRisks.filter((r) => r.score >= 15);
  const medRisks  = openRisks.filter((r) => r.score >= 8 && r.score < 15);

  const latestActual = budgetTrend.filter((b) => b.actual > 0).at(-1)?.actual ?? 0;
  const totalBudget = 2000; // $k
  const budgetPct = Math.round((latestActual / totalBudget) * 100);

  const upcoming = milestones
    .filter((m) => m.status !== "complete")
    .sort((a, b) => a.forecastDate.localeCompare(b.forecastDate))
    .slice(0, 5);

  const scheduleVariance = upcoming[0]
    ? Math.ceil(
        (new Date(upcoming[0].forecastDate).getTime() -
          new Date(upcoming[0].plannedDate).getTime()) /
          86_400_000
      )
    : 0;

  const pendingDocs = documents
    .filter((d) => d.status === "in-review")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);

  return {
    daysToGoLive,
    openRisksCount: openRisks.length,
    highRisks: highRisks.length,
    medRisks: medRisks.length,
    budgetPct,
    latestActualK: latestActual,
    totalBudgetK: totalBudget,
    scheduleVariance,
    upcomingMilestones: upcoming,
    pendingDocs,
  };
}
