import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleFromProfile } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import {
  getFolderTree,
  getLibraryTags,
} from "@/app/actions/attachments";
import { LibraryView } from "./_components/library-view";

export default async function LibraryPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        Sign in to use the Library.
      </div>
    );
  }

  const slug = user.user_metadata?.organization_slug;
  if (!slug) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        No organization context found.
      </div>
    );
  }

  // Resolve org context + viewer role.
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!org) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        Organization not found.
      </div>
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role: Role = getRoleFromProfile(profile);

  // Initial data — fetched server-side so the page renders without a
  // visible loading state for the chrome. Files load client-side.
  const [foldersRes, tagsRes, deptsRes, profilesRes] = await Promise.all([
    getFolderTree(),
    getLibraryTags(),
    supabaseAdmin
      .from("departments")
      .select("id, name, color")
      .eq("organization_id", org.id)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", org.id)
      .order("full_name", { ascending: true }),
  ]);

  const orgProfiles = (profilesRes.data ?? []).map(
    (p: { id: string; full_name: string | null; email: string | null }) => ({
      id: p.id,
      full_name: p.full_name || p.email?.split("@")[0] || "Unnamed",
    }),
  );

  return (
    <div className="h-[calc(100vh-128px)]">
      <LibraryView
        orgName={org.name}
        viewerRole={role}
        initialFolders={foldersRes.success && foldersRes.data ? foldersRes.data : []}
        initialTags={tagsRes.success && tagsRes.data ? tagsRes.data : []}
        departments={
          (deptsRes.data ?? []) as { id: string; name: string; color: string }[]
        }
        orgProfiles={orgProfiles}
      />
    </div>
  );
}
