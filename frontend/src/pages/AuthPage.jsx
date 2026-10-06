import React, { useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.1 9 8a8.3 8.3 0 0 1-2 3.7M6.6 6.6C4.2 8.2 3 10.5 3 12c0 2.9 3.5 8 9 8a9.7 9.7 0 0 0 3.3-.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 12c0-2.9 3.5-8 9-8s9 5.1 9 8-3.5 8-9 8-9-5.1-9-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function getRequestErrorMessage(
  error,
  fallbackMessage,
) {
  const responseData = error?.response?.data;

  /*
   * Supports:
   * {
   *   errors: [
   *     { field: "body.email", message: "Invalid email" }
   *   ]
   * }
   */
  if (
    Array.isArray(responseData?.errors) &&
    responseData.errors.length > 0
  ) {
    const firstError = responseData.errors.find(
      (item) => item?.message,
    );

    if (firstError?.message) {
      return firstError.message;
    }
  }

  /*
   * Supports older Zod flatten responses:
   * {
   *   details: {
   *     fieldErrors: {
   *       email: ["Invalid email"]
   *     }
   *   }
   * }
   */
  const fieldErrors =
    responseData?.details?.fieldErrors;

  if (fieldErrors) {
    const firstFieldError = Object.values(fieldErrors)
      .flat()
      .find(Boolean);

    if (firstFieldError) {
      return firstFieldError;
    }
  }

  if (responseData?.message) {
    return responseData.message;
  }

  if (error?.message) {
    return error.message;
  }

  return fallbackMessage;
}

export default function AuthPage({
  initialMode,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const { login, register } = useAuth();

  const mode =
    initialMode ||
    (location.pathname === '/register'
      ? 'register'
      : 'login');

  const isLogin = mode === 'login';

  const [form, setForm] = useState({
    name: '',
    companyName: '',
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] =
    useState(false);

  const passwordHint = useMemo(() => {
    if (!form.password) {
      return 'Minimum 8 characters';
    }

    if (form.password.length >= 8) {
      return 'Password length looks good';
    }

    return `${
      8 - form.password.length
    } more character(s) required`;
  }, [form.password]);

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError('');
  }

  function switchMode(nextMode) {
    if (loading) {
      return;
    }

    setError('');
    setShowPassword(false);

    navigate(
      nextMode === 'login'
        ? '/login'
        : '/register',
    );
  }

  async function submit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const email = form.email
        .trim()
        .toLowerCase();

      if (isLogin) {
        await login({
          email,
          password: form.password,
        });
      } else {
        await register({
          name: form.name.trim(),
          companyName:
            form.companyName.trim(),
          email,
          password: form.password,
        });
      }

      navigate('/dashboard', {
        replace: true,
      });
    } catch (requestError) {
      console.error(
        'Authentication request failed:',
        requestError?.response?.data ||
          requestError,
      );

      setError(
        getRequestErrorMessage(
          requestError,
          isLogin
            ? 'Unable to sign in.'
            : 'Unable to create account.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = [
    'w-full rounded-xl border',
    'border-slate-700 bg-slate-950/70',
    'px-4 py-3 text-sm text-white',
    'placeholder:text-slate-600',
    'outline-none transition',
    'focus:border-brand-400',
    'focus:ring-4 focus:ring-brand-500/10',
    'disabled:cursor-not-allowed',
    'disabled:opacity-60',
  ].join(' ');

  return (
    <main className="min-h-screen bg-[#070b14] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)]">
      <aside className="relative hidden overflow-hidden border-r border-slate-800 bg-[#0a1020] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 top-12 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <img
            src="/talentlens-logo.png"
            alt="TalentLens AI"
            className="h-12 w-12 object-contain"
          />

          <div>
            <strong className="block text-xl">
              TalentLens AI
            </strong>

            <span className="text-sm text-slate-500">
              Powered by Talio
            </span>
          </div>
        </div>

        <div className="relative max-w-xl">
          <span className="mb-4 block text-xs font-black uppercase tracking-[.2em] text-brand-400">
            Recruiter workspace
          </span>

          <h1 className="text-5xl font-black leading-tight">
            Move from resumes to confident hiring
            decisions.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-400">
            Screen candidates, compare job-fit
            evidence, and generate professional
            reports from one secure workspace.
          </p>

          <div className="mt-10 grid gap-4">
            {[
              'Structured candidate insights',
              'Recruiter-ready PDF and CSV reports',
              'Protected screening history',
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-white/[.03] p-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 text-sm font-black text-brand-400">
                  0{index + 1}
                </span>

                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-slate-500">
          Resume screening workspace ready
        </p>
      </aside>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:px-10">
        <div className="w-full max-w-[460px] rounded-3xl border border-slate-800 bg-[#0b1220] p-6 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/talentlens-logo.png"
              alt="TalentLens AI"
              className="h-10 w-10 object-contain"
            />

            <strong className="text-xl">
              TalentLens AI
            </strong>
          </div>

          <span className="text-xs font-black uppercase tracking-[.2em] text-brand-400">
            Recruiter portal
          </span>

          <h2 className="mt-3 text-3xl font-black">
            {isLogin
              ? 'Welcome back'
              : 'Create your account'}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isLogin
              ? 'Sign in to continue managing candidate screenings.'
              : 'Set up your recruiter workspace in seconds.'}
          </p>

          <div className="mt-8 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => switchMode('login')}
              className={`rounded-lg py-2.5 text-sm font-bold transition ${
                isLogin
                  ? 'bg-brand-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Login
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                switchMode('register')
              }
              className={`rounded-lg py-2.5 text-sm font-bold transition ${
                !isLogin
                  ? 'bg-brand-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <form
            onSubmit={submit}
            className="mt-7 space-y-5"
          >
            {!isLogin && (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">
                    Full name
                  </span>

                  <input
                    className={fieldClass}
                    required
                    minLength={2}
                    maxLength={80}
                    disabled={loading}
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) =>
                      update(
                        'name',
                        event.target.value,
                      )
                    }
                    placeholder="Enter your full name"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">
                    Company name
                  </span>

                  <input
                    className={fieldClass}
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={loading}
                    autoComplete="organization"
                    value={form.companyName}
                    onChange={(event) =>
                      update(
                        'companyName',
                        event.target.value,
                      )
                    }
                    placeholder="Enter your organization name"
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-300">
                Work email
              </span>

              <input
                className={fieldClass}
                type="email"
                required
                disabled={loading}
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  update(
                    'email',
                    event.target.value,
                  )
                }
                placeholder="name@company.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-300">
                Password
              </span>

              <div className="relative">
                <input
                  className={`${fieldClass} pr-12`}
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  required
                  minLength={isLogin ? 1 : 8}
                  disabled={loading}
                  autoComplete={
                    isLogin
                      ? 'current-password'
                      : 'new-password'
                  }
                  value={form.password}
                  onChange={(event) =>
                    update(
                      'password',
                      event.target.value,
                    )
                  }
                  placeholder="Enter your password"
                />

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  className="absolute inset-y-0 right-1.5 grid w-10 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  aria-pressed={showPassword}
                  title={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  <EyeIcon
                    visible={showPassword}
                  />
                </button>
              </div>

              {!isLogin && (
                <small
                  className={`mt-2 block text-xs ${
                    form.password.length >= 8
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  {passwordHint}
                </small>
              )}
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-950/30 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Please wait…'
                : isLogin
                  ? 'Sign in to workspace'
                  : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-600">
            By continuing, you agree to protect
            candidate information and use TalentLens
            AI responsibly.
          </p>
        </div>
      </section>
    </main>
  );
}