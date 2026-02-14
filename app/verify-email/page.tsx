import { Suspense } from "react";
import VerifyEmailContent from "./content";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div style={containerStyles}>
      <div style={cardStyles}>
        <div style={spinnerStyles}></div>
        <h1 style={headingStyles}>Verifying your email...</h1>
        <p style={textStyles}>Please wait while we verify your email...</p>
      </div>
    </div>
  );
}

const containerStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const cardStyles = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  padding: "40px",
  textAlign: "center" as const,
  maxWidth: "400px",
  width: "90%",
};

const spinnerStyles = {
  width: "40px",
  height: "40px",
  border: "4px solid #f4f4f5",
  borderTop: "4px solid #7c3aed",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  margin: "0 auto 20px",
};

const headingStyles = {
  color: "#18181b",
  fontSize: "24px",
  fontWeight: "600",
  margin: "0 0 16px 0",
};

const textStyles = {
  color: "#71717a",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 24px 0",
};
