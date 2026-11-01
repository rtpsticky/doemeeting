import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  MIN_PASSWORD_LENGTH,
  userSelect,
  badRequest,
  serverError,
  optionalString,
  readJson,
} from "@/lib/userAdmin";

// ข้อมูลของผู้ใช้ที่ login อยู่
export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect,
    });
    return NextResponse.json({ data: me });
  } catch (err) {
    return serverError(err, "Error fetching profile:");
  }
}

// แก้ไขข้อมูลส่วนตัว / เปลี่ยนรหัสผ่านของตัวเอง
// แก้ username, role, status เองไม่ได้ (ต้องให้แอดมินทำผ่าน /api/users/{id})
export async function PATCH(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const body = await readJson(request);
  if (!body) {
    return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  const data = {};
  for (const field of ["email", "name", "department"]) {
    if (body[field] !== undefined) data[field] = optionalString(body[field]);
  }

  try {
    if (body.newPassword !== undefined) {
      if (!body.currentPassword) {
        return badRequest("กรุณากรอกรหัสผ่านปัจจุบัน");
      }
      if (String(body.newPassword).length < MIN_PASSWORD_LENGTH) {
        return badRequest(
          `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
        );
      }

      const current = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      const isValid =
        current?.password &&
        (await bcrypt.compare(String(body.currentPassword), current.password));
      if (!isValid) {
        return badRequest("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      }

      data.password = await bcrypt.hash(String(body.newPassword), 10);
    }

    if (Object.keys(data).length === 0) {
      return badRequest("ไม่มีข้อมูลที่ต้องแก้ไข");
    }

    const me = await prisma.user.update({
      where: { id: user.id },
      data,
      select: userSelect,
    });

    return NextResponse.json({ message: "แก้ไขข้อมูลส่วนตัวสำเร็จ", data: me });
  } catch (err) {
    return serverError(err, "Error updating profile:");
  }
}
