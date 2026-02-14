import * as brevo from "@getbrevo/brevo";
import pRetry from "p-retry";
import type { IEmailProvider } from "@app/interfaces/email.provider";
import { env } from "@/env";

let emailAPIInstance: brevo.TransactionalEmailsApi | null = null;

function getApiInstance(): brevo.TransactionalEmailsApi {
  if (emailAPIInstance) {
    return emailAPIInstance;
  }

  const apiKeyFromEnv = env.BREVO_API_KEY;

  console.log("[Brevo] Initializing API with key:", {
    hasKey: !!apiKeyFromEnv,
    length: apiKeyFromEnv?.length ?? 0,
    prefix: apiKeyFromEnv?.substring(0, 20) ?? "MISSING",
  });

  const emailAPI = new brevo.TransactionalEmailsApi();

  try {
    emailAPI.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      apiKeyFromEnv
    );
    console.log("[Brevo] API key configured successfully using setApiKey()");
  } catch (err) {
    console.error(
      "[Brevo] setApiKey() failed, falling back to direct assignment:",
      err
    );
    try {
      const api: Record<
        string,
        Record<string, Record<string, unknown>>
      > = emailAPI as unknown as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      api.authentications!.apiKey!.apiKey = apiKeyFromEnv;
      console.log(
        "[Brevo] API key configured successfully via direct assignment"
      );
    } catch (fallbackErr) {
      console.error(
        "[Brevo] Failed to set API key via both methods:",
        fallbackErr
      );
    }
  }

  emailAPIInstance = emailAPI;
  return emailAPI;
}

const RETRY_OPTIONS: Parameters<typeof pRetry>[1] = {
  retries: 2,
  minTimeout: 1000,
  factor: 2,
  onFailedAttempt: (error) => {
    console.warn(
      `[Email] Attempt ${error.attemptNumber} failed. ` +
        `${error.retriesLeft} retries remaining. ` +
        `Error: ${error.message}`
    );
  },
  shouldRetry: (error) => {
    if (error instanceof Error && "statusCode" in error) {
      const status = (error as { statusCode: number }).statusCode;
      if (status >= 400 && status < 500) return false;
    }
    return true;
  },
};

interface BaseEmailParams {
  sender: { email: string; name: string };
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
}

function buildVerificationEmail(to: string, token: string): BaseEmailParams {
  const verifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/verify-email?token=${encodeURIComponent(token)}`;

  return {
    sender: { email: env.FROM_EMAIL, name: "ankurhalder.com" },
    to: [{ email: to }],
    subject: "Verify your email — ankurhalder.com",
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#7c3aed; padding:24px 32px;">
              <h1 style="color:#ffffff; margin:0; font-size:20px; font-weight:600;">ankurhalder.com</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#18181b; margin:0 0 16px 0; font-size:24px;">Verify your email address</h2>
              <p style="color:#3f3f46; line-height:1.6; margin:0 0 24px 0;">
                Thank you for signing up. Please click the button below to verify your email address and activate your account.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#7c3aed; border-radius:6px; padding:12px 24px;">
                    <a href="${verifyUrl}" style="color:#ffffff; text-decoration:none; font-weight:600; font-size:16px; display:inline-block;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#71717a; font-size:14px; line-height:1.6; margin:0 0 16px 0;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="color:#7c3aed; font-size:14px; word-break:break-all; margin:0 0 24px 0;">
                ${verifyUrl}
              </p>
              <p style="color:#a1a1aa; font-size:12px; margin:0;">
                This link expires in 1 hour. If you did not create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function buildOtpEmail(to: string, otp: string): BaseEmailParams {
  return {
    sender: { email: env.FROM_EMAIL, name: "ankurhalder.com" },
    to: [{ email: to }],
    subject: "Your admin verification code",
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin verification code</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#dc2626; padding:24px 32px;">
              <h1 style="color:#ffffff; margin:0; font-size:20px; font-weight:600;">Admin Verification</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px; text-align:center;">
              <h2 style="color:#18181b; margin:0 0 16px 0; font-size:24px;">Your verification code</h2>
              <p style="color:#3f3f46; line-height:1.6; margin:0 0 24px 0;">
                Use the following code to complete your admin sign-in:
              </p>
              <div style="background-color:#fef2f2; border:2px solid #fecaca; border-radius:8px; padding:20px; margin:0 0 24px 0;">
                <span style="font-size:36px; font-weight:700; letter-spacing:8px; color:#dc2626; font-family:monospace;">
                  ${otp}
                </span>
              </div>
              <p style="color:#71717a; font-size:14px; line-height:1.6; margin:0 0 8px 0;">
                This code expires in <strong>15 minutes</strong>.
              </p>
              <p style="color:#a1a1aa; font-size:12px; margin:0;">
                If you did not attempt to sign in, your account may be compromised. Please change your password immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function buildPasswordResetEmail(to: string, token: string): BaseEmailParams {
  const resetUrl = `${env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    sender: { email: env.FROM_EMAIL, name: "ankurhalder.com" },
    to: [{ email: to }],
    subject: "Reset your password — ankurhalder.com",
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#7c3aed; padding:24px 32px;">
              <h1 style="color:#ffffff; margin:0; font-size:20px; font-weight:600;">ankurhalder.com</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#18181b; margin:0 0 16px 0; font-size:24px;">Reset your password</h2>
              <p style="color:#3f3f46; line-height:1.6; margin:0 0 24px 0;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#7c3aed; border-radius:6px; padding:12px 24px;">
                    <a href="${resetUrl}" style="color:#ffffff; text-decoration:none; font-weight:600; font-size:16px; display:inline-block;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#71717a; font-size:14px; line-height:1.6; margin:0 0 16px 0;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="color:#7c3aed; font-size:14px; word-break:break-all; margin:0 0 24px 0;">
                ${resetUrl}
              </p>
              <p style="color:#a1a1aa; font-size:12px; margin:0;">
                This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function buildContactFormEmail(
  from: string,
  name: string,
  subject: string,
  message: string
): BaseEmailParams {
  return {
    sender: { email: env.FROM_EMAIL, name: "ankurhalder.com Contact Form" },
    to: [{ email: env.ADMIN_EMAIL }],
    subject: `Contact form: ${subject}`,
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact form submission</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb; padding:24px 32px;">
              <h1 style="color:#ffffff; margin:0; font-size:20px; font-weight:600;">New Contact Form Submission</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table width="100%" cellpadding="8" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="color:#71717a; font-weight:600; width:100px; vertical-align:top;">From:</td>
                  <td style="color:#18181b;">${escapeHtml(name)} &lt;${escapeHtml(from)}&gt;</td>
                </tr>
                <tr>
                  <td style="color:#71717a; font-weight:600; vertical-align:top;">Subject:</td>
                  <td style="color:#18181b;">${escapeHtml(subject)}</td>
                </tr>
              </table>
              <div style="background-color:#f4f4f5; border-radius:6px; padding:20px; margin:0;">
                <p style="color:#3f3f46; line-height:1.6; margin:0; white-space:pre-wrap;">${escapeHtml(message)}</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

// ── Brevo Provider Class ──

export class BrevoEmailProvider implements IEmailProvider {
  /**
   * Send email via Brevo with retry logic.
   *
   * Uses p-retry for resilience against transient failures.
   * All email sending is ultimately called fire-and-forget from use cases.
   */
  private async sendEmail(params: BaseEmailParams): Promise<void> {
    const api = getApiInstance();

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = params.sender;
    sendSmtpEmail.to = params.to;
    sendSmtpEmail.subject = params.subject;
    sendSmtpEmail.htmlContent = params.htmlContent;

    console.log("[Brevo] Sending email:", {
      from: params.sender.email,
      to: params.to.map((t) => t.email),
      subject: params.subject,
      apiKeySet: !!process.env.BREVO_API_KEY,
    });

    await pRetry(async () => {
      try {
        await api.sendTransacEmail(sendSmtpEmail);
        console.log("[Brevo] Email sent successfully");
      } catch (error) {
        const errorObj = error as Record<string, unknown>;
        console.error("[Brevo] sendTransacEmail failed:", {
          status: (errorObj?.response as Record<string, unknown>)?.status,
          statusCode: errorObj?.statusCode,
          message: (error as Error).message,
          responseData: (errorObj?.response as Record<string, unknown>)?.data,
        });
        throw error;
      }
    }, RETRY_OPTIONS);
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const params = buildVerificationEmail(to, token);
    await this.sendEmail(params);
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const params = buildOtpEmail(to, otp);
    await this.sendEmail(params);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const params = buildPasswordResetEmail(to, token);
    await this.sendEmail(params);
  }

  async sendContactFormEmail(
    from: string,
    name: string,
    subject: string,
    message: string
  ): Promise<void> {
    const params = buildContactFormEmail(from, name, subject, message);
    await this.sendEmail(params);
  }
}
