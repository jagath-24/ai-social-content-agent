# Verification — Visual Monthly Calendar Grid

## Task
Replace the text-based calendar view in `client/src/pages/Calendar.tsx` with a visual monthly calendar grid (month navigation, per-day content indicators + counts, click-to-show detail panel, tone/status rendering), reusing `trpc.content.calendar` and date-fns, without new endpoints or breaking other pages.

## What changed
- Rewrote `client/src/pages/Calendar.tsx` only (single-file change).
- Added date-fns month-grid build (`startOfMonth`/`endOfMonth`/`startOfWeek`/`endOfWeek`/`eachDayOfInterval` with `weekStartsOn: 0`), `cursor` + `selectedDate` state, and local `MonthGrid` / `DayCell` / `DayDetailPanel` components.
- Grouped items into `Map<string, CalendarItem[]>` keyed by `format(new Date(item.scheduledAt), "yyyy-MM-dd")` (defensive null guard for the `Date | null` type).
- Month-nav bar (ChevronLeft/ChevronRight + "Today") using shadcn `Button`; grid + panel in a responsive `flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]` layout.
- Kept the existing page header, three `Summary` cards, `Loader2` loading state, and global no-items empty state. Reused `toneClass`/`timeLabel`/`Summary` and the per-item article markup (tone `Badge`, status icon in emerald/blue, `font-mono` ID, `timeLabel`).
- Derived the item type via `inferRouterOutputs<AppRouter>["content"]["calendar"][number]` (type-only import, erased at build).

## Commands run and results

| Command | Result |
| --- | --- |
| `pnpm -C "..." check` (`tsc --noEmit`) | PASS — exit 0, no type errors |
| `pnpm -C "..." build` (`vite build && esbuild`) | PASS — exit 0; vite `2059 modules transformed`, `built in 5.73s`; esbuild `dist\index.js 46.9kb` |
| `pnpm -C "..." test` (`vitest run`) | PASS — 2 files, 2 tests passed (server regressions: none) |

Build output excerpt:
```
vite v7.1.9 building for production...
✓ 2059 modules transformed.
../dist/public/assets/index-CkBljCtQ.js   475.79 kB │ gzip: 141.65 kB
✓ built in 5.73s
dist\index.js  46.9kb
```

## Requirement checklist (confirmed via code + build)
1. Visual monthly calendar grid — 7-column `grid grid-cols-7` of date-fns-derived day cells. ✓
2. Days with content are visually marked — count badge + up-to-3 tone dots. ✓
3. Clicking a day shows that day's items — `DayDetailPanel` (right column on `lg+`, below on mobile). ✓
4. Month navigation — prev/next chevrons + "Today". ✓
5. Item count per day — `bg-slate-900` count badge. ✓
6. Items show tone color and status — tone `Badge` + emerald/blue status icon in the panel. ✓

## Manual smoke test
Not performed in this environment (no browser). Rendering is confirmed by the successful production build (module transform + bundling of `Calendar.tsx`, date-fns, and the shadcn primitives). A live browser smoke at `/calendar` while signed in should confirm the six interactions above.

## Notes
- No client unit-test harness exists (vitest is configured `environment: "node"`, `include: ["server/**/*.test.ts", ...]`); verification is typecheck + build + server tests, per the plan.
- No new files; only `client/src/pages/Calendar.tsx` modified.
