import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email("Invalid email format").max(254).trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
  name: z.string().max(100).optional(),
});

export const SigninSchema = z.object({
  email: z.string().email("Invalid email format").max(254).trim().toLowerCase(),
  password: z.string().min(1, "Password is required").max(128),
  rememberMe: z.boolean().optional().default(false),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email("Invalid email format").max(254).trim().toLowerCase(),
  otp: z
    .string()
    .length(8, "OTP must be exactly 8 digits")
    .regex(/^\d{8}$/, "OTP must contain only digits"),
});

export const VerifyEmailSchema = z.object({
  token: z
    .string()
    .length(64, "Verification token must be 64 characters")
    .regex(/^[a-f0-9]{64}$/, "Invalid verification token format"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format").max(254).trim().toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token: z
    .string()
    .length(64, "Reset token must be 64 characters")
    .regex(/^[a-f0-9]{64}$/, "Invalid reset token format"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email("Invalid email format").max(254).trim().toLowerCase(),
});

export const ContactFormSchema = z.object({
  email: z.string().email("Invalid email format").max(254).trim(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters")
    .trim(),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must not exceed 200 characters")
    .trim(),
  message: z
    .string()
    .min(1, "Message is required")
    .max(5000, "Message must not exceed 5000 characters")
    .trim(),
});
