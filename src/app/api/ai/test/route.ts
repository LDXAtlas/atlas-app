// Phase 0 verification endpoint.
//
// IMPORTANT: This route exists for testing the AI infrastructure end to
// end (auth -> selectModel -> provider call -> credit deduction ->
// ai_usage_log write). It is admin-gated and rate-limit-free.
//
// Before public production launch, remove this route or move it behind
// a stricter feature flag. It returns enough metadata that leaving it
// callable in production would let an admin trivially burn credits.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { callAI, type ModelComplexity } from "@/lib/ai";

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 },
    );
  }

  // 2. Resolve profile + org + admin gate.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Admins only." },
      { status: 403 },
    );
  }
  if (!profile.organization_id) {
    return NextResponse.json(
      { error: "No organization found on profile." },
      { status: 400 },
    );
  }

  // 3. Parse request.
  let body: { message?: string; complexity?: ModelComplexity };
  try {
    body = (await request.json()) as {
      message?: string;
      complexity?: ModelComplexity;
    };
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { error: "`message` is required." },
      { status: 400 },
    );
  }
  const complexity: ModelComplexity =
    body.complexity === "simple" ||
    body.complexity === "complex" ||
    body.complexity === "standard"
      ? body.complexity
      : "standard";

  // 4. Call the unified entry point.
  const result = await callAI({
    organizationId: profile.organization_id,
    userId: user.id,
    feature: "other",
    complexity,
    // Representative framing so org guidelines (terminology, voice,
    // etc.) actually fire the way they would in a real feature call.
    // The previous "you are being tested" prompt was so generic it
    // suppressed the kind of substantive output we needed to verify
    // the AI Control Center against.
    system:
      "You are Atlas AI, the assistant inside the Atlas Church Solutions ministry-operations platform. Answer the user's request directly and concisely, using the organization's voice and terminology.",
    messages: [{ role: "user", content: message }],
    maxTokens: 256,
    metadata: { source: "api/ai/test", test_invocation: true },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    content: result.content,
    model: result.model,
    provider: result.provider,
    wasFallback: result.wasFallback,
    creditsRemaining: result.creditsRemaining,
    usage: result.usage,
  });
}
