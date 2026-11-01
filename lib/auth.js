import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";

// อายุของ access token ที่ออกผ่าน POST /api/token (วินาที)
export const ACCESS_TOKEN_MAX_AGE = 24 * 60 * 60;

export const LOGIN_ERRORS = {
  INVALID: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  PENDING: "บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ",
  NOT_ALLOWED: "บัญชีของคุณไม่ได้รับอนุญาตให้ใช้งาน",
};

// ตรวจชื่อผู้ใช้/รหัสผ่านและสถานะบัญชี ใช้ร่วมกันระหว่าง NextAuth (cookie) และ /api/token (Bearer)
// คืนค่า { user } เมื่อผ่าน หรือ { error: ข้อความ, code: "INVALID" | "PENDING" | "NOT_ALLOWED" }
export async function verifyCredentials(username, password) {
  if (!username || !password) {
    return { error: LOGIN_ERRORS.INVALID, code: "INVALID" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.password) {
    return { error: LOGIN_ERRORS.INVALID, code: "INVALID" };
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return { error: LOGIN_ERRORS.INVALID, code: "INVALID" };
  }

  if (user.status === "PENDING") {
    return { error: LOGIN_ERRORS.PENDING, code: "PENDING" };
  }
  if (user.status !== "APPROVED") {
    return { error: LOGIN_ERRORS.NOT_ALLOWED, code: "NOT_ALLOWED" };
  }

  return { user };
}

// อ่านตัวตนผู้เรียกจาก session cookie (เว็บเดิม) หรือ Authorization: Bearer <token> (front-end แยก)
// แล้วเช็คกับฐานข้อมูลทุกครั้ง เพื่อให้ผู้ใช้ที่ถูกระงับ/ลบ/ลดสิทธิ์ ถูกตัดสิทธิ์ทันทีแม้ token ยังไม่หมดอายุ
// คืนค่า { user } เมื่อผ่าน หรือ { error: NextResponse } เมื่อไม่ผ่าน
export async function requireUser(request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const userId = token?.id ?? token?.sub;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, role: true, status: true },
      })
    : null;

  if (!user || user.status !== "APPROVED") {
    return {
      error: NextResponse.json({ message: "ไม่อนุญาต" }, { status: 401 }),
    };
  }

  return { user };
}

export async function requireAdmin(request) {
  const { user, error } = await requireUser(request);
  if (error) return { error };

  if (user.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { message: "ต้องเป็นผู้ดูแลระบบเท่านั้น" },
        { status: 403 },
      ),
    };
  }

  return { admin: user };
}
