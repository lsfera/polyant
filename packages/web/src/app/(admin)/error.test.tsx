// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminError from "./error";

describe("AdminError", () => {
  const defaultError = new Error("Something broke") as Error & { digest?: string };
  const resetFn = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    resetFn.mockClear();
  });

  it("renders the error heading", () => {
    render(<AdminError error={defaultError} reset={resetFn} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<AdminError error={defaultError} reset={resetFn} />);
    expect(
      screen.getByText("An unexpected error occurred. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders a 'Try again' button", () => {
    render(<AdminError error={defaultError} reset={resetFn} />);
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("calls reset when the 'Try again' button is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminError error={defaultError} reset={resetFn} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(resetFn).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error on mount", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AdminError error={defaultError} reset={resetFn} />);

    expect(spy).toHaveBeenCalledWith("Admin panel error:", defaultError);
    spy.mockRestore();
  });
});
