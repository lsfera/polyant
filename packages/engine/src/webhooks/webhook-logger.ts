// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Structured logger for the Webhooks module.
 * Follows the same pattern as pipeline-logger.ts: colored, timestamped, prefixed.
 * Output is intercepted by file-logger when installed.
 */

import { createLogger } from "../utils/create-logger.js";

export const webhookLog = createLogger();
