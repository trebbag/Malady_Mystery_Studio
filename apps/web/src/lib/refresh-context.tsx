import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

interface RefreshContextValue {
  globalVersion: number;
  getRunVersion: (runId?: string) => number;
  refreshGlobal: () => void;
  refreshRun: (runId?: string) => void;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: PropsWithChildren) {
  const [globalVersion, setGlobalVersion] = useState(0);
  const [runVersions, setRunVersions] = useState<Record<string, number>>({});

  const value = useMemo<RefreshContextValue>(() => ({
    globalVersion,
    getRunVersion: (runId?: string) => (runId ? runVersions[runId] ?? 0 : 0),
    refreshGlobal: () => {
      setGlobalVersion((current) => current + 1);
    },
    refreshRun: (runId?: string) => {
      setGlobalVersion((current) => current + 1);

      if (!runId) {
        return;
      }

      setRunVersions((current) => ({
        ...current,
        [runId]: (current[runId] ?? 0) + 1,
      }));
    },
  }), [globalVersion, runVersions]);

  return (
    <RefreshContext.Provider value={value}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefreshContext() {
  const context = useContext(RefreshContext);

  if (!context) {
    throw new Error('useRefreshContext must be used within RefreshProvider.');
  }

  return context;
}

export function useRefreshSignal(runId?: string) {
  const context = useRefreshContext();
  return `${context.globalVersion}:${context.getRunVersion(runId)}`;
}
