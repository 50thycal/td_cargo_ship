// The Region Workshop's attack preview, off the main thread (see
// workshopPreviewSim.ts). One request in, one recording out; a newer request
// simply supersedes an older one on the editor side.

import { runPreview, type PreviewRequest, type PreviewResult } from './workshopPreviewSim';

export type PreviewReply =
  | { type: 'done'; id: number; result: PreviewResult }
  | { type: 'error'; id: number; message: string };

self.onmessage = (ev: MessageEvent<{ id: number; req: PreviewRequest }>) => {
  const { id, req } = ev.data;
  try {
    const reply: PreviewReply = { type: 'done', id, result: runPreview(req) };
    self.postMessage(reply);
  } catch (err) {
    const reply: PreviewReply = { type: 'error', id, message: err instanceof Error ? err.message : String(err) };
    self.postMessage(reply);
  }
};
