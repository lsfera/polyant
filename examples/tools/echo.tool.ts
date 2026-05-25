/**
 * Example custom tool: echo
 *
 * The simplest possible Polyant tool — returns whatever it receives.
 * Copy this file to `packages/engine/src/agents/tools/` and restart the engine.
 * The tool auto-registers at boot via `registerTool()` and becomes available
 * in the admin panel's Tools tab for any instance.
 */
import { z } from "zod";
import { registerTool } from "../registry.js";

registerTool({
  name: "echo",
  description: "Echo the input string back verbatim. Useful as a smoke test.",
  harness: false,
  parameters: z.object({
    message: z.string().describe("The message to echo."),
  }),
  create: () => async ({ message }) => {
    return { echoed: message, length: message.length };
  },
});
