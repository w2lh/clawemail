import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getMailClient } from "../claw-mail";
import { getMailById, listAttachments, listMails } from "../db";

const listQuerySchema = z.object({
  mailbox: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export async function mailRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/mails", async (request) => {
    const query = listQuerySchema.parse(request.query);
    return listMails({
      mailboxEmail: query.mailbox?.trim().toLowerCase(),
      limit: query.limit,
      offset: query.offset
    });
  });

  app.get("/api/mails/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mail = getMailById(Number(id));
    if (!mail) {
      return reply.code(404).send({ error: "mail not found" });
    }
    return {
      ...mail,
      parsed: JSON.parse(mail.raw_json),
      attachments: listAttachments(mail.id)
    };
  });

  app.get("/api/mails/:id/attachments/:partId", async (request, reply) => {
    const { id, partId } = request.params as { id: string; partId: string };
    const mail = getMailById(Number(id));
    if (!mail) {
      return reply.code(404).send({ error: "mail not found" });
    }
    const attachment = await getMailClient(mail.mailbox_email).mail.getAttachment({
      id: mail.provider_mail_id,
      part: partId
    });
    reply.header("content-type", attachment.contentType || "application/octet-stream");
    reply.header("content-disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    return reply.send(attachment.stream());
  });
}
