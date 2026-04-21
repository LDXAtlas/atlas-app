import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MemberDetail } from "./member-detail";
import type { Member } from "../types";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const slug = user.user_metadata?.organization_slug;
  if (!slug) notFound();

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!org?.id) notFound();

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("organization_id", org.id)
    .single();

  if (error || !member) notFound();

  return <MemberDetail member={member as Member} />;
}
