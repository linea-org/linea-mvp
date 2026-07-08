import type { EmbeddingBucket } from '@linea/ai';

/** Maps a KB's locked dimension bucket to its raw SQL column name. */
export function embeddingColumnNameFor(bucket: EmbeddingBucket): string {
  return {
    768: 'embedding_768',
    1536: 'embedding_1536',
  }[bucket];
}
