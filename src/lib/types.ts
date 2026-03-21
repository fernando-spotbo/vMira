export interface SearchResult {
  title: string;
  domain: string;
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

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  versions?: string[];
  versionIndex?: number;
  steps?: MessageStep[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  starred?: boolean;
}
