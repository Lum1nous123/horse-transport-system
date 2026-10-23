import { Suspense } from "react";
import JourneyTrackingView from "@/components/JourneyTrackingView";

export default function LogisticsJourneyPage() {
  return <Suspense fallback={<main>Loading journey tracking…</main>}><JourneyTrackingView role="LOGISTICS_MANAGER" /></Suspense>;
}
