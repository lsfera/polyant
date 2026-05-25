// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ────────────────────────────────────────────────────────────

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: mockSetTheme,
  })),
}));

vi.mock("@/lib/i18n/context", () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
  })),
}));

import { ThemeToggle } from "./theme-toggle";
import { useTheme } from "next-themes";

// ── Tests ────────────────────────────────────────────────────────────

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTheme).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
      systemTheme: "light",
      resolvedTheme: "light",
      forcedTheme: undefined,
    });
  });

  it("renders a button", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has a screen-reader label", () => {
    render(<ThemeToggle />);

    expect(screen.getByText("common.toggleTheme")).toBeInTheDocument();
  });

  it("switches to dark theme when current theme is light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("switches to light theme when current theme is dark", async () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
      systemTheme: "light",
      resolvedTheme: "dark",
      forcedTheme: undefined,
    });

    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
