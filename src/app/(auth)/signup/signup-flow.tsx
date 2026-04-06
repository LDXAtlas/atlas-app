"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";

type Flow = "choose" | "create" | "join";
type CreateStep = "plan" | "org-name" | "account";
type JoinStep = "org-id" | "account";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    seats: 5,
    members: "500",
    badge: null,
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    seats: 8,
    members: "1,200",
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 149,
    seats: 15,
    members: "Unlimited",
    badge: null,
  },
] as const;

/** Wrapper that fades content in whenever `stepKey` changes. */
function StepTransition({
  stepKey,
  children,
}: {
  stepKey: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [displayKey, setDisplayKey] = useState(stepKey);

  useEffect(() => {
    if (stepKey !== displayKey) {
      // New step — fade out, swap, fade in
      setVisible(false);
      const t = setTimeout(() => {
        setDisplayKey(stepKey);
        setVisible(true);
      }, 200);
      return () => clearTimeout(t);
    } else {
      // Initial mount
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    }
  }, [stepKey, displayKey]);

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {children}
    </div>
  );
}

export function SignupFlow() {
  const [flow, setFlow] = useState<Flow>("choose");
  const [createStep, setCreateStep] = useState<CreateStep>("plan");
  const [joinStep, setJoinStep] = useState<JoinStep>("org-id");

  // Collected data
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Build a composite key for the transition wrapper
  const stepKey =
    flow === "choose"
      ? "choose"
      : flow === "create"
        ? `create-${createStep}`
        : `join-${joinStep}`;

  const handleBack = useCallback(() => {
    setError(null);
    if (flow === "create") {
      if (createStep === "account") setCreateStep("org-name");
      else if (createStep === "org-name") setCreateStep("plan");
      else setFlow("choose");
    } else if (flow === "join") {
      if (joinStep === "account") setJoinStep("org-id");
      else setFlow("choose");
    }
  }, [flow, createStep, joinStep]);

  async function handleSubmit() {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!firstName || !lastName || !email || !password) {
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
      ...(flow === "create"
        ? { organizationName, plan: selectedPlan }
        : { organizationId }),
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  // ── Render current step ──
  function renderStep() {
    // ── Choose flow ──
    if (flow === "choose") {
      return (
        <div className="w-full max-w-2xl">
          <h1
            className="mb-8 text-center text-2xl font-bold text-foreground"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Get Started with Atlas
          </h1>

          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceCard
              title="Create a New Organization"
              description="Set up a fresh workspace for your church or ministry."
              onClick={() => {
                setFlow("create");
                setCreateStep("plan");
              }}
            />
            <ChoiceCard
              title="Join an Existing Organization"
              description="You have an Organization ID from your admin."
              onClick={() => {
                setFlow("join");
                setJoinStep("org-id");
              }}
            />
          </div>

          <p
            className="mt-6 text-center text-sm text-gray-500"
            style={{
              fontFamily: "var(--font-source-sans), system-ui, sans-serif",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#5CE1A5] transition-colors duration-200 hover:text-[#A0F1C8]"
            >
              Sign in
            </Link>
          </p>
        </div>
      );
    }

    // ── Create org flow ──
    if (flow === "create") {
      if (createStep === "plan") {
        return (
          <div className="w-full max-w-4xl">
            <BackButton onClick={handleBack} />
            <h2
              className="mb-2 text-center text-2xl font-bold text-foreground"
              style={{
                fontFamily: "var(--font-poppins), system-ui, sans-serif",
              }}
            >
              Choose Your Plan
            </h2>
            <p
              className="mb-8 text-center text-sm text-gray-500"
              style={{
                fontFamily: "var(--font-source-sans), system-ui, sans-serif",
              }}
            >
              You can always change your plan later.
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all duration-200 ${
                    selectedPlan === plan.id
                      ? "border-[#5CE1A5] shadow-md shadow-[#5CE1A5]/10"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#5CE1A5] px-3 py-0.5 text-xs font-semibold text-[#060C09]">
                      {plan.badge}
                    </span>
                  )}
                  <h3
                    className="text-lg font-bold text-foreground"
                    style={{
                      fontFamily: "var(--font-poppins), system-ui, sans-serif",
                    }}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className="mt-2 text-3xl font-bold text-foreground"
                    style={{
                      fontFamily: "var(--font-poppins), system-ui, sans-serif",
                    }}
                  >
                    ${plan.price}
                    <span className="text-sm font-normal text-gray-400">
                      /mo
                    </span>
                  </p>
                  <ul
                    className="mt-4 space-y-2 text-sm text-gray-600"
                    style={{
                      fontFamily:
                        "var(--font-source-sans), system-ui, sans-serif",
                    }}
                  >
                    <li>{plan.seats} team seats</li>
                    <li>{plan.members} members</li>
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <PrimaryButton onClick={() => setCreateStep("org-name")}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        );
      }

      if (createStep === "org-name") {
        return (
          <div className="w-full max-w-md">
            <BackButton onClick={handleBack} />
            <h2
              className="mb-2 text-center text-2xl font-bold text-foreground"
              style={{
                fontFamily: "var(--font-poppins), system-ui, sans-serif",
              }}
            >
              Name Your Organization
            </h2>
            <p
              className="mb-8 text-center text-sm text-gray-500"
              style={{
                fontFamily: "var(--font-source-sans), system-ui, sans-serif",
              }}
            >
              This is how your church or ministry will appear in Atlas.
            </p>

            <label
              className="flex flex-col gap-1.5"
              style={{
                fontFamily: "var(--font-source-sans), system-ui, sans-serif",
              }}
            >
              <span className="text-sm font-semibold text-foreground">
                Organization Name
              </span>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Grace Community Church"
                className="rounded-full border border-gray-300 px-4 py-3 text-foreground outline-none transition-shadow duration-200 focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5] focus:shadow-md focus:shadow-[#5CE1A5]/10"
              />
            </label>

            <div className="mt-8 flex justify-center">
              <PrimaryButton
                onClick={() => {
                  if (!organizationName.trim()) {
                    setError("Organization name is required.");
                    return;
                  }
                  setError(null);
                  setCreateStep("account");
                }}
              >
                Continue
              </PrimaryButton>
            </div>

            {error && <ErrorMessage message={error} />}
          </div>
        );
      }

      // createStep === "account"
      return (
        <div className="w-full max-w-md">
          <BackButton onClick={handleBack} />
          <h2
            className="mb-8 text-center text-2xl font-bold text-foreground"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Create Your Account
          </h2>
          <AccountFields
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            error={error}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </div>
      );
    }

    // ── Join org flow ──
    if (flow === "join") {
      if (joinStep === "org-id") {
        return (
          <div className="w-full max-w-md">
            <BackButton onClick={handleBack} />
            <h2
              className="mb-2 text-center text-2xl font-bold text-foreground"
              style={{
                fontFamily: "var(--font-poppins), system-ui, sans-serif",
              }}
            >
              Join an Organization
            </h2>
            <p
              className="mb-8 text-center text-sm text-gray-500"
              style={{
                fontFamily: "var(--font-source-sans), system-ui, sans-serif",
              }}
            >
              Enter the Organization ID shared by your admin.
            </p>

            <label
              className="flex flex-col gap-1.5"
              style={{
                fontFamily: "var(--font-source-sans), system-ui, sans-serif",
              }}
            >
              <span className="text-sm font-semibold text-foreground">
                Organization ID
              </span>
              <input
                type="text"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="e.g. org_abc123"
                className="rounded-full border border-gray-300 px-4 py-3 text-foreground outline-none transition-shadow duration-200 focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5] focus:shadow-md focus:shadow-[#5CE1A5]/10"
              />
            </label>

            <div className="mt-8 flex justify-center">
              <PrimaryButton
                onClick={() => {
                  if (!organizationId.trim()) {
                    setError("Organization ID is required.");
                    return;
                  }
                  setError(null);
                  setJoinStep("account");
                }}
              >
                Continue
              </PrimaryButton>
            </div>

            {error && <ErrorMessage message={error} />}
          </div>
        );
      }

      // joinStep === "account"
      return (
        <div className="w-full max-w-md">
          <BackButton onClick={handleBack} />
          <h2
            className="mb-8 text-center text-2xl font-bold text-foreground"
            style={{
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
            }}
          >
            Create Your Account
          </h2>
          <AccountFields
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            error={error}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </div>
      );
    }

    return null;
  }

  return <StepTransition stepKey={stepKey}>{renderStep()}</StepTransition>;
}

// ── Shared sub-components ──

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full max-w-xs rounded-full bg-[#5CE1A5] font-semibold text-[#060C09] transition-all duration-200 hover:bg-[#A0F1C8] hover:shadow-lg hover:shadow-[#5CE1A5]/20 active:scale-[0.97] disabled:opacity-50"
      style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
    >
      {children}
    </button>
  );
}

function ChoiceCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start rounded-2xl border-2 border-gray-200 p-6 text-left transition-all duration-200 hover:border-[#5CE1A5] hover:shadow-lg hover:shadow-[#5CE1A5]/10 active:scale-[0.98]"
    >
      <h3
        className="text-lg font-bold text-foreground"
        style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-sm text-gray-500"
        style={{
          fontFamily: "var(--font-source-sans), system-ui, sans-serif",
        }}
      >
        {description}
      </p>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-6 flex items-center gap-1 text-sm text-gray-500 transition-all duration-200 hover:text-foreground hover:-translate-x-0.5"
      style={{ fontFamily: "var(--font-source-sans), system-ui, sans-serif" }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M10 12L6 8L10 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back
    </button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-4 animate-fade-in rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
      {message}
    </div>
  );
}

function AccountFields({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  submitting,
  onSubmit,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const fontBody = {
    fontFamily: "var(--font-source-sans), system-ui, sans-serif",
  };
  const inputClasses =
    "rounded-full border border-gray-300 px-4 py-3 text-foreground outline-none transition-shadow duration-200 focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5] focus:shadow-md focus:shadow-[#5CE1A5]/10";

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorMessage message={error} />}

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
        <span className="text-sm font-semibold text-foreground">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          className={inputClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5" style={fontBody}>
        <span className="text-sm font-semibold text-foreground">
          Confirm Password
        </span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your password"
          className={inputClasses}
        />
      </label>

      <PrimaryButton onClick={onSubmit} disabled={submitting}>
        {submitting ? "Creating account..." : "Create Account"}
      </PrimaryButton>
    </div>
  );
}
