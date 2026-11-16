import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SearchResultItem } from '@reelmind/shared';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'reelmind_theme';

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
}

export function getInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        applyThemeToDocument(saved);
        return saved;
      }
    } catch {
      // Fall back to default dark theme
    }
  }
  applyThemeToDocument('dark');
  return 'dark';
}

interface StudioState {
  theme: ThemeMode;
  selectedClips: SearchResultItem[];
  toasts: ToastItem[];
}

const initialState: StudioState = {
  theme: getInitialTheme(),
  selectedClips: [],
  toasts: []
};

const studioSlice = createSlice({
  name: 'studio',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
      applyThemeToDocument(action.payload);
    },
    toggleTheme(state) {
      const next: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = next;
      applyThemeToDocument(next);
    },
    toggleSelectedClip(state, action: PayloadAction<SearchResultItem>) {
      const exists = state.selectedClips.find(c => c.sceneId === action.payload.sceneId);
      if (exists) {
        state.selectedClips = state.selectedClips.filter(c => c.sceneId !== action.payload.sceneId);
      } else {
        state.selectedClips.push(action.payload);
      }
    },
    clearSelectedClips(state) {
      state.selectedClips = [];
    },
    addToast(state, action: PayloadAction<Omit<ToastItem, 'id'>>) {
      state.toasts = [
        ...state.toasts.slice(-1),
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...action.payload
        }
      ];
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter(t => t.id !== action.payload);
    }
  }
});

export const {
  setTheme,
  toggleTheme,
  toggleSelectedClip,
  clearSelectedClips,
  addToast,
  removeToast
} = studioSlice.actions;
export default studioSlice.reducer;
