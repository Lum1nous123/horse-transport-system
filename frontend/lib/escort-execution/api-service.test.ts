import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiFetch: apiMocks.apiFetch }));
vi.mock("@/lib/auth", () => ({
  getAccessToken: apiMocks.getAccessToken,
  clearAccessToken: apiMocks.clearAccessToken,
}));

import { escortExecutionMutationApi } from "./api-service";

const routeLegId = "11111111-1111-1111-1111-111111111111";
const roadLegVehicleId = "22222222-2222-2222-2222-222222222222";
const checkpointId = "33333333-3333-3333-3333-333333333333";
const executionId = "44444444-4444-4444-4444-444444444444";
const escortId = "55555555-5555-5555-5555-555555555555";
const evidenceId = "66666666-6666-6666-6666-666666666666";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function originalPhoto(name = "original.png") {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });
}

function airExecution(status: "IN_PROGRESS" | "DESTINATION" | "COMPLETED") {
  return {
    id: executionId,
    routeLegId,
    escortId,
    status,
    startedAt: "2026-10-25T08:00:00",
    destinationArrivedAt: status === "DESTINATION" ? "2026-10-25T10:00:00" : null,
    completedAt: status === "COMPLETED" ? "2026-10-25T10:15:00" : null,
  };
}

function welfare(mode: "ROAD" | "AIR", eventType: "CHECKPOINT" | "FINAL_DESTINATION") {
  return {
    id: evidenceId,
    roadVehicleExecutionId: mode === "ROAD" ? executionId : null,
    airLegExecutionId: mode === "AIR" ? executionId : null,
    checkpointId: eventType === "CHECKPOINT" ? checkpointId : null,
    eventType,
    photoUrl: "https://storage.example/evidence.png",
    photoName: eventType === "CHECKPOINT" ? "checkpoint-welfare.jpg" : "final-welfare.jpg",
    note: "Horses are calm and hydrated.",
    recordedByEscortId: escortId,
    recordedAt: "2026-10-25T10:05:00",
  };
}

function proof(mode: "ROAD" | "AIR") {
  return {
    id: evidenceId,
    roadVehicleExecutionId: mode === "ROAD" ? executionId : null,
    airLegExecutionId: mode === "AIR" ? executionId : null,
    routeLegId,
    transportedOrderHorseIds: ["77777777-7777-7777-7777-777777777777"],
    recipientName: "Stable Manager",
    proofPhotoUrl: "https://storage.example/proof.png",
    proofPhotoName: "proof-of-delivery.jpg",
    handoverNote: null,
    confirmedByEscortId: escortId,
    deliveredAt: "2026-10-25T10:10:00",
    createdAt: "2026-10-25T10:10:00",
    completedHandovers: 1,
    requiredHandovers: 1,
    routeLegStatus: "COMPLETED",
    orderStatus: "DELIVERED",
  };
}

function capturedRequest(index = 0) {
  const [path, init] = apiMocks.apiFetch.mock.calls[index] as [string, RequestInit];
  return { path, init, headers: new Headers(init.headers), body: init.body as FormData };
}

describe("escortExecutionMutationApi", () => {
  beforeEach(() => {
    apiMocks.getAccessToken.mockReturnValue("escort-jwt");
  });

  it("posts original ROAD checkpoint welfare evidence with exact fields and locator", async () => {
    const file = originalPhoto("checkpoint-original.png");
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse(welfare("ROAD", "CHECKPOINT"), 201));

    const result = await escortExecutionMutationApi.recordRoadWelfare(roadLegVehicleId, {
      eventType: "CHECKPOINT",
      checkpointId,
      photo: file,
      note: "  Horses are calm and hydrated.  ",
    });

    const request = capturedRequest();
    expect(request.path).toBe(`/api/v1/road-executions/vehicles/${roadLegVehicleId}/checkpoints/${checkpointId}/welfare`);
    expect(request.init.method).toBe("POST");
    expect(request.body.get("photo")).toBe(file);
    expect(request.body.get("note")).toBe("Horses are calm and hydrated.");
    expect(request.headers.get("Authorization")).toBe("Bearer escort-jwt");
    expect(request.headers.get("Accept")).toBe("application/json");
    expect(request.headers.has("Content-Type")).toBe(false);
    expect(result).toMatchObject({
      id: evidenceId,
      eventType: "CHECKPOINT",
      checkpointId,
      photoName: "checkpoint-welfare.jpg",
    });
  });

  it("uses the ROAD destination welfare endpoint without inventing readback", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse(welfare("ROAD", "FINAL_DESTINATION"), 201));
    await escortExecutionMutationApi.recordRoadWelfare(roadLegVehicleId, {
      eventType: "FINAL_DESTINATION",
      photo: originalPhoto(),
      note: "Fit for handover.",
    });
    expect(capturedRequest().path)
      .toBe(`/api/v1/road-executions/vehicles/${roadLegVehicleId}/destination/welfare`);
  });

  it("uses routeLegId for AIR start and destination mutations", async () => {
    apiMocks.apiFetch
      .mockResolvedValueOnce(jsonResponse(airExecution("IN_PROGRESS")))
      .mockResolvedValueOnce(jsonResponse(airExecution("DESTINATION")));

    await expect(escortExecutionMutationApi.startAirExecution(routeLegId))
      .resolves.toMatchObject({ routeLegId, status: "IN_PROGRESS" });
    await expect(escortExecutionMutationApi.recordAirDestinationArrival(routeLegId))
      .resolves.toMatchObject({ routeLegId, status: "DESTINATION" });

    expect(capturedRequest(0).path).toBe(`/api/v1/air-executions/legs/${routeLegId}/start`);
    expect(capturedRequest(1).path).toBe(`/api/v1/air-executions/legs/${routeLegId}/destination`);
  });

  it("uses the explicit non-final AIR completion endpoint", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse(airExecution("COMPLETED")));
    await expect(escortExecutionMutationApi.completeAirExecution(routeLegId))
      .resolves.toMatchObject({ routeLegId, status: "COMPLETED" });
    expect(capturedRequest().path).toBe(`/api/v1/air-executions/legs/${routeLegId}/complete`);
  });

  it("posts the original AIR welfare file to the confirmed destination endpoint", async () => {
    const file = originalPhoto("air-original.png");
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse(welfare("AIR", "FINAL_DESTINATION"), 201));

    const result = await escortExecutionMutationApi.recordAirWelfare(routeLegId, {
      photo: file,
      note: "Fit for handover.",
    });

    const request = capturedRequest();
    expect(request.path).toBe(`/api/v1/air-executions/legs/${routeLegId}/destination/welfare`);
    expect(request.body.get("photo")).toBe(file);
    expect(request.headers.has("Content-Type")).toBe(false);
    expect(result).toMatchObject({ eventType: "FINAL_DESTINATION", photoName: "final-welfare.jpg" });
  });

  it.each([
    ["ROAD", `/api/v1/road-executions/vehicles/${roadLegVehicleId}/proof-of-delivery`],
    ["AIR", `/api/v1/air-executions/legs/${routeLegId}/proof-of-delivery`],
  ] as const)("posts %s Proof of Delivery with exact multipart fields", async (mode, expectedPath) => {
    const file = originalPhoto(`${mode.toLowerCase()}-proof.png`);
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse(proof(mode), 201));
    const input = { recipientName: "  Stable Manager  ", photo: file, note: "  Safe handover.  " };

    const result = mode === "ROAD"
      ? await escortExecutionMutationApi.recordRoadProofOfDelivery(roadLegVehicleId, input)
      : await escortExecutionMutationApi.recordAirProofOfDelivery(routeLegId, input);

    const request = capturedRequest();
    expect(request.path).toBe(expectedPath);
    expect(request.body.get("recipientName")).toBe("Stable Manager");
    expect(request.body.get("photo")).toBe(file);
    expect(request.body.get("note")).toBe("Safe handover.");
    expect(request.headers.has("Content-Type")).toBe(false);
    expect(result).toMatchObject({ mode, proofPhotoName: "proof-of-delivery.jpg" });
  });

  it("omits the optional PoD note when the user supplies only whitespace", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse(proof("AIR"), 201));
    await escortExecutionMutationApi.recordAirProofOfDelivery(routeLegId, {
      recipientName: "Stable Manager",
      photo: originalPhoto(),
      note: "   ",
    });
    expect(capturedRequest().body.has("note")).toBe(false);
  });

  it("clears the token and returns a typed error for a bodyless 401", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(escortExecutionMutationApi.startAirExecution(routeLegId)).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { status: 401 },
    });
    expect(apiMocks.clearAccessToken).toHaveBeenCalledOnce();
  });

  it("returns a stable typed error for a bodyless 403", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(escortExecutionMutationApi.startAirExecution(routeLegId)).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { status: 403 },
    });
  });

  it.each([
    [400, "DOCUMENT_FILE_VALIDATION_ERROR", "VALIDATION_ERROR"],
    [404, "ROUTE_PLAN_NOT_FOUND", "NOT_FOUND"],
    [409, "INVALID_ORDER_TRANSITION", "STALE_STATE"],
    [502, "DOCUMENT_STORAGE_ERROR", "REQUEST_FAILED"],
  ] as const)("maps HTTP %s and preserves Backend code %s", async (status, apiCode, code) => {
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse({ code: apiCode, message: "Backend message" }, status));
    await expect(escortExecutionMutationApi.startAirExecution(routeLegId)).rejects.toMatchObject({
      code,
      message: "Backend message",
      details: { status, apiCode },
    });
  });

  it("rejects malformed success JSON as a typed request failure", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    await expect(escortExecutionMutationApi.startAirExecution(routeLegId)).rejects.toMatchObject({
      code: "REQUEST_FAILED",
      details: { status: 200, apiCode: "MALFORMED_RESPONSE" },
    });
  });

  it("rejects a response whose identifiers contradict the endpoint contract", async () => {
    apiMocks.apiFetch.mockResolvedValueOnce(jsonResponse({ ...proof("ROAD"), airLegExecutionId: executionId }));
    await expect(escortExecutionMutationApi.recordRoadProofOfDelivery(roadLegVehicleId, {
      recipientName: "Recipient",
      photo: originalPhoto(),
    })).rejects.toMatchObject({ code: "REQUEST_FAILED" });
  });

  it("does not retry a POST after a network failure", async () => {
    apiMocks.apiFetch.mockRejectedValueOnce(new TypeError("network timeout"));
    await expect(escortExecutionMutationApi.startAirExecution(routeLegId)).rejects.toMatchObject({
      code: "REQUEST_FAILED",
      details: { status: 0, apiCode: "NETWORK_ERROR" },
    });
    expect(apiMocks.apiFetch).toHaveBeenCalledOnce();
  });

  it("does not call the API when the session token is absent", async () => {
    apiMocks.getAccessToken.mockReturnValue(null);
    await expect(escortExecutionMutationApi.startAirExecution(routeLegId)).rejects.toMatchObject({
      code: "FORBIDDEN",
      details: { status: 401, apiCode: "SESSION_EXPIRED" },
    });
    expect(apiMocks.apiFetch).not.toHaveBeenCalled();
  });
});
