// M20.2 — Audit log infrastructure.
//
// Every entity mutation through the store flows through dispatch(action),
// which records the before/after to a per-project audit log. This powers:
//   - "Recent Activity" surfaces (dashboard, notification bell)
//   - Future undo/redo (each action has before — apply inverse to revert)
//   - M23 Change Request audit trail
//   - Export workbook "Activity Log" sheet (future M19 extension)

export type EntityKind =
  | "project" | "charter" | "milestone" | "task" | "risk" | "document"
  | "costLine" | "teamMember" | "meeting" | "absence";

export type ActionType = "add" | "update" | "delete" | "replaceAll" | "import" | "cascade-apply";

export type Source =
  | "user-edit"        // form-driven mutation
  | "user-inline"      // inline edit (status cycle, progress slider)
  | "cascade"          // applied via cascade impact drawer
  | "import"           // future CSV import
  | "system"           // engine-driven (e.g. schedule from go-live)
  | "test";            // test harness

export interface AuditAction<T = unknown> {
  id: string;          // unique action id (timestamp-based)
  type: ActionType;
  entityKind: EntityKind;
  entityId: string;
  // For undo: before & after snapshots. Skipped on import/replaceAll for size.
  before?: T;
  after?: T;
  source: Source;
  projectId?: string;  // scope; some actions (project-level) have no projectId
  timestamp: string;   // ISO with milliseconds
  note?: string;       // optional human-readable annotation
}

// Storage key — one log per project keeps reads cheap.
function auditKey(projectId: string | undefined): string {
  return projectId
    ? `aivello_audit_v1_${projectId}`
    : `aivello_audit_v1_global`;
}

export function readAuditLog(projectId: string | undefined): AuditAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(auditKey(projectId));
    if (!raw) return [];
    return JSON.parse(raw) as AuditAction[];
  } catch {
    return [];
  }
}

export function appendAudit(action: AuditAction): void {
  if (typeof window === "undefined") return;
  try {
    const key = auditKey(action.projectId);
    const existing = readAuditLog(action.projectId);
    existing.unshift(action); // newest first
    // Cap at 500 per project — auditable history without unbounded growth
    const capped = existing.slice(0, 500);
    localStorage.setItem(key, JSON.stringify(capped));
  } catch {
    // Quota — drop silently. In a real backend we'd retry.
  }
}

export function makeActionId(): string {
  return `a${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Convenience: build an action object with sensible defaults.
export function buildAction<T>(args: {
  type: ActionType;
  entityKind: EntityKind;
  entityId: string;
  before?: T;
  after?: T;
  source: Source;
  projectId?: string;
  note?: string;
}): AuditAction<T> {
  return {
    id: makeActionId(),
    timestamp: new Date().toISOString(),
    ...args,
  };
}
