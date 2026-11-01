import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getLookups } from "@/lib/lookups";

// ข้อมูลตัวเลือก (master data) ทั้งหมดสำหรับฟอร์มรายงานการประชุม
export async function GET(request) {
  const { error } = await requireUser(request);
  if (error) return error;

  try {
    return NextResponse.json({ data: await getLookups() });
  } catch (err) {
    console.error("Error fetching lookups:", err);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}
