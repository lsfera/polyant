// SPDX-License-Identifier: AGPL-3.0-or-later

import { Module } from "@nestjs/common";
import { OpenAIController } from "./openai.controller.js";
import { OpenAIService } from "./openai.service.js";

@Module({
  controllers: [OpenAIController],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
