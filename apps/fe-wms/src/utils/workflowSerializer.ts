/**
 * Workflow Serializer — converts React Flow state to Zod-validated DAG format.
 *
 * React Flow's Node/Edge types have extra fields (measured, selected, dragging, etc.)
 * that the backend Zod schema will reject. This utility strips them down to exactly
 * the shape that `saveWorkflowVersionSchema` expects.
 */

import type { Node, Edge } from "@xyflow/react";

interface SerializedNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  source_handle: string | null;
  label: string | null;
}

export interface SerializedDag {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

/**
 * Serialize React Flow nodes + edges into the backend DAG format.
 *
 * Node mapping:
 *   - node.type → WorkflowNodeType (already matches)
 *   - node.data.label → label
 *   - node.data.config → config (type-specific settings from NodeConfigPanel)
 *   - node.position → { x, y }
 *
 * Edge mapping:
 *   - edge.sourceHandle → source_handle
 *   - edge.label → label (cast to string | null)
 */
export function serializeCanvasToDAG(
  nodes: Node[],
  edges: Edge[],
): SerializedDag {
  const serializedNodes: SerializedNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type || "TRIGGER",
    label: (node.data?.label as string) || node.type || "Unnamed",
    position: {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    },
    config: (node.data?.config as Record<string, unknown>) || {},
  }));

  const serializedEdges: SerializedEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    source_handle: edge.sourceHandle || null,
    label: typeof edge.label === "string" ? edge.label : null,
  }));

  return { nodes: serializedNodes, edges: serializedEdges };
}

// ─────────────────────────────────────────────
// DESERIALIZE: Backend DAG → React Flow canvas state
// ─────────────────────────────────────────────

/**
 * Convert saved DAG (from Firestore version) back into React Flow
 * Nodes + Edges to populate the canvas store.
 *
 * This is the reverse of `serializeCanvasToDAG`.
 */
export function deserializeDAGToCanvas(
  dag: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      source_handle?: string | null;
      label?: string | null;
    }>;
  },
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = dag.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: {
      label: n.label,
      config: n.config || {},
    },
  }));

  const edges: Edge[] = dag.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.source_handle || undefined,
    animated: true,
    style: { strokeWidth: 2, stroke: "var(--color-brand-primary)" },
    label: e.label || undefined,
  }));

  return { nodes, edges };
}
