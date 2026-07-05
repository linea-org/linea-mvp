import { Processor, Worker, WorkerOptions } from "bullmq"
import Redis from "ioredis"

import { DEFAULT_WORKER_OPTIONS } from "./constants.js"

export interface CreateWorkerOptions {
  connection: Redis

  concurrency?: number

  settings?: WorkerOptions["settings"]
}

export function createWorker<T extends object>(
  name: string,
  processor: Processor<T>,
  options: CreateWorkerOptions
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection: options.connection,
    concurrency: options.concurrency ?? DEFAULT_WORKER_OPTIONS.concurrency,
    settings: options.settings,
  })
}
