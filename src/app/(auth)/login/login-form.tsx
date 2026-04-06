"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex animate-fade-in flex-col gap-5">
      <h1
        className="text-center text-2xl font-bold text-foreground"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        Welcome Back
      </h1>

      {state.error && (
        <div className="animate-fade-in rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <label
        className="flex flex-col gap-1.5"
        style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
      >
        <span className="text-sm font-semibold text-foreground">Email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded-full border border-gray-300 px-4 py-3 text-foreground outline-none transition-shadow duration-200 focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5] focus:shadow-md focus:shadow-[#5CE1A5]/10"
        />
      </label>

      <label
        className="flex flex-col gap-1.5"
        style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
      >
        <span className="text-sm font-semibold text-foreground">Password</span>
        <input
          type="password"
          name="password"
          required
          placeholder="Your password"
          className="rounded-full border border-gray-300 px-4 py-3 text-foreground outline-none transition-shadow duration-200 focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5] focus:shadow-md focus:shadow-[#5CE1A5]/10"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-[#5CE1A5] font-semibold text-[#060C09] transition-all duration-200 hover:bg-[#A0F1C8] hover:shadow-lg hover:shadow-[#5CE1A5]/20 active:scale-[0.97] disabled:opacity-50"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        {pending ? "Signing in..." : "Sign In"}
      </button>

      <p
        className="text-center text-sm text-gray-500"
        style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-[#5CE1A5] transition-colors duration-200 hover:text-[#A0F1C8]"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
