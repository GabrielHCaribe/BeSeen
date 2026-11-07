import type { NativeStatus } from "@modules/beseen-native";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { call, errorMessage } from "./api";
import { registerBackgroundTasks } from "./background";
import { nativeStatus, syncNative } from "./native";
import { registerPush } from "./push";
import { checkIn, loadOrRegister } from "./session";
import type { Credentials, ServerState } from "./types";

interface Store {
  state: ServerState | null;
  status: NativeStatus | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerState | null>(null);
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const credentials = useRef<Credentials | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await nativeStatus());
  }, []);

  const refresh = useCallback(async () => {
    try {
      credentials.current ??= await loadOrRegister();
      const next = await call<ServerState>("state");
      setState(next);
      setError(null);
      await syncNative(next, credentials.current);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatus(await nativeStatus());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled || !credentials.current) return;
      await Promise.all([registerPush(false), registerBackgroundTasks(), checkIn("launch").catch(() => {})]);
    })();

    // Coming back to the app: pick up applied cooldowns, new partner status, and permission changes.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      refresh();
      checkIn("foreground").catch(() => {});
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [refresh]);

  return (
    <StoreContext.Provider value={{ state, status, error, loading, refresh, refreshStatus }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
