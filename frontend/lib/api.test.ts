import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUrl } from "./api";

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes FormData through without forcing a JSON Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();
    body.append("photo", new File(["original"], "original.png", { type: "image/png" }));

    await apiFetch("/api/v1/example", { method: "POST", body });

    expect(fetchMock).toHaveBeenCalledWith(apiUrl("/api/v1/example"), {
      method: "POST",
      body,
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });
});
