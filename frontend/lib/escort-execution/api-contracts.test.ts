import { describe, expect, it } from "vitest";
import {
  parseAirExecutionResponse,
  parseProofOfDeliveryResponse,
  parseWelfareEvidenceResponse,
} from "./api-contracts";

const routeLegId = "11111111-1111-1111-1111-111111111111";
const executionId = "22222222-2222-2222-2222-222222222222";
const escortId = "33333333-3333-3333-3333-333333333333";
const evidenceId = "44444444-4444-4444-4444-444444444444";
const checkpointId = "55555555-5555-5555-5555-555555555555";
const horseId = "66666666-6666-6666-6666-666666666666";

function airExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: executionId,
    routeLegId,
    escortId,
    status: "DESTINATION",
    startedAt: "2026-10-26T08:00:00",
    destinationArrivedAt: "2026-10-26T10:00:00.123456789",
    completedAt: null,
    ...overrides,
  };
}

function welfare(overrides: Record<string, unknown> = {}) {
  return {
    id: evidenceId,
    roadVehicleExecutionId: executionId,
    airLegExecutionId: null,
    checkpointId,
    eventType: "CHECKPOINT",
    photoUrl: "https://storage.example/evidence.png",
    photoName: "checkpoint-welfare.jpg",
    note: " Horse is calm. ",
    recordedByEscortId: escortId,
    recordedAt: "2026-10-26T10:05:00",
    ...overrides,
  };
}

function proof(overrides: Record<string, unknown> = {}) {
  return {
    id: evidenceId,
    roadVehicleExecutionId: null,
    airLegExecutionId: executionId,
    routeLegId,
    transportedOrderHorseIds: [horseId],
    recipientName: " Stable Manager ",
    proofPhotoUrl: "https://storage.example/proof.png",
    proofPhotoName: "proof-of-delivery.jpg",
    handoverNote: null,
    confirmedByEscortId: escortId,
    deliveredAt: "2026-10-26T10:10:00",
    createdAt: "2026-10-26T10:10:00",
    completedHandovers: 1,
    requiredHandovers: 1,
    routeLegStatus: "COMPLETED",
    orderStatus: "DELIVERED",
    ...overrides,
  };
}

const roadWelfareContext = {
  mode: "ROAD" as const,
  eventType: "CHECKPOINT" as const,
  checkpointId,
};

const airProofContext = {
  mode: "AIR" as const,
  routeLegId,
};

describe("escort Backend response contracts", () => {
  it("accepts UUIDs, nullable fields and LocalDateTime precision emitted by Backend", () => {
    const upperCaseExecutionId = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";
    expect(parseAirExecutionResponse(airExecution({
      id: upperCaseExecutionId,
      startedAt: "2024-02-29T00:00",
      destinationArrivedAt: "2024-02-29T23:59:59.123456789",
      completedAt: null,
    }), routeLegId)).toMatchObject({
      id: upperCaseExecutionId,
      startedAt: "2024-02-29T00:00",
      destinationArrivedAt: "2024-02-29T23:59:59.123456789",
      completedAt: null,
    });

    expect(parseProofOfDeliveryResponse(proof(), airProofContext)).toMatchObject({
      handoverNote: null,
      recipientName: " Stable Manager ",
    });
  });

  it.each([
    ["AIR execution id", () => parseAirExecutionResponse(airExecution({ id: "not-a-uuid" }), routeLegId)],
    ["nullable welfare owner", () => parseWelfareEvidenceResponse(welfare({ roadVehicleExecutionId: "" }), roadWelfareContext)],
    ["welfare actor", () => parseWelfareEvidenceResponse(welfare({ recordedByEscortId: "3333" }), roadWelfareContext)],
    ["PoD Horse id", () => parseProofOfDeliveryResponse(proof({ transportedOrderHorseIds: ["horse-1"] }), airProofContext)],
  ])("rejects a malformed UUID in %s", (_label, parse) => {
    expect(parse).toThrow(/reviewed Backend contract/);
  });

  it.each([
    "not-a-date",
    "2026-02-29T10:00:00",
    "2026-10-26T24:00:00",
    "2026-10-26T10:00:00Z",
    "2026-10-26T10:00:00.1234567890",
  ])("rejects invalid Backend LocalDateTime %s", (recordedAt) => {
    expect(() => parseWelfareEvidenceResponse(welfare({ recordedAt }), roadWelfareContext))
      .toThrow(/reviewed Backend contract/);
  });

  it("rejects an invalid PoD delivery timestamp before UI formatting", () => {
    expect(() => parseProofOfDeliveryResponse(proof({ deliveredAt: "not-a-date" }), airProofContext))
      .toThrow(/reviewed Backend contract/);
  });

  it.each([
    "https://storage.example/evidence.png",
    "/api/v1/media/evidence.png",
    "media/evidence.png?download=1",
  ])("accepts absolute or relative Backend media URL %s", (photoUrl) => {
    expect(parseWelfareEvidenceResponse(welfare({ photoUrl }), roadWelfareContext).photoUrl)
      .toBe(photoUrl);
  });

  it("preserves a relative PoD media URL", () => {
    const proofPhotoUrl = "/api/v1/media/proof.png";
    expect(parseProofOfDeliveryResponse(proof({ proofPhotoUrl }), airProofContext).proofPhotoUrl)
      .toBe(proofPhotoUrl);
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "http://[invalid",
    " /media/evidence.png",
  ])("rejects malformed or unsafe Backend media URL %s", (photoUrl) => {
    expect(() => parseWelfareEvidenceResponse(welfare({ photoUrl }), roadWelfareContext))
      .toThrow(/reviewed Backend contract/);
  });
});
