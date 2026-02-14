export interface CurrentUserOutput {
  id: string;
  email: string;
  role: "admin" | "user";
  tier: "free" | "pro";
  isVerified: boolean;
  createdAt: string;
}
