import { vi } from 'vitest';

/**
 * Mock fetch with preconnect property for Bun compatibility.
 * Returns a fresh Response each time to allow multiple reads.
 */
export function createMockFetch(response: Response | (() => Response)): typeof fetch {
  const mockFn = vi.fn().mockImplementation(
    typeof response === 'function' ? response : () => response.clone()
  );
  
  return Object.assign(mockFn, {
    preconnect: vi.fn(),
  }) as unknown as typeof fetch;
}

/**
 * Mock successful JSON response - creates fresh response each call
 */
export function mockFetchSuccess(data: unknown, status = 200): typeof fetch {
  return createMockFetch(() => 
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

/**
 * Mock error response - creates fresh response each call
 */
export function mockFetchError(status: number, message: string): typeof fetch {
  return createMockFetch(() =>
    new Response(JSON.stringify({ error: message }), { status })
  );
}

/**
 * Mock streaming response for SSE/chat - creates fresh response each call
 */
export function mockFetchStream(chunks: string[]): typeof fetch {
  return createMockFetch(() => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  });
}