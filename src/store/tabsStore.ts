import { create } from "zustand";

// Open report tabs. Multiple ReportPages can be mounted at once (each with
// their own slicer state, gadget edits, etc.); this store tracks which ones
// are open and which is currently visible. The URL drives `activeId` via
// ReportTabsHost.

export type ReportTab = { id: string; name: string };

type State = {
  tabs: ReportTab[];
  activeId: string | null;
  openTab: (id: string, name?: string) => void;
  closeTab: (id: string) => string | null; // returns the new active id (or null)
  setActive: (id: string) => void;
  updateTabName: (id: string, name: string) => void;
};

export const useTabsStore = create<State>((set, get) => ({
  tabs: [],
  activeId: null,

  openTab: (id, name) => {
    const cur = get();
    const existing = cur.tabs.find((t) => t.id === id);
    if (existing) {
      if (name && existing.name !== name) {
        set({ tabs: cur.tabs.map((t) => (t.id === id ? { ...t, name } : t)) });
      }
      return;
    }
    set({ tabs: [...cur.tabs, { id, name: name ?? "Loading…" }] });
  },

  closeTab: (id) => {
    const { tabs, activeId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return activeId;
    const nextTabs = tabs.filter((t) => t.id !== id);
    let nextActive: string | null = activeId;
    if (activeId === id) {
      nextActive = nextTabs[idx]?.id ?? nextTabs[idx - 1]?.id ?? null;
    }
    set({ tabs: nextTabs, activeId: nextActive });
    return nextActive;
  },

  setActive: (id) => {
    if (get().activeId === id) return;
    set({ activeId: id });
  },

  updateTabName: (id, name) => {
    const cur = get();
    const t = cur.tabs.find((x) => x.id === id);
    if (!t || t.name === name) return;
    set({ tabs: cur.tabs.map((x) => (x.id === id ? { ...x, name } : x)) });
  },
}));
