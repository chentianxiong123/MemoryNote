import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isInitializeRequest,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MCPSessionManager } from "~/utils/mcp/session-manager";
import { TransportManager } from "~/utils/mcp/transport-manager";
import { callMemoryTool, memoryTools } from "~/utils/mcp/memory";
import { logger } from "~/services/logger.service";
import { type Response, type Request } from "express";

const QueryParams = z.object({
  source: z.string().optional(),
  spaceId: z.string().optional(),
  skip_tools: z.string().optional(),
});

// Create MCP server with memory tools
async function createMcpServer(
  userId: string,
  workspaceId: string,
  sessionId: string,
  source: string,
  spaceId?: string,
  skipTools?: string[],
) {
  const server = new Server(
    {
      name: "core",
      version: "1.0.0",
      description: "CORE Memory - Intelligent knowledge graph",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    },
  );

  // Tool listing - memory tools only
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    let tools = [...memoryTools];

    if (skipTools && skipTools.length > 0) {
      tools = tools.filter((tool) => !skipTools.includes(tool.name));
    }

    return { tools };
  });

  // Handle tool calls for memory tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    return await callMemoryTool(
      name,
      {
        sessionId: args?.sessionId ?? sessionId,
        workspaceId,
        spaceId,
        ...args,
      },
      userId,
      source,
    );
  });

  // Prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "search-context",
          description: "Search your memory for relevant context",
          arguments: [
            {
              name: "query",
              description: "What are you looking for?",
              required: true,
            },
          ],
        },
      ],
    };
  });

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "search-context") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Search for: ${args?.query || "relevant information"}`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  return server;
}

// Create transport with MCP server
async function createTransport(
  sessionId: string,
  source: string,
  userId: string,
  workspaceId: string,
  spaceId?: string,
  skipTools?: string[],
  recreate = false,
) {
  // Create transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
  });

  // Store session info
  if (!recreate) {
    await MCPSessionManager.createSession(sessionId, workspaceId, source);
  }
  TransportManager.storeSession(sessionId, transport, source, workspaceId);

  // Setup keepalive ping
  const keepAlive = setInterval(() => {
    try {
      if (transport.sessionId) {
        transport
          .send({
            jsonrpc: "2.0",
            method: "notifications/message",
          })
          .catch(() => {
            // Ignore errors on ping
          });
      }
    } catch {
      // Transport closed
    }
  }, 30000);

  // Setup cleanup on close
  transport.onclose = async () => {
    try {
      clearInterval(keepAlive);
      await MCPSessionManager.deleteSession(sessionId);
      await TransportManager.cleanupSession(sessionId);
    } catch (e) {
      console.log(e);
    }
  };

  // Create and connect MCP server
  const server = await createMcpServer(
    userId,
    workspaceId,
    sessionId,
    source,
    spaceId,
    skipTools,
  );
  await server.connect(transport);

  return transport;
}

export const handleMCPRequest = async (
  request: Request,
  res: Response,
  body: any,
  authentication: any,
  queryParams: z.infer<typeof QueryParams>,
) => {
  const sessionId = request.headers["mcp-session-id"] as string | undefined;
  const source = queryParams.source?.toLowerCase() || "api";
  const spaceId = queryParams.spaceId;
  const skipTools = queryParams.skip_tools
    ? queryParams.skip_tools.split(",").map((s) => s.trim())
    : [];

  const userId = authentication.userId;
  const workspaceId = authentication.workspaceId;

  try {
    let transport: StreamableHTTPServerTransport;
    let currentSessionId = sessionId;

    if (
      sessionId &&
      (await MCPSessionManager.isSessionActive(sessionId, workspaceId))
    ) {
      const sessionData = TransportManager.getSessionInfo(sessionId);

      if (!sessionData.exists) {
        const sessionDetails = await MCPSessionManager.getSession(sessionId);
        if (sessionDetails) {
          transport = await createTransport(
            sessionId,
            sessionDetails.source,
            userId,
            workspaceId,
            spaceId,
            skipTools,
            true,
          );
        } else {
          return res.status(404).json({
            error: "session_not_found",
            message: "Session not found. Please initialize a new session.",
          });
        }
      } else {
        transport = sessionData.mainTransport as StreamableHTTPServerTransport;
      }
    } else if (!sessionId && isInitializeRequest(body)) {
      currentSessionId = randomUUID();
      transport = await createTransport(
        currentSessionId,
        source,
        userId,
        workspaceId,
        spaceId,
        skipTools,
      );
    } else if (sessionId && !isInitializeRequest(body)) {
      currentSessionId = randomUUID();
      transport = await createTransport(
        currentSessionId,
        source,
        userId,
        workspaceId,
        spaceId,
        skipTools,
        true,
      );
    } else {
      return res.status(400).json({
        error: "invalid_request",
        message: "Missing session ID. Please send an initialize request first.",
      });
    }

    return await transport.handleRequest(request, res, body);
  } catch (error) {
    console.error("MCP request error:", error);
    throw new Error("MCP request error");
  }
};

export const handleSessionRequest = async (
  req: Request,
  res: Response,
  workspaceId: string,
  userId: string,
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId) {
    res.status(400).json({
      error: "invalid_request",
      message: "Missing mcp-session-id header.",
    });
    return;
  }

  const isActive = await MCPSessionManager.isSessionActive(
    sessionId,
    workspaceId,
  );

  if (!isActive) {
    res.status(405).json();
    return;
  }

  const sessionData = TransportManager.getSessionInfo(sessionId);

  if (!sessionData.exists) {
    res.status(405).json();
    return;
  }

  const transport = sessionData.mainTransport as StreamableHTTPServerTransport;
  await transport.handleRequest(req, res);
};
