// SPDX-License-Identifier: AGPL-3.0-or-later

import { Module } from "@nestjs/common";
import { ActivityStreamController } from "./activity-stream.controller.js";

@Module({
  controllers: [ActivityStreamController],
})
export class ActivityStreamModule {}
