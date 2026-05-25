// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ────────────────────────────────────────────────────────────

const mockSetLocale = vi.fn();

vi.mock("@/lib/i18n/context", () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: mockSetLocale,
  })),
}));

import { LangToggle } from "./lang-toggle";
import { useI18n } from "@/lib/i18n/context";

// ── Tests ────────────────────────────────────────────────────────────

describe("LangToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useI18n).mockReturnValue({
      t: (key: string) => key,
      locale: "en",
      setLocale: mockSetLocale,
    } as ReturnType<typeof useI18n>);
  });

  it("renders a trigger button", () => {
    render(<LangToggle />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows language options when the dropdown is opened", async () => {
    const user = userEvent.setup();
    render(<LangToggle />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Italiano")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("calls setLocale with 'it' when Italiano is clicked", async () => {
    const user = userEvent.setup();
    render(<LangToggle />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Italiano"));

    expect(mockSetLocale).toHaveBeenCalledWith("it");
  });

  it("calls setLocale with 'en' when English is clicked", async () => {
    const user = userEvent.setup();
    render(<LangToggle />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("English"));

    expect(mockSetLocale).toHaveBeenCalledWith("en");
  });

  it("uses the Italian flag when locale is 'it'", () => {
    vi.mocked(useI18n).mockReturnValue({
      t: (key: string) => key,
      locale: "it",
      setLocale: mockSetLocale,
    } as ReturnType<typeof useI18n>);

    render(<LangToggle />);

    // The button should contain an SVG (the flag) -- we verify it renders without errors
    const button = screen.getByRole("button");
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
