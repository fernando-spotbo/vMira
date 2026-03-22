export interface SearchResult {
  title: string;
  domain: string;
  url?: string;
}

export interface SearchQuery {
  query: string;
  resultCount: number;
  results: SearchResult[];
}

export interface ReasoningBlock {
  type: "reasoning";
  summary: string;
  thinking?: string;
  searches?: SearchQuery[];
}

export interface TextBlock {
  type: "text";
  content: string;
}

export type MessageStep = ReasoningBlock | TextBlock;

export interface Attachment {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width?: number;
  height?: number;
  url: string;
  /** Client-side only: local preview URL before upload completes */
  previewUrl?: string;
  /** Client-side only: upload progress 0-100 */
  progress?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  versions?: string[];
  versionIndex?: number;
  steps?: MessageStep[];
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  starred?: boolean;
}
