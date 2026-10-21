"use client";

import Link from "next/link";
import { useDriverSession } from "@/lib/driver-execution/use-driver-session";
import DriverWorkspace from "./DriverWorkspace";
import styles from "./execution.module.css";

export default function DriverAccess({ executionId }: { executionId?: string }) {
  const access = useDriverSession();
  if (access.status === "allowed") return <DriverWorkspace session={access.session} executionId={executionId} />;
  return <main className={styles.accessPage}><section className={styles.accessCard}>
    <span className={styles.brandMark}>HT</span>
    {access.status === "checking" ? <p role="status">Checking your Driver account…</p> : <>
      <h1>{access.status === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1>
      <p role="alert">{access.message}</p>
      {access.status === "failed" && <button type="button" className={styles.primaryButton} onClick={access.retry}>Try again</button>}
      <Link className={styles.secondaryButton} href="/login">Return to sign in</Link>
    </>}
  </section></main>;
}
