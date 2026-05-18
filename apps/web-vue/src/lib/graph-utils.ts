import Graph from "graphology";
import louvain from "graphology-communities-louvain";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  primary?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
  aspect: string | null;
}

export interface CommunityInfo {
  id: number;
  nodeCount: number;
  cohesion: number;
  topNodes: string[];
}

export interface SurprisingConnection {
  source: GraphNode;
  target: GraphNode;
  score: number;
  reasons: string[];
  key: string;
}

export interface KnowledgeGap {
  type: "isolated-node" | "sparse-community" | "bridge-node";
  title: string;
  description: string;
  nodeIds: string[];
  suggestion: string;
}

// ---------------------------------------------------------------------------
// Community Detection (Louvain)
// ---------------------------------------------------------------------------

export function detectCommunities(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { assignments: Map<string, number>; communities: CommunityInfo[] } {
  if (nodes.length === 0) {
    return { assignments: new Map(), communities: [] };
  }

  const g = new Graph({ type: "undirected" as const });
  for (const node of nodes) {
    g.addNode(node.id);
  }
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      const key = `${edge.source}->${edge.target}`;
      if (!g.hasEdge(key) && !g.hasEdge(`${edge.target}->${edge.source}`)) {
        g.addEdgeWithKey(key, edge.source, edge.target, { weight: edge.weight ?? 1 });
      }
    }
  }

  // Run Louvain
  const communityMap: Record<string, number> = louvain(g, { resolution: 1 });
  const assignments = new Map(Object.entries(communityMap).map(([k, v]) => [k, v as number]));

  // Group nodes by community
  const groups = new Map<number, string[]>();
  for (const [nodeId, commId] of assignments) {
    const list = groups.get(commId) ?? [];
    list.push(nodeId);
    groups.set(commId, list);
  }

  // Build edge lookup for cohesion calculation
  const edgeSet = new Set<string>();
  for (const edge of edges) {
    edgeSet.add(`${edge.source}:::${edge.target}`);
    edgeSet.add(`${edge.target}:::${edge.source}`);
  }

  // Build label + linkCount lookup
  const nodeInfo = new Map(
    nodes.map((n: GraphNode) => {
      const linkCount = edges.filter((e: GraphEdge) => e.source === n.id || e.target === n.id).length;
      return [n.id, { label: n.label, linkCount }];
    })
  );

  // Compute per-community info
  const communities: CommunityInfo[] = [];
  for (const [commId, memberIds] of groups) {
    const n = memberIds.length;
    let intraEdges = 0;
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        if (edgeSet.has(`${memberIds[i]}:::${memberIds[j]}`)) {
          intraEdges++;
        }
      }
    }
    const possibleEdges = n > 1 ? (n * (n - 1)) / 2 : 1;
    const cohesion = intraEdges / possibleEdges;

    const sorted = [...memberIds].sort(
      (a: string, b: string) => (nodeInfo.get(b)?.linkCount ?? 0) - (nodeInfo.get(a)?.linkCount ?? 0)
    );
    const topNodes = sorted.slice(0, 5).map((id: string) => nodeInfo.get(id)?.label ?? id);

    communities.push({ id: commId, nodeCount: n, cohesion, topNodes });
  }

  // Sort by nodeCount descending
  communities.sort((a: CommunityInfo, b: CommunityInfo) => b.nodeCount - a.nodeCount);

  // Re-number community IDs sequentially
  const idRemap = new Map<number, number>();
  communities.forEach((c: CommunityInfo, idx: number) => {
    idRemap.set(c.id, idx);
    c.id = idx;
  });
  for (const [nodeId, oldId] of assignments) {
    assignments.set(nodeId, idRemap.get(oldId) ?? 0);
  }

  return { assignments, communities };
}

// ---------------------------------------------------------------------------
// Surprising Connections
// ---------------------------------------------------------------------------

export function findSurprisingConnections(
  nodes: GraphNode[],
  edges: GraphEdge[],
  _communities: CommunityInfo[],
  limit: number = 5,
): SurprisingConnection[] {
  const nodeMap = new Map(nodes.map((n: GraphNode) => [n.id, n]));
  const degreeMap = new Map(
    nodes.map((n: GraphNode) => {
      const count = edges.filter((e: GraphEdge) => e.source === n.id || e.target === n.id).length;
      return [n.id, count];
    })
  );
  const maxDegree = Math.max(...Array.from(degreeMap.values()), 1);

  const scored: SurprisingConnection[] = [];

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    let score = 0;
    const reasons: string[] = [];

    // Peripheral-to-hub coupling (+2)
    const sourceDeg = degreeMap.get(source.id) ?? 0;
    const targetDeg = degreeMap.get(target.id) ?? 0;
    const minDeg = Math.min(sourceDeg, targetDeg);
    const maxDeg = Math.max(sourceDeg, targetDeg);
    if (minDeg <= 2 && maxDeg >= maxDegree * 0.5) {
      score += 2;
      reasons.push("peripheral node links to hub");
    }

    // Low-weight edge between connected nodes (+1)
    if (edge.weight < 2 && edge.weight > 0) {
      score += 1;
      reasons.push("weak but present connection");
    }

    if (score >= 2 && reasons.length > 0) {
      const key = [source.id, target.id].sort().join(":::");
      scored.push({ source, target, score, reasons, key });
    }
  }

  scored.sort((a: SurprisingConnection, b: SurprisingConnection) => b.score - a.score);
  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Knowledge Gaps
// ---------------------------------------------------------------------------

export function detectKnowledgeGaps(
  nodes: GraphNode[],
  edges: GraphEdge[],
  communities: CommunityInfo[],
  limit: number = 8,
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  // Build degree map
  const degreeMap = new Map(
    nodes.map((n: GraphNode) => {
      const count = edges.filter((e: GraphEdge) => e.source === n.id || e.target === n.id).length;
      return [n.id, count];
    })
  );

  // 1. Isolated nodes (degree <= 1)
  const isolatedNodes = nodes.filter(
    (n: GraphNode) => (degreeMap.get(n.id) ?? 0) <= 1 && n.type !== "overview" && n.id !== "index"
  );
  if (isolatedNodes.length > 0) {
    const topIsolated = isolatedNodes.slice(0, 5);
    gaps.push({
      type: "isolated-node",
      title: `${isolatedNodes.length} isolated page${isolatedNodes.length > 1 ? "s" : ""}`,
      description: topIsolated.map((n: GraphNode) => n.label).join(", ") +
        (isolatedNodes.length > 5 ? ` and ${isolatedNodes.length - 5} more` : ""),
      nodeIds: isolatedNodes.map((n: GraphNode) => n.id),
      suggestion: "These pages have few or no connections. Consider adding links to related pages.",
    });
  }

  // 2. Sparse communities (low cohesion)
  for (const comm of communities) {
    if (comm.cohesion < 0.15 && comm.nodeCount >= 3) {
      gaps.push({
        type: "sparse-community",
        title: `Sparse cluster: ${comm.topNodes[0] ?? `Community ${comm.id}`}`,
        description: `${comm.nodeCount} pages with cohesion ${comm.cohesion.toFixed(2)} — internal connections are weak.`,
        nodeIds: [],
        suggestion: `This knowledge area lacks internal cross-references. Consider adding links between these pages.`,
      });
    }
  }

  return gaps.slice(0, limit);
}