"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";

export function SignupFlow() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [churchName, setChurchName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName || !lastName || !churchName || !email || !password) {
      setError("All fields are required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await signUp({
      email,
      password,
      firstName,
      lastName,
      organizationName: churchName,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  const inputClasses =
    "rounded-full border border-gray-300 px-4 py-3 text-foreground outline-none transition-shadow duration-200 focus:border-mint focus:ring-1 focus:ring-mint focus:shadow-md focus:shadow-mint/10";

  const fontBody = {
    fontFamily: "var(--font-source-sans), system-ui, sans-serif",
  };

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="flex animate-fade-in flex-col gap-5"
      >
        <h1
          className="mb-2 text-center text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          Create your account
        </h1>

        {error && (
          <div className="animate-fade-in rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5" style={fontBody}>
            <span className="text-sm font-semibold text-foreground">
              First Name
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1.5" style={fontBody}>
            <span className="text-sm font-semibold text-foreground">
              Last Name
            </span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              className={inputClasses}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5" style={fontBody}>
          <span className="text-sm font-semibold text-foreground">
            Church Name
          </span>
          <input
            type="text"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            placeholder="e.g. Grace Community Church"
            className={inputClasses}
          />
        </label>

        <label className="flex flex-col gap-1.5" style={fontBody}>
          <span className="text-sm font-semibold text-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClasses}
          />
        </label>

        <label className="flex flex-col gap-1.5" style={fontBody}>
          <span className="text-sm font-semibold text-foreground">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            className={inputClasses}
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="h-12 rounded-full bg-mint font-semibold text-dark transition-all duration-200 hover:bg-mint-light hover:shadow-lg hover:shadow-mint/20 active:scale-[0.97] disabled:opacity-50"
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          {submitting ? "Creating account..." : "Create Account"}
        </button>

        <p
          className="text-center text-sm text-gray-500"
          style={fontBody}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-mint transition-colors duration-200 hover:text-mint-light"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
