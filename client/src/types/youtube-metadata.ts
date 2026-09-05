export interface YouTubeMetadata {
  title: string;
  description: string;
  hashtags: string[];
}

export interface YouTubeMetadataResult {
  shortId: string;
  metadata: YouTubeMetadata;
}