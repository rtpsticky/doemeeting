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
} from "@/lib/userAdmin";
import { requireAdmin } from "@/lib/auth";

// รายการผู้ใช้ (แอดมินเท่านั้น)
export async function GET(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get("pageSize")) || 20, 1),
    100,
  );
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const role = searchParams.get("role") || "";

  if (status && !USER_STATUSES.includes(status)) {
    return badRequest("status ไม่ถูกต้อง");
  }
  if (role && !ROLES.includes(role)) {
    return badRequest("role ไม่ถูกต้อง");
  }

  const where = {
    AND: [
      search
        ? {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      status ? { status } : {},
      role ? { role } : {},
    ],
  };

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    return serverError(err, "Error listing users:");
  }
}

// เพิ่มผู้ใช้ (แอดมินเท่านั้น) ผู้ใช้ที่แอดมินสร้างจะอนุมัติทันทีถ้าไม่ระบุ status
export async function POST(request) {
  const { admin, error } = await requireAdmin(request);
  if (error) return error;

  const body = await readJson(request);
  if (!body) {
    return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  const username = optionalString(body.username);
  const password = body.password;
  const role = body.role ?? "USER";
  const status = body.status ?? "APPROVED";

  if (!username || !password) {
    return badRequest("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return badRequest(
      `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
    );
  }
  if (!ROLES.includes(role)) {
    return badRequest("role ไม่ถูกต้อง");
  }
  if (!USER_STATUSES.includes(status)) {
    return badRequest("status ไม่ถูกต้อง");
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: await bcrypt.hash(String(password), 10),
        email: optionalString(body.email),
        name: optionalString(body.name),
        department: optionalString(body.department),
        role,
        status,
        ...(status === "APPROVED"
          ? { approvedAt: new Date(), approvedById: admin.id }
          : {}),
      },
      select: userSelect,
    });

    return NextResponse.json(
      { message: "เพิ่มผู้ใช้สำเร็จ", data: user },
      { status: 201 },
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" },
        { status: 409 },
      );
    }
    return serverError(err, "Error creating user:");
  }
}
