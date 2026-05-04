import { useTabs } from "./tabs-context";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();

  return (
    <div className="flex h-10 border-b">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center px-4 cursor-pointer ${
            tab.id === activeTabId ? "bg-background" : "bg-muted"
          }`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span>{tab.title}</span>
          <button
            className="ml-2"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export const DesktopTabBar = TabBar;
