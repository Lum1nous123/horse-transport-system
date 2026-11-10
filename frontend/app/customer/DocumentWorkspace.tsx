"use client";

import { useCallback, useEffect, useState } from "react";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import "./document-workspace.css";

type DocumentKey = "HORSE_PASSPORT_OR_IDENTIFICATION" | "VACCINATION_CERTIFICATE" | "VETERINARY_HEALTH_CERTIFICATE" | "OWNERSHIP_CERTIFICATE" | "EXPORT_IMPORT_PERMIT";
type VersionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type Version = { id: string; documentId: string; versionNo: number; fileUrl: string; expiryDate: string | null; status: VersionStatus; isCurrent: boolean; uploadedAt: string; submittedAt: string | null; reviewedAt: string | null; rejectionReason: string | null; correctionDeadlineAt: string | null };
type DocumentItem = { id: string; type: DocumentKey; required: boolean; versions: Version[] };
type HorseProfile = { id: string; name: string };
type ChecklistResponse = { orderId: string; horses: { horseId: string; documents: { id: string; documentType: DocumentKey; required: boolean }[] }[] };
type PendingInput = { file: File | null; expiryDate: string };

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
    correctionDeadlineAt: index === 1 ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
  }] }));
}

function inputKey(horseId: string, documentId: string) { return `${horseId}:${documentId}`; }
function currentVersion(item: DocumentItem) { return item.versions.find((version) => version.isCurrent); }
function currentDraft(item: DocumentItem) {
  const version = currentVersion(item);
  return version?.status === "DRAFT" ? version : undefined;
}
function withCurrentVersion(item: DocumentItem, version: Version): DocumentItem {
  return {
    ...item,
    versions: [
      { ...version, isCurrent: true },
      ...item.versions.filter((existing) => existing.id !== version.id).map((existing) => ({ ...existing, isCurrent: false })),
    ],
  };
}

function fileLabel(fileUrl: string) {
  if (!fileUrl.startsWith("http")) return fileUrl;
  try { return decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() || "Open document"); }
  catch { return "Open document"; }
}

function correctionTimeRemaining(deadline: string, now: number) {
  const remainingMinutes = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 60_000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
}

export default function DocumentWorkspace({ orderId, orderCode, horses, preview, editable, onClose }: { orderId: string; orderCode: string; horses: HorseProfile[]; preview: boolean; editable: boolean; onClose: () => void }) {
  const [selectedHorseId, setSelectedHorseId] = useState(horses[0]?.id ?? "");
  const [documentsByHorse, setDocumentsByHorse] = useState<Record<string, DocumentItem[]>>(() => preview ? Object.fromEntries(horses.map((horse) => [horse.id, sampleDocuments()])) : {});
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [pendingInputs, setPendingInputs] = useState<Record<string, PendingInput>>({});
  const [submitSelection, setSubmitSelection] = useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = useState<Partial<Record<DocumentKey, string>>>({});
  const [submitCandidate, setSubmitCandidate] = useState<DocumentKey[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());

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
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const documents = documentsByHorse[selectedHorseId] ?? [];
  const selectedHorse = horses.find((horse) => horse.id === selectedHorseId);
  const unsavedFileCount = Object.values(pendingInputs).filter((input) => input.file).length;
  const pendingFileCount = documents.filter((item) => pendingInputs[inputKey(selectedHorseId, item.id)]?.file).length;
  const selectedPendingFileCount = documents.filter((item) => {
    const key = inputKey(selectedHorseId, item.id);
    return pendingInputs[key]?.file && (submitSelection[key] ?? true);
  }).length;
  const selectedForSubmission = documents.filter((item) => {
    const key = inputKey(selectedHorseId, item.id);
    const draft = currentDraft(item);
    const pendingFile = pendingInputs[key]?.file;
    const canSubmit = Boolean(draft || pendingFile);
    return canSubmit && (submitSelection[key] ?? canSubmit);
  });

  function updatePendingInput(item: DocumentItem, change: Partial<PendingInput>) {
    const key = inputKey(selectedHorseId, item.id);
    const fallback: PendingInput = { file: null, expiryDate: currentDraft(item)?.expiryDate ?? "" };
    setPendingInputs((current) => ({ ...current, [key]: { ...(current[key] ?? fallback), ...change } }));
    setActionErrors((current) => ({ ...current, [item.type]: undefined }));
    setMessage("");
  }

  function requestClose() {
    if (busy || submitCandidate.length > 0) return;
    if (unsavedFileCount > 0 && !window.confirm(`${unsavedFileCount} selected ${unsavedFileCount === 1 ? "file has" : "files have"} not been saved as drafts. Close and discard these selections?`)) return;
    onClose();
  }

  function applyPreviewVersion(horseId: string, item: DocumentItem, version: Version) {
    setDocumentsByHorse((current) => ({
      ...current,
      [horseId]: (current[horseId] ?? []).map((document) => document.id === item.id ? withCurrentVersion(document, version) : document),
    }));
  }

  async function persistDraft(item: DocumentItem, input: PendingInput): Promise<Version> {
    if (!input.file) throw new Error("Choose a file first.");
    const draft = currentDraft(item);
    if (preview) {
      const now = new Date().toISOString();
      return {
        id: draft?.id ?? `preview-${Date.now()}-${item.type}`, documentId: item.id,
        versionNo: draft?.versionNo ?? Math.max(0, ...item.versions.map((version) => version.versionNo)) + 1,
        fileUrl: input.file.name, expiryDate: input.expiryDate || null, status: "DRAFT", isCurrent: true,
        uploadedAt: now, submittedAt: null, reviewedAt: null, rejectionReason: null,
        correctionDeadlineAt: currentVersion(item)?.correctionDeadlineAt ?? null,
      };
    }
    const body = new FormData();
    body.append("file", input.file);
    if (input.expiryDate) body.append("expiryDate", input.expiryDate);
    const response = await documentRequest(draft ? `/api/v1/documents/${item.id}/versions/${draft.id}` : `/api/v1/documents/${item.id}/versions`, { method: draft ? "PUT" : "POST", body });
    return await response.json() as Version;
  }

  function clearPendingInputs(keys: string[]) {
    if (!keys.length) return;
    setPendingInputs((current) => {
      const next = { ...current };
      keys.forEach((key) => { delete next[key]; });
      return next;
    });
  }

  async function saveDrafts(types?: DocumentKey[]) {
    const targets = documents.filter((item) => {
      const key = inputKey(selectedHorseId, item.id);
      const selected = types ? true : submitSelection[key] ?? true;
      return (!types || types.includes(item.type)) && selected && pendingInputs[key]?.file;
    });
    if (!targets.length || busy) return;
    setBusy(true); setMessage(""); setActionErrors({});
    const savedKeys: string[] = [];
    const errors: Partial<Record<DocumentKey, string>> = {};
    let saved = 0;
    try {
      for (const [index, item] of targets.entries()) {
        const key = inputKey(selectedHorseId, item.id);
        const input = pendingInputs[key];
        setBatchProgress(`Saving ${index + 1} of ${targets.length}…`);
        if (!input?.file) {
          errors[item.type] = "Choose a file first.";
          continue;
        }
        try {
          const version = await persistDraft(item, input);
          if (preview) applyPreviewVersion(selectedHorseId, item, version);
          savedKeys.push(key); saved += 1;
        } catch (error) {
          errors[item.type] = error instanceof Error ? error.message : "We couldn't save this draft.";
        }
      }
      clearPendingInputs(savedKeys);
      if (!preview && saved > 0) await loadDocuments();
      setActionErrors(errors);
      const failed = targets.length - saved;
      setMessage(failed ? `${saved} ${saved === 1 ? "draft was" : "drafts were"} saved. ${failed} ${failed === 1 ? "file remains" : "files remain"} selected so you can retry.` : `${saved} ${saved === 1 ? "draft saved" : "drafts saved"}. You can submit them now or continue later.`);
    } finally { setBusy(false); setBatchProgress(""); }
  }

  function selectedTypes() { return selectedForSubmission.map((item) => item.type); }

  async function submitSelected(types: DocumentKey[]) {
    if (busy) return;
    const targets = types.map((type) => documents.find((item) => item.type === type)).filter((item): item is DocumentItem => {
      if (!item) return false;
      const key = inputKey(selectedHorseId, item.id);
      return Boolean(currentDraft(item) || pendingInputs[key]?.file);
    });
    if (!targets.length) { setSubmitCandidate([]); return; }

    setBusy(true); setMessage(""); setActionErrors({});
    const savedKeys: string[] = [];
    const errors: Partial<Record<DocumentKey, string>> = {};
    let submitted = 0;
    let savedButNotSubmitted = 0;
    try {
      for (const [index, item] of targets.entries()) {
        const key = inputKey(selectedHorseId, item.id);
        setBatchProgress(`Submitting ${index + 1} of ${targets.length}…`);
        let version = currentDraft(item);
        let savedInThisAction = false;
        try {
          const pending = pendingInputs[key];
          if (pending?.file) {
            version = await persistDraft(item, pending);
            savedKeys.push(key); savedInThisAction = true;
            if (preview) applyPreviewVersion(selectedHorseId, item, version);
          }
          if (!version) throw new Error("Save a draft before submitting this document.");
          if (preview) {
            applyPreviewVersion(selectedHorseId, item, { ...version, status: "PENDING_REVIEW", submittedAt: new Date().toISOString() });
          } else {
            await documentRequest(`/api/v1/documents/${item.id}/versions/${version.id}/submit`, { method: "POST" });
          }
          submitted += 1;
        } catch (error) {
          errors[item.type] = error instanceof Error ? error.message : "We couldn't submit this document.";
          if (savedInThisAction) savedButNotSubmitted += 1;
        }
      }
      clearPendingInputs(savedKeys);
      if (!preview && (submitted > 0 || savedButNotSubmitted > 0)) await loadDocuments();
      setActionErrors(errors);
      const failed = targets.length - submitted;
      setSubmitCandidate([]);
      setMessage(failed
        ? `${submitted} ${submitted === 1 ? "document was" : "documents were"} submitted. ${failed} ${failed === 1 ? "document wasn't" : "documents weren't"} submitted; check the affected cards.${savedButNotSubmitted ? ` ${savedButNotSubmitted} file${savedButNotSubmitted === 1 ? " was" : "s were"} saved as draft but not submitted.` : ""}`
        : `${submitted} ${submitted === 1 ? "document submitted" : "documents submitted"} for review. You can submit the remaining drafts later.`);
    } finally { setBusy(false); setBatchProgress(""); }
  }

  async function deleteDraft(type: DocumentKey) {
    const item = documents.find((document) => document.type === type);
    const draft = item && currentDraft(item);
    if (!item || !draft || !window.confirm("Delete this unsent draft?")) return;
    if (preview) {
      setDocumentsByHorse((current) => ({ ...current, [selectedHorseId]: documents.map((document) => document.id === item.id ? { ...document, versions: document.versions.filter((version) => version.id !== draft.id) } : document) }));
      setMessage("Draft deleted in this preview."); return;
    }
    setBusy(true); setLoadError(""); setActionErrors({});
    try { await documentRequest(`/api/v1/documents/${item.id}/versions/${draft.id}`, { method: "DELETE" }); setMessage("Draft deleted."); await loadDocuments(); }
    catch (error) { setActionErrors((current) => ({ ...current, [type]: error instanceof Error ? error.message : "We couldn't delete this draft." })); }
    finally { setBusy(false); }
  }

  function renderHistory(item: DocumentItem) {
    if (!item.versions.length) return <p className="document-history-empty">No versions uploaded yet.</p>;
    return <ol className="document-version-history">{item.versions.map((version) => <li key={version.id}><div className="document-version-heading"><strong>Version {version.versionNo}</strong><span className={`document-version-status ${version.status.toLowerCase()}`}>{statusLabels[version.status]}</span>{version.isCurrent && <span className="document-current-label">Current</span>}</div><p><a href={version.fileUrl} target="_blank" rel="noreferrer">{fileLabel(version.fileUrl)}</a>{version.expiryDate ? ` · Expires ${new Date(`${version.expiryDate}T00:00:00`).toLocaleDateString()}` : " · Expiry date not provided"}</p><small>Uploaded {new Date(version.uploadedAt).toLocaleString()}{version.submittedAt ? ` · Submitted ${new Date(version.submittedAt).toLocaleString()}` : ""}</small>{version.rejectionReason && <div className="document-rejection-note"><strong>Reason for rejection</strong><p>{version.rejectionReason}</p></div>}</li>)}</ol>;
  }

  return <div className="customer-dialog-backdrop document-workspace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <section className="customer-dialog document-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="document-workspace-title">
      <div className="customer-dialog-header"><div><p className="customer-eyebrow">ORDER {orderCode}</p><h2 id="document-workspace-title">Horse documents</h2><p>Choose files for any documents below. Save drafts or submit a selected group.</p></div><button type="button" className="customer-dialog-close" aria-label="Close document workspace" disabled={busy || submitCandidate.length > 0} onClick={requestClose}>×</button></div>
      <div className="document-workspace-content">
        {preview && <div className="customer-preview-banner document-preview-banner" role="status"><strong>Interface preview</strong><span>Demo uploads and actions are temporary and are not saved to your account.</span></div>}
        {loadError && <div className="customer-alert" role="alert"><span>{loadError}</span><button type="button" onClick={() => void loadDocuments()}>Try again</button></div>}
        {loading ? <div className="customer-loading" role="status">Loading document checklist…</div> : <>
          {horses.length > 1 && <div className="document-horse-tabs" role="tablist" aria-label="Select horse">{horses.map((horse) => <button type="button" role="tab" aria-selected={selectedHorseId === horse.id} className={selectedHorseId === horse.id ? "document-horse-tab selected" : "document-horse-tab"} key={horse.id} onClick={() => { setSelectedHorseId(horse.id); setMessage(""); }}>{horse.name}</button>)}</div>}
          {selectedHorse && <div className="document-workspace-heading"><div><h3>{selectedHorse.name}</h3><p>All checklist documents are required for this horse.</p></div><span className="document-workspace-count">{documents.filter((item) => currentVersion(item)?.status === "APPROVED").length} of {documents.length} approved</span></div>}
          {editable && <section className="document-batch-actions" aria-label="Save or submit document files">
            <div><strong>{pendingFileCount ? `${selectedPendingFileCount} selected · ${pendingFileCount} ${pendingFileCount === 1 ? "file" : "files"} staged` : "Add one or more document files"}</strong><span>Choose files across documents, select a subset, then save drafts or submit them together.</span></div>
            <div className="document-batch-buttons">
              <button type="button" className="customer-secondary-button compact" disabled={busy || selectedPendingFileCount === 0} onClick={() => void saveDrafts()}>{busy && batchProgress.startsWith("Saving") ? batchProgress : `Save ${selectedPendingFileCount ? `${selectedPendingFileCount} selected ` : ""}as drafts`}</button>
              <button type="button" className="customer-primary-button compact" disabled={busy || selectedForSubmission.length === 0} onClick={() => setSubmitCandidate(selectedTypes())}>{`Submit ${selectedForSubmission.length ? `${selectedForSubmission.length} ` : ""}selected`}</button>
            </div>
          </section>}
          {message && <p className="customer-feedback document-workspace-feedback" role="status">{message}</p>}
          <div className="document-item-list">{documentTypes.map(({ key, label }) => {
            const item = documents.find((document) => document.type === key);
            if (!item) return null;
            const current = currentVersion(item);
            const draft = currentDraft(item);
            const canEdit = editable && current?.status !== "PENDING_REVIEW" && current?.status !== "APPROVED";
            const storageKey = inputKey(selectedHorseId, item.id);
            const pending = pendingInputs[storageKey] ?? { file: null, expiryDate: draft?.expiryDate ?? "" };
            const hasSubmitCandidate = Boolean(draft || pending.file);
            const checked = submitSelection[storageKey] ?? hasSubmitCandidate;
            return <article className="document-item-card" key={item.id}>
              <div className="document-item-heading">
                <div className="document-item-title"><h4>{label}</h4><p>{item.required ? "Required document" : "Document"}</p></div>
                <span className={`document-version-status ${current?.status.toLowerCase() ?? "missing"}`}>{current ? statusLabels[current.status] : "Not uploaded"}</span>
              </div>
              {renderHistory(item)}
              {current?.correctionDeadlineAt && <div className={`document-correction-window ${current.status === "PENDING_REVIEW" || current.status === "APPROVED" ? "complete" : ""}`}><strong>Correction Deadline: {new Date(current.correctionDeadlineAt).toLocaleString()}</strong><span>{current.status === "PENDING_REVIEW" ? "Submitted on time — Awaiting Transport Specialist review." : current.status === "APPROVED" ? "Corrected version approved." : correctionTimeRemaining(current.correctionDeadlineAt, clockNow)}</span></div>}
              {canEdit && <>
                <div className="document-item-actions">
                  {hasSubmitCandidate && <label className="document-submit-select"><input type="checkbox" checked={checked} disabled={busy} onChange={(event) => setSubmitSelection((selection) => ({ ...selection, [storageKey]: event.target.checked }))} /><span>Select for bulk action</span></label>}
                  {pending.file && <button type="button" className="customer-text-button compact" disabled={busy} onClick={() => { setPendingInputs((inputs) => { const next = { ...inputs }; delete next[storageKey]; return next; }); setActionErrors((errors) => ({ ...errors, [key]: undefined })); }}>Clear selected file</button>}
                  {draft && <><button type="button" className="customer-text-button compact" disabled={busy} onClick={() => void deleteDraft(key)}>Delete draft</button><button type="button" className="customer-secondary-button compact" disabled={busy} onClick={() => setSubmitCandidate([key])}>Submit this draft</button></>}
                  {pending.file && <button type="button" className="customer-secondary-button compact" disabled={busy} onClick={() => void saveDrafts([key])}>Save this draft</button>}
                </div>
                <div className="document-draft-editor">
                  <h5>{draft ? "Replace draft file (optional)" : current?.status === "REJECTED" ? "Upload corrected version" : "Upload document"}</h5>
                  <label className="customer-field"><span>Document file {!draft && <b aria-hidden="true">*</b>}</span><input key={pending.file ? `${pending.file.name}:${pending.file.size}:${pending.file.lastModified}` : "empty"} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => { const file = event.target.files?.[0] ?? null; updatePendingInput(item, { file }); if (file) setSubmitSelection((selection) => ({ ...selection, [storageKey]: true })); }} />{pending.file ? <small className="document-pending-file">Ready: {pending.file.name}</small> : draft ? <small>Leave empty to submit the saved draft. Choose a file to replace it.</small> : null}</label>
                  <label className="customer-field"><span>Expiry date <em>Optional</em></span><input type="date" disabled={busy} value={pending.expiryDate} onChange={(event) => updatePendingInput(item, { expiryDate: event.target.value })} />{draft && !pending.file && <small>To change the expiry date, choose a replacement file.</small>}</label>
                  {actionErrors[key] && <p className="customer-form-error document-item-error" role="alert">{actionErrors[key]}</p>}
                </div>
              </>}
            </article>;
          })}</div>
        </>}
      </div>
    </section>
    {submitCandidate.length > 0 && <div className="customer-dialog-backdrop document-submit-backdrop"><section className="customer-warning" role="alertdialog" aria-modal="true" aria-labelledby="document-submit-title" aria-describedby="document-submit-copy"><div className="warning-symbol" aria-hidden="true">!</div><h2 id="document-submit-title">Submit {submitCandidate.length === 1 ? "this document" : `${submitCandidate.length} documents`}?</h2><p id="document-submit-copy">{submitCandidate.length > 1 ? "Selected files will be saved as drafts first, then submitted together. " : "This document will be saved as a draft first if it has a new file. "}Submitted versions are locked and cannot be edited or deleted. You can submit other drafts later.</p><ul className="document-submit-list">{submitCandidate.map((type) => <li key={type}>{documentTypes.find((item) => item.key === type)?.label}</li>)}</ul><div className="customer-form-actions"><button type="button" className="customer-secondary-button" disabled={busy} onClick={() => setSubmitCandidate([])}>Keep as draft</button><button type="button" className="customer-primary-button" disabled={busy} onClick={() => void submitSelected(submitCandidate)}>{busy ? batchProgress || "Submitting…" : `Submit ${submitCandidate.length === 1 ? "document" : `${submitCandidate.length} documents`}`}</button></div></section></div>}
  </div>;
}
