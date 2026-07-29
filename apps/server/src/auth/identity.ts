import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { verifyToken } from "./token.js";
import type { WpIdentityContext } from "../adapters/wp/index.js";

export interface VerifiedWpIdentity extends WpIdentityContext {
  email: string;
  name: string;
}

declare module "express-serve-static-core" {
  interface Request {
    wpIdentity?: VerifiedWpIdentity;
  }
}

interface WpTokenPayload {
  uid: number;
  email: string;
  name: string;
}

/**
 * Reads the `X-MPE-Token` header (issued by the WP companion plugin — or the dev
 * mock-login route — to a logged-in visitor's browser) and, if present and valid,
 * attaches a trusted `req.wpIdentity`. Does NOT reject requests without a token —
 * anonymous informational chat is always allowed; individual `requiresAuth` tools
 * check `req.wpIdentity` themselves and return a login_prompt action card instead.
 */
export function identityMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("X-MPE-Token");
  if (!header) {
    next();
    return;
  }

  const result = verifyToken<WpTokenPayload>(header, env.WP_SHARED_SECRET);
  if (result.ok) {
    req.wpIdentity = {
      userId: result.payload.uid,
      email: result.payload.email,
      name: result.payload.name,
      token: header,
    };
  }
  // Invalid/expired token: silently treated as anonymous rather than a hard error —
  // the widget will refresh the token client-side on its own schedule.
  next();
}
