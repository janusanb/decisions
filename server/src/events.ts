import type { FastifyReply } from "fastify";

export class EventBus {
  private readonly clients = new Set<FastifyReply>();

  subscribe(reply: FastifyReply): void {
    this.clients.add(reply);
    reply.raw.on("close", () => {
      this.clients.delete(reply);
    });
  }

  emit(reason: string): void {
    const payload = `event: state\ndata: ${JSON.stringify({ reason })}\n\n`;
    for (const reply of this.clients) {
      reply.raw.write(payload);
    }
  }

  ping(): void {
    for (const reply of this.clients) {
      reply.raw.write(": ping\n\n");
    }
  }

  get size(): number {
    return this.clients.size;
  }
}
