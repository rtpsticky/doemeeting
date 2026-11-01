import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  userSelect,
  badRequest,
  serverError,
  isNotFound,
} from "@/lib/userAdmin";
import { requireAdmin } from "@/lib/auth";

// ไม่อนุมัติผู้ใช้ (แอดมินเท่านั้น)
export async function POST(request, { params }) {
  const { admin, error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  if (id === admin.id) {
    return badRequest("ไม่สามารถเปลี่ยนสถานะของตัวเองได้");
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { status: "REJECTED", approvedAt: null, approvedById: null },
      select: userSelect,
    });
    return NextResponse.json({ message: "ไม่อนุมัติผู้ใช้สำเร็จ", data: user });
  } catch (err) {
    if (isNotFound(err)) {
      return NextResponse.json({ message: "ไม่พบผู้ใช้" }, { status: 404 });
    }
    return serverError(err, "Error updating user status:");
  }
}
