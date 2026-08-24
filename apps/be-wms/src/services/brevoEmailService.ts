import nodemailer from "nodemailer";

export interface BrevoEmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  contentDisposition?: "attachment" | "inline";
  cid?: string;
}

interface SendBrevoEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlContent: string;
  textContent: string;
  attachments?: BrevoEmailAttachment[];
  messageId?: string;
}

interface BrevoEmailResult {
  messageId: string | null;
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY; // This is used as the SMTP password
  const smtpLogin = process.env.BREVO_SMTP_LOGIN;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "J-PULSE";

  if (!apiKey || !smtpLogin || !senderEmail) {
    throw {
      statusCode: 500,
      messages: {
        vi: "Chưa cấu hình đầy đủ thông tin SMTP Brevo.",
        zh: "Brevo SMTP 配置不完整。",
      },
    };
  }

  return { apiKey, smtpLogin, senderEmail, senderName };
}

export async function sendBrevoEmail(
  input: SendBrevoEmailInput,
): Promise<BrevoEmailResult> {
  const { apiKey, smtpLogin, senderEmail, senderName } = getBrevoConfig();

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: smtpLogin,
      pass: apiKey,
    },
  });

  const signatureHtml = process.env.BREVO_EMAIL_SIGNATURE_HTML || "";
  const signatureText = process.env.BREVO_EMAIL_SIGNATURE_TEXT || "";

  const finalHtml = signatureHtml
    ? `${input.htmlContent}${signatureHtml}`
    : input.htmlContent;
  const finalText = signatureText
    ? `${input.textContent}${signatureText}`
    : input.textContent;

  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: input.to.join(", "),
      cc: input.cc ? input.cc.join(", ") : undefined,
      bcc: input.bcc ? input.bcc.join(", ") : undefined,
      subject: input.subject,
      text: finalText,
      html: finalHtml,
      attachments: input.attachments,
      messageId: input.messageId,
    });

    return { messageId: info.messageId };
  } catch (error: unknown) {
    console.error("Nodemailer SMTP Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw {
      statusCode: 502,
      messages: {
        vi: `Brevo SMTP gửi email thất bại: ${message}`,
        zh: `Brevo SMTP 邮件发送失败：${message}`,
      },
    };
  }
}
