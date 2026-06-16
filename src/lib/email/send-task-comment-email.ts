import { Resend } from "resend";
import {
  baseUrl,
  escapeHtml,
  firstNameOf,
  preparedSnippet,
  renderActivityEmailHtml,
} from "./_template";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendTaskCommentEmailParams {
  to: string;
  recipientName: string | null;
  actorName: string;
  taskTitle: string;
  /** Path inside Atlas — used to build the CTA link. */
  taskHref: string;
  commentSnippet: string | null;
}

export async function sendTaskCommentEmail({
  to,
  recipientName,
  actorName,
  taskTitle,
  taskHref,
  commentSnippet,
}: SendTaskCommentEmailParams) {
  const url = `${baseUrl()}${taskHref}`;
  const safeActor = escapeHtml(actorName);
  const safeTask = escapeHtml(taskTitle);

  const html = renderActivityEmailHtml({
    firstName: firstNameOf(recipientName),
    heading: `${actorName} commented on a task`,
    bodyHtml: `<strong style="color: #2D333A;">${safeActor}</strong> commented on the task <strong style="color: #2D333A;">${safeTask}</strong>.`,
    snippet: preparedSnippet(commentSnippet),
    ctaUrl: url,
    ctaLabel: "Open task",
    footerNote:
      "You're getting this because you own or are assigned to this task.",
  });

  const { data, error } = await resend.emails.send({
    from: "Atlas Church Solutions <notifications@atlaschurchsolutions.com>",
    to,
    subject: `${actorName} commented on "${taskTitle}"`,
    html,
  });

  if (error) {
    console.error("[sendTaskCommentEmail] Failed:", error);
    throw new Error(`Failed to send task-comment email: ${error.message}`);
  }
  return data;
}
