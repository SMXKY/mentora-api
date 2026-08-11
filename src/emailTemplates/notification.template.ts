import { API_PUBLIC_URL } from "../utils/enviromentVariablesCheck.util";

export function buildNotificationEmailTemplate(
  subject: string,
  body: string
): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f0f2f7;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f7;padding:48px 0;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  
              <!-- Header -->
              <tr>
                <td style="background-color:#0039cb;padding:32px 40px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:14px;">
                        <img src="${API_PUBLIC_URL}/assets/mentora-logo.svg" width="44" height="26" alt="Mentora" style="display:block;border:0;" />
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:3px;text-transform:uppercase;font-family:'Segoe UI',Arial,sans-serif;">Mentora</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
  
              <!-- Body -->
              <tr>
                <td style="background-color:#ffffff;padding:48px 48px 40px;border-left:1px solid #d3d1c7;border-right:1px solid #d3d1c7;">
                  <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:#0d0f14;letter-spacing:-0.5px;line-height:1.2;">${subject}</p>
                  <p style="margin:0;font-size:16px;color:#5f5e5a;line-height:1.7;">${body}</p>
                </td>
              </tr>
  
              <!-- Footer -->
              <tr>
                <td style="background-color:#f7f8fc;border:1px solid #d3d1c7;border-top:none;border-radius:0 0 16px 16px;padding:28px 48px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#888780;line-height:1.6;">
                    &copy; ${new Date().getFullYear()} Mentora. All rights reserved.
                  </p>
                  <p style="margin:6px 0 0;font-size:12px;color:#888780;">
                    This is an automated message. Please do not reply.
                  </p>
                </td>
              </tr>
  
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
    `;
}
