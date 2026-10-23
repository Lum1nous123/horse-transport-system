import { Suspense } from "react";
import JourneyTrackingView from "@/components/JourneyTrackingView";

export default function CustomerJourneyPage() {
  return <Suspense fallback={<main>Loading journey tracking…</main>}><JourneyTrackingView role="CUSTOMER" /></Suspense>;
}
