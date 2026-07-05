export const QUEUES = {
  EXECUTION: "execution",
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  removeOnComplete: 1000,
  removeOnFail: 5000,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
}

export const DEFAULT_WORKER_OPTIONS = {
  concurrency: 10,
}
