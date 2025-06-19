import {
    OpenInferenceSpanKind,
    SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { ChatMessage, PromptLog } from "../index.js";

// Get a tracer for the core
export const tracer = trace.getTracer("continue-core", "1.0.0");

// Helper function to trace LLM chat operations
export function traceLLMChat(
  modelName: string,
  messages: ChatMessage[],
  callback: () => Promise<any>
) {
  return tracer.startActiveSpan(
    "llm_chat",
    {
      attributes: {
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
        "continue.model": modelName,
        "continue.message_count": messages.length,
        "continue.operation": "chat",
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

        // Add system message if present
        const systemMessage = messages.find(msg => msg.role === "system");
        if (systemMessage) {
          span.setAttribute(
            "continue.system_message",
            typeof systemMessage.content === "string" 
              ? systemMessage.content 
              : JSON.stringify(systemMessage.content)
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

// Helper function to trace message streaming
export async function* traceMessageStream(
  modelName: string,
  messages: ChatMessage[],
  callback: () => AsyncGenerator<ChatMessage, PromptLog>
): AsyncGenerator<ChatMessage, PromptLog> {
  const span = tracer.startSpan("llm_stream_chat", {
    attributes: {
      [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
      "continue.model": modelName,
      "continue.message_count": messages.length,
      "continue.operation": "stream_chat",
    },
  });

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

    // Execute the callback and collect output
    const generator = callback();
    const collectedMessages: ChatMessage[] = [];
    
    let next = await generator.next();
    while (!next.done) {
      const message = next.value;
      collectedMessages.push(message);
      yield message;
      next = await generator.next();
    }

    // Add final output to span
    if (collectedMessages.length > 0) {
      const lastMessage = collectedMessages[collectedMessages.length - 1];
      span.setAttribute(
        SemanticConventions.OUTPUT_VALUE,
        typeof lastMessage.content === "string" 
          ? lastMessage.content 
          : JSON.stringify(lastMessage.content)
      );
    }

    span.setStatus({ code: SpanStatusCode.OK });
    
    // Return the final value from the generator
    return next.value;
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