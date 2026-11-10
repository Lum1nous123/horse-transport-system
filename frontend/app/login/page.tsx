import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Horse Transport System",
  description: "Sign in to your Horse Transport System customer account.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue managing your horse transport requests."
      prompt="Don't have an account?"
      linkLabel="Create account"
      linkHref="/register"
    >
      <LoginForm />
    </AuthShell>
  );
}
