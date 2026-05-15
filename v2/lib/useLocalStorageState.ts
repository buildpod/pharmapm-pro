"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Drop-in replacement for useState that mirrors its value to localStorage.
// Hydrates from storage on mount (so static export doesn't break);
// initial value is used on first load and during SSR.
//
// Usage:
//   const [tasks, setTasks] = useLocalStorageState<Task[]>("aivello_tasks_v1", initialTasks);
//
// setTasks accepts a value or an updater function, same as useState.

export function useLocalStorageState<T>(
  key: string,
  initial: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValueS] = useState<T>(initial);
  const hydratedRef = useRef(false);

  // Hydrate once on client mount
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setValueS(parsed as T);
      }
    } catch {
      // Bad JSON / no storage / SSR — fall back to initial silently
    }
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueS((prev) => {
        const computed =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(computed));
        } catch {
          // Quota / SSR — drop silently
        }
        return computed;
      });
    },
    [key]
  );

  return [value, setValue];
}
