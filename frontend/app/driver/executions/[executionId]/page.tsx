import type { Metadata } from "next";
import DriverAccess from "@/components/execution/DriverAccess";

export const metadata: Metadata = { title: "Vehicle journey | Horse Transport System" };

export default async function DriverJourneyPage({ params }: { params: Promise<{ executionId: string }> }) {
  const { executionId } = await params;
  return <DriverAccess key={executionId} executionId={executionId} />;
}
