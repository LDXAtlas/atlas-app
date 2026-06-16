import { Resend } from "resend";
import {
  baseUrl,
  escapeHtml,
  firstNameOf,
  preparedSnippet,
  renderActivityEmailHtml,
} from "./_template";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendBoardCardCommentEmailParams {
  to: string;
  recipientName: string | null;
  actorName: string;
  cardTitle: string;
  boardName: string;
  /** Path inside Atlas — used to build the CTA link. */
  cardHref: string;
  commentSnippet: string | null;
}

export async function sendBoardCardCommentEmail({
  to,
  recipientName,
  actorName,
  cardTitle,
  boardName,
  cardHref,
  commentSnippet,
}: SendBoardCardCommentEmailParams) {
  const url = `${baseUrl()}${cardHref}`;
  const safeActor = escapeHtml(actorName);
  const safeCard = escapeHtml(cardTitle);
  const safeBoard = escapeHtml(boardName);

  const html = renderActivityEmailHtml({
    firstName: firstNameOf(recipientName),
    heading: `${actorName} commented on your card`,
    bodyHtml: `<strong style="color: #2D333A;">${safeActor}</strong> commented on <strong style="color: #2D333A;">${safeCard}</strong> in <strong style="color: #2D333A;">${safeBoard}</strong>.`,
    snippet: preparedSnippet(commentSnippet),
    ctaUrl: url,
    ctaLabel: "Open card",
    footerNote:
      "You're getting this because you're on the card as assignee or creator.",
  });

  const { data, error } = await resend.emails.send({
    from: "Atlas Church Solutions <notifications@atlaschurchsolutions.com>",
    to,
    subject: `${actorName} commented on "${cardTitle}"`,
    html,
  });

  if (error) {
    console.error("[sendBoardCardCommentEmail] Failed:", error);
    throw new Error(`Failed to send board-card-comment email: ${error.message}`);
  }
  return data;
}
