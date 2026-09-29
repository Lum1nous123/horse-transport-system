"use client";

import { useState } from "react";

type DocumentKey = "HORSE_PASSPORT_OR_IDENTIFICATION" | "VACCINATION_CERTIFICATE" | "VETERINARY_HEALTH_CERTIFICATE" | "OWNERSHIP_CERTIFICATE" | "EXPORT_IMPORT_PERMIT";
type VersionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type Version = {
  versionNo: number;
  fileName: string;
  expiryDate: string;
  status: VersionStatus;
  isCurrent: boolean;
  uploadedAt: string;
  submittedAt?: string;
  rejectionReason?: string;
};
type DocumentItem = { type: DocumentKey; versions: Version[] };
type HorseProfile = { id: string; name: string };

const documentTypes: { key: DocumentKey; label: string }[] = [
  { key: "HORSE_PASSPORT_OR_IDENTIFICATION", label: "Horse Passport / Identification Document" },
  { key: "VACCINATION_CERTIFICATE", label: "Vaccination Certificate" },
  { key: "VETERINARY_HEALTH_CERTIFICATE", label: "Veterinary Health Certificate" },
  { key: "OWNERSHIP_CERTIFICATE", label: "Ownership Certificate" },
  { key: "EXPORT_IMPORT_PERMIT", label: "Export / Import Permit" },
];

const statusLabels: Record<VersionStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Submitted · awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected · resubmission needed",
};

function sampleDocuments(): DocumentItem[] {
  const submittedAt = "2026-09-26T10:30:00";
  return [
    { type: "HORSE_PASSPORT_OR_IDENTIFICATION", versions: [{ versionNo: 1, fileName: "horse-passport.pdf", expiryDate: "2028-06-30", status: "APPROVED", isCurrent: true, uploadedAt: "2026-09-22T09:15:00", submittedAt }] },
    { type: "VACCINATION_CERTIFICATE", versions: [{ versionNo: 1, fileName: "vaccination-record.pdf", expiryDate: "2026-08-15", status: "REJECTED", isCurrent: true, uploadedAt: "2026-09-22T09:22:00", submittedAt, rejectionReason: "Please upload a current vaccination certificate." }] },
    { type: "VETERINARY_HEALTH_CERTIFICATE", versions: [{ versionNo: 1, fileName: "health-certificate-draft.pdf", expiryDate: "2026-11-12", status: "DRAFT", isCurrent: true, uploadedAt: "2026-09-28T14:05:00" }] },
    { type: "OWNERSHIP_CERTIFICATE", versions: [{ versionNo: 1, fileName: "ownership.pdf", expiryDate: "", status: "PENDING_REVIEW", isCurrent: true, uploadedAt: "2026-09-24T11:20:00", submittedAt }] },
    { type: "EXPORT_IMPORT_PERMIT", versions: [] },
  ];
}

export default function DocumentWorkspace({
  orderCode,
  horses,
  preview,
  onClose,
}: {
  orderCode: string;
  horses: HorseProfile[];
  preview: boolean;
  onClose: () => void;
}) {
  const [selectedHorseId, setSelectedHorseId] = useState(horses[0]?.id ?? "");
  const [documentsByHorse, setDocumentsByHorse] = useState<Record<string, DocumentItem[]>>(() =>
    Object.fromEntries(horses.map((horse) => [horse.id, sampleDocuments()])),
  );
  const [editingType, setEditingType] = useState<DocumentKey | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [formError, setFormError] = useState("");
  const [submitCandidate, setSubmitCandidate] = useState<DocumentKey | null>(null);
  const [message, setMessage] = useState("");

  const documents = documentsByHorse[selectedHorseId] ?? [];
  const selectedHorse = horses.find((horse) => horse.id === selectedHorseId);

  function beginDraft(type: DocumentKey) {
    const item = documents.find((document) => document.type === type);
    const draft = item?.versions.find((version) => version.status === "DRAFT" && version.isCurrent);
    setEditingType(type);
    setSelectedFile(null);
    setExpiryDate(draft?.expiryDate ?? "");
    setFormError("");
    setMessage("");
  }

  function saveDraft() {
    if (!editingType) return;
    const item = documents.find((document) => document.type === editingType);
    const draft = item?.versions.find((version) => version.status === "DRAFT" && version.isCurrent);
    const existingDraft = Boolean(draft);
    const fileName = selectedFile?.name ?? draft?.fileName;
    if (!fileName) {
      setFormError("Choose a file to create this draft.");
      return;
    }
    const updated: DocumentItem[] = documents.map((document) => {
      if (document.type !== editingType) return document;
      const versions = [...document.versions];
      if (draft) {
        return {
          ...document,
          versions: versions.map((version) => version === draft
            ? { ...version, fileName, expiryDate, uploadedAt: new Date().toISOString() }
            : version),
        };
      }
      const nextVersion = Math.max(0, ...versions.map((version) => version.versionNo)) + 1;
      return {
        ...document,
        versions: [
          ...versions.map((version) => ({ ...version, isCurrent: false })),
          { versionNo: nextVersion, fileName, expiryDate, status: "DRAFT", isCurrent: true, uploadedAt: new Date().toISOString() },
        ],
      };
    });
    setDocumentsByHorse((current) => ({ ...current, [selectedHorseId]: updated }));
    setEditingType(null); setSelectedFile(null); setMessage(existingDraft ? "Draft updated in this preview." : "Draft created in this preview.");
  }

  function deleteDraft(type: DocumentKey) {
    setDocumentsByHorse((current) => ({
      ...current,
      [selectedHorseId]: (current[selectedHorseId] ?? []).map((document) => {
        if (document.type !== type) return document;
        const versions = document.versions.filter((version) => !(version.status === "DRAFT" && version.isCurrent));
        if (!versions.length || versions.some((version) => version.isCurrent)) return { ...document, versions };
        const latestNo = Math.max(...versions.map((version) => version.versionNo));
        return { ...document, versions: versions.map((version) => ({ ...version, isCurrent: version.versionNo === latestNo })) };
      }),
    }));
    setMessage("Draft deleted in this preview.");
  }

  function submitDraft(type: DocumentKey) {
    setDocumentsByHorse((current) => ({
      ...current,
      [selectedHorseId]: (current[selectedHorseId] ?? []).map((document) => document.type === type
        ? { ...document, versions: document.versions.map((version) => version.status === "DRAFT" && version.isCurrent
          ? { ...version, status: "PENDING_REVIEW", submittedAt: new Date().toISOString() }
          : version) }
        : document),
    }));
    setSubmitCandidate(null);
    setMessage("Version submitted in this preview and shown as locked.");
  }

  function renderVersionHistory(item: DocumentItem) {
    if (!item.versions.length) return <p className="document-history-empty">No versions uploaded yet.</p>;
    return <ol className="document-version-history">
      {[...item.versions].sort((a, b) => b.versionNo - a.versionNo).map((version) => <li key={`${item.type}-${version.versionNo}`}>
        <div className="document-version-heading"><strong>Version {version.versionNo}</strong><span className={`document-version-status ${version.status.toLowerCase()}`}>{statusLabels[version.status]}</span>{version.isCurrent && <span className="document-current-label">Current</span>}</div>
        <p>{version.fileName}{version.expiryDate ? ` · Expires ${new Date(`${version.expiryDate}T00:00:00`).toLocaleDateString()}` : " · Expiry date not provided"}</p>
        <small>Uploaded {new Date(version.uploadedAt).toLocaleString()}{version.submittedAt ? ` · Submitted ${new Date(version.submittedAt).toLocaleString()}` : ""}</small>
        {version.rejectionReason && <div className="document-rejection-note"><strong>Reason for rejection</strong><p>{version.rejectionReason}</p></div>}
      </li>)}
    </ol>;
  }

  return (
    <div className="customer-dialog-backdrop document-workspace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitCandidate) onClose(); }}>
      <section className="customer-dialog document-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="document-workspace-title">
        <div className="customer-dialog-header"><div><p className="customer-eyebrow">ORDER {orderCode}</p><h2 id="document-workspace-title">Horse documents</h2><p>Manage drafts, submissions, and version history for each horse.</p></div><button type="button" className="customer-dialog-close" aria-label="Close document workspace" onClick={onClose}>×</button></div>
        <div className="document-workspace-content">
          {preview ? <div className="customer-preview-banner document-preview-banner" role="status"><strong>Interface preview</strong><span>Demo uploads and actions are temporary and are not saved to your account.</span></div> : <div className="customer-alert document-api-notice" role="status"><span>Sample data only. Saving and submitting documents will be connected after the document APIs are available.</span></div>}
          {horses.length > 1 && <div className="document-horse-tabs" role="tablist" aria-label="Select horse">{horses.map((horse) => <button type="button" role="tab" aria-selected={selectedHorseId === horse.id} className={selectedHorseId === horse.id ? "document-horse-tab selected" : "document-horse-tab"} key={horse.id} onClick={() => { setSelectedHorseId(horse.id); setEditingType(null); setMessage(""); }}>{horse.name}</button>)}</div>}
          {selectedHorse && <div className="document-workspace-heading"><div><h3>{selectedHorse.name}</h3><p>All five documents are required for this horse.</p></div><span className="document-workspace-count">{documents.filter((item) => item.versions.some((version) => version.status === "APPROVED" && version.isCurrent)).length} of 5 approved</span></div>}
          {message && <p className="customer-feedback document-workspace-feedback" role="status">{message}</p>}
          <div className="document-item-list">
            {documentTypes.map(({ key, label }) => {
              const item = documents.find((document) => document.type === key) ?? { type: key, versions: [] };
              const current = item.versions.find((version) => version.isCurrent);
              const draft = item.versions.find((version) => version.isCurrent && version.status === "DRAFT");
              const canCreate = !current || current.status === "REJECTED";
              return <article className="document-item-card" key={`${selectedHorseId}-${key}`}>
                <div className="document-item-heading"><div><h4>{label}</h4><p>Required document</p></div><span className={`document-version-status ${current?.status.toLowerCase() ?? "missing"}`}>{current ? statusLabels[current.status] : "Not uploaded"}</span></div>
                {renderVersionHistory(item)}
                {preview && !current?.status.match(/^(PENDING_REVIEW|APPROVED)$/) && <div className="document-item-actions">
                  {canCreate && <button className="customer-primary-button compact" type="button" onClick={() => beginDraft(key)}>{current?.status === "REJECTED" ? "Upload new version" : "Upload document"}</button>}
                  {draft && <><button className="customer-secondary-button compact" type="button" onClick={() => beginDraft(key)}>Edit draft</button><button className="customer-text-button compact" type="button" onClick={() => deleteDraft(key)}>Delete draft</button><button className="customer-secondary-button compact" type="button" onClick={() => setSubmitCandidate(key)}>Submit for review</button></>}
                </div>}
                {editingType === key && preview && <div className="document-draft-editor">
                  <h5>{draft ? "Edit draft" : current?.status === "REJECTED" ? "Create resubmission" : "Create document draft"}</h5>
                  <label className="customer-field"><span>Document file {!draft && <b aria-hidden="true">*</b>}</span><input type="file" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setFormError(""); }} />{draft && <small>Current draft file: {draft.fileName}. Choose a file to replace it.</small>}</label>
                  <label className="customer-field"><span>Expiry date <em>Optional</em></span><input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
                  {formError && <p className="customer-form-error" role="alert">{formError}</p>}
                  <div className="customer-form-actions"><button type="button" className="customer-text-button" onClick={() => { setEditingType(null); setFormError(""); }}>Cancel</button><button type="button" className="customer-primary-button" onClick={saveDraft}>Save draft</button></div>
                </div>}
              </article>;
            })}
          </div>
          {!preview && <div className="document-preview-disabled-note">Use the development preview (`?preview=1`) to explore draft and submission interactions.</div>}
        </div>
      </section>
      {submitCandidate && <div className="customer-dialog-backdrop document-submit-backdrop"><section className="customer-warning" role="alertdialog" aria-modal="true" aria-labelledby="document-submit-title" aria-describedby="document-submit-copy"><div className="warning-symbol" aria-hidden="true">!</div><h2 id="document-submit-title">Submit this version?</h2><p id="document-submit-copy">After submission, this version is locked and cannot be edited or deleted. You can upload a new version if the Transport Specialist rejects it.</p><div className="customer-form-actions"><button type="button" className="customer-secondary-button" onClick={() => setSubmitCandidate(null)}>Keep as draft</button><button type="button" className="customer-primary-button" onClick={() => submitDraft(submitCandidate)}>Submit for review</button></div></section></div>}
    </div>
  );
}
