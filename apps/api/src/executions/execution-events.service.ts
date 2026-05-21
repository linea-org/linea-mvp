import { Injectable, Inject, Optional } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import type Redis from 'ioredis';

export const EXEC_EVENTS_REDIS = 'EXEC_EVENTS_REDIS';

const STREAM_TTL_S = 7_200; // 2 hours — enough for reconnects, not permanent
const STREAM_MAX_LEN = 1_000;

export interface ExecutionEvent {
  type: string;
  [key: string]: any;
}

export interface BusEntry {
  executionId: string;
  event: ExecutionEvent;
  streamId: string; // Redis Stream ID, used as the SSE event id field
}

@Injectable()
export class ExecutionEventsService {
  private readonly bus = new Subject<BusEntry>();

  constructor(
    @Optional() @Inject(EXEC_EVENTS_REDIS) private readonly redis?: Redis,
  ) {}

  emit(executionId: string, event: ExecutionEvent): void {
    const streamKey = `exec_events:${executionId}`;

    if (this.redis) {
      // Write to Redis Stream then push to in-memory bus with the returned ID.
      // Fire-and-forget: callers don't await emit() so errors are handled internally.
      this.redis
        .xadd(streamKey, 'MAXLEN', '~', String(STREAM_MAX_LEN), '*', 'json', JSON.stringify(event))
        .then((streamId) => {
          void this.redis!.expire(streamKey, STREAM_TTL_S);
          this.bus.next({ executionId, event, streamId: streamId ?? `${Date.now()}-0` });
        })
        .catch(() => {
          // Redis unavailable: synthetic ID keeps the in-memory bus working
          this.bus.next({ executionId, event, streamId: `${Date.now()}-0` });
        });
    } else {
      this.bus.next({ executionId, event, streamId: `${Date.now()}-0` });
    }
  }

  forExecution(executionId: string): Observable<BusEntry> {
    return new Observable((subscriber) => {
      const sub = this.bus
        .pipe(filter((m) => m.executionId === executionId))
        .subscribe({
          next: (entry) => subscriber.next(entry),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      return () => sub.unsubscribe();
    });
  }

  /**
   * Fetch all buffered events for an execution after `lastEventId`.
   * Used by the SSE endpoint to replay missed events on client reconnect.
   * Pass `'0'` to replay from the very beginning of the stream.
   */
  async replayFrom(executionId: string, lastEventId: string): Promise<BusEntry[]> {
    if (!this.redis) return [];
    const streamKey = `exec_events:${executionId}`;
    try {
      // '-' = oldest; '(id' = exclusive-after id (Redis 6.2+)
      const start =
        lastEventId === '0' || lastEventId === '0-0' ? '-' : `(${lastEventId}`;
      const entries = await this.redis.xrange(streamKey, start, '+');
      return entries.map(([streamId, fields]) => {
        const jsonIdx = fields.indexOf('json');
        const raw = jsonIdx >= 0 ? (fields[jsonIdx + 1] ?? '{}') : '{}';
        let event: ExecutionEvent;
        try {
          event = JSON.parse(raw) as ExecutionEvent;
        } catch {
          event = { type: 'unknown' };
        }
        return { executionId, event, streamId };
      });
    } catch {
      return [];
    }
  }
}
