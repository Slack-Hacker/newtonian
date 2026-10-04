import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'error' | 'success' | 'warning' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => onDismiss(t.id)}>
          {t.type === 'error' && <AlertCircle size={18} color="var(--accent-rose)" />}
          {t.type === 'success' && <CheckCircle size={18} color="var(--accent-emerald)" />}
          {t.type === 'warning' && <AlertTriangle size={18} color="var(--accent-amber)" />}
          {t.type === 'info' && <Info size={18} color="var(--accent-blue)" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
};
