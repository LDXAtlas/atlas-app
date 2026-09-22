// Types for the huddles rail hooks. Lives outside src/app/actions/huddles.ts
// because that is a "use server" file, which may only export async
// functions (see src/lib/ai/ai-settings-constants.ts for the same split).
// The pre-existing huddle types still live in huddles.ts.

// A pending action item suggested to the current user (not yet promoted
// to a task or dismissed), for the "my action items" rail.
export type MyHuddleActionItem = {
  id: string;
  huddle_id: string;
  /** null when the caller can't see the parent huddle — the item is
   *  suggested to them, but the huddle's visibility doesn't include them. */
  huddle_title: string | null;
  /** Whether the caller may open the parent huddle. Don't link when false. */
  can_view_huddle: boolean;
  description: string;
  suggested_due_date: string | null;
  source: "manual" | "ai_extracted";
  created_at: string;
};
