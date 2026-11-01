import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// จำนวนรายงานการประชุมทั้งหมด และแยกตามหน่วยงานผู้จัด (สำหรับกราฟ Dashboard)
export async function GET(request) {
  const { error } = await requireUser(request);
  if (error) return error;

  try {
    const [total, grouped, organizers] = await Promise.all([
      prisma.meetingReport.count(),
      prisma.meetingReport.groupBy({
        by: ["organizerId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.organizerLookup.findMany(),
    ]);

    const organizerNames = new Map(organizers.map((o) => [o.id, o.name]));

    return NextResponse.json({
      data: {
        total,
        byOrganizer: grouped.map((item) => ({
          organizerId: item.organizerId,
          name: organizerNames.get(item.organizerId) ?? "ไม่ระบุ",
          count: item._count.id,
        })),
      },
    });
  } catch (err) {
    console.error("Error fetching meeting stats:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}
