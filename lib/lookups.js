import prisma from "@/lib/prisma";
import { isOtherOption } from "@/lib/otherOption";

// ให้ตัวเลือก "อื่นๆ" อยู่ท้ายรายการเสมอ
function moveOtherLast(items) {
  return [
    ...items.filter((item) => !isOtherOption(item.name)),
    ...items.filter((item) => isOtherOption(item.name)),
  ];
}

// เรียงเขตสุขภาพตามเลขเขต 1 → 13 และให้ "ไม่เฉพาะเจาะจง" อยู่ท้ายสุด
function compareAreas(a, b) {
  if (a.name === "ไม่เฉพาะเจาะจง") return 1;
  if (b.name === "ไม่เฉพาะเจาะจง") return -1;

  const aNumMatch = a.name.match(/(\d+)/);
  const bNumMatch = b.name.match(/(\d+)/);
  if (aNumMatch && bNumMatch) {
    return parseInt(aNumMatch[0], 10) - parseInt(bNumMatch[0], 10);
  }

  return a.name.localeCompare(b.name, "th");
}

// ข้อมูลตัวเลือกทั้งหมดสำหรับฟอร์มรายงานการประชุม
export async function getLookups() {
  const [organizers, objectives, areas, scopes, diseaseGroups, diseases] =
    await Promise.all([
      prisma.organizerLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.objectiveLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.areaLookup.findMany(),
      prisma.scopeLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.diseaseGroupLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.diseaseLookup.findMany({ orderBy: { name: "asc" } }),
    ]);

  areas.sort(compareAreas);

  return {
    organizers: moveOtherLast(organizers),
    objectives: moveOtherLast(objectives),
    areas,
    scopes: moveOtherLast(scopes),
    diseaseGroups: moveOtherLast(diseaseGroups),
    diseases,
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
