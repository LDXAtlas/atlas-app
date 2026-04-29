"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { acceptInvitation } from "@/app/actions/invitations";

interface JoinFormProps {
  token: string;
  email: string;
  role: string;
  organizationName: string;
}

export function JoinForm({ token, email, role, organizationName }: JoinFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClasses =
    "rounded-full border border-[#E5E7EB] bg-[#F4F5F7] px-4 py-3 text-[#2D333A] placeholder-[#9CA3AF] outline-none transition-shadow duration-200 focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5] focus:shadow-md focus:shadow-[#5CE1A5]/10";

  const fontBody = {
    fontFamily: "var(--font-source-sans), system-ui, sans-serif",
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation(
        token,
        firstName.trim(),
        lastName.trim(),
        password,
      );
      if (result.error) {
        setError(result.error);
      } else {
        // Redirect to login so the new user can sign in
        router.push("/login");
      }
    });
  }

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="flex animate-fade-in flex-col gap-5"
      >
        <h1
          className="mb-1 text-center text-2xl font-bold text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          Join {organizationName}
        </h1>

        <p
          className="text-center text-[15px] text-[#6B7280] -mt-2 mb-2"
          style={fontBody}
        >
          You've been invited as{" "}
          {role === "admin" ? "an" : "a"}{" "}
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{
              color: role === "admin" ? "#5CE1A5" : "#3B82F6",
            }}
          >
            <Shield className="size-3.5 inline" />
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
        </p>

        {error && (
          <div className="animate-fade-in rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Pre-filled email (disabled) */}
        <label className="flex flex-col gap-1.5" style={fontBody}>
          <span className="text-sm font-semibold text-[#2D333A]">Email</span>
          <input
            type="email"
            value={email}
            disabled
            className="rounded-full border border-[#E5E7EB] bg-[#E5E7EB]/40 px-4 py-3 text-[#6B7280] outline-none cursor-not-allowed"
          />
        </label>

        {/* Name fields */}
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5" style={fontBody}>
            <span className="text-sm font-semibold text-[#2D333A]">
              First Name
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              className={inputClasses}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5" style={fontBody}>
            <span className="text-sm font-semibold text-[#2D333A]">
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

        {/* Password */}
        <label className="flex flex-col gap-1.5" style={fontBody}>
          <span className="text-sm font-semibold text-[#2D333A]">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className={inputClasses}
          />
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="h-12 rounded-full font-semibold text-[#060C09] transition-all duration-200 hover:shadow-lg hover:shadow-[#5CE1A5]/20 active:scale-[0.97] disabled:opacity-50"
          style={{
            fontFamily: "var(--font-poppins), system-ui, sans-serif",
            backgroundColor: "#5CE1A5",
          }}
        >
          {isPending ? "Creating Account..." : "Create Account & Join"}
        </button>
      </form>
    </div>
  );
}
