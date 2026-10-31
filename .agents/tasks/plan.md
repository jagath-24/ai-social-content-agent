# Implementation Plan — Visual Monthly Calendar Grid

Replace the text-based, date-grouped list in `Calendar.tsx` with a visual month grid that marks days with content, shows per-day counts, supports month navigation, and reveals a clicked day's items in a detail panel. Single-file change; no new endpoints, no new files.

## Decisions & rationale

### 1. Custom date-fns month grid (not the shadcn `Calendar` picker)
`client/src/components/ui/calendar.tsx` wraps react-day-picker's `DayPicker` — a single-date (or range) selection component. Its `CalendarDayButton` renders one `Button` per day driven by selection modifiers (`selected`, `range_start`, etc.); there is no slot to render multiple events, tone dots, or counts per day. Forcing multi-event display onto it means overriding `DayButton`, fighting the selection model, and discarding the picker semantics, while losing layout control. A custom 7-column grid built from date-fns gives full control over each cell (day number, today highlight, tone dots, count badge, click → detail) without fighting the picker. The task explicitly recommends this. Build the day array with date-fns: `startOfMonth`, `endOfMonth`, `startOfWeek`/`endOfWeek` (with `weekStartsOn: 0`), and `eachDayOfInterval`, so the grid always renders full weeks (28–42 cells) including leading/trailing outside-days.

### 2. Data structure — group by a normalized day key
Keep the existing `trpc.content.calendar.useQuery()` (no new endpoints). It returns `ContentItem[]` where every item has a non-null `scheduledAt` (confirmed in `server/content.ts` `listCalendar` and `drizzle/schema.ts` `ContentItem`). Replace the current `new Date(item.scheduledAt).toDateString()` key with a stable normalized key `format(new Date(item.scheduledAt), "yyyy-MM-dd")` via date-fns. Build a `Map<string, ContentItem[]>` once (in `useMemo` over `items`). Normalize defensively with `new Date(item.scheduledAt)` to match the existing code's handling of superjson/JSON dates and avoid timezone-shift surprises. Lookup for a clicked day uses the same `format(day, "yyyy-MM-dd")` key.

### 3. Component structure (all inside `Calendar.tsx`)
- **`CalendarPage`** (default export): keeps the page header + top Summary cards + loading/global-empty states; holds month-navigation state and selected-day state; renders the grid and the detail panel in a responsive two-column layout.
- **`MonthGrid`** (local component): receives `cursor`, `itemsByDay`, `selectedDate`, and an `onSelectDay(day)` callback. Renders the weekday header row + the 7-column day grid.
- **`DayCell`** (local component): one cell — day number, today ring, tone dots + count badge, selected highlight, outside-month dimming, click handler.
- **`DayDetailPanel`** (local component): receives the selected `Date` and its `ContentItem[]`; renders a Card with the formatted day header, count kicker, and the per-item article list reusing the existing tone/status/ID/time rendering.
- Keep the existing `Summary`, `toneClass`, `dayLabel`, `timeLabel` helpers.

### 4. Month-navigation state model
`const [cursor, setCursor] = useState(() => startOfMonth(new Date()))` anchors the viewed month to the 1st. Prev/next via `setCursor(c => subMonths(c, 1))` / `addMonths`. A "Today" button calls `setCursor(startOfMonth(new Date()))` and `setSelectedDate(startOfDay(new Date()))`. The day array is derived: `startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })` → `endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })` via `eachDayOfInterval`.

### 5. Selected-day state + interaction flow
`const [selectedDate, setSelectedDate] = useState<Date | null>(startOfDay(new Date()))` — initialized to today so the panel is never blank on load (shows today's items or a per-day empty state). Clicking any `DayCell` calls `onSelectDay(day)` → `setSelectedDate(day)`. If the clicked cell is an outside-month day, also `setCursor(startOfMonth(day))` so the grid jumps to that day's month (good cross-month UX). The detail panel reads `itemsByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? []`.

### 6. Styling — match existing conventions exactly
- Layout: `lg:grid lg:grid-cols-[minmax(0,1fr)_340px]` (grid left, detail panel right), single-column/stacked on mobile (mirrors `Home.tsx` `xl:grid-cols-[minmax(0,1fr)_300px]`).
- Grid container: `Card rounded-md border-slate-200 bg-white shadow-sm` with `CardContent p-3 sm:p-4`; weekday header `font-mono text-[10px] uppercase tracking-wider text-slate-400`; day grid `grid grid-cols-7 gap-px` with a subtle `bg-slate-200` divider trick (cells `bg-white`) or `gap-1`.
- `DayCell` (a `<button>` for a11y, `aria-pressed` when selected): `min-h-[64px] sm:min-h-[88px] lg:min-h-[104px] rounded-md border text-left p-1.5`. Day number `text-xs font-semibold text-slate-700`. Outside-month cells `text-slate-300` + `opacity-60`. Today's number gets a `bg-blue-600 text-white rounded-full size-5` badge. Selected cell `ring-2 ring-blue-500 bg-blue-50 border-blue-300`.
- Indicators (days with items): a count badge `font-mono text-[10px] rounded-full bg-slate-900 text-white px-1.5` showing `itemsByDay.get(key).length`, plus up to 3 tone dots `size-1.5 rounded-full` colored `bg-blue-500` (professional), `bg-amber-500` (casual), `bg-violet-500` (punchy); dots shown `hidden sm:flex` to keep mobile clean.
- Month-nav bar (above grid): shadcn `Button variant="ghost" size="icon-sm"` with `ChevronLeft`/`ChevronRight` (lucide), centered label `format(cursor, "MMMM yyyy")` (`text-sm font-semibold text-slate-900`), and a `Button variant="ghost"` "Today".
- Detail panel: shadcn `Card rounded-md border-slate-200 bg-white shadow-sm`, header `format(selectedDate, "EEEE, MMM d")` + count kicker `font-mono text-[10px] uppercase tracking-wider text-slate-400` ("N item(s)"). Per item: the exact article markup from the current `Calendar.tsx` — tone `Badge variant="outline"` with `toneClass[item.tone]`, status icon `CheckCircle2`/`Clock3` in emerald/blue circles, `font-mono` ID, `dayLabel`/`timeLabel`. Per-day empty state reuses the dashed-border empty pattern (CalendarDays icon + font-mono kicker).
- Keep the page header (`section-kicker` "CONTENT / CALENDAR", `h1` "Schedule", subtitle, Back-to-queue `Link`) and the three `Summary` cards (TOTAL/SCHEDULED/PUBLISHED) unchanged in styling.

### 7. Constraints honored
- Only `client/src/pages/Calendar.tsx` is modified. Everything (grid, cells, panel, helpers) is self-contained in that file — no shared helper file is needed.
- No new tRPC/API endpoints; reuses `trpc.content.calendar`.
- date-fns (^4.1.0, already a dependency) via named imports matching `ComponentShowcase.tsx` (`import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, startOfDay, format } from "date-fns"`).
- Responsive (stacked on mobile, two-column `lg+`).

### Verification note (no client test harness)
`vitest.config.ts` sets `environment: "node"` and `include: ["server/**/*.test.ts", ...]` — there is no jsdom/client unit-test runner. Adding a client component test would require standing up a new test harness (out of scope for a single-file UI change). Verification is therefore: typecheck (`pnpm check`), production build (`pnpm build`), and a manual smoke test. `pnpm test` is still run to confirm no server-side regression.

---

## Steps

- [ ] 1. Rewrite `client/src/pages/Calendar.tsx` to a visual month grid + detail panel.
      Add the date-fns named imports listed above; keep `trpc.content.calendar.useQuery()`. Build `itemsByDay` (`Map<string, ContentItem[]>`, keyed `format(new Date(item.scheduledAt), "yyyy-MM-dd")`) in `useMemo`. Add `cursor` (`startOfMonth(new Date())`) and `selectedDate` (`startOfDay(new Date())`) state; derive the 42-cell day array from `startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })` → `endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })`. Implement the local `MonthGrid` (weekday header + `grid grid-cols-7`), `DayCell` (number, today badge, tone dots + count, selected ring, outside-month dim, click → `onSelectDay`), and `DayDetailPanel` (Card with formatted day header + count kicker + per-item article list reusing existing `toneClass`/status icon/`font-mono` ID/`timeLabel`). Add a month-nav bar (ChevronLeft/ChevronRight + "Today") and lay out grid + panel in `lg:grid lg:grid-cols-[minmax(0,1fr)_340px]`. Keep the existing page header, the three `Summary` cards, the `Loader2` loading state, and the global no-items empty state.
      Files: `client/src/pages/Calendar.tsx`
      Verify: `pnpm check` (tsc --noEmit) passes with no errors in the changed file; `pnpm build` (vite build + esbuild) completes.

- [ ] 2. Run full verification and manual smoke test.
      Run `pnpm test` to confirm no server-side regression (no client tests exist by config). Then `pnpm dev`, open `/calendar` while signed in, and confirm: the 7-column month grid renders for the current month; days with scheduled/published content show tone dots + a count badge; prev/next month buttons and "Today" navigate correctly; clicking a day selects it (ring highlight) and the detail panel shows that day's items with tone color + status + ID + time; clicking an outside-month day moves the grid to that month; the layout stacks on a narrow viewport and shows the two-column layout at `lg+`.
      Files: none (verification only)
      Verify: `pnpm check`, `pnpm build`, and `pnpm test` all pass; manual smoke confirms the six interaction/visual requirements above.
