import Redis from "ioredis"

export interface RedisConnectionOptions {
  url: string
}

export function createConnection(options: RedisConnectionOptions): Redis {
  return new Redis(options.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}
