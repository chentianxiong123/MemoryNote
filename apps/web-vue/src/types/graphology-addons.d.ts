declare module "graphology-layout-forceatlas2" {
  import Graph from "graphology";

  export interface ForceAtlas2Settings {
    gravity?: number;
    scalingRatio?: number;
    strongGravityMode?: boolean;
    barnesHutOptimize?: boolean;
    barnesHutTheta?: number;
    slowDown?: number;
    minSpeed?: number;
    maxSpeed?: number;
    edgeWeightInfluence?: number;
  }

  export function inferSettings(graph: Graph): ForceAtlas2Settings;

  export function assign(
    graph: Graph,
    options?: { iterations?: number; settings?: ForceAtlas2Settings }
  ): void;
}

declare module "graphology-communities-louvain" {
  import Graph from "graphology";

  export default function louvain(
    graph: Graph,
    options?: { resolution?: number }
  ): Record<string, number>;
}