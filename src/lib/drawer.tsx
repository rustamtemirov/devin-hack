"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AgentDrawer } from "@/components/AgentDrawer";

interface DrawerCtx {
  open: (agentId: string) => void;
  close: () => void;
}

const Ctx = createContext<DrawerCtx>({ open: () => {}, close: () => {} });

export function useDrawer() {
  return useContext(Ctx);
}

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const open = useCallback((id: string) => setAgentId(id), []);
  const close = useCallback(() => setAgentId(null), []);
  const value = useMemo(() => ({ open, close }), [open, close]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <AgentDrawer agentId={agentId} onClose={close} />
    </Ctx.Provider>
  );
}
