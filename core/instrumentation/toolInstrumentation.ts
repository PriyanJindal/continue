import {
  TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
  TOOL_CALL_FUNCTION_NAME,
} from "@arizeai/openinference-semantic-conventions";
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("continue-tools", "1.0.0");

export function instrumentToolCall<T>(
  toolName: string,
  args: any,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    `tool.${toolName}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [TOOL_CALL_FUNCTION_NAME]: toolName,
        [TOOL_CALL_FUNCTION_ARGUMENTS_JSON]: JSON.stringify(args),
        "tool.type": "builtin",
      },
    },
    async (span) => {
      try {
        const result = await fn();

        // Log the result (using a generic attribute since there's no standard for tool results)
        span.setAttributes({
          "tool.result": JSON.stringify(result),
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function instrumentMCPToolCall<T>(
  mcpId: string,
  toolName: string,
  args: any,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    `mcp.${mcpId}.${toolName}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [TOOL_CALL_FUNCTION_NAME]: toolName,
        [TOOL_CALL_FUNCTION_ARGUMENTS_JSON]: JSON.stringify(args),
        "tool.type": "mcp",
        "tool.mcp_id": mcpId,
      },
    },
    async (span) => {
      try {
        const result = await fn();

        span.setAttributes({
          "tool.result": JSON.stringify(result),
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
