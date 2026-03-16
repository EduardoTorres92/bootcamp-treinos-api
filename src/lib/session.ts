import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";

import type { FastifyRequest } from "fastify";

import { prisma } from "./db.js";

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = "session_token";
const SESSION_DAYS = 7;
const SALT_LEN = 16;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return key.toString("hex") === keyHex;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: {
      id: randomUUID(),
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [key, ...v] = part.trim().split("=");
    if (key && v.length) out[key] = v.join("=").trim();
  }
  return out;
}

export async function getSessionFromRequest(
  request: FastifyRequest
): Promise<{ user: { id: string; name: string; email: string } } | null> {
  const cookies = parseCookieHeader(request.headers.cookie as string | undefined);
  const token = cookies[SESSION_COOKIE] ?? null;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (
    !session ||
    !session.user ||
    session.expiresAt < new Date()
  ) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
