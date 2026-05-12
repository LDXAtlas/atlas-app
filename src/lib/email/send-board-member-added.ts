import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendBoardMemberAddedEmailParams {
  to: string;
  recipientName: string;
  inviterName: string;
  boardName: string;
  boardId: string;
  organizationName: string;
  role: string;
}

/**
 * Notifies an existing org member that they've been added to a project board.
 * Mirrors the visual template of sendInvitationEmail; the difference is that
 * this recipient already has an account, so the CTA opens the board directly
 * instead of an invitation acceptance page.
 */
export async function sendBoardMemberAddedEmail({
  to,
  recipientName,
  inviterName,
  boardName,
  boardId,
  organizationName,
  role,
}: SendBoardMemberAddedEmailParams) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://app.atlaschurchsolutions.com";
  const boardUrl = `${baseUrl}/workspace/projects/${boardId}`;

  console.log("[sendBoardMemberAddedEmail] Board URL:", boardUrl);

  const firstName = recipientName.split(" ")[0] || recipientName;

  const html = `
<!DOCTYPE html>
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
                Hi ${firstName}, you're on the board.
              </h2>
              <p style="margin: 0 0 24px; font-size: 15px; color: #6B7280; line-height: 1.6;">
                <strong style="color: #2D333A;">${inviterName}</strong> added you to
                <strong style="color: #2D333A;">${boardName}</strong> on
                ${organizationName} as ${role === "owner" || role === "editor" ? "an" : "a"} <strong style="color: #2D333A;">${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${boardUrl}" style="display: inline-block; background-color: #5CE1A5; color: #060C09; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 999px; letter-spacing: -0.2px;">
                      Open Board
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; color: #5CE1A5; word-break: break-all; line-height: 1.5;">
                ${boardUrl}
              </p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
              <p style="margin: 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                You're receiving this because you have an Atlas account at ${organizationName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: "Atlas Church Solutions <invites@atlaschurchsolutions.com>",
    to,
    subject: `${inviterName} added you to ${boardName}`,
    html,
  });

  if (error) {
    console.error("[sendBoardMemberAddedEmail] Failed:", error);
    throw new Error(`Failed to send board-member-added email: ${error.message}`);
  }
  return data;
}
