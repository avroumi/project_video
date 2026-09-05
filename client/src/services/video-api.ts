import type { ProcessingJob } from "../types/processing-job";
import type { GeneratedShort } from "../types/generated-short";
const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

interface CreateVideoResponse {
  job: ProcessingJob;
}

interface ApiErrorResponse {
  error?: string;
}
interface GetShortsResponse {
  shorts: GeneratedShort[];
}
export async function createVideoJob(
  url: string,
): Promise<ProcessingJob> {
  const response = await fetch(
    `${API_URL}/api/videos`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        url,
      }),
    },
  );

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}`;

    try {
      const body =
        (await response.json()) as ApiErrorResponse;

      if (body.error) {
        message = body.error;
      }
    } catch {
      // La réponse n'était pas du JSON.
    }

    throw new Error(message);
  }

  const data =
    (await response.json()) as CreateVideoResponse;

  return data.job;
}
export async function getVideoJob(
  jobId: string,
): Promise<ProcessingJob> {
  const response = await fetch(
    `${API_URL}/api/videos/${jobId}`,
  );

  if (!response.ok) {
    throw new Error(
      `Unable to retrieve job. Status: ${response.status}`,
    );
  }

  const data =
    (await response.json()) as CreateVideoResponse;

  return data.job;
}
export async function getVideoShorts(
  jobId: string,
): Promise<GeneratedShort[]> {
  const response = await fetch(
    `${API_URL}/api/videos/${jobId}/shorts`,
  );

  if (!response.ok) {
    throw new Error(
      `Unable to retrieve shorts. Status: ${response.status}`,
    );
  }

  const data =
    (await response.json()) as GetShortsResponse;

  return data.shorts.map(
    (short) => ({
      ...short,

      videoUrl:
        `${API_URL}${short.videoUrl}`,
    }),
  );
}