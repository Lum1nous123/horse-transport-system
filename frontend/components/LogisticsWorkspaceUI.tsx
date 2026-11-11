"use client";

import Link from "next/link";
import "./logistics-workspace.css";

export function LogisticsNavigation({ section, preview = false }: {
  section: "dashboard" | "orders" | "assignments" | "reviews" | "tracking"; preview?: boolean;
}) {
  const suffix = preview ? "?preview=1" : "";
  const links = [
    { href: `/logistics/dashboard${suffix}`, label: "Dashboard", current: section === "dashboard" },
    { href: `/logistics${suffix}`, label: "Orders & quotations", current: section === "orders" },
    { href: `/logistics/assignments${suffix}`, label: "Staff assignment", current: section === "assignments" },
    { href: `/logistics/route-reviews${suffix}`, label: "Route reviews", current: section === "reviews" },
    { href: `/logistics/tracking${suffix}`, label: "Journey tracking", current: section === "tracking" },
  ];
  return <nav className="lm-primary-nav" aria-label="Logistics workspaces">{links.map((link) =>
    <Link key={link.label} href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</Link>
  )}</nav>;
}

export function LogisticsStatusTabs<T extends string>({ label, tabs, value, onChange, panelId }: {
  label: string; tabs: { value: T; label: string; count: number | null }[]; value: T;
  onChange: (value: T) => void; panelId: string;
}) {
  return <div className="lm-status-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab, index) => <button key={tab.value} type="button" role="tab"
      id={`${panelId}-tab-${tab.value}`} aria-controls={panelId} aria-selected={value === tab.value}
      tabIndex={value === tab.value ? 0 : -1} onClick={() => onChange(tab.value)}
      onKeyDown={(event) => {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        onChange(tabs[next].value);
        buttons?.[next]?.focus();
      }}>
      {tab.label} <span className="lm-tab-count">{tab.count ?? "—"}</span>
    </button>)}
  </div>;
}

export function LogisticsDateTime({ value }: { value: string | null }) {
  if (!value || Number.isNaN(Date.parse(value))) return <span>Not provided</span>;
  const date = new Date(value);
  return <time className="lm-date-time" dateTime={value}>
    <span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date)}</span>
    <small>{new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(date)}</small>
  </time>;
}
