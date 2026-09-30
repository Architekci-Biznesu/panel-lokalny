"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

/**
 * Whether the customer is editing something on Wizytówka (any open editor or
 * suggestion form). While true, newer data from Google is not swapped in -
 * a jumping form is worse than data a few minutes old.
 */

type WizEditingContextValue = {
  editing: boolean;
  setOpen: (id: string, open: boolean) => void;
};

const WizEditingContext = createContext<WizEditingContextValue>({
  editing: false,
  setOpen: () => {},
});

export function WizEditingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const setOpen = useCallback((id: string, open: boolean) => {
    setOpenIds((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ editing: openIds.size > 0, setOpen }),
    [openIds, setOpen],
  );

  return (
    <WizEditingContext.Provider value={value}>
      {children}
    </WizEditingContext.Provider>
  );
}

/** Editors call this with their open state. */
export function useReportWizEditing(open: boolean): void {
  const id = useId();
  const { setOpen } = useContext(WizEditingContext);
  useEffect(() => {
    setOpen(id, open);
    return () => setOpen(id, false);
  }, [id, open, setOpen]);
}

export function useWizEditing(): boolean {
  return useContext(WizEditingContext).editing;
}
