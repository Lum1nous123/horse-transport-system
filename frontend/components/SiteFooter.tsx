import Image from "next/image";
import Link from "next/link";

type SiteFooterProps = {
  variant?: "default" | "home";
};

export default function SiteFooter({ variant = "default" }: SiteFooterProps) {
  if (variant === "home") {
    return (
      <footer className="site-footer site-footer-home">
        <div className="footer-home-main">
          <div className="footer-home-brand-area">
            <Link className="footer-home-logo" href="/" aria-label="Horse Transport home">
              <Image
                src="/logo.png"
                alt=""
                width={500}
                height={500}
                className="footer-brand-image"
              />
            </Link>
            <span className="footer-brand-divider" aria-hidden="true" />
            <span className="footer-brand-name">
              <span>Horse</span>
              <span>Transport</span>
            </span>
          </div>
          <div className="footer-home-navigation">
            <div className="footer-home-column">
              <h2>Navigate</h2>
              <nav aria-label="Footer section navigation">
                <a href="#services">Services</a>
                <a href="#how-it-works">How it works</a>
                <a href="#horse-care">Horse care</a>
                <a href="#journey">Journey</a>
              </nav>
            </div>
            <div className="footer-home-column">
              <h2>Account</h2>
              <nav aria-label="Footer account navigation">
                <Link href="/login">Sign in</Link>
                <Link href="/register">Create account</Link>
              </nav>
            </div>
          </div>
        </div>
        <div className="footer-home-bottom">
          <div className="home-container footer-home-bottom-inner">
            <span>Horse Transport</span>
            <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="site-footer">
      <div className="content-container footer-content">
        <span className="footer-brand">Horse Transport</span>
        <nav className="footer-navigation" aria-label="Footer navigation">
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create account</Link>
        </nav>
      </div>
    </footer>
  );
}
