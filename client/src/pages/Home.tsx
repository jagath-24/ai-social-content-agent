import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CalendarClock, Check, Clock3, Loader2, Play, RefreshCw, ThumbsDown, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const toneMeta = {
  professional: { label: "professional", className: "bg-blue-50 text-blue-700 border-blue-200" },
  casual: { label: "casual", className: "bg-amber-50 text-amber-700 border-amber-200" },
  punchy: { label: "punchy", className: "bg-violet-50 text-violet-700 border-violet-200" },
} as const;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [scheduleDraft, setScheduleDraft] = useState<Record<number, string>>({});
  const queueQuery = trpc.content.queue.useQuery();
  const analyticsQuery = trpc.content.analytics.useQuery();
  const generateMutation = trpc.content.generate.useMutation({ onSuccess: data => { setTopic(""); toast.success(`${data.variants.length} variants created`); queueQuery.refetch(); analyticsQuery.refetch(); }, onError: error => toast.error(error.message) });
  const approveMutation = trpc.content.approve.useMutation({ onSuccess: () => { toast.success("Content approved"); queueQuery.refetch(); } });
  const rejectMutation = trpc.content.reject.useMutation({ onSuccess: () => { toast.success("Content rejected"); queueQuery.refetch(); } });
  const scheduleMutation = trpc.content.schedule.useMutation({ onSuccess: item => { toast.success(`Scheduled ${formatDate(item?.scheduledAt)}`); queueQuery.refetch(); analyticsQuery.refetch(); } });
  const runSchedulerMutation = trpc.content.runScheduler.useMutation({ onSuccess: data => { toast.success(data.publishedCount ? `${data.publishedCount} item(s) published` : "No due items"); queueQuery.refetch(); analyticsQuery.refetch(); } });
  const queue = queueQuery.data ?? [];
  const counts = useMemo(() => ({ draft: queue.filter(item => item.status === "draft").length, approved: queue.filter(item => item.status === "approved").length, scheduled: queue.filter(item => item.status === "scheduled").length }), [queue]);

  const handleGenerate = (event: React.FormEvent) => {
    event.preventDefault();
    if (topic.trim().length < 2) return toast.error("Topic must contain at least 2 characters");
    generateMutation.mutate({ topic });
  };

  const handleSchedule = (id: number) => {
    const value = scheduleDraft[id];
    if (!value) return toast.error("Select a schedule time");
    scheduleMutation.mutate({ id, scheduledAt: new Date(value) });
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="section-kicker">CONTENT / QUEUE</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Content queue</h1><p className="mt-1 text-sm text-slate-500">Generate, review, approve, and schedule content items.</p></div>
      <div className="flex gap-2"><Link href="/calendar"><Button variant="outline" className="h-9 rounded-md border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><CalendarClock size={15} className="mr-2" /> Calendar</Button></Link><Button onClick={() => runSchedulerMutation.mutate()} disabled={runSchedulerMutation.isPending} className="h-9 rounded-md bg-slate-900 text-white hover:bg-slate-800"><Play size={14} className="mr-2" /> Run scheduler</Button></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-3"><MetricCard label="DRAFT" value={counts.draft} caption="requires review" /><MetricCard label="APPROVED" value={counts.approved} caption="ready to schedule" /><MetricCard label="SCHEDULED" value={counts.scheduled} caption="waiting for execution" /></section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="rounded-md border-slate-200 bg-white shadow-sm"><CardContent className="p-0"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><div className="section-kicker">GENERATOR</div><h2 className="mt-1 text-sm font-semibold text-slate-900">Create variants</h2></div><WandSparkles size={16} className="text-slate-400" /></div><form onSubmit={handleGenerate} className="p-4"><label htmlFor="topic" className="text-xs font-medium text-slate-700">Topic or theme</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input id="topic" value={topic} onChange={event => setTopic(event.target.value)} placeholder="e.g. incident response process" className="h-10 rounded-md border-slate-300 bg-white text-sm focus-visible:ring-blue-500" /><Button type="submit" disabled={generateMutation.isPending} className="h-10 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700">{generateMutation.isPending ? <Loader2 className="animate-spin" size={15} /> : "Generate"}</Button></div><p className="mt-2 text-xs text-slate-500">Creates three variants: professional, casual, and punchy.</p></form></CardContent></Card>
      <Card className="rounded-md border-slate-200 bg-slate-900 text-white shadow-sm"><CardContent className="p-4"><div className="section-kicker text-slate-400">USAGE SIGNAL</div><div className="mt-3 flex items-baseline justify-between"><span className="text-2xl font-semibold">{analyticsQuery.data?.used ?? 0}</span><span className="text-xs text-slate-400">used items</span></div><div className="mt-4 space-y-2">{(analyticsQuery.data?.byTone ?? []).map(item => <div key={item.tone} className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs"><span className="text-slate-300">{item.tone}</span><span className="font-mono text-slate-100">{item.count}</span></div>)}</div><p className="mt-3 text-xs text-slate-400">Top tone: {analyticsQuery.data?.topTone ?? "none"}</p></CardContent></Card>
    </section>

    <section><div className="mb-3 flex items-end justify-between"><div><div className="section-kicker">REVIEW</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Active items</h2></div><div className="flex items-center gap-2 text-xs text-slate-500"><RefreshCw size={13} className={queueQuery.isFetching ? "animate-spin" : ""} /> {queue.length} items</div></div>{queueQuery.isLoading ? <div className="rounded-md border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading queue…</div> : queue.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><p className="font-mono text-xs uppercase tracking-wider text-slate-500">QUEUE_EMPTY</p><p className="mt-2 text-sm text-slate-600">Generate content to create review items.</p></div> : <div className="grid gap-3 lg:grid-cols-2">{queue.map(item => <DraftCard key={item.id} item={item} editing={editing[item.id] ?? item.body} onEdit={(value: string) => setEditing(prev => ({ ...prev, [item.id]: value }))} onApprove={() => approveMutation.mutate({ id: item.id, body: editing[item.id] ?? item.body })} onReject={() => rejectMutation.mutate({ id: item.id })} scheduleValue={scheduleDraft[item.id] ?? ""} onScheduleChange={(value: string) => setScheduleDraft(prev => ({ ...prev, [item.id]: value }))} onSchedule={() => handleSchedule(item.id)} busy={approveMutation.isPending || rejectMutation.isPending || scheduleMutation.isPending} />)}</div>}</section>
  </div>;
}

function MetricCard({ label, value, caption }: { label: string; value: number; caption: string }) { return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="font-mono text-[10px] font-semibold tracking-wider text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{caption}</div></div>; }

function DraftCard({ item, editing, onEdit, onApprove, onReject, scheduleValue, onScheduleChange, onSchedule, busy }: { item: any; editing: string; onEdit: (value: string) => void; onApprove: () => void; onReject: () => void; scheduleValue: string; onScheduleChange: (value: string) => void; onSchedule: () => void; busy: boolean }) { const meta = toneMeta[item.tone as keyof typeof toneMeta]; return <Card className="rounded-md border-slate-200 bg-white shadow-sm"><CardContent className="p-0"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-2"><Badge variant="outline" className={`rounded-sm px-2 py-0.5 text-[10px] uppercase ${meta.className}`}>{meta.label}</Badge><span className="font-mono text-[10px] text-slate-400">ID {item.id}</span></div><span className={`font-mono text-[10px] uppercase ${item.status === "scheduled" ? "text-emerald-600" : "text-slate-500"}`}>{item.status}</span></div><div className="p-4"><div className="mb-2 text-xs font-medium text-slate-700">{item.topic}</div><Textarea value={editing} onChange={event => onEdit(event.target.value)} disabled={item.status === "scheduled" || item.status === "approved"} className="min-h-[120px] resize-none rounded-md border-slate-300 bg-slate-50 text-sm leading-relaxed text-slate-800 focus-visible:ring-blue-500" />{item.status !== "scheduled" && item.status !== "approved" ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={onApprove} disabled={busy} className="h-8 rounded-md bg-emerald-600 text-xs text-white hover:bg-emerald-700"><Check size={13} className="mr-1.5" /> Approve</Button><Button size="sm" variant="outline" onClick={onReject} disabled={busy} className="h-8 rounded-md border-red-200 bg-white text-xs text-red-600 hover:bg-red-50"><ThumbsDown size={13} className="mr-1.5" /> Reject</Button></div> : null}{item.status === "approved" ? <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3"><div className="flex items-center gap-2 text-xs font-medium text-blue-800"><Clock3 size={13} /> Schedule approved item</div><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input type="datetime-local" value={scheduleValue} onChange={event => onScheduleChange(event.target.value)} className="h-8 rounded-md border-blue-200 bg-white text-xs" /><Button size="sm" onClick={onSchedule} disabled={busy} className="h-8 rounded-md bg-blue-600 text-xs text-white hover:bg-blue-700"><CalendarClock size={13} className="mr-1.5" /> Schedule</Button></div></div> : null}</div></CardContent></Card>; }
