import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { api, getAuthToken } from './services/api';
import { setCredentials, clearCredentials, setAuthLoading } from './store/authSlice';
import { setTheme } from './store/studioSlice';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/ToastContainer';
import { AppLayout } from './layouts/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MediaLibraryPage = lazy(() => import('./pages/MediaLibraryPage').then(m => ({ default: m.MediaLibraryPage })));
const AISearchStudioPage = lazy(() => import('./pages/AISearchStudioPage').then(m => ({ default: m.AISearchStudioPage })));
const StoryboardStudioPage = lazy(() => import('./pages/StoryboardStudioPage').then(m => ({ default: m.StoryboardStudioPage })));
const ContentStudioPage = lazy(() => import('./pages/ContentStudioPage').then(m => ({ default: m.ContentStudioPage })));
const ProcessingCenterPage = lazy(() => import('./pages/ProcessingCenterPage').then(m => ({ default: m.ProcessingCenterPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="p-8 space-y-4 bg-canvas min-h-screen">
      <div className="h-10 w-64 rounded-xl bg-card border border-borderSubtle animate-pulse" />
      <div className="h-64 rounded-2xl bg-surface border border-borderSubtle animate-pulse" />
    </div>
  );
}

export function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAuthToken();
      if (!token) {
        dispatch(setAuthLoading(false));
        return;
      }
      try {
        const res = await api.get('/auth/me');
        const user = res.data.data.user;
        dispatch(setCredentials({ user }));
        if (user?.preferences?.theme === 'light' || user?.preferences?.theme === 'dark') {
          dispatch(setTheme(user.preferences.theme));
        }
      } catch {
        dispatch(clearCredentials());
      }
    };
    restoreSession();
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="library" element={<MediaLibraryPage />} />
              <Route path="search" element={<AISearchStudioPage />} />
              <Route path="storyboard" element={<StoryboardStudioPage />} />
              <Route path="storyboard/:id" element={<StoryboardStudioPage />} />
              <Route path="content" element={<ContentStudioPage />} />
              <Route path="processing" element={<ProcessingCenterPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
