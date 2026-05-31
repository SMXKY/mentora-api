import axios from "axios";
import * as nodemailer from "nodemailer";

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html: string
) => {
  console.log(
    `[Email] Using Brevo, API key exists: ${!!process.env.BREVO_API_KEY}`
  );
  if (process.env.NODE_ENV === "production") {
    try {
      const safeText =
        text && text.trim().length > 0
          ? text
          : "Please view this email in an HTML-compatible email client.";

      const response = await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: "MENTORA",
            email: "no-reply@tallamichael.online",
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: safeText,
        },
        {
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        `[Email] Sent successfully to ${to}. ID: ${response.data.messageId}`
      );
      return response.data;
    } catch (err: any) {
      console.error(
        "[Email] Brevo error:",
        err.response?.data || err.message || err
      );
      throw err;
    }
  } else {
    try {
      const transporter = nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
          user: process.env.MAILTRAP_USERNAME,
          pass: process.env.MAILTRAP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        },

        secure: false,
      });
      const safeText =
        text && text.trim().length > 0
          ? text
          : "Please view this email in an HTML-compatible email client.";

      const info = await transporter.sendMail({
        from: '"PLEINGAZ-INFOTECH" <no-reply@pleingaz.com>',
        to,
        subject,
        text: safeText,
        html,
      });

      console.log("Dev email sent: %s", info.messageId);
      return info;
    } catch (err) {
      console.error("Mailtrap error:", err);
      throw err;
    }
  }
};
