import { useEffect, useState, type FormEvent } from "react";

import { createVideoJob, getVideoJob } from "./services/video-api";

import type { ProcessingJob } from "./types/processing-job";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const [job, setJob] = useState<ProcessingJob | null>(null);

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
        </section>
      )}
    </main>
  );
}

export default App;
