export type Placement =
  | 'article'
  | 'comment'
  | 'navigation'
  | 'sidebar'
  | 'footer'
  | 'unknown';

export type MatchReason = 'url' | 'redirect-url' | 'plain-text';

export interface RelFlags {
  nofollow: boolean;
  ugc: boolean;
  sponsored: boolean;
  noopener: boolean;
  noreferrer: boolean;
}

export interface ScanResult {
  id: string;
  frameId: number;
  type: 'link' | 'text';
  matchReason: MatchReason;
  destinationUrl?: string;
  redirectTargetUrl?: string;
  rawHref?: string;
  anchorText?: string;
  imageAlt?: string;
  rel: RelFlags;
  placement: Placement;
  visible: boolean;
  external: boolean;
  targetBlank: boolean;
  contextText: string;
  selector: string;
  redirected: boolean;
}

export interface ScanOptions {
  target: string;
  includeSubdomains: boolean;
  exactUrl: boolean;
}

export interface PageMetadata {
  title: string;
  url: string;
  canonicalUrl?: string;
  noindex: boolean;
  pageNofollow: boolean;
}

export interface ScanPayload {
  results: ScanResult[];
  metadata: PageMetadata;
  scannedAt: string;
  dynamic?: boolean;
}

export interface TargetDomain {
  id: string;
  domain: string;
  createdAt: string;
}

export interface SavedRecord extends ScanResult {
  recordId: string;
  pageTitle: string;
  pageUrl: string;
  domainId?: string;
  savedAt: string;
}

export type ResultFilter =
  | 'all'
  | 'link'
  | 'follow'
  | 'nofollow'
  | 'ugc'
  | 'sponsored'
  | 'text'
  | 'hidden'
  | 'redirect';
