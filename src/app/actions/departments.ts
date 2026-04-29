"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, getRoleFromProfile } from "@/lib/permissions";

export interface DepartmentInput {
  name: string;
  color?: string;
  description?: string;
  icon?: string;
  leader_id?: string | null;
  hub_enabled?: boolean;
}

export async function addDepartment(data: DepartmentInput) {
  console.log("[addDepartment] Starting with data:", JSON.stringify(data));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.log("[addDepartment] No user"); return { error: "Not authenticated" }; }

  const slug = user.user_metadata?.organization_slug;
  console.log("[addDepartment] Org slug:", slug);
  if (!slug) return { error: "No organization found" };

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  console.log("[addDepartment] Org lookup:", org ? `found id=${org.id}` : `error=${orgError?.message}`);
  if (!org) return { error: `Organization not found: ${orgError?.message}` };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.createDepartment(role)) {
    return { error: "You don't have permission to do this." };
  }

  const insertData = {
    organization_id: org.id,
    name: data.name,
    color: data.color || "#5CE1A5",
    description: data.description || null,
    icon: data.icon || "building",
    leader_id: data.leader_id || null,
    hub_enabled: data.hub_enabled || false,
  };
  console.log("[addDepartment] Inserting:", JSON.stringify(insertData));

  const { data: inserted, error } = await supabaseAdmin
    .from("departments")
    .insert(insertData)
    .select();

  console.log("[addDepartment] Result:", error ? `ERROR: ${error.message} (${error.code})` : `SUCCESS: ${JSON.stringify(inserted)}`);

  if (error) return { error: error.message };

  revalidatePath("/directory/staff-management");
  return { success: true };
}

export async function updateDepartment(id: string, data: DepartmentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.editDepartment(role)) {
    return { error: "You don't have permission to do this." };
  }

  const { error } = await supabaseAdmin
    .from("departments")
    .update({
      name: data.name,
      color: data.color,
      description: data.description,
      icon: data.icon,
      leader_id: data.leader_id,
      hub_enabled: data.hub_enabled,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/directory/staff-management");
  return { success: true };
}

export async function deleteDepartment(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = getRoleFromProfile(profile);

  if (!can.deleteDepartment(role)) {
    return { error: "You don't have permission to do this." };
  }

  const { error } = await supabaseAdmin
    .from("departments")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/directory/staff-management");
  return { success: true };
}
