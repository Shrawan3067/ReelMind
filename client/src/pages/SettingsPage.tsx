import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import {
  HardDrive,
  Cpu,
  User as UserIcon,
  RefreshCw,
  PlugZap,
  Unplug,
  Database,
  Loader2,
  ShieldCheck,
  Trash2,
  Moon,
  Sun
} from 'lucide-react';
import { RootState } from '../store';
import { api } from '../services/api';
import { updateUser } from '../store/authSlice';
import { addToast, setTheme, ThemeMode } from '../store/studioSlice';

export function SettingsPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const theme = useSelector((state: RootState) => state.studio.theme);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || '');
  const [aiProvider, setAiProvider] = useState(user?.aiConfig?.provider || 'none');
  const [aiModel, setAiModel] = useState(user?.aiConfig?.model || '');
  const [aiBaseUrl, setAiBaseUrl] = useState(user?.aiConfig?.baseUrl || '');
  const [aiApiKey, setAiApiKey] = useState('');

  const [nasHost, setNasHost] = useState('');
  const [nasPort, setNasPort] = useState(80);
  const [nasUseSsl, setNasUseSsl] = useState(false);
  const [nasMountPoint, setNasMountPoint] = useState('');
  const [nasShareName, setNasShareName] = useState('');
  const [nasApiKey, setNasApiKey] = useState('');

  const { data: nasStatus } = useQuery({
    queryKey: ['nas-status'],
    queryFn: async () => {
      const res = await api.get('/nas/status');
      return res.data.data;
    }
  });

  useEffect(() => {
    if (nasStatus?.configuration) {
      setNasHost(nasStatus.configuration.host || '');
      setNasPort(nasStatus.configuration.port || 80);
      setNasUseSsl(Boolean(nasStatus.configuration.useSsl));
      setNasMountPoint(nasStatus.configuration.nasMountPoint || '');
      setNasShareName(nasStatus.configuration.shareName || '');
    }
  }, [nasStatus]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/auth/me', {
        name,
        preferences: { theme },
        aiConfig: {
          provider: aiProvider,
          model: aiModel || undefined,
          baseUrl: aiBaseUrl || undefined,
          apiKey: aiApiKey.trim() || undefined
        }
      });
      return res.data.data.user;
    },
    onSuccess: updated => {
      dispatch(updateUser(updated));
      setAiApiKey('');
      dispatch(addToast({ type: 'success', message: 'Profile & AI provider settings saved!' }));
    }
  });

  const handleThemeSelect = (nextTheme: ThemeMode) => {
    dispatch(setTheme(nextTheme));
  };

  const connectNasMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/nas/connect', {
        host: nasHost || undefined,
        port: Number(nasPort),
        useSsl: nasUseSsl,
        nasMountPoint: nasMountPoint || undefined,
        shareName: nasShareName || undefined,
        apiKey: nasApiKey || undefined
      });
      return res.data.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['nas-status'] });
      dispatch(
        addToast({
          type: data.connected ? 'success' : 'warning',
          message: data.message
        })
      );
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      dispatch(addToast({ type: 'error', message: e.response?.data?.error?.message || 'Connection check failed' }));
    }
  });

  const syncNasMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/nas/sync');
      return res.data.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['nas-status'] });
      dispatch(
        addToast({
          type: data.connected ? 'success' : 'warning',
          message: data.message
        })
      );
    }
  });

  const disconnectNasMutation = useMutation({
    mutationFn: async () => {
      await api.post('/nas/disconnect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nas-status'] });
      dispatch(addToast({ type: 'info', message: 'UGREEN NAS disconnected.' }));
    }
  });

  const clearDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/media/clear-demo');
      return res.data.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      dispatch(addToast({ type: 'info', message: `Removed ${data.removedCount} isolated DEMO DATA items.` }));
    }
  });

  const { data: sessionsData } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: async () => {
      const res = await api.get('/auth/sessions');
      return res.data.data.sessions as Array<{
        sessionId: string;
        userAgent: string;
        createdAt: string;
        expiresAt: string;
      }>;
    }
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
      dispatch(addToast({ type: 'success', message: 'Session revoked cleanly.' }));
    }
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          Studio Settings & UGREEN NAS
        </h1>
        <p className="text-base text-ink-secondary mt-1">
          Configure your profile, theme appearance, AI provider adapter, and authorized UGREEN NAS connectivity.
        </p>
      </div>

      {/* Profile & Theme Appearance */}
      <div className="p-6 sm:p-7 rounded-2xl panel-card space-y-5">
        <h2 className="font-display font-bold text-lg sm:text-xl text-ink flex items-center gap-2.5">
          <UserIcon className="w-5 h-5 text-[#3B82F6]" />
          User Profile & Studio Appearance
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">Studio Color Theme</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleThemeSelect('dark')}
                aria-pressed={theme === 'dark'}
                className={`px-4 py-3 min-h-[46px] rounded-xl border text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 transition-all ${
                  theme === 'dark'
                    ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-lg shadow-blue-600/25'
                    : 'subtle-surface hover:border-[#3B82F6]/50 text-ink-secondary hover:text-ink'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => handleThemeSelect('light')}
                aria-pressed={theme === 'light'}
                className={`px-4 py-3 min-h-[46px] rounded-xl border text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 transition-all ${
                  theme === 'light'
                    ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-lg shadow-blue-600/25'
                    : 'subtle-surface hover:border-[#3B82F6]/50 text-ink-secondary hover:text-ink'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Provider-Independent AI Config */}
      <div className="p-6 sm:p-7 rounded-2xl panel-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-lg sm:text-xl text-ink flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            AI Provider Configuration
          </h2>
          {user?.aiConfig?.hasApiKey && (
            <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-semibold">
              Encrypted Key Stored
            </span>
          )}
        </div>

        <p className="text-sm text-ink-muted leading-relaxed">
          Keys are encrypted server-side with AES-256-GCM and never exposed to the browser. When set to "Deterministic Local Engine", ReelMind uses offline semantic embeddings and rule-based planning without hallucinating vision inspections.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">Active Provider</label>
            <select
              value={aiProvider}
              onChange={e => setAiProvider(e.target.value)}
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            >
              <option value="none">Deterministic Local Engine (No API Key Needed)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Local Ollama Instance</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">Model Name (Optional Override)</label>
            <input
              type="text"
              value={aiModel}
              onChange={e => setAiModel(e.target.value)}
              placeholder="e.g., gemini-2.0-flash, gpt-4o-mini"
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              API Key (Leave blank to keep existing)
            </label>
            <input
              type="password"
              value={aiApiKey}
              onChange={e => setAiApiKey(e.target.value)}
              placeholder="sk-... / AIza..."
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">Custom Base URL (Ollama / Proxy)</label>
            <input
              type="text"
              value={aiBaseUrl}
              onChange={e => setAiBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
          </div>
        </div>

        <button
          onClick={() => saveProfileMutation.mutate()}
          disabled={saveProfileMutation.isPending}
          className="px-6 py-3 min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/25"
        >
          {saveProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Profile & AI Settings
        </button>
      </div>

      {/* UGREEN AI NAS Connection */}
      <div className="p-6 sm:p-7 rounded-2xl panel-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-lg sm:text-xl text-ink flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            UGREEN AI NAS Integration
          </h2>
          <span
            className={`px-3.5 py-1 rounded-full text-xs sm:text-sm font-semibold capitalize border ${
              nasStatus?.connected
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
            }`}
          >
            {nasStatus?.status || 'disconnected'}
          </span>
        </div>

        <p className="text-sm text-ink-secondary subtle-surface p-4 rounded-xl leading-relaxed">
          {nasStatus?.message || 'Checking UGREEN NAS status...'}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">UGOS Host / IP Address</label>
            <input
              type="text"
              value={nasHost}
              onChange={e => setNasHost(e.target.value)}
              placeholder="e.g., 192.168.1.100 or ugreen-nas.local"
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-ink-secondary mb-2">Port</label>
              <input
                type="number"
                value={nasPort}
                onChange={e => setNasPort(Number(e.target.value))}
                className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base font-mono"
              />
            </div>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-2.5 text-sm font-medium text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={nasUseSsl}
                  onChange={e => setNasUseSsl(e.target.checked)}
                  className="w-4 h-4 rounded border-borderStrong bg-card text-[#3B82F6] focus:ring-[#3B82F6]"
                />
                Use HTTPS/SSL
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              Authorized Local Mount Path (Read-Only)
            </label>
            <input
              type="text"
              value={nasMountPoint}
              onChange={e => setNasMountPoint(e.target.value)}
              placeholder="/Volumes/UGREEN_Media"
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-2">
              NAS API Token (Encrypted at Rest)
            </label>
            <input
              type="password"
              value={nasApiKey}
              onChange={e => setNasApiKey(e.target.value)}
              placeholder="UGOS Authorized Token"
              className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => connectNasMutation.mutate()}
            disabled={connectNasMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-[#06B6D4] hover:bg-cyan-400 text-[#090B10] text-sm sm:text-base font-bold transition-colors shadow-lg shadow-cyan-500/20"
          >
            <PlugZap className="w-4 h-4" />
            Verify & Save NAS Config
          </button>
          <button
            onClick={() => syncNasMutation.mutate()}
            disabled={syncNasMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/50 hover:bg-hoverSurface text-sm sm:text-base font-semibold text-ink transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Authorized Media
          </button>
          <button
            onClick={() => disconnectNasMutation.mutate()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-sm sm:text-base font-semibold transition-colors"
          >
            <Unplug className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Demo Data Isolation Controls */}
      <div className="p-6 sm:p-7 rounded-2xl panel-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-lg sm:text-xl text-ink flex items-center gap-2.5">
            <Database className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            Isolated Demo Media Dataset
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Remove synthetic demo media and scenes cleanly without affecting any uploaded or NAS files.
          </p>
        </div>
        <button
          onClick={() => clearDemoMutation.mutate()}
          disabled={clearDemoMutation.isPending}
          className="px-5 py-3 min-h-[46px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-sm sm:text-base font-semibold transition-colors"
        >
          Clear All DEMO DATA
        </button>
      </div>

      {/* Active Security Sessions */}
      <div className="p-6 sm:p-7 rounded-2xl panel-card space-y-4">
        <h2 className="font-display font-bold text-lg sm:text-xl text-ink flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Active Sessions & Security
        </h2>
        <div className="space-y-3">
          {!sessionsData || sessionsData.length === 0 ? (
            <p className="text-sm text-ink-muted">No active refresh sessions recorded.</p>
          ) : (
            sessionsData.map(sess => (
              <div
                key={sess.sessionId}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 p-4 rounded-xl subtle-surface text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{sess.userAgent}</p>
                  <p className="text-xs sm:text-sm text-ink-muted font-mono mt-1">
                    Started {new Date(sess.createdAt).toLocaleString()} • Expires{' '}
                    {new Date(sess.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeSessionMutation.mutate(sess.sessionId)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-sm font-semibold shrink-0 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
