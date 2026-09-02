import type { FastifyReply, FastifyRequest } from "fastify";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

export function isLocalDevOrigin(origin: string): boolean {
  return LOCAL_DEV_ORIGIN.test(origin);
}

export function allowDevCors(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function applySecurityHeaders(request: FastifyRequest, reply: FastifyReply): void {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Cross-Origin-Opener-Policy", "same-origin");
  reply.header("Cross-Origin-Resource-Policy", "same-origin");
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  reply.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  reply.header("X-Robots-Tag", "noindex, nofollow");
  if (request.url.startsWith("/api")) {
    reply.header("Cache-Control", "no-store");
  }
}
