import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleEmployeeDetailTabs } from "./employeeDetailTabPolicy";

test("chỉ hiển thị hồ sơ khi không có quyền nghiệp vụ", () => {
  assert.deepEqual(
    getVisibleEmployeeDetailTabs({
      canReadContracts: false,
      canReadLeaveBalance: false,
      canReadLeaveRequests: false,
      canManageLeave: false,
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
      canManageLeave: false,
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
      canManageLeave: true,
      canViewAttendance: true,
    }),
    ["profile", "contracts", "leave", "attendance"],
  );
});

test("quyền quản lý phép hiển thị tab để thao tác theo nhân viên", () => {
  assert.deepEqual(
    getVisibleEmployeeDetailTabs({
      canReadContracts: false,
      canReadLeaveBalance: false,
      canReadLeaveRequests: false,
      canManageLeave: true,
      canViewAttendance: false,
    }),
    ["profile", "leave"],
  );
});
