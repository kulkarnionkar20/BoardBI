import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTabsStore } from "../../store/tabsStore";
import { ReportPage } from "./ReportPage";
import { TabBar } from "./TabBar";

// Routed at /reports/:id. Keeps a list of open report tabs alive at once
// (each ReportPage retains its layout edits, drill state, and config drawer
// independently) and shows only the active one. The URL drives `activeId`.
export function ReportTabsHost() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const openTab = useTabsStore((s) => s.openTab);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);

  useEffect(() => {
    if (!id) return;
    openTab(id);
    setActive(id);
  }, [id, openTab, setActive]);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onPick={(tabId) => {
          if (tabId !== activeId) navigate(`/reports/${tabId}`);
        }}
        onClose={(tabId) => {
          const next = closeTab(tabId);
          if (tabId === activeId) {
            navigate(next ? `/reports/${next}` : "/reports", { replace: true });
          }
        }}
      />
      <div style={{ position: "relative" }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            style={{
              display: t.id === activeId ? "block" : "none",
            }}
          >
            <ReportPage id={t.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
