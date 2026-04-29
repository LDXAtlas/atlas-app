import { connection } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { JoinForm } from "./_components/join-form";
import { AlertCircle, Clock, XCircle, CheckCircle2 } from "lucide-react";

function ErrorState({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="size-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.08)" }}
        >
          <Icon className="size-7 text-red-400" />
        </div>
        <h1
          className="text-xl font-bold text-[#2D333A]"
          style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
        >
          {title}
        </h1>
        <p
          className="text-[15px] text-[#6B7280] max-w-sm"
          style={{
            fontFamily: "var(--font-source-sans), system-ui, sans-serif",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await connection();
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorState
        icon={AlertCircle}
        title="Invalid Link"
        message="This invitation link is missing a token. Please check the link from your email and try again."
      />
    );
  }

  // Look up the invitation
  const { data: invitation } = await supabaseAdmin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (!invitation) {
    return (
      <ErrorState
        icon={AlertCircle}
        title="Invitation Not Found"
        message="This invitation link is invalid. Please check the link from your email or ask your admin to send a new invitation."
      />
    );
  }

  if (invitation.status === "accepted") {
    return (
      <ErrorState
        icon={CheckCircle2}
        title="Already Accepted"
        message="This invitation has already been accepted. If this is your account, please sign in."
      />
    );
  }

  if (invitation.status === "revoked") {
    return (
      <ErrorState
        icon={XCircle}
        title="Invitation Revoked"
        message="This invitation has been revoked by an admin. Please contact your team admin for a new invitation."
      />
    );
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <ErrorState
        icon={Clock}
        title="Invitation Expired"
        message="This invitation has expired. Please ask your team admin to send a new invitation."
      />
    );
  }

  // Fetch organization name
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", invitation.organization_id)
    .single();

  return (
    <JoinForm
      token={token}
      email={invitation.email}
      role={invitation.role}
      organizationName={org?.name || "your organization"}
    />
  );
}
