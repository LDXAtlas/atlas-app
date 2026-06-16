// Shared markup for the comment / mention email family. Keeps the four
// senders below to the bare minimum and guarantees the visual layout
// stays in lockstep with the existing invitation + board-member-added
// emails.
//
// The wrapping <table>s, gradient header, mint CTA pill, and footer
// disclosure all match send-invitation.ts / send-board-member-added.ts.

export interface ActivityEmailContent {
  /** First-name greeting target. e.g. "Lucas" */
  firstName: string;
  /** Big top-of-body heading. e.g. "Lucas Dial commented on your task" */
  heading: string;
  /** Italic body text under the heading. e.g.
   *  "<strong>Lucas</strong> commented on <strong>Sermon prep</strong>." */
  bodyHtml: string;
  /** Optional snippet of the comment body — rendered in a muted card
   *  beneath the body. Already HTML-escaped by the caller. */
  snippet?: string | null;
  /** Final URL the CTA button points at. */
  ctaUrl: string;
  /** CTA label. e.g. "View task" or "Open card". */
  ctaLabel: string;
  /** Footer line about why they're receiving this. */
  footerNote: string;
}

export function renderActivityEmailHtml(content: ActivityEmailContent): string {
  const snippetBlock = content.snippet
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
                <tr>
                  <td style="background-color: #F8FAFC; border-left: 3px solid #5CE1A5; padding: 14px 16px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #2D333A; line-height: 1.5; font-style: italic;">
                      ${content.snippet}
                    </p>
                  </td>
                </tr>
              </table>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5F7; font-family: 'Source Sans Pro', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F5F7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #5CE1A5, #3DB882); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
                Atlas
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">
                Church Solutions
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 8px; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 20px; font-weight: 600; color: #2D333A;">
                Hi ${escapeHtml(content.firstName)}.
              </h2>
              <p style="margin: 0 0 16px; font-size: 15px; color: #6B7280; line-height: 1.6;">
                ${content.bodyHtml}
              </p>
              ${snippetBlock}
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${content.ctaUrl}" style="display: inline-block; background-color: #5CE1A5; color: #060C09; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 999px; letter-spacing: -0.2px;">
                      ${escapeHtml(content.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; color: #5CE1A5; word-break: break-all; line-height: 1.5;">
                ${content.ctaUrl}
              </p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
              <p style="margin: 0 0 8px; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                ${escapeHtml(content.footerNote)}
              </p>
              <p style="margin: 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                Don't want these emails? Adjust your <a href="${baseUrl()}/settings/notifications" style="color: #5CE1A5; text-decoration: none;">notification preferences</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://app.atlaschurchsolutions.com"
  );
}

export function firstNameOf(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.split(/\s+/)[0] || "there";
}

/** Trims to roughly the requested length, escapes HTML, and adds an ellipsis when truncated. */
export function preparedSnippet(
  raw: string | null | undefined,
  maxChars = 160,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxChars) return escapeHtml(trimmed);
  return `${escapeHtml(trimmed.slice(0, maxChars))}…`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
