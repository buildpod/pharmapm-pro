// M20.2 — Generic persistence interface.
//
// The store talks to one of these per entity type. Today: localStorage.
// Tomorrow (Path C): Supabase, swapping a single import.
//
// Synchronous reads/writes are fine for localStorage; the Promise return type
// lets us switch to a remote impl without changing the store contract.

export interface EntityRepository<T> {
  list(): Promise<T[]>;
  replaceAll(items: T[]): Promise<void>;
}

export class LocalStorageRepository<T> implements EntityRepository<T> {
  constructor(private readonly key: string, private readonly fallback: T[]) {}

  async list(): Promise<T[]> {
    if (typeof window === "undefined") return this.fallback;
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return this.fallback;
      return JSON.parse(raw) as T[];
    } catch {
      return this.fallback;
    }
  }

  async replaceAll(items: T[]): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.key, JSON.stringify(items));
    } catch {
      // Quota or SSR — drop silently. Real backend would surface errors.
    }
  }
}

// In-memory implementation for unit tests so we don't touch localStorage.
export class InMemoryRepository<T> implements EntityRepository<T> {
  private items: T[];
  constructor(seed: T[] = []) { this.items = seed.slice(); }
  async list(): Promise<T[]> { return this.items.slice(); }
  async replaceAll(items: T[]): Promise<void> { this.items = items.slice(); }
}
