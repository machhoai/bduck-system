/**
 * DAG Validation Utilities for Workflow Builder
 *
 * Validates that a workflow graph is a valid Directed Acyclic Graph:
 * 1. Exactly 1 TriggerNode
 * 2. No orphan nodes (all nodes reachable from trigger)
 * 3. No cycles (acyclic guarantee)
 * 4. All nodes connected
 */

import { WorkflowNodeType } from "@bduck/shared-types";

interface GraphNode {
  id: string;
  type: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a workflow DAG for structural correctness.
 */
export function validateWorkflowDAG(
  nodes: GraphNode[],
  edges: GraphEdge[],
): ValidationResult {
  const errors: string[] = [];

  if (nodes.length === 0) {
    return { isValid: false, errors: ["Graph is empty."] };
  }

  // 1. Exactly 1 TriggerNode
  const triggerNodes = nodes.filter(
    (n) => n.type === WorkflowNodeType.TRIGGER,
  );
  if (triggerNodes.length === 0) {
    errors.push("NO_TRIGGER");
  } else if (triggerNodes.length > 1) {
    errors.push("MULTIPLE_TRIGGERS");
  }

  // 2. Build adjacency lists
  const adjacencyList = new Map<string, string[]>();
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacencyList.get(edge.source)!.push(edge.target);
    }
  }

  // 3. Cycle detection (DFS with color marking)
  if (hasCycle(adjacencyList, nodeIds)) {
    errors.push("CYCLIC_GRAPH");
  }

  // 4. Orphan detection — all nodes should be reachable from trigger
  if (triggerNodes.length === 1) {
    const reachable = new Set<string>();
    bfs(triggerNodes[0].id, adjacencyList, reachable);

    const orphans = nodes.filter((n) => !reachable.has(n.id));
    if (orphans.length > 0) {
      errors.push("ORPHAN_NODES");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Detect cycles using DFS 3-color algorithm.
 * WHITE (unvisited) → GRAY (in stack) → BLACK (fully processed)
 */
function hasCycle(
  adj: Map<string, string[]>,
  nodeIds: Set<string>,
): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const id of nodeIds) {
    color.set(id, WHITE);
  }

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GRAY);
    const neighbors = adj.get(nodeId) || [];

    for (const neighbor of neighbors) {
      if (color.get(neighbor) === GRAY) return true; // Back edge = cycle
      if (color.get(neighbor) === WHITE && dfs(neighbor)) return true;
    }

    color.set(nodeId, BLACK);
    return false;
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE && dfs(id)) {
      return true;
    }
  }

  return false;
}

/**
 * BFS traversal to find all reachable nodes from a starting node.
 */
function bfs(
  startId: string,
  adj: Map<string, string[]>,
  visited: Set<string>,
): void {
  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}
