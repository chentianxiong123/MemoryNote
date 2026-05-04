import { createContext, useContext, useState, type ReactNode } from "react";

interface Tab {
  id: string;
  title: string;
  isActive: boolean;
}

interface TabsContextType {
  tabs: Tab[];
  activeTabId: string | null;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const setActiveTab = (id: string) => setActiveTabId(id);
  const closeTab = (id: string) => setTabs((prev) => prev.filter((t) => t.id !== id));

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, setActiveTab, closeTab }}>
      {children}
    </TabsContext.Provider>
  );
}

export const DesktopTabsProvider = TabsProvider;

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error("useTabs must be used within TabsProvider");
  return context;
}
