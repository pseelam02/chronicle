export interface SymbolNode {
  id: string;
  name: string;
  qualified: string;
  path: string;
  kind: string;
  line: number;
  end: number;
  signature: string;
  fingerprint: string;
  complexity: number;
  exported: boolean;
  confidence: number;
  evidence: string;
}
export interface Edge {
  source: string;
  target: string;
  kind: string;
  confidence: number;
  evidence: string;
}
export interface FileNode {
  path: string;
  hash: string;
  imports: { name: string; specifier: string }[];
  symbols: SymbolNode[];
}
export interface Commit {
  sha: string;
  parents: string[];
  author: string;
  timestamp: string;
  subject: string;
  body: string;
}
export interface Checkpoint {
  ref: string;
  label: string;
  commit: Commit;
  files: FileNode[];
  edges: Edge[];
}
export interface Analysis {
  version: number;
  name: string;
  head: string;
  ref: string;
  commits: Commit[];
  refs: { name: string; sha: string }[];
  checkpoints: Checkpoint[];
  analyzedAt: string;
  warnings: string[];
  demo?: boolean;
}
export interface Progress {
  stage: string;
  completed: number;
  total: number;
  detail: string;
}
export interface Options {
  path: string;
  ref: string;
  port: number;
  open: boolean;
  force: boolean;
  ai: boolean;
  model: string;
  demo: boolean;
  checkpoints: number;
}
export const VERSION = "0.1.0";
