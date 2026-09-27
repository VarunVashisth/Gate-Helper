import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { api } from "../api/client";
import type { PlatformInfo } from "../api/client";

type PlatformState =
  | { status: "loading"; info: null; error: null }
  | { status: "ready"; info: PlatformInfo; error: null }
  | { status: "error"; info: null; error: string };

type PlatformContextValue = PlatformState & { retry: () => void };

const PlatformContext = createContext<PlatformContextValue | undefined>(undefined);

export function PlatformProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PlatformState>({
    status: "loading",
    info: null,
    error: null,
  });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", info: null, error: null });
    api
      .getPlatform()
      .then((info) => setState({ status: "ready", info, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            info: null,
            error: error instanceof Error ? error.message : "Unable to load platform information.",
          });
        }
      });
    return () => controller.abort();
  }, [requestVersion]);

  const value = useMemo(
    () => ({ ...state, retry: () => setRequestVersion((version) => version + 1) }),
    [state],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform must be used inside PlatformProvider.");
  return context;
}

