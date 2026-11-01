import prisma from "@/lib/prisma";

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

  return { organizers, objectives, areas, scopes, diseaseGroups, diseases };
}
