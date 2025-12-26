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