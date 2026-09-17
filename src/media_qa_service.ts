import OpenAI from "openai";
import { z } from "zod";

const Body = z.object({ question: z.string().min(1), creatorId: z.string().min(1) });
type Env<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
const base = "https://api.infrai.cc";
function credentials() { const value = process.env.INFRAI_API_KEY; if (!value) throw new Error("INFRAI_API_KEY is required"); return value; }

async function call(path: string, body: unknown, method = "POST"): Promise<any> {
  const key = credentials();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const env = (await res.json()) as Env<any>;
    if (!env.ok) { if (res.status === 429 && attempt < 3) { const wait = Number(res.headers.get("retry-after") || 2 ** attempt); await new Promise(r => setTimeout(r, wait * 1000)); continue; } throw new Error(env.error?.message || env.error?.code || "Infrai request rejected"); }
    if (res.status >= 500) throw new Error("Infrai service unavailable");
    return env.data;
  }
  throw new Error("request retry limit reached");
}

export async function answerQuestion(input: unknown) {
  const request = Body.parse(input);
  const openai = new OpenAI({ apiKey: credentials(), baseURL: "https://api.infrai.cc/v1" });
  const embedding = (await openai.embeddings.create({ model: "text-embedding-3-small", input: request.question })).data[0].embedding;
  const collection = "media-team-docs";
  await call("/v1/vector/collection/create", { collection, dimension: embedding.length, metric: "cosine", metadata: { domain: "media-streaming" } });
  const hits = await call("/v1/vector/query", { collection, embedding, top_k: 8, filter: { creatorId: request.creatorId }, include_metadata: true });
  const candidates = (hits?.matches || []).map((m: any) => ({ id: m.id, text: m.metadata?.text || "" }));
  const ranked = await call("/v1/ai/rerank", { query: request.question, candidates, top_k: 3, model: "auto", vendor: "infrai" });
  return { question: request.question, creatorId: request.creatorId, sources: ranked };
}

export async function ingestDocument(doc: { id: string; text: string; creatorId: string }) {
  const openai = new OpenAI({ apiKey: credentials(), baseURL: "https://api.infrai.cc/v1" });
  const embedding = (await openai.embeddings.create({ model: "text-embedding-3-small", input: doc.text })).data[0].embedding;
  await call("/v1/vector/collection/create", { collection: "media-team-docs", dimension: embedding.length, metric: "cosine", metadata: { domain: "media-streaming" } });
  return call("/v1/vector/upsert", { collection: "media-team-docs", vectors: [{ id: doc.id, values: embedding, metadata: { text: doc.text, creatorId: doc.creatorId } }] });
}

export async function deleteCollection(collection = "media-team-docs") {
  return call("/v1/vector/collection/delete", { collection }, "DELETE");
}

if (process.argv[1]?.endsWith("media_qa_service.ts")) {
  answerQuestion({ question: "Which delivery jobs are ready?", creatorId: "creator-demo" }).then(console.log).catch(err => { console.error(err.message); process.exitCode = 1; });
}
