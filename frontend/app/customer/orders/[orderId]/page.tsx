"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { clearAccessToken } from "@/lib/auth";
import {
  CustomerRefundError,
  getCustomerRefundService,
  type CustomerRefundPreviewScenario,
  type CustomerRefundResult,
  type RefundStatus,
} from "@/lib/customer-refund/service";
import { useCustomerRefundAccess } from "@/lib/customer-refund/use-customer-refund-access";

const supportedScenarios: CustomerRefundPreviewScenario[] = [
  "refunded",
  "processing",
  "failed",
  "error",
  "unavailable",
];

function getPreviewScenario(): CustomerRefundPreviewScenario {
  if (typeof window === "undefined") return "refunded";
  const value = new URLSearchParams(window.location.search).get("scenario");
  return supportedScenarios.includes(value as CustomerRefundPreviewScenario)
    ? value as CustomerRefundPreviewScenario
    : "refunded";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function stateContent(status: RefundStatus) {
  if (status === "REFUNDED") {
    return {
      symbol: "✓",
      title: "The document deadline was missed",
      message: "Your full deposit has been refunded",
    };
  }
  if (status === "FAILED") {
    return {
      symbol: "!",
      title: "Refund needs attention",
      message: "We could not confirm the refund yet. The system will continue checking its status.",
    };
  }
  return {
    symbol: "◷",
    title: "The document deadline was missed",
    message: "Your full deposit refund is processing",
  };
}

export default function CustomerRefundResultPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { state: accessState, preview, message: accessMessage } = useCustomerRefundAccess();
  const [result, setResult] = useState<CustomerRefundResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadResult = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setErrorCode("");
    setFeedback("");
    try {
      const service = getCustomerRefundService(preview, getPreviewScenario());
      const next = refresh
        ? await service.refreshResult(params.orderId)
        : await service.getResult(params.orderId);
      setResult(next);
      if (refresh) setFeedback("Cancellation and refund status refreshed.");
    } catch (caught) {
      if (!refresh) setResult(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this cancellation and refund result.");
      setErrorCode(caught instanceof CustomerRefundError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.orderId, preview]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadResult(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadResult]);

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  if (accessState === "checking") {
    return <main className="customer-page refund-access-state"><p role="status">Checking Customer access…</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page refund-access-state">
        <section className="refund-access-card" role="alert">
          <p className="customer-eyebrow">ORDER UNAVAILABLE</p>
          <h1>{accessState === "forbidden" ? "You can't view this Order" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <Link className="customer-primary-button" href={preview ? "/customer?preview=1" : "/customer"}>Back to My Orders</Link>
        </section>
      </main>
    );
  }

  const backHref = preview ? "/customer?preview=1" : "/customer";
  const content = result ? stateContent(result.refund.status) : null;

  return (
    <main className="customer-page refund-result-page">
      <header className="customer-topbar refund-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span>
          <span>Horse Transport System</span>
        </Link>
        <nav className="refund-topbar-nav" aria-label="Customer workspace">
          <Link href={backHref} aria-current="page">My Orders</Link>
        </nav>
        <div className="customer-topbar-actions">
          <span>Customer workspace</span>
          <button type="button" className="customer-link-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="customer-content refund-result-content">
        {preview && (
          <div className="customer-preview-banner refund-preview-banner" role="status">
            <strong>Preview mode</strong>
            <span>Sample cancellation, refund, and notification data only. No backend request is sent.</span>
          </div>
        )}

        <nav className="refund-breadcrumb" aria-label="Breadcrumb">
          <Link href={backHref}>My Orders</Link><span aria-hidden="true">/</span><span aria-current="page">{result?.order.orderCode ?? "Cancellation & refund"}</span>
        </nav>

        {loading ? (
          <div className="refund-detail-skeleton" role="status" aria-label="Loading cancellation and refund result"><span /><span /><span /></div>
        ) : !result ? (
          <section className="refund-unavailable" role="alert">
            <span className="refund-unavailable-symbol" aria-hidden="true">!</span>
            <p className="customer-eyebrow">RESULT UNAVAILABLE</p>
            <h1>{errorCode === "NOT_FOUND" ? "This result is no longer available" : "We couldn't load this result"}</h1>
            <p>{error}</p>
            <div>
              <Link className="customer-primary-button" href={backHref}>Back to My Orders</Link>
              {errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadResult()}>Try again</button>}
            </div>
          </section>
        ) : (
          <>
            <header className="refund-page-heading">
              <div>
                <h1>Order cancelled</h1>
                <p>{result.order.origin} <span aria-hidden="true">→</span> {result.order.destination}</p>
                <span>Order ID: {result.order.orderCode} <b aria-hidden="true">·</b> Created {formatDateTime(result.order.createdAt)}</span>
              </div>
              <div className="refund-heading-actions">
                <Link className="customer-secondary-button" href={backHref}>← Back to My Orders</Link>
                <button className="customer-primary-button" type="button" disabled={refreshing} onClick={() => void loadResult(true)}>{refreshing ? "Refreshing…" : "↻ Refresh status"}</button>
              </div>
            </header>

            {feedback && <p className="customer-feedback refund-feedback" role="status">{feedback}</p>}
            {error && <div className="customer-alert refund-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => void loadResult(true)}>Try again</button></div>}

            <section className={`refund-result-banner is-${result.refund.status.toLowerCase()}`} aria-labelledby="refund-result-title">
              <span className="refund-result-symbol" aria-hidden="true">{content?.symbol}</span>
              <div><h2 id="refund-result-title">{content?.title}</h2><p>{content?.message}</p></div>
              <span className="refund-status-pill">{result.refund.status === "REFUNDED" ? "Refunded" : result.refund.status === "PROCESSING" ? "Processing" : "Failed"}</span>
            </section>

            <div className="refund-result-grid">
              <section className="refund-timeline-panel" aria-labelledby="what-happened-title">
                <h2 id="what-happened-title">What happened</h2>
                <ol className="refund-timeline">
                  {result.timeline.map((item) => <li className={`is-${item.state}`} key={item.id}><span className="refund-timeline-mark" aria-hidden="true">{item.state === "complete" ? "✓" : item.state === "attention" ? "!" : "◷"}</span><div><strong>{item.label}</strong><time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time><p>{item.description}</p></div></li>)}
                </ol>
              </section>

              <section className="refund-details-panel" aria-labelledby="refund-details-title">
                <h2 id="refund-details-title">Refund details</h2>
                <div className={`refund-amount-summary is-${result.refund.status.toLowerCase()}`}><span>{result.refund.status === "REFUNDED" ? "Refunded" : result.refund.status === "PROCESSING" ? "Processing" : "Failed"}</span><strong>{formatMoney(result.refund.amount, result.refund.currency)}</strong></div>
                <dl>
                  <div><dt>Refund amount</dt><dd>{formatMoney(result.refund.amount, result.refund.currency)}</dd></div>
                  <div><dt>Payment method</dt><dd>{result.refund.paymentMethodLabel}</dd></div>
                  <div><dt>Refund status</dt><dd><span className={`refund-inline-status is-${result.refund.status.toLowerCase()}`}>{result.refund.status === "REFUNDED" ? "Refunded" : result.refund.status === "PROCESSING" ? "Processing" : "Failed"}</span></dd></div>
                  {result.refund.reference && <div><dt>Refund reference</dt><dd>{result.refund.reference}</dd></div>}
                  <div><dt>{result.refund.completedAt ? "Refund completed" : "Last checked"}</dt><dd>{formatDateTime(result.refund.completedAt ?? result.refund.lastCheckedAt)}</dd></div>
                </dl>
                {result.refund.status === "PROCESSING" && <p className="refund-state-note">Most refunds appear on the original payment method within 5–10 business days.</p>}
                {result.refund.status === "FAILED" && <p className="refund-state-note is-warning">No action is required from you. The system will continue checking this refund.</p>}
              </section>
            </div>

            <section className="refund-updates-panel" aria-labelledby="updates-title">
              <div><h2 id="updates-title">Updates</h2><p>Automatic notices for this cancellation and refund.</p></div>
              <ul>{result.updates.map((update) => <li key={update.id}><span className={`refund-update-mark is-${update.tone}`} aria-hidden="true">{update.tone === "success" ? "✓" : update.tone === "warning" ? "!" : "i"}</span><div><strong>{update.title}</strong><p>{update.message}</p></div><time dateTime={update.createdAt}>{formatDateTime(update.createdAt)}</time></li>)}</ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
