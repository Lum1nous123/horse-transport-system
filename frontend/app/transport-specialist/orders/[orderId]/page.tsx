"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import TransportSpecialistWorkspaceFrame from "@/components/TransportSpecialistWorkspaceFrame";
import {
  SpecialistWorkspaceError,
  transportSpecialistWorkspaceService,
  type AssignedSpecialistOrderDetail,
  type DocumentType,
  type SpecialistDocument,
} from "@/lib/transport-specialist-workspace/service";
import { useTransportSpecialistAccess } from "@/lib/transport-specialist-workspace/use-specialist-access";

const documentLabels: Record<DocumentType, string> = {
  HORSE_PASSPORT_OR_IDENTIFICATION: "Horse Passport / Identification",
  VACCINATION_CERTIFICATE: "Vaccination Certificate",
  VETERINARY_HEALTH_CERTIFICATE: "Veterinary Health Certificate",
  OWNERSHIP_CERTIFICATE: "Ownership Certificate",
  EXPORT_IMPORT_PERMIT: "Export / Import Permit",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

export default function AssignedOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const {
    state: accessState,
    preview,
    previewSpecialistId,
    previewSpecialistName,
    message: accessMessage,
  } = useTransportSpecialistAccess();
  const [order, setOrder] = useState<AssignedSpecialistOrderDetail | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deadlineValue, setDeadlineValue] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [rejectionVersionId, setRejectionVersionId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmingFinal, setConfirmingFinal] = useState(false);
  const [expandedStep, setExpandedStep] = useState<"deadline" | "documents" | "final">("documents");

  const loadOrder = useCallback(async (announce = false) => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const detail = await transportSpecialistWorkspaceService.getAssignedOrder(orderId);
      setOrder(detail);
      setSelectedHorseId((current) => detail.horses.some((horse) => horse.id === current) ? current : detail.horses[0]?.id ?? "");
      setExpandedStep(detail.documentPhaseLocked || detail.eligibility.eligible
        ? "final"
        : detail.documentCompletionDeadlineAt
          ? "documents"
          : "deadline");
      if (announce) setFeedback("Order state refreshed.");
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this assigned Order.");
      setErrorCode(caught instanceof SpecialistWorkspaceError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadOrder(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadOrder]);

  const selectedHorse = useMemo(
    () => order?.horses.find((horse) => horse.id === selectedHorseId) ?? order?.horses[0] ?? null,
    [order, selectedHorseId],
  );

  async function runMutation(key: string, action: () => Promise<void>, successMessage: string) {
    setBusyKey(key);
    setError("");
    setErrorCode("");
    setFeedback("");
    try {
      await action();
      await loadOrder();
      setFeedback(successMessage);
      setRejectionVersionId("");
      setRejectionReason("");
      setConfirmingFinal(false);
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : "We couldn't save that change.";
      const nextCode = caught instanceof SpecialistWorkspaceError ? caught.code : "REQUEST_FAILED";
      setError(nextError);
      setErrorCode(nextCode);
      if (nextCode === "STALE_STATE") {
        await loadOrder();
        setError(nextError);
        setErrorCode(nextCode);
      }
    } finally {
      setBusyKey("");
    }
  }

  async function saveDeadline() {
    if (!deadlineValue || !order) return;
    const timestamp = deadlineValue.length === 16 ? `${deadlineValue}:00` : deadlineValue;
    await runMutation(
      "deadline",
      () => transportSpecialistWorkspaceService.setDocumentDeadline(order.id, timestamp),
      "Document deadline set and locked.",
    );
    setDeadlineValue("");
  }

  async function review(document: SpecialistDocument, decision: "APPROVE" | "REJECT") {
    if (!order) return;
    const current = document.versions.find((version) => version.isCurrent);
    if (!current) return;
    await runMutation(
      current.id,
      () => transportSpecialistWorkspaceService.reviewDocumentVersion(order.id, document.id, current.id, {
        decision,
        rejectionReason: decision === "REJECT" ? rejectionReason : undefined,
      }),
      decision === "APPROVE" ? "Document version approved." : "Document version rejected with your reason.",
    );
  }

  async function finalConfirm() {
    if (!order) return;
    await runMutation(
      "final-confirm",
      () => transportSpecialistWorkspaceService.finalConfirmDocuments(order.id),
      "Documents Final Confirmed. The Document Phase is now permanently locked.",
    );
  }

  function moveHorseTabFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!order || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = order.horses.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight"
          ? (index + 1) % order.horses.length
          : (index - 1 + order.horses.length) % order.horses.length;
    const nextHorse = order.horses[nextIndex];
    setSelectedHorseId(nextHorse.id);
    window.requestAnimationFrame(() => document.getElementById(`horse-tab-${nextHorse.id}`)?.focus());
  }

  if (accessState === "checking") {
    return <main className="customer-page assignment-access-state"><p role="status">Checking Transport Specialist access…</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page assignment-access-state">
        <section className="assignment-access-card" role="alert">
          <p className="customer-eyebrow">WORKSPACE UNAVAILABLE</p>
          <h1>{accessState === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <Link className="customer-primary-button" href="/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  const previewSuffix = preview ? `?preview=1&specialistId=${encodeURIComponent(previewSpecialistId)}` : "";

  return (
    <TransportSpecialistWorkspaceFrame preview={preview} previewSpecialistId={previewSpecialistId} previewSpecialistName={previewSpecialistName}>
      <nav className="assignment-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/transport-specialist${previewSuffix}`}>Assigned Orders</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{order?.orderCode ?? "Order"}</span>
      </nav>

      {loading ? (
        <div className="ts-detail-skeleton" role="status" aria-label="Loading assigned Order"><span /><span /><span /></div>
      ) : !order ? (
        <section className="assignment-not-found">
          <p className="customer-eyebrow">ORDER UNAVAILABLE</p>
          <h1>{errorCode === "FORBIDDEN" ? "This Order isn't assigned to you." : "We couldn't open this Order."}</h1>
          <p>{error || "Return to your assigned queue and choose an available Order."}</p>
          <div className="ts-unavailable-actions">
            <Link className="customer-primary-button" href={`/transport-specialist${previewSuffix}`}>Back to assigned Orders</Link>
            {errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadOrder()}>Try again</button>}
          </div>
        </section>
      ) : (
        <>
          <header className="ts-detail-header">
            <div>
              <span className={`ts-state-badge ${order.documentPhaseLocked ? "is-locked" : order.eligibility.eligible ? "is-eligible" : ""}`}>
                {order.documentPhaseLocked ? "Final confirmed" : order.eligibility.eligible ? "Ready for Final Confirm" : "Action required"}
              </span>
              <h1>{order.orderCode}</h1>
              <p>{order.origin} <span aria-hidden="true">→</span> {order.destination}</p>
            </div>
            <Link className="assignment-back-link" href={`/transport-specialist${previewSuffix}`}>← Back to assigned Orders</Link>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          {error && (
            <div className="customer-alert" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void loadOrder(true)}>Refresh Order</button>
            </div>
          )}

          <dl className="ts-order-facts">
            <div><dt>Requested departure</dt><dd>{formatDateTime(order.requestedDepartureAt)}</dd></div>
            <div><dt>Transport mode</dt><dd>{order.transportMode}</dd></div>
            <div><dt>Horses</dt><dd>{order.horseCount}</dd></div>
            <div><dt>Fleet &amp; Route Coordinator</dt><dd>{order.assignedFleetRouteCoordinatorName}</dd></div>
          </dl>

          <div className="ts-guided-workflow" aria-label="Document Phase workflow">
            <section className={`ts-workflow-step ${order.documentCompletionDeadlineAt ? "is-complete" : "is-current"}`}>
              <button className="ts-workflow-step-header" type="button" aria-expanded={expandedStep === "deadline"} aria-controls="ts-deadline-step" onClick={() => setExpandedStep("deadline")}>
                <span className="ts-workflow-number" aria-hidden="true">{order.documentCompletionDeadlineAt ? "✓" : "1"}</span>
                <span className="ts-workflow-heading"><strong>1. Deadline</strong><small>{order.documentCompletionDeadlineAt ? `Completed · ${formatDateTime(order.documentCompletionDeadlineAt)}` : "Set one immutable deadline for the complete Order"}</small></span>
                <span className="ts-workflow-chevron" aria-hidden="true">{expandedStep === "deadline" ? "⌃" : "⌄"}</span>
              </button>
              {expandedStep === "deadline" && (
                <div className="ts-workflow-step-body ts-deadline-step-body" id="ts-deadline-step">
                  <div><h2>Document completion deadline</h2><p>One deadline applies to every Horse and required document in this Order.</p></div>
                  {order.documentCompletionDeadlineAt ? (
                    <div className="ts-deadline-readback"><span>Deadline set</span><strong>{formatDateTime(order.documentCompletionDeadlineAt)}</strong><small>Locked · cannot be changed</small></div>
                  ) : (
                    <div className="ts-deadline-control">
                      <label className="customer-field"><span>Completion date and time <b aria-hidden="true">*</b></span><input type="datetime-local" required value={deadlineValue} disabled={Boolean(busyKey)} onChange={(event) => setDeadlineValue(event.target.value)} /></label>
                      <button className="customer-primary-button compact" type="button" disabled={!deadlineValue || Boolean(busyKey)} onClick={() => void saveDeadline()}>{busyKey === "deadline" ? "Setting deadline…" : "Set and lock deadline"}</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className={`ts-workflow-step ${order.progress.approved === order.progress.total ? "is-complete" : expandedStep === "documents" ? "is-current" : ""}`}>
              <button className="ts-workflow-step-header" type="button" aria-expanded={expandedStep === "documents"} aria-controls="ts-documents-step" onClick={() => setExpandedStep("documents")}>
                <span className="ts-workflow-number" aria-hidden="true">{order.progress.approved === order.progress.total ? "✓" : "2"}</span>
                <span className="ts-workflow-heading"><strong>2. Review documents</strong><small>{order.progress.approved} of {order.progress.total} approved · {order.progress.pendingReview} awaiting review</small></span>
                <span className="ts-workflow-chevron" aria-hidden="true">{expandedStep === "documents" ? "⌃" : "⌄"}</span>
              </button>
              {expandedStep === "documents" && (
                <div className="ts-workflow-step-body ts-documents-step-body" id="ts-documents-step">
                  <div className="ts-document-step-intro"><div><h2>Required documents</h2><p>Review the current submitted version for each Horse. Expiry dates inform your decision; the server remains the source of eligibility.</p></div><div className="ts-progress-summary" aria-label="Document progress"><strong>{order.progress.approved}/{order.progress.total}</strong><span>approved</span><progress value={order.progress.approved} max={order.progress.total || 1} /></div></div>

                  <div className="ts-horse-tabs" role="tablist" aria-label="Select Horse">
                    {order.horses.map((horse, index) => {
                      const pending = horse.documents.filter((document) => document.versions.some((version) => version.isCurrent && version.status === "PENDING_REVIEW")).length;
                      return <button type="button" role="tab" id={`horse-tab-${horse.id}`} aria-controls={`horse-panel-${horse.id}`} aria-selected={selectedHorse?.id === horse.id} className={selectedHorse?.id === horse.id ? "is-selected" : ""} key={horse.id} tabIndex={selectedHorse?.id === horse.id ? 0 : -1} onKeyDown={(event) => moveHorseTabFocus(event, index)} onClick={() => { setSelectedHorseId(horse.id); setRejectionVersionId(""); setRejectionReason(""); }}><span>{horse.displayName}</span><small>{pending} awaiting review</small></button>;
                    })}
                  </div>

                  {selectedHorse && (
                    <div className="ts-horse-panel" id={`horse-panel-${selectedHorse.id}`} role="tabpanel" aria-labelledby={`horse-tab-${selectedHorse.id}`} tabIndex={0}>
                      <div className="ts-horse-heading"><div><h3>{selectedHorse.displayName}</h3><p>Microchip {selectedHorse.microchipId}</p></div><span>{selectedHorse.documents.length} required documents</span></div>
                      <div className="ts-document-table-wrap">
                        <table className="ts-document-table">
                          <thead><tr><th scope="col">Document</th><th scope="col">Version / File</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
                          <tbody>
                            {selectedHorse.documents.map((document) => {
                              const current = document.versions.find((version) => version.isCurrent);
                              const history = document.versions.filter((version) => !version.isCurrent);
                              const canReview = !order.documentPhaseLocked && current?.status === "PENDING_REVIEW";
                              const rejectionOpen = current ? rejectionVersionId === current.id : false;
                              return (
                                <Fragment key={document.id}>
                                  <tr>
                                    <td data-label="Document"><strong>{documentLabels[document.type]}</strong></td>
                                    <td data-label="Version / File">
                                      {current && current.status !== "DRAFT" ? <div className="ts-table-file"><span>Version {current.versionNo}</span><a href={current.fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${current.fileName} in a new tab`}>{current.fileName} <b aria-hidden="true">↗</b></a><small>{current.submittedAt ? `Submitted ${formatDateTime(current.submittedAt)}` : "Not submitted"}{current.expiryDate ? ` · Expires ${formatDate(current.expiryDate)}` : ""}</small>{history.length > 0 && <details><summary>Version history ({history.length})</summary><ol>{history.map((item) => <li key={item.id}><strong>Version {item.versionNo} · {item.status.replaceAll("_", " ")}</strong>{item.submittedAt && <span>Submitted {formatDateTime(item.submittedAt)}</span>}{item.rejectionReason && <p>{item.rejectionReason}</p>}</li>)}</ol></details>}</div> : <span className="ts-table-empty">No submitted version</span>}
                                    </td>
                                    <td data-label="Status"><span className={`document-version-status ${current?.status.toLowerCase() ?? "missing"}`}>{current?.status === "PENDING_REVIEW" ? "Awaiting review" : current?.status ? current.status.replaceAll("_", " ") : "Missing"}</span>{current?.rejectionReason && <small className="ts-table-rejection">{current.rejectionReason}</small>}</td>
                                    <td data-label="Action">{canReview ? <div className="ts-table-actions"><button className="customer-primary-button compact ts-approve-button" type="button" disabled={Boolean(busyKey)} onClick={() => void review(document, "APPROVE")}>{busyKey === current.id ? "Saving…" : "Approve"}</button><button className="customer-secondary-button compact" type="button" disabled={Boolean(busyKey)} aria-expanded={rejectionOpen} onClick={() => { setRejectionVersionId(rejectionOpen ? "" : current.id); setRejectionReason(""); }}>{rejectionOpen ? "Close" : "Reject"}</button></div> : <span className="ts-table-no-action">—</span>}</td>
                                  </tr>
                                  {canReview && rejectionOpen && <tr className="ts-table-rejection-row"><td colSpan={4}><div className="ts-rejection-form"><label className="customer-field"><span>Reason for rejection <b aria-hidden="true">*</b></span><textarea rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain what the Customer needs to correct." /></label><button className="customer-primary-button danger-button compact" type="button" disabled={!rejectionReason.trim() || Boolean(busyKey)} onClick={() => void review(document, "REJECT")}>Reject with reason</button></div></td></tr>}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className={`ts-workflow-step ${order.documentPhaseLocked ? "is-complete" : order.eligibility.eligible ? "is-current" : "is-locked"}`}>
              {order.documentPhaseLocked || order.eligibility.eligible ? (
                <button className="ts-workflow-step-header" type="button" aria-expanded={expandedStep === "final"} aria-controls="ts-final-step" onClick={() => setExpandedStep("final")}><span className="ts-workflow-number" aria-hidden="true">{order.documentPhaseLocked ? "✓" : "3"}</span><span className="ts-workflow-heading"><strong>3. Final Confirm</strong><small>{order.documentPhaseLocked ? "Completed · Document Phase permanently locked" : "Eligible · all required documents approved"}</small></span><span className="ts-workflow-chevron" aria-hidden="true">{expandedStep === "final" ? "⌃" : "⌄"}</span></button>
              ) : (
                <div className="ts-workflow-step-header" aria-disabled="true"><span className="ts-workflow-number" aria-hidden="true">3</span><span className="ts-workflow-heading"><strong>3. Final Confirm</strong><small>Locked · {order.eligibility.blockers[0] ?? "Complete document review first"}</small></span><span className="ts-workflow-lock" aria-hidden="true">⌕</span></div>
              )}
              {expandedStep === "final" && (order.documentPhaseLocked || order.eligibility.eligible) && (
                <div className="ts-workflow-step-body ts-final-step-body" id="ts-final-step">
                  <div><h2>Final Confirm documents</h2>{order.documentPhaseLocked ? <p>This Document Phase was permanently locked by {order.finalConfirmedBy} on {formatDateTime(order.finalConfirmedAt ?? order.eligibility.checkedAt)}.</p> : <p>The server-reported state confirms every required document is approved. Final Confirm permanently locks this phase and requests the Remaining Balance from the Customer.</p>}</div>
                  {order.documentPhaseLocked ? <div className="ts-locked-result" role="status"><strong>Document Phase locked</strong><span>No document can be reopened or changed.</span></div> : confirmingFinal ? <div className="ts-final-confirm-prompt" role="alert" aria-live="polite"><strong>Lock this Document Phase permanently?</strong><span>This action cannot be undone.</span><div><button className="customer-secondary-button compact" type="button" disabled={Boolean(busyKey)} onClick={() => setConfirmingFinal(false)}>Keep reviewing</button><button className="customer-primary-button compact" type="button" disabled={Boolean(busyKey)} onClick={() => void finalConfirm()}>{busyKey === "final-confirm" ? "Final Confirming…" : "Final Confirm documents"}</button></div></div> : <button className="customer-primary-button" type="button" onClick={() => setConfirmingFinal(true)}>Review Final Confirm</button>}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </TransportSpecialistWorkspaceFrame>
  );
}
