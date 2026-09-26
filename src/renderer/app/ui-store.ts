import { create } from 'zustand';

type UiStore = {
  sidebarCollapsed: boolean;
  settingsLoaded: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  hydrate: (collapsed: boolean) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  settingsLoaded: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  hydrate: (sidebarCollapsed) => set({ sidebarCollapsed, settingsLoaded: true }),
}));

