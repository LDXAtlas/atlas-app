"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus,
  Mail,
  Shield,
  X,
  ChevronDown,
  RotateCcw,
  XCircle,
  Check,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  inviteTeamMember,
  revokeInvitation,
  resendInvitation,
} from "@/app/actions/invitations";

// ─── Types ───────────────────────────────────────────────
interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  inviter_name: string;
  created_at: string;
}

interface OrganizationPageClientProps {
  teamMembers: TeamMember[];
  pendingInvitations: PendingInvitation[];
  seatLimit: number;
  currentUserRole: string;
  currentUserEmail: string;
}

// ─── Role Badge ─────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{
        fontFamily: "var(--font-poppins)",
        color: isAdmin ? "#5CE1A5" : "#3B82F6",
        backgroundColor: isAdmin
          ? "rgba(92, 225, 165, 0.1)"
          : "rgba(59, 130, 246, 0.1)",
      }}
    >
      <Shield className="size-3" />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ─── Avatar ─────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="size-10 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "linear-gradient(135deg, #5CE1A5, #3DB882)",
      }}
    >
      <span
        className="text-white text-[13px] font-semibold"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        {initials}
      </span>
    </div>
  );
}

// ─── Invite Modal ───────────────────────────────────────
function InviteModal({
  isOpen,
  onClose,
  currentUserEmail,
  existingEmails,
  pendingEmails,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
  existingEmails: string[];
  pendingEmails: string[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [roleOpen, setRoleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function validateEmail(e: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!e.trim()) return "Please enter an email address.";
    if (!emailRegex.test(e)) return "Please enter a valid email address.";
    if (e.toLowerCase() === currentUserEmail.toLowerCase())
      return "You cannot invite yourself.";
    if (existingEmails.includes(e.toLowerCase()))
      return "This person is already a member of your organization.";
    if (pendingEmails.includes(e.toLowerCase()))
      return "An invitation has already been sent to this email.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await inviteTeamMember(email.trim(), role);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setEmail("");
          setRole("staff");
          onClose();
        }, 1500);
      }
    });
  }

  function handleClose() {
    setEmail("");
    setRole("staff");
    setError(null);
    setSuccess(false);
    setRoleOpen(false);
    onClose();
  }

  const roles = [
    {
      value: "admin",
      label: "Admin",
      description: "Full access to all settings and team management",
    },
    {
      value: "staff",
      label: "Staff",
      description: "Access to workspace tools and assigned modules",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <div
                  className="size-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(92, 225, 165, 0.1)" }}
                >
                  <UserPlus className="size-5 text-[#5CE1A5]" />
                </div>
                <h3
                  className="text-[16px] font-semibold text-[#2D333A]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Invite Team Member
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2D333A] hover:bg-[#F4F5F7] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3 py-6"
                >
                  <div
                    className="size-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(92, 225, 165, 0.1)" }}
                  >
                    <Check className="size-6 text-[#5CE1A5]" />
                  </div>
                  <p
                    className="text-[15px] font-semibold text-[#2D333A]"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    Invitation sent!
                  </p>
                  <p
                    className="text-[13px] text-[#6B7280] text-center"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    We sent an email to {email} with a link to join your team.
                  </p>
                </motion.div>
              ) : (
                <>
                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100">
                      <AlertCircle className="size-4 text-red-400 mt-0.5 shrink-0" />
                      <p
                        className="text-[13px] text-red-600"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Email input */}
                  <label className="flex flex-col gap-1.5">
                    <span
                      className="text-[13px] font-semibold text-[#2D333A]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      Email address
                    </span>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="colleague@church.org"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F4F5F7] text-[14px] text-[#2D333A] placeholder-[#9CA3AF] outline-none transition-all focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                        autoFocus
                      />
                    </div>
                  </label>

                  {/* Role selector */}
                  <label className="flex flex-col gap-1.5">
                    <span
                      className="text-[13px] font-semibold text-[#2D333A]"
                      style={{ fontFamily: "var(--font-source-sans)" }}
                    >
                      Role
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setRoleOpen(!roleOpen)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F4F5F7] text-[14px] text-[#2D333A] outline-none transition-all hover:border-[#E5E7EB] focus:border-[#5CE1A5] focus:ring-1 focus:ring-[#5CE1A5]"
                        style={{ fontFamily: "var(--font-source-sans)" }}
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="size-4 text-[#6B7280]" />
                          {roles.find((r) => r.value === role)?.label}
                        </span>
                        <ChevronDown
                          className={`size-4 text-[#9CA3AF] transition-transform ${
                            roleOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {roleOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-10 mt-1 w-full bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden"
                          >
                            {roles.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => {
                                  setRole(r.value);
                                  setRoleOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-[#F4F5F7] transition-colors ${
                                  role === r.value ? "bg-[#F4F5F7]" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[14px] font-medium text-[#2D333A]"
                                    style={{
                                      fontFamily: "var(--font-poppins)",
                                    }}
                                  >
                                    {r.label}
                                  </span>
                                  {role === r.value && (
                                    <Check className="size-3.5 text-[#5CE1A5]" />
                                  )}
                                </div>
                                <p
                                  className="text-[12px] text-[#6B7280] mt-0.5"
                                  style={{
                                    fontFamily: "var(--font-source-sans)",
                                  }}
                                >
                                  {r.description}
                                </p>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </label>

                  {/* Submit */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[14px] font-medium text-[#6B7280] hover:bg-[#F4F5F7] transition-colors"
                      style={{ fontFamily: "var(--font-poppins)" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-semibold text-[#060C09] transition-all hover:shadow-md disabled:opacity-50"
                      style={{
                        fontFamily: "var(--font-poppins)",
                        backgroundColor: "#5CE1A5",
                      }}
                    >
                      {isPending ? "Sending..." : "Send Invitation"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ─────────────────────────────────────
export function OrganizationPageClient({
  teamMembers,
  pendingInvitations,
  seatLimit,
  currentUserRole,
  currentUserEmail,
}: OrganizationPageClientProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionPending, startActionTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isAdmin = currentUserRole === "admin";
  const usedSeats = teamMembers.length + pendingInvitations.length;
  const seatPercentage = Math.min((usedSeats / seatLimit) * 100, 100);

  function handleRevoke(invitationId: string) {
    startActionTransition(async () => {
      const result = await revokeInvitation(invitationId);
      if (result.error) {
        setActionMessage({ type: "error", text: result.error });
      } else {
        setActionMessage({ type: "success", text: "Invitation revoked." });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  }

  function handleResend(invitationId: string) {
    startActionTransition(async () => {
      const result = await resendInvitation(invitationId);
      if (result.error) {
        setActionMessage({ type: "error", text: result.error });
      } else {
        setActionMessage({ type: "success", text: "Invitation resent." });
      }
      setTimeout(() => setActionMessage(null), 3000);
    });
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(92, 225, 165, 0.08)" }}
          >
            <Users className="size-5 text-[#5CE1A5]" />
          </div>
          <h2
            className="text-2xl font-semibold text-[#2D333A]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Organization
          </h2>
        </div>
        <p
          className="text-[#6B7280] text-[15px] mt-2 ml-[52px]"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Manage your team members, invitations, and organization settings.
        </p>
      </div>

      {/* Action feedback toast */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mb-4 px-4 py-3 rounded-xl border text-[13px] flex items-center gap-2 ${
              actionMessage.type === "success"
                ? "bg-green-50 border-green-100 text-green-700"
                : "bg-red-50 border-red-100 text-red-600"
            }`}
            style={{ fontFamily: "var(--font-source-sans)" }}
          >
            {actionMessage.type === "success" ? (
              <Check className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            {actionMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Seat Usage card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[15px] font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Seat Usage
            </h3>
            <span
              className="text-[13px] text-[#6B7280]"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {usedSeats} of {seatLimit} seats used
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#F4F5F7] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${seatPercentage}%` }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              style={{
                backgroundColor:
                  seatPercentage >= 90
                    ? "#EF4444"
                    : seatPercentage >= 70
                      ? "#F59E0B"
                      : "#5CE1A5",
              }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-[#5CE1A5]" />
              <span
                className="text-[12px] text-[#6B7280]"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {teamMembers.length} active {teamMembers.length === 1 ? "member" : "members"}
              </span>
            </div>
            {pendingInvitations.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-[#F59E0B]" />
                <span
                  className="text-[12px] text-[#6B7280]"
                  style={{ fontFamily: "var(--font-source-sans)" }}
                >
                  {pendingInvitations.length} pending {pendingInvitations.length === 1 ? "invitation" : "invitations"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Team Members card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-5">
            <h3
              className="text-[15px] font-semibold text-[#2D333A]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Team Members
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-[#060C09] transition-all hover:shadow-md active:scale-[0.97]"
                style={{
                  fontFamily: "var(--font-poppins)",
                  backgroundColor: "#5CE1A5",
                }}
              >
                <UserPlus className="size-4" />
                Invite Team Member
              </button>
            )}
          </div>

          <div className="space-y-1">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-[#F4F5F7] transition-colors"
              >
                <Avatar name={member.full_name} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] font-medium text-[#2D333A] truncate"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {member.full_name}
                  </p>
                  <p
                    className="text-[13px] text-[#6B7280] truncate"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    {member.email}
                  </p>
                </div>
                <RoleBadge role={member.role} />
              </div>
            ))}
            {teamMembers.length === 0 && (
              <p
                className="text-center text-[14px] text-[#9CA3AF] py-8"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                No team members yet.
              </p>
            )}
          </div>
        </div>

        {/* Pending Invitations card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <h3
            className="text-[15px] font-semibold text-[#2D333A] mb-5"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            Pending Invitations
          </h3>

          <div className="space-y-1">
            {pendingInvitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-[#F4F5F7] transition-colors"
              >
                <div
                  className="size-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#F4F5F7" }}
                >
                  <Mail className="size-4 text-[#9CA3AF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] font-medium text-[#2D333A] truncate"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {invite.email}
                  </p>
                  <p
                    className="text-[12px] text-[#9CA3AF]"
                    style={{ fontFamily: "var(--font-source-sans)" }}
                  >
                    Invited by {invite.inviter_name} &middot;{" "}
                    {new Date(invite.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <RoleBadge role={invite.role} />
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleResend(invite.id)}
                      disabled={actionPending}
                      className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#5CE1A5] hover:bg-[#5CE1A5]/8 transition-colors disabled:opacity-50"
                      title="Resend invitation"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      disabled={actionPending}
                      className="size-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Revoke invitation"
                    >
                      <XCircle className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pendingInvitations.length === 0 && (
              <p
                className="text-center text-[14px] text-[#9CA3AF] py-8"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                No pending invitations.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        currentUserEmail={currentUserEmail}
        existingEmails={teamMembers.map((m) => m.email.toLowerCase())}
        pendingEmails={pendingInvitations.map((i) => i.email.toLowerCase())}
      />
    </div>
  );
}
