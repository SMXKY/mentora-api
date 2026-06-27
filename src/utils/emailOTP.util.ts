export const buildOtpEmailTemplate = (code: string): string => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your Mentora verification code</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f7f8fc;
      font-family: 'Segoe UI', Arial, sans-serif;
    "
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background-color: #f7f8fc; padding: 40px 0"
    >
      <tr>
        <td align="center">
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="max-width: 520px"
          >
            <!-- Header -->
            <tr>
              <td
                align="center"
                style="
                  background-color: #0039cb;
                  border-radius: 12px 12px 0 0;
                  padding: 32px 40px;
                "
              >
                <span
                  style="
                    font-size: 26px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: -0.5px;
                  "
                  >MENTORA</span
                >
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td
                style="
                  background-color: #ffffff;
                  padding: 40px;
                  border-left: 1px solid #d3d1c7;
                  border-right: 1px solid #d3d1c7;
                "
              >
                <p
                  style="
                    margin: 0 0 8px;
                    font-size: 22px;
                    font-weight: 600;
                    color: #1a1c1e;
                  "
                >
                  Verify your account
                </p>
                <p
                  style="
                    margin: 0 0 32px;
                    font-size: 15px;
                    color: #5f5e5a;
                    line-height: 1.6;
                  "
                >
                  Use the code below to verify your identity. It expires in
                  <strong style="color: #1a1c1e">10 minutes</strong> and can
                  only be used once.
                </p>

                <!-- OTP Block -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td
                      align="center"
                      style="
                        background-color: #e6ecfd;
                        border-radius: 10px;
                        padding: 28px;
                      "
                    >
                      <span
                        style="
                          font-size: 38px;
                          font-weight: 700;
                          letter-spacing: 10px;
                          color: #0039cb;
                        "
                      >
                        ${code}
                      </span>
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin: 32px 0 0;
                    font-size: 13px;
                    color: #888780;
                    line-height: 1.6;
                  "
                >
                  If you did not request this code, you can safely ignore this
                  email. Someone may have entered your email address by mistake.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="
                  background-color: #f7f8fc;
                  border: 1px solid #d3d1c7;
                  border-top: none;
                  border-radius: 0 0 12px 12px;
                  padding: 24px 40px;
                  text-align: center;
                "
              >
                <p style="margin: 0; font-size: 12px; color: #888780">
                  &copy; ${new Date().getFullYear()} Mentora &mdash; All rights
                  reserved.
                </p>
                <p style="margin: 8px 0 0; font-size: 12px; color: #888780">
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
