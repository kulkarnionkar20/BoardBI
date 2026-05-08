import type { ReportTab } from "../../store/tabsStore";

type Props = {
  tabs: ReportTab[];
  activeId: string | null;
  onPick: (id: string) => void;
  onClose: (id: string) => void;
};

export function TabBar({ tabs, activeId, onPick, onClose }: Props) {
  if (tabs.length === 0) return null;
  return (
    <div className="tab-bar">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <div key={t.id} className={`tab${active ? " active" : ""}`}>
            <button
              className="tab-name"
              onClick={() => onPick(t.id)}
              title={t.name}
            >
              {t.name}
            </button>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              title="Close tab"
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
