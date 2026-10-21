import type { Metadata } from "next";
import DriverAccess from "@/components/execution/DriverAccess";

export const metadata: Metadata = { title: "My ROAD work | Horse Transport System" };

export default function DriverPage() {
  return <DriverAccess />;
}
