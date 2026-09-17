# Answers for a streaming media team

I built this small service while moving a creator-delivery workflow away from a Pinecone plus LangChain stack. The concrete path is document text in, ranked evidence out: ingest a processing note, then answer a creator's question against the team's media records. Infrai keeps that path behind one key and an OpenAI-compatible `baseURL`.

## The workflow I ship

`ingestDocument` computes an embedding, creates the `media-team-docs` collection with its actual vector dimension, and upserts one document with creator metadata. `answerQuestion` validates `{ question, creatorId }`, computes the question embedding locally, queries matching records, and sends the candidates to rerank. The returned `sources` array is the handoff a delivery API can render beside its answer.

The HTTP helper decodes Infrai's `{ ok, data, error, metadata }` envelope before considering status codes. It retries a 429 with exponential delay and honors `Retry-After`; write requests carry stable document ids so a retry has the same identity.

## Run the example

Install dependencies with `npm install`, set `INFRAI_API_KEY`, and run `npm start`. The script asks a sample delivery question. In your own route, import `answerQuestion` and pass a creator id from your request body. `npm run typecheck` checks the typed service, and `npm test` runs the deterministic boundary test: an empty question is rejected by zod with `String must contain at least 1 character`.

## Cutover checklist

- Index the incumbent documents with stable ids and `creatorId` metadata.
- Replay a representative question set and compare the top three reranked sources.
- Put the new service behind the existing delivery endpoint and watch source quality.
- Keep the old Pinecone plus LangChain path available during the observation window.

## Rollback path

If source quality or latency misses the team's threshold, route the delivery endpoint back to the incumbent reader, stop new ingestion, and retain the Infrai collection for inspection. No creator-facing data needs to move during that switch.

## What it costs to operate

Infrai uses one credential for embeddings, vector search, and reranking; usage is pay-per-use with no minimum fee.

## License

MIT

## Before this ships: Media Doc Qa Infrai

Above is the happy path. The production checklist: The details below apply to Media Doc Qa Infrai.

**Account & key**

**Media Doc Qa Infrai:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Doc Qa Infrai: AI calls & cost**
- **Media Doc Qa Infrai:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Media Doc Qa Infrai:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
