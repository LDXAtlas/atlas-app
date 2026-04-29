"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { can, getRoleFromProfile } from "@/lib/permissions";

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

    const role = getRoleFromProfile(inviterProfile);

    if (!can.inviteTeam(role)) {
      return { error: "You don't have permission to do this." };
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

    if (!inviterProfile) {
      return { error: "Could not find your profile." };
    }

    const role = getRoleFromProfile(inviterProfile);

    if (!can.inviteTeam(role)) {
      return { error: "You don't have permission to do this." };
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

    if (!inviterProfile) {
      return { error: "Could not find your profile." };
    }

    const role = getRoleFromProfile(inviterProfile);

    if (!can.inviteTeam(role)) {
      return { error: "You don't have permission to do this." };
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
    console.log("=== ACCEPT INVITATION START ===");
    console.log("Token:", token);

    // Step 1: Look up the invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    console.log("[Step 1] Invitation lookup:", invitation ? {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      organization_id: invitation.organization_id,
      expires_at: invitation.expires_at,
    } : `NOT FOUND (${invError?.message})`);

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

    if (new Date(invitation.expires_at) < new Date()) {
      return { error: "This invitation has expired. Please ask your admin to send a new one." };
    }

    const fullName = `${firstName} ${lastName}`;

    // Step 2: Fetch org details
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, slug")
      .eq("id", invitation.organization_id)
      .single();

    console.log("[Step 2] Organization:", org ? { name: org.name, slug: org.slug } : "NOT FOUND");

    // Step 3: Create the auth user
    // 'invited_to_org' in metadata tells the handle_new_user trigger to skip org creation
    console.log("[Step 3] Creating auth user for:", invitation.email);

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          organization_name: org?.name,
          organization_slug: org?.slug,
          invited_to_org: invitation.organization_id,
        },
      });

    if (createError) {
      console.error("[Step 3] FAILED — Create user error:", JSON.stringify({
        message: createError.message,
        status: createError.status,
        name: createError.name,
        code: (createError as unknown as { code?: string }).code,
      }));

      const msg = createError.message?.toLowerCase() || "";
      if (
        msg.includes("already been registered") ||
        msg.includes("already exists") ||
        msg.includes("user_already_exists") ||
        (createError as unknown as { code?: string }).code === "user_already_exists"
      ) {
        return {
          error: "An account with this email already exists. Sign in instead, then check your invitations.",
        };
      }

      if (msg.includes("password")) {
        return { error: `Password error: ${createError.message}` };
      }

      return { error: createError.message || "Failed to create your account." };
    }

    const userId = newUser.user.id;
    console.log("[Step 3] SUCCESS — User created with ID:", userId);

    // Step 4: Create profile linking the user to the existing organization
    // This is critical — the trigger skips this, so we must do it here
    const profileData = {
      id: userId,
      email: invitation.email,
      organization_id: invitation.organization_id,
      full_name: fullName,
      role: invitation.role,
    };
    console.log("[Step 4] Inserting profile:", JSON.stringify(profileData));

    const { data: profileResult, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      console.error("[Step 4] FAILED — Profile insert error:", JSON.stringify({
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      }));
      // Don't return error — the user was created, we should still mark invitation accepted
      // and let the user sign in (they can contact admin if profile is missing)
    } else {
      console.log("[Step 4] SUCCESS — Profile created:", profileResult?.id);
    }

    // Step 5: Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    console.log("[Step 5] Invitation marked accepted:", updateError ? `ERROR: ${updateError.message}` : "SUCCESS");

    // Step 6: Verify — read back the profile to confirm it exists
    const { data: verifyProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id, role, email")
      .eq("id", userId)
      .single();

    console.log("[Step 6] Verify profile exists:", verifyProfile ? JSON.stringify(verifyProfile) : "NOT FOUND — PROBLEM!");
    console.log("=== ACCEPT INVITATION COMPLETE ===");

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[acceptInvitation] Unexpected error:", err);
    return { error: `An unexpected error occurred: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Update Member Role ────────────────────────────────
export async function updateMemberRole(
  memberId: string,
  newRole: string,
): Promise<InvitationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!adminProfile) {
      return { error: "Could not find your profile." };
    }

    const role = getRoleFromProfile(adminProfile);

    if (!can.changeUserRole(role)) {
      return { error: "You don't have permission to do this." };
    }

    // Verify the target member belongs to the same organization
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", memberId)
      .single();

    if (!targetProfile || targetProfile.organization_id !== adminProfile.organization_id) {
      return { error: "Member not found in your organization." };
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", memberId);

    if (updateError) {
      console.error("[updateMemberRole] Update error:", updateError);
      return { error: "Failed to update role." };
    }

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[updateMemberRole] Unexpected error:", err);
    return { error: "An unexpected error occurred." };
  }
}

// ─── Remove Member ─────────────────────────────────────
export async function removeMember(
  memberId: string,
): Promise<InvitationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!adminProfile) {
      return { error: "Could not find your profile." };
    }

    const role = getRoleFromProfile(adminProfile);

    if (!can.removeTeamMember(role)) {
      return { error: "You don't have permission to do this." };
    }

    // Can't remove yourself
    if (memberId === user.id) {
      return { error: "You cannot remove yourself from the organization." };
    }

    // Verify the target member belongs to the same organization
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", memberId)
      .single();

    if (!targetProfile || targetProfile.organization_id !== adminProfile.organization_id) {
      return { error: "Member not found in your organization." };
    }

    // Remove the profile (disassociate from org)
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: null, role: "member" })
      .eq("id", memberId);

    if (updateError) {
      console.error("[removeMember] Update error:", updateError);
      return { error: "Failed to remove member." };
    }

    revalidatePath("/settings/organization");
    return { error: null, success: true };
  } catch (err) {
    console.error("[removeMember] Unexpected error:", err);
    return { error: "An unexpected error occurred." };
  }
}
