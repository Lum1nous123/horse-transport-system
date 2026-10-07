"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyTransportSpecialistReviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/transport-specialist${window.location.search}`);
  }, [router]);

  return <main className="customer-page assignment-access-state"><p role="status">Opening your assigned Orders…</p></main>;
}
