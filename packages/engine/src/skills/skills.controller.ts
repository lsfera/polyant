// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Res,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { Response } from "express";
import { SkillsService } from "./skills.service.js";
import { getSkill, listVersions, getSkillVersion } from "./skills.store.js";
import { exportSkillsCatalog, exportSingleSkill, importSkillsCatalog } from "./skills-export.service.js";
import type { RequiredEnvEntry } from "../utils/frontmatter.js";
import { errMsg } from "../utils/error.js";

@Controller("api/skills")
export class SkillsController {
  constructor(@Inject(SkillsService) private readonly skillsService: SkillsService) {}

  @Get()
  async list() {
    return { skills: await this.skillsService.listSkills() };
  }

  // Static routes MUST come before parameterized :name routes
  @Get("catalog/export")
  async exportCatalog(@Res() res: Response) {
    try {
      const bundle = await exportSkillsCatalog();
      const date = new Date().toISOString().slice(0, 10);

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="skills-catalog-${date}.json"`);
      res.send(JSON.stringify(bundle, null, 2));
    } catch (err) {
      throw new InternalServerErrorException(errMsg(err));
    }
  }

  @Post("catalog/import")
  async importCatalog(@Body() body: unknown) {
    try {
      return await importSkillsCatalog(body);
    } catch (err) {
      throw new BadRequestException(errMsg(err));
    }
  }

  @Get(":name")
  async getOne(@Param("name") name: string) {
    const skill = await this.skillsService.getSkill(name);
    if (!skill) throw new NotFoundException(`Skill "${name}" not found`);
    return skill;
  }

  @Post()
  async create(@Body() body: { name: string; description: string; content: string; requiredEnv?: RequiredEnvEntry[]; requiredTools?: string[] }) {
    if (!body.name?.trim()) throw new BadRequestException("Name is required");
    if (!body.content?.trim()) throw new BadRequestException("Content is required");

    try {
      return await this.skillsService.createSkill(body);
    } catch (err) {
      const message = errMsg(err);
      if (message.includes("already exists")) throw new ConflictException(message);
      throw new InternalServerErrorException(message);
    }
  }

  @Put(":name")
  async update(@Param("name") name: string, @Body() body: { description: string; content: string; requiredEnv?: RequiredEnvEntry[]; requiredTools?: string[]; changelog?: string }) {
    const skill = await this.skillsService.updateSkill(name, body);
    if (!skill) throw new NotFoundException(`Skill "${name}" not found`);
    return skill;
  }

  @Delete(":name")
  async remove(@Param("name") name: string) {
    const deleted = await this.skillsService.deleteSkill(name);
    if (!deleted) throw new NotFoundException(`Skill "${name}" not found`);
    return { deleted: true };
  }

  @Get(":name/export")
  async exportSkill(@Param("name") name: string, @Res() res: Response) {
    try {
      const bundle = await exportSingleSkill(name);
      const date = new Date().toISOString().slice(0, 10);

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${name}-${date}.json"`);
      res.send(JSON.stringify(bundle, null, 2));
    } catch (err) {
      const message = errMsg(err);
      if (message.includes("not found")) throw new NotFoundException(message);
      throw new InternalServerErrorException(message);
    }
  }

  @Get(":name/versions")
  async listVersions(@Param("name") name: string) {
    const skill = await getSkill(name);
    if (!skill) throw new NotFoundException(`Skill "${name}" not found`);
    const versions = await listVersions(skill.id);
    return { versions };
  }

  @Get(":name/versions/:version")
  async getVersion(
    @Param("name") name: string,
    @Param("version") version: string,
  ) {
    const skill = await getSkill(name);
    if (!skill) throw new NotFoundException(`Skill "${name}" not found`);
    const versionRow = await getSkillVersion(skill.id, version);
    if (!versionRow) throw new NotFoundException(`Version "${version}" not found for skill "${name}"`);
    return versionRow;
  }
}
