const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// หน่วยงานผู้จัดจริงเพิ่มผ่านฐานข้อมูล ส่วน seed เพิ่มเฉพาะตัวเลือก "อื่นๆ โปรดระบุ"
async function seedOrganizers() {
  console.log("Start seeding organizer lookups...");
  const organizers = ["อื่นๆ โปรดระบุ"];
  for (const item of organizers) {
    await prisma.organizerLookup.upsert({
      where: { name: item },
      update: {},
      create: { name: item },
    });
  }
  console.log("Finished seeding organizer lookups.");
}

// ซิงก์ตัวเลือกให้ตรงกับรายการใน seed (ใช้กับ lookup ที่ seed เป็นผู้กำหนดรายการทั้งหมด)
// 1. เปลี่ยนชื่อจาก renames ({ ชื่อเดิม: ชื่อใหม่ }) โดยคง id เดิม รายงานที่ผูกอยู่จึงไม่หาย
// 2. upsert ทุกรายการพร้อม sortOrder ตามลำดับใน items
// 3. ลบตัวเลือกที่ไม่อยู่ใน items พร้อมการผูกกับรายงาน (เฉพาะ tag ไม่ลบตัวรายงาน)
async function syncLookup({
  label,
  model,
  joinModel,
  joinKey,
  items,
  renames = {},
}) {
  console.log(`Start syncing ${label} lookups...`);

  for (const [from, to] of Object.entries(renames)) {
    const old = await model.findUnique({ where: { name: from } });
    if (!old) continue;
    const existing = await model.findUnique({ where: { name: to } });
    if (existing) {
      // มีชื่อใหม่อยู่แล้ว: ย้าย tag ที่ยังไม่ซ้ำไปตัวใหม่ แล้วลบตัวเดิม
      const links = await joinModel.findMany({ where: { [joinKey]: old.id } });
      for (const link of links) {
        await joinModel.upsert({
          where: {
            [`meetingId_${joinKey}`]: {
              meetingId: link.meetingId,
              [joinKey]: existing.id,
            },
          },
          update: {},
          create: { meetingId: link.meetingId, [joinKey]: existing.id },
        });
      }
      await joinModel.deleteMany({ where: { [joinKey]: old.id } });
      await model.delete({ where: { id: old.id } });
    } else {
      await model.update({ where: { id: old.id }, data: { name: to } });
    }
  }

  for (const [index, name] of items.entries()) {
    await model.upsert({
      where: { name },
      update: { sortOrder: index + 1 },
      create: { name, sortOrder: index + 1 },
    });
  }

  const removed = await model.findMany({
    where: { name: { notIn: items } },
    select: { id: true, name: true },
  });
  if (removed.length > 0) {
    const ids = removed.map((item) => item.id);
    await joinModel.deleteMany({ where: { [joinKey]: { in: ids } } });
    await model.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `Removed ${label}: ${removed.map((item) => item.name).join(", ")}`,
    );
  }

  console.log(`Finished syncing ${label} lookups.`);
}

async function seedObjectives() {
  await syncLookup({
    label: "objective",
    model: prisma.objectiveLookup,
    joinModel: prisma.meetingObjective,
    joinKey: "objectiveId",
    renames: { แลกเปลี่ยนข้อมูล: "แลกเปลี่ยนข้อมูล/ประสบการณ์" },
    items: [
      "ชี้แจง",
      "แลกเปลี่ยนข้อมูล/ประสบการณ์",
      "รายงานความคืบหน้า",
      "หารือ/ตัดสินใจ",
      "พัฒนาศักยภาพ",
      "พัฒนานวัตกรรมหรือสร้างแรงบันดาลใจ",
      "จัดทำคู่มือ/แนวทาง/แผน",
      "อื่นๆ",
    ],
  });
}

async function seedAreas() {
  await syncLookup({
    label: "area",
    model: prisma.areaLookup,
    joinModel: prisma.tagArea,
    joinKey: "areaId",
    renames: { ไม่เฉพาะเจาะจง: "ไม่เฉพาะเจาะจง / ทั่วประเทศ" },
    items: [
      ...Array.from({ length: 13 }, (_, i) => `เขตสุขภาพที่ ${i + 1}`),
      "ไม่เฉพาะเจาะจง / ทั่วประเทศ",
      "ต่างประเทศ",
      "อื่นๆ โปรดระบุ",
    ],
  });
}

async function seedScopes() {
  await syncLookup({
    label: "scope",
    model: prisma.scopeLookup,
    joinModel: prisma.tagScope,
    joinKey: "scopeId",
    renames: {
      "การปฏิบัติการ สอบสวน มาตรการควบคุมโรค": "การสอบสวน มาตรการควบคุมโรค",
      ชายแดน: "ชายแดน/ประชากรต่างด้าว",
      ประชากรต่างด้าว: "ชายแดน/ประชากรต่างด้าว",
      การสื่อสารความเสี่ยงและพัฒนาการมีส่วนร่วมของชุมชน:
        "การสื่อสารความเสี่ยง/ชุมชนมีส่วนร่วม",
    },
    items: [
      "กฎหมาย ระเบียบ",
      "แผนงานโครงการ/ตัวชี้วัด",
      "งบประมาณ",
      "บุคลากร/เครือข่าย",
      "ทรัพยากร/เวชภัณฑ์",
      "ระบบ IT",
      "การจัดการและตอบโต้ภาวะฉุกเฉิน",
      "การป้องกัน",
      "การป้องกันการติดเชื้อในสถานพยาบาล",
      "การเฝ้าระวังโรคและภัยสุขภาพ",
      "การสอบสวน มาตรการควบคุมโรค",
      "การตรวจตัวอย่างทางห้องปฏิบัติการ",
      "การรักษา",
      "การสื่อสารความเสี่ยง/ชุมชนมีส่วนร่วม",
      "IHR-JEE",
      "SPAR",
      "NAPHs",
      "IHR Amendment/NIA/NFP",
      "คณะกรรมการ IHR",
      "WHO และรัฐภาคี",
      "EIS/เหตุการณ์ระหว่างประเทศ",
      "7-1-7",
      "เขตเมือง",
      "ค่ายทหาร",
      "ด่านควบคุมโรค",
      "ชายแดน/ประชากรต่างด้าว",
      "นักท่องเที่ยว",
      "โรงเรียน",
      "วัด",
      "สถานพยาบาล",
      "เรือนจำ",
      "ไม่เฉพาะเจาะจง",
      "อื่นๆ โปรดระบุ",
    ],
  });
}

async function seedDiseaseGroups() {
  await syncLookup({
    label: "disease group",
    model: prisma.diseaseGroupLookup,
    joinModel: prisma.tagDiseaseGroup,
    joinKey: "groupId",
    renames: {
      โรคติดเชื่อระบบทางเดินหายใจ: "โรคติดเชื้อระบบทางเดินหายใจ",
      การบาดเจ็บอื่นๆ: "การบาดเจ็บ/อุบัติเหตุ",
    },
    items: [
      "โรคติดต่ออันตราย/โรคอุบัติใหม่/Disease X",
      "โรคติดเชื้อระบบทางเดินหายใจ",
      "โรคติดเชื้อระบบทางเดินอาหารและน้ำ",
      "โรคที่ป้องกันได้ด้วยวัคซีน",
      "โรคติดต่อนำโดยแมลง",
      "โรคติดต่อระหว่างสัตว์สู่คน",
      "โรคติดต่อจากการสัมผัส",
      "โรคติดต่อทางเพศสัมพันธ์",
      "โรคติดเชื้อระบบประสาทส่วนกลาง",
      "โรคไม่ติดต่อ",
      "โรคจากการประกอบอาชีพและสิ่งแวดล้อม",
      "สาธารณภัย",
      "การบาดเจ็บ/อุบัติเหตุ",
      "ไม่เฉพาะเจาะจง",
      "อื่นๆ โปรดระบุ",
    ],
  });
}

async function seedDiseases() {
  console.log("Start seeding disease lookups...");
  const allDiseasesRaw = [
    { id: 1, name_th: "กาฬโรค" },
    { id: 2, name_th: "ไข้ทรพิษ" },
    { id: 3, name_th: "ไข้เลือดออกไครเมียนคองโก" },
    { id: 4, name_th: "ไข้เวสต์ไนล์" },
    { id: 5, name_th: "ไข้เหลือง" },
    { id: 6, name_th: "ไข้ลาสซา" },
    { id: 7, name_th: "โรคติดเชื้อไวรัสนิปาห์" },
    { id: 8, name_th: "โรคติดเชื้อไวรัสมาร์บวร์ก" },
    { id: 9, name_th: "โรคติดเชื้อไวรัสอีโบลา" },
    { id: 10, name_th: "โรคติดเชื้อไวรัสเฮนดรา" },
    { id: 11, name_th: "โรคทางเดินหายใจเฉียบพลันรุนแรง (SARS)" },
    { id: 12, name_th: "โรคทางเดินหายใจตะวันออกกลาง (MERS)" },
    { id: 13, name_th: "โรควัณโรคดื้อยาหลายขนานชนิดรุนแรงมาก (XDR-TB)" },
    { id: 14, name_th: "Disease X" },
    { id: 15, name_th: "โรคอุบัติใหม่ หรือโรคที่นำเข้าจากต่างประเทศ" },
    { id: 16, name_th: "ไข้กาฬหลังแอ่น" },
    { id: 17, name_th: "ไข้สมองอักเสบไม่ระบุเชื้อสาเหตุ" },
    { id: 18, name_th: "เยื่อหุ้มสมองอักเสบจากพยาธิ" },
    { id: 19, name_th: "เยื่อหุ้มสมองอักเสบไม่ระบุเชื้อสาเหตุ" },
    { id: 20, name_th: "โรคไข้ปวดข้อยุงลาย" },
    { id: 21, name_th: "โรคไข้มาลาเรีย" },
    { id: 22, name_th: "โรคไข้เลือดออก" },
    { id: 23, name_th: "โรคติดเชื้อไวรัสซิกา" },
    { id: 24, name_th: "โรคเท้าช้าง" },
    { id: 25, name_th: "โรคลิชมาเนีย" },
    { id: 26, name_th: "โรคสครับไทฟัส" },
    {
      id: 119,
      name_th:
        "โรคติดเชื้อไวรัสที่ทำให้เกิดกลุ่มอาการไข้สูงและเกล็ดเลือดต่ำ (SFTS)",
    },
    { id: 27, name_th: "ไข้ดำแดง" },
    { id: 28, name_th: "ไข้หวัดนก" },
    { id: 29, name_th: "ไข้หวัดใหญ่" },
    { id: 30, name_th: "โรคปอดอักเสบ หรือโรคปอดบวม" },
    { id: 31, name_th: "วัณโรค (ยกเว้น XDR-TB)" },
    { id: 32, name_th: "โรคลีเจียนแนร์" },
    { id: 33, name_th: "โรคติดเชื้อไวรัสอาร์เอสวี (RSV)" },
    { id: 34, name_th: "โรคติดเชื้อไวรัสโคโรนา 2019 (โควิด-19)" },
    { id: 113, name_th: "วัณโรคดื้อยาหลายขนานชนิดรุนแรง(Pre XDR-TB)" },
    { id: 114, name_th: "วัณโรคดื้อยาหลายขนาน(MDR-TB)" },
    {
      id: 35,
      name_th: "โรคติดเชื้อสเตร็ปโตคอคคัสซูอิส (ไข้ติดเชื้อจากหมูดิบ)",
    },
    { id: 36, name_th: "โรคบรูเซลโลสิส" },
    { id: 37, name_th: "โรคทริคิโนสิส" },
    { id: 38, name_th: "โรคพิษสุนัขบ้า" },
    { id: 39, name_th: "โรคเลปโตสไปโรสิส" },
    { id: 40, name_th: "โรคแอนแทรกซ์" },
    { id: 117, name_th: "โรคพิษสุนัขบ้าในสัตว์" },
    { id: 118, name_th: "โรคแอนแทรกซ์ในสัตว์" },
    { id: 120, name_th: "โรคไข้หวัดนกในสัตว์" },
    { id: 41, name_th: "หัด" },
    { id: 42, name_th: "หัดเยอรมัน" },
    { id: 43, name_th: "ไข้หัดเยอรมันแต่กำเนิด" },
    { id: 44, name_th: "โรคคอตีบ" },
    { id: 45, name_th: "โรคคางทูม" },
    { id: 46, name_th: "โรคบาดทะยัก" },
    { id: 47, name_th: "โรคบาดทะยักในทารกแรกเกิด" },
    { id: 48, name_th: "โรคโปลิโอ" },
    { id: 49, name_th: "โรคอัมพาตกล้ามเนื้ออ่อนปวกเปียกเฉียบพลัน (AFP)" },
    { id: 50, name_th: "โรคสุกใส หรืออีสุกอีใส" },
    { id: 51, name_th: "โรคไอกรน" },
    { id: 52, name_th: "ไข้สมองอักเสบเจแปนนิส (JE)" },
    {
      id: 53,
      name_th:
        "เหตุการณ์ไม่พึงประสงค์ภายหลังได้รับการสร้างเสริมภูมิคุ้มกันโรค (AEFI)",
    },
    {
      id: 54,
      name_th:
        "ไข้เอนทอริค ไข้ไทฟอยด์หรือไข้รากสาดน้อย และไข้พาราไทฟอยด์ หรือไข้รากสาดเทียม",
    },
    { id: 55, name_th: "โรคโบทูลิซึม" },
    { id: 56, name_th: "โรคไวรัสตับอักเสบเฉียบพลัน ชนิด เอ อี และไม่ระบุชนิด" },
    { id: 57, name_th: "โรคพยาธิใบไม้ตับ" },
    { id: 58, name_th: "โรคอาหารเป็นพิษ/โรคอุจจาระร่วงเฉียบพลัน" },
    { id: 59, name_th: "โรคบิด" },
    { id: 60, name_th: "อหิวาตกโรค" },
    { id: 61, name_th: "เห็ดพิษ" },
    { id: 62, name_th: "รับประทานพืชพิษ/สัตว์มีพิษ" },
    { id: 63, name_th: "ไข้ไม่ทราบสาเหตุ" },
    { id: 64, name_th: "ไข้เอนเทอโรไวรัส" },
    { id: 65, name_th: "โรคตาแดง" },
    { id: 66, name_th: "โรคเมลิออยโดสิส" },
    { id: 67, name_th: "โรคมือ เท้า ปาก (HFM)" },
    { id: 68, name_th: "โรคเรื้อน" },
    { id: 69, name_th: "Mpox" },
    { id: 70, name_th: "กามโรคของต่อมและท่อน้ำเหลือง" },
    { id: 71, name_th: "การติดเชื้อ HIV และโรคเอดส์" },
    { id: 72, name_th: "โรคซิฟิลิส" },
    { id: 73, name_th: "โรคซิฟิลิสแต่กำเนิด" },
    { id: 74, name_th: "โรคแผลริมอ่อน" },
    { id: 75, name_th: "โรคเริมของอวัยวะสืบพันธุ์และทวารหนัก" },
    { id: 76, name_th: "โรคหนองใน" },
    { id: 77, name_th: "โรคหนองในเทียม" },
    {
      id: 110,
      name_th: "โรคไวรัสตับอักเสบเฉียบพลัน ชนิด บี ซี ดี และไม่ระบุชนิด",
    },
    { id: 78, name_th: "โรคตะกั่วหรือสารประกอบของตะกั่ว" },
    { id: 79, name_th: "โรคจากฝุ่นซิลิกา (Silicosis)" },
    {
      id: 80,
      name_th: "โรคจากแอสเบสตอส (ใยหิน) หรือโรคมะเร็งปอดที่เกิดจาก asbestos",
    },
    { id: 81, name_th: "โรคจากภาวะอับอากาศ" },
    { id: 82, name_th: "โรคหรืออาการสำคัญของพิษจากสารกำจัดศัตรูพืช" },
    {
      id: 83,
      name_th:
        "โรคหรืออาการสำคัญที่เกิดจากการสัมผัสฝุ่นละอองขนาดไม่เกิน 2.5 ไมครอน",
    },
    {
      id: 84,
      name_th: "เหตุการณ์ที่เกิดจากการได้รับสัมผัสก๊าซพิษ ในพื้นที่จำกัด ",
    },
    { id: 85, name_th: "เหตุการณ์ไฟไหม้บ่อขยะ" },
    { id: 86, name_th: "ภาวะปื้นเยื่อหุ้มปอด (pleural plaque) " },
    {
      id: 87,
      name_th: "ภาวะเยื่อหุ้มปอดหนากระจาย (diffuse pleural thickening)",
    },
    {
      id: 88,
      name_th: "โรคมะเร็งเยื่อหุ้มปอด (malignant pleural mesothelioma) ",
    },
    { id: 89, name_th: "โรคพิษโลหะหนัก " },
    { id: 90, name_th: "Heat Stroke ไม่รวมกิจกรรมงานวิ่ง" },
    {
      id: 91,
      name_th: "เหตุการณ์สารเคมีระเบิด ไฟไหม้ รั่วไหล ในสถานประกอบกิจการ",
    },
    { id: 92, name_th: "เหตุการณ์วัสดุกัมมันตรังสีสูญหายหรือมีการรั่วไหล" },
    { id: 93, name_th: "โรคพิษสารตัวทำละลายอินทรีย์ระเหยง่าย (VOCs)" },
    { id: 94, name_th: "โรคจากการประกอบอาชีพและโรคจากสิ่งแวดล้อมอื่นๆ" },
    { id: 115, name_th: "น้ำมันรั่วไหลลงสู่สิ่งแวดล้อม" },
    { id: 116, name_th: "เหตุการณ์ที่เกิดจากการใช้เครื่องทำน้ำอุ่นระบบก๊าซ" },
    { id: 109, name_th: "โรคอุบัติใหม่ หรือโรคที่นำเข้าจากต่างประเทศ " },
    {
      id: 111,
      name_th: "ภาวะวิกฤตหัวใจและหลอดเลือด ฮีทสโตรก หรือการเสียชีวิตในงานวิ่ง",
    },
    { id: 112, name_th: "บุหรี่ไฟฟ้า" },
  ];

  const diseaseNames = [...new Set(allDiseasesRaw.map((d) => d.name_th))];

  for (const item of diseaseNames) {
    await prisma.diseaseLookup.upsert({
      where: { name: item },
      update: {},
      create: { name: item },
    });
  }
  console.log("Finished seeding disease lookups.");
}

async function main() {
  await seedOrganizers();
  await seedObjectives();
  await seedAreas();
  await seedScopes();
  await seedDiseaseGroups();
  await seedDiseases();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
