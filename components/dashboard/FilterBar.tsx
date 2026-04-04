'use client';
import { Category, CurationStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CalendarDays } from 'lucide-react';

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
const STATUS_FILTERS = ['All', 'Interested', 'Follow Up', 'Rejected'] as const;
const BADGE_FILTERS = ['All', 'AMAST Aligned', 'No SEA Competitor'] as const;

function PillGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  activeClass = 'bg-slate-800 text-white',
}: {
  label: string;
  options: readonly T[];
  selected: T;
  onChange: (v: T) => void;
  activeClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap',
              selected === opt
                ? activeClass
                : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Category */}
        <PillGroup
          label="Type"
          options={CATEGORY_TABS}
          selected={props.selectedCategory}
          onChange={(v) => props.onCategoryChange(v as 'All' | Category)}
          activeClass="bg-violet-600 text-white shadow-sm"
        />

        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* Status */}
        <PillGroup
          label="Status"
          options={STATUS_FILTERS}
          selected={props.selectedStatus}
          onChange={(v) => props.onStatusChange(v as 'All' | CurationStatus)}
        />

        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* Badge */}
        <PillGroup
          label="Badge"
          options={BADGE_FILTERS}
          selected={props.selectedBadge}
          onChange={(v) => props.onBadgeChange(v as 'All' | 'AMAST Aligned' | 'No SEA Competitor')}
        />

        {/* Date — pushed to right */}
        <div className="ml-auto flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          <div className="relative">
            <select
              value={props.selectedDate}
              onChange={(e) => props.onDateChange(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 pr-7 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {props.availableDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">▾</span>
          </div>
        </div>
      </div>
    </div>
  );
}
