// instrumentation.ts
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const tracerProvider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "continue-vscode-extension",
    // Project name in Phoenix, defaults to "default"
    [SEMRESATTRS_PROJECT_NAME]: "continue-vscode-extension",
  }),
  spanProcessors: [
    // BatchSpanProcessor will flush spans in batches after some time,
    // this is recommended in production. For development or testing purposes
    // you may try SimpleSpanProcessor for instant span flushing to the Phoenix UI.
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `http://localhost:6006/v1/traces`,
        // (optional) if connecting to Phoenix Cloud
        // headers: { "api_key": process.env.PHOENIX_API_KEY },
        // (optional) if connecting to self-hosted Phoenix with Authentication enabled
        // headers: { "Authorization": `Bearer ${process.env.PHOENIX_API_KEY}` }
      })
    ),
  ],
});
tracerProvider.register();

console.log("👀 OpenInference initialized for Continue VS Code Extension"); 