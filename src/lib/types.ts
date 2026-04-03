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

export type SearchPhase = "searching" | "results" | "answering" | "done";

export interface ReasoningBlock {
  type: "reasoning";
  summary: string;
  thinking?: string;
  searches?: SearchQuery[];
  searchPhase?: SearchPhase;
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

export interface MessageError {
  type: "rate_limit" | "payment" | "cancelled" | "generic";
  message: string;
  retryAfterMinutes?: number;
}

export interface ReminderInfo {
  id: string;
  title: string;
  body?: string | null;
  remind_at: string;
  rrule?: string | null;
  channels?: string[];
}

export interface ScheduledContentInfo {
  id: string;
  title: string;
  prompt: string;
  schedule_at: string;
  rrule: string;
}

export interface ActionInfo {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
  status?: "proposed" | "executing" | "executed" | "cancelled" | "failed";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  versions?: string[];
  versionIndex?: number;
  steps?: MessageStep[];
  attachments?: Attachment[];
  error?: MessageError;
  reminder?: ReminderInfo;
  scheduledContent?: ScheduledContentInfo;
  action?: ActionInfo;
  suggestions?: string[];
}

export interface Project {
  id: string;
  name: string;
  emoji?: string | null;
  instructions?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  starred?: boolean;
  projectId?: string | null;
  totalMessages?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export interface RemoteSession {
  id: string;
  environmentId: string;
  machineName: string;
  directory: string;
  branch?: string | null;
  gitRepoUrl?: string | null;
  status: "connected" | "reconnecting" | "offline";
  createdAt: string;
  updatedAt: string;
  messages: RemoteMessage[];
  totalMessages?: number;
  hasMore?: boolean;
}

export interface RemoteMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  steps?: MessageStep[];
  createdAt: string;
}
