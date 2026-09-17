import type { SessionUser } from "./auth";
import { can } from "./auth";
import { ApiError, json } from "./errors";

export { json };

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError(401, "Authentication required");
  return user;
}

export function requirePermission(user: SessionUser, permission: string): void {
  if (!can(user, permission)) {
    throw new ApiError(
      403,
      `Role '${user.role}' is not allowed to perform '${permission}'`
    );
  }
}
