export const BREVO_EMAIL_SIGNATURE_SLOT = "<!-- BREVO_EMAIL_SIGNATURE -->";

export const applyBrevoEmailSignature = (
  htmlContent: string,
  textContent: string,
  signatureHtml: string,
  signatureText: string,
) => ({
  htmlContent: htmlContent.includes(BREVO_EMAIL_SIGNATURE_SLOT)
    ? htmlContent.replace(BREVO_EMAIL_SIGNATURE_SLOT, signatureHtml)
    : `${htmlContent}${signatureHtml}`,
  textContent: `${textContent}${signatureText}`,
});
