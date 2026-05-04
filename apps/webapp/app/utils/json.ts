import { type z } from "zod";

type SafeParseResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: z.ZodError; data?: never };

export function safeJsonParse(json?: string): unknown {
  if (!json) {
    return;
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export function safeJsonZodParse<T>(
  schema: z.Schema<T>,
  json: string,
): SafeParseResult<T> | undefined {
  const parsed = safeJsonParse(json);

  if (parsed === null) {
    return;
  }

  return schema.safeParse(parsed) as SafeParseResult<T>;
}

export async function safeJsonFromResponse(response: Response) {
  const json = await response.text();
  return safeJsonParse(json);
}

export async function safeBodyFromResponse<T>(
  response: Response,
  schema: z.Schema<T>,
): Promise<T | undefined> {
  const json = await response.text();
  const unknownJson = safeJsonParse(json);

  if (!unknownJson) {
    return;
  }

  const parsedJson = schema.safeParse(unknownJson) as SafeParseResult<T>;

  if (parsedJson.success) {
    return parsedJson.data;
  }
}

export async function safeParseBodyFromResponse<T>(
  response: Response,
  schema: z.Schema<T>,
): Promise<SafeParseResult<T> | undefined> {
  try {
    const unknownJson = await response.json();

    if (!unknownJson) {
      return;
    }

    const parsedJson = schema.safeParse(unknownJson);

    return parsedJson as SafeParseResult<T>;
  } catch (error) {}
}
