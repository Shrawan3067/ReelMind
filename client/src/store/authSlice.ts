import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserPreferences } from '@reelmind/shared';
import { setAuthToken } from '../services/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
  aiConfig: {
    provider: string;
    model?: string;
    embeddingModel?: string;
    baseUrl?: string;
    hasApiKey: boolean;
  };
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: AuthUser; accessToken?: string; refreshToken?: string }>
    ) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      if (action.payload.accessToken) {
        setAuthToken(action.payload.accessToken);
      }
      if (action.payload.refreshToken) {
        localStorage.setItem('reelmind_refresh_token', action.payload.refreshToken);
      }
    },
    updateUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
    clearCredentials(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      setAuthToken(null);
      localStorage.removeItem('reelmind_refresh_token');
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    }
  }
});

export const { setCredentials, updateUser, clearCredentials, setAuthLoading } = authSlice.actions;
export default authSlice.reducer;

