import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { ConflictError } from "../errors/index.js";
import {
  createSession,
  deleteSessionByToken,
  getSessionCookieName,
  getSessionFromRequest,
  hashPassword,
  verifyPassword,
} from "../lib/session.js";
import { prisma } from "../lib/db.js";
import {
  AuthUserSchema,
  ErrorSchema,
  LoginBodySchema,
  RegisterBodySchema,
} from "../schemas/index.js";

const SESSION_DAYS = 7;
const MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function setSessionCookie(
  reply: Parameters<Parameters<FastifyInstance["route"]>[0]["handler"]>[1],
  token: string
): void {
  reply.header(
    "Set-Cookie",
    `${getSessionCookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`
  );
}

function clearSessionCookie(
  reply: Parameters<Parameters<FastifyInstance["route"]>[0]["handler"]>[1]
): void {
  reply.header(
    "Set-Cookie",
    `${getSessionCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export const authRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/register",
    schema: {
      tags: ["Auth"],
      summary: "Cadastro",
      body: RegisterBodySchema,
      response: {
        201: AuthUserSchema,
        409: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const body = RegisterBodySchema.parse(request.body);
        const existing = await prisma.user.findUnique({
          where: { email: body.email.toLowerCase() },
        });
        if (existing) {
          throw new ConflictError("E-mail já cadastrado");
        }

        const passwordHash = await hashPassword(body.password);
        const user = await prisma.user.create({
          data: {
            id: randomUUID(),
            name: body.name.trim(),
            email: body.email.toLowerCase(),
            emailVerified: false,
            passwordHash,
          },
        });

        const token = await createSession(user.id);
        setSessionCookie(reply, token);

        return reply.status(201).send({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
      } catch (err) {
        if (err instanceof ConflictError) {
          return reply.status(409).send({
            error: err.message,
            code: "CONFLICT",
          });
        }
        app.log.error(err);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/login",
    schema: {
      tags: ["Auth"],
      summary: "Login",
      body: LoginBodySchema,
      response: {
        200: AuthUserSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const body = LoginBodySchema.parse(request.body);
        const user = await prisma.user.findUnique({
          where: { email: body.email.toLowerCase() },
        });

        if (
          !user ||
          !user.passwordHash ||
          !(await verifyPassword(body.password, user.passwordHash))
        ) {
          return reply.status(401).send({
            error: "E-mail ou senha inválidos",
            code: "UNAUTHORIZED",
          });
        }

        const token = await createSession(user.id);
        setSessionCookie(reply, token);

        return reply.status(200).send({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/logout",
    schema: {
      tags: ["Auth"],
      summary: "Logout",
      response: {
        204: z.undefined(),
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await getSessionFromRequest(request);
        if (session) {
          const cookies = (request.headers.cookie ?? "")
            .split(";")
            .reduce<Record<string, string>>((acc, part) => {
              const [k, ...v] = part.trim().split("=");
              if (k && v.length) acc[k] = v.join("=").trim();
              return acc;
            }, {});
          const token = cookies[getSessionCookieName()];
          if (token) await deleteSessionByToken(token);
        }
        clearSessionCookie(reply);
        return reply.status(204).send(undefined);
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/me",
    schema: {
      tags: ["Auth"],
      summary: "Usuário da sessão",
      response: {
        200: AuthUserSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await getSessionFromRequest(request);
        if (!session) {
          return reply.status(401).send({
            error: "Não autenticado",
            code: "UNAUTHORIZED",
          });
        }
        return reply.status(200).send(session);
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
