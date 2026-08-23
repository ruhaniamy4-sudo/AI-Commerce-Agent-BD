import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardState {
    activeCustomerId: string | null;
    setActiveCustomerId: (id: string | null) => void;
    // Add other global states as needed
}

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set) => ({
            activeCustomerId: null,
            setActiveCustomerId: (id) => set({ activeCustomerId: id }),
        }),
        {
            name: 'dashboard-storage',
        }
    )
);
