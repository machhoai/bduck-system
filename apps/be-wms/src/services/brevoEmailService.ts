interface BrevoRecipient {
  email: string;
  name?: string;
}

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

interface BrevoApiResponse {
  message?: string;
  error?: string;
  messageId?: string;
  messageIds?: string[];
}

const BREVO_SMTP_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function toRecipients(emails: string[] | undefined): BrevoRecipient[] | undefined {
  if (!emails || emails.length === 0) return undefined;
  return emails.map((email) => ({ email }));
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Joy World Cityfuns WMS";

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

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: toRecipients(input.to),
    cc: toRecipients(input.cc),
    bcc: toRecipients(input.bcc),
    subject: input.subject,
    htmlContent: input.htmlContent,
    textContent: input.textContent,
  };

  const response = await fetch(BREVO_SMTP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xsib-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as BrevoApiResponse | null;

  if (!response.ok) {
    const message =
      body?.message ||
      body?.error ||
      `Brevo responded with status ${response.status}`;
    throw {
      statusCode: 502,
      messages: {
        vi: `Brevo gửi email thất bại: ${message}`,
        zh: `Brevo 邮件发送失败：${message}`,
      },
    };
  }

  return {
    messageId:
      typeof body?.messageId === "string"
        ? body.messageId
        : typeof body?.messageIds?.[0] === "string"
          ? body.messageIds[0]
          : null,
  };
}
