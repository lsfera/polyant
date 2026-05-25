// SPDX-License-Identifier: AGPL-3.0-or-later

import { SetMetadata } from "@nestjs/common";

/**
 * Marker for routes that may be accessed with either a per-instance API key
 * (stored encrypted under SECRET_KEYS.AUTH_API_KEY in `instance_secrets`)
 * or a regular session JWT. Anonymous access is still rejected.
 *
 * Use on OpenAI-compatible endpoints that are consumed by both the admin
 * panel (cookie/JWT) and external clients keyed per instance.
 */
export const ALLOW_INSTANCE_API_KEY = "allowInstanceApiKey";
export const AllowInstanceApiKey = () => SetMetadata(ALLOW_INSTANCE_API_KEY, true);
