import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { RootState } from '../store';
import { removeToast } from '../store/studioSlice';

export function ToastContainer() {
  const toasts = useSelector((state: RootState) => state.studio.toasts);
  const dispatch = useDispatch();

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => {
      dispatch(removeToast(oldest.id));
    }, 3500);
    return () => clearTimeout(timer);
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-5 sm:right-5 z-50 flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none">
      {toasts.map(t => {
        const icon =
          t.type === 'success' ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : t.type === 'error' ? (
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
          ) : t.type === 'warning' ? (
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          );

        return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-borderSubtle shadow-elevated text-sm sm:text-base text-ink animate-in fade-in slide-in-from-bottom-2"
            >
              {icon}
              <span className="flex-1 font-medium leading-snug">{t.message}</span>
              <button
                onClick={() => dispatch(removeToast(t.id))}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors shrink-0"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
        );
      })}
    </div>
  );
}
