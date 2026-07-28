import assert from "node:assert/strict";
import test from "node:test";
import {
  AttendanceLocationRule,
  AttendanceRejectedReason,
  AttendanceVerificationStrategy,
  AttendanceWorkArrangementStatus,
  AttendanceWorkArrangementType,
  AttendanceWorkMode,
  type AttendanceWorkArrangement,
  type WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import { evaluateAttendanceLocation } from "./attendanceLocationPolicy.js";

const now = new Date("2026-07-28T01:00:00.000Z");
const policy: WarehouseAttendancePolicy = {
  id: "policy",
  warehouse_id: "warehouse",
  enabled: true,
  ip_addresses: [],
  verification_strategy: AttendanceVerificationStrategy.IP_OR_GPS,
  gps_radius_m: 150,
  gps_max_accuracy_m: 100,
  gps_max_age_seconds: 120,
  allow_business_trip: true,
  allow_work_from_home: true,
  effective_from: now,
  effective_to: null,
  created_by: "admin",
  created_at: now,
};
const location = {
  latitude: 10.7769,
  longitude: 106.7009,
  accuracy_m: 20,
  captured_at: now.toISOString(),
};
const arrangement: AttendanceWorkArrangement = {
  id: "arrangement",
  warehouse_id: "warehouse",
  user_id: "employee",
  employee_profile_id: "profile",
  employee_id: "E001",
  employee_name: "Employee",
  type: AttendanceWorkArrangementType.WORK_FROM_HOME,
  start_date: "2026-07-28",
  end_date: "2026-07-28",
  location_rule: AttendanceLocationRule.CAPTURE_ONLY,
  destination_name: null,
  destination_coordinate: null,
  radius_m: null,
  reason: "Work from home",
  status: AttendanceWorkArrangementStatus.APPROVED,
  requested_by: "employee",
  approved_by: "admin",
  approved_at: now,
  cancelled_by: null,
  cancelled_at: null,
  created_at: now,
  updated_at: now,
  is_deleted: false,
};

test("accepts an employee inside the workplace geofence", () => {
  const result = evaluateAttendanceLocation({
    policy,
    matchedIp: false,
    location,
    workplaceCoordinate: { latitude: 10.7769, longitude: 106.7009 },
    arrangement: null,
    now,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.workMode, AttendanceWorkMode.ONSITE);
});

test("requires an approved arrangement outside the workplace", () => {
  const result = evaluateAttendanceLocation({
    policy,
    matchedIp: false,
    location,
    workplaceCoordinate: { latitude: 21.0285, longitude: 105.8542 },
    arrangement: null,
    now,
  });
  assert.equal(
    result.rejectedReason,
    AttendanceRejectedReason.REMOTE_ARRANGEMENT_REQUIRED,
  );
});

test("accepts capture-only work from home arrangement", () => {
  const result = evaluateAttendanceLocation({
    policy,
    matchedIp: false,
    location,
    workplaceCoordinate: { latitude: 21.0285, longitude: 105.8542 },
    arrangement,
    now,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.workMode, AttendanceWorkMode.WORK_FROM_HOME);
});

test("rejects stale GPS snapshots", () => {
  const result = evaluateAttendanceLocation({
    policy,
    matchedIp: false,
    location: {
      ...location,
      captured_at: "2026-07-27T00:00:00.000Z",
    },
    workplaceCoordinate: { latitude: 10.7769, longitude: 106.7009 },
    arrangement: null,
    now,
  });
  assert.equal(result.rejectedReason, AttendanceRejectedReason.GPS_STALE);
});

test("validates a business-trip destination geofence", () => {
  const businessTrip: AttendanceWorkArrangement = {
    ...arrangement,
    type: AttendanceWorkArrangementType.BUSINESS_TRIP,
    location_rule: AttendanceLocationRule.GEOFENCE,
    destination_coordinate: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    radius_m: 100,
  };
  const result = evaluateAttendanceLocation({
    policy,
    matchedIp: false,
    location,
    workplaceCoordinate: { latitude: 21.0285, longitude: 105.8542 },
    arrangement: businessTrip,
    now,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.workMode, AttendanceWorkMode.BUSINESS_TRIP);
});

test("rejects GPS snapshots with low accuracy", () => {
  const result = evaluateAttendanceLocation({
    policy,
    matchedIp: false,
    location: { ...location, accuracy_m: 250 },
    workplaceCoordinate: { latitude: location.latitude, longitude: location.longitude },
    arrangement: null,
    now,
  });
  assert.equal(
    result.rejectedReason,
    AttendanceRejectedReason.GPS_ACCURACY_LOW,
  );
});
