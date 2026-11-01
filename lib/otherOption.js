// ตัวเลือก "อื่นๆ" / "อื่นๆ โปรดระบุ" ต้องกรอกรายละเอียดเพิ่มเติม
// แยกไฟล์ไว้ (ไม่ import prisma) เพื่อให้ client component ใช้ได้ด้วย
export function isOtherOption(name) {
  return typeof name === "string" && name.trim().startsWith("อื่นๆ");
}

// ชื่อผู้จัดที่ใช้แสดงผล: ถ้าเลือก "อื่นๆ" ให้แสดงข้อความที่กรอกแทน
export function organizerDisplayName(meeting) {
  const name = meeting.organizer?.name;
  if (isOtherOption(name) && meeting.otherOrganizer) {
    return meeting.otherOrganizer;
  }
  return name;
}
