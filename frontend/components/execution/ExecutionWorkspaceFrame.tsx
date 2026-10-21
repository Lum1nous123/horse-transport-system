"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAccessToken } from "@/lib/auth";
import type { DriverSession } from "@/lib/driver-execution/types";
import styles from "./execution.module.css";

// Shared execution shell; mode-specific actions live in the Driver workspace.
export default function ExecutionWorkspaceFrame({ session, children, focused = false }: {
  session: DriverSession; children: ReactNode; focused?: boolean;
}) {
  const router = useRouter();
  function signOut() { clearAccessToken(); router.replace("/login"); }
  return <main className={styles.shell}>
    <a className={styles.skipLink} href="#execution-content">Skip to execution work</a>
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/"><span className={styles.brandMark}>HT</span><span>Horse Transport System</span></Link>
      <nav aria-label="Driver workspace"><Link className={styles.navLink} href={`/driver${session.previewQuery}`}>My ROAD work</Link></nav>
      <div className={styles.account}><span>{session.fullName} <span className={styles.accountRole}>· Driver</span></span><button type="button" onClick={signOut}>Sign out</button></div>
    </header>
    {session.preview && <div className={styles.preview} role="status"><strong>Interface preview</strong><span>Sample data for this browser session. No real journey is changed.</span></div>}
    <div id="execution-content" className={focused ? styles.focusedContent : styles.content}>{children}</div>
  </main>;
}
