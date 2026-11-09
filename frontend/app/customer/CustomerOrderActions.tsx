"use client";

import Link from "next/link";

export type CustomerOrderAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  secondary?: boolean;
};

export default function CustomerOrderActions({ orderCode, actions }: {
  orderCode: string; actions: CustomerOrderAction[];
}) {
  if (!actions.length) return null;
  const [primary, ...secondary] = actions;
  const renderAction = (action: CustomerOrderAction, prominent: boolean) => {
    const className = prominent && !action.secondary
      ? "customer-primary-button compact" : "customer-secondary-button compact";
    return action.href
      ? <Link className={className} href={action.href} key={action.label}>{action.label}</Link>
      : <button className={className} type="button" key={action.label} onClick={action.onClick}>{action.label}</button>;
  };
  return <div className="customer-order-actions customer-request-actions">
    {renderAction(primary, true)}
    {secondary.length > 0 && <details className="customer-more-actions" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary>More actions<span className="sr-only"> for {orderCode}</span></summary>
      <div className="customer-secondary-actions" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) {
          const details = event.currentTarget.parentElement as HTMLDetailsElement;
          details.open = false;
          details.querySelector("summary")?.focus();
        }
      }}>{secondary.map((action) => renderAction(action, false))}</div>
    </details>}
  </div>;
}
