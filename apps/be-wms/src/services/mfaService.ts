import { authenticator } from "otplib";
import qrcode from "qrcode";
import { getUserById, updateUserRecord } from "../repositories/userRepository.js";
import { sendBrevoEmail } from "./brevoEmailService.js";

// Generate OTP and QR Code for setup
export const generateMfaSetup = async (uid: string, email: string) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, "Joy World WMS", secret);
  const qrCodeUrl = await qrcode.toDataURL(otpauth);

  return { secret, qrCodeUrl };
};

// Verify the initial code to complete setup
export const verifyMfaSetup = async (uid: string, token: string, secret: string) => {
  const isValid = authenticator.verify({ token, secret });

  if (isValid) {
    await updateUserRecord(uid, {
      mfa_enabled: true,
      mfa_secret: secret,
    });
    return true;
  }
  return false;
};

// Send Email OTP
export const sendMfaEmailOtp = async (uid: string, email: string) => {
  // Generate a random 6-digit number
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

  await updateUserRecord(uid, {
    email_otp: otp,
    email_otp_expires_at: expiresAt,
  });

  // Send email using Brevo
  await sendBrevoEmail({
    to: [email],
    subject: "Mã Xác Thực (OTP) - Joy World WMS",
    htmlContent: `
      <h2>Mã xác thực của bạn là: <strong>${otp}</strong></h2>
      <p>Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ cho bất kỳ ai.</p>
    `,
    textContent: `Mã xác thực của bạn là: ${otp}. Mã này có hiệu lực trong vòng 5 phút.`,
  });

  return true;
};

// Verify either TOTP (Google Authenticator) or Email OTP
export const verifyMfa = async (uid: string, token: string) => {
  const user = await getUserById(uid);
  if (!user) throw new Error("User not found");

  // If user has GG Authenticator enabled, try to verify with TOTP
  if (user.mfa_enabled && user.mfa_secret) {
    const isTotpValid = authenticator.verify({ token, secret: user.mfa_secret });
    if (isTotpValid) return true;
  }

  // Also check Email OTP
  if (user.email_otp && user.email_otp_expires_at) {
    // Check expiration
    if (new Date() > new Date(user.email_otp_expires_at)) {
      // Expired
      return false;
    }
    
    if (user.email_otp === token) {
      // Clear OTP after successful use
      await updateUserRecord(uid, {
        email_otp: null,
        email_otp_expires_at: null,
      });
      return true;
    }
  }

  return false;
};
