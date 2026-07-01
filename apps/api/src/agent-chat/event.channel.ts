export interface EventChannel<T> {
  emit(event: T): void;
  done(): void;
  read(): AsyncGenerator<T>;
}

/**
 * Build async event channel — nodes push events, generator yields them
 */
export function createEventChannel<T>(): EventChannel<T> {
  const DONE = Symbol('done');
  const queue: Array<T | typeof DONE> = [];
  let resolver: (() => void) | null = null;

  const push = (item: T | typeof DONE) => {
    queue.push(item);
    resolver?.();
    resolver = null;
  };

  async function* read(): AsyncGenerator<T> {
    while (true) {
      while (queue.length) {
        const item = queue.shift()!;

        if (item === DONE) {
          return;
        }

        yield item;
      }

      await new Promise<void>((resolve) => {
        resolver = resolve;
      });
    }
  }

  return {
    emit(event: T) {
      push(event);
    },
    done() {
      push(DONE);
    },
    read,
  };
}
