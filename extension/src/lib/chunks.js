/**
 * Extension messages are serialized, and one very large message is slow and
 * can hit Chrome's per-message limit. A screenshot is sent as base64 pieces of
 * at most this many characters and put back together by the bridge.
 */
export const CHUNK_SIZE = 8 * 1024 * 1024;

export function splitIntoChunks(text, size = CHUNK_SIZE) {
  if (text.length === 0) return [''];
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
