import {
  AttendanceCheckInMethod,
  AttendanceLocationRule,
  AttendanceRejectedReason,
  AttendanceVerificationStrategy,
  AttendanceWorkArrangementType,
  AttendanceWorkMode,
  type AttendanceCoordinate,
  type AttendanceLocationInput,
  type AttendanceWorkArrangement,
  type WarehouseAttendancePolicy,
} from "@bduck/shared-types";

export interface AttendanceLocationDecision {
  accepted: boolean;
  method: AttendanceCheckInMethod | null;
  workMode: AttendanceWorkMode | null;
  distanceFromTargetM: number | null;
  arrangement: AttendanceWorkArrangement | null;
  rejectedReason: AttendanceRejectedReason | null;
}

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (value: number) => (value * Math.PI) / 180;

export const distanceInMeters = (
  from: AttendanceCoordinate,
  to: AttendanceCoordinate,
) => {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_M *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const reject = (
  rejectedReason: AttendanceRejectedReason,
): AttendanceLocationDecision => ({
  accepted: false,
  method: null,
  workMode: null,
  distanceFromTargetM: null,
  arrangement: null,
  rejectedReason,
});

const validateLocation = (
  location: AttendanceLocationInput | undefined,
  policy: WarehouseAttendancePolicy,
  now: Date,
) => {
  if (!location) return AttendanceRejectedReason.LOCATION_REQUIRED;
  if (location.accuracy_m > policy.gps_max_accuracy_m) {
    return AttendanceRejectedReason.GPS_ACCURACY_LOW;
  }
  const capturedAt = new Date(location.captured_at);
  if (
    Number.isNaN(capturedAt.getTime()) ||
    Math.abs(now.getTime() - capturedAt.getTime()) >
      policy.gps_max_age_seconds * 1_000
  ) {
    return AttendanceRejectedReason.GPS_STALE;
  }
  return null;
};

const verifyTarget = (
  location: AttendanceLocationInput,
  coordinate: AttendanceCoordinate | null,
  radiusM: number,
) => {
  if (!coordinate) {
    return {
      accepted: false,
      distance: null,
      reason: AttendanceRejectedReason.WORKPLACE_COORDINATE_MISSING,
    };
  }
  const distance = distanceInMeters(location, coordinate);
  return {
    accepted: distance <= radiusM,
    distance,
    reason:
      distance <= radiusM
        ? null
        : AttendanceRejectedReason.OUTSIDE_GEOFENCE,
  };
};

export const evaluateAttendanceLocation = (input: {
  policy: WarehouseAttendancePolicy;
  matchedIp: boolean;
  location?: AttendanceLocationInput;
  workplaceCoordinate: AttendanceCoordinate | null;
  arrangement: AttendanceWorkArrangement | null;
  now?: Date;
}): AttendanceLocationDecision => {
  const { policy, matchedIp, location, workplaceCoordinate, arrangement } =
    input;
  const strategy = policy.verification_strategy;
  const needsGps =
    strategy === AttendanceVerificationStrategy.GPS_ONLY ||
    strategy === AttendanceVerificationStrategy.IP_AND_GPS ||
    (strategy === AttendanceVerificationStrategy.IP_OR_GPS && !matchedIp);

  if (!needsGps && matchedIp) {
    return {
      accepted: true,
      method: AttendanceCheckInMethod.IP,
      workMode: AttendanceWorkMode.ONSITE,
      distanceFromTargetM: null,
      arrangement: null,
      rejectedReason: null,
    };
  }
  if (strategy === AttendanceVerificationStrategy.IP_ONLY) {
    return reject(AttendanceRejectedReason.INVALID_IP);
  }

  const invalidLocation = validateLocation(
    location,
    policy,
    input.now || new Date(),
  );
  if (invalidLocation || !location) {
    return reject(invalidLocation || AttendanceRejectedReason.LOCATION_REQUIRED);
  }

  const office = verifyTarget(
    location,
    workplaceCoordinate,
    policy.gps_radius_m,
  );
  if (office.accepted) {
    if (
      strategy === AttendanceVerificationStrategy.IP_AND_GPS &&
      !matchedIp
    ) {
      return reject(AttendanceRejectedReason.INVALID_IP);
    }
    return {
      accepted: true,
      method: matchedIp
        ? AttendanceCheckInMethod.IP_GPS
        : AttendanceCheckInMethod.GPS,
      workMode: AttendanceWorkMode.ONSITE,
      distanceFromTargetM: office.distance,
      arrangement: null,
      rejectedReason: null,
    };
  }

  if (!arrangement) {
    return reject(AttendanceRejectedReason.REMOTE_ARRANGEMENT_REQUIRED);
  }

  const allowed =
    (arrangement.type === AttendanceWorkArrangementType.BUSINESS_TRIP &&
      policy.allow_business_trip) ||
    (arrangement.type === AttendanceWorkArrangementType.WORK_FROM_HOME &&
      policy.allow_work_from_home);
  if (!allowed) {
    return reject(AttendanceRejectedReason.REMOTE_ARRANGEMENT_REQUIRED);
  }

  let distance: number | null = null;
  if (arrangement.location_rule === AttendanceLocationRule.GEOFENCE) {
    const target = verifyTarget(
      location,
      arrangement.destination_coordinate,
      arrangement.radius_m || policy.gps_radius_m,
    );
    if (!target.accepted) {
      return reject(
        target.reason || AttendanceRejectedReason.OUTSIDE_GEOFENCE,
      );
    }
    distance = target.distance;
  }

  return {
    accepted: true,
    method: AttendanceCheckInMethod.GPS,
    workMode:
      arrangement.type === AttendanceWorkArrangementType.BUSINESS_TRIP
        ? AttendanceWorkMode.BUSINESS_TRIP
        : AttendanceWorkMode.WORK_FROM_HOME,
    distanceFromTargetM: distance,
    arrangement,
    rejectedReason: null,
  };
};
