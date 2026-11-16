import { useContext, useEffect, useState } from 'react';
import { ReactReduxContext } from 'react-redux';
import { Moon, Sun } from 'lucide-react';
import { RootState } from '../store';
import { applyThemeToDocument, getInitialTheme, setTheme, ThemeMode } from '../store/studioSlice';
import { updateUser } from '../store/authSlice';
import { api } from '../services/api';

interface ThemeToggleProps {
  compact?: boolean;
  compactOnMobile?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, compactOnMobile = false, className = '' }: ThemeToggleProps) {
  const reduxContext = useContext(ReactReduxContext);
  const [theme, setLocalTheme] = useState<ThemeMode>(() => {
    const state = reduxContext?.store.getState() as RootState | undefined;
    return state?.studio?.theme ?? getInitialTheme();
  });

  useEffect(() => {
    if (!reduxContext) return;
    const syncFromStore = () => {
      const state = reduxContext.store.getState() as RootState | undefined;
      if (state?.studio?.theme) {
        setLocalTheme(state.studio.theme);
      }
    };
    syncFromStore();
    return reduxContext.store.subscribe(syncFromStore);
  }, [reduxContext]);

  const handleToggle = async () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setLocalTheme(next);

    if (reduxContext) {
      reduxContext.store.dispatch(setTheme(next));
      const user = (reduxContext.store.getState() as RootState | undefined)?.auth?.user;
      if (user) {
        reduxContext.store.dispatch(
          updateUser({
            ...user,
            preferences: {
              ...user.preferences,
              theme: next
            }
          })
        );
        try {
          await api.patch('/auth/me', { preferences: { theme: next } });
        } catch {
          // Keep local theme applied even if offline or request fails
        }
      }
    } else {
      applyThemeToDocument(next);
    }
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-borderStrong bg-card hover:bg-hoverSurface text-ink-secondary hover:text-ink transition-colors shadow-sm shrink-0 ${
        compact
          ? 'w-11 h-11'
          : compactOnMobile
            ? 'w-11 h-11 sm:w-auto sm:px-4 sm:py-2.5 sm:min-h-[44px] text-sm font-semibold'
            : 'px-4 py-2.5 min-h-[44px] text-sm font-semibold'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
      ) : (
        <Moon className="w-4 h-4 text-[#2563EB] shrink-0" />
      )}
      {!compact && (
        <span className={compactOnMobile ? 'hidden sm:inline' : ''}>
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
