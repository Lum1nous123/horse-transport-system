"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CUSTOMER_TERMS_INTRO, CUSTOMER_TERMS_SECTIONS } from "@/lib/customer-terms";

type LoginNoticeProps = {
  mode: "LOGIN_NOTICE";
  onClose: (hideOnFutureLogins: boolean) => void;
};

type DepositConfirmationProps = {
  mode: "DEPOSIT_CONFIRMATION";
  onClose: () => void;
  onAgree: () => void;
};

type CustomerTermsModalProps = LoginNoticeProps | DepositConfirmationProps;

export default function CustomerTermsModal(props: CustomerTermsModalProps) {
  const [checked, setChecked] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isDeposit = props.mode === "DEPOSIT_CONFIRMATION";

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
            <h2 id={titleId}>Transport Terms &amp; Important Notices</h2>
            <p id={descriptionId}>
              {isDeposit
                ? "Review and accept this important information before continuing to Deposit payment."
                : "Important information to review before using our transport service."}
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
          <div className="customer-terms-intro">
            {CUSTOMER_TERMS_INTRO.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
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
        </div>

        <footer className={`customer-terms-footer ${isDeposit ? "deposit-mode" : "login-mode"}`}>
          <label className="customer-terms-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              {isDeposit
                ? "I have read and agree to the Transport Terms & Important Notices."
                : "Don't show again"}
            </span>
          </label>

          <div className="customer-terms-actions">
            {isDeposit ? (
              <>
                <button className="customer-secondary-button" type="button" onClick={props.onClose}>
                  Cancel
                </button>
                <button
                  className="customer-primary-button"
                  type="button"
                  disabled={!checked}
                  onClick={props.onAgree}
                >
                  Agree &amp; Continue to Payment
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
