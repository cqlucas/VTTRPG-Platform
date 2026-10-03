import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as public — bypasses JWT authentication.
 * Use on routes like /auth/register and /auth/login.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
