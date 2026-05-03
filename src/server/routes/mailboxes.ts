import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMailbox, deleteMailbox, listDashboardMailboxes } from "../claw-dashboard";
import { getMailboxById, listMailboxes, markMailboxDeleted, markMailboxesMissingDeleted, upsertMailbox } from "../db";
import { startMailboxListener, stopMailboxListener } from "../listener-manager";
import { getParentMailboxId } from "../runtime-config";

const createMailboxSchema = z.object({
  suffix: z.string().regex(/^[a-z0-9]{1,32}$/)
});

export async function mailboxRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/mailboxes", async (request) => {
    const query = request.query as { sync?: string };
    if (query.sync === "true") {
      const remote = await listDashboardMailboxes();
      for (const item of remote) {
        const row = upsertMailbox({
          id: item.id,
          email: item.email,
          prefix: item.prefix,
          displayName: item.displayName,
          status: item.status ?? "active",
          openclawStatus: item.openclawStatus,
          installCommand: item.installCommand,
          authUrl: item.authUrl
        });
        startMailboxListener(row);
      }
      for (const mailbox of markMailboxesMissingDeleted(remote.map((item) => item.email))) {
        stopMailboxListener(mailbox.email);
      }
    }
    return { items: listMailboxes(false) };
  });

  app.post("/api/mailboxes", async (request, reply) => {
    const body = createMailboxSchema.parse(request.body);
    const mailbox = await createMailbox(body.suffix);
    const row = upsertMailbox({
      id: mailbox.id,
      email: mailbox.email,
      prefix: mailbox.prefix,
      displayName: mailbox.displayName,
      status: mailbox.status ?? "active",
      openclawStatus: mailbox.openclawStatus,
      installCommand: mailbox.installCommand,
      authUrl: mailbox.authUrl
    });
    startMailboxListener(row);
    return reply.code(201).send(row);
  });

  app.delete("/api/mailboxes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mailbox = getMailboxById(id);
    if (!mailbox) {
      return { success: true };
    }
    if (id === getParentMailboxId()) {
      return reply.code(400).send({ error: "primary mailbox cannot be deleted here" });
    }
    await deleteMailbox(id);
    markMailboxDeleted(id);
    stopMailboxListener(mailbox.email);
    return { success: true };
  });
}
