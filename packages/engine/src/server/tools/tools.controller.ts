// SPDX-License-Identifier: GPL-3.0-or-later

import { Controller, Get } from "@nestjs/common";
import { listAvailableTools } from "../../agents/tools/registry.js";

@Controller("api/tools")
export class ToolsController {
  @Get()
  list() {
    return { tools: listAvailableTools() };
  }
}
