/**
 * BullMQ Job Finder Utilities - Simplified
 */

interface JobInfo {
  id: string;
  isCompleted: boolean;
  status?: string;
}

async function getAllQueues() {
  const {
    ingestQueue,
    preprocessQueue,
    conversationTitleQueue,
    graphResolutionQueue,
  } = await import("../queues");

  return [
    ingestQueue,
    preprocessQueue,
    conversationTitleQueue,
    graphResolutionQueue,
  ];
}

export async function getJobsByTags(
  tags: string[],
  taskIdentifier?: string,
): Promise<JobInfo[]> {
  const queues = await getAllQueues();
  const matchingJobs: JobInfo[] = [];

  for (const queue of queues) {
    if (taskIdentifier && !queue.name.includes(taskIdentifier)) {
      continue;
    }

    const [active, waiting, delayed] = await Promise.all([
      queue.getActive(),
      queue.getWaiting(),
      queue.getDelayed(),
    ]);

    const allJobs = [...active, ...waiting, ...delayed];

    for (const job of allJobs) {
      const jobData = job.data as Record<string, unknown>;
      const matchesTags = tags.every(
        (tag) =>
          job.id?.includes(tag) ||
          jobData.userId === tag ||
          jobData.workspaceId === tag ||
          jobData.queueId === tag,
      );

      if (matchesTags) {
        const state = await job.getState();
        matchingJobs.push({
          id: job.id!,
          isCompleted: state === "completed" || state === "failed",
          status: state,
        });
      }
    }
  }

  return matchingJobs;
}

export async function getJobById(jobId: string): Promise<JobInfo | null> {
  const queues = await getAllQueues();

  for (const queue of queues) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        return {
          id: job.id!,
          isCompleted: state === "completed" || state === "failed",
          status: state,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function cancelJobById(jobId: string): Promise<void> {
  const queues = await getAllQueues();

  for (const queue of queues) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state !== "completed" && state !== "failed") {
          await job.remove();
        }
        return;
      }
    } catch {
      continue;
    }
  }
}
