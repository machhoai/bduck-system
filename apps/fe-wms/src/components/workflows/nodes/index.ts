/**
 * Barrel export + nodeTypes registry for React Flow.
 * Maps WorkflowNodeType enum values to custom React components.
 */

export { TriggerNode } from "./TriggerNode";
export { ApprovalNode } from "./ApprovalNode";
export { SystemActionNode } from "./SystemActionNode";
export { TimerNode } from "./TimerNode";
export { ConditionNode } from "./ConditionNode";
export { NotificationNode } from "./NotificationNode";
export { ForkNode } from "./ForkNode";
export { JoinNode } from "./JoinNode";
export { SubWorkflowNode } from "./SubWorkflowNode";
export { WebhookNode } from "./WebhookNode";
export { DataInputNode } from "./DataInputNode";

import type { NodeTypes } from "@xyflow/react";
import { TriggerNode } from "./TriggerNode";
import { ApprovalNode } from "./ApprovalNode";
import { SystemActionNode } from "./SystemActionNode";
import { TimerNode } from "./TimerNode";
import { ConditionNode } from "./ConditionNode";
import { NotificationNode } from "./NotificationNode";
import { ForkNode } from "./ForkNode";
import { JoinNode } from "./JoinNode";
import { SubWorkflowNode } from "./SubWorkflowNode";
import { WebhookNode } from "./WebhookNode";
import { DataInputNode } from "./DataInputNode";

/**
 * Pass this to <ReactFlow nodeTypes={nodeTypesRegistry} />
 * Keys MUST match WorkflowNodeType enum values (lowercase).
 */
export const nodeTypesRegistry: NodeTypes = {
  TRIGGER: TriggerNode,
  APPROVAL: ApprovalNode,
  SYSTEM_ACTION: SystemActionNode,
  TIMER: TimerNode,
  CONDITION: ConditionNode,
  NOTIFICATION: NotificationNode,
  FORK: ForkNode,
  JOIN: JoinNode,
  SUB_WORKFLOW: SubWorkflowNode,
  WEBHOOK: WebhookNode,
  DATA_INPUT: DataInputNode,
};
