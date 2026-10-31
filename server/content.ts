import { and, asc, desc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { contentItems, type ContentItem, type ContentTone } from "../drizzle/schema";
import { getDb } from "./db";

const tones: ContentTone[] = ["professional", "casual", "punchy"];

export type GeneratedVariant = {
  topic: string;
  body: string;
  tone: ContentTone;
  source: "ai" | "template";
};

function cleanTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ").slice(0, 180);
}

export function buildTemplateVariants(topic: string): GeneratedVariant[] {
  const subject = cleanTopic(topic) || "your next big idea";
  return [
    {
      topic: subject,
      tone: "professional",
      source: "template",
      body: `A thoughtful take on ${subject}: progress compounds when you make the next useful step visible. What is one practical move your team can make this week?`,
    },
    {
      topic: subject,
      tone: "casual",
      source: "template",
      body: `Been thinking about ${subject} lately. The small experiments are usually where the good stuff starts. What are you testing right now?`,
    },
    {
      topic: subject,
      tone: "punchy",
      source: "template",
      body: `${subject} is not a someday project. Start smaller. Ship sooner. Learn faster.`,
    },
  ];
}

function extractText(response: any): string {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part?.text ?? "").join("");
  return "";
}

async function generateWithBuiltInModel(topic: string): Promise<GeneratedVariant[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a social media editor. Return exactly three concise post variants as JSON with a variants array. Each item must have tone (professional, casual, or punchy), body, and topic. Do not include hashtags unless they genuinely improve the post. Keep each body under 280 characters.",
      },
      { role: "user", content: `Create three distinct social media posts about: ${topic}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_post_variants",
        strict: true,
        schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  tone: { type: "string", enum: tones },
                  body: { type: "string" },
                },
                required: ["topic", "tone", "body"],
                additionalProperties: false,
              },
            },
          },
          required: ["variants"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = extractText(response);
  const parsed = JSON.parse(raw) as { variants: Array<{ topic: string; tone: ContentTone; body: string }> };
  if (!Array.isArray(parsed.variants) || parsed.variants.length < 3) throw new Error("The AI response did not contain three variants");
  return parsed.variants.slice(0, 3).map(variant => ({
    topic: cleanTopic(variant.topic || topic),
    tone: tones.includes(variant.tone) ? variant.tone : "professional",
    body: String(variant.body || "").trim().slice(0, 1000),
    source: "ai",
  }));
}

async function generateWithGroq(topic: string): Promise<GeneratedVariant[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return generateWithBuiltInModel(topic);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON: { variants: [{ topic, tone, body }] }. Use exactly three variants with tones professional, casual, punchy. Keep body under 280 characters." },
        { role: "user", content: `Create three social media posts about: ${topic}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Groq request failed with ${response.status}`);
  const json = await response.json() as any;
  const parsed = JSON.parse(json?.choices?.[0]?.message?.content || "{}");
  if (!Array.isArray(parsed.variants) || parsed.variants.length < 3) throw new Error("Groq response did not contain three variants");
  return parsed.variants.slice(0, 3).map((variant: any) => ({
    topic: cleanTopic(variant.topic || topic),
    tone: tones.includes(variant.tone) ? variant.tone : "professional",
    body: String(variant.body || "").trim().slice(0, 1000),
    source: "ai",
  }));
}

export async function generateVariants(topic: string): Promise<GeneratedVariant[]> {
  const normalized = cleanTopic(topic);
  if (!normalized) throw new Error("Topic is required");
  try {
    return await generateWithGroq(normalized);
  } catch (error) {
    console.warn("[Content] AI generation failed; using local templates", error);
    return buildTemplateVariants(normalized);
  }
}

export async function insertGeneratedVariants(userId: number, variants: GeneratedVariant[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(contentItems).values(variants.map(variant => ({ ...variant, userId })));
  return listQueue(userId);
}

export async function listQueue(userId: number) {
  const db = await getDb();
  if (!db) return [] as ContentItem[];
  return db.select().from(contentItems)
    .where(and(eq(contentItems.userId, userId), inArray(contentItems.status, ["draft", "approved", "scheduled"])))
    .orderBy(desc(contentItems.createdAt));
}

export async function getContentById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId))).limit(1);
  return result[0];
}

export async function approveContent(userId: number, id: number, body?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(contentItems).set({ status: "approved", body: body?.trim() || undefined, approvalNote: null }).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)));
  return getContentById(userId, id);
}

export async function rejectContent(userId: number, id: number, note?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(contentItems).set({ status: "rejected", approvalNote: note?.trim() || "Rejected during review" }).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)));
  return getContentById(userId, id);
}

export async function scheduleContent(userId: number, id: number, scheduledAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  if (scheduledAt.getTime() <= Date.now()) throw new Error("Choose a future time");
  await db.update(contentItems).set({ status: "scheduled", scheduledAt }).where(and(eq(contentItems.id, id), eq(contentItems.userId, userId), inArray(contentItems.status, ["approved", "scheduled"])));
  return getContentById(userId, id);
}

export async function listCalendar(userId: number) {
  const db = await getDb();
  if (!db) return [] as ContentItem[];
  return db.select().from(contentItems).where(and(eq(contentItems.userId, userId), isNotNull(contentItems.scheduledAt))).orderBy(asc(contentItems.scheduledAt));
}

export async function runDuePublications() {
  const db = await getDb();
  if (!db) return { publishedCount: 0, ids: [] as number[] };
  const due = await db.select({ id: contentItems.id }).from(contentItems).where(and(eq(contentItems.status, "scheduled"), lte(contentItems.scheduledAt, new Date())));
  if (due.length === 0) return { publishedCount: 0, ids: [] as number[] };
  const ids = due.map(item => item.id);
  await db.update(contentItems).set({ status: "published", publishedAt: new Date(), usedAt: new Date() }).where(inArray(contentItems.id, ids));
  return { publishedCount: ids.length, ids };
}

export async function getAnalytics(userId: number) {
  const db = await getDb();
  if (!db) return { used: 0, scheduled: 0, drafts: 0, byTone: tones.map(tone => ({ tone, count: 0 })), topTone: null as ContentTone | null };
  const rows = await db.select().from(contentItems).where(eq(contentItems.userId, userId));
  const byTone = tones.map(tone => ({ tone, count: rows.filter(row => row.tone === tone && row.usedAt).length }));
  const topTone = [...byTone].sort((a, b) => b.count - a.count)[0];
  return {
    used: rows.filter(row => row.usedAt).length,
    scheduled: rows.filter(row => row.status === "scheduled").length,
    drafts: rows.filter(row => row.status === "draft").length,
    byTone,
    topTone: topTone && topTone.count > 0 ? topTone.tone : null,
  };
}
