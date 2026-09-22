import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeHuddleRecording } from "@/app/actions/huddles";

// Whisper on a 15-minute segment takes tens of seconds. A server action
// would inherit the calling page's timeout (Next docs, maxDuration →
// "Server Actions"), and that page is the huddles UI this work doesn't
// touch — so transcription runs here instead, with its own budget.
// Vercel Pro + Fluid Compute allows up to 300s.
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;

  // /api/* skips the proxy's auth redirect, so check the session here.
  // transcribeHuddleRecording re-checks org + organizer/admin access and
  // claims the segment atomically.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  const result = await transcribeHuddleRecording(recordingId);
  return NextResponse.json(result, { status: statusForResult(result) });
}

// The action answers with a code; turn it into the matching HTTP status so
// a direct POST reads correctly (an attendee poking this endpoint gets a
// plain 403, and an unknown/invisible recording a 404 that doesn't
// confirm the id exists).
function statusForResult(result: { success: boolean; code?: string }): number {
  if (result.success) return 200;
  if (result.code === "FORBIDDEN") return 403;
  if (result.code === "NOT_FOUND") return 404;
  return 400;
}
