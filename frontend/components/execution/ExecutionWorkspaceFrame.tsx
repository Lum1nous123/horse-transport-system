"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";
import type { DriverSession } from "@/lib/driver-execution/types";
import DriverDashboardDecor from "./DriverDashboardDecor";
import BrandMark from "@/components/BrandMark";
import ExecutionIcon from "./ExecutionIcon";
import styles from "./execution.module.css";

// Shared execution shell; mode-specific actions live in the Driver workspace.
export default function ExecutionWorkspaceFrame({ session, children, focused = false }: {
  session: DriverSession; children: ReactNode; focused?: boolean;
}) {
  const router = useRouter();
  function signOut() { clearAccessToken(); router.replace("/login"); }
  return <main className={`${styles.shell} ${focused ? "" : styles.dashboardShell}`}>
    <a className={styles.skipLink} href="#execution-content">Skip to execution work</a>
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/" aria-label="Horse Transport System home"><BrandMark className={styles.brandMark} /><span>Horse Transport System</span></Link>
      <nav className={styles.nav} aria-label="Driver workspace"><Link className={styles.navLink} href={`/driver${session.previewQuery}`} aria-current="page"><ExecutionIcon name="truck" />My ROAD work</Link></nav>
      <div className={styles.account}><span className={styles.role}><ExecutionIcon name="user" />Driver</span><button type="button" onClick={signOut}><ExecutionIcon name="signOut" />Sign out</button></div>
    </header>
    {!focused && <DriverDashboardDecor />}
    {session.preview && <div className={styles.preview} role="status"><strong>Interface preview</strong><span>Sample data for this browser session. No real journey is changed.</span></div>}
    <div id="execution-content" className={focused ? styles.focusedContent : styles.content}>{children}</div>
  </main>;
}
