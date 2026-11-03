import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// จำนวนรายงานการประชุมแยกตามเดือนของ startDate (สำหรับกราฟรายเดือน)
// startDate เป็นคอลัมน์ date ที่เก็บวันที่ตามที่ผู้ใช้กรอก (เวลาไทย) จึงจัดกลุ่มตามเดือนได้ตรงๆ
export async function GET(request) {
  const { error } = await requireUser(request);
  if (error) return error;

  try {
    const rows = await prisma.$queryRaw`
      SELECT to_char("startDate", 'YYYY-MM') AS month, COUNT(*)::int AS count
      FROM "MeetingReport"
      GROUP BY month
      ORDER BY month
    `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("Error fetching meeting stats by month:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}
