import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrandMark } from '../../components/ui/BrandLogo';

export interface LoginViewProps {
  initialEmail?: string;
  loading?: boolean;
  error?: string | null;
  onLogin: (email: string, password: string, remember: boolean) => Promise<void>;
}

export function LoginView({
  initialEmail = '',
  loading = false,
  error = null,
  onLogin,
}: LoginViewProps): ReactNode {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setLocalError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLocalError(null);
    await onLogin(email.trim(), password, remember);
  }

  const visibleError = localError ?? error;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-fit">
            <BrandMark size={72} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
            العبارة للتجارة والتوريدات
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            القاهرة — تسجيل الدخول إلى النظام المالي
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          {visibleError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            >
              ⚠️ {visibleError}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              البريد الإلكتروني
            </label>
            <input
              id="login-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              كلمة المرور
            </label>
            <input
              id="login-password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="mb-6 flex items-center justify-between">
            <label htmlFor="login-remember" className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <input
                id="login-remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              تذكرني
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:from-indigo-700 hover:to-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          العبارة للتجارة والتوريدات — القاهرة
        </p>
      </div>
    </div>
  );
}
