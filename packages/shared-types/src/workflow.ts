// Dynamic Workflow Engine — Schema & Runtime Types
// ============================================================
// Replaces the legacy ApprovalWorkflow interface.
// Firestore Collections:
//   workflow_definitions              → WorkflowDefinition
//   workflow_definitions/{id}/versions → WorkflowVersion (immutable DAG)
//   workflow_instances                → WorkflowInstance  (runtime)
//   workflow_instances/{id}/tasks     → WorkflowTask      (per-node state)
// ============================================================

import {
    ApprovalEntityType,
    ApprovalMethod,
    WorkflowDefinitionStatus,
    WorkflowNodeType,
    WorkflowInstanceStatus,
    WorkflowTaskStatus,
    ConditionOperator,
    NotificationChannel,
    TimeoutAction,
    JoinType,
    WebhookMethod,
} from "./enums.js";

// ─────────────────────────────────────────────
// NODE CONFIGS (discriminated by WorkflowNodeType)
// ─────────────────────────────────────────────

/** Trigger: the entry point of a workflow */
export interface TriggerNodeConfig {
    /** Domain event that starts this workflow, e.g. "VOUCHER_CREATED" */
    event: string;
}

/** Human approval step */
export interface ApprovalNodeConfig {
    /** Role that should approve (null = use assigned_user_id) */
    assigned_role_id: string | null;
    /** Specific user (null = use assigned_role_id) */
    assigned_user_id: string | null;
    /** Approval method (standard or requires re-auth) */
    approval_method: ApprovalMethod;
    /** Hours before timeout triggers timeout_action (null = no timeout) */
    timeout_hours: number | null;
    /** What happens on timeout */
    timeout_action: TimeoutAction | null;
}

/** Automated system action */
export interface SystemActionNodeConfig {
    /**
     * Built-in action identifier.
     * Examples: "UPDATE_INVENTORY", "AUTO_APPROVE", "CHANGE_STATUS",
     *           "CREATE_NONCONFORMITY_REPORT"
     */
    action_type: string;
    /** Action-specific parameters (schema depends on action_type) */
    params: Record<string, unknown>;
}

/** Wait for a duration before advancing */
export interface TimerNodeConfig {
    duration_hours: number;
    duration_minutes: number;
}

/** If/Else branching logic */
export interface ConditionNodeConfig {
    /** Entity field path to evaluate, e.g. "actual_quantity" */
    field: string;
    /** Comparison operator */
    operator: ConditionOperator;
    /** Value to compare against */
    value: unknown;
    // Edges: source_handle = "true" | "false"
}

/** Send notification to users/roles */
export interface NotificationNodeConfig {
    channel: NotificationChannel;
    target_role_id: string | null;
    target_user_id: string | null;
    /** i18n template key for the notification content */
    template_key: string;
}

/** Fork: no config needed, just splits flow via edges */
export interface ForkNodeConfig {
    /** Reserved for future use */
    _reserved?: never;
}

/** Join: waits for parallel branches to converge */
export interface JoinNodeConfig {
    /** ALL = wait for every incoming branch, ANY = first one wins */
    join_type: JoinType;
}

/** Invoke another workflow as a sub-process */
export interface SubWorkflowNodeConfig {
    /** The child workflow definition ID to invoke */
    workflow_definition_id: string;
}

/** Call an external HTTP endpoint */
export interface WebhookNodeConfig {
    url: string;
    method: WebhookMethod;
    headers: Record<string, string>;
    /** JSON body template with {{variable}} placeholders */
    body_template: string | null;
    timeout_seconds: number;
}

/** Human data-entry step (e.g., Receiving Session, Quality Inspection) */
export interface DataInputNodeConfig {
    /**
     * Which FE screen to render:
     *   "RECEIVING_SESSION" — warehouse staff inputs actual_quantity per item
     *   "QUALITY_INSPECTION" — QC inputs condition per item
     *   Custom strings allowed for future input types.
     */
    input_type: string;
    /** Role required to perform data input (null = any authenticated user) */
    assigned_role_id: string | null;
}

/** Union of all node configs — discriminated by node.type at runtime */
export type WorkflowNodeConfig =
    | TriggerNodeConfig
    | ApprovalNodeConfig
    | SystemActionNodeConfig
    | TimerNodeConfig
    | ConditionNodeConfig
    | NotificationNodeConfig
    | ForkNodeConfig
    | JoinNodeConfig
    | SubWorkflowNodeConfig
    | WebhookNodeConfig
    | DataInputNodeConfig;

// ─────────────────────────────────────────────
// WORKFLOW NODE & EDGE (embedded in WorkflowVersion)
// ─────────────────────────────────────────────

/**
 * A single node in the visual workflow canvas.
 * Serialized from @xyflow/react's Node type.
 */
export interface WorkflowNode {
    /** Unique node ID within the version (UUID) */
    id: string;
    /** Node classification */
    type: WorkflowNodeType;
    /** Display label set by admin */
    label: string;
    /** Canvas position (x, y) */
    position: { x: number; y: number };
    /** Type-specific configuration */
    config: WorkflowNodeConfig;
}

/**
 * A directed edge connecting two nodes.
 * Serialized from @xyflow/react's Edge type.
 */
export interface WorkflowEdge {
    /** Unique edge ID within the version (UUID) */
    id: string;
    /** Source node ID */
    source: string;
    /** Target node ID */
    target: string;
    /**
     * Handle identifier on source node.
     * For ConditionNode: "true" | "false"
     * For ForkNode: branch label
     * null for single-output nodes
     */
    source_handle: string | null;
    /** Optional display label on the edge */
    label: string | null;
}

// ─────────────────────────────────────────────
// WORKFLOW DEFINITION (Firestore: workflow_definitions)
// ─────────────────────────────────────────────

/**
 * Top-level workflow blueprint.
 * An Admin creates a definition, then publishes versioned DAGs within it.
 *
 * Multiple definitions can exist for the same entity_type
 * (scoped by warehouse_ids).
 */
export interface WorkflowDefinition {
    id: string;
    /** Human-readable name, e.g. "Quy trình nhập kho - Kho chính" */
    name: string;
    description: string | null;
    /** Which entity type this workflow handles */
    entity_type: ApprovalEntityType;
    /** Warehouse scope — null means global (all warehouses) */
    scope_warehouse_ids: string[] | null;
    /** Lifecycle status */
    status: WorkflowDefinitionStatus;
    /** Currently active version (FK → versions subcollection) */
    current_version_id: string | null;
    /** Admin who created this definition */
    created_by: string;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

// ─────────────────────────────────────────────
// WORKFLOW VERSION (Firestore: workflow_definitions/{id}/versions)
// ─────────────────────────────────────────────

/**
 * Immutable snapshot of the DAG at a point in time.
 * Once published, a version is NEVER modified — new changes create a new version.
 * Vouchers reference version_id, so running processes are safe from edits.
 */
export interface WorkflowVersion {
    id: string;
    /** Parent definition ID (denormalized for queries) */
    workflow_definition_id: string;
    /** Auto-incrementing version number within the definition */
    version_number: number;
    /** The complete DAG */
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    /** null = draft version, Date = published */
    published_at: Date | null;
    published_by: string | null;
    created_at: Date;
}

// ─────────────────────────────────────────────
// WORKFLOW INSTANCE (Firestore: workflow_instances)
// ─────────────────────────────────────────────

/**
 * Runtime record: a specific voucher/entity running through a workflow.
 *
 * When a voucher is created, the engine:
 * 1. Finds the matching WorkflowDefinition
 * 2. Creates a WorkflowInstance referencing the current_version_id
 * 3. Begins traversal from the TriggerNode
 */
export interface WorkflowInstance {
    id: string;
    workflow_definition_id: string;
    /** Denormalized facility scope; null means an explicitly global workflow. */
    warehouse_id?: string | null;
    /** Immutable reference — safe from admin edits */
    workflow_version_id: string;
    entity_type: ApprovalEntityType;
    /** The voucher/order ID this instance processes */
    entity_id: string;
    status: WorkflowInstanceStatus;
    /** Current active node(s) — multiple if parallel branches */
    current_node_ids: string[];
    /** User who triggered the workflow (created the voucher) */
    started_by: string;
    started_at: Date;
    completed_at: Date | null;
    /** ISO audit timestamps */
    action_time: Date;
    sync_time: Date;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

// ─────────────────────────────────────────────
// WORKFLOW TASK (Firestore: workflow_instances/{id}/tasks)
// ─────────────────────────────────────────────

/**
 * One task per node execution within an instance.
 *
 * For ApprovalNode → assigned to a user/role, waits for human action.
 * For SystemActionNode → executed immediately by the engine.
 * For TimerNode → scheduled, completes when timer fires.
 * For ConditionNode → evaluated instantly, result stored.
 */
export interface WorkflowTask {
    id: string;
    /** Parent instance ID (denormalized) */
    instance_id: string;
    /** Denormalized facility scope for collection-group queries. */
    warehouse_id?: string | null;
    /** The node ID from WorkflowVersion.nodes[] */
    node_id: string;
    /** Denormalized node type for query convenience */
    node_type: WorkflowNodeType;
    status: WorkflowTaskStatus;
    /** For approval tasks: who should act */
    assigned_to: string | null;
    assigned_role_id: string | null;
    /** Who completed this task (null for system tasks) */
    completed_by: string | null;
    /**
     * Structured result of the task execution.
     * ApprovalNode: { approved: boolean, comments: string }
     * ConditionNode: { result: true | false }
     * WebhookNode: { status_code: number, body: unknown }
     */
    result: Record<string, unknown> | null;
    started_at: Date;
    completed_at: Date | null;
    /** For timer/timeout nodes */
    due_at: Date | null;
    /** ISO audit timestamps */
    action_time: Date;
    sync_time: Date;
    created_at: Date;
}
