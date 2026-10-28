import { useState, type FormEvent } from 'react';
import { Sparkles, Eye, EyeOff, LogIn, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onClose?: () => void;
  promptMessage?: string | null;
}

export default function LoginPage({ onSwitchToRegister, onClose, promptMessage }: LoginPageProps) {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      await login({ username: username.trim(), password });
      // AuthContext sets the user — App.tsx will re-render and show the main UI
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      const cleanMsg = (rawMsg.includes('JSON') || rawMsg.includes('DOCTYPE') || rawMsg.includes('token') || rawMsg.includes('<'))
        ? 'Authentication service is temporarily unavailable or reconnecting. Please try again in a few moments.'
        : rawMsg;
      setError(cleanMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#0b0f17] px-4 relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Return to Overview"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-white dark:text-black fill-current" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              SkillBridge AI
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sign in to your account
            </p>
          </div>
        </div>

        {/* Prompt notification banner */}
        {promptMessage && (
          <div className="mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 p-3.5 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5 shadow-xs">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-500 animate-pulse" />
            <span className="font-medium">{promptMessage}</span>
          </div>
        )}

        {/* Card */}
        <div className="bg-white dark:bg-[#0e131f] rounded-2xl border border-slate-200 dark:border-slate-800 p-7 shadow-sm space-y-5">

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="your_username"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-100 text-white dark:text-slate-900 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="animate-pulse">Signing in...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Switch */}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
