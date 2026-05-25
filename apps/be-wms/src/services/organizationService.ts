import { AuditAction } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { Organization } from "@bduck/shared-types";
import type { z } from "zod";
import { organizationRepository } from "../repositories/organizationRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import { createOrganizationSchema } from "../utils/zodSchemas.js";
import { logAudit } from "./auditService.js";

type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
type UpdateOrganizationInput = Partial<CreateOrganizationInput>;

export const fetchOrganizations = async (): Promise<Organization[]> => {
  return organizationRepository.findOrganizations();
};

export const fetchOrganizationById = async (
  id: string,
): Promise<Organization> => {
  const organization = await organizationRepository.findById(id);

  if (!organization || organization.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Tổ chức không tồn tại hoặc đã bị xóa.",
        zh: "组织不存在或已被删除。",
      },
    };
  }

  return organization;
};

export const createOrganization = async (
  input: CreateOrganizationInput,
  userId: string,
): Promise<Organization> => {
  const existingCode = await organizationRepository.findByCode(input.code);
  if (existingCode) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Mã tổ chức "${input.code}" đã tồn tại.`,
        zh: `组织代码 "${input.code}" 已存在。`,
      },
    };
  }

  const id = randomUUID();
  const organization = await organizationRepository.create(id, {
    id,
    name: input.name,
    code: input.code,
    tax_code: input.tax_code || null,
    address: input.address || null,
    organization_image_url: input.organization_image_url || null,
  } as any);

  await logAudit({
    entity_type: "organizations",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: organization as unknown as Record<string, unknown>,
  });

  return organization;
};

export const updateOrganization = async (
  id: string,
  input: UpdateOrganizationInput,
  userId: string,
): Promise<void> => {
  const existing = await fetchOrganizationById(id);

  if (input.code && input.code !== existing.code) {
    const codeOwner = await organizationRepository.findByCode(input.code);
    if (codeOwner && codeOwner.id !== id) {
      throw {
        statusCode: 409,
        messages: {
          vi: `Mã tổ chức "${input.code}" đã tồn tại.`,
          zh: `组织代码 "${input.code}" 已存在。`,
        },
      };
    }
  }

  await organizationRepository.update(id, input as any);

  await logAudit({
    entity_type: "organizations",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
  });
};

export const deleteOrganization = async (
  id: string,
  userId: string,
): Promise<void> => {
  const existing = await fetchOrganizationById(id);

  const hasWarehouses = await warehouseRepository.hasActiveByOrganizationId(id);
  if (hasWarehouses) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa tổ chức còn kho đang sử dụng.",
        zh: "无法删除仍有关联仓库的组织。",
      },
    };
  }

  await organizationRepository.softDelete(id);

  await logAudit({
    entity_type: "organizations",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
  });
};
