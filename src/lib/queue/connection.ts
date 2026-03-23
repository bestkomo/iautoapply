import { Redis } from "ioredis";

const getRedisConnection = () => {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
};

export { getRedisConnection };
