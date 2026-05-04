import { type Tool } from "ai";

export interface OrchestratorToolSet {
  memory: Tool<any, any>;
  search: Tool<any, any>;
  graph: Tool<any, any>;
}

export function createOrchestratorTools(): OrchestratorToolSet {
  return {
    memory: {} as Tool<any, any>,
    search: {} as Tool<any, any>,
    graph: {} as Tool<any, any>,
  };
}