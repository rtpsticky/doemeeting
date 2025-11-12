import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import Link from "next/link";
import Dashboard from "@/components/Dashboard";

export default async function Home({ searchParams }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-800">
            บันทึกรายงานการประชุม กองระบาดวิทยา
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            กรุณาเข้าสู่ระบบเพื่อใช้งาน
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block px-6 py-2.5 font-semibold text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </main>
    );
  }

  // --- Search, Filter, and Pagination Parameters ---
  const page = parseInt(searchParams.page) || 1;
  const search = searchParams.search || "";
  const organizerId = searchParams.organizerId || "";
  const pageSize = 20;

  // --- Build Prisma Query ---
  const where = {
    AND: [
      search ? { title: { contains: search, mode: "insensitive" } } : {},
      organizerId ? { organizerId: parseInt(organizerId) } : {},
    ],
  };

  // --- Fetch Data in Parallel ---
  const [meetings, totalMeetings, organizers, meetingsByOrganizer] =
    await Promise.all([
      // Get paginated meetings
      prisma.meetingReport.findMany({
        where,
        include: { organizer: true },
        orderBy: { startDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Get total count for pagination
      prisma.meetingReport.count({ where }),
      // Get all organizers for the filter dropdown
      prisma.organizerLookup.findMany({ orderBy: { name: "asc" } }),
      // Get data for charts
      prisma.meetingReport.groupBy({
        by: ["organizerId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
    ]);

  const totalPages = Math.ceil(totalMeetings / pageSize);

  // Map organizer names to chart data
  const chartData = meetingsByOrganizer.map((item) => {
    const organizer = organizers.find((o) => o.id === item.organizerId);
    return {
      name: organizer ? organizer.name : "ไม่ระบุ",
      count: item._count.id,
    };
  });

  return (
    <Dashboard
      session={session}
      meetings={meetings}
      totalPages={totalPages}
      currentPage={page}
      organizers={organizers}
      chartData={chartData}
      totalMeetings={totalMeetings}
    />
  );
}
