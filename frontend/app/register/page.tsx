import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account | Horse Transport System",
  description: "Create a Horse Transport System customer account.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      headingClassName="auth-title-register"
      description="Set up your Customer account to start managing horse transport requests."
      prompt="Already have an account?"
      linkLabel="Sign in"
      linkHref="/login"
    >
      <RegisterForm />
    </AuthShell>
  );
}
