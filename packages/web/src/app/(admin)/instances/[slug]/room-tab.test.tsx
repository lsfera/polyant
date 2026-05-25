// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, waitFor } from "@testing-library/react";
import { RoomTab } from "./room-tab";

const roomGetMock = vi.fn();
const eventSourcesListMock = vi.fn();
const roomBacklogMock = vi.fn();
const roomActivityMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    room: {
      get: (...args: unknown[]) => roomGetMock(...args),
      backlog: (...args: unknown[]) => roomBacklogMock(...args),
      activity: (...args: unknown[]) => roomActivityMock(...args),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    eventSources: {
      list: (...args: unknown[]) => eventSourcesListMock(...args),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      rotateToken: vi.fn(),
      createDefinition: vi.fn(),
      updateDefinition: vi.fn(),
      deleteDefinition: vi.fn(),
    },
  },
  getUserErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

vi.mock("@/lib/i18n/context", () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CONFIGURED_ROOM = {
  configured: true,
  id: "room-1",
  enabled: true,
  prompt: "",
  outboundChannel: "slack",
  outboundTarget: "#general",
  evalIntervalMinutes: 5,
};

describe("RoomTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventSourcesListMock.mockResolvedValue([]);
    roomBacklogMock.mockResolvedValue({ events: [], total: 0 });
    roomActivityMock.mockResolvedValue([]);
  });

  it("renders the new-room state when the API says the room is not configured", async () => {
    roomGetMock.mockResolvedValue({ configured: false });

    render(<RoomTab slug="demo" />);

    await waitFor(() => {
      expect(screen.getByText("room.config.title")).toBeInTheDocument();
    });

    expect(screen.queryByText("room.backlog.title")).not.toBeInTheDocument();
    expect(roomBacklogMock).not.toHaveBeenCalled();
    expect(roomActivityMock).not.toHaveBeenCalled();
  });

  it("renders the room prompt textarea with a placeholder", async () => {
    roomGetMock.mockResolvedValue(CONFIGURED_ROOM);

    render(<RoomTab slug="demo" />);

    await waitFor(() => {
      expect(screen.getByText("room.config.title")).toBeInTheDocument();
    });

    const promptTextarea = screen.getByPlaceholderText("room.config.promptPlaceholder");
    expect(promptTextarea).toBeInTheDocument();
  });

  // NOTE: the event-sources + definitions UI moved from RoomTab to
  // TriggersWebhooksTab during the triggers refactor.  The legacy test
  // that lived here ("shows help text in the add-definition form") was
  // tied to the old RoomTab structure and has been replaced by a dedicated
  // test on TriggersWebhooksTab.
});
