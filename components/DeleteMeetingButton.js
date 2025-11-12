"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";

export default function DeleteMeetingButton({ meetingId }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ",
      text: "คุณแน่ใจหรือไม่ว่าต้องการลบรายงานนี้? การกระทำนี้ไม่สามารถย้อนกลับได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ใช่, ลบเลย!",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "เกิดข้อผิดพลาดในการลบ");
      }

      await Swal.fire({
        title: "ลบสำเร็จ!",
        text: "รายงานการประชุมถูกลบเรียบร้อยแล้ว",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      router.push("/");
      router.refresh();
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด!", err.message, "error");
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-block">
      <button
        onClick={handleDelete}
        disabled={isLoading}
        className="px-4 py-2 font-semibold text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 disabled:bg-slate-400"
      >
        {isLoading ? "กำลังลบ..." : "ลบรายงาน"}
      </button>
    </div>
  );
}
