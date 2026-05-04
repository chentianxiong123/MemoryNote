<script setup lang="ts">
import Graph from "graphology";
import Sigma from "sigma";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

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
}>();

const emit = defineEmits<{
  "node-select": [nodeId: string];
  "edge-select": [edgeId: string];
}>();

const containerRef = ref<HTMLDivElement | null>(null);

let sigma: Sigma | null = null;
let graph: Graph | null = null;

function colorForType(type: string) {
  const palette: Record<string, string> = {
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

  return palette[type] || "#8f5f2b";
}

const layoutData = computed(() => {
  const centerNodes = props.nodes.filter((node) => node.primary);
  const outerNodes = props.nodes.filter((node) => !node.primary);
  const result = new Map<string, { x: number; y: number; size: number; color: string }>();

  const centerRadius = centerNodes.length <= 1 ? 0 : 0.18;
  centerNodes.forEach((node, index) => {
    const angle = centerNodes.length === 1 ? 0 : (index / centerNodes.length) * Math.PI * 2;
    result.set(node.id, {
      x: Math.cos(angle) * centerRadius,
      y: Math.sin(angle) * centerRadius,
      size: 16,
      color: colorForType(node.type),
    });
  });

  const grouped = new Map<string, GraphNode[]>();
  for (const node of outerNodes) {
    const current = grouped.get(node.type) ?? [];
    current.push(node);
    grouped.set(node.type, current);
  }

  const entries = Array.from(grouped.entries()).sort(([left], [right]) =>
    left.localeCompare(right, "zh-CN"),
  );

  entries.forEach(([type, nodes], groupIndex) => {
    const groupAngle = (groupIndex / Math.max(entries.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const groupCenterX = Math.cos(groupAngle) * 0.62;
    const groupCenterY = Math.sin(groupAngle) * 0.46;
    const orbitRadius = Math.max(0.08, 0.03 * Math.sqrt(nodes.length));

    nodes.forEach((node, nodeIndex) => {
      const angle = nodes.length === 1 ? 0 : (nodeIndex / nodes.length) * Math.PI * 2;
      result.set(node.id, {
        x: groupCenterX + Math.cos(angle) * orbitRadius,
        y: groupCenterY + Math.sin(angle) * orbitRadius,
        size: 10,
        color: colorForType(type),
      });
    });
  });

  return result;
});

function destroyGraph() {
  sigma?.kill();
  sigma = null;
  graph = null;
}

function applySelectionState() {
  if (!graph) return;

  graph.forEachNode((nodeId) => {
    const node = props.nodes.find((candidate) => candidate.id === nodeId);
    const base = layoutData.value.get(nodeId);
    if (!node || !base) return;

    const active = props.selectedNodeId === nodeId;
    const dimmed =
      !!props.selectedNodeId && props.selectedNodeId !== nodeId && !node.primary;

    graph!.setNodeAttribute(nodeId, "size", active ? base.size * 1.2 : base.size);
    graph!.setNodeAttribute(nodeId, "color", dimmed ? "#d8cec3" : base.color);
  });

  graph.forEachEdge((edgeId) => {
    const active = props.selectedEdgeId === edgeId;
    const dimmed = !!props.selectedEdgeId && props.selectedEdgeId !== edgeId;
    graph!.setEdgeAttribute(edgeId, "color", active ? "#c9633d" : dimmed ? "#e6ddd3" : "#b8a189");
    graph!.setEdgeAttribute(edgeId, "size", active ? 3 : 1.6);
  });

  sigma?.refresh();
}

function mountGraph() {
  destroyGraph();
  if (!containerRef.value) return;

  const nextGraph = new Graph();
  for (const node of props.nodes) {
    const layout = layoutData.value.get(node.id);
    if (!layout) continue;
    nextGraph.addNode(node.id, {
      label: node.label,
      x: layout.x,
      y: layout.y,
      size: layout.size,
      color: layout.color,
      type: node.type,
    });
  }

  for (const edge of props.edges) {
    if (!nextGraph.hasNode(edge.source) || !nextGraph.hasNode(edge.target)) continue;
    nextGraph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      label: edge.label,
      size: 1.6,
      color: "#b8a189",
    });
  }

  graph = nextGraph;
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
  });

  sigma.on("clickNode", ({ node }) => emit("node-select", node));
  sigma.on("clickEdge", ({ edge }) => emit("edge-select", edge));
  applySelectionState();
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
  { deep: true },
);

watch(
  () => [props.selectedNodeId, props.selectedEdgeId],
  () => {
    applySelectionState();
  },
);
</script>

<template>
  <div class="graph-local-view">
    <div v-if="title" class="graph-local-view__head">
      <h3>{{ title }}</h3>
    </div>
    <div ref="containerRef" class="graph-local-view__canvas"></div>
  </div>
</template>

<style scoped>
.graph-local-view {
  display: flex;
  min-height: 440px;
  flex-direction: column;
  gap: 10px;
}

.graph-local-view__head h3 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.1rem;
}

.graph-local-view__canvas {
  min-height: 440px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, rgba(201, 99, 61, 0.07), transparent 14rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 248, 241, 0.92));
  border: 1px solid rgba(95, 64, 28, 0.12);
}
</style>
