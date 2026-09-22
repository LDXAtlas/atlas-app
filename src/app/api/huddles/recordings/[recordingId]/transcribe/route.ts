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
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
