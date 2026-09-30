import Link from "next/link";

export default function PaymentCancelledPage() {
  return (
    <main className="payment-return-page">
      <section className="payment-return-card" aria-labelledby="payment-return-title">
        <span className="payment-return-mark cancelled" aria-hidden="true">↩</span>
        <p className="customer-eyebrow">DEPOSIT CHECKOUT</p>
        <h1 id="payment-return-title">Checkout wasn’t completed</h1>
        <p>Your order is still awaiting the deposit. Open its bill in the Customer workspace to try checkout again.</p>
        <Link className="customer-primary-button" href="/customer">Return to Customer workspace</Link>
      </section>
    </main>
  );
}
