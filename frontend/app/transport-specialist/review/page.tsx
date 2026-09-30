"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clearAccessToken, getAccessToken, getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type DocumentKey = "HORSE_PASSPORT_OR_IDENTIFICATION" | "VACCINATION_CERTIFICATE" | "VETERINARY_HEALTH_CERTIFICATE" | "OWNERSHIP_CERTIFICATE" | "EXPORT_IMPORT_PERMIT";
type VersionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type DocumentOrder = { id: string; orderCode: string; status: "APPROVED"; originAddress: string | null; originCountry: string | null; destinationAddress: string | null; destinationCountry: string | null; requestedDepartureAt: string | null; horseCount: number };
type Version = { id: string; documentId: string; versionNo: number; status: VersionStatus; isCurrent: boolean; fileUrl: string; expiryDate: string | null; uploadedAt: string; submittedAt: string | null; reviewedAt: string | null; rejectionReason: string | null };
type ReviewDocument = { id: string; type: DocumentKey; required: boolean; versions: Version[] };
type ReviewHorse = { orderHorseId: string; horseId: string; documentStatus: string; documents: ReviewDocument[] };
type Checklist = { orderId: string; horses: { orderHorseId: string; horseId: string; documentStatus: string; documents: { id: string; documentType: DocumentKey; required: boolean }[] }[] };

const labels: Record<DocumentKey, string> = {
  HORSE_PASSPORT_OR_IDENTIFICATION: "Horse Passport / Identification Document",
  VACCINATION_CERTIFICATE: "Vaccination Certificate",
  VETERINARY_HEALTH_CERTIFICATE: "Veterinary Health Certificate",
  OWNERSHIP_CERTIFICATE: "Ownership Certificate",
  EXPORT_IMPORT_PERMIT: "Export / Import Permit",
};

function displayLocation(address: string | null, country: string | null, fallback: string) { return address || country || fallback; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function fileLabel(url: string) { try { return decodeURIComponent(new URL(url).pathname.split("/").pop() || "Open document"); } catch { return "Open document"; } }

export default function TransportSpecialistReviewPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<DocumentOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [horses, setHorses] = useState<ReviewHorse[]>([]);
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyVersionId, setBusyVersionId] = useState("");

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) throw new Error("SESSION_EXPIRED");
    const headers = new Headers(init?.headers); headers.set("Authorization", `Bearer ${token}`); headers.set("Accept", "application/json");
    if (init?.body) headers.set("Content-Type", "application/json");
    const response = await apiFetch(path, { ...init, headers });
    if (response.status === 401) { clearAccessToken(); throw new Error("SESSION_EXPIRED"); }
    if (!response.ok) {
      let detail = "We couldn't complete that review request.";
      try { const body = await response.json() as { message?: string }; if (body.message) detail = body.message; } catch { /* Keep default. */ }
      throw new Error(detail);
    }
    return response;
  }, []);

  const loadOrder = useCallback(async (orderId: string) => {
    setDetailLoading(true); setError("");
    try {
      const checklist = await (await request(`/api/v1/orders/${orderId}/documents/checklist`)).json() as Checklist;
      const loaded = await Promise.all(checklist.horses.map(async (horse) => ({
        orderHorseId: horse.orderHorseId, horseId: horse.horseId, documentStatus: horse.documentStatus,
        documents: await Promise.all(horse.documents.map(async (document) => ({ id: document.id, type: document.documentType, required: document.required, versions: await (await request(`/api/v1/documents/${document.id}/versions`)).json() as Version[] }))),
      })));
      setHorses(loaded); setSelectedHorseId((current) => loaded.some((horse) => horse.horseId === current) ? current : loaded[0]?.horseId ?? "");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "SESSION_EXPIRED") { router.replace("/login?next=/transport-specialist/review"); return; }
      setError(caught instanceof Error ? caught.message : "We couldn't load this checklist."); setHorses([]);
    } finally { setDetailLoading(false); }
  }, [request, router]);

  const loadOrders = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const user = await getCurrentUser();
      if (user.role !== "TRANSPORT_SPECIALIST") { router.replace("/login"); return; }
      const loaded = await (await request("/api/v1/orders/document-inbox")).json() as DocumentOrder[];
      setOrders(loaded);
      const nextId = loaded[0]?.id ?? "";
      setSelectedOrderId(nextId);
      if (nextId) await loadOrder(nextId); else { setHorses([]); setSelectedHorseId(""); }
    } catch (caught) {
      if (caught instanceof Error && caught.message === "SESSION_EXPIRED") { router.replace("/login?next=/transport-specialist/review"); return; }
      setError(caught instanceof Error ? caught.message : "We couldn't load the review queue.");
    } finally { setLoading(false); }
  }, [loadOrder, request, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  const selectedHorse = horses.find((horse) => horse.horseId === selectedHorseId) ?? horses[0] ?? null;
  const pendingCount = useMemo(() => horses.reduce((total, horse) => total + horse.documents.filter((document) => document.versions.some((version) => version.isCurrent && version.status === "PENDING_REVIEW")).length, 0), [horses]);

  async function chooseOrder(orderId: string) { setSelectedOrderId(orderId); setMessage(""); setExpanded({}); await loadOrder(orderId); }

  async function review(documentId: string, versionId: string, decision: "approve" | "reject") {
    const reason = rejectionReasons[versionId]?.trim();
    if (decision === "reject" && !reason) return;
    setBusyVersionId(versionId); setError(""); setMessage("");
    try {
      await request(`/api/v1/documents/${documentId}/versions/${versionId}/${decision}`, { method: "POST", body: decision === "reject" ? JSON.stringify({ rejectionReason: reason }) : undefined });
      setRejectionReasons((current) => ({ ...current, [versionId]: "" }));
      setExpanded((current) => ({ ...current, [`reject-${versionId}`]: false }));
      setMessage(decision === "approve" ? "Document version approved." : "Document version rejected with your reason.");
      if (selectedOrderId) await loadOrder(selectedOrderId);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "SESSION_EXPIRED") { router.replace("/login?next=/transport-specialist/review"); return; }
      setError(caught instanceof Error ? caught.message : "We couldn't save this review decision.");
    } finally { setBusyVersionId(""); }
  }

  function signOut() { clearAccessToken(); router.replace("/login"); }

  return <main className="customer-page specialist-review-page"><header className="customer-topbar"><Link className="customer-brand" href="/" aria-label="Horse Transport System home"><span className="customer-brand-mark" aria-hidden="true">HT</span><span>Horse Transport System</span></Link><div className="customer-topbar-actions"><Link href="/transport-specialist">Deadlines</Link><span>Transport Specialist</span><button type="button" className="customer-link-button" onClick={signOut}>Sign out</button></div></header>
    <div className="customer-content specialist-review-content"><div className="customer-heading-row specialist-review-heading"><div><p className="customer-eyebrow">DOCUMENT PHASE</p><h1>Document review</h1><p className="customer-intro">Review each submitted version and decide whether it is valid.</p></div><button className="customer-secondary-button" type="button" disabled={loading} onClick={() => void loadOrders()}>{loading ? "Refreshing…" : "Refresh queue"}</button></div>
      {message && <p className="customer-feedback review-feedback" role="status">{message}</p>}{error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void loadOrders()}>Try again</button></div>}
      {loading ? <div className="customer-loading" role="status">Loading document review queue…</div> : orders.length === 0 ? <div className="customer-empty"><div className="customer-empty-icon" aria-hidden="true">✓</div><div><h3>No orders in document review</h3><p>Approved orders will appear after their document checklist is created.</p></div></div> : selectedOrder && <div className="review-workspace-layout"><aside className="review-order-queue" aria-labelledby="review-queue-title"><div className="review-queue-heading"><div><h2 id="review-queue-title">Approved orders</h2><p>Document work queue</p></div><span>{orders.length}</span></div><div className="review-order-list">{orders.map((order) => <button type="button" key={order.id} className={selectedOrder.id === order.id ? "review-order-option selected" : "review-order-option"} onClick={() => void chooseOrder(order.id)} aria-current={selectedOrder.id === order.id ? "true" : undefined}><span className="review-order-option-top"><strong>{order.orderCode}</strong><span>{order.horseCount}</span></span><span className="review-order-route">{displayLocation(order.originAddress, order.originCountry, "Origin")} → {displayLocation(order.destinationAddress, order.destinationCountry, "Destination")}</span><span className="review-order-meta">{order.requestedDepartureAt ? `Departure ${formatDate(order.requestedDepartureAt)}` : "Departure not set"}</span></button>)}</div></aside>
        <section className="review-detail-panel" aria-labelledby="selected-order-title"><div className="review-detail-heading"><div><p className="customer-eyebrow">ORDER {selectedOrder.orderCode}</p><h2 id="selected-order-title">{displayLocation(selectedOrder.originAddress, selectedOrder.originCountry, "Origin")} <span aria-hidden="true">→</span> {displayLocation(selectedOrder.destinationAddress, selectedOrder.destinationCountry, "Destination")}</h2><p>{selectedOrder.requestedDepartureAt ? `Requested departure · ${formatDateTime(selectedOrder.requestedDepartureAt)}` : "Requested departure not set"}</p></div><span className="order-status status-approved">APPROVED</span></div>
          {detailLoading ? <div className="customer-loading" role="status">Loading checklist and version history…</div> : selectedHorse && <><div className="document-horse-tabs review-horse-tabs" role="tablist" aria-label="Select horse">{horses.map((horse, index) => { const count = horse.documents.filter((document) => document.versions.some((version) => version.isCurrent && version.status === "PENDING_REVIEW")).length; return <button type="button" role="tab" aria-selected={selectedHorse.horseId === horse.horseId} className={selectedHorse.horseId === horse.horseId ? "document-horse-tab selected" : "document-horse-tab"} key={horse.horseId} onClick={() => { setSelectedHorseId(horse.horseId); setMessage(""); }}>Horse {index + 1}<span className="review-horse-pending">{count} pending</span></button>; })}</div><div className="review-guidance"><strong>{pendingCount} version{pendingCount === 1 ? "" : "s"} awaiting review on this order</strong><p>Expiry details are information for your review. The system does not decide based on expiry date.</p></div>
            <div className="review-document-list">{selectedHorse.documents.map((document) => { const current = document.versions.find((version) => version.isCurrent); const submitted = current?.status === "PENDING_REVIEW" ? current : null; const history = document.versions.filter((version) => !version.isCurrent); return <article className="review-document-card" key={document.id}><div className="review-document-heading"><div><h3>{labels[document.type]}</h3><p>{current ? `Version ${current.versionNo}${current.submittedAt ? ` · Submitted ${formatDateTime(current.submittedAt)}` : ""}` : "No submitted version"}</p></div><span className={`document-version-status ${current?.status.toLowerCase() ?? "missing"}`}>{current?.status === "PENDING_REVIEW" ? "Awaiting review" : current?.status === "APPROVED" ? "Approved" : current?.status === "REJECTED" ? "Rejected" : "Not submitted"}</span></div>
              {current && current.status !== "DRAFT" && <div className="review-document-file"><span aria-hidden="true">▧</span><div><strong>{fileLabel(current.fileUrl)}</strong><small>{current.expiryDate ? `Expiry date · ${formatDate(current.expiryDate)}` : "No expiry date provided"}</small></div><a className="customer-secondary-button compact" href={current.fileUrl} target="_blank" rel="noreferrer">Open file</a></div>}
              {history.length > 0 && <div className="review-history"><button type="button" className="review-history-toggle" aria-expanded={Boolean(expanded[document.id])} onClick={() => setExpanded((state) => ({ ...state, [document.id]: !state[document.id] }))}>Version history <span>{expanded[document.id] ? "−" : "+"}</span></button>{expanded[document.id] && <ol>{history.map((version) => <li key={version.id}><strong>Version {version.versionNo} · {version.status.replaceAll("_", " ")}</strong>{version.submittedAt && <small>Submitted {formatDateTime(version.submittedAt)}</small>}{version.rejectionReason && <p>Rejection reason: {version.rejectionReason}</p>}</li>)}</ol>}</div>}
              {current?.rejectionReason && <p className="review-rejection-reason"><strong>Reason provided</strong><span>{current.rejectionReason}</span></p>}
              {submitted && <><div className="review-decision-actions"><button type="button" className="customer-primary-button compact" disabled={busyVersionId === submitted.id} onClick={() => void review(document.id, submitted.id, "approve")}>{busyVersionId === submitted.id ? "Saving…" : "Approve version"}</button><button type="button" className="customer-secondary-button compact review-reject-trigger" disabled={Boolean(busyVersionId)} onClick={() => setExpanded((state) => ({ ...state, [`reject-${submitted.id}`]: !state[`reject-${submitted.id}`] }))}>{expanded[`reject-${submitted.id}`] ? "Close rejection form" : "Reject version"}</button></div>{expanded[`reject-${submitted.id}`] && <div className="review-rejection-form"><label className="customer-field"><span>Reason for rejection <b aria-hidden="true">*</b></span><textarea rows={3} value={rejectionReasons[submitted.id] ?? ""} onChange={(event) => setRejectionReasons((state) => ({ ...state, [submitted.id]: event.target.value }))} placeholder="Explain what needs to be corrected." /></label><button type="button" className="customer-primary-button danger-button compact" disabled={busyVersionId === submitted.id || !rejectionReasons[submitted.id]?.trim()} onClick={() => void review(document.id, submitted.id, "reject")}>{busyVersionId === submitted.id ? "Saving…" : "Reject with reason"}</button></div>}</>}
            </article>; })}</div></>}
        </section></div>}
    </div>
  </main>;
}
