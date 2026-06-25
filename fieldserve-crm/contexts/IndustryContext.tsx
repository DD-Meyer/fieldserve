import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useMe } from "../lib/hooks/useMe";

export type IndustryMode = "mobile" | "fixed";

type IndustryContextValue = {
  mode: IndustryMode;
  setMode: (mode: IndustryMode) => void;
};

const IndustryContext = createContext<IndustryContextValue | null>(null);

export function IndustryProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<IndustryMode>("mobile");
  const { data: me } = useMe();

  useEffect(() => {
    const m = me?.memberships?.[0]?.industry_mode;
    if (m === "mobile" || m === "fixed") setMode(m);
  }, [me]);

  return (
    <IndustryContext.Provider value={{ mode, setMode }}>
      {children}
    </IndustryContext.Provider>
  );
}

export function useIndustry(): IndustryContextValue {
  const ctx = useContext(IndustryContext);
  if (!ctx) {
    throw new Error("useIndustry must be used inside <IndustryProvider>");
  }
  return ctx;
}
