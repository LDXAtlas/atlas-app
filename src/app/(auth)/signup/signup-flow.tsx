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
  const [showPassword, setShowPassword] = useState(false);

  // Helper to calculate password strength (0 to 4)
  const calculateStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (pass.match(/[A-Z]/)) score += 1;
    if (pass.match(/[0-9]/)) score += 1;
    if (pass.match(/[^a-zA-Z0-9]/)) score += 1;
    return score;
  };
  const strength = calculateStrength(password);

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
    "w-full rounded-full border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition-shadow duration-200 focus:border-mint focus:ring-1 focus:ring-mint focus:shadow-md focus:shadow-mint/10";

  const fontBody = {
    fontFamily: "var(--font-source-sans), system-ui, sans-serif",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex animate-fade-in flex-col gap-5"
    >
      <div className="mb-1">
        <h3 
          className="text-2xl font-semibold text-gray-900" 
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          Create account
        </h3>
      </div>

      {error && (
        <div 
          className="animate-fade-in rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5" style={fontBody}>
          <label htmlFor="firstName" className="text-sm font-semibold text-gray-900">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            className={inputClasses}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5" style={fontBody}>
          <label htmlFor="lastName" className="text-sm font-semibold text-gray-900">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
            className={inputClasses}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5" style={fontBody}>
        <label htmlFor="churchName" className="text-sm font-semibold text-gray-900">
          Church Name
        </label>
        <input
          id="churchName"
          type="text"
          value={churchName}
          onChange={(e) => setChurchName(e.target.value)}
          placeholder="e.g. Grace Community Church"
          className={inputClasses}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5" style={fontBody}>
        <label htmlFor="email" className="text-sm font-semibold text-gray-900">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pastor@yourchurch.org"
          className={inputClasses}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5" style={fontBody}>
        <label htmlFor="password" className="text-sm font-semibold text-gray-900">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            className={`${inputClasses} pr-12`}
            required
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

        {/* Password Strength Meter */}
        <div className="mt-1 flex gap-1 px-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-1 w-full rounded-full transition-colors duration-300 ${
                strength >= level
                  ? strength <= 2
                    ? "bg-yellow-400"
                    : "bg-mint"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Terms and Privacy Policy Text */}
      <p className="text-xs text-gray-500" style={fontBody}>
        By creating an account you agree to our{" "}
        <Link href="https://www.atlaschurchsolutions.com/legal.html#tos" className="font-semibold text-mint transition-colors hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="https://www.atlaschurchsolutions.com/legal.html#privacy-policy" className="font-semibold text-mint transition-colors hover:underline">
          Privacy Policy
        </Link>.
      </p>

      <button
        type="submit"
        disabled={submitting}
        aria-disabled={submitting}
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-mint font-semibold text-gray-900 transition-all duration-200 hover:bg-mint/80 hover:shadow-lg hover:shadow-mint/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        {submitting ? "Creating account..." : "Create Account \u2192"}
      </button>

      <p
        className="mt-2 text-center text-sm text-gray-500"
        style={fontBody}
      >
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-mint transition-colors duration-200 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}