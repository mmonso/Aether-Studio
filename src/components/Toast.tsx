import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-start justify-between space-x-3 transition-all animate-fade-in ${
            toast.type === 'success'
              ? 'bg-stone-900 border-teal-500/50 text-white'
              : toast.type === 'error'
              ? 'bg-stone-900 border-rose-500/50 text-white'
              : 'bg-stone-900 border-stone-700 text-white'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            {toast.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold text-stone-100">{toast.title}</h4>
              {toast.description && (
                <p className="text-[11px] text-stone-300 mt-0.5 leading-snug">
                  {toast.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
