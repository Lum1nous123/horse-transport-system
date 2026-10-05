"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";

type AssignmentWorkspaceFrameProps = {
  children: ReactNode;
  preview: boolean;
};

export default function AssignmentWorkspaceFrame({ children, preview }: AssignmentWorkspaceFrameProps) {
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
          <Link href={`/logistics${previewSuffix}`}>Submitted orders</Link>
          <Link className="is-current" href={`/logistics/assignments${previewSuffix}`} aria-current="page">
            Staff Assignment
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
            <span>Assignment data is mocked and saved only for this browser session.</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
