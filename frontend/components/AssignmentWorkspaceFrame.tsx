"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";
import BrandMark from "@/components/BrandMark";
import { LogisticsNavigation } from "@/components/LogisticsWorkspaceUI";

type AssignmentWorkspaceFrameProps = {
  children: ReactNode;
  preview: boolean;
  activeSection?: "dashboard" | "orders" | "assignments" | "reviews" | "tracking";
  pageClassName?: string;
};

export default function AssignmentWorkspaceFrame({ children, preview, activeSection = "assignments", pageClassName = "" }: AssignmentWorkspaceFrameProps) {
  const router = useRouter();

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className={`customer-page logistics-page logistics-manager-page assignment-page ${pageClassName}`.trim()}>
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <BrandMark />
          <span>Horse Transport System</span>
        </Link>
        <LogisticsNavigation section={activeSection} preview={preview} />
        <div className="customer-topbar-actions">
          <span>Logistics Manager</span>
          <button type="button" className="customer-link-button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="customer-content assignment-content">
        {preview && (
          <div className="customer-preview-banner" role="status">
            <strong>Preview mode</strong>
            <span>Workspace data is mocked for interface review and is not connected to Backend.</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
