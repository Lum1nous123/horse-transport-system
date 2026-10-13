"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";

type FleetRouteCoordinatorWorkspaceFrameProps = {
  children: ReactNode;
  preview: boolean;
  previewCoordinatorId?: string;
  previewCoordinatorName?: string;
};

export default function FleetRouteCoordinatorWorkspaceFrame({
  children,
  preview,
  previewCoordinatorId,
  previewCoordinatorName,
}: FleetRouteCoordinatorWorkspaceFrameProps) {
  const router = useRouter();
  const previewSuffix = preview
    ? `?preview=1${previewCoordinatorId ? `&coordinatorId=${encodeURIComponent(previewCoordinatorId)}` : ""}`
    : "";

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className="customer-page frc-workspace-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span>
          <span>Horse Transport System</span>
        </Link>
        <nav className="frc-topbar-nav" aria-label="Fleet and Route Coordinator workspace">
          <Link className="is-current" href={`/fleet-route-coordinator${previewSuffix}`} aria-current="page">
            Planning queue
          </Link>
        </nav>
        <div className="customer-topbar-actions">
          <span>Fleet &amp; Route Coordinator</span>
          <button type="button" className="customer-link-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="customer-content frc-workspace-content">
        {preview && (
          <div className="customer-preview-banner" role="status">
            <strong>Preview mode</strong>
            <span>{previewCoordinatorName ? `Viewing the assigned workspace for ${previewCoordinatorName}. ` : ""}Data is mocked and no backend request is sent.</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
