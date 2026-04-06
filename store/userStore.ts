import { create } from "zustand";
import { persist } from "zustand/middleware";

type UserStore = {
  name: string;
  id: string;
  setName: (name: string) => void;
  setId: (id: string) => void;
  clear: () => void;
}

export const useUserStore = create(
  persist<UserStore>(
    (set) => ({
      name: "",
      id: "",
      setName: (name: string) => set({ name }),
      setId: (id: string) => set({ id }),
      clear: () => set({ name: "", id: ""}),
    }),
    { name: "user-store" }
  ),
);