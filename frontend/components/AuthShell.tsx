import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type AuthShellProps = {
  title: string;
  headingClassName?: string;
  description: string;
  children: ReactNode;
  prompt: string;
  linkLabel: string;
  linkHref: string;
};

const capabilities = [
  "Horse records",
  "Road + Air",
  "Document workflow",
  "Journey milestones",
];

export default function AuthShell({
  title,
  headingClassName,
  description,
  children,
  prompt,
  linkLabel,
  linkHref,
}: AuthShellProps) {
  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-label="Horse Transport">
        <Image
          className="auth-visual-image"
          src="/images/Hero.png"
          alt=""
          fill
          priority
          sizes="(min-width: 900px) 54vw, 100vw"
        />
        <div className="auth-visual-content">
          <Link className="auth-brand" href="/" aria-label="Horse Transport home">
            <span className="auth-brand-mark">
              <Image src="/logo.png" alt="" width={500} height={500} priority />
            </span>
            <span className="auth-brand-name">Horse Transport</span>
          </Link>

          <div className="auth-visual-message">
            <p className="auth-visual-eyebrow">Customer account</p>
            <h2>Your journey,<br />organized in one place.</h2>
            <p>
              Transport requests, horse records, documents, and journey milestones—together in one customer account.
            </p>
          </div>

          <ul className="auth-capabilities" aria-label="Customer account capabilities">
            {capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-panel">
          <Link className="auth-mobile-brand" href="/" aria-label="Horse Transport home">
            <Image src="/logo.png" alt="" width={500} height={500} priority />
            <span>Horse Transport</span>
          </Link>
          <p className="auth-form-eyebrow">Customer account</p>
          <h1 className={headingClassName} id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <p className="auth-switch">
            {prompt} <Link href={linkHref}>{linkLabel}</Link>
          </p>
          <Link className="auth-home-link" href="/">
            <span aria-hidden="true">←</span> Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
