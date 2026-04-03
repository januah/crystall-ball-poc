'use client';
import { Category, CurationStatus } from '@/types';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  selectedCategory: 'All' | Category;
  onCategoryChange: (c: 'All' | Category) => void;
  selectedStatus: 'All' | CurationStatus;
  onStatusChange: (s: 'All' | CurationStatus) => void;
  selectedBadge: 'All' | 'AMAST Aligned' | 'No SEA Competitor';
  onBadgeChange: (b: 'All' | 'AMAST Aligned' | 'No SEA Competitor') => void;
  selectedDate: string;
  onDateChange: (d: string) => void;
  availableDates: string[];
}

const CATEGORY_TABS = ['All', 'Emerging Tech', 'Emerging SaaS'] as const;
const STATUS_FILTERS = ['All', 'Interested', 'Rejected', 'Follow Up'] as const;
const BADGE_FILTERS = ['All', 'AMAST Aligned', 'No SEA Competitor'] as const;

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Date + Category tabs row */}
      <div className="flex items-center justify-between gap-4">
        {/* Category tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat}
              onClick={() => props.onCategoryChange(cat as 'All' | Category)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                props.selectedCategory === cat
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Date:</span>
          <div className="relative">
            <select
              value={props.selectedDate}
              onChange={(e) => props.onDateChange(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-8 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
            >
              {props.availableDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▾</span>
          </div>
        </div>
      </div>

      {/* Status + Badge filter row */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => props.onStatusChange(s as 'All' | CurationStatus)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs transition-all',
                  props.selectedStatus === s
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Badge:</span>
          <div className="flex items-center gap-1">
            {BADGE_FILTERS.map((b) => (
              <button
                key={b}
                onClick={() => props.onBadgeChange(b as 'All' | 'AMAST Aligned' | 'No SEA Competitor')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs transition-all',
                  props.selectedBadge === b
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
