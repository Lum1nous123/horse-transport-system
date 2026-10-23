import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Leg, Vehicle } from "./JourneyTrackingView";
import type { JourneyLeg, JourneyVehicle } from "@/lib/journey-tracking/types";

const vehicle: JourneyVehicle = {
  id: "one", label: "TRUCK-1", status: "IN_PROGRESS", horses: ["Apollo"],
  driver: { name: "Driver A", phone: "+1 555 0100" },
  escort: { name: "Escort B", phone: null },
  checkpoints: [
    { id: "arrived", label: "Reached checkpoint", reachedAt: "2026-10-23T10:00:00+07:00", note: "Welfare check recorded", photoUrl: "/welfare/reached.jpg" },
    { id: "future", label: "Future checkpoint", reachedAt: null, note: "Secret unreached note", photoUrl: "/welfare/unreached.jpg" },
  ],
};

describe("journey vehicle", () => {
  it("shows only reached evidence and phone-only contacts", () => {
    render(<Vehicle vehicle={vehicle} />);
    expect(screen.getByText("Welfare check recorded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View welfare photo" })).toHaveAttribute("href", "/welfare/reached.jpg");
    expect(screen.queryByText("Secret unreached note")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /unreached/i })).not.toBeInTheDocument();
    expect(screen.getByText("+1 555 0100")).toBeInTheDocument();
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("renders AIR welfare and delivery-phase events without a map", () => {
    const leg: JourneyLeg = {
      id: "air", sequenceNo: 2, mode: "AIR", origin: "Chicago", destination: "Brussels",
      status: "IN_PROGRESS", horses: ["Apollo"], vehicles: [],
      events: [{ id: "depart", label: "Flight leg started", occurredAt: "2026-10-23T12:00:00+07:00" }],
      welfareEvidence: [{ id: "welfare", recordedAt: "2026-10-23T13:00:00+07:00", note: "Horse settled", photoUrl: "/welfare/air.jpg" }],
    };
    render(<Leg leg={leg} />);
    expect(screen.getByText("Flight leg started")).toBeInTheDocument();
    expect(screen.getByText("Horse settled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View welfare photo" })).toHaveAttribute("href", "/welfare/air.jpg");
    expect(screen.queryByRole("region", { name: /map/i })).not.toBeInTheDocument();
  });
});
