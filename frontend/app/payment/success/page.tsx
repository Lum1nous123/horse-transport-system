import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <main className="payment-return-page">
      <section className="payment-return-card" aria-labelledby="payment-return-title">
        <span className="payment-return-mark pending" aria-hidden="true">…</span>
        <p className="customer-eyebrow">DEPOSIT CHECKOUT</p>
        <h1 id="payment-return-title">We’re confirming your payment</h1>
        <p>Your payment provider sent the checkout result. The order updates after the payment service confirms it.</p>
        <Link className="customer-primary-button" href="/customer">Return to Customer workspace</Link>
      </section>
    </main>
  );
}
