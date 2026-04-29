"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendInvitationEmail } from "@/lib/email/send-invitation";

export type InvitationActionState = {
  error: string | null;
  success?: boolean;
};

// ─── Invite Team Member ─────────────────────────────────
export async function inviteTeamMember(
  email: string,
  role: string,
): Promise<InvitationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to invite team members." };
    }

    // Fetch the inviter's profile to get org id and verify admin
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, full_name, role")
      .eq("id", user.id)
      .single();

    if (!inviterProfile || !inviterProfile.organization_id) {
      return { error: "Could not find your organization." };
    }

    if (inviterProfile.role !== "admin") {
      return { error: "Only admins can invite team members." };
    }

    const organizationId = inviterProfile.organization_id;

    // Check seat limit
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, seat_limit")
      .eq("id", organizationId)
      .single();

    if (!org) {
      return { error: "Organization not found." };
    }

    const { count: memberCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    const { count: pendingCount } = await supabaseAdmin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    const totalUsed = (memberCount ?? 0) + (pendingCount ?? 0);
    if (totalUsed >= (org.seat_limit ?? 5)) {
      return {
        error:
          "Your organization has reached its seat limit. Please upgrade your plan to invite more team members.",
      };
    }

    // Validate: can't invite self
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return { error: "You cannot invite yourself." };
    }

    // Check if already a member
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", organizationId);

    if (existingProfiles) {
      // Look up auth users by email to check membership
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingEmails = new Set(
        (existingProfiles || [])
          .map((p) => {
            const authUser = authUsers?.users?.find((u) => u.id === p.id);
            return authUser?.email?.toLowerCase();
          })
          .filter(Boolean),
      );

      if (existingEmails.has(email.toLowerCase())) {
        return { error: "This person is already a member of your organization." };
      }
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return { error: "An invitation has already been sent to this email." };
    }

    // Create the invitation
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const { error: insertError } = await supabaseAdmin
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase(),
        role,
        token,
        invited_by: user.id,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("[inviteTeamMember] Insert error:", insertError);
      return { error: "Failed to create invitation. Please try again." };
    }

    // Send the email
    try {
      await sendInvitationEmail({
        to: email.toLowerCase(),
        inviterName: inviterProfile.full_name || user.email || "A team member",
        organizationName: org.name || "your organization",
        token,
        role,
      });
    } catch (emailError) {
      console.error("[inviteTeamMember] Email error:", emailError);
      // Invitation was created but email failed — still return success with a note
      revalidatePath("/settings/organization");
      return {
        error: null,
        success: true,
      };
    }

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[inviteTeamMember] Unexpected error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

// ─── Revoke Invitation ──────────────────────────────────
export async function revokeInvitation(
  invitationId: string,
): Promise<InvitationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    // Verify the invitation belongs to the user's org
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!inviterProfile || inviterProfile.role !== "admin") {
      return { error: "Only admins can revoke invitations." };
    }

    const { data: invitation } = await supabaseAdmin
      .from("invitations")
      .select("organization_id, status")
      .eq("id", invitationId)
      .single();

    if (!invitation) {
      return { error: "Invitation not found." };
    }

    if (invitation.organization_id !== inviterProfile.organization_id) {
      return { error: "You can only revoke invitations for your organization." };
    }

    if (invitation.status !== "pending") {
      return { error: "This invitation is no longer pending." };
    }

    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId);

    if (updateError) {
      console.error("[revokeInvitation] Update error:", updateError);
      return { error: "Failed to revoke invitation." };
    }

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[revokeInvitation] Unexpected error:", err);
    return { error: "An unexpected error occurred." };
  }
}

// ─── Resend Invitation ──────────────────────────────────
export async function resendInvitation(
  invitationId: string,
): Promise<InvitationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, full_name, role")
      .eq("id", user.id)
      .single();

    if (!inviterProfile || inviterProfile.role !== "admin") {
      return { error: "Only admins can resend invitations." };
    }

    const { data: invitation } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (!invitation) {
      return { error: "Invitation not found." };
    }

    if (invitation.organization_id !== inviterProfile.organization_id) {
      return { error: "You can only resend invitations for your organization." };
    }

    if (invitation.status !== "pending") {
      return { error: "This invitation is no longer pending." };
    }

    // Fetch org name
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    // Update the expiry
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    await supabaseAdmin
      .from("invitations")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("id", invitationId);

    // Resend the email
    await sendInvitationEmail({
      to: invitation.email,
      inviterName: inviterProfile.full_name || user.email || "A team member",
      organizationName: org?.name || "your organization",
      token: invitation.token,
      role: invitation.role,
    });

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[resendInvitation] Unexpected error:", err);
    return { error: "An unexpected error occurred." };
  }
}

// ─── Accept Invitation ──────────────────────────────────
export async function acceptInvitation(
  token: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<InvitationActionState> {
  try {
    // Look up the invitation
    const { data: invitation } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (!invitation) {
      return { error: "Invalid invitation link." };
    }

    if (invitation.status !== "pending") {
      return {
        error:
          invitation.status === "accepted"
            ? "This invitation has already been accepted."
            : "This invitation has been revoked.",
      };
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return { error: "This invitation has expired. Please ask your admin to send a new one." };
    }

    const fullName = `${firstName} ${lastName}`;

    // Fetch the organization details for user metadata
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, slug")
      .eq("id", invitation.organization_id)
      .single();

    // Create the user via admin API (no email confirmation needed)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          organization_name: org?.name,
          organization_slug: org?.slug,
        },
      });

    if (createError) {
      console.error("[acceptInvitation] Create user error:", createError);
      if (createError.message?.includes("already been registered")) {
        return {
          error:
            "An account with this email already exists. Please log in instead.",
        };
      }
      return { error: "Failed to create your account. Please try again." };
    }

    // Create profile linked to the org
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        organization_id: invitation.organization_id,
        full_name: fullName,
        role: invitation.role,
      });

    if (profileError) {
      console.error("[acceptInvitation] Profile error:", profileError);
      // User was created but profile failed — try to continue
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[acceptInvitation] Unexpected error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
