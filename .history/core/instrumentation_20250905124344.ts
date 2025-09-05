import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import {
  OpenInferenceSpanKind,
  SemanticConventions,
  SEMRESATTRS_PROJECT_NAME,
} from "@arizeai/openinference-semantic-conventions";
import opentelemetry, {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  Span,
  trace,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import OpenAI from "openai";

// Set up diagnostic logging (optional, but helpful for debugging)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

// Configuration
const COLLECTOR_ENDPOINT = "http://localhost:4317";
const PROJECT_NAME = "continue";

// Global variables for instrumentation state
let isInstrumentationInitialized = false;
let provider: NodeTracerProvider | undefined;

function isOpenTelemetryAlreadyConfigured(): boolean {
  try {
    const existingProvider = trace.getTracerProvider();
    // Check if there's already a configured provider (not the default NoopTracerProvider)
    const isConfigured =
      existingProvider &&
      existingProvider.constructor.name !== "NoopTracerProvider" &&
      (existingProvider as any)._config;

    console.log(
      `OpenTelemetry provider check: ${existingProvider?.constructor?.name}, configured: ${!!isConfigured}`,
    );
    return !!isConfigured;
  } catch (error) {
    console.warn("Could not check existing OpenTelemetry provider:", error);
    return false;
  }
}

function initializeInstrumentation() {
  if (isInstrumentationInitialized) {
    console.warn("Continue instrumentation already initialized, skipping");
    return;
  }

  try {
    // Check if OpenTelemetry is already configured
    if (isOpenTelemetryAlreadyConfigured()) {
      console.log(
        "OpenTelemetry already configured by another component, using existing setup",
      );

      // Just register OpenAI instrumentation with existing provider
      try {
        const instrumentation = new OpenAIInstrumentation();
        instrumentation.manuallyInstrument(OpenAI);

        registerInstrumentations({
          instrumentations: [instrumentation],
        });
        console.log(
          "OpenAI instrumentation registered with existing OpenTelemetry setup",
        );
      } catch (instrumentationError: any) {
        console.warn(
          "Failed to register OpenAI instrumentation:",
          instrumentationError.message,
        );
      }

      isInstrumentationInitialized = true;
      return;
    }

    // Only create and register our own provider if none exists
    console.log(
      "No existing OpenTelemetry configuration found, creating Continue provider",
    );

    provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: PROJECT_NAME,
        [SEMRESATTRS_PROJECT_NAME]: PROJECT_NAME,
      }),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: COLLECTOR_ENDPOINT,
          }),
        ),
      ],
    });

    // Register our provider
    provider.register();
    console.log("Continue OpenTelemetry provider registered successfully");

    // Register OpenAI instrumentation
    const instrumentation = new OpenAIInstrumentation();
    instrumentation.manuallyInstrument(OpenAI);

    registerInstrumentations({
      instrumentations: [instrumentation],
    });
    console.log("OpenAI instrumentation registered successfully");

    isInstrumentationInitialized = true;
  } catch (error) {
    // Log the error but don't throw to prevent breaking the extension
    console.error(
      "Failed to initialize Continue OpenTelemetry instrumentation:",
      error,
    );
    console.error("Continue will function normally without instrumentation");
  }
}

// Initialize instrumentation when module is loaded
initializeInstrumentation();

// Log initialization status
console.log("=== Continue Instrumentation Status ===");
console.log(`Initialized: ${isInstrumentationInitialized}`);
console.log(`Collector endpoint: ${COLLECTOR_ENDPOINT}`);
console.log(`Project name: ${PROJECT_NAME}`);

// Get tracer - this should work regardless of which provider is active
const tracer = opentelemetry.trace.getTracer(
  "continue-instrumentation",
  "1.0.0",
);

// Test creating a tracer to make sure it works
try {
  const testTracer = trace.getTracer("continue-test", "1.0.0");
  testTracer.startActiveSpan("initialization-test", (span) => {
    span.setAttributes({ "test.initialization": true });
    span.setStatus({ code: 1 }); // OK
    span.end();
    console.log("✅ Continue instrumentation test span created successfully");
  });
} catch (error) {
  console.error("❌ Failed to create test span:", error);
}

console.log("=== End Instrumentation Status ===");

export function chat(message: string) {
  return tracer.startActiveSpan("chat", (span: Span) => {
    try {
      span.setAttributes({
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.CHAIN,
        [SemanticConventions.INPUT_VALUE]: message,
      });
      console.log("Continue instrumentation: chat span created");
      span.setAttributes({
        [SemanticConventions.OUTPUT_VALUE]: "test instrumentation",
      });
      span.end();
      return "test instrumentation";
    } catch (error) {
      console.error("Error in chat instrumentation:", error);
      span.recordException(error as Error);
      span.end();
      return "test instrumentation";
    }
  });
}

// Test the instrumentation
chat("Hello, this is a test message from Continue instrumentation");

// Utility function to check if instrumentation is working
export function checkInstrumentationStatus() {
  const status = {
    initialized: isInstrumentationInitialized,
    tracerAvailable: !!tracer,
    providerRegistered: !!provider,
    hasActiveProvider: false,
    activeProviderType: "unknown",
  };

  try {
    const activeProvider = trace.getTracerProvider();
    status.hasActiveProvider = !!activeProvider;
    status.activeProviderType = activeProvider?.constructor?.name || "unknown";
  } catch (error) {
    console.warn("Could not check active tracer provider:", error);
  }

  return status;
}

// Export for debugging purposes
export function getInstrumentationInfo() {
  return {
    status: checkInstrumentationStatus(),
    collectorEndpoint: COLLECTOR_ENDPOINT,
    projectName: PROJECT_NAME,
  };
}

// Test function to verify spans are being created
export function testInstrumentation() {
  console.log("Testing Continue instrumentation...");

  try {
    const result = chat("Test message for instrumentation verification");
    console.log("Instrumentation test completed:", result);

    // Test tool instrumentation as well
    const toolTracer = trace.getTracer("continue-tools", "1.0.0");
    toolTracer.startActiveSpan("test-span", (span) => {
      span.setAttributes({ "test.attribute": "test-value" });
      span.setStatus({ code: 1 }); // OK
      span.end();
      console.log("Tool tracer test span created successfully");
    });

    console.log("Instrumentation status:", checkInstrumentationStatus());
    return true;
  } catch (error) {
    console.error("Instrumentation test failed:", error);
    return false;
  }
}

export { provider };
