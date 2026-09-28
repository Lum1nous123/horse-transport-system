import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TransportOverviewTabs from "@/components/TransportOverviewTabs";

const processSteps = [
  {
    number: "01",
    title: "Request",
    description: "Share the route, horses, and delivery details for your journey.",
  },
  {
    number: "02",
    title: "Quotation",
    description: "Review the transport quotation prepared for your request.",
  },
  {
    number: "03",
    title: "Documents & payment",
    description: "Complete the supported payment steps and submit horse documents for review.",
  },
  {
    number: "04",
    title: "Route",
    description: "View the planned route and its transport legs in your request.",
  },
  {
    number: "05",
    title: "Journey & delivery",
    description: "Follow progress through journey milestones and delivery updates.",
  },
];

const documentTypes = [
  "Horse Passport / Identification Document",
  "Vaccination Certificate",
  "Veterinary Health Certificate",
  "Ownership Certificate",
  "Export / Import Permit",
];

export default function Home() {
  return (
    <div className="landing-page">
      <SiteHeader currentPage="home" />
      <main id="top">
        <section className="home-hero" aria-labelledby="hero-title">
          <svg
            className="home-hero-decoration"
            viewBox="0 0 1440 650"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="home-hero-wave-primary"
              d="M 300 560 C 520 535, 655 480, 785 350 C 900 235, 970 95, 1115 55 C 1240 20, 1345 112, 1460 125 L 1460 650 L 300 650 Z"
            />
            <path
              className="home-hero-wave-secondary"
              d="M 575 560 C 750 520, 835 415, 955 300 C 1055 205, 1145 150, 1250 150 C 1340 150, 1405 220, 1460 245 L 1460 650 L 575 650 Z"
            />
            <path
              className="home-hero-route"
              d="M 330 58 C 342 27, 402 28, 458 48 S 528 74, 590 54"
            />
            <circle className="home-hero-route-start" cx="330" cy="58" r="4.5" />
            <path
              className="home-hero-route-pin"
              d="M 590 54 C 590 42, 599 33, 610 33 C 621 33, 630 42, 630 54 C 630 68, 610 87, 610 87 C 610 87, 590 68, 590 54 Z"
            />
            <circle className="home-hero-route-pin-center" cx="610" cy="53" r="5.5" />
          </svg>
          <div className="home-container home-hero-layout">
            <div className="home-hero-copy">
              <p className="home-hero-kicker">Horse Transport</p>
              <h1 id="hero-title">A clearer way to manage horse transport.</h1>
              <p className="home-hero-description">
                Organize transport requests, horse records, and journey milestones in one customer account.
              </p>
              <div className="home-hero-actions">
                <Link className="button button-primary" href="/login">
                  Create transport request <span aria-hidden="true">→</span>
                </Link>
                <Link className="home-text-link" href="/register">
                  Create account <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
            <figure className="home-hero-photo">
              <Image
                src="/images/Hero.png"
                alt="A horse travelling in a transport vehicle along a mountain road"
                fill
                priority
                sizes="(min-width: 1200px) 62vw, (min-width: 760px) 58vw, 100vw"
                className="home-image"
              />
            </figure>
          </div>
        </section>

        <TransportOverviewTabs documentTypes={documentTypes} />

        <section className="home-modes" id="services" aria-labelledby="modes-title">
          <div className="home-container">
            <div className="home-modes-heading">
              <p className="home-section-label">Transport modes</p>
              <h2 id="modes-title">Different routes. One coordinated journey.</h2>
            </div>
            <div className="home-mode-list">
              <article className="home-mode" tabIndex={0}>
                <span className="home-mode-index">01</span>
                <div>
                  <h3>Road</h3>
                  <p>Follow planned road legs, assigned vehicles, checkpoints, and recorded journey progress.</p>
                </div>
              </article>
              <article className="home-mode" tabIndex={0}>
                <span className="home-mode-index">02</span>
                <div>
                  <h3>Air</h3>
                  <p>View planned air route details and the welfare evidence recorded for the journey stage.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="home-process" id="how-it-works" aria-labelledby="process-title">
          <div className="home-container">
            <div className="home-process-heading">
              <p className="home-section-label">The process</p>
              <h2 id="process-title">From the first details to delivery.</h2>
            </div>
            <ol className="home-process-list">
              {processSteps.map((step) => (
                <li className="home-process-step" key={step.number} tabIndex={0}>
                  <span className="home-step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="home-records" id="horse-care" aria-labelledby="records-title">
          <div className="home-container home-records-layout">
            <figure className="home-records-photo">
              <Image
                src="/images/Horse%20Records.png"
                alt="A close-up portrait of a horse"
                fill
                sizes="(min-width: 1000px) 43vw, (min-width: 760px) 45vw, 100vw"
                className="home-image"
              />
            </figure>
            <div className="home-records-copy">
              <p className="home-section-label">Horse records & documents</p>
              <h2 id="records-title">The right records, close at hand.</h2>
              <p>
                Keep horse profiles together and submit the required documents for review as part of an approved transport order.
              </p>
            </div>
          </div>
        </section>

        <section className="home-documents" aria-labelledby="documents-title">
          <div className="home-container home-documents-layout">
            <div className="home-documents-heading">
              <p className="home-section-label">Document requirements</p>
              <h2 id="documents-title">Documents, clearly prepared.</h2>
              <p>Each horse in a transport order has the same required document checklist.</p>
            </div>
            <ol className="home-document-list">
              {documentTypes.map((document, index) => (
                <li key={document}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{document}</strong>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="home-journey" id="journey" aria-labelledby="journey-title">
          <div className="home-container">
            <div className="home-journey-heading">
              <div>
                <p className="home-section-label">Journey milestones</p>
                <h2 id="journey-title">Progress, at each milestone.</h2>
              </div>
              <p>
                Follow transport progress through recorded checkpoints and updates in your customer account.
              </p>
            </div>
            <figure className="home-journey-photo">
              <Image
                src="/images/Journey.png"
                alt="A horse transport truck travelling on a mountain road"
                fill
                sizes="(min-width: 1200px) 90vw, 100vw"
                className="home-image"
              />
            </figure>
          </div>
        </section>

        <section className="home-values" aria-labelledby="values-title">
          <div className="home-container">
            <h2 id="values-title">A considered way to stay organized.</h2>
            <div className="home-value-list">
              <article tabIndex={0}>
                <span className="home-value-number">01</span>
                <h3>Clear requirements</h3>
                <p>See the journey, horse, and document details connected to each request.</p>
              </article>
              <article tabIndex={0}>
                <span className="home-value-number">02</span>
                <h3>Structured progress</h3>
                <p>Follow quotation, document review, payment, and journey milestones.</p>
              </article>
              <article tabIndex={0}>
                <span className="home-value-number">03</span>
                <h3>One customer account</h3>
                <p>Keep your horse profiles and transport orders together in one place.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="home-cta" aria-labelledby="closing-title">
          <div className="home-container home-cta-content">
            <p className="home-section-label">Horse Transport</p>
            <h2 id="closing-title"><span>Ready to plan</span><span>the journey?</span></h2>
            <div className="home-cta-action-block">
              <p>Create an account or sign in to continue.</p>
              <div className="home-cta-actions">
                <Link className="button home-button-on-dark" href="/register">
                  Create account <span aria-hidden="true">→</span>
                </Link>
                <Link className="home-dark-link" href="/login">
                  Sign in <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter variant="home" />
    </div>
  );
}
