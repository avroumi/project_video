import { useEffect, useState, type FormEvent } from "react";

import {
  createVideoJob,
  getVideoJob,
  getVideoShorts,
} from "./services/video-api";
import type { GeneratedShort } from "./types/generated-short";
import type { ProcessingJob } from "./types/processing-job";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [shorts, setShorts] = useState<GeneratedShort[]>([]);
  const [isLoadingShorts, setIsLoadingShorts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!job) {
      return;
    }

    if (job.status === "shorts_ready" || job.status === "failed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const updatedJob = await getVideoJob(job.id);

        setJob(updatedJob);
      } catch (error) {
        console.error("Unable to refresh job:", error);
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [job?.id, job?.status]);
  useEffect(() => {
    if (!job || job.status !== "shorts_ready") {
      return;
    }

    const loadShorts = async () => {
      try {
        setIsLoadingShorts(true);

        const generatedShorts = await getVideoShorts(job.id);

        setShorts(generatedShorts);
      } catch (error) {
        console.error("Unable to load shorts:", error);

        setError("Unable to load generated shorts.");
      } finally {
        setIsLoadingShorts(false);
      }
    };

    void loadShorts();
  }, [job?.id, job?.status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanUrl = youtubeUrl.trim();

    if (!cleanUrl) {
      setError("Enter a YouTube URL.");

      return;
    }

    try {
      setIsLoading(true);

      setError(null);

      setJob(null);
      setShorts([]);

      const createdJob = await createVideoJob(cleanUrl);

      setJob(createdJob);
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Unable to start video processing.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main>
      <h1>Shorts Maker</h1>

      <p>Turn a YouTube video into short-form clips.</p>

      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Starting..." : "Generate Shorts"}
        </button>
      </form>

      {error && <p>{error}</p>}

      {job && (
        <section>
          <h2>Processing started</h2>

          <p>Job ID: {job.id}</p>

          <p>Status: {job.status}</p>
          {job.status === "shorts_ready" && <p>Shorts are ready!</p>}

          {job.status === "failed" && (
            <p>Processing failed: {job.error ?? "Unknown error"}</p>
          )}
          {isLoadingShorts && <p>Loading generated shorts...</p>}

          {shorts.length > 0 && (
            <section>
              <h2>Generated Shorts</h2>

              {shorts.map((short) => (
                <article key={short.id}>
                  <h3>{short.title}</h3>

                  <video src={short.videoUrl} controls width="300" />

                  <p>{short.hook}</p>

                  <p>Score: {short.score}/10</p>

                  <p>Duration: {short.durationSeconds.toFixed(1)}s</p>

                  <p>{short.reason}</p>
                </article>
              ))}
            </section>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
