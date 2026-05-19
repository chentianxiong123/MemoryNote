import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import forceAtlas2 from "graphology-layout-forceatlas2";

interface WorkerNode {
  id: string;
}

interface WorkerEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

interface ComputeMessage {
  type: "compute";
  nodes: WorkerNode[];
  edges: WorkerEdge[];
  existingPositions?: Record<string, { x: number; y: number }>;
}

interface ResultMessage {
  type: "result";
  positions: Record<string, { x: number; y: number }>;
  assignments: Record<string, number>;
}

self.onmessage = (e: MessageEvent<ComputeMessage>) => {
  const { nodes, edges, existingPositions } = e.data;

  if (nodes.length === 0) {
    const result: ResultMessage = { type: "result", positions: {}, assignments: {} };
    self.postMessage(result);
    return;
  }

  const g = new Graph({ type: "undirected" as const });
  for (const node of nodes) {
    const pos = existingPositions?.[node.id];
    g.addNode(node.id, {
      x: pos?.x ?? Math.random() * 100,
      y: pos?.y ?? Math.random() * 100,
    });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      const key = `${edge.source}->${edge.target}`;
      if (!g.hasEdge(key) && !g.hasEdge(`${edge.target}->${edge.source}`)) {
        g.addEdgeWithKey(key, edge.source, edge.target, { weight: edge.weight ?? 1 });
      }
    }
  }

  // ForceAtlas2 layout
  if (nodes.length > 1) {
    const settings = forceAtlas2.inferSettings(g);
    forceAtlas2.assign(g, {
      iterations: 150,
      settings: {
        ...settings,
        gravity: 1,
        scalingRatio: 2,
        strongGravityMode: true,
        barnesHutOptimize: nodes.length > 50,
      },
    });
  }

  // Collect positions
  const positions: Record<string, { x: number; y: number }> = {};
  g.forEachNode((nodeId: string, attrs: Record<string, unknown>) => {
    positions[nodeId] = { x: attrs.x as number, y: attrs.y as number };
  });

  // Run Louvain community detection
  const communityMap: Record<string, number> = louvain(g, { resolution: 1 });
  const assignments: Record<string, number> = {};
  for (const [nodeId, commId] of Object.entries(communityMap)) {
    assignments[nodeId] = commId as number;
  }

  const result: ResultMessage = { type: "result", positions, assignments };
  self.postMessage(result);
};