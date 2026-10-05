import { liveQuery } from "dexie";
import { useState, useEffect } from "react";

export function useLiveQuery<T>(querier: () => Promise<T> | T, dependencies: any[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (val) => setValue(val),
      error: (err) => console.error("useLiveQuery error:", err),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return value;
}
