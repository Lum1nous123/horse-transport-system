"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";

const tabs = [
  "ROAD + AIR",
  "DOCUMENT WORKFLOW",
  "JOURNEY MILESTONES",
  "CUSTOMER ACCOUNT",
] as const;

type TransportOverviewTabsProps = {
  documentTypes: string[];
};

export default function TransportOverviewTabs({
  documentTypes,
}: TransportOverviewTabsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="home-transport-overview" aria-label="Horse transport overview">
      <div className="home-container">
        <div className="home-overview-tabs" role="tablist" aria-label="Transport information">
          {tabs.map((tab, index) => (
            <button
              className={`home-overview-tab${activeTab === index ? " is-active" : ""}`}
              id={`transport-overview-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={activeTab === index}
              aria-controls="transport-overview-panel"
              tabIndex={activeTab === index ? 0 : -1}
              key={tab}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onClick={() => setActiveTab(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span className="home-overview-tab-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{tab}</span>
            </button>
          ))}
        </div>

        <div
          className={`home-overview-panel${activeTab === 1 ? " home-overview-panel-documents" : ""}${activeTab === 3 ? " home-overview-panel-account" : ""}`}
          id="transport-overview-panel"
          role="tabpanel"
          aria-labelledby={`transport-overview-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 0 && (
            <div className="home-overview-layout home-overview-road-air">
              <div className="home-overview-copy">
                <p className="home-section-label">01 / A connected process</p>
                <h2>Horse transport, organized from request to delivery.</h2>
                <p className="home-overview-description">
                  Keep the details of a transport order together—from its quotation and required documents to the route and delivery milestones.
                </p>
              </div>
              <figure className="home-overview-artwork home-overview-artwork-road-air">
                <Image
                  src="/images/road_air.png"
                  alt="A horse with road and air transport routes"
                  fill
                  sizes="(min-width: 1200px) 60vw, (min-width: 760px) 56vw, 100vw"
                  className="home-overview-image home-overview-image-contain"
                  priority
                />
                <figcaption className="home-overview-callout home-overview-callout-road">
                  <strong>Road transport</strong>
                  <span>ROAD Route Legs</span>
                </figcaption>
                <div className="home-overview-callout home-overview-callout-air">
                  <strong>Air transport</strong>
                  <span>AIR Route Legs</span>
                </div>
              </figure>
            </div>
          )}

          {activeTab === 1 && (
            <div className="home-overview-layout home-overview-secondary home-overview-documents">
              <div className="home-overview-copy">
                <p className="home-section-label">02 / Document workflow</p>
                <h2>Documents, clearly prepared.</h2>
                <p className="home-overview-description">
                  Each horse in a transport order has the same required document checklist.
                </p>
                <ol className="home-overview-document-list">
                  {documentTypes.map((document, index) => (
                    <li key={document}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{document}</strong>
                    </li>
                  ))}
                </ol>
              </div>
              <figure className="home-overview-artwork home-overview-artwork-document">
                <Image
                  src="/images/document-workflow-visual.png"
                  alt="A horse beside a transport vehicle as required documents are reviewed"
                  fill
                  sizes="(min-width: 760px) 48vw, 100vw"
                  className="home-overview-image home-overview-document-image"
                />
              </figure>
            </div>
          )}

          {activeTab === 2 && (
            <div className="home-overview-layout home-overview-secondary home-overview-journey-layout">
              <div className="home-overview-copy">
                <p className="home-section-label">03 / Journey milestones</p>
                <h2>Progress, at each milestone.</h2>
                <p className="home-overview-description">
                  Follow transport progress through recorded checkpoints and updates in your customer account.
                </p>
              </div>
              <figure className="home-overview-artwork home-overview-artwork-journey">
                <Image
                  src="/images/journey-milestones-visual.png"
                  alt="Illustration of a horse transport journey with preparation, transit, and arrival milestones"
                  fill
                  sizes="(min-width: 1200px) 720px, (min-width: 760px) 60vw, 100vw"
                  className="home-overview-image home-overview-journey-image"
                />
              </figure>
            </div>
          )}

          {activeTab === 3 && (
            <div className="home-overview-account">
              <div className="home-overview-copy">
                <p className="home-section-label">04 / Customer account</p>
                <h2>Keep your transport details together.</h2>
                <p className="home-overview-description">
                  Organize transport requests, horse records, and journey milestones in one customer account.
                </p>
              </div>
              <ul className="home-overview-account-list">
                <li>
                  <span className="home-account-number">01</span>
                  <svg className="home-account-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path d="M9 4.5h9l5 5V27H9z" />
                    <path d="M18 4.5v5h5M13 15h6m-6 4h7m-7 4h7" />
                  </svg>
                  <strong>Horse profiles</strong>
                </li>
                <li>
                  <span className="home-account-number">02</span>
                  <svg className="home-account-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path d="M3.5 7h15v15h-15zM18.5 12h5l5 5v5h-10z" />
                    <circle cx="8.5" cy="24" r="2.5" />
                    <circle cx="24" cy="24" r="2.5" />
                    <path d="M7 11h8m-8 4h5" />
                  </svg>
                  <strong>Transport orders</strong>
                </li>
                <li>
                  <span className="home-account-number">03</span>
                  <svg className="home-account-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path d="M25.5 13.5c0 7-9.5 15-9.5 15s-9.5-8-9.5-15a9.5 9.5 0 1 1 19 0Z" />
                    <circle cx="16" cy="13.5" r="3.2" />
                    <path d="M3 27h4m18 0h4" />
                  </svg>
                  <strong>Journey milestones</strong>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
