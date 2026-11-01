import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import {
  ROLES,
  USER_STATUSES,
  MIN_PASSWORD_LENGTH,
  userSelect,
  badRequest,
  serverError,
  optionalString,
  readJson,
  isUniqueViolation,
  isNotFound,
} from "@/lib/userAdmin";
import { requireAdmin } from "@/lib/auth";

const notFoundResponse = () =>
  NextResponse.json({ message: "ไม่พบผู้ใช้" }, { status: 404 });

// รายละเอียดผู้ใช้ (แอดมินเท่านั้น)
export async function GET(request, { params }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) return notFoundResponse();
    return NextResponse.json({ data: user });
  } catch (err) {
    return serverError(err, "Error fetching user:");
  }
}

// แก้ไขข้อมูลผู้ใช้ (แอดมินเท่านั้น) ส่งมาเฉพาะ field ที่ต้องการเปลี่ยน
export async function PATCH(request, { params }) {
  const { admin, error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  const body = await readJson(request);
  if (!body) {
    return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  const data = {};

  if (body.username !== undefined) {
    const username = optionalString(body.username);
    if (!username) return badRequest("ชื่อผู้ใช้ห้ามว่าง");
    data.username = username;
  }
  for (const field of ["email", "name", "department"]) {
    if (body[field] !== undefined) data[field] = optionalString(body[field]);
  }
  if (body.password !== undefined) {
    if (String(body.password).length < MIN_PASSWORD_LENGTH) {
      return badRequest(
        `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      );
    }
    data.password = await bcrypt.hash(String(body.password), 10);
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return badRequest("role ไม่ถูกต้อง");
    data.role = body.role;
  }
  if (body.status !== undefined) {
    if (!USER_STATUSES.includes(body.status)) {
      return badRequest("status ไม่ถูกต้อง");
    }
    data.status = body.status;
  }

  // กันแอดมินล็อกตัวเองออกจากระบบ
  if (id === admin.id) {
    if (data.role && data.role !== "ADMIN") {
      return badRequest("ไม่สามารถลดสิทธิ์ของตัวเองได้");
    }
    if (data.status && data.status !== "APPROVED") {
      return badRequest("ไม่สามารถเปลี่ยนสถานะของตัวเองได้");
    }
  }

  if (Object.keys(data).length === 0) {
    return badRequest("ไม่มีข้อมูลที่ต้องแก้ไข");
  }

  try {
    if (data.status) {
      const current = await prisma.user.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) return notFoundResponse();
      if (data.status === "APPROVED" && current.status !== "APPROVED") {
        data.approvedAt = new Date();
        data.approvedById = admin.id;
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return NextResponse.json({ message: "แก้ไขข้อมูลผู้ใช้สำเร็จ", data: user });
  } catch (err) {
    if (isNotFound(err)) return notFoundResponse();
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" },
        { status: 409 },
      );
    }
    return serverError(err, "Error updating user:");
  }
}

// ลบผู้ใช้ (แอดมินเท่านั้น) Account/Session ที่ผูกอยู่จะถูกลบตาม (onDelete: Cascade)
export async function DELETE(request, { params }) {
  const { admin, error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  if (id === admin.id) {
    return badRequest("ไม่สามารถลบบัญชีของตัวเองได้");
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "ลบผู้ใช้สำเร็จ" });
  } catch (err) {
    if (isNotFound(err)) return notFoundResponse();
    return serverError(err, "Error deleting user:");
  }
}
