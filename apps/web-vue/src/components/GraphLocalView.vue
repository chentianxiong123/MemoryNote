<script setup lang="ts">
import Graph from "graphology";
import Sigma from "sigma";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  buildCommunityInfoFromAssignments,
  detectCommunities as detectCommunitiesUtil,
  findSurprisingConnections as findSurprisingConnectionsUtil,
  detectKnowledgeGaps as detectKnowledgeGapsUtil,
  type CommunityInfo,
  type KnowledgeGap,
  type SurprisingConnection,
} from "@/lib/graph-utils";

type GraphNode = {
  id: string;
  label: string;
  type: string;
  primary: boolean;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
  aspect: string | null;
};

const props = defineProps<{
  title?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  colorMode?: "type" | "community";
}>();

const emit = defineEmits<{
  "node-select": [nodeId: string];
  "edge-select": [edgeId: string];
}>();

const containerRef = ref<HTMLDivElement | null>(null);

let sigma: Sigma | null = null;
let graph: Sigma["graph"] | null = null;

// Position cache for ForceAtlas2
const positionCache = new Map<string, { x: number; y: number }>();
let lastLayoutDataKey = "";

// Community detection result
const communityAssignments = ref<Map<string, number>>(new Map());
const communities = ref<CommunityInfo[]>([]);

// Graph insights
const surprisingConnections = ref<SurprisingConnection[]>([]);
const knowledgeGaps = ref<KnowledgeGap[]>([]);

// UI state
const showInsights = ref(false);
const showFilters = ref(false);
const highlightedNodes = ref<Set<string>>(new Set());
const dismissedInsights = ref<Set<string>>(new Set());
const nodeMenu = ref<{ nodeId: string; x: number; y: number } | null>(null);
const sigmaKey = ref(0);
const isComputing = ref(false);

// Filter state
const hiddenTypes = ref<Set<string>>(new Set());
const hiddenNodeIds = ref<Set<string>>(new Set());
const maxLinks = ref<number | undefined>(undefined);

// Color palettes (from llm_wiki)
const NODE_TYPE_COLORS: Record<string, string> = {
  Technology: "#d46b32",
  Concept: "#8f5f2b",
  Standard: "#557a46",
  Project: "#2f7d80",
  Product: "#7c4ca8",
  Person: "#b4536d",
  Organization: "#4d6ab5",
  Place: "#4f8c68",
  Event: "#b87832",
  Task: "#bb5a2f",
  Predicate: "#3f5b8f",
};

const COMMUNITY_COLORS = [
  "#60a5fa", "#4ade80", "#fb923c", "#c084fc",
  "#f87171", "#2dd4bf", "#facc15", "#f472b6",
  "#a78bfa", "#38bdf8", "#34d399", "#fbbf24",
];

function colorForType(type: string) {
  return NODE_TYPE_COLORS[type] || "#8f5f2b";
}

function getNodeColor(nodeId: string, type: string): string {
  if (props.colorMode === "community") {
    const communityId = communityAssignments.value.get(nodeId) ?? 0;
    return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
  }
  return colorForType(type);
}

// Compute link counts for each node
const linkCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const node of props.nodes) {
    counts.set(node.id, 0);
  }
  for (const edge of props.edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
});

// Cache the maximum link count once per data change (was being recomputed per node)
const maxLinkCount = computed(() => {
  let max = 1;
  for (const c of linkCounts.value.values()) {
    if (c > max) max = c;
  }
  return max;
});

// Lookup map for node type by id (avoids props.nodes.find() in Sigma reducers)
const nodeTypeMap = computed(() => {
  const map = new Map<string, string>();
  for (const n of props.nodes) map.set(n.id, n.type);
  return map;
});

// Detect communities using Louvain
function detectCommunities() {
  const result = detectCommunitiesUtil(props.nodes, props.edges);
  communityAssignments.value = result.assignments;
  communities.value = result.communities;
}

// Find surprising connections
function findSurprisingConnections() {
  surprisingConnections.value = findSurprisingConnectionsUtil(props.nodes, props.edges, communities.value, 5);
}

// Detect knowledge gaps
function detectKnowledgeGaps() {
  knowledgeGaps.value = detectKnowledgeGapsUtil(props.nodes, props.edges, communities.value, 8);
}

// Compute node size based on link count
function nodeSize(nodeId: string): number {
  const BASE_SIZE = 8;
  const MAX_SIZE = 28;
  const count = linkCounts.value.get(nodeId) ?? 0;
  const ratio = count / maxLinkCount.value;
  return BASE_SIZE + Math.sqrt(ratio) * (MAX_SIZE - BASE_SIZE);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mixColor(color1: string, color2: string, ratio: number): string {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Filtered nodes and edges (use all data, filter via Sigma reducers for performance)
const allNodes = computed(() => props.nodes);
const allEdges = computed(() => props.edges);

// Whether a node is hidden by filters
function isNodeHidden(nodeId: string, type: string): boolean {
  if (hiddenTypes.value.has(type)) return true;
  if (hiddenNodeIds.value.has(nodeId)) return true;
  if (maxLinks.value !== undefined && (linkCounts.value.get(nodeId) ?? 0) > maxLinks.value) return true;
  return false;
}

// Whether an edge is hidden by filters
function isEdgeHidden(edge: GraphEdge): boolean {
  const sType = nodeTypeMap.value.get(edge.source);
  const tType = nodeTypeMap.value.get(edge.target);
  if (!sType || !tType) return true;
  return isNodeHidden(edge.source, sType) || isNodeHidden(edge.target, tType);
}

// Stats: visible counts
const visibleNodeCount = computed(() => allNodes.value.filter((n: GraphNode) => !isNodeHidden(n.id, n.type)).length);
const visibleEdgeCount = computed(() => allEdges.value.filter((e: GraphEdge) => !isEdgeHidden(e)).length);

// Web Worker helper types
type WorkerNode = { id: string };
type WorkerEdge = { id: string; source: string; target: string; weight: number };
type WorkerResult = { positions: Record<string, { x: number; y: number }>; assignments: Record<string, number> };

function destroyGraph() {
  sigma?.kill();
  sigma = null;
  graph = null;
}

async function runWorkerCompute(
  nodes: GraphNode[],
  edges: GraphEdge[],
  existingPositions: Record<string, { x: number; y: number }>,
): Promise<WorkerResult> {
  const workerUrl = new URL("../workers/graph-worker.ts", import.meta.url);
  const w = new Worker(workerUrl, { type: "module" });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      w.terminate();
      reject(new Error("Worker timeout"));
    }, 30000);
    w.onmessage = (e: MessageEvent<WorkerResult & { type?: string }>) => {
      clearTimeout(timer);
      resolve(e.data);
      w.terminate();
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      w.terminate();
      reject(new Error(e.message));
    };
    w.postMessage({
      type: "compute",
      nodes: nodes.map((n) => ({ id: n.id })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, weight: e.weight })),
      existingPositions,
    } as Record<string, unknown>);
  });
}

function buildSigmaGraph(positions: Record<string, { x: number; y: number }>) {
  const nextGraph = new Graph();

  for (const node of allNodes.value) {
    const pos = positions[node.id];
    nextGraph.addNode(node.id, {
      label: node.label,
      x: pos?.x ?? Math.random() * 100,
      y: pos?.y ?? Math.random() * 100,
      size: nodeSize(node.id),
      color: getNodeColor(node.id, node.type),
      nodeType: node.type,
      primary: node.primary,
      community: communityAssignments.value.get(node.id) ?? 0,
      hidden: isNodeHidden(node.id, node.type),
    });
  }

  const maxWeight = Math.max(...allEdges.value.map((e: GraphEdge) => e.weight), 1);
  for (const edge of allEdges.value) {
    if (!nextGraph.hasNode(edge.source) || !nextGraph.hasNode(edge.target)) continue;
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!nextGraph.hasEdge(edgeKey) && !nextGraph.hasEdge(`${edge.target}->${edge.source}`)) {
      const normalizedWeight = edge.weight / maxWeight;
      const alpha = Math.round(40 + normalizedWeight * 180);
      nextGraph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        label: edge.label,
        size: 0.5 + normalizedWeight * 3.5,
        color: `rgba(100,116,139,${alpha / 255})`,
        weight: edge.weight,
        hidden: isEdgeHidden(edge),
      });
    }
  }

  graph = nextGraph;

  if (!containerRef.value) return;

  sigma = new Sigma(nextGraph, containerRef.value, {
    renderLabels: true,
    renderEdgeLabels: false,
    labelDensity: 0.08,
    labelGridCellSize: 120,
    defaultEdgeType: "line",
    minCameraRatio: 0.5,
    maxCameraRatio: 4,
    labelFont: "Trebuchet MS",
    labelWeight: "600",
    nodeReducer: (node: string, attrs: Record<string, unknown>) => {
      const result = { ...attrs };
      // Hide filtered-out nodes
      if (attrs.hidden) {
        result.color = "transparent";
        result.label = "";
        result.size = 0;
        return result;
      }
      if (attrs.hovering) {
        result.size = (attrs.size as number ?? 10) * 1.4;
        result.zIndex = 10;
        result.forceLabel = true;
      }
      if (attrs.dimmed) {
        result.color = mixColor(attrs.color as string ?? "#94a3b8", "#e2e8f0", 0.75);
        result.label = "";
        result.size = (attrs.size as number ?? 10) * 0.6;
      }
      if (attrs.insightHighlight) {
        result.size = (attrs.size as number ?? 10) * 1.5;
        result.zIndex = 10;
        result.forceLabel = true;
      }
      return result;
    },
    edgeReducer: (edge: string, attrs: Record<string, unknown>) => {
      const result = { ...attrs };
      // Hide edges where either endpoint is hidden
      if (attrs.hidden) {
        result.color = "transparent";
        result.size = 0;
        return result;
      }
      if (attrs.dimmed) {
        result.color = "#f1f5f9";
        result.size = 0.3;
      }
      if (attrs.highlighted) {
        result.color = "#1e293b";
        result.size = Math.max(2, (attrs.size as number ?? 1) * 1.5);
        result.forceLabel = true;
      }
      return result;
    },
  });

  sigma.on("clickNode", ({ node }: { node: string }) => {
    emit("node-select", node);
    setNodeMenu(null);
  });
  sigma.on("clickEdge", ({ edge }: { edge: string }) => {
    emit("edge-select", edge);
  });

  sigma.on("enterNode", ({ node }: { node: string }) => {
    if (!graph || !sigma) return;
    const neighbors = new Set(graph.neighbors(node));
    neighbors.add(node);
    graph.forEachNode((n: string) => {
      if (!neighbors.has(n)) graph!.setNodeAttribute(n, "dimmed", true);
    });
    graph.forEachEdge((e: string, _attrs: Record<string, unknown>, source: string, target: string) => {
      if (source !== node && target !== node) {
        graph!.setEdgeAttribute(e, "dimmed", true);
      } else {
        graph!.setEdgeAttribute(e, "highlighted", true);
      }
    });
    sigma.refresh();
  });

  sigma.on("leaveNode", () => {
    if (!graph || !sigma) return;
    graph.forEachNode((n: string) => {
      graph!.removeNodeAttribute(n, "hovering");
      graph!.removeNodeAttribute(n, "dimmed");
    });
    graph.forEachEdge((e: string) => {
      graph!.removeEdgeAttribute(e, "dimmed");
      graph!.removeEdgeAttribute(e, "highlighted");
    });
    sigma.refresh();
  });

  sigma.getContainer().addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.tagName === "CANVAS") {
      setNodeMenu({ nodeId: "", x: e.clientX, y: e.clientY });
    }
  });
}

async function mountGraph() {
  destroyGraph();
  if (!containerRef.value) return;
  if (props.nodes.length === 0) return;

  const fNodes = allNodes.value;
  const fEdges = allEdges.value;
  if (fNodes.length === 0) return;

  const dataKey = fNodes.map((n: GraphNode) => n.id).sort().join(",") + "|" + fEdges.length;
  const shouldRunLayout = dataKey !== lastLayoutDataKey && fNodes.length > 1;

  // Community detection (fast, runs synchronously)
  detectCommunities();

  // Gather existing positions from cache
  const cachedPositions: Record<string, { x: number; y: number }> = {};
  for (const n of fNodes) {
    const p = positionCache.get(n.id);
    if (p) cachedPositions[n.id] = p;
  }

  if (shouldRunLayout) {
    // Show loading indicator while worker computes
    isComputing.value = true;
    try {
      const result = await runWorkerCompute(fNodes, fEdges, cachedPositions);
      // Update position cache and community assignments
      lastLayoutDataKey = dataKey;
      const wAssignments = new Map(
        Object.entries(result.assignments).map(([k, v]) => [k, v as number])
      );
      communityAssignments.value = wAssignments;
      communities.value = buildCommunityInfoFromAssignments(wAssignments, props.nodes, props.edges);
      for (const [id, pos] of Object.entries(result.positions)) {
        positionCache.set(id, pos);
      }
      // Use worker-computed positions
      buildSigmaGraph(result.positions);
    } catch (err) {
      console.warn("[GraphLocalView] Worker failed, using cached positions:", err);
      lastLayoutDataKey = dataKey;
      buildSigmaGraph(cachedPositions);
    } finally {
      isComputing.value = false;
    }
  } else {
    // Use cached positions
    buildSigmaGraph(cachedPositions);
  }

  // Fast insight computation (main thread, non-blocking)
  findSurprisingConnections();
  detectKnowledgeGaps();
}

function setNodeMenu(menu: { nodeId: string; x: number; y: number } | null) {
  nodeMenu.value = menu;
}

function handleNodeRightClick(nodeId: string, x: number, y: number) {
  const rect = containerRef.value?.getBoundingClientRect();
  setNodeMenu({
    nodeId,
    x: rect ? x - rect.left : x,
    y: rect ? y - rect.top : y,
  });
}

function hideNode(nodeId: string) {
  hiddenNodeIds.value.add(nodeId);
  setNodeMenu(null);
  applyDynamicFilters();
}

function showAllTypes() {
  hiddenTypes.value.clear();
  applyDynamicFilters();
}

function applyDynamicFilters() {
  if (!graph || !sigma) return;
  const typeMap = nodeTypeMap.value;
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of props.edges) edgeMap.set(e.id, e);
  graph.forEachNode((nodeId: string) => {
    const type = typeMap.get(nodeId);
    if (type !== undefined) {
      graph!.setNodeAttribute(nodeId, "hidden", isNodeHidden(nodeId, type));
    }
  });
  graph.forEachEdge((edgeId: string) => {
    const edge = edgeMap.get(edgeId);
    if (edge) {
      graph!.setEdgeAttribute(edgeId, "hidden", isEdgeHidden(edge));
    }
  });
  sigma.refresh();
}

function toggleType(type: string) {
  if (hiddenTypes.value.has(type)) {
    hiddenTypes.value.delete(type);
  } else {
    hiddenTypes.value.add(type);
  }
  applyDynamicFilters();
}

function resetFilters() {
  hiddenTypes.value.clear();
  hiddenNodeIds.value.clear();
  maxLinks.value = undefined;
  applyDynamicFilters();
}

function highlightInsight(nodeIds: string[]) {
  highlightedNodes.value = new Set(nodeIds);
}

function dismissInsight(key: string) {
  dismissedInsights.value.add(key);
  highlightedNodes.value.clear();
}

function applySelectionState() {
  if (!graph || !sigma) return;

  const nodeMap = new Map<string, GraphNode>();
  for (const n of props.nodes) nodeMap.set(n.id, n);

  graph.forEachNode((nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const active = props.selectedNodeId === nodeId;
    const dimmed =
      !!props.selectedNodeId && props.selectedNodeId !== nodeId && !node.primary;

    const baseColor = getNodeColor(nodeId, node.type);
    graph!.setNodeAttribute(nodeId, "size", active ? nodeSize(nodeId) * 1.2 : nodeSize(nodeId));
    graph!.setNodeAttribute(nodeId, "color", dimmed ? mixColor(baseColor, "#e2e8f0", 0.75) : baseColor);
  });

  graph.forEachEdge((edgeId: string) => {
    const active = props.selectedEdgeId === edgeId;
    const dimmed = !!props.selectedEdgeId && props.selectedEdgeId !== edgeId;
    graph!.setEdgeAttribute(edgeId, "color", active ? "#c9633d" : dimmed ? "#e6ddd3" : "#b8a189");
    graph!.setEdgeAttribute(edgeId, "size", active ? 3 : 1.6);
  });

  sigma.refresh();
}

onMounted(() => {
  mountGraph();
});

onBeforeUnmount(() => {
  destroyGraph();
});

watch(
  () => [props.nodes, props.edges],
  () => {
    mountGraph();
  },
  { deep: true }
);

watch(
  () => [props.selectedNodeId, props.selectedEdgeId],
  () => {
    applySelectionState();
  }
);

watch(
  () => props.colorMode,
  () => {
    if (!graph || !sigma) return;
    const typeMap = nodeTypeMap.value;
    graph.forEachNode((nodeId: string) => {
      const type = typeMap.get(nodeId);
      if (type !== undefined) {
        graph!.setNodeAttribute(nodeId, "color", getNodeColor(nodeId, type));
      }
    });
    sigma.refresh();
  }
);

// Sigma manages its own ResizeObserver — just nudge it on container resize
watch(
  () => containerRef.value?.clientWidth,
  () => {
    sigma?.refresh();
  }
);

// Legend data
const typeCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const node of props.nodes) {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  }
  return counts;
});

// Insights counts
const visibleSurprisingConns = computed(() =>
  surprisingConnections.value.filter((c: SurprisingConnection) => !dismissedInsights.value.has(c.key))
);
</script>

<template>
  <div class="graph-local-view">
    <div v-if="title" class="graph-local-view__head">
      <h3>{{ title }}</h3>
      <div class="graph-local-view__stats">
        <span class="chip">{{ visibleNodeCount }}/{{ nodes.length }} nodes</span>
        <span class="chip">{{ visibleEdgeCount }}/{{ edges.length }} edges</span>
      </div>
    </div>

    <div class="graph-local-view__content">
      <div
        ref="containerRef"
        class="graph-local-view__canvas"
        @click="setNodeMenu(null)"
      >
        <!-- Computing overlay -->
        <div v-if="isComputing" class="computing-overlay">
          <div class="computing-spinner"></div>
          <span>Computing layout…</span>
        </div>
        <!-- Filter Panel -->
        <div v-if="showFilters" class="filter-panel">
          <div class="filter-panel__header">
            <span>Graph Filters</span>
            <button class="filter-panel__close" @click="showFilters = false">×</button>
          </div>

          <div class="filter-panel__section">
            <div class="filter-panel__label">Node Types</div>
            <div class="filter-panel__types">
              <label v-for="(count, type) in typeCounts" :key="type" class="filter-panel__type">
                <input
                  type="checkbox"
                  :checked="!hiddenTypes.has(type)"
                  @change="toggleType(type)"
                />
                <span class="filter-panel__dot" :style="{ backgroundColor: colorForType(type) }"></span>
                <span>{{ type }}</span>
                <span class="filter-panel__count">{{ count }}</span>
              </label>
            </div>
          </div>

          <div class="filter-panel__section">
            <div class="filter-panel__label">Max Links</div>
            <input
              type="number"
              class="filter-panel__input"
              v-model.number="maxLinks"
              placeholder="Any"
              min="0"
              @change="applyDynamicFilters"
            />
          </div>

          <div class="filter-panel__section">
            <div class="filter-panel__label">Hidden Nodes</div>
            <div v-if="hiddenNodeIds.size > 0" class="filter-panel__hidden">
              <div v-for="nodeId in hiddenNodeIds" :key="nodeId" class="filter-panel__hidden-item">
                <span>{{ nodes.find(n => n.id === nodeId)?.label || nodeId }}</span>
                <button @click="hiddenNodeIds.delete(nodeId); applyDynamicFilters()">Show</button>
              </div>
            </div>
            <span v-else class="filter-panel__empty">None</span>
          </div>

          <button class="filter-panel__reset" @click="resetFilters">Reset Filters</button>
        </div>

        <!-- Right-click Menu -->
        <div
          v-if="nodeMenu && nodeMenu.nodeId"
          class="node-menu"
          :style="{ left: nodeMenu.x + 'px', top: nodeMenu.y + 'px' }"
          @click.stop
        >
          <div class="node-menu__header">
            {{ nodes.find(n => n.id === nodeMenu!.nodeId)?.label }}
          </div>
          <button class="node-menu__item" @click="nodeMenu && hideNode(nodeMenu.nodeId)">
            Hide this node
          </button>
        </div>

        <!-- Legend -->
        <div class="graph-legend">
          <div class="graph-legend__title">
            {{ colorMode === "community" ? "Communities" : "Node Types" }}
          </div>
          <div class="graph-legend__items">
            <template v-if="colorMode === 'type'">
              <div
                v-for="(count, type) in typeCounts"
                :key="type"
                class="graph-legend__item"
                :class="{ 'graph-legend__item--hidden': hiddenTypes.has(type) }"
                @click="toggleType(type)"
              >
                <span class="graph-legend__dot" :style="{ backgroundColor: colorForType(type) }"></span>
                <span class="graph-legend__label">{{ type }}</span>
                <span class="graph-legend__count">{{ count }}</span>
              </div>
            </template>
            <template v-else>
              <div v-for="(comm, idx) in communities" :key="idx" class="graph-legend__item">
                <span class="graph-legend__dot" :style="{ backgroundColor: COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length] }"></span>
                <span class="graph-legend__label">{{ comm.topNodes[0] ?? `Cluster ${idx}` }}</span>
                <span class="graph-legend__count">{{ comm.nodeCount }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Control Buttons -->
        <div class="graph-controls">
          <button
            class="graph-controls__btn"
            :class="{ 'graph-controls__btn--active': showFilters }"
            @click="showFilters = !showFilters"
            title="Filters"
          >
            ⚙
          </button>
          <button
            class="graph-controls__btn"
            :class="{ 'graph-controls__btn--active': showInsights }"
            @click="showInsights = !showInsights"
            title="Insights"
          >
            💡
            <span v-if="visibleSurprisingConns.length + knowledgeGaps.length > 0" class="graph-controls__badge">
              {{ visibleSurprisingConns.length + knowledgeGaps.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- Insights Sidebar -->
      <div v-if="showInsights" class="graph-insights">
        <div class="graph-insights__header">
          <span>Graph Insights</span>
          <button class="graph-insights__close" @click="showInsights = false">×</button>
        </div>

        <div class="graph-insights__content">
          <!-- Surprising Connections -->
          <div v-if="visibleSurprisingConns.length > 0" class="graph-insights__section">
            <div class="graph-insights__title">⚡ Surprising Connections</div>
            <div
              v-for="conn in visibleSurprisingConns"
              :key="conn.key"
              class="graph-insights__item"
              :class="{ 'graph-insights__item--active': highlightedNodes.size === 2 && highlightedNodes.has(conn.source.id) && highlightedNodes.has(conn.target.id) }"
              @click="highlightInsight([conn.source.id, conn.target.id])"
            >
              <div class="graph-insights__item-title">
                {{ conn.source.label }} ↔ {{ conn.target.label }}
              </div>
              <div class="graph-insights__item-reasons">
                {{ conn.reasons.join(", ") }}
              </div>
              <button
                class="graph-insights__dismiss"
                @click.stop="dismissInsight(conn.key)"
              >×</button>
            </div>
          </div>

          <!-- Knowledge Gaps -->
          <div v-if="knowledgeGaps.length > 0" class="graph-insights__section">
            <div class="graph-insights__title">📚 Knowledge Gaps</div>
            <div
              v-for="(gap, idx) in knowledgeGaps"
              :key="idx"
              class="graph-insights__item"
              :class="{ 'graph-insights__item--active': gap.nodeIds.length > 0 && gap.nodeIds.every(id => highlightedNodes.has(id)) }"
              @click="gap.nodeIds.length > 0 && highlightInsight(gap.nodeIds)"
            >
              <div class="graph-insights__item-title">{{ gap.title }}</div>
              <div class="graph-insights__item-desc">{{ gap.description }}</div>
              <div class="graph-insights__item-suggestion">{{ gap.suggestion }}</div>
            </div>
          </div>

          <div v-if="visibleSurprisingConns.length === 0 && knowledgeGaps.length === 0" class="graph-insights__empty">
            No insights found. Add more connections to discover patterns.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graph-local-view {
  display: flex;
  min-height: 440px;
  flex-direction: column;
  gap: 10px;
}

.graph-local-view__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.graph-local-view__head h3 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.1rem;
}

.graph-local-view__stats {
  display: flex;
  gap: 8px;
}

.graph-local-view__content {
  display: flex;
  gap: 12px;
  min-height: 440px;
}

.graph-local-view__canvas {
  flex: 1;
  min-height: 440px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, rgba(201, 99, 61, 0.07), transparent 14rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 248, 241, 0.92));
  border: 1px solid rgba(95, 64, 28, 0.12);
  position: relative;
}

.graph-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(255, 250, 244, 0.95);
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.75rem;
  max-width: 220px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(89, 50, 19, 0.1);
  z-index: 10;
}

.graph-legend__title {
  font-weight: 600;
  color: var(--text, #333);
  margin-bottom: 8px;
  font-size: 0.8rem;
}

.graph-legend__items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.graph-legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.graph-legend__item:hover {
  background: rgba(95, 64, 28, 0.1);
}

.graph-legend__item--hidden {
  opacity: 0.4;
}

.graph-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.graph-legend__label {
  flex: 1;
  color: var(--text-soft, #666);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.graph-legend__count {
  color: var(--text-soft, #999);
  font-size: 0.7rem;
}

.graph-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.graph-controls__btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  background: rgba(255, 250, 244, 0.95);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.graph-controls__btn:hover {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(95, 64, 28, 0.3);
}

.graph-controls__btn--active {
  background: rgba(47, 125, 128, 0.15);
  border-color: rgba(47, 125, 128, 0.4);
}

.graph-controls__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f87171;
  color: white;
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}

.filter-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 240px;
  background: rgba(255, 250, 244, 0.98);
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 4px 16px rgba(89, 50, 19, 0.12);
  z-index: 20;
}

.filter-panel__header {
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-panel__close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--text-soft);
}

.filter-panel__section {
  margin-bottom: 14px;
}

.filter-panel__label {
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 6px;
  font-weight: 500;
}

.filter-panel__types {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-panel__type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.filter-panel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.filter-panel__count {
  margin-left: auto;
  color: var(--text-soft);
  font-size: 0.7rem;
}

.filter-panel__input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 6px;
  font-size: 0.8rem;
}

.filter-panel__hidden {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-panel__hidden-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  padding: 4px 6px;
  background: rgba(95, 64, 28, 0.08);
  border-radius: 4px;
}

.filter-panel__hidden-item button {
  background: none;
  border: none;
  color: #2f7d80;
  cursor: pointer;
  font-size: 0.7rem;
}

.filter-panel__empty {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.filter-panel__reset {
  width: 100%;
  padding: 8px;
  background: rgba(95, 64, 28, 0.1);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text);
}

.filter-panel__reset:hover {
  background: rgba(95, 64, 28, 0.15);
}

.node-menu {
  position: absolute;
  width: 160px;
  background: rgba(255, 250, 244, 0.98);
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(89, 50, 19, 0.15);
  z-index: 30;
  overflow: hidden;
}

.node-menu__header {
  padding: 8px 12px;
  font-size: 0.8rem;
  font-weight: 500;
  border-bottom: 1px solid rgba(95, 64, 28, 0.1);
  background: rgba(95, 64, 28, 0.05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-menu__item {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  display: block;
}

.node-menu__item:hover {
  background: rgba(95, 64, 28, 0.08);
}

.graph-insights {
  width: 280px;
  min-height: 440px;
  background: rgba(255, 250, 244, 0.95);
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.graph-insights__header {
  padding: 14px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(95, 64, 28, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.graph-insights__close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--text-soft);
}

.graph-insights__content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.graph-insights__section {
  margin-bottom: 16px;
}

.graph-insights__title {
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text);
}

.graph-insights__item {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(95, 64, 28, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.graph-insights__item:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(95, 64, 28, 0.15);
}

.graph-insights__item--active {
  border-color: rgba(47, 125, 128, 0.4);
  background: rgba(47, 125, 128, 0.08);
}

.graph-insights__item-title {
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 4px;
}

.graph-insights__item-reasons,
.graph-insights__item-desc {
  font-size: 0.7rem;
  color: var(--text-soft);
  margin-bottom: 4px;
}

.graph-insights__item-suggestion {
  font-size: 0.7rem;
  color: #2f7d80;
  font-style: italic;
}

.graph-insights__dismiss {
  position: absolute;
  top: 6px;
  right: 6px;
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--text-soft);
  line-height: 1;
}

.graph-insights__dismiss:hover {
  color: var(--text);
}

.graph-insights__empty {
  text-align: center;
  padding: 20px;
  color: var(--text-soft);
  font-size: 0.8rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(95, 64, 28, 0.12);
  color: var(--text-soft, #666);
}

.computing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(255, 248, 241, 0.8);
  backdrop-filter: blur(4px);
  border-radius: 18px;
  font-size: 0.85rem;
  color: var(--text-soft, #666);
  z-index: 50;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.computing-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(95, 64, 28, 0.2);
  border-top-color: rgba(95, 64, 28, 0.6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>