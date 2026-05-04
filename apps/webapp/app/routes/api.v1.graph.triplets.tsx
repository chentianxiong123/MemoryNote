import crypto from "crypto";
import { json } from "@remix-run/node";
import {
  EntityTypes,
  EpisodeType,
  StatementAspects,
  type EntityNode,
  type EpisodicNode,
  type StatementNode,
} from "@core/types";
import { z } from "zod";

import { ProviderFactory } from "@core/providers";
import { saveEpisode } from "~/services/graphModels/episode";
import { saveTriple } from "~/services/graphModels/statement";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const ManualTripletSchema = z.object({
  subject: z.string().trim().min(1),
  predicate: z.string().trim().min(1),
  object: z.string().trim().min(1),
  fact: z.string().trim().optional(),
  subjectType: z.enum(EntityTypes).optional(),
  objectType: z.enum(EntityTypes).optional(),
  aspect: z.enum(StatementAspects).optional(),
});

async function ensureEntity(params: {
  name: string;
  type: string;
  userId: string;
  workspaceId?: string;
}): Promise<EntityNode> {
  const graphProvider = ProviderFactory.getGraphProvider();
  const existing =
    params.type === "Predicate"
      ? (await graphProvider.findExactPredicateMatches({
          predicateName: params.name,
          userId: params.userId,
          workspaceId: params.workspaceId ?? "",
        }))[0] ?? null
      : await graphProvider.findExactEntityMatch({
          entityName: params.name,
          userId: params.userId,
          workspaceId: params.workspaceId ?? "",
        });

  if (existing) {
    return {
      ...existing,
      type: (existing.type || params.type) as EntityNode["type"],
      attributes: {
        ...(existing.attributes ?? {}),
        lastUpdatedFrom: "manual",
      },
    };
  }

  return {
    uuid: crypto.randomUUID(),
    name: params.name,
    type: params.type as EntityNode["type"],
    createdAt: new Date(),
    userId: params.userId,
    workspaceId: params.workspaceId,
    attributes: {
      createdFrom: "manual",
    },
  };
}

const { action, loader } = createHybridActionApiRoute(
  {
    body: ManualTripletSchema,
    allowJWT: true,
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const now = new Date();
    const workspaceId = authentication.workspaceId as string | undefined;
    const fact = body.fact?.trim() || `${body.subject} ${body.predicate} ${body.object}`;

    const episode: EpisodicNode = {
      uuid: crypto.randomUUID(),
      content: fact,
      originalContent: fact,
      metadata: {
        sourceMode: "manual-triplet",
      },
      source: "manual",
      createdAt: now,
      validAt: now,
      labelIds: [],
      userId: authentication.userId,
      workspaceId,
      sessionId: `manual-${now.getTime()}`,
      queueId: `manual-${crypto.randomUUID()}`,
      type: EpisodeType.CONVERSATION,
      contentEmbedding: [],
    };

    await saveEpisode(episode);

    const [subject, predicate, object] = await Promise.all([
      ensureEntity({
        name: body.subject,
        type: body.subjectType ?? "Concept",
        userId: authentication.userId,
        workspaceId,
      }),
      ensureEntity({
        name: body.predicate,
        type: "Predicate",
        userId: authentication.userId,
        workspaceId,
      }),
      ensureEntity({
        name: body.object,
        type: body.objectType ?? "Concept",
        userId: authentication.userId,
        workspaceId,
      }),
    ]);

    const statement: StatementNode = {
      uuid: crypto.randomUUID(),
      fact,
      factEmbedding: [],
      createdAt: now,
      validAt: now,
      invalidAt: null,
      attributes: {
        sourceMode: "manual-triplet",
      },
      userId: authentication.userId,
      workspaceId,
      aspect: body.aspect ?? "Knowledge",
      provenanceCount: 1,
    };

    await saveTriple(
      {
        statement,
        subject,
        predicate,
        object,
        provenance: episode,
      },
      workspaceId,
    );

    return json({
      success: true,
      triplet: {
        sourceNode: {
          uuid: subject.uuid,
          name: subject.name,
          labels: ["Entity", subject.type ?? "Concept"],
          attributes: {
            ...(subject.attributes ?? {}),
            entityType: subject.type ?? "Concept",
          },
          createdAt: subject.createdAt.toISOString(),
        },
        edge: {
          uuid: statement.uuid,
          type: predicate.name,
          source_node_uuid: subject.uuid,
          target_node_uuid: object.uuid,
          attributes: {
            ...statement.attributes,
            fact: statement.fact,
            aspect: statement.aspect,
            predicateUuid: predicate.uuid,
            predicateName: predicate.name,
            validAt: statement.validAt.toISOString(),
            provenanceCount: 1,
            sessionIds: [episode.sessionId],
          },
          createdAt: statement.createdAt.toISOString(),
        },
        targetNode: {
          uuid: object.uuid,
          name: object.name,
          labels: ["Entity", object.type ?? "Concept"],
          attributes: {
            ...(object.attributes ?? {}),
            entityType: object.type ?? "Concept",
          },
          createdAt: object.createdAt.toISOString(),
        },
      },
    });
  },
);

export { action, loader };
