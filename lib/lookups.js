import prisma from "@/lib/prisma";
import { isOtherOption } from "@/lib/otherOption";
import { userDisplayName } from "@/lib/meetingPeople";

// ให้ตัวเลือก "อื่นๆ" อยู่ท้ายรายการเสมอ
function moveOtherLast(items) {
  return [
    ...items.filter((item) => !isOtherOption(item.name)),
    ...items.filter((item) => isOtherOption(item.name)),
  ];
}

// lookup ที่ seed กำหนดลำดับไว้ (sortOrder) ใช้ชื่อเป็นตัวเรียงรองกรณีลำดับเท่ากัน
// ส่งออกเฉพาะ { id, name } ตามโครงสร้าง Lookup เดิม
const bySortOrder = {
  select: { id: true, name: true },
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
};

// ข้อมูลตัวเลือกทั้งหมดสำหรับฟอร์มรายงานการประชุม
export async function getLookups() {
  const [
    organizers,
    objectives,
    areas,
    scopes,
    diseaseGroups,
    diseases,
    users,
  ] = await Promise.all([
    prisma.organizerLookup.findMany({ orderBy: { name: "asc" } }),
    prisma.objectiveLookup.findMany(bySortOrder),
    prisma.areaLookup.findMany(bySortOrder),
    prisma.scopeLookup.findMany(bySortOrder),
    prisma.diseaseGroupLookup.findMany(bySortOrder),
    prisma.diseaseLookup.findMany({ orderBy: { name: "asc" } }),
    // ผู้ใช้ที่เลือกเป็นผู้สรุปการประชุมได้
    prisma.user.findMany({
      where: { status: "APPROVED" },
      select: { id: true, name: true, username: true, department: true },
    }),
  ]);

  return {
    // หน่วยงานผู้จัดเพิ่มผ่านฐานข้อมูลโดยตรง ไม่มี sortOrder จึงเรียงตามชื่อและให้ "อื่นๆ" อยู่ท้าย
    organizers: moveOtherLast(organizers),
    objectives,
    areas,
    scopes,
    diseaseGroups,
    diseases,
    users: users
      .map((user) => ({
        id: user.id,
        name: userDisplayName(user) ?? "(ไม่มีชื่อ)",
        department: user.department,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
  };
}

// แปลงค่าข้อความจาก formData: ว่าง/ช่องว่างล้วน → null
export function cleanText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// ตรวจผู้จัดและวัตถุประสงค์ที่เลือก ถ้าเลือก "อื่นๆ" ต้องกรอกช่องระบุเพิ่มเติม
// คืนค่า { error } เมื่อไม่ผ่าน หรือ { otherObjective } ที่ควรบันทึก
export async function validateOrganizerAndObjectives({
  organizerId,
  otherOrganizer,
  objectiveIds,
  otherObjective,
}) {
  if (objectiveIds.some((id) => isNaN(id))) {
    return { error: "พบวัตถุประสงค์การประชุมที่ไม่ถูกต้อง" };
  }

  const [organizer, objectives] = await Promise.all([
    prisma.organizerLookup.findUnique({ where: { id: organizerId } }),
    prisma.objectiveLookup.findMany({ where: { id: { in: objectiveIds } } }),
  ]);

  if (!organizer) {
    return { error: "ไม่พบหน่วยงานผู้จัดที่เลือก" };
  }
  if (objectives.length !== new Set(objectiveIds).size) {
    return { error: "พบวัตถุประสงค์การประชุมที่ไม่ถูกต้อง" };
  }
  if (isOtherOption(organizer.name) && !otherOrganizer) {
    return { error: "กรุณาระบุหน่วยงานผู้จัด (อื่นๆ)" };
  }

  const hasOtherObjective = objectives.some((o) => isOtherOption(o.name));
  if (hasOtherObjective && !otherObjective) {
    return { error: "กรุณาระบุวัตถุประสงค์การประชุม (อื่นๆ)" };
  }

  // ไม่ได้เลือก "อื่นๆ" ก็ไม่ต้องเก็บข้อความวัตถุประสงค์อื่นๆ
  return { otherObjective: hasOtherObjective ? otherObjective : null };
}

// ผู้สรุปการประชุม: ส่ง summarizerId (ผู้ใช้ในระบบ) หรือ summarizerName (พิมพ์ชื่อเอง) อย่างใดอย่างหนึ่ง
// คืนค่า { error } เมื่อไม่ผ่าน หรือ { summarizerId, summarizerName } ที่ควรบันทึก
export async function validateSummarizer({ summarizerId, summarizerName }) {
  if (summarizerId) {
    const user = await prisma.user.findUnique({
      where: { id: summarizerId },
      select: { id: true },
    });
    if (!user) {
      return { error: "ไม่พบผู้ใช้ที่เลือกเป็นผู้สรุปการประชุม" };
    }
    return { summarizerId, summarizerName: null };
  }

  if (!summarizerName) {
    return { error: "กรุณาระบุผู้สรุปการประชุม" };
  }
  if (summarizerName.length > 255) {
    return { error: "ชื่อผู้สรุปการประชุมต้องไม่เกิน 255 ตัวอักษร" };
  }
  return { summarizerId: null, summarizerName };
}
