import {
    OpenInferenceSpanKind,
    SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { ChatMessage } from "core";

// Get a tracer for the VS Code extension
export const tracer = trace.getTracer("continue-vscode-extension", "1.0.0");

// Helper function to trace chat messages
export function traceChatMessage(
  operation: string,
  messages: ChatMessage[],
  callback: () => Promise<any>
) {
  return tracer.startActiveSpan(
    operation,
    {
      attributes: {
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.CHAIN,
        "continue.operation": operation,
        "continue.message_count": messages.length,
      },
    },
    async (span: Span) => {
      try {
        // Add input messages to span
        const userMessages = messages.filter(msg => msg.role === "user");
        if (userMessages.length > 0) {
          const lastUserMessage = userMessages[userMessages.length - 1];
          span.setAttribute(
            SemanticConventions.INPUT_VALUE,
            typeof lastUserMessage.content === "string" 
              ? lastUserMessage.content 
              : JSON.stringify(lastUserMessage.content)
          );
        }

        // Execute the callback
        const result = await callback();

        // Add output to span if available
        if (result && typeof result === "object") {
          span.setAttribute(
            SemanticConventions.OUTPUT_VALUE,
            JSON.stringify(result)
          );
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: (error as Error).message 
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

// Helper function to trace individual message processing
export function traceMessageProcessing(
  message: ChatMessage,
  callback: () => Promise<any>
) {
  return tracer.startActiveSpan(
    "process_message",
    {
      attributes: {
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.CHAIN,
        "continue.message_role": message.role,
        "continue.message_type": typeof message.content,
      },
    },
    async (span: Span) => {
      try {
        // Add message content to span
        if (message.role === "user") {
          span.setAttribute(
            SemanticConventions.INPUT_VALUE,
            typeof message.content === "string" 
              ? message.content 
              : JSON.stringify(message.content)
          );
        }

        const result = await callback();

        // Add output for assistant messages
        if (message.role === "assistant" && result) {
          span.setAttribute(
            SemanticConventions.OUTPUT_VALUE,
            typeof result === "string" ? result : JSON.stringify(result)
          );
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: (error as Error).message 
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
} 