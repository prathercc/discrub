import { createStreamingDownload } from 'drip-fs';
import type { StreamDownloadWriter } from 'drip-fs';
import { Writer } from '@transcend-io/conflux';

/**
 * StreamingZipService - Clean abstraction over @transcend-io/conflux Writer
 * Handles streaming ZIP file creation with automatic stream management
 * Uses drip-fs for memory-efficient browser downloads
 */
export class StreamingZipService {
  private writer: WritableStreamDefaultWriter;
  private readable: ReadableStream;
  private downloadWriter: StreamDownloadWriter | null = null;
  private pipePromise: Promise<void> | null = null;

  constructor(private zipName: string) {
    const { readable, writable } = new Writer();
    this.readable = readable;
    this.writer = writable.getWriter();
  }

  /**
   * Add a file to the ZIP archive
   */
  async addFile(blob: Blob, filePath: string, lastModified?: Date): Promise<void> {
    // Lazy init download stream on first write
    if (!this.downloadWriter) {
      this.downloadWriter = await createStreamingDownload(`${this.zipName}.zip`);

      // Pipe the ZIP readable stream to the download writer
      this.pipePromise = this.pipeReadableToWriter(this.readable, this.downloadWriter);
    }

    await this.writer.ready;
    await this.writer.write({
      name: filePath,
      lastModified: lastModified || new Date(),
      stream: () => new Response(blob).body,
    });
  }

  /**
   * Finalize the ZIP file and complete the download
   */
  async finalize(): Promise<void> {
    await this.writer.ready;
    await this.writer.close();

    // Wait for all data to be piped to the download
    if (this.pipePromise) {
      await this.pipePromise;
    }
  }

  /**
   * Cancel the ZIP creation and cleanup resources
   */
  async cancel(): Promise<void> {
    try {
      await this.writer.ready;
      await this.writer.close();
    } catch {
      // Already closed or errored
    }

    if (this.downloadWriter) {
      await this.downloadWriter.abort();
      this.downloadWriter = null;
    }

    this.pipePromise = null;
  }

  /**
   * Pipe a ReadableStream to a StreamDownloadWriter chunk by chunk
   */
  private async pipeReadableToWriter(
    readable: ReadableStream,
    downloadWriter: StreamDownloadWriter
  ): Promise<void> {
    const reader = readable.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await downloadWriter.write(value);
      }
      await downloadWriter.close();
    } catch (err) {
      await downloadWriter.abort();
      throw err;
    } finally {
      reader.releaseLock();
    }
  }
}
