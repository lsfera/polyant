// SPDX-License-Identifier: AGPL-3.0-or-later

import { Module } from "@nestjs/common";
import { SkillsController } from "./skills.controller.js";
import { InstanceSkillsController } from "./instance-skills.controller.js";
import { SkillsService } from "./skills.service.js";

@Module({
  controllers: [SkillsController, InstanceSkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
