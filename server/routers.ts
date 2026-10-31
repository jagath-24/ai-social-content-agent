import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { approveContent, generateVariants, getAnalytics, insertGeneratedVariants, listCalendar, listQueue, rejectContent, runDuePublications, scheduleContent } from "./content";

const contentId = z.number().int().positive();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  content: router({
    queue: protectedProcedure.query(({ ctx }) => listQueue(ctx.user.id)),
    calendar: protectedProcedure.query(({ ctx }) => listCalendar(ctx.user.id)),
    analytics: protectedProcedure.query(({ ctx }) => getAnalytics(ctx.user.id)),
    generate: protectedProcedure.input(z.object({ topic: z.string().min(2).max(180) })).mutation(async ({ ctx, input }) => {
      const variants = await generateVariants(input.topic);
      return { variants, queue: await insertGeneratedVariants(ctx.user.id, variants) };
    }),
    approve: protectedProcedure.input(z.object({ id: contentId, body: z.string().min(1).max(1000).optional() })).mutation(({ ctx, input }) => approveContent(ctx.user.id, input.id, input.body)),
    reject: protectedProcedure.input(z.object({ id: contentId, note: z.string().max(500).optional() })).mutation(({ ctx, input }) => rejectContent(ctx.user.id, input.id, input.note)),
    schedule: protectedProcedure.input(z.object({ id: contentId, scheduledAt: z.coerce.date() })).mutation(({ ctx, input }) => scheduleContent(ctx.user.id, input.id, input.scheduledAt)),
    runScheduler: protectedProcedure.mutation(() => runDuePublications()),
  }),
});

export type AppRouter = typeof appRouter;
