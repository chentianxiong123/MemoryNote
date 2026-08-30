import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { LabelService } from "~/services/label.server";

const ParamsSchema = z.object({
  labelId: z.string().min(1),
});

const BodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return json({ error: "Method not allowed" }, { status: 405 });
}

export async function action({ request, params }: { request: Request; params: Record<string, string> }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return json({ error: "Invalid params" }, { status: 400 });
  }
  const { labelId } = parsed.data;
  const service = new LabelService();

  if (request.method === "DELETE") {
    try {
      await service.deleteLabel(labelId);
      return json({ success: true }, { headers: corsHeaders() });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Delete failed" },
        { status: 400 }
      );
    }
  }

  if (request.method === "PATCH") {
    const body = await request.json().catch(() => null);
    const parsedBody = BodySchema.safeParse(body);
    if (!parsedBody.success) {
      return json({ error: "Invalid body" }, { status: 400 });
    }
    try {
      const label = await service.updateLabel(labelId, parsedBody.data);
      return json(label, { headers: corsHeaders() });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Update failed" },
        { status: 400 }
      );
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
