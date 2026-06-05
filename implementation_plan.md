# Implement Requirement Toggles (Evidence & OTP) for Process Configs

This plan addresses the requirement to activate the "bắt buộc bằng chứng" (now "bắt buộc tải lên chứng từ") and "bắt buộc quét barcode" (now "bắt buộc OTP") toggles, and enforce them during voucher creation and approval.

## User Review Required

> [!IMPORTANT]
> Because these settings apply to the **Creation** phase and the **Approval** phase (which are independent of specific warehousing steps like "Picking" or "Receiving"), I propose moving these two toggles out of the "Điều kiện thao tác" (Step Options) section and into the **Global Settings** of the Process Config (next to the "Tự động duyệt" toggle). This makes it clear that they apply to the entire voucher lifecycle (Creation & Approval). Please let me know if you prefer to keep them strictly inside the specific operation steps instead.

## Open Questions

1. **OTP Fallback**: If a user has not set up MFA/OTP, should they be blocked from creating/approving vouchers when `bắt buộc OTP` is enabled? (I will assume YES, they will be prompted to set it up or enter OTP if already set up).
2. **Evidence Validation**: Should the "Bắt buộc tải lên chứng từ" validation strictly check if at least one file is attached to the voucher creation payload? (I will assume YES).

## Proposed Changes

### Database Schema & Types

#### [MODIFY] [packages/shared-types/src/process.ts](file:///d:/Github/bduck-system/packages/shared-types/src/process.ts)
- Add `require_evidence` and `require_otp` as boolean fields to the top-level `ProcessConfig` interface.
- Remove `require_evidence` and `require_barcode_scan` from `StepOption` interface since they are now global to the config.

---

### Backend Logic

#### [MODIFY] [apps/be-wms/src/services/processConfigService.ts](file:///d:/Github/bduck-system/apps/be-wms/src/services/processConfigService.ts)
- Update `processConfigSchema` to parse and validate `require_evidence` and `require_otp` at the root level.
- Remove `require_evidence` and `require_barcode_scan` from the `step_options` schema.

#### [MODIFY] [apps/be-wms/src/services/importVoucherService.ts](file:///d:/Github/bduck-system/apps/be-wms/src/services/importVoucherService.ts)
#### [MODIFY] [apps/be-wms/src/services/exportVoucherService.ts](file:///d:/Github/bduck-system/apps/be-wms/src/services/exportVoucherService.ts)
#### [MODIFY] [apps/be-wms/src/services/transferOrderService.ts](file:///d:/Github/bduck-system/apps/be-wms/src/services/transferOrderService.ts)
- In the `create` functions, fetch the `ProcessConfig`.
- If `require_evidence` is true, verify that the payload contains at least one attached document/file.
- If `require_otp` is true, verify the provided OTP via `mfaService.verifyTotpToken` before allowing creation.

#### [MODIFY] [apps/be-wms/src/services/approvalService.ts](file:///d:/Github/bduck-system/apps/be-wms/src/services/approvalService.ts)
- In `approveLevel`, fetch the `ProcessConfig` for the entity.
- If `require_otp` is true, verify the provided OTP via `mfaService.verifyTotpToken` before committing the approval.

#### [MODIFY] [apps/be-wms/src/api/routes/](file:///d:/Github/bduck-system/apps/be-wms/src/api/routes/)
- Update the create and approve controllers/routes to accept an optional `otp` field in the request body.

---

### Frontend UI

#### [MODIFY] [apps/fe-wms/src/components/process-configs/processConfigMeta.ts](file:///d:/Github/bduck-system/apps/fe-wms/src/components/process-configs/processConfigMeta.ts)
- Update translation labels to "Bắt buộc tải lên chứng từ" and "Bắt buộc OTP".
- Add text constants for the new global toggles.

#### [MODIFY] [apps/fe-wms/src/components/process-configs/ProcessConfigWorkspace.tsx](file:///d:/Github/bduck-system/apps/fe-wms/src/components/process-configs/ProcessConfigWorkspace.tsx)
- Add the toggles for `require_evidence` and `require_otp` at the top level (e.g., next to "Auto Approve").

#### [MODIFY] [apps/fe-wms/src/components/process-configs/StepOptionsEditor.tsx](file:///d:/Github/bduck-system/apps/fe-wms/src/components/process-configs/StepOptionsEditor.tsx)
- Remove the old `requireEvidence` and `requireBarcode` toggles from the per-step options.

#### [MODIFY] [apps/fe-wms/src/components/features/.../CreateForms](file:///d:/Github/bduck-system/apps/fe-wms/src/components/features/)
- When submitting Import, Export, or Transfer Vouchers:
  - Check local state/config. If `require_evidence` is true, block submission if no files are uploaded.
  - If `require_otp` is true, pop up an OTP verification modal (using `MFASetupModal` or a new `OTPVerifyDialog` component) to collect the OTP before making the API call. Include the `otp` in the payload.

#### [MODIFY] [apps/fe-wms/src/components/approval/ApprovalActionModal.tsx](file:///d:/Github/bduck-system/apps/fe-wms/src/components/approval/ApprovalActionModal.tsx)
- If the current entity config has `require_otp` enabled, require the user to input their OTP in the approval modal before submitting the "Approve" action. Include `otp` in the payload.

## Verification Plan

### Automated Tests
- Type checking will ensure that the new `require_evidence` and `require_otp` properties are respected globally.

### Manual Verification
1. Configure `IMPORT_VOUCHER` to require evidence and require OTP.
2. Attempt to create an Import Voucher without a file -> Should fail with UI alert.
3. Attempt to create an Import Voucher with a file but without OTP -> Should prompt for OTP.
4. Input valid OTP -> Creation succeeds.
5. Log in as approver. Attempt to approve without OTP -> Should prompt for OTP.
6. Input valid OTP -> Approval succeeds.
