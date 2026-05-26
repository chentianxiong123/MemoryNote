export interface InboundAttachment {
  id: string;
  filename: string;
  contentType: string;
  content?: string;
  url?: string;
  name?: string;
  mimeType?: string;
  data?: string;
}

export interface OutboundAttachment {
  filename: string;
  contentType: string;
  content: string;
}
