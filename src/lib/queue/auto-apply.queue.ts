import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export interface AutoApplyJobData {
  userId: string;
  jobId: string;
  resumeId?: string;
  generateCoverLetter: boolean;
}

const QUEUE_NAME = "auto-apply";

let queue: Queue | null = null;

export function getAutoApplyQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          count: 1000,
          age: 7 * 24 * 60 * 60, // 7 days
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return queue;
}

export async function addAutoApplyJob(
  data: AutoApplyJobData,
  delay?: number
): Promise<string> {
  const q = getAutoApplyQueue();
  const job = await q.add("apply", data, {
    delay: delay || 0,
    jobId: `${data.userId}-${data.jobId}`,
  });
  return job.id || "";
}

export async function getQueueStats(userId?: string) {
  const q = getAutoApplyQueue();

  const [waiting, active, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
  ]);

  let userWaiting = 0;
  let userActive = 0;

  if (userId) {
    const waitingJobs = await q.getWaiting();
    const activeJobs = await q.getActive();
    userWaiting = waitingJobs.filter((j) => j.data.userId === userId).length;
    userActive = activeJobs.filter((j) => j.data.userId === userId).length;
  }

  return {
    total: { waiting, active, completed, failed },
    user: userId ? { waiting: userWaiting, active: userActive } : null,
  };
}
