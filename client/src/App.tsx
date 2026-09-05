import "./App.css";

import { useEffect, useState, type FormEvent } from "react";

import { ShortCard } from "./components/ShortCard";

import {
  createVideoJob,
  generateShortMetadata,
  getVideoJob,
  getVideoShorts,
} from "./services/video-api";

import type { GeneratedShort } from "./types/generated-short";
import type { ProcessingJob } from "./types/processing-job";
import type { YouTubeMetadata } from "./types/youtube-metadata";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const [job, setJob] = useState<ProcessingJob | null>(null);

  const [shorts, setShorts] = useState<GeneratedShort[]>([]);

  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [isLoadingShorts, setIsLoadingShorts] = useState(false);

  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);

  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const selectedShort =
    shorts.find((short) => short.id === selectedShortId) ?? null;

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
      setSelectedShortId(null);
      setMetadata(null);

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

  const handleGenerateMetadata = async () => {
    if (!job || !selectedShort) {
      return;
    }

    try {
      setIsGeneratingMetadata(true);
      setError(null);

      const result = await generateShortMetadata(job.id, selectedShort.id);

      setMetadata(result.metadata);
    } catch (error) {
      console.error("Unable to generate metadata:", error);

      setError("Unable to generate YouTube metadata.");
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  return (
    <main className="app">
      <div className="hero">
        <h1>Shorts Maker</h1>

        <p>Turn a YouTube video into short-form clips.</p>
      </div>

      <form className="generate-form" onSubmit={handleSubmit}>
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

      {error && <p className="error-message">{error}</p>}

      {job && (
        <section className="status-card">
          <h2>Processing</h2>

          <p>Job ID: {job.id}</p>

          <p>
            Status: <span className="status-value">{job.status}</span>
          </p>

          {job.status === "shorts_ready" && <p>Shorts are ready!</p>}

          {job.status === "failed" && (
            <p>Processing failed: {job.error ?? "Unknown error"}</p>
          )}
        </section>
      )}

      {isLoadingShorts && <p>Loading generated shorts...</p>}

      {shorts.length > 0 && (
        <section className="shorts-section">
          <h2 className="section-title">Generated Shorts</h2>

          <div className="shorts-grid">
            {shorts.map((short) => (
              <ShortCard
                key={short.id}
                short={short}
                isSelected={short.id === selectedShortId}
                onSelect={setSelectedShortId}
              />
            ))}
          </div>
        </section>
      )}

      {selectedShort && (
        <section className="selected-short">
          <h2>Selected Short</h2>

          <h3>{selectedShort.title}</h3>

          <p>ID: {selectedShort.id}</p>

          <p>Score: {selectedShort.score}/10</p>

          <button
            type="button"
            onClick={handleGenerateMetadata}
            disabled={isGeneratingMetadata}
          >
            {isGeneratingMetadata
              ? "Generating metadata..."
              : metadata
                ? "Regenerate Metadata"
                : "Continue with this Short"}
          </button>
        </section>
      )}

      {metadata && (
        <section className="metadata-section">
          <h2>YouTube Metadata</h2>

          <div className="metadata-form">
            <label>
              Title
              <input
                type="text"
                value={metadata.title}
                onChange={(event) =>
                  setMetadata({
                    ...metadata,
                    title: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Description
              <textarea
                value={metadata.description}
                onChange={(event) =>
                  setMetadata({
                    ...metadata,
                    description: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Hashtags
              <input
                type="text"
                value={metadata.hashtags.join(" ")}
                onChange={(event) =>
                  setMetadata({
                    ...metadata,
                    hashtags: event.target.value.split(" ").filter(Boolean),
                  })
                }
              />
            </label>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
