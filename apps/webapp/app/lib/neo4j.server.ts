interface Neo4jInteger {
  toNumber: () => number;
  toBigInt: () => bigint;
}

interface Neo4jRecord {
  get: (key: string) => Neo4jInteger | unknown;
  keys: string[];
  length: number;
}

interface Neo4jSession {
  run: (query: string, params?: Record<string, unknown>) => Promise<{ records: Neo4jRecord[] }>;
  close: () => Promise<void>;
}

interface Neo4jDriver {
  session: () => Neo4jSession;
  close: () => Promise<void>;
}

function createMockInteger(value: number = 0): Neo4jInteger {
  return {
    toNumber: () => value,
    toBigInt: () => BigInt(value),
  };
}

function createMockRecord(data: Record<string, number>): Neo4jRecord {
  return {
    get: (key: string) => createMockInteger(data[key] ?? 0),
    keys: Object.keys(data),
    length: Object.keys(data).length,
  };
}

let driver: Neo4jDriver | null = null;

export function getNeo4jDriver(): Neo4jDriver {
  if (!driver) {
    console.warn("Neo4j driver not initialized. Using mock implementation.");
    driver = {
      session: () => ({
        run: async () => ({
          records: [createMockRecord({ count: 0, deletedSpaceCount: 0, episodeCount: 0, statementCount: 0 })],
        }),
        close: async () => {},
      }),
      close: async () => {},
    };
  }
  return driver;
}

export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
