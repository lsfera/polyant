// SPDX-License-Identifier: AGPL-3.0-or-later

import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/decorators/public.decorator.js";

@SkipThrottle()
@Public()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "polyant",
    };
  }
}
