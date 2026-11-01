import { NextResponse } from "next/server";

export const ROLES = ["ADMIN", "USER"];
export const USER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
export const MIN_PASSWORD_LENGTH = 8;

// ฟิลด์ที่ส่งกลับให้ client (ห้ามมี password)
export const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  department: true,
  role: true,
  status: true,
  approvedAt: true,
  approvedById: true,
  createdAt: true,
  updatedAt: true,
};

export function badRequest(message) {
  return NextResponse.json({ message }, { status: 400 });
}

export function serverError(error, context) {
  console.error(context, error);
  return NextResponse.json(
    { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
    { status: 500 },
  );
}

// แปลงค่าข้อความ: undefined = ไม่ได้ส่งมา, "" = ล้างค่าเป็น null
export function optionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Prisma P2002 = ค่าซ้ำใน unique field (username)
export function isUniqueViolation(error) {
  return error?.code === "P2002";
}

// Prisma P2025 = ไม่พบ record ที่ต้องการ update/delete
export function isNotFound(error) {
  return error?.code === "P2025";
}
