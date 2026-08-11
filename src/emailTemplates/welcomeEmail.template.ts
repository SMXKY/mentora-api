import { t } from "../shared/i18n/t";
import type { SupportedLanguage } from "../shared/i18n/init";
import { API_PUBLIC_URL } from "../utils/enviromentVariablesCheck.util";

export const buildAdminWelcomeEmailTemplate = (params: {
  firstName: string;
  email: string;
  password: string;
  roles: string[];
  lng: SupportedLanguage;
}): string => {
  const { lng } = params;
  const tt = (
    key: string,
    fallback: string,
    opts: Record<string, unknown> = {}
  ) => t(`email/welcome:${key}`, fallback, { lng: lng || "en", ...opts });

  return `
  <!DOCTYPE html>
  <html lang="${lng}">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${tt("subject", "Welcome to Mentora")}</title>
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
  
                  <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:#0d0f14;letter-spacing:-0.5px;line-height:1.2;">
                    Welcome, ${params.firstName}!
                  </p>
                  <p style="margin:0 0 36px;font-size:16px;color:#5f5e5a;line-height:1.7;">
                    Your Mentora admin account has been created. Below are your login credentials.
                    Please log in and <strong style="color:#c62828;">change your password immediately.</strong>
                  </p>
  
                  <!-- Credentials block -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                    <tr>
                      <td style="background-color:#eef1fc;border:1.5px solid #c5cffa;border-radius:12px;padding:28px;">
                        <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#5060b0;letter-spacing:2px;text-transform:uppercase;">Your credentials</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:7px 0;font-size:14px;color:#5f5e5a;width:80px;">Email</td>
                            <td style="padding:7px 0;font-size:14px;font-weight:600;color:#0039cb;">${
                              params.email
                            }</td>
                          </tr>
                          <tr>
                            <td style="padding:7px 0;font-size:14px;color:#5f5e5a;border-top:1px solid #d5dafc;">Password</td>
                            <td style="padding:7px 0;font-size:14px;font-weight:600;color:#1a1c1e;letter-spacing:1px;border-top:1px solid #d5dafc;font-family:'Courier New',monospace;">${
                              params.password
                            }</td>
                          </tr>
                          <tr>
                            <td style="padding:7px 0;font-size:14px;color:#5f5e5a;border-top:1px solid #d5dafc;">Roles</td>
                            <td style="padding:7px 0;font-size:14px;font-weight:600;color:#1a1c1e;border-top:1px solid #d5dafc;">${params.roles.join(
                              ", "
                            )}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
  
                  <!-- Warning -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                    <tr>
                      <td style="background-color:#fdecea;border:1.5px solid #f5c6c6;border-radius:12px;padding:16px 20px;">
                        <p style="margin:0;font-size:13px;color:#c62828;line-height:1.65;">
                          This password is temporary. For your security, please change it as soon as you log in. Do not share these credentials with anyone.
                        </p>
                      </td>
                    </tr>
                  </table>
  
                  <p style="margin:0;font-size:13px;color:#888780;line-height:1.65;padding-top:28px;border-top:1px solid #ebe9e3;">
                    If you did not expect this email, please contact your system administrator immediately.
                  </p>
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
};
