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
