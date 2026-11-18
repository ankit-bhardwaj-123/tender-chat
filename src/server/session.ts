import { auth } from "./auth";
import { unauthorized } from "./errors";

export async function requireUserId(request: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw unauthorized();
  }
  return session.user.id;
}
