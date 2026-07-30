import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleEmployeeDetailTabs } from "./employeeDetailTabPolicy";

test("chỉ hiển thị hồ sơ khi không có quyền nghiệp vụ", () => {
  assert.deepEqual(
    getVisibleEmployeeDetailTabs({
      canReadContracts: false,
      canReadLeaveBalance: false,
      canReadLeaveRequests: false,
      canViewAttendance: false,
    }),
    ["profile"],
  );
});

test("quyền xem số phép vẫn hiển thị tab nghỉ phép mà không lộ lịch sử", () => {
  assert.deepEqual(
    getVisibleEmployeeDetailTabs({
      canReadContracts: false,
      canReadLeaveBalance: true,
      canReadLeaveRequests: false,
      canViewAttendance: false,
    }),
    ["profile", "leave"],
  );
});

test("hiển thị các tab theo đúng thứ tự khi có đầy đủ quyền", () => {
  assert.deepEqual(
    getVisibleEmployeeDetailTabs({
      canReadContracts: true,
      canReadLeaveBalance: true,
      canReadLeaveRequests: true,
      canViewAttendance: true,
    }),
    ["profile", "contracts", "leave", "attendance"],
  );
});
