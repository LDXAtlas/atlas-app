"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex animate-fade-in flex-col gap-5">
      
      {/* Restored the "Sign in" header from your original HTML design */}
      <div className="mb-1">
        <h3 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}>
          Sign in
        </h3>
      </div>

      {state.error && (
        <div 
          className="animate-fade-in rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
          role="alert"
          aria-live="assertive"
        >
          {state.error}
        </div>
      )}

      {/* Email Field */}
      <div
        className="flex flex-col gap-1.5"
        style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
      >
        <label htmlFor="email" className="text-sm font-semibold text-gray-900">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="pastor@yourchurch.org"
          className="w-full rounded-full border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition-shadow duration-200 focus:border-mint focus:ring-1 focus:ring-mint focus:shadow-md focus:shadow-mint/10"
        />
      </div>

      {/* Password Field */}
      <div
        className="flex flex-col gap-1.5"
        style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-semibold text-gray-900">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-mint transition-colors hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className="w-full rounded-full border border-gray-300 px-4 py-3 pr-12 text-sm text-gray-900 outline-none transition-shadow duration-200 focus:border-mint focus:ring-1 focus:ring-mint focus:shadow-md focus:shadow-mint/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {showPassword ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          name="remember"
          className="h-4 w-4 appearance-none rounded border border-gray-300 bg-white transition-all checked:border-mint checked:bg-mint hover:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20 flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:opacity-0 checked:after:opacity-100"
        />
        <span className="text-sm text-gray-500" style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}>
          Remember me for 30 days
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-mint font-semibold text-gray-900 transition-all duration-200 hover:bg-mint/80 hover:shadow-lg hover:shadow-mint/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        {pending ? "Signing in..." : "Sign in \u2192"}
      </button>

      <p
        className="mt-2 text-center text-sm text-gray-500"
        style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-mint transition-colors duration-200 hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}