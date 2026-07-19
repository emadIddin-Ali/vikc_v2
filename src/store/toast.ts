import { create } from 'zustand';

type ToastState = {
  message: string | null;
  show: (m: string) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (m) => set({ message: m }),
  hide: () => set({ message: null }),
}));

/** Imperative helper — call from anywhere (e.g. mutation callbacks). */
export const toast = (m: string) => useToastStore.getState().show(m);
