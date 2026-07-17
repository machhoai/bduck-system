import {
  autoSubmitQueuedLocations,
  getAutoSubmitSchedule,
  runScheduledAutoSubmit,
  updateAutoSubmitSchedule,
} from "./externalQueueAutomationController.js";
import {
  getApprovalConfig,
  getScannableProductsConfig,
  updateApprovalConfig,
  updateScannableProductsConfig,
} from "./externalQueueConfigController.js";
import {
  approveBatch,
  cancelScan,
  rejectBatch,
  updateScanQuantity,
} from "./externalQueueMutationController.js";
import {
  getHistory,
  getPendingBatches,
} from "./externalQueueReadController.js";

export {
  approveBatch,
  autoSubmitQueuedLocations,
  cancelScan,
  getApprovalConfig,
  getAutoSubmitSchedule,
  getHistory,
  getPendingBatches,
  getScannableProductsConfig,
  rejectBatch,
  runScheduledAutoSubmit,
  updateApprovalConfig,
  updateAutoSubmitSchedule,
  updateScanQuantity,
  updateScannableProductsConfig,
};

export default {
  approveBatch,
  autoSubmitQueuedLocations,
  cancelScan,
  getApprovalConfig,
  getAutoSubmitSchedule,
  getHistory,
  getPendingBatches,
  getScannableProductsConfig,
  rejectBatch,
  runScheduledAutoSubmit,
  updateApprovalConfig,
  updateAutoSubmitSchedule,
  updateScanQuantity,
  updateScannableProductsConfig,
};
