/**
 * Port: Email sending service.
 *
 * Defines the contract that any email provider must implement.
 * The Application Layer depends on this interface, not on Brevo directly.
 * This enables testing with mock providers and swapping providers later.
 */
export interface IEmailProvider {
  /**
   * Send a verification email.
   *
   * @param to Recipient email address
   * @param token Raw verification token (NOT hashed — the URL needs the raw token)
   */
  sendVerificationEmail(to: string, token: string): Promise<void>;

  /**
   * Send an OTP email (admin only).
   *
   * @param to Admin email address
   * @param otp The 8-digit OTP code (plaintext)
   */
  sendOtpEmail(to: string, otp: string): Promise<void>;

  /**
   * Send a password reset email.
   *
   * @param to Recipient email address
   * @param token Raw password reset token
   */
  sendPasswordResetEmail(to: string, token: string): Promise<void>;

  /**
   * Forward a contact form submission to the admin.
   *
   * @param from Sender's email address
   * @param name Sender's name
   * @param subject Email subject
   * @param message Email body content
   */
  sendContactFormEmail(
    from: string,
    name: string,
    subject: string,
    message: string
  ): Promise<void>;
}
