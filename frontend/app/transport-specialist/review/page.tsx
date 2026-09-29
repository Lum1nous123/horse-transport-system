"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Decision = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type ReviewDocument = {
  id: string;
  label: string;
  versionNo: number;
  fileName: string;
  expiryDate: string | null;
  uploadedAt: string;
  submittedAt: string;
  status: Decision;
  rejectionReason?: string;
  history: { versionNo: number; status: "APPROVED" | "REJECTED" | "REPLACED"; submittedAt: string; rejectionReason?: string }[];
};
type ReviewHorse = { id: string; name: string; documents: ReviewDocument[] };
type ReviewOrder = {
  id: string;
  orderCode: string;
  origin: string;
  destination: string;
  requestedDepartureAt: string;
  horses: ReviewHorse[];
};

const sampleOrders: ReviewOrder[] = [
  {
    id: "review-order-1",
    orderCode: "ORD-DEMO-1019",
    origin: "Dublin, Ireland",
    destination: "Lyon, France",
    requestedDepartureAt: "2026-10-20T09:00:00",
    horses: [
      {
        id: "review-horse-1",
        name: "Willow Creek",
        documents: [
          { id: "passport-1", label: "Horse Passport / Identification Document", versionNo: 1, fileName: "horse-passport.pdf", expiryDate: "2028-06-30", uploadedAt: "2026-09-28T09:10:00", submittedAt: "2026-09-28T11:20:00", status: "PENDING_REVIEW", history: [] },
          { id: "vaccination-1", label: "Vaccination Certificate", versionNo: 2, fileName: "vaccination-record-v2.pdf", expiryDate: "2026-10-01", uploadedAt: "2026-09-28T09:20:00", submittedAt: "2026-09-28T11:25:00", status: "PENDING_REVIEW", history: [{ versionNo: 1, status: "REJECTED", submittedAt: "2026-09-25T14:10:00", rejectionReason: "Please provide a readable certificate with its expiry date visible." }] },
          { id: "health-1", label: "Veterinary Health Certificate", versionNo: 1, fileName: "health-certificate.pdf", expiryDate: "2026-11-12", uploadedAt: "2026-09-28T09:35:00", submittedAt: "2026-09-28T11:30:00", status: "PENDING_REVIEW", history: [] },
          { id: "ownership-1", label: "Ownership Certificate", versionNo: 1, fileName: "ownership-certificate.pdf", expiryDate: null, uploadedAt: "2026-09-26T13:10:00", submittedAt: "2026-09-26T15:00:00", status: "APPROVED", history: [] },
          { id: "permit-1", label: "Export / Import Permit", versionNo: 0, fileName: "", expiryDate: null, uploadedAt: "", submittedAt: "", status: "PENDING_REVIEW", history: [] },
        ],
      },
      {
        id: "review-horse-2",
        name: "Copper Ridge",
        documents: [
          { id: "passport-2", label: "Horse Passport / Identification Document", versionNo: 1, fileName: "copper-passport.pdf", expiryDate: "2027-09-01", uploadedAt: "2026-09-27T08:40:00", submittedAt: "2026-09-27T10:00:00", status: "PENDING_REVIEW", history: [] },
          { id: "vaccination-2", label: "Vaccination Certificate", versionNo: 1, fileName: "copper-vaccination.pdf", expiryDate: "2027-01-18", uploadedAt: "2026-09-27T08:45:00", submittedAt: "2026-09-27T10:05:00", status: "APPROVED", history: [] },
          { id: "health-2", label: "Veterinary Health Certificate", versionNo: 0, fileName: "", expiryDate: null, uploadedAt: "", submittedAt: "", status: "PENDING_REVIEW", history: [] },
          { id: "ownership-2", label: "Ownership Certificate", versionNo: 1, fileName: "copper-ownership.pdf", expiryDate: null, uploadedAt: "2026-09-27T09:00:00", submittedAt: "2026-09-27T10:15:00", status: "PENDING_REVIEW", history: [] },
          { id: "permit-2", label: "Export / Import Permit", versionNo: 0, fileName: "", expiryDate: null, uploadedAt: "", submittedAt: "", status: "PENDING_REVIEW", history: [] },
        ],
      },
    ],
  },
  {
    id: "review-order-2",
    orderCode: "ORD-DEMO-1014",
    origin: "Bordeaux, France",
    destination: "Ghent, Belgium",
    requestedDepartureAt: "2026-10-27T08:00:00",
    horses: [{
      id: "review-horse-3", name: "Silver Fern", documents: [
        { id: "passport-3", label: "Horse Passport / Identification Document", versionNo: 1, fileName: "silver-passport.pdf", expiryDate: "2029-05-01", uploadedAt: "2026-09-28T15:00:00", submittedAt: "2026-09-29T08:30:00", status: "PENDING_REVIEW", history: [] },
        { id: "vaccination-3", label: "Vaccination Certificate", versionNo: 1, fileName: "silver-vaccination.pdf", expiryDate: "2027-03-21", uploadedAt: "2026-09-28T15:03:00", submittedAt: "2026-09-29T08:35:00", status: "PENDING_REVIEW", history: [] },
        { id: "health-3", label: "Veterinary Health Certificate", versionNo: 1, fileName: "silver-health.pdf", expiryDate: "2026-11-02", uploadedAt: "2026-09-28T15:05:00", submittedAt: "2026-09-29T08:40:00", status: "PENDING_REVIEW", history: [] },
        { id: "ownership-3", label: "Ownership Certificate", versionNo: 1, fileName: "silver-ownership.pdf", expiryDate: null, uploadedAt: "2026-09-28T15:10:00", submittedAt: "2026-09-29T08:45:00", status: "PENDING_REVIEW", history: [] },
        { id: "permit-3", label: "Export / Import Permit", versionNo: 1, fileName: "silver-permit.pdf", expiryDate: "2027-02-10", uploadedAt: "2026-09-28T15:15:00", submittedAt: "2026-09-29T08:50:00", status: "PENDING_REVIEW", history: [] },
      ],
    }],
  },
];

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : `${value}Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(`${value}Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default function TransportSpecialistReviewPage() {
  const router = useRouter();
  const [orders, setOrders] = useState(sampleOrders);
  const [selectedOrderId, setSelectedOrderId] = useState(sampleOrders[0].id);
  const [selectedHorseId, setSelectedHorseId] = useState(sampleOrders[0].horses[0].id);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  const selectedHorse = selectedOrder.horses.find((horse) => horse.id === selectedHorseId) ?? selectedOrder.horses[0];
  const pendingCount = orders.reduce((total, order) => total + order.horses.reduce((horseTotal, horse) => horseTotal + horse.documents.filter((document) => document.status === "PENDING_REVIEW" && document.fileName).length, 0), 0);

  function selectOrder(order: ReviewOrder) {
    setSelectedOrderId(order.id);
    setSelectedHorseId(order.horses[0]?.id ?? "");
    setMessage("");
  }

  function updateDocument(documentId: string, status: "APPROVED" | "REJECTED", rejectionReason?: string) {
    setOrders((current) => current.map((order) => ({
      ...order,
      horses: order.horses.map((horse) => ({
        ...horse,
        documents: horse.documents.map((document) => document.id === documentId
          ? { ...document, status, rejectionReason }
          : document),
      })),
    })));
    setRejectionReasons((current) => ({ ...current, [documentId]: "" }));
    setMessage(status === "APPROVED"
      ? "Document approved in this preview. The system did not make this decision."
      : "Document rejected in this preview with your reason.");
  }

  function signOut() { router.push("/login"); }

  return (
    <main className="customer-page specialist-review-page">
      <header className="customer-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span><span>Horse Transport System</span>
        </Link>
        <div className="customer-topbar-actions"><span>Transport Specialist</span><button type="button" className="customer-link-button" onClick={signOut}>Sign out</button></div>
      </header>
      <div className="customer-content specialist-review-content">
        <div className="customer-preview-banner review-preview-banner" role="status"><strong>Interface preview</strong><span>Sample orders only. Review decisions stay in this tab and are not saved.</span></div>
        <div className="customer-heading-row specialist-review-heading"><div><p className="customer-eyebrow">DOCUMENT PHASE</p><h1>Document review</h1><p className="customer-intro">Review each submitted version and decide whether it is valid.</p></div><span className="customer-count">{pendingCount} awaiting review</span></div>
        {message && <p className="customer-feedback review-feedback" role="status">{message}</p>}

        <div className="review-workspace-layout">
          <aside className="review-order-queue" aria-labelledby="review-queue-title">
            <div className="review-queue-heading"><div><h2 id="review-queue-title">Approved orders</h2><p>Documents submitted for review</p></div><span>{orders.length}</span></div>
            <div className="review-order-list">{orders.map((order) => {
              const count = order.horses.reduce((total, horse) => total + horse.documents.filter((document) => document.status === "PENDING_REVIEW" && document.fileName).length, 0);
              return <button type="button" key={order.id} className={selectedOrder.id === order.id ? "review-order-option selected" : "review-order-option"} onClick={() => selectOrder(order)} aria-current={selectedOrder.id === order.id ? "true" : undefined}>
                <span className="review-order-option-top"><strong>{order.orderCode}</strong><span>{count}</span></span>
                <span className="review-order-route">{order.origin} → {order.destination}</span>
                <span className="review-order-meta">Departure {formatDate(order.requestedDepartureAt)}</span>
              </button>;
            })}</div>
          </aside>

          <section className="review-detail-panel" aria-labelledby="selected-order-title">
            <div className="review-detail-heading"><div><p className="customer-eyebrow">ORDER {selectedOrder.orderCode}</p><h2 id="selected-order-title">{selectedOrder.origin} <span aria-hidden="true">→</span> {selectedOrder.destination}</h2><p>Requested departure · {formatDateTime(selectedOrder.requestedDepartureAt)}</p></div><span className="order-status status-approved">APPROVED</span></div>
            <div className="document-horse-tabs review-horse-tabs" role="tablist" aria-label="Select horse">{selectedOrder.horses.map((horse) => {
              const count = horse.documents.filter((document) => document.status === "PENDING_REVIEW" && document.fileName).length;
              return <button type="button" role="tab" aria-selected={selectedHorse.id === horse.id} className={selectedHorse.id === horse.id ? "document-horse-tab selected" : "document-horse-tab"} key={horse.id} onClick={() => { setSelectedHorseId(horse.id); setMessage(""); }}>{horse.name}<span className="review-horse-pending">{count} pending</span></button>;
            })}</div>
            <div className="review-guidance"><strong>Review expiry and overall validity</strong><p>Expiry details are information for your review. The system does not approve or reject a document based on its expiry date.</p></div>
            <div className="review-document-list">{selectedHorse.documents.map((document) => <article className="review-document-card" key={document.id}>
              <div className="review-document-heading"><div><h3>{document.label}</h3><p>{document.versionNo ? `Version ${document.versionNo} · ` : ""}{document.submittedAt ? `Submitted ${formatDateTime(document.submittedAt)}` : "No submitted version"}</p></div><span className={`document-version-status ${document.status.toLowerCase()}`}>{document.status === "PENDING_REVIEW" && !document.fileName ? "Not submitted" : document.status === "PENDING_REVIEW" ? "Awaiting review" : document.status === "APPROVED" ? "Approved" : "Rejected"}</span></div>
              {document.fileName && <div className="review-document-file"><span aria-hidden="true">▧</span><div><strong>{document.fileName}</strong><small>{document.expiryDate ? `Expiry date · ${formatDate(document.expiryDate)}` : "No expiry date provided"}</small></div><button className="customer-secondary-button compact" type="button" disabled>Open file</button></div>}
              {document.history.length > 0 && <div className="review-history"><button type="button" className="review-history-toggle" aria-expanded={Boolean(expandedHistory[document.id])} onClick={() => setExpandedHistory((current) => ({ ...current, [document.id]: !current[document.id] }))}>Version history <span>{expandedHistory[document.id] ? "−" : "+"}</span></button>{expandedHistory[document.id] && <ol>{document.history.map((version, index) => <li key={`${document.id}-history-${index}`}><strong>Version {version.versionNo} · {version.status.replaceAll("_", " ")}</strong><small>Submitted {formatDateTime(version.submittedAt)}</small>{version.rejectionReason && <p>Rejection reason: {version.rejectionReason}</p>}</li>)}</ol>}</div>}
              {document.rejectionReason && <p className="review-rejection-reason"><strong>Reason provided</strong><span>{document.rejectionReason}</span></p>}
              {document.status === "PENDING_REVIEW" && document.fileName && <div className="review-decision-actions"><button type="button" className="customer-primary-button compact" onClick={() => updateDocument(document.id, "APPROVED")}>Approve version</button><button type="button" className="customer-secondary-button compact review-reject-trigger" onClick={() => setExpandedHistory((current) => ({ ...current, [`reject-${document.id}`]: !current[`reject-${document.id}`] }))}>{expandedHistory[`reject-${document.id}`] ? "Close rejection form" : "Reject version"}</button></div>}
              {document.status === "PENDING_REVIEW" && document.fileName && expandedHistory[`reject-${document.id}`] && <div className="review-rejection-form"><label className="customer-field"><span>Reason for rejection <b aria-hidden="true">*</b></span><textarea rows={3} value={rejectionReasons[document.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Explain what needs to be corrected." /></label><button type="button" className="customer-primary-button danger-button compact" disabled={!rejectionReasons[document.id]?.trim()} onClick={() => updateDocument(document.id, "REJECTED", rejectionReasons[document.id].trim())}>Reject with reason</button></div>}
            </article>)}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
