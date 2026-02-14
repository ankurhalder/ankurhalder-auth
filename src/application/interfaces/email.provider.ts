export interface IEmailProvider {
  sendVerificationEmail(to: string, token: string): Promise<void>;

  sendOtpEmail(to: string, otp: string): Promise<void>;

  sendPasswordResetEmail(to: string, token: string): Promise<void>;

  sendContactFormEmail(
    from: string,
    name: string,
    subject: string,
    message: string
  ): Promise<void>;
}
