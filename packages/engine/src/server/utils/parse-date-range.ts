// SPDX-License-Identifier: AGPL-3.0-or-later

import { BadRequestException } from "@nestjs/common";

export function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // When "to" is a date-only string (e.g. "2026-02-22"), include the full day
  if (to && !to.includes("T")) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  if (isNaN(toDate.getTime()) || isNaN(fromDate.getTime())) {
    throw new BadRequestException("Invalid date format. Use ISO 8601 (e.g. 2025-01-01)");
  }
  if (fromDate > toDate) {
    throw new BadRequestException('"from" must be before "to"');
  }

  return { from: fromDate, to: toDate };
}
