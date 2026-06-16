import { z } from "zod";
import { db } from "../config/firebase.js";

const COLLECTION_NAME = "system_configs";
const DOC_ID = "external_queue_auto_submit";
const GMT_7_OFFSET_MINUTES = 7 * 60;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ExternalQueueAutoSubmitSchedule = {
  id: string;
  enabled: boolean;
  times: string[];
  timezone: "GMT+7";
  last_run_key?: string | null;
  last_run_at?: Date | null;
  last_run_result?: {
    submitted_batches: number;
    submitted_scans: number;
  } | null;
  updated_at?: Date | null;
  updated_by?: string | null;
};

const normalizeTimes = (times: string[]) =>
  Array.from(new Set(times.map((time) => time.trim()).filter(Boolean))).sort();

const parseEnvTimes = () => {
  const raw =
    process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_TIMES ??
    process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_TIME;
  if (!raw) return [];

  return normalizeTimes(raw.split(",")).filter((time) =>
    TIME_PATTERN.test(time),
  );
};

export const updateAutoSubmitScheduleSchema = z.object({
  enabled: z.boolean(),
  times: z
    .array(z.string().regex(TIME_PATTERN, "Time must use HH:mm format"))
    .min(1)
    .max(24),
});

export type UpdateAutoSubmitScheduleInput = z.infer<
  typeof updateAutoSubmitScheduleSchema
>;

const scheduleRef = () => db.collection(COLLECTION_NAME).doc(DOC_ID);

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const fromFirestore = (
  data: FirebaseFirestore.DocumentData | undefined,
): ExternalQueueAutoSubmitSchedule | null => {
  if (!data) return null;

  return {
    id: DOC_ID,
    enabled: data.enabled === true,
    times: Array.isArray(data.times) ? normalizeTimes(data.times) : [],
    timezone: "GMT+7",
    last_run_key: data.last_run_key ?? null,
    last_run_at: toDate(data.last_run_at),
    last_run_result: data.last_run_result ?? null,
    updated_at: toDate(data.updated_at),
    updated_by: data.updated_by ?? null,
  };
};

export const getAutoSubmitSchedule = async () => {
  const snapshot = await scheduleRef().get();
  const persisted = fromFirestore(snapshot.data());
  if (persisted) return persisted;

  const envTimes = parseEnvTimes();
  return {
    id: DOC_ID,
    enabled: envTimes.length > 0,
    times: envTimes.length > 0 ? envTimes : ["14:00", "22:00"],
    timezone: "GMT+7" as const,
    last_run_key: null,
    last_run_at: null,
    last_run_result: null,
    updated_at: null,
    updated_by: null,
  };
};

export const updateAutoSubmitSchedule = async (
  input: UpdateAutoSubmitScheduleInput,
  actorId: string,
) => {
  const now = new Date();
  const data = {
    enabled: input.enabled,
    times: normalizeTimes(input.times),
    timezone: "GMT+7",
    updated_at: now,
    updated_by: actorId,
  };

  await scheduleRef().set(data, { merge: true });
  return getAutoSubmitSchedule();
};

export const getGmt7ScheduleCandidate = (now = new Date()) => {
  const localDate = new Date(now.getTime() + GMT_7_OFFSET_MINUTES * 60_000);
  const yyyy = localDate.getUTCFullYear();
  const mm = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(localDate.getUTCDate()).padStart(2, "0");
  const hh = String(localDate.getUTCHours()).padStart(2, "0");
  const min = String(localDate.getUTCMinutes()).padStart(2, "0");
  const time = `${hh}:${min}`;

  return {
    time,
    runKey: `${yyyy}-${mm}-${dd}T${time}+07:00`,
    label: `${yyyy}-${mm}-${dd} ${time} GMT+7`,
  };
};

export const claimAutoSubmitScheduleRun = async (
  runKey: string,
  scheduledTime: string,
  now = new Date(),
  options: { enforceScheduledTime?: boolean } = {},
) => {
  const ref = scheduleRef();

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    const times = Array.isArray(data?.times) ? data.times : parseEnvTimes();
    const enabled = snapshot.exists ? data?.enabled === true : times.length > 0;
    if (!enabled) return false;
    if (
      options.enforceScheduledTime !== false &&
      !times.includes(scheduledTime)
    ) {
      return false;
    }
    if (data?.last_run_key === runKey) return false;

    tx.set(
      ref,
      {
        enabled,
        times,
        timezone: "GMT+7",
        last_run_key: runKey,
        last_run_at: now,
        last_run_status: "RUNNING",
      },
      { merge: true },
    );
    return true;
  });
};

export const completeAutoSubmitScheduleRun = async (
  runKey: string,
  result: { submitted_batches: number; submitted_scans: number },
) => {
  await scheduleRef().set(
    {
      last_run_key: runKey,
      last_run_status: "COMPLETED",
      last_run_result: result,
      last_run_completed_at: new Date(),
    },
    { merge: true },
  );
};
