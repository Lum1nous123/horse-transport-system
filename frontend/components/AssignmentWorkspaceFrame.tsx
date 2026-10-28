"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";

type AssignmentWorkspaceFrameProps = {
  children: ReactNode;
  preview: boolean;
  activeSection?: "orders" | "assignments" | "reviews" | "tracking";
};

export default function AssignmentWorkspaceFrame({ children, preview, activeSection = "assignments" }: AssignmentWorkspaceFrameProps) {
  const router = useRouter();
  const previewSuffix = preview ? "?preview=1" : "";

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className="customer-page logistics-page assignment-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span>
          <span>Horse Transport System</span>
        </Link>
        <nav className="assignment-topbar-nav" aria-label="Logistics workspace">
          <Link className={activeSection === "orders" ? "is-current" : undefined} href={`/logistics${previewSuffix}`} aria-current={activeSection === "orders" ? "page" : undefined}>Submitted orders</Link>
          <Link className={activeSection === "assignments" ? "is-current" : undefined} href={`/logistics/assignments${previewSuffix}`} aria-current={activeSection === "assignments" ? "page" : undefined}>
            Staff Assignment
          </Link>
          <Link className={activeSection === "reviews" ? "is-current" : undefined} href={`/logistics/route-reviews${previewSuffix}`} aria-current={activeSection === "reviews" ? "page" : undefined}>
            Route Reviews
          </Link>
          <Link className={activeSection === "tracking" ? "is-current" : undefined} href="/logistics/tracking" aria-current={activeSection === "tracking" ? "page" : undefined}>
            Order Tracking
          </Link>
        </nav>
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
