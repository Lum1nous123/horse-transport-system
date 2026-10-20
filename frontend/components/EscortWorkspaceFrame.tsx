"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";

type EscortWorkspaceFrameProps = {
  children: ReactNode;
  preview: boolean;
  previewEscortId?: string;
  previewEscortName?: string;
};

export default function EscortWorkspaceFrame({
  children,
  preview,
  previewEscortId,
  previewEscortName,
}: EscortWorkspaceFrameProps) {
  const router = useRouter();
  const previewSuffix = preview
    ? `?preview=1${previewEscortId ? `&escortId=${encodeURIComponent(previewEscortId)}` : ""}`
    : "";

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className="customer-page escort-workspace-page">
      <header className="customer-topbar escort-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span>
          <span>Horse Transport System</span>
        </Link>
        <nav className="escort-topbar-nav" aria-label="Escort workspace">
          <Link className="is-current" href={`/escort${previewSuffix}`} aria-current="page">
            Assigned journey work
          </Link>
        </nav>
        <div className="customer-topbar-actions">
          <span>Escort</span>
          <button type="button" className="customer-link-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="customer-content escort-workspace-content">
        {preview && (
          <div className="customer-preview-banner" role="status">
            <strong>Preview mode</strong>
            <span>{previewEscortName ? `Viewing assigned work for ${previewEscortName}. ` : ""}Data is mocked and saved only for this browser session.</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
