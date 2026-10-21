import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";

const authMocks = vi.hoisted(() => ({
  clearAccessToken: vi.fn(),
  getCurrentUser: vi.fn(),
  replace: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: authMocks.replace }),
}));

vi.mock("@/lib/auth", () => ({
  clearAccessToken: authMocks.clearAccessToken,
  getCurrentUser: authMocks.getCurrentUser,
  signIn: authMocks.signIn,
}));

describe("LoginForm Escort access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signIn.mockResolvedValue(undefined);
    authMocks.getCurrentUser.mockResolvedValue({ role: "ESCORT" });
  });

  it("routes an authenticated Escort to the shared workspace", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "escort@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    await waitFor(() => expect(authMocks.replace).toHaveBeenCalledWith("/escort"));
    expect(authMocks.signIn).toHaveBeenCalledWith("escort@example.com", "password123");
  });
});
