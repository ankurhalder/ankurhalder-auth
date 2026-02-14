"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface VerificationState {
  status: "loading" | "success" | "error";
  message: string;
}

export default function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>({
    status: "loading",
    message: "Verifying your email...",
  });

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setState({
          status: "error",
          message: "No verification token provided.",
        });
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasWindow = typeof (globalThis as any).window !== "undefined";
        const originUrl = hasWindow
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).window.location.origin
          : "";

        const response = await fetch(`${originUrl}/api/auth/verify-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData: Record<string, unknown> =
            (await response.json()) as Record<string, unknown>;
          setState({
            status: "error",
            message:
              (errorData.message as string) ||
              "Failed to verify email. Please try again.",
          });
          return;
        }

        setState({
          status: "success",
          message: "Email verified successfully! Redirecting...",
        });

        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (globalThis as any).window !== "undefined") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).window.location.href =
              "https://www.ankurhalder.com/user";
          }
        }, 2000);
      } catch (error: unknown) {
        console.error("Email verification error:", error);
        setState({
          status: "error",
          message: "An error occurred while verifying your email.",
        });
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {state.status === "loading" && (
          <>
            <div style={styles.spinner}></div>
            <h1 style={styles.heading}>{state.message}</h1>
            <p style={styles.text}>Please wait while we verify your email...</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <div style={styles.successIcon}>✓</div>
            <h1 style={styles.heading}>{state.message}</h1>
            <p style={styles.text}>
              You will be redirected to your dashboard shortly.
            </p>
          </>
        )}

        {state.status === "error" && (
          <>
            <div style={styles.errorIcon}>✕</div>
            <h1 style={styles.heading}>Verification Failed</h1>
            <p style={styles.text}>{state.message}</p>
            <div style={styles.actions}>
              <a href="https://www.ankurhalder.com" style={styles.button}>
                Back to Home
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f4f4f5",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    padding: "40px",
    textAlign: "center" as const,
    maxWidth: "400px",
    width: "90%",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f4f4f5",
    borderTop: "4px solid #7c3aed",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 20px",
  },
  heading: {
    color: "#18181b",
    fontSize: "24px",
    fontWeight: "600",
    margin: "0 0 16px 0",
  },
  text: {
    color: "#71717a",
    fontSize: "16px",
    lineHeight: "1.6",
    margin: "0 0 24px 0",
  },
  successIcon: {
    width: "60px",
    height: "60px",
    backgroundColor: "#dcfce7",
    color: "#22c55e",
    fontSize: "32px",
    borderRadius: "50%",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    margin: "0 auto 20px",
    fontWeight: "bold",
  },
  errorIcon: {
    width: "60px",
    height: "60px",
    backgroundColor: "#fee2e2",
    color: "#ef4444",
    fontSize: "32px",
    borderRadius: "50%",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    margin: "0 auto 20px",
    fontWeight: "bold",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "center" as const,
  },
  button: {
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: "6px",
    textDecoration: "none",
    fontSize: "16px",
    fontWeight: "600",
    transition: "background-color 0.3s",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).document !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleSheet = (globalThis as any).document.createElement("style");
  styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).document.head.appendChild(styleSheet);
}
