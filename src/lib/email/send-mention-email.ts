import { Resend } from "resend";
import {
  baseUrl,
  escapeHtml,
  firstNameOf,
  preparedSnippet,
  renderActivityEmailHtml,
} from "./_template";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendMentionEmailParams {
  to: string;
  recipientName: string | null;
  actorName: string;
  /** Short human label for the entity ("Huddle: Staff sync", "Task: Sermon prep", etc.) */
  contextLabel: string;
  /** Path inside Atlas — used to build the CTA link. */
  href: string;
  bodySnippet: string | null;
}

// Generic catch-all mention email — used for the 'mention' notification
// type, which currently covers huddle invites and ad-hoc @mentions
// outside the project-board surface area.
export async function sendMentionEmail({
  to,
  recipientName,
  actorName,
  contextLabel,
  href,
  bodySnippet,
}: SendMentionEmailParams) {
  const url = `${baseUrl()}${href}`;
  const safeActor = escapeHtml(actorName);
  const safeContext = escapeHtml(contextLabel);

  const html = renderActivityEmailHtml({
    firstName: firstNameOf(recipientName),
    heading: `${actorName} mentioned you`,
    bodyHtml: `<strong style="color: #2D333A;">${safeActor}</strong> mentioned you in <strong style="color: #2D333A;">${safeContext}</strong>.`,
    snippet: preparedSnippet(bodySnippet),
    ctaUrl: url,
    ctaLabel: "Open in Atlas",
    footerNote: "You're getting this because you were @-mentioned in Atlas.",
  });

  const { data, error } = await resend.emails.send({
    from: "Atlas Church Solutions <notifications@atlaschurchsolutions.com>",
    to,
    subject: `${actorName} mentioned you — ${contextLabel}`,
    html,
  });

  if (error) {
    console.error("[sendMentionEmail] Failed:", error);
    throw new Error(`Failed to send mention email: ${error.message}`);
  }
  return data;
}
