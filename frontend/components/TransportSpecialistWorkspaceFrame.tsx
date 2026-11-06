"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";
import BrandMark from "@/components/BrandMark";
import TransportSpecialistIcon from "@/components/TransportSpecialistIcon";

type TransportSpecialistWorkspaceFrameProps = {
  children: ReactNode;
  preview: boolean;
  previewSpecialistId?: string;
  previewSpecialistName?: string;
};

export default function TransportSpecialistWorkspaceFrame({
  children,
  preview,
  previewSpecialistId,
  previewSpecialistName,
}: TransportSpecialistWorkspaceFrameProps) {
  const router = useRouter();
  const previewSuffix = preview
    ? `?preview=1${previewSpecialistId ? `&specialistId=${encodeURIComponent(previewSpecialistId)}` : ""}`
    : "";

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className="customer-page ts-workspace-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <BrandMark />
          <span>Horse Transport System</span>
        </Link>
        <nav className="ts-topbar-nav" aria-label="Transport Specialist workspace">
          <Link className="is-current" href={`/transport-specialist${previewSuffix}`} aria-current="page">
            <TransportSpecialistIcon name="truck" />Assigned Orders
          </Link>
        </nav>
        <div className="customer-topbar-actions">
          <span className="ts-role"><TransportSpecialistIcon name="user" />Transport Specialist</span>
          <button type="button" className="customer-link-button" onClick={signOut}><TransportSpecialistIcon name="signOut" />Sign out</button>
        </div>
      </header>
      <div className="customer-content ts-workspace-content">
        {preview && (
          <div className="customer-preview-banner" role="status">
            <strong>Preview mode</strong>
            <span>{previewSpecialistName ? `Viewing the assigned workspace for ${previewSpecialistName}. ` : ""}Data is mocked and saved only for this browser session.</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
