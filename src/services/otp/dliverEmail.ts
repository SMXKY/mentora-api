import { sendEmail } from "../../utils/sendEmail.util";
import { buildOtpEmailTemplate } from "../../utils/emailOTP.util";

export const deliverEmailOtp = async (
  email: string,
  code: string
): Promise<void> => {
  const html = buildOtpEmailTemplate(code);

  try {
    await sendEmail(
      email,
      "Your Mentora verification code",
      `Your Mentora verification code is ${code}. It expires in 10 minutes.`,
      html
    );
  } catch (err) {
    console.error(
      `[OTP Email] Delivery failed for ${email}:`,
      err instanceof Error ? err.message : err
    );
    throw err;
  }
};
