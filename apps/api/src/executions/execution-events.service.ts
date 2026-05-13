import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface ExecutionEvent {
  type: string;
  [key: string]: any;
}

@Injectable()
export class ExecutionEventsService {
  private readonly bus = new Subject<{
    executionId: string;
    event: ExecutionEvent;
  }>();

  emit(executionId: string, event: ExecutionEvent): void {
    this.bus.next({ executionId, event });
  }

  forExecution(executionId: string): Observable<ExecutionEvent> {
    return new Observable((subscriber) => {
      const sub = this.bus
        .pipe(filter((m) => m.executionId === executionId))
        .subscribe({
          next: ({ event }) => subscriber.next(event),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      return () => sub.unsubscribe();
    });
  }
}
