import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { LabelService } from "~/services/label.server";

const SearchSchema = z.object({
  search: z.string().optional(),
});

const BodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().min(1).default("#3b82f6"),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const url = new URL(request.url);
  const parsed = SearchSchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  if (!parsed.success) {
    return json({ error: "Invalid query" }, { status: 400 });
  }
  const searchParam = parsed.data.search;

  if (searchParam) {
    const labels = await new LabelService().getWorkspaceLabels(
      "personal",
      searchParam,
    );
    return json(labels, { headers: corsHeaders() });
  }

  const labels = await new LabelService().getWorkspaceLabelsWithCounts(
    "personal",
  );
  return json(labels, { headers: corsHeaders() });
}

export async function action({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const label = await new LabelService().createLabel({
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
    });
    return json(label, { status: 201, headers: corsHeaders() });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 400 }
    );
  }
}
