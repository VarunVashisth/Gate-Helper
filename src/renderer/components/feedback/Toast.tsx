import { create } from 'zustand';
import { CheckCircle2, X } from 'lucide-react';

type Toast = { id: number; message: string };
type ToastStore = {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
};

let nextToastId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message) => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts, { id, message }] }));
    window.setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <CheckCircle2 size={18} />
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

