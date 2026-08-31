import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const ImportBody = z.object({
  title: z.string().min(1, "标题不能为空"),
  content: z.string().min(1, "内容不能为空"),
  source: z.string().default("upload"),
  type: z.string().default("text"),
  createdAt: z.string().datetime().optional(),
  labelIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

const { action } = createHybridActionApiRoute(
  {
    body: ImportBody,
    allowJWT: false,
    corsStrategy: "all",
  },
  async ({ body }) => {
    const sessionId = crypto.randomUUID();
    const docDate = body.createdAt ? new Date(body.createdAt) : new Date();

    const document = await prisma.document.create({
      data: {
        sessionId,
        title: body.title,
        content: body.content,
        source: body.source,
        type: body.type,
        labelIds: body.labelIds,
        editedBy: "user",
        metadata: body.metadata ?? {},
        createdAt: docDate,
        updatedAt: docDate,
      },
    });

    return json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        source: document.source,
        type: document.type,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
    });
  },
);

export { action };
