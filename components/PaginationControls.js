'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function PaginationControls({ currentPage, totalPages }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between mt-6">
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        &larr; หน้าก่อนหน้า
      </button>
      <span className="text-sm text-slate-600">
        หน้า {currentPage} จาก {totalPages}
      </span>
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        หน้าถัดไป &rarr;
      </button>
    </div>
  );
}
