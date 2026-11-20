"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CUSTOMER_TERMS_SECTIONS, CUSTOMER_TERMS_SUMMARY, CUSTOMER_TERMS_TITLE, CUSTOMER_TERMS_VERSION } from "@/lib/customer-terms";

type LoginNoticeProps = {
  mode: "LOGIN_NOTICE";
  onClose: (hideOnFutureLogins: boolean) => void;
};

type DepositConfirmationProps = {
  mode: "DEPOSIT_CONFIRMATION";
  onClose: () => void;
  onAgree: () => void;
};

type OrderSubmissionProps = {
  mode: "ORDER_SUBMISSION";
  onClose: () => void;
  onAgree: () => void;
};

type CustomerTermsModalProps = LoginNoticeProps | DepositConfirmationProps | OrderSubmissionProps;

export default function CustomerTermsModal(props: CustomerTermsModalProps) {
  const [checked, setChecked] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isDeposit = props.mode === "DEPOSIT_CONFIRMATION";
  const requiresAcknowledgement = isDeposit || props.mode === "ORDER_SUBMISSION";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (props.mode === "LOGIN_NOTICE") props.onClose(checked);
      else props.onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [checked, props]);

  function closeModal() {
    if (props.mode === "LOGIN_NOTICE") props.onClose(checked);
    else props.onClose();
  }

  function cancelAcknowledgement() {
    if (props.mode === "LOGIN_NOTICE") props.onClose(checked);
    else props.onClose();
  }

  return (
    <div
      className="customer-terms-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        className="customer-terms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="customer-terms-header">
          <div>
            <h2 id={titleId}>{CUSTOMER_TERMS_TITLE}</h2>
            <p id={descriptionId}>
              {CUSTOMER_TERMS_VERSION} · Applies to transport requests submitted through Horse Transport System.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className="customer-dialog-close"
            type="button"
            aria-label="Close Transport Terms and Important Notices"
            onClick={closeModal}
          >
            &times;
          </button>
        </header>

        <div className="customer-terms-content">
          <section className="customer-terms-summary" aria-label="Policy summary">
            <h3>Before you submit</h3>
            <ul>{CUSTOMER_TERMS_SUMMARY.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <details className="customer-terms-full">
            <summary>Read the full policy</summary>
            <div className="customer-terms-sections">
            {CUSTOMER_TERMS_SECTIONS.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                {section.blocks.map((block, blockIndex) =>
                  block.type === "paragraph" ? (
                    <p key={`${section.title}-paragraph-${blockIndex}`}>{block.text}</p>
                  ) : (
                    <ul key={`${section.title}-list-${blockIndex}`}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            ))}
            </div>
          </details>
        </div>

        <footer className={`customer-terms-footer ${requiresAcknowledgement ? "acknowledgement-mode" : "login-mode"}`}>
          <label className="customer-terms-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              {requiresAcknowledgement
                ? "I have read the Horse Transport Service and Incident Policy, Version 1.0. I confirm that the information in my transport request is accurate and understand that the requested delivery date is a planning preference unless the company separately confirms a commitment."
                : "Don't show again"}
            </span>
          </label>

          <div className="customer-terms-actions">
            {requiresAcknowledgement ? (
              <>
                <button className="customer-secondary-button" type="button" onClick={cancelAcknowledgement}>
                  {props.mode === "ORDER_SUBMISSION" ? "Go back" : "Cancel"}
                </button>
                <button
                  className="customer-primary-button"
                  type="button"
                  disabled={!checked}
                  onClick={() => { if ("onAgree" in props) props.onAgree(); }}
                >
                  {props.mode === "ORDER_SUBMISSION" ? "Acknowledge & Continue" : "Agree & Continue to Payment"}
                </button>
              </>
            ) : (
              <button className="customer-primary-button" type="button" onClick={closeModal}>
                Got it
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
