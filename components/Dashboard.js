"use client";

import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import DashboardControls from "@/components/DashboardControls";
import PaginationControls from "@/components/PaginationControls";
import DashboardCharts from "@/components/DashboardCharts";
import { organizerDisplayName } from "@/lib/otherOption";

// A simple card component for displaying stats
const StatCard = ({ title, value }) => (
  <div className="p-4 bg-white rounded-lg shadow">
    <h3 className="text-sm font-medium text-slate-500">{title}</h3>
    <p className="mt-1 text-3xl font-semibold text-slate-800">{value}</p>
  </div>
);

export default function Dashboard({
  session,
  meetings,
  totalPages,
  currentPage,
  organizers,
  chartData,
  totalMeetings,
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-800">
                บันทึกรายงานการประชุม กองระบาดวิทยา
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <p className="text-sm text-slate-600 hidden sm:block">
                สวัสดี, {session.user.username}!
              </p>
              <SignOutButton />
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="รายงานทั้งหมด" value={totalMeetings} />
          {/* Add more stat cards here as needed */}
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <DashboardCharts data={chartData} />
        </div>

        {/* Controls and Table Section */}
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 md:mb-0">
              รายการประชุมทั้งหมด
            </h2>
            <Link
              href="/meetings/new"
              className="inline-block px-5 py-2 font-semibold text-white bg-teal-500 rounded-lg shadow-sm hover:bg-teal-600"
            >
              + เพิ่มรายงานใหม่
            </Link>
          </div>
          <DashboardControls organizers={organizers} />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    เรื่อง
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    ผู้จัด
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    วันที่เริ่ม
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    วันที่สิ้นสุด
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {meetings.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      ไม่พบข้อมูลที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  meetings.map((meeting) => (
                    <tr key={meeting.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {meeting.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {organizerDisplayName(meeting)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {new Date(meeting.startDate).toLocaleDateString(
                          "th-TH",
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {new Date(meeting.endDate).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/meetings/${meeting.id}`}
                          className="text-sky-600 hover:text-sky-800"
                        >
                          ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>
      </main>
    </div>
  );
}
