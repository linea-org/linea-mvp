import { JobsOptions, Queue } from "bullmq"
import { Redis } from "ioredis"

import { DEFAULT_JOB_OPTIONS } from "./constants.js"

export interface CreateQueueOptions {
  connection: Redis
  defaultJobOptions?: JobsOptions
}

export function createQueue<T extends object>(
  name: string,
  options: CreateQueueOptions
): Queue<T> {
  return new Queue<T>(name, {
    connection: options.connection,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      ...options.defaultJobOptions,
    },
  })
}
