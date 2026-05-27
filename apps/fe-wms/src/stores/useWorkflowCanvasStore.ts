/**
 * Zustand Store — Workflow Canvas State
 *
 * ═══════════════════════════════════════════════════════════════
 * Shared state between WorkflowCanvas (nodes/edges) and
 * NodeConfigPanel (config editing).
 *
 * WHY ZUSTAND OVER useRef:
 * - useRef doesn't trigger re-renders → ConfigPanel can't
 *   reactively read node.data.config
 * - Zustand gives both Canvas and ConfigPanel a single source
 *   of truth with selective subscriptions (no unnecessary renders)
 *
 * updateNodeConfig merges config fields so individual sub-forms
 * only need to pass their changed fields (on-blur strategy).
 * ═══════════════════════════════════════════════════════════════
 */

import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

/** Shape of node.data stored inside React Flow nodes */
export interface WorkflowNodeData {
  label: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

interface WorkflowCanvasState {
  /** All nodes on the canvas */
  nodes: Node[];
  /** All edges on the canvas */
  edges: Edge[];
  /** Currently selected node ID (null = nothing selected) */
  selectedNodeId: string | null;

  /** Replace entire nodes array (used by React Flow onNodesChange) */
  setNodes: (nodes: Node[]) => void;
  /** Replace entire edges array (used by React Flow onEdgesChange) */
  setEdges: (edges: Edge[]) => void;
  /** Select a node by ID (null to deselect) */
  selectNode: (nodeId: string | null) => void;

  /**
   * Update a node's display label.
   * Called from the "Label" input in NodeConfigPanel.
   */
  updateNodeLabel: (nodeId: string, label: string) => void;

  /**
   * Merge config fields into node.data.config.
   * Called by sub-form components on blur.
   *
   * @example
   *   updateNodeConfig("node_1", { assigned_role_id: "role-abc" })
   *   // → node.data.config = { ...existing, assigned_role_id: "role-abc" }
   */
  updateNodeConfig: (
    nodeId: string,
    config: Record<string, unknown>,
  ) => void;
}

/**
 * Helper: immutably update a single node's data within the nodes array.
 */
function mapNode(
  nodes: Node[],
  nodeId: string,
  updater: (data: WorkflowNodeData) => WorkflowNodeData,
): Node[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const currentData = (node.data || {
      label: "",
      config: {},
    }) as WorkflowNodeData;
    return { ...node, data: updater(currentData) };
  });
}

export const useWorkflowCanvasStore = create<WorkflowCanvasState>()(
  (set) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    updateNodeLabel: (nodeId, label) =>
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, (data) => ({
          ...data,
          label,
        })),
      })),

    updateNodeConfig: (nodeId, config) =>
      set((state) => ({
        nodes: mapNode(state.nodes, nodeId, (data) => ({
          ...data,
          config: { ...data.config, ...config },
        })),
      })),
  }),
);
