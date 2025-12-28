import { registerOTel } from "@vercel/otel";
import { LangfuseExporter } from "langfuse-vercel";

export function register() {
  registerOTel({
    serviceName: "notion-agent",
    traceExporter: new LangfuseExporter({ debug: true }),
  });
}
