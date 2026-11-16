import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff, Clapperboard, ArrowRight, Loader2 } from 'lucide-react';
import { RegisterSchema, LoginSchema, RegisterInput, LoginInput } from '@reelmind/shared';
import { api } from '../services/api';
import { setCredentials } from '../store/authSlice';
import { addToast } from '../store/studioSlice';
import { ThemeToggle } from '../components/ThemeToggle';

interface AuthPageProps {
  mode: 'login' | 'register';
}

export function AuthPage({ mode }: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isRegister = mode === 'register';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<RegisterInput | LoginInput>({
    resolver: zodResolver(isRegister ? RegisterSchema : LoginSchema)
  });

  const onSubmit = async (values: RegisterInput | LoginInput) => {
    setServerError(null);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const res = await api.post(endpoint, values);
      const { user, accessToken, refreshToken } = res.data.data;
      dispatch(setCredentials({ user, accessToken, refreshToken }));
      dispatch(addToast({ type: 'success', message: `Welcome to ReelMind, ${user.name}!` }));
      navigate('/app/dashboard');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      setServerError(errorObj.response?.data?.error?.message || 'Authentication failed. Please verify your details.');
    }
  };

  const fillDemoAccount = () => {
    setValue('email', 'creator@reelmind.ai');
    setValue('password', 'ReelMind2026!');
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4 pt-20 pb-12 sm:py-12 relative overflow-hidden">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[280px] bg-[#3B82F6]/15 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-ink">ReelMind</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink">
            {isRegister ? 'Create your Studio Account' : 'Welcome back to ReelMind'}
          </h1>
          <p className="text-base text-ink-muted mt-1.5">
            {isRegister
              ? 'Start turning raw media into AI-directed storyboards'
              : 'Sign in to access your media library and projects'}
          </p>
        </div>

        <div className="p-6 sm:p-8 rounded-2xl bg-card border border-borderSubtle shadow-elevated">
          {serverError && (
            <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-sm font-medium">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-2">Full Name</label>
                <input
                  type="text"
                  {...register('name' as keyof RegisterInput)}
                  placeholder="Alex Rivera"
                  className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-base"
                />
                {(errors as Record<string, { message?: string }>).name && (
                  <p className="text-sm text-rose-600 dark:text-rose-400 mt-1.5">
                    {(errors as Record<string, { message?: string }>).name?.message}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-ink-secondary mb-2">Email Address</label>
              <input
                type="email"
                {...register('email')}
                placeholder="you@studio.com"
                className="w-full px-4 py-3 min-h-[46px] rounded-xl input-surface text-base"
              />
              {errors.email && <p className="text-sm text-rose-600 dark:text-rose-400 mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink-secondary mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 min-h-[46px] rounded-xl input-surface text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-hoverSurface transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-rose-600 dark:text-rose-400 mt-1.5">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 min-h-[50px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/25"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isRegister ? 'Creating Studio...' : 'Signing In...'}
                </>
              ) : (
                <>
                  {isRegister ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {!isRegister && (
            <button
              type="button"
              onClick={fillDemoAccount}
              className="mt-3.5 w-full py-3 min-h-[46px] rounded-xl bg-surface border border-borderSubtle hover:border-[#3B82F6]/45 hover:bg-hoverSurface text-sm font-medium text-ink-secondary transition-colors"
            >
              Fill Demo Seed Credentials (if seeded)
            </button>
          )}

          <p className="mt-6 text-center text-sm text-ink-muted">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to ReelMind?{' '}
                <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
