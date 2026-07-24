import type {
  CompanyHoliday,
  UpsertCompanyHolidayInput,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const COLLECTION = "company_holidays";

const withId = (
  document: FirebaseFirestore.DocumentSnapshot,
): CompanyHoliday => ({
  id: document.id,
  ...(document.data() as Omit<CompanyHoliday, "id">),
});

export const findCompanyHolidays = async (
  startDate: string,
  endDate: string,
): Promise<CompanyHoliday[]> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("holiday_date", ">=", startDate)
    .where("holiday_date", "<=", endDate)
    .get();
  return snapshot.docs
    .map(withId)
    .filter((holiday) => !holiday.is_deleted)
    .sort((left, right) =>
      left.holiday_date.localeCompare(right.holiday_date),
    );
};

export const findCompanyHolidayById = async (
  holidayId: string,
): Promise<CompanyHoliday | null> => {
  const snapshot = await db.collection(COLLECTION).doc(holidayId).get();
  return snapshot.exists ? withId(snapshot) : null;
};

export const upsertCompanyHoliday = async (
  input: UpsertCompanyHolidayInput,
  actorId: string,
): Promise<{
  previous: CompanyHoliday | null;
  holiday: CompanyHoliday;
}> =>
  db.runTransaction(async (transaction) => {
    const reference = db.collection(COLLECTION).doc(input.holiday_date);
    const snapshot = await transaction.get(reference);
    const previous = snapshot.exists ? withId(snapshot) : null;
    if (previous && !previous.is_deleted) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Ngày này đã được cấu hình là ngày lễ.",
          zh: "该日期已配置为节假日。",
        },
      };
    }
    const now = new Date();
    const holiday: CompanyHoliday = {
      id: reference.id,
      holiday_date: input.holiday_date,
      name: input.name,
      created_by: previous?.created_by ?? actorId,
      updated_by: actorId,
      is_deleted: false,
      created_at: previous?.created_at ?? now,
      updated_at: now,
      action_time: input.action_time,
      sync_time: now,
    };
    transaction.set(reference, holiday);
    return { previous, holiday };
  });

export const softDeleteCompanyHoliday = async (
  holidayId: string,
  actorId: string,
  actionTime: Date,
): Promise<{ previous: CompanyHoliday; holiday: CompanyHoliday }> =>
  db.runTransaction(async (transaction) => {
    const reference = db.collection(COLLECTION).doc(holidayId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      throw {
        statusCode: 404,
        messages: {
          vi: "Không tìm thấy ngày lễ.",
          zh: "未找到节假日。",
        },
      };
    }
    const previous = withId(snapshot);
    if (previous.is_deleted) return { previous, holiday: previous };
    const now = new Date();
    const holiday: CompanyHoliday = {
      ...previous,
      is_deleted: true,
      updated_by: actorId,
      updated_at: now,
      action_time: actionTime,
      sync_time: now,
    };
    transaction.set(reference, holiday);
    return { previous, holiday };
  });
