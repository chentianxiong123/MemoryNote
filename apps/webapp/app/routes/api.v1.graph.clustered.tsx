import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { logger } from "~/services/logger.service";
import { LabelService } from "~/services/label.server";
import { ProviderFactory } from "@core/providers";

type GraphRecord = {
  get: (key: string) => unknown;
};

function parseAttributes(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value ?? 0);
}

const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    searchParams: z.object({
      limit: z.coerce.number().int().min(10).max(300).optional(),
    }),
    findResource: async () => 1,
  },
  async ({ authentication, searchParams }) => {
    try {
      const labelService = new LabelService();
      const graphProvider = ProviderFactory.getGraphProvider();
      const workspaceId = authentication.workspaceId ?? null;
      const limit = searchParams?.limit ?? 140;
      const queryLimit = limit + 1;

      const query = `
        MATCH (statement:Statement {userId: $userId})
        WHERE statement.invalidAt IS NULL
          AND ($workspaceId IS NULL OR statement.workspaceId = $workspaceId)

        MATCH (statement)-[:HAS_SUBJECT]->(source:Entity {userId: $userId})
        WHERE ($workspaceId IS NULL OR source.workspaceId = $workspaceId)

        MATCH (statement)-[:HAS_PREDICATE]->(predicate:Entity {userId: $userId})
        WHERE ($workspaceId IS NULL OR predicate.workspaceId = $workspaceId)

        MATCH (statement)-[:HAS_OBJECT]->(target:Entity {userId: $userId})
        WHERE ($workspaceId IS NULL OR target.workspaceId = $workspaceId)

        OPTIONAL MATCH (episode:Episode {userId: $userId})-[:HAS_PROVENANCE]->(statement)
        WHERE ($workspaceId IS NULL OR episode.workspaceId = $workspaceId)

        WITH
          statement,
          source,
          predicate,
          target,
          collect(DISTINCT episode.sessionId)[0..4] as sessionIds,
          count(DISTINCT episode) as provenanceCount
        ORDER BY coalesce(statement.validAt, statement.createdAt) DESC
        LIMIT ${queryLimit}

        RETURN
          source.uuid as sourceUuid,
          source.name as sourceName,
          source.type as sourceType,
          source.attributes as sourceAttributes,
          source.createdAt as sourceCreatedAt,
          predicate.uuid as predicateUuid,
          predicate.name as predicateName,
          target.uuid as targetUuid,
          target.name as targetName,
          target.type as targetType,
          target.attributes as targetAttributes,
          target.createdAt as targetCreatedAt,
          statement.uuid as statementUuid,
          statement.fact as statementFact,
          statement.aspect as statementAspect,
          statement.attributes as statementAttributes,
          statement.validAt as statementValidAt,
          statement.createdAt as statementCreatedAt,
          provenanceCount,
          sessionIds
      `;

      const [records, clusters] = await Promise.all([
        graphProvider.runQuery(query, {
          userId: authentication.userId,
          workspaceId,
        }) as Promise<GraphRecord[]>,
        labelService.getWorkspaceLabels(authentication.workspaceId as string),
      ]);

      const hasMore = records.length > limit;
      const visibleRecords = hasMore ? records.slice(0, limit) : records;

      const triplets = visibleRecords.map((record) => {
        const sourceAttributes = parseAttributes(record.get("sourceAttributes"));
        const targetAttributes = parseAttributes(record.get("targetAttributes"));
        const statementAttributes = parseAttributes(record.get("statementAttributes"));
        const sourceType = record.get("sourceType");
        const targetType = record.get("targetType");
        const predicateName = String(record.get("predicateName") ?? "related_to");

        return {
          sourceNode: {
            uuid: String(record.get("sourceUuid") ?? ""),
            name: String(record.get("sourceName") ?? ""),
            labels: ["Entity", String(sourceType || "Concept")],
            attributes: {
              ...sourceAttributes,
              entityType: sourceType || "Concept",
            },
            createdAt: String(record.get("sourceCreatedAt") ?? ""),
          },
          edge: {
            uuid: String(record.get("statementUuid") ?? ""),
            type: predicateName,
            source_node_uuid: String(record.get("sourceUuid") ?? ""),
            target_node_uuid: String(record.get("targetUuid") ?? ""),
            attributes: {
              ...statementAttributes,
              fact: String(record.get("statementFact") ?? ""),
              aspect: record.get("statementAspect") ?? null,
              predicateUuid: String(record.get("predicateUuid") ?? ""),
              predicateName,
              validAt: record.get("statementValidAt") ?? null,
              provenanceCount: toNumber(record.get("provenanceCount")),
              sessionIds: Array.isArray(record.get("sessionIds"))
                ? (record.get("sessionIds") as unknown[]).filter(Boolean)
                : [],
            },
            createdAt: String(record.get("statementCreatedAt") ?? ""),
          },
          targetNode: {
            uuid: String(record.get("targetUuid") ?? ""),
            name: String(record.get("targetName") ?? ""),
            labels: ["Entity", String(targetType || "Concept")],
            attributes: {
              ...targetAttributes,
              entityType: targetType || "Concept",
            },
            createdAt: String(record.get("targetCreatedAt") ?? ""),
          },
        };
      });

      const nodeIds = new Set<string>();
      const predicates = new Set<string>();

      for (const triplet of triplets) {
        nodeIds.add(triplet.sourceNode.uuid);
        nodeIds.add(triplet.targetNode.uuid);
        predicates.add(triplet.edge.type);
      }

      return json({
        success: true,
        data: {
          triplets,
          clusters,
          hasMore,
          requestedLimit: limit,
          summary: {
            nodeCount: nodeIds.size,
            edgeCount: triplets.length,
            predicateCount: predicates.size,
          },
        },
      });
    } catch (error) {
      logger.error("Error in clustered graph loader:", { error });
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  },
);

export { loader };
