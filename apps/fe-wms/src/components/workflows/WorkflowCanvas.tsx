/**
 * WorkflowCanvas — React Flow canvas connected to Zustand store.
 *
 * ═══════════════════════════════════════════════════════════════
 * WHY ZUSTAND:
 * Phase 4 used useRef for nodes/edges → ConfigPanel couldn't
 * reactively read node data. Now the store is the single source
 * of truth. React Flow's internal changes (drag, delete) are
 * synced to Zustand via onNodesChange / onEdgesChange.
 *
 * ConfigPanel updates node.data.config → Zustand → React Flow
 * re-renders the affected node automatically.
 * ═══════════════════════════════════════════════════════════════
 */
"use client";

import { useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Node,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { WorkflowNodeType } from "@bduck/shared-types";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { nodeTypesRegistry } from "./nodes";

/**
 * Default label for each node type when first dropped on canvas.
 */
const DEFAULT_LABELS: Record<WorkflowNodeType, string> = {
  [WorkflowNodeType.TRIGGER]: "On Voucher Created",
  [WorkflowNodeType.APPROVAL]: "Approval Step",
  [WorkflowNodeType.SYSTEM_ACTION]: "System Action",
  [WorkflowNodeType.TIMER]: "Wait Timer",
  [WorkflowNodeType.CONDITION]: "Check Condition",
  [WorkflowNodeType.NOTIFICATION]: "Send Notification",
  [WorkflowNodeType.FORK]: "Fork",
  [WorkflowNodeType.JOIN]: "Join",
  [WorkflowNodeType.SUB_WORKFLOW]: "Sub-process",
  [WorkflowNodeType.WEBHOOK]: "Webhook Call",
  [WorkflowNodeType.DATA_INPUT]: "Data Input",
};

let idCounter = 0;
function generateNodeId(): string {
  return `node_${Date.now()}_${idCounter++}`;
}

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // ── Zustand selectors ──
  const nodes = useWorkflowCanvasStore((s) => s.nodes);
  const edges = useWorkflowCanvasStore((s) => s.edges);
  const setNodes = useWorkflowCanvasStore((s) => s.setNodes);
  const setEdges = useWorkflowCanvasStore((s) => s.setEdges);
  const selectNode = useWorkflowCanvasStore((s) => s.selectNode);

  // ── React Flow internal change handlers → sync to Zustand ──
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes));
    },
    [nodes, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges],
  );

  /** Connect two nodes with a directed edge */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(
        addEdge(
          {
            ...connection,
            animated: true,
            style: { strokeWidth: 2, stroke: "var(--color-brand-primary)" },
          },
          edges,
        ),
      );
    },
    [edges, setEdges],
  );

  /** Handle drag from sidebar */
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData(
        "application/workflow-node-type",
      ) as WorkflowNodeType;

      if (!nodeType || !Object.values(WorkflowNodeType).includes(nodeType)) {
        return;
      }

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 20,
      };

      const newNode: Node = {
        id: generateNodeId(),
        type: nodeType,
        position,
        data: {
          label: DEFAULT_LABELS[nodeType] || nodeType,
          config: {},
        },
      };

      setNodes([...nodes, newNode]);
    },
    [nodes, setNodes],
  );

  /** Node click → select in Zustand (opens ConfigPanel) */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  /** Canvas click → deselect */
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypesRegistry}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-[var(--color-surface-base)]"
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2, stroke: "var(--color-brand-primary)" },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--color-border-subtle)"
        />
        <Controls
          className="!rounded-[var(--radius-md)] !border !border-[var(--color-border-subtle)] !bg-white !shadow-sm"
          showInteractive={false}
        />
        <MiniMap
          className="!rounded-[var(--radius-md)] !border !border-[var(--color-border-subtle)] !bg-white !shadow-sm"
          nodeColor="#6366f1"
          maskColor="rgba(0,0,0,0.06)"
        />
      </ReactFlow>
    </div>
  );
}
