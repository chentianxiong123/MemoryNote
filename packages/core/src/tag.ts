import type { Label, Prisma, PrismaClient } from "@core/database";

export type TagClient = Pick<PrismaClient, "label" | "$queryRaw">;

export interface CreateLabelParams {
  name: string;
  description?: string;
  color: string;
}

export interface UpdateLabelParams {
  name?: string;
  description?: string;
  color?: string;
}

export type LabelWithCount = Label & { documentCount: number };

export async function createLabel(
  db: TagClient & Pick<PrismaClient, "label">,
  params: CreateLabelParams,
): Promise<Label> {
  if (!params.name || params.name.trim().length === 0) {
    throw new Error("Label name is required");
  }
  if (params.name.length > 100) {
    throw new Error("Label name too long (max 100 characters)");
  }

  const dup = await db.label.findMany({ where: { name: params.name } });
  if (dup.length > 0) {
    throw new Error("A label with this name already exists");
  }

  return db.label.create({
    data: {
      name: params.name.trim(),
      description: params.description?.trim(),
      color: params.color,
    },
  });
}

export async function getWorkspaceLabels(
  db: TagClient,
  search?: string,
): Promise<Label[]> {
  return db.label.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: search ? 10 : undefined,
  });
}

export async function getWorkspaceLabelsWithCounts(db: TagClient): Promise<LabelWithCount[]> {
  const [labels, countResults] = await Promise.all([
    db.label.findMany({ orderBy: { name: "asc" } }),
    db.$queryRaw<{ label_id: string; count: bigint }[]>`
      SELECT unnest("labelIds") as label_id, COUNT(*) as count
      FROM "Document"
      WHERE deleted IS NULL
      GROUP BY label_id
    `,
  ]);

  const countMap = new Map(countResults.map((r) => [r.label_id, Number(r.count)]));
  return labels.map((label) => ({
    ...label,
    documentCount: countMap.get(label.id) ?? 0,
  }));
}

export async function getLabelByName(
  db: TagClient,
  name: string,
): Promise<Label | null> {
  return db.label.findFirst({ where: { name } });
}

export async function getLabel(db: TagClient, labelId: string): Promise<Label | null> {
  return db.label.findUnique({ where: { id: labelId } });
}

export async function updateLabel(
  db: TagClient,
  labelId: string,
  updates: UpdateLabelParams,
): Promise<Label> {
  if (updates.name !== undefined) {
    if (!updates.name || updates.name.trim().length === 0) {
      throw new Error("Label name cannot be empty");
    }
    if (updates.name.length > 100) {
      throw new Error("Label name too long (max 100 characters)");
    }
    const dup = await db.label.findMany({ where: { name: updates.name } });
    if (dup.some((l) => l.id !== labelId)) {
      throw new Error("A label with this name already exists");
    }
  }

  return db.label.update({
    where: { id: labelId },
    data: {
      name: updates.name?.trim(),
      description: updates.description?.trim(),
    },
  });
}

export async function deleteLabel(db: TagClient, labelId: string): Promise<Label> {
  return db.label.delete({ where: { id: labelId } });
}

export async function validateLabelAccess(
  db: TagClient,
  labelIds: string[],
): Promise<boolean> {
  const found = await db.label.findMany({
    where: { id: { in: labelIds } },
  });
  return found.length === labelIds.length;
}

export type { Label, Prisma };
