import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@boothq/shared";

const SESSION_COOKIE = "bq_session";
const SESSION_TTL = "12h";

export type SessionPayload = {
  role: Extract<Role, "ADMIN" | "ILLUSTRATOR">;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.role !== "ADMIN" && payload.role !== "ILLUSTRATOR") return null;
    return { role: payload.role };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
