import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import {
  MIN_PASSWORD_LENGTH,
  userSelect,
  badRequest,
  serverError,
  optionalString,
  readJson,
  isUniqueViolation,
} from "@/lib/userAdmin";

// สมัครสมาชิก (ไม่ต้อง login) บัญชีใหม่จะมีสถานะ PENDING จนกว่าแอดมินจะอนุมัติ
export async function POST(request) {
  const body = await readJson(request);
  if (!body) {
    return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  const username = optionalString(body.username);
  const password = body.password;

  if (!username || !password) {
    return badRequest("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return badRequest(
      `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: await bcrypt.hash(String(password), 10),
        email: optionalString(body.email),
        name: optionalString(body.name),
        department: optionalString(body.department),
        role: "USER",
        status: "PENDING",
      },
      select: userSelect,
    });

    return NextResponse.json(
      { message: "สมัครสมาชิกสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติ", data: user },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" },
        { status: 409 },
      );
    }
    return serverError(error, "Error registering user:");
  }
}
