'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function DashboardControls({ organizers }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSearch = useDebouncedCallback((term) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1'); // Reset to first page on new search
    if (term) {
      params.set('search', term);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, 300);

  const handleFilterChange = (organizerId) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1'); // Reset to first page on new filter
    if (organizerId) {
      params.set('organizerId', organizerId);
    } else {
      params.delete('organizerId');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <input
        type="text"
        placeholder="ค้นหาชื่อเรื่องการประชุม..."
        defaultValue={searchParams.get('search')?.toString()}
        onChange={(e) => handleSearch(e.target.value)}
        className="block w-full px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
      />
      <select
        onChange={(e) => handleFilterChange(e.target.value)}
        defaultValue={searchParams.get('organizerId')?.toString()}
        className="block w-full px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
      >
        <option value="">-- กรองตามผู้จัดทั้งหมด --</option>
        {organizers.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}
