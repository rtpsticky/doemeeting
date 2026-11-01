// ผู้ทำรายการ / ผู้สรุปการประชุม (ไม่ import prisma เพื่อให้ client component ใช้ได้ด้วย)

// ฟิลด์ผู้ใช้ที่แนบไปกับรายงาน (ห้ามมี password)
export const meetingUserSelect = {
  id: true,
  name: true,
  username: true,
  department: true,
};

// ผู้ใช้บางคนไม่มีชื่อ-นามสกุล ให้ใช้ username แทน
export function userDisplayName(user) {
  if (!user) return null;
  return user.name || user.username;
}

// ผู้สรุป: ผู้ใช้ในระบบที่เลือก หรือชื่อที่พิมพ์เอง
export function summarizerDisplayName(meeting) {
  return userDisplayName(meeting.summarizer) || meeting.summarizerName;
}
