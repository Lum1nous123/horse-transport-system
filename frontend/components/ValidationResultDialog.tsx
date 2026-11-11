"use client";

import { useEffect, useRef, useState } from "react";

type ValidationDialogIssue = {
  label: string;
  message: string;
};

type ValidationResultDialogProps = {
  kind: "success" | "attention";
  eyebrow: string;
  title: string;
  message: string;
  issueCount?: number;
  issues?: ValidationDialogIssue[];
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
};

export default function ValidationResultDialog({
  kind,
  eyebrow,
  title,
  message,
  issueCount = 0,
  issues = [],
  actionLabel,
  onAction,
  onClose,
}: ValidationResultDialogProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const [showIssues, setShowIssues] = useState(false);

  useEffect(() => {
    primaryButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="frc-validation-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`frc-validation-dialog is-${kind}`} role="dialog" aria-modal="true" aria-labelledby="frc-validation-dialog-title" aria-describedby="frc-validation-dialog-description">
        <span className="frc-validation-dialog-icon" aria-hidden="true">{kind === "success" ? "✓" : "!"}</span>
        <p className="frc-validation-dialog-eyebrow">{eyebrow}</p>
        <h2 id="frc-validation-dialog-title">{title}</h2>
        <p id="frc-validation-dialog-description">{message}</p>
        {kind === "attention" && issueCount > 0 && <strong className="frc-validation-dialog-count">{issueCount} {issueCount === 1 ? "issue" : "issues"} found</strong>}
        {showIssues && issues.length > 0 && <ul className="frc-validation-dialog-issues" aria-label="Validation issues">{issues.map((issue, index) => <li key={`${issue.label}-${index}`}><span aria-hidden="true">{index + 1}</span><div><strong>{issue.label}</strong><p>{issue.message}</p></div></li>)}</ul>}
        <div className="frc-validation-dialog-actions">
          {onAction && <button className="customer-secondary-button" type="button" onClick={onClose}>Not now</button>}
          <button ref={primaryButtonRef} className="customer-primary-button" type="button" onClick={onAction ?? (kind === "attention" && issues.length > 0 && !showIssues ? () => setShowIssues(true) : onClose)}>{actionLabel ?? (kind === "success" ? "Done" : showIssues ? "Close" : "Review issues")}</button>
        </div>
      </section>
    </div>
  );
}
