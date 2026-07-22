import nodemailer from "nodemailer";

interface SendBrevoEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlContent: string;
  textContent: string;
}

interface BrevoEmailResult {
  messageId: string | null;
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY; // This is used as the SMTP password
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "J-PULSE";

  if (!apiKey || !senderEmail) {
    throw {
      statusCode: 500,
      messages: {
        vi: "Chưa cấu hình BREVO_API_KEY hoặc BREVO_SENDER_EMAIL.",
        zh: "尚未配置 BREVO_API_KEY 或 BREVO_SENDER_EMAIL。",
      },
    };
  }

  return { apiKey, senderEmail, senderName };
}

export async function sendBrevoEmail(
  input: SendBrevoEmailInput,
): Promise<BrevoEmailResult> {
  const { apiKey, senderEmail, senderName } = getBrevoConfig();

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: "a82c67001@smtp-brevo.com",
      pass: apiKey,
    },
  });

  const signatureHtml = process.env.BREVO_EMAIL_SIGNATURE_HTML || "";
  const signatureText = process.env.BREVO_EMAIL_SIGNATURE_TEXT || "";

  const finalHtml = signatureHtml ? `${input.htmlContent}${signatureHtml}` : input.htmlContent;
  const finalText = signatureText ? `${input.textContent}${signatureText}` : input.textContent;

  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: input.to.join(", "),
      cc: input.cc ? input.cc.join(", ") : undefined,
      bcc: input.bcc ? input.bcc.join(", ") : undefined,
      subject: input.subject,
      text: finalText,
      html: finalHtml,
    });

    return { messageId: info.messageId };
  } catch (error: any) {
    console.error("Nodemailer SMTP Error:", error);
    throw {
      statusCode: 502,
      messages: {
        vi: `Brevo SMTP gửi email thất bại: ${error.message || "Unknown error"}`,
        zh: `Brevo SMTP 邮件发送失败：${error.message || "Unknown error"}`,
      },
    };
  }
}
