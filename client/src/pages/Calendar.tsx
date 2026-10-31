import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type CalendarItem = inferRouterOutputs<AppRouter>["content"]["calendar"][number];

const toneClass = { professional: "bg-blue-50 text-blue-700 border-blue-200", casual: "bg-amber-50 text-amber-700 border-amber-200", punchy: "bg-violet-50 text-violet-700 border-violet-200" } as const;
const toneDot = { professional: "bg-blue-500", casual: "bg-amber-500", punchy: "bg-violet-500" } as const;
const toneOrder: CalendarItem["tone"][] = ["professional", "casual", "punchy"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabel(value: Date | string | null | undefined) { if (!value) return "Unscheduled"; return new Date(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
function timeLabel(value: Date | string | null | undefined) { if (!value) return ""; return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function dayKey(value: Date) { return format(value, "yyyy-MM-dd"); }

export default function CalendarPage() {
  const calendarQuery = trpc.content.calendar.useQuery();
  const items = calendarQuery.data ?? [];

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const scheduledAt = item.scheduledAt;
      if (!scheduledAt) continue;
      const key = dayKey(new Date(scheduledAt));
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items]);

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => startOfDay(new Date()));

  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) }), [cursor]);

  const handleSelectDay = (day: Date) => {
    setSelectedDate(day);
    if (!isSameMonth(day, cursor)) setCursor(startOfMonth(day));
  };

  const goToday = () => {
    setCursor(startOfMonth(new Date()));
    setSelectedDate(startOfDay(new Date()));
  };

  const selectedItems = selectedDate ? itemsByDay.get(dayKey(selectedDate)) ?? [] : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="section-kicker">CONTENT / CALENDAR</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500">Scheduled and published content items.</p>
        </div>
        <Link href="/"><button className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700"><FileText size={14} /> Back to queue</button></Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary label="TOTAL" value={items.length} />
        <Summary label="SCHEDULED" value={items.filter(item => item.status === "scheduled").length} />
        <Summary label="PUBLISHED" value={items.filter(item => item.status === "published").length} />
      </section>

      {calendarQuery.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <CalendarDays className="mx-auto text-slate-400" size={28} />
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-slate-500">CALENDAR_EMPTY</p>
          <p className="mt-2 text-sm text-slate-600">Approved items will appear here after scheduling.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setCursor(c => subMonths(c, 1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
                <span className="min-w-[9rem] text-center text-sm font-semibold text-slate-900">{format(cursor, "MMMM yyyy")}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setCursor(c => addMonths(c, 1))} aria-label="Next month"><ChevronRight size={16} /></Button>
              </div>
              <Button variant="ghost" onClick={goToday} className="h-8 px-3 text-xs font-medium text-slate-600">Today</Button>
            </div>
            <MonthGrid days={days} cursor={cursor} itemsByDay={itemsByDay} selectedDate={selectedDate} onSelectDay={handleSelectDay} />
          </div>
          <DayDetailPanel date={selectedDate} items={selectedItems} />
        </div>
      )}
    </div>
  );
}

function MonthGrid({ days, cursor, itemsByDay, selectedDate, onSelectDay }: { days: Date[]; cursor: Date; itemsByDay: Map<string, CalendarItem[]>; selectedDate: Date | null; onSelectDay: (day: Date) => void }) {
  return (
    <Card className="rounded-md border-slate-200 bg-white shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(d => <div key={d} className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map(day => <DayCell key={dayKey(day)} day={day} cursor={cursor} itemsByDay={itemsByDay} selectedDate={selectedDate} onSelectDay={onSelectDay} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function DayCell({ day, cursor, itemsByDay, selectedDate, onSelectDay }: { day: Date; cursor: Date; itemsByDay: Map<string, CalendarItem[]>; selectedDate: Date | null; onSelectDay: (day: Date) => void }) {
  const dayItems = itemsByDay.get(dayKey(day)) ?? [];
  const inMonth = isSameMonth(day, cursor);
  const isToday = isSameDay(day, new Date());
  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
  const tonesPresent = toneOrder.filter(tone => dayItems.some(item => item.tone === tone));

  return (
    <button type="button" onClick={() => onSelectDay(day)} aria-pressed={isSelected} className={`flex min-h-[64px] flex-col rounded-md border p-1.5 text-left transition-colors sm:min-h-[88px] lg:min-h-[104px] ${isSelected ? "border-blue-300 bg-blue-50 ring-2 ring-blue-500" : "border-slate-200 bg-white hover:bg-slate-50"} ${inMonth ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between">
        {isToday ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{format(day, "d")}</span> : <span className={`text-xs font-semibold ${inMonth ? "text-slate-700" : "text-slate-300"}`}>{format(day, "d")}</span>}
        {dayItems.length > 0 && <span className="rounded-full bg-slate-900 px-1.5 font-mono text-[10px] leading-none text-white">{dayItems.length}</span>}
      </div>
      {tonesPresent.length > 0 && (
        <div className="mt-1 hidden flex-wrap gap-1 sm:flex">
          {tonesPresent.slice(0, 3).map(tone => <span key={tone} className={`size-1.5 rounded-full ${toneDot[tone]}`} />)}
        </div>
      )}
    </button>
  );
}

function DayDetailPanel({ date, items }: { date: Date | null; items: CalendarItem[] }) {
  return (
    <Card className="rounded-md border-slate-200 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <CalendarDays size={15} className="text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-slate-800">{date ? format(date, "EEEE, MMM d") : "Select a day"}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{items.length} item(s)</p>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarDays className="mx-auto text-slate-400" size={24} />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">NO_CONTENT</p>
            <p className="mt-2 text-sm text-slate-600">Nothing scheduled for this day.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {items.map(item => (
              <article key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.status === "published" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>{item.status === "published" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`rounded-sm text-[10px] uppercase ${toneClass[item.tone]}`}>{item.tone}</Badge>
                    <span className="font-mono text-[10px] uppercase text-slate-400">{item.status === "published" ? `published ${timeLabel(item.publishedAt)}` : `scheduled ${timeLabel(item.scheduledAt)}`}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800">{item.body}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-400">ID {item.id}</span>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="font-mono text-[10px] font-semibold tracking-wider text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div></div>; }
