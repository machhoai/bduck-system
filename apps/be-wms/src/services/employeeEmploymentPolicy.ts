import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
  type EmployeeProfile,
  type LocalizedText,
} from "@bduck/shared-types";

export interface EmployeeEmploymentIssue {
  field:
    | "employment_status"
    | "probation_start_date"
    | "probation_end_date"
    | "official_start_date"
    | "resignation_date"
    | "effective_date";
  messages: LocalizedText;
}

const issue = (
  field: EmployeeEmploymentIssue["field"],
  vi: string,
  zh: string,
): EmployeeEmploymentIssue => ({ field, messages: { vi, zh } });

export const getVietnamLocalDate = (instant = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
};

export const validateEmployeeEmploymentProfile = (
  profile: Pick<
    EmployeeProfile,
    | "employment_status"
    | "probation_start_date"
    | "probation_end_date"
    | "official_start_date"
    | "resignation_date"
  >,
): EmployeeEmploymentIssue[] => {
  const issues: EmployeeEmploymentIssue[] = [];
  const status =
    profile.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;

  if (
    profile.probation_start_date &&
    profile.probation_end_date &&
    profile.probation_end_date < profile.probation_start_date
  ) {
    issues.push(
      issue(
        "probation_end_date",
        "Ngày kết thúc thử việc không được trước ngày bắt đầu thử việc.",
        "试用结束日期不能早于试用开始日期。",
      ),
    );
  }

  if (
    profile.probation_start_date &&
    profile.official_start_date &&
    profile.official_start_date < profile.probation_start_date
  ) {
    issues.push(
      issue(
        "official_start_date",
        "Ngày bắt đầu chính thức không được trước ngày đầu tại công ty.",
        "正式入职日期不能早于到司首日。",
      ),
    );
  }

  if (
    profile.probation_end_date &&
    profile.official_start_date &&
    profile.official_start_date < profile.probation_end_date
  ) {
    issues.push(
      issue(
        "official_start_date",
        "Ngày bắt đầu chính thức không được trước ngày kết thúc thử việc.",
        "正式入职日期不能早于试用结束日期。",
      ),
    );
  }

  const firstWorkingDate =
    profile.official_start_date ?? profile.probation_start_date;
  if (
    firstWorkingDate &&
    profile.resignation_date &&
    profile.resignation_date < firstWorkingDate
  ) {
    issues.push(
      issue(
        "resignation_date",
        "Ngày nghỉ việc không được trước ngày bắt đầu làm việc.",
        "离职日期不能早于入职日期。",
      ),
    );
  }

  if (
    status === EmployeeEmploymentStatus.PROBATION &&
    !profile.probation_start_date
  ) {
    issues.push(
      issue(
        "probation_start_date",
        "Nhân viên thử việc phải có ngày đầu tại công ty.",
        "试用员工必须填写到司首日。",
      ),
    );
  }
  if (
    status === EmployeeEmploymentStatus.OFFICIAL &&
    !profile.official_start_date
  ) {
    issues.push(
      issue(
        "official_start_date",
        "Nhân viên chính thức phải có ngày bắt đầu chính thức.",
        "正式员工必须填写正式入职日期。",
      ),
    );
  }
  if (
    status === EmployeeEmploymentStatus.OFFICIAL &&
    profile.probation_start_date &&
    !profile.probation_end_date
  ) {
    issues.push(
      issue(
        "probation_end_date",
        "Nhân viên chuyển từ thử việc phải có ngày kết thúc thử việc.",
        "试用员工转正时必须填写试用结束日期。",
      ),
    );
  }
  if (
    status === EmployeeEmploymentStatus.RESIGNED &&
    !profile.resignation_date
  ) {
    issues.push(
      issue(
        "resignation_date",
        "Nhân viên nghỉ việc phải có ngày nghỉ việc.",
        "离职员工必须填写离职日期。",
      ),
    );
  }

  return issues;
};

const allowedTargets: Record<
  EmployeeEmploymentStatus,
  EmployeeEmploymentStatus[]
> = {
  [EmployeeEmploymentStatus.UNSPECIFIED]: [
    EmployeeEmploymentStatus.PROBATION,
    EmployeeEmploymentStatus.OFFICIAL,
    EmployeeEmploymentStatus.RESIGNED,
  ],
  [EmployeeEmploymentStatus.PROBATION]: [
    EmployeeEmploymentStatus.OFFICIAL,
    EmployeeEmploymentStatus.RESIGNED,
  ],
  [EmployeeEmploymentStatus.OFFICIAL]: [EmployeeEmploymentStatus.RESIGNED],
  [EmployeeEmploymentStatus.RESIGNED]: [],
};

export const canTransitionEmploymentStatus = (
  fromStatus: EmployeeEmploymentStatus,
  toStatus: EmployeeEmploymentStatus,
): boolean => allowedTargets[fromStatus].includes(toStatus);

export const employmentDatePatchForTransition = (
  toStatus: EmployeeEmploymentStatus,
  effectiveDate: string,
  probationEndDate?: string | null,
): Partial<
  Pick<
    EmployeeProfile,
    | "employment_status"
    | "probation_start_date"
    | "probation_end_date"
    | "official_start_date"
    | "resignation_date"
    | "status"
  >
> => {
  const patch: ReturnType<typeof employmentDatePatchForTransition> = {
    employment_status: toStatus,
  };
  if (toStatus === EmployeeEmploymentStatus.PROBATION) {
    patch.probation_start_date = effectiveDate;
  }
  if (toStatus === EmployeeEmploymentStatus.OFFICIAL) {
    patch.official_start_date = effectiveDate;
    if (probationEndDate !== undefined) {
      patch.probation_end_date = probationEndDate;
    }
  }
  if (toStatus === EmployeeEmploymentStatus.RESIGNED) {
    patch.resignation_date = effectiveDate;
    patch.status = EmployeeProfileStatus.INACTIVE;
  }
  return patch;
};
