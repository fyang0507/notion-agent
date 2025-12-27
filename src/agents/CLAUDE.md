## Adding telemetry to Agent/LLM declaration
When creating new Agent or LLM calls, make sure to include `experimental_telemetry: { isEnabled: true }` as an extra parameter to enable telemetry.

Example: 
```ts
const { text } = await generateText({
    model: 'deepseek/deepseek-v3.2',
    prompt,
    experimental_telemetry: { isEnabled: true },
});
```