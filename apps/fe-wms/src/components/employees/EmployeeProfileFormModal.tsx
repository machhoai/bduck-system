"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import { EmployeeProfileStatus, UserStatus } from "@bduck/shared-types";
import type { EmployeeProfile, Role, Warehouse } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";

type AssignmentDraft = {
  warehouse_id: string;
  role_id: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

interface EmployeeProfileFormModalProps {
  isOpen: boolean;
  profile: EmployeeProfile | null;
  users: UserWithAssignments[];
  roles: Role[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
}

const emptyAssignment = (): AssignmentDraft => ({
  warehouse_id: "",
  role_id: "",
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: "",
  is_active: true,
});

const inputClassName =
  "h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]";

export function EmployeeProfileFormModal({
  isOpen,
  profile,
  users,
  roles,
  warehouses,
  onClose,
  onSave,
}: EmployeeProfileFormModalProps) {
  const isEdit = Boolean(profile);
  const activeUsers = useMemo(
    () => users.filter((user) => !user.is_deleted),
    [users],
  );
  const activeRoles = useMemo(
    () => roles.filter((role) => !role.is_deleted),
    [roles],
  );
  const [formData, setFormData] = useState({
    user_id: "",
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
    department: "",
    workplace_warehouse_id: "",
    status: EmployeeProfileStatus.ACTIVE,
    notes: "",
  });
  const [createAccount, setCreateAccount] = useState(false);
  const [accountData, setAccountData] = useState({
    email: "",
    status: UserStatus.ACTIVE,
  });
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([
    emptyAssignment(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (profile) {
      setFormData({
        user_id: profile.user_id || "",
        employee_code: profile.employee_code,
        full_name: profile.full_name,
        email: profile.email || "",
        phone: profile.phone || "",
        job_title: profile.job_title || "",
        department: profile.department || "",
        workplace_warehouse_id: profile.workplace_warehouse_id,
        status: profile.status,
        notes: profile.notes || "",
      });
      setCreateAccount(false);
      setAccountData({
        email: profile.email || "",
        status: UserStatus.ACTIVE,
      });
      setAssignments([emptyAssignment()]);
      return;
    }

    setFormData({
      user_id: "",
      employee_code: "",
      full_name: "",
      email: "",
      phone: "",
      job_title: "",
      department: "",
      workplace_warehouse_id: warehouses[0]?.id || "",
      status: EmployeeProfileStatus.ACTIVE,
      notes: "",
    });
    setCreateAccount(false);
    setAccountData({
      email: "",
      status: UserStatus.ACTIVE,
    });
    setAssignments([emptyAssignment()]);
  }, [isOpen, profile, warehouses]);

  useEffect(() => {
    if (!createAccount) return;
    setAccountData((current) => ({
      ...current,
      email: current.email || formData.email,
    }));
  }, [createAccount, formData.email]);

  if (!isOpen) return null;

  const updateAssignment = (
    index: number,
    key: keyof AssignmentDraft,
    value: string | boolean,
  ) => {
    setAssignments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const corePayload = {
        user_id: createAccount ? null : formData.user_id || null,
        employee_code: formData.employee_code,
        full_name: formData.full_name,
        email: formData.email || null,
        phone: formData.phone || null,
        job_title: formData.job_title || null,
        department: formData.department || null,
        workplace_warehouse_id: formData.workplace_warehouse_id,
        status: formData.status,
        notes: formData.notes || null,
      };
      const payload = isEdit
        ? corePayload
        : {
            ...corePayload,
            create_account: createAccount,
            account: createAccount
              ? {
                  email: accountData.email,
                  status: accountData.status,
                  assignments: assignments
                    .filter((assignment) => assignment.role_id)
                    .map((assignment) => ({
                      warehouse_id: assignment.warehouse_id || null,
                      role_id: assignment.role_id,
                      valid_from: assignment.valid_from,
                      valid_until: assignment.valid_until || null,
                      is_active: assignment.is_active,
                    })),
                }
              : undefined,
          };

      await onSave(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        className="flex max-h-[92vh] w-[96%] max-w-[1180px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {isEdit ? "Sửa hồ sơ nhân viên" : "Tạo hồ sơ nhân viên"}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Nơi làm việc ở đây là warehouse làm việc chính của nhân viên.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <form
          id="employeeProfileForm"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4"
        >
          <div className="grid gap-4">
            <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Mã nhân viên">
                  <input
                    required
                    value={formData.employee_code}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        employee_code: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Họ và tên">
                  <input
                    required
                    value={formData.full_name}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        full_name: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData({ ...formData, email: event.target.value })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Số điện thoại">
                  <input
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData({ ...formData, phone: event.target.value })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Chức danh">
                  <input
                    value={formData.job_title}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        job_title: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Bộ phận">
                  <input
                    value={formData.department}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        department: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Nơi làm việc">
                  <select
                    required
                    value={formData.workplace_warehouse_id}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        workplace_warehouse_id: event.target.value,
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="">Chọn warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Trạng thái">
                  <select
                    value={formData.status}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        status: event.target.value as EmployeeProfileStatus,
                      })
                    }
                    className={inputClassName}
                  >
                    {Object.values(EmployeeProfileStatus).map((status) => (
                      <option key={status} value={status}>
                        {profileStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                <Field label="Ghi chú">
                  <textarea
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData({ ...formData, notes: event.target.value })
                    }
                    className="min-h-20 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]"
                  />
                </Field>
                <Field label="Liên kết tài khoản có sẵn">
                  <select
                    value={formData.user_id}
                    disabled={createAccount}
                    onChange={(event) =>
                      setFormData({ ...formData, user_id: event.target.value })
                    }
                    className={inputClassName}
                  >
                    <option value="">Chưa liên kết</option>
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} - {user.email}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            {!isEdit && (
              <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(event) => setCreateAccount(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Tạo tài khoản đăng nhập đi kèm profile này
                </label>

                {createAccount && (
                  <div className="grid gap-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Người dùng sẽ tạo tên đăng nhập và mật khẩu qua email khởi
                      tạo tài khoản.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Email tài khoản">
                        <input
                          required={createAccount}
                          type="email"
                          value={accountData.email}
                          onChange={(event) =>
                            setAccountData({
                              ...accountData,
                              email: event.target.value,
                            })
                          }
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="Trạng thái tài khoản">
                        <select
                          value={accountData.status}
                          onChange={(event) =>
                            setAccountData({
                              ...accountData,
                              status: event.target.value as UserStatus,
                            })
                          }
                          className={inputClassName}
                        >
                          {Object.values(UserStatus).map((status) => (
                            <option key={status} value={status}>
                              {userStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Phân quyền tài khoản
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setAssignments([...assignments, emptyAssignment()])
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95"
                        >
                          <Plus size={15} />
                          Thêm quyền
                        </button>
                      </div>
                      <div className="grid gap-3">
                        {assignments.map((assignment, index) => (
                          <div
                            key={index}
                            className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 md:grid-cols-[1fr_1fr_130px_130px_90px_40px]"
                          >
                            <SelectField
                              label="Warehouse scope"
                              value={assignment.warehouse_id}
                              onChange={(value) =>
                                updateAssignment(index, "warehouse_id", value)
                              }
                            >
                              <option value="">Toàn hệ thống</option>
                              {warehouses.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </option>
                              ))}
                            </SelectField>
                            <SelectField
                              label="Role"
                              value={assignment.role_id}
                              onChange={(value) =>
                                updateAssignment(index, "role_id", value)
                              }
                            >
                              <option value="">Chọn role</option>
                              {activeRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </SelectField>
                            <Field label="Từ ngày">
                              <input
                                required
                                type="date"
                                value={assignment.valid_from}
                                onChange={(event) =>
                                  updateAssignment(
                                    index,
                                    "valid_from",
                                    event.target.value,
                                  )
                                }
                                className={inputClassName}
                              />
                            </Field>
                            <Field label="Đến ngày">
                              <input
                                type="date"
                                value={assignment.valid_until}
                                onChange={(event) =>
                                  updateAssignment(
                                    index,
                                    "valid_until",
                                    event.target.value,
                                  )
                                }
                                className={inputClassName}
                              />
                            </Field>
                            <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-text-secondary)]">
                              <input
                                type="checkbox"
                                checked={assignment.is_active}
                                onChange={(event) =>
                                  updateAssignment(
                                    index,
                                    "is_active",
                                    event.target.checked,
                                  )
                                }
                                className="h-4 w-4"
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setAssignments(
                                  assignments.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                              className="mt-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all active:scale-95"
                              aria-label="Xóa quyền"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="employeeProfileForm"
            disabled={isSubmitting}
            className="h-9 rounded-full bg-[var(--color-brand-primary)] px-4 text-sm text-white transition-all active:scale-95 disabled:opacity-50"
          >
            Lưu
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        {children}
      </select>
    </Field>
  );
}

export function profileStatusLabel(status: EmployeeProfileStatus) {
  const labels: Record<EmployeeProfileStatus, string> = {
    [EmployeeProfileStatus.ACTIVE]: "Đang làm việc",
    [EmployeeProfileStatus.INACTIVE]: "Ngừng làm việc",
    [EmployeeProfileStatus.ON_LEAVE]: "Tạm nghỉ",
  };
  return labels[status];
}

function userStatusLabel(status: UserStatus) {
  const labels: Record<UserStatus, string> = {
    [UserStatus.ACTIVE]: "Hoạt động",
    [UserStatus.INACTIVE]: "Ngừng hoạt động",
    [UserStatus.SUSPENDED]: "Tạm khóa",
  };
  return labels[status];
}
