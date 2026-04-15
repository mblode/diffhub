import { useState, useCallback, useEffect } from "react";

export const useLocalStorage = <T extends string>(
  key: string,
  defaultValue: T,
  allowedValues?: readonly T[],
): [T, (value: T | ((prev: T) => T)) => void] => {
  // Always start with defaultValue to avoid hydration mismatch
  const [state, setState] = useState<T>(defaultValue);

  // Sync from localStorage after mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null && (!allowedValues || allowedValues.includes(stored as T))) {
        setState(stored as T);
      }
    } catch {
      // empty
    }
  }, [key, allowedValues]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          localStorage.setItem(key, next);
        } catch {
          // empty
        }
        return next;
      });
    },
    [key],
  );

  return [state, setValue];
};
