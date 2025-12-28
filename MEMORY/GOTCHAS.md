# GOTCHAS

## LangFuse Telemetry
When using Langfuse on individual agent level, we added the following snippet to the code:
```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
 
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});
```

This is only used for dev purpose only to evaluate individual agent.

When the whole app is setup. Officially, [an `instrumentation.ts` file should be set up](https://langfuse.com/integrations/frameworks/vercel-ai-sdk#setup-with-nextjs) so the telemetry service can be registered when Next.js app starts up. 

## Building a Notion Skill without Notion MCP
I decided not to build with Notion MCP. Reasons:
1. complicated tools and schema, but doesn't offer even the basics of retrieving a schema from data source.
2. Notion officially exposed just 2 tools to other AI providers via connectors (fetch and search), this is not useful at all.

On the other hand, Notion API is well documented and has a good coverage of use cases.

Things are more dynamic when trying to read/write a block to a page in a data source/database. To unpack this sequentially:
0. [only once during setup] Query database/data source via search. Obtain the ID-name mapping
1. [as a prerequsit or when later step fails] check the schema (subject to change)
2. [skip if write a new page] Use filter and sort to find a page, this requires understanding of the schema
3. read/write a page/block

This naturally fits into the "Agent Skill" domain which can include some cross-session artifacts (in Notion's case, ID-name mapping, and schema manipulation guide).