"use client";

import { useCallback, useEffect, useState } from "react";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type DocumentKey = "HORSE_PASSPORT_OR_IDENTIFICATION" | "VACCINATION_CERTIFICATE" | "VETERINARY_HEALTH_CERTIFICATE" | "OWNERSHIP_CERTIFICATE" | "EXPORT_IMPORT_PERMIT";
type VersionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type Version = { id: string; documentId: string; versionNo: number; fileUrl: string; expiryDate: string | null; status: VersionStatus; isCurrent: boolean; uploadedAt: string; submittedAt: string | null; reviewedAt: string | null; rejectionReason: string | null };
type DocumentItem = { id: string; type: DocumentKey; required: boolean; versions: Version[] };
type HorseProfile = { id: string; name: string };
type ChecklistResponse = { orderId: string; horses: { horseId: string; documents: { id: string; documentType: DocumentKey; required: boolean }[] }[] };

const documentTypes: { key: DocumentKey; label: string }[] = [
  { key: "HORSE_PASSPORT_OR_IDENTIFICATION", label: "Horse Passport / Identification Document" },
  { key: "VACCINATION_CERTIFICATE", label: "Vaccination Certificate" },
  { key: "VETERINARY_HEALTH_CERTIFICATE", label: "Veterinary Health Certificate" },
  { key: "OWNERSHIP_CERTIFICATE", label: "Ownership Certificate" },
  { key: "EXPORT_IMPORT_PERMIT", label: "Export / Import Permit" },
];
const statusLabels: Record<VersionStatus, string> = { DRAFT: "Draft", PENDING_REVIEW: "Submitted · awaiting review", APPROVED: "Approved", REJECTED: "Rejected · resubmission needed" };

function sampleDocuments(): DocumentItem[] {
  return documentTypes.map(({ key }, index) => ({ id: `preview-document-${key}`, type: key, required: true, versions: index === 4 ? [] : [{
    id: `preview-version-${key}`, documentId: `preview-document-${key}`, versionNo: 1, fileUrl: `${key.toLowerCase()}.pdf`, expiryDate: index === 3 ? null : "2027-06-30",
    status: (["APPROVED", "REJECTED", "DRAFT", "PENDING_REVIEW"] as VersionStatus[])[index], isCurrent: true, uploadedAt: "2026-09-22T09:15:00",
    submittedAt: index === 2 ? null : "2026-09-26T10:30:00", reviewedAt: index < 2 ? "2026-09-27T10:00:00" : null,
    rejectionReason: index === 1 ? "Please upload a current vaccination certificate." : null,
  }] }));
}

function fileLabel(fileUrl: string) {
  if (!fileUrl.startsWith("http")) return fileUrl;
  try { return decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() || "Open document"); }
  catch { return "Open document"; }
}

export default function DocumentWorkspace({ orderId, orderCode, horses, preview, editable, onClose }: { orderId: string; orderCode: string; horses: HorseProfile[]; preview: boolean; editable: boolean; onClose: () => void }) {
  const [selectedHorseId, setSelectedHorseId] = useState(horses[0]?.id ?? "");
  const [documentsByHorse, setDocumentsByHorse] = useState<Record<string, DocumentItem[]>>(() => preview ? Object.fromEntries(horses.map((horse) => [horse.id, sampleDocuments()])) : {});
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [editingType, setEditingType] = useState<DocumentKey | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [formError, setFormError] = useState("");
  const [submitCandidate, setSubmitCandidate] = useState<DocumentKey | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const documentRequest = useCallback(async (path: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`); headers.set("Accept", "application/json");
    const response = await apiFetch(path, { ...init, headers });
    if (response.status === 401) { clearAccessToken(); throw new Error("Your session has expired. Please sign in again."); }
    if (!response.ok) {
      let detail = "We couldn't complete that document request.";
      try { const error = await response.json() as { message?: string }; if (error.message) detail = error.message; } catch { /* Keep default. */ }
      throw new Error(detail);
    }
    return response;
  }, []);

  const loadDocuments = useCallback(async () => {
    if (preview) return;
    setLoading(true); setLoadError("");
    try {
      const checklist = await (await documentRequest(`/api/v1/orders/${orderId}/documents/checklist`)).json() as ChecklistResponse;
      const pairs = await Promise.all(checklist.horses.map(async (horse) => [horse.horseId, await Promise.all(horse.documents.map(async (document) => ({
        id: document.id, type: document.documentType, required: document.required,
        versions: await (await documentRequest(`/api/v1/documents/${document.id}/versions`)).json() as Version[],
      })))] as const));
      const mapped = Object.fromEntries(pairs);
      setDocumentsByHorse(mapped);
      setSelectedHorseId((current) => current && mapped[current] ? current : checklist.horses[0]?.horseId ?? "");
    } catch (error) { setLoadError(error instanceof Error ? error.message : "We couldn't load the document checklist."); }
    finally { setLoading(false); }
  }, [documentRequest, orderId, preview]);

  useEffect(() => {
    if (preview) return;
    const timer = window.setTimeout(() => { void loadDocuments(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDocuments, preview]);
  const documents = documentsByHorse[selectedHorseId] ?? [];
  const selectedHorse = horses.find((horse) => horse.id === selectedHorseId);

  function beginDraft(type: DocumentKey) {
    const draft = documents.find((document) => document.type === type)?.versions.find((version) => version.status === "DRAFT" && version.isCurrent);
    setEditingType(type); setSelectedFile(null); setExpiryDate(draft?.expiryDate ?? ""); setFormError(""); setMessage("");
  }

  async function saveDraft() {
    if (!editingType) return;
    const item = documents.find((document) => document.type === editingType);
    const draft = item?.versions.find((version) => version.status === "DRAFT" && version.isCurrent);
    if (!item || !selectedFile) { setFormError(draft ? "Choose a replacement file to update this draft." : "Choose a file to create this draft."); return; }
    if (preview) {
      const next: Version = { id: draft?.id ?? `preview-${Date.now()}`, documentId: item.id, versionNo: draft?.versionNo ?? Math.max(0, ...item.versions.map((version) => version.versionNo)) + 1, fileUrl: selectedFile.name, expiryDate: expiryDate || null, status: "DRAFT", isCurrent: true, uploadedAt: new Date().toISOString(), submittedAt: null, reviewedAt: null, rejectionReason: null };
      setDocumentsByHorse((current) => ({ ...current, [selectedHorseId]: documents.map((document) => document.id === item.id ? { ...document, versions: draft ? document.versions.map((version) => version.id === draft.id ? next : version) : [next, ...document.versions.map((version) => ({ ...version, isCurrent: false }))] } : document) }));
      setEditingType(null); setSelectedFile(null); setMessage(draft ? "Draft updated in this preview." : "Draft created in this preview."); return;
    }
    setBusy(true); setFormError("");
    try {
      const body = new FormData(); body.append("file", selectedFile); if (expiryDate) body.append("expiryDate", expiryDate);
      await documentRequest(draft ? `/api/v1/documents/${item.id}/versions/${draft.id}` : `/api/v1/documents/${item.id}/versions`, { method: draft ? "PUT" : "POST", body });
      setEditingType(null); setSelectedFile(null); setMessage(draft ? "Draft updated." : "Document draft created."); await loadDocuments();
    } catch (error) { setFormError(error instanceof Error ? error.message : "We couldn't save this draft."); }
    finally { setBusy(false); }
  }

  async function deleteDraft(type: DocumentKey) {
    const item = documents.find((document) => document.type === type); const draft = item?.versions.find((version) => version.status === "DRAFT" && version.isCurrent);
    if (!item || !draft || !window.confirm("Delete this unsent draft?")) return;
    if (preview) { setDocumentsByHorse((current) => ({ ...current, [selectedHorseId]: documents.map((document) => document.id === item.id ? { ...document, versions: document.versions.filter((version) => version.id !== draft.id) } : document) })); setMessage("Draft deleted in this preview."); return; }
    setBusy(true); setLoadError("");
    try { await documentRequest(`/api/v1/documents/${item.id}/versions/${draft.id}`, { method: "DELETE" }); setMessage("Draft deleted."); await loadDocuments(); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "We couldn't delete this draft."); }
    finally { setBusy(false); }
  }

  async function submitDraft(type: DocumentKey) {
    const item = documents.find((document) => document.type === type); const draft = item?.versions.find((version) => version.status === "DRAFT" && version.isCurrent);
    if (!item || !draft) return;
    if (preview) { setDocumentsByHorse((current) => ({ ...current, [selectedHorseId]: documents.map((document) => document.id === item.id ? { ...document, versions: document.versions.map((version) => version.id === draft.id ? { ...version, status: "PENDING_REVIEW", submittedAt: new Date().toISOString() } : version) } : document) })); setSubmitCandidate(null); setMessage("Version submitted in this preview and shown as locked."); return; }
    setBusy(true); setLoadError("");
    try { await documentRequest(`/api/v1/documents/${item.id}/versions/${draft.id}/submit`, { method: "POST" }); setSubmitCandidate(null); setMessage("Version submitted for review."); await loadDocuments(); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "We couldn't submit this version."); }
    finally { setBusy(false); }
  }

  function renderHistory(item: DocumentItem) {
    if (!item.versions.length) return <p className="document-history-empty">No versions uploaded yet.</p>;
    return <ol className="document-version-history">{item.versions.map((version) => <li key={version.id}><div className="document-version-heading"><strong>Version {version.versionNo}</strong><span className={`document-version-status ${version.status.toLowerCase()}`}>{statusLabels[version.status]}</span>{version.isCurrent && <span className="document-current-label">Current</span>}</div><p><a href={version.fileUrl} target="_blank" rel="noreferrer">{fileLabel(version.fileUrl)}</a>{version.expiryDate ? ` · Expires ${new Date(`${version.expiryDate}T00:00:00`).toLocaleDateString()}` : " · Expiry date not provided"}</p><small>Uploaded {new Date(version.uploadedAt).toLocaleString()}{version.submittedAt ? ` · Submitted ${new Date(version.submittedAt).toLocaleString()}` : ""}</small>{version.rejectionReason && <div className="document-rejection-note"><strong>Reason for rejection</strong><p>{version.rejectionReason}</p></div>}</li>)}</ol>;
  }

  return <div className="customer-dialog-backdrop document-workspace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitCandidate && !busy) onClose(); }}><section className="customer-dialog document-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="document-workspace-title"><div className="customer-dialog-header"><div><p className="customer-eyebrow">ORDER {orderCode}</p><h2 id="document-workspace-title">Horse documents</h2><p>Manage drafts, submissions, and version history for each horse.</p></div><button type="button" className="customer-dialog-close" aria-label="Close document workspace" disabled={busy} onClick={onClose}>×</button></div><div className="document-workspace-content">
    {preview && <div className="customer-preview-banner document-preview-banner" role="status"><strong>Interface preview</strong><span>Demo uploads and actions are temporary and are not saved to your account.</span></div>}
    {loadError && <div className="customer-alert" role="alert"><span>{loadError}</span><button type="button" onClick={() => void loadDocuments()}>Try again</button></div>}
    {loading ? <div className="customer-loading" role="status">Loading document checklist…</div> : <>{horses.length > 1 && <div className="document-horse-tabs" role="tablist" aria-label="Select horse">{horses.map((horse) => <button type="button" role="tab" aria-selected={selectedHorseId === horse.id} className={selectedHorseId === horse.id ? "document-horse-tab selected" : "document-horse-tab"} key={horse.id} onClick={() => { setSelectedHorseId(horse.id); setEditingType(null); setMessage(""); }}>{horse.name}</button>)}</div>}
      {selectedHorse && <div className="document-workspace-heading"><div><h3>{selectedHorse.name}</h3><p>All checklist documents are required for this horse.</p></div><span className="document-workspace-count">{documents.filter((item) => item.versions.some((version) => version.status === "APPROVED" && version.isCurrent)).length} of {documents.length} approved</span></div>}
      {message && <p className="customer-feedback document-workspace-feedback" role="status">{message}</p>}
      <div className="document-item-list">{documentTypes.map(({ key, label }) => { const item = documents.find((document) => document.type === key); if (!item) return null; const current = item.versions.find((version) => version.isCurrent); const draft = current?.status === "DRAFT" ? current : undefined; const canCreate = !current || current.status === "REJECTED"; return <article className="document-item-card" key={item.id}><div className="document-item-heading"><div><h4>{label}</h4><p>{item.required ? "Required document" : "Document"}</p></div><span className={`document-version-status ${current?.status.toLowerCase() ?? "missing"}`}>{current ? statusLabels[current.status] : "Not uploaded"}</span></div>{renderHistory(item)}
        {editable && !current?.status.match(/^(PENDING_REVIEW|APPROVED)$/) && <div className="document-item-actions">{canCreate && <button className="customer-primary-button compact" disabled={busy} type="button" onClick={() => beginDraft(key)}>{current?.status === "REJECTED" ? "Upload new version" : "Upload document"}</button>}{draft && <><button className="customer-secondary-button compact" disabled={busy} type="button" onClick={() => beginDraft(key)}>Edit draft</button><button className="customer-text-button compact" disabled={busy} type="button" onClick={() => void deleteDraft(key)}>Delete draft</button><button className="customer-secondary-button compact" disabled={busy} type="button" onClick={() => setSubmitCandidate(key)}>Submit for review</button></>}</div>}
        {editable && editingType === key && <div className="document-draft-editor"><h5>{draft ? "Edit draft" : current?.status === "REJECTED" ? "Create resubmission" : "Create document draft"}</h5><label className="customer-field"><span>Document file <b aria-hidden="true">*</b></span><input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setFormError(""); }} />{draft && <small>Choose a file to replace the current draft file.</small>}</label><label className="customer-field"><span>Expiry date <em>Optional</em></span><input type="date" disabled={busy} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>{formError && <p className="customer-form-error" role="alert">{formError}</p>}<div className="customer-form-actions"><button type="button" className="customer-text-button" disabled={busy} onClick={() => { setEditingType(null); setFormError(""); }}>Cancel</button><button type="button" className="customer-primary-button" disabled={busy} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save draft"}</button></div></div>}
      </article>; })}</div></>}
  </div></section>{submitCandidate && <div className="customer-dialog-backdrop document-submit-backdrop"><section className="customer-warning" role="alertdialog" aria-modal="true" aria-labelledby="document-submit-title" aria-describedby="document-submit-copy"><div className="warning-symbol" aria-hidden="true">!</div><h2 id="document-submit-title">Submit this version?</h2><p id="document-submit-copy">After submission, this version is locked and cannot be edited or deleted. You can upload a new version if the Transport Specialist rejects it.</p><div className="customer-form-actions"><button type="button" className="customer-secondary-button" disabled={busy} onClick={() => setSubmitCandidate(null)}>Keep as draft</button><button type="button" className="customer-primary-button" disabled={busy} onClick={() => void submitDraft(submitCandidate)}>{busy ? "Submitting…" : "Submit for review"}</button></div></section></div>}</div>;
}
