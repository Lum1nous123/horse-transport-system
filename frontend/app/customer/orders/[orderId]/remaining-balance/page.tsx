"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clearAccessToken } from "@/lib/auth";
import {
  CustomerRemainingBalanceError,
  getCustomerRemainingBalanceService,
  type CustomerRemainingBalancePreviewScenario,
  type CustomerRemainingBalanceResult,
} from "@/lib/customer-remaining-balance/service";
import { useCustomerRemainingBalanceAccess } from "@/lib/customer-remaining-balance/use-customer-remaining-balance-access";

const supportedScenarios: CustomerRemainingBalancePreviewScenario[] = [
  "eligible",
  "pending",
  "paid",
  "cancelled",
  "ineligible",
  "stale",
  "error",
  "unavailable",
];

function getPreviewScenario(): CustomerRemainingBalancePreviewScenario {
  if (typeof window === "undefined") return "eligible";
  const value = new URLSearchParams(window.location.search).get("scenario");
  return supportedScenarios.includes(value as CustomerRemainingBalancePreviewScenario)
    ? value as CustomerRemainingBalancePreviewScenario
    : "eligible";
}

function getReturnIntent() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("returned");
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
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

function paymentLabel(result: CustomerRemainingBalanceResult) {
  if (result.payment.status === "PAID") return "Paid";
  if (result.payment.status === "PENDING") return "Verification pending";
  if (result.payment.latestAttemptStatus === "CANCELLED") return "Checkout cancelled";
  if (result.payment.latestAttemptStatus === "EXPIRED") return "Checkout expired";
  if (result.eligibility.status === "INELIGIBLE") return "Not eligible";
  return "Ready for payment";
}

export default function CustomerRemainingBalancePage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { state: accessState, preview, message: accessMessage } = useCustomerRemainingBalanceAccess();
  const scenario = preview ? getPreviewScenario() : "eligible";
  const service = useMemo(
    () => getCustomerRemainingBalanceService(preview, scenario),
    [preview, scenario],
  );
  const [result, setResult] = useState<CustomerRemainingBalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutPreviewOpen, setCheckoutPreviewOpen] = useState(false);
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
      const next = refresh
        ? await service.refreshResult(params.orderId)
        : await service.getResult(params.orderId);
      setResult(next);
      if (refresh) {
        setFeedback(next.payment.status === "PAID"
          ? "Payment status refreshed. The Remaining Balance is confirmed as paid."
          : "Payment status refreshed from the persisted payment record.");
      } else if (getReturnIntent() === "success") {
        setFeedback("You returned from secure checkout. Payment is not assumed successful; the persisted status is shown below.");
      } else if (getReturnIntent() === "cancelled") {
        setFeedback("Checkout was closed before payment completed. No payment was recorded.");
      }
    } catch (caught) {
      if (!refresh) setResult(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this Remaining Balance.");
      setErrorCode(caught instanceof CustomerRemainingBalanceError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.orderId, service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadResult(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadResult]);

  useEffect(() => {
    if (!checkoutPreviewOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCheckoutPreviewOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [checkoutPreviewOpen]);

  async function startCheckout() {
    setCheckoutBusy(true);
    setError("");
    setFeedback("");
    try {
      const checkout = await service.createCheckout(params.orderId);
      if (!checkout.checkoutUrl) throw new Error("Secure checkout could not be opened. Please try again.");
      if (preview) {
        setCheckoutPreviewOpen(true);
        setCheckoutBusy(false);
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't start secure checkout.");
      setErrorCode(caught instanceof CustomerRemainingBalanceError ? caught.code : "REQUEST_FAILED");
      setCheckoutBusy(false);
    }
  }

  function finishPreviewCheckout(outcome: "success" | "cancelled") {
    const nextScenario = outcome === "success" ? "pending" : "cancelled";
    setCheckoutPreviewOpen(false);
    router.push(
      `/customer/orders/${params.orderId}/remaining-balance?preview=1&scenario=${nextScenario}&returned=${outcome}`,
    );
  }

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  const backHref = preview ? "/customer?preview=1" : "/customer";

  if (accessState === "checking") {
    return <main className="customer-page balance-access-state"><p role="status">Checking Customer access...</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page balance-access-state">
        <section className="balance-access-card" role="alert">
          <span className="balance-state-symbol is-error" aria-hidden="true">!</span>
          <h1>{accessState === "forbidden" ? "You can't view this Order" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <Link className="customer-primary-button" href={backHref}>Back to My Orders</Link>
        </section>
      </main>
    );
  }

  const statusClass = result
    ? result.payment.status === "PAID"
      ? "is-paid"
      : result.payment.status === "PENDING"
        ? "is-pending"
        : result.payment.latestAttemptStatus === "CANCELLED"
          ? "is-cancelled"
          : result.eligibility.status === "INELIGIBLE"
            ? "is-ineligible"
            : "is-ready"
    : "";

  return (
    <main className="customer-page balance-page">
      <header className="customer-topbar balance-topbar">
        <Link className="customer-brand" href="/" aria-label="Horse Transport System home">
          <span className="customer-brand-mark" aria-hidden="true">HT</span>
          <span>Horse Transport System</span>
        </Link>
        <nav className="balance-topbar-nav" aria-label="Customer workspace">
          <Link href={backHref} aria-current="page">My Orders</Link>
        </nav>
        <div className="customer-topbar-actions">
          <span>Customer workspace</span>
          <button type="button" className="customer-link-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="customer-content balance-content">
        {preview && (
          <div className="customer-preview-banner balance-preview-banner" role="status">
            <strong>Preview mode</strong>
            <span>Sample Remaining Balance and checkout data only. No backend or payment provider is contacted.</span>
          </div>
        )}

        <nav className="balance-breadcrumb" aria-label="Breadcrumb">
          <Link href={backHref}>My Orders</Link>
          <span aria-hidden="true">/</span>
          <span>{result?.order.orderCode ?? "Order"}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Remaining balance</span>
        </nav>

        {loading ? (
          <div className="balance-detail-skeleton" role="status" aria-label="Loading Remaining Balance"><span /><span /><span /></div>
        ) : !result ? (
          <section className="balance-unavailable" role="alert">
            <span className="balance-state-symbol is-error" aria-hidden="true">!</span>
            <h1>{errorCode === "STALE"
              ? "This payment status changed"
              : errorCode === "NOT_FOUND"
                ? "Remaining Balance unavailable"
                : "We couldn't load this payment"}</h1>
            <p>{error}</p>
            <div>
              <Link className="customer-primary-button" href={backHref}>Back to My Orders</Link>
              {errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadResult()}>Try again</button>}
            </div>
          </section>
        ) : (
          <>
            <header className="balance-page-heading">
              <div>
                <span className="balance-heading-label">Transport payment</span>
                <h1>Complete your transport payment</h1>
                <p>{result.order.origin} <span aria-hidden="true">-&gt;</span> {result.order.destination}</p>
                <small>{result.order.orderCode} · {result.order.horseCount} {result.order.horseCount === 1 ? "horse" : "horses"} · {result.order.transportMode} · Departure {formatDateTime(result.order.departureAt)}</small>
              </div>
              <Link className="customer-secondary-button" href={backHref}>Back to My Orders</Link>
            </header>

            {feedback && <p className="customer-feedback balance-feedback" role="status">{feedback}</p>}
            {error && <div className="customer-alert balance-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => void loadResult(true)}>Refresh status</button></div>}

            <section className="balance-journey" aria-labelledby="balance-journey-title">
              <div className="balance-journey-heading">
                <div><h2 id="balance-journey-title">Order journey</h2><p>Your documents are confirmed. The final payment is the current step.</p></div>
                <span className={`balance-status-pill ${statusClass}`}>{paymentLabel(result)}</span>
              </div>
              <ol>
                {result.journey.map((step, index) => (
                  <li className={`is-${step.state}`} key={step.id}>
                    <div className="balance-journey-marker"><span aria-hidden="true">{step.state === "complete" ? "✓" : index + 1}</span></div>
                    <div><strong>{step.label}</strong><span>{step.detail}</span></div>
                  </li>
                ))}
              </ol>
            </section>

            <div className="balance-main-grid">
              <section className="balance-progress" aria-labelledby="balance-progress-title">
                <div className="balance-confirmed-callout">
                  <span className="balance-state-symbol is-confirmed" aria-hidden="true">✓</span>
                  <div>
                    <span>Documents confirmed</span>
                    <h2 id="balance-progress-title">Payment is now available</h2>
                    <p>{result.eligibility.message}</p>
                  </div>
                </div>
                <div className="balance-progress-list">
                  <h3>Recent progress</h3>
                  <ol>
                    {result.recentProgress.map((item) => (
                      <li key={item.id}>
                        <span className="balance-progress-check" aria-hidden="true">✓</span>
                        <div><strong>{item.label}</strong><p>{item.description}</p><time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time></div>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <aside className={`balance-summary ${statusClass}`} aria-labelledby="balance-summary-title">
                <div className="balance-summary-heading">
                  <div><span>Amount due</span><h2 id="balance-summary-title">Remaining balance</h2></div>
                  <span className={`balance-status-pill ${statusClass}`}>{paymentLabel(result)}</span>
                </div>
                <div className="balance-amount">
                  <strong>{formatMoney(result.quotation.remainingAmount, result.quotation.currency)}</strong>
                  <span>{result.quotation.currency}</span>
                </div>
                <dl className="balance-breakdown">
                  <div><dt>Quotation total</dt><dd>{formatMoney(result.quotation.totalAmount, result.quotation.currency)}</dd></div>
                  <div><dt>Deposit paid</dt><dd>-{formatMoney(result.quotation.depositPaid, result.quotation.currency)}</dd></div>
                  <div><dt>Remaining balance</dt><dd>{formatMoney(result.quotation.remainingAmount, result.quotation.currency)}</dd></div>
                </dl>

                {result.payment.status === "PAID" ? (
                  <div className="balance-paid-result" role="status">
                    <span className="balance-state-symbol is-confirmed" aria-hidden="true">✓</span>
                    <div><strong>Payment confirmed</strong><p>Confirmed {formatDateTime(result.payment.paidAt ?? result.payment.lastCheckedAt)}{result.payment.reference ? ` · ${result.payment.reference}` : ""}</p></div>
                  </div>
                ) : result.payment.status === "PENDING" ? (
                  <>
                    <div className="balance-pending-note" role="status"><strong>Verification in progress</strong><p>The return from checkout is not proof of payment. Refresh to read the persisted payment status.</p></div>
                    <button className="customer-primary-button balance-checkout-button" type="button" disabled={refreshing} onClick={() => void loadResult(true)}>{refreshing ? "Checking persisted status..." : "Refresh payment status"}</button>
                  </>
                ) : result.eligibility.status === "INELIGIBLE" ? (
                  <div className="balance-ineligible-note" role="status"><strong>Payment is not available</strong><p>The server-reported Order state is not eligible for Remaining Balance checkout.</p></div>
                ) : (
                  <>
                    {result.payment.latestAttemptStatus === "CANCELLED" && <div className="balance-cancelled-note" role="status"><strong>Checkout wasn&apos;t completed</strong><p>No payment was recorded. You can safely open a new checkout session.</p></div>}
                    <button className="customer-primary-button balance-checkout-button" type="button" disabled={checkoutBusy} onClick={() => void startCheckout()}>{checkoutBusy ? "Opening secure checkout..." : result.payment.latestAttemptStatus === "CANCELLED" ? "Retry secure checkout" : "Continue to secure checkout"}</button>
                  </>
                )}

                <p className="balance-security-note"><span aria-hidden="true">↗</span> Card details are entered with the payment provider, not in Horse Transport System.</p>
                <p className="balance-last-checked">Last checked {formatDateTime(result.payment.lastCheckedAt)}</p>
              </aside>
            </div>

            <section className="balance-next-steps" aria-labelledby="balance-next-title">
              <div><h2 id="balance-next-title">What happens next</h2><p>The payment service remains the source of truth after checkout.</p></div>
              <ol>
                <li><span>1</span><div><strong>Open secure checkout</strong><p>Continue to the payment provider to enter payment details.</p></div></li>
                <li><span>2</span><div><strong>Return to this Order</strong><p>A success or cancel return only tells us where to send you next.</p></div></li>
                <li><span>3</span><div><strong>Read the confirmed result</strong><p>This page refreshes the persisted payment state before showing Paid.</p></div></li>
              </ol>
            </section>
          </>
        )}
      </div>

      {checkoutPreviewOpen && result && (
        <div className="balance-checkout-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutPreviewOpen(false); }}>
          <section className="balance-checkout-preview" role="dialog" aria-modal="true" aria-labelledby="checkout-preview-title">
            <button className="balance-checkout-close" type="button" aria-label="Close secure checkout preview" onClick={() => setCheckoutPreviewOpen(false)}>×</button>
            <span className="balance-preview-chip">Preview only</span>
            <h2 id="checkout-preview-title">Simulated secure checkout</h2>
            <p>The real flow will redirect to the third-party payment page returned by BE-14. This preview never collects card details.</p>
            <div className="balance-checkout-preview-amount"><span>Remaining balance</span><strong>{formatMoney(result.quotation.remainingAmount, result.quotation.currency)} {result.quotation.currency}</strong></div>
            <div className="balance-checkout-preview-actions">
              <button className="customer-primary-button" type="button" onClick={() => finishPreviewCheckout("success")}>Simulate successful return</button>
              <button className="customer-secondary-button" type="button" onClick={() => finishPreviewCheckout("cancelled")}>Simulate cancelled return</button>
            </div>
            <small>Neither option proves payment. The Order page reads the mock persisted state after return.</small>
          </section>
        </div>
      )}
    </main>
  );
}
