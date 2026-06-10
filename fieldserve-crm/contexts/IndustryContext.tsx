import { createContext, useContext, useState, type ReactNode } from "react";

export type IndustryMode = "mobile" | "fixed";

type IndustryContextValue = {
  mode: IndustryMode;
  setMode: (mode: IndustryMode) => void;
};

const IndustryContext = createContext<IndustryContextValue | null>(null);

export function IndustryProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<IndustryMode>("mobile");
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
