"use client";

import { useEffect } from "react";
import { useEntityStore } from "@/lib/stores/entity-store";

// M20.2: tiny no-op component that triggers entity-store hydration on first
// mount. Loaded once via app/(app)/layout.tsx so every entity grid sees the
// localStorage-persisted state instead of mockData seeds on first render.

export function EntityStoreHydrator() {
  const hydrate = useEntityStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
}
