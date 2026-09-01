import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";

const BodySchema = z.object({
  word: z.string().min(1).max(100),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const keywords = await prisma.blockedKeyword.findMany({
    orderBy: { createdAt: "asc" },
  });
  return json(keywords, { headers: corsHeaders() });
}

export async function action({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid body" }, { status: 400 });
    }
    try {
      const keyword = await prisma.blockedKeyword.create({
        data: { word: parsed.data.word.toLowerCase() },
      });
      return json(keyword, { status: 201, headers: corsHeaders() });
    } catch (err) {
      if ((err as any).code === "P2002") {
        return json({ error: "Keyword already blocked" }, { status: 409 });
      }
      return json(
        { error: err instanceof Error ? err.message : "Failed to block" },
        { status: 400 }
      );
    }
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const word = url.searchParams.get("word");
    if (!word) {
      return json({ error: "word parameter required" }, { status: 400 });
    }
    try {
      await prisma.blockedKeyword.delete({
        where: { word: word.toLowerCase() },
      });
      return json({ success: true }, { headers: corsHeaders() });
    } catch (err) {
      return json(
        { error: "Keyword not found or already unblocked" },
        { status: 404 }
      );
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
