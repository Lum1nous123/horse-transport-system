import Image from "next/image";
import Link from "next/link";
import LandingMascot from "@/components/LandingMascot";

type SiteHeaderProps = {
  currentPage: "home" | "login";
};

export default function SiteHeader({ currentPage }: SiteHeaderProps) {
  return (
    <header className={`site-header${currentPage === "home" ? " site-header-home" : ""}`}>
      <div className="content-container header-content">
        <Link className="brand-link" href="/" aria-label="Horse Transport home">
          <Image
            src="/logo.png"
            alt="Horse Transport logo"
            width={500}
            height={500}
            priority
            className="brand-image"
          />
          <span className="brand-copy">
            <span className="brand-name">Horse Transport</span>
            {currentPage === "home" && (
              <span className="brand-tagline">Equine Logistics</span>
            )}
          </span>
        </Link>

        {currentPage === "home" && (
          <nav className="home-anchor-navigation" aria-label="Landing page sections">
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#horse-care">Horse care</a>
            <a href="#journey">Journey</a>
            <LandingMascot />
          </nav>
        )}
        <nav
          className="site-navigation"
          aria-label={currentPage === "home" ? "Account navigation" : "Main navigation"}
        >
          {currentPage === "home" ? (
            <Link className="nav-link" href="/login">
              Sign in
            </Link>
          ) : (
            <Link className="nav-link" href="/">
              Home
            </Link>
          )}
          <Link className="button button-primary header-cta" href="/register">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
