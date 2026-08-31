import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { deleteSession } from "~/services/ingestionLogs.server";
import {
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";

import {
  deleteDocument,
  getDocument,
  updateDocument,
  updateDocumentContent,
} from "~/services/document.server";
import { type Document } from "@prisma/client";
import { prisma } from "~/db.server";

// Schema for space ID parameter
const DocumentParamsSchema = z.object({
  documentId: z.string(),
});

export const LogUpdateBody = z.object({
  labels: z.array(z.string()).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});

export const ContentUpdateBody = z.object({
  content: z.string(),
});

const loader = createHybridLoaderApiRoute(
  {
    params: DocumentParamsSchema,
    findResource: async () => 1,
    corsStrategy: "all",
    allowJWT: true,
  },
  async ({ params, authentication }) => {


    const document = await getDocument(
      params.documentId,
    );

    // Don't expose skill documents through this endpoint
    if (document?.type === "skill") {
      throw new Response("Document not found", { status: 404 });
    }

    return json({ document });
  },
);

const { action } = createHybridActionApiRoute(
  {
    params: DocumentParamsSchema,
    allowJWT: true,
    authorization: {
      action: "update",
    },
    corsStrategy: "all",
  },
  async ({ params, authentication, request }) => {
    const document = await getDocument(
      params.documentId,
    );

    if (!document) {
      return json(
        {
          error: "Document not found or unauthorized",
          code: "not_found",
        },
        { status: 404 },
      );
    }

    // Handle PATCH requests for updating labels
    if (request.method === "PATCH") {
      try {
        const body = await request.json();
        const validationResult = LogUpdateBody.safeParse(body);

        if (!validationResult.success) {
          return json(
            {
              error: "Invalid request body",
              code: "validation_error",
              details: validationResult.error.issues,
            },
            { status: 400 },
          );
        }

        let { labels, title, content, createdAt } = validationResult.data;

        if (document.title === "Persona" || title === "Persona") {
          return json(
            {
              error:
                "Cannot edit the persona title or labels, also cannot name any document as Persona",
              code: "validation_error",
            },
            { status: 400 },
          );
        }

        // Build update data
        const updateData: any = {};
        if (labels !== undefined) updateData.labelIds = labels;
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);

        // Update the document
        const updatedDocument = await prisma.document.update({
          where: { id: params.documentId },
          data: updateData,
        });

        return json({
          success: true,
          message: "Document updated successfully",
          document: updatedDocument,
        });
      } catch (error) {
        console.error("Error updating labels:", error);
        return json(
          {
            error: "Failed to update labels",
            code: "internal_error",
          },
          { status: 500 },
        );
      }
    }

    if (request.method === "POST") {
      const body = await request.json();
      const validationResult = ContentUpdateBody.safeParse(body);

      if (!validationResult.success) {
        return json(
          {
            error: "Invalid request body",
            code: "validation_error",
            details: validationResult.error.issues,
          },
          { status: 400 },
        );
      }

      const { content } = validationResult.data;

      const response = await updateDocumentContent(
        document as Document,
        content,
        "personal",
        "personal" as string,
      );

      return json(response);
    }

    if (request.method === "DELETE") {
      // Handle DELETE requests
      try {
        // If deleteSession param is true and log has a sessionId, delete entire session
        const result = await deleteSession(
          document.sessionId as string,
          "personal",
        );

        await deleteDocument(document.id as string);
        return json({
          success: true,
          message: "Session deleted successfully",
          logsDeleted: result.logsDeleted,
          deleted: result.deleted,
        });
      } catch (error) {
        console.error("Error deleting log:", error);
        return json(
          {
            error: "Failed to delete log",
            code: "internal_error",
          },
          { status: 500 },
        );
      }
    }

    return json(
      {
        error: "No method available",
        code: "internal_error",
      },
      { status: 404 },
    );
  },
);

export { action, loader };
