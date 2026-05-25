// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator.js";
import { ALLOW_INSTANCE_API_KEY } from "./decorators/allow-instance-api-key.decorator.js";
import { validateSessionToken } from "./auth-user.service.js";
import { findInstanceByAuthApiKey } from "../instances/secrets.store.js";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const { token, cookieName } = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing authentication");
    }

    const user = await validateSessionToken(token, cookieName);
    if (user) {
      request.user = user;
      return true;
    }

    // Session validation failed — if the route allows per-instance API keys,
    // try matching the bearer token against the AUTH_API_KEY secrets.
    const allowsInstanceKey = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INSTANCE_API_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowsInstanceKey) {
      const principal = await findInstanceByAuthApiKey(token);
      if (principal) {
        request.user = {
          kind: "instance",
          instanceSlug: principal.slug,
          instanceId: principal.instanceId,
        };
        return true;
      }
    }

    throw new UnauthorizedException("Invalid or expired session");
  }

  private extractToken(request: {
    headers: Record<string, string | undefined>;
    cookies?: Record<string, string>;
  }): { token: string | null; cookieName?: string } {
    const authHeader = request.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      return { token: authHeader.slice(7) };
    }

    const cookies = request.cookies ?? {};
    for (const name of SESSION_COOKIE_NAMES) {
      if (cookies[name]) return { token: cookies[name], cookieName: name };
    }

    return { token: null };
  }
}
