import type { FastifyReply } from "fastify";

export function ok<T extends Record<string, unknown>>(
  reply: FastifyReply,
  data: T = {} as T,
  message = "ok",
  status = 200,
): void {
  reply.status(status).send({ success: true, message, data });
}

export function error(
  reply: FastifyReply,
  message: string,
  status = 400,
  data: unknown = null,
  code?: string,
): void {
  reply.status(status).send({
    success: false,
    message,
    data,
    ...(code ? { code } : {}),
  });
}

export function bcOk(reply: FastifyReply, data: Record<string, unknown>): void {
  reply.send({ ResultCode: 0, ResultMessage: "OK", ...data });
}

export function bcError(reply: FastifyReply, code: number, message: string): void {
  reply.status(400).send({ ResultCode: code, ResultMessage: message });
}
