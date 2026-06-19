import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamingZipService } from './streamingZipService';

// Mock dependencies
vi.mock('drip-fs', () => ({
  createStreamingDownload: vi.fn(),
}));

vi.mock('@transcend-io/conflux', () => ({
  Writer: vi.fn(),
}));

describe('streamingZipService', () => {
  let mockWriter: any;
  let mockReadable: any;
  let mockWritable: any;
  let mockDownloadWriter: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock conflux Writer instance
    mockWriter = {
      ready: Promise.resolve(),
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockReadable = {
      getReader: vi.fn().mockReturnValue({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      }),
    };

    mockWritable = {
      getWriter: vi.fn().mockReturnValue(mockWriter),
    };

    // Mock Writer constructor
    const { Writer } = await import('@transcend-io/conflux');
    vi.mocked(Writer).mockImplementation(() => ({
      readable: mockReadable,
      writable: mockWritable,
    }) as any);

    // Mock drip-fs
    mockDownloadWriter = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
      bytesWritten: 0,
    };

    const { createStreamingDownload } = await import('drip-fs');
    vi.mocked(createStreamingDownload).mockResolvedValue(mockDownloadWriter);
  });

  describe('constructor', () => {
    it('should initialize Writer', async () => {
      const { Writer } = await import('@transcend-io/conflux');

      void new StreamingZipService('test-export');

      expect(Writer).toHaveBeenCalled();
    });

    it('should get writer from writable stream', () => {
      void new StreamingZipService('test-export');

      expect(mockWritable.getWriter).toHaveBeenCalled();
    });

    it('should store zip name', () => {
      const service = new StreamingZipService('my-export');

      expect(service).toBeDefined();
    });
  });

  describe('addFile', () => {
    it('should lazy initialize download stream on first write', async () => {
      const { createStreamingDownload } = await import('drip-fs');
      const service = new StreamingZipService('test-export');

      const blob = new Blob(['test data'], { type: 'text/plain' });
      await service.addFile(blob, 'test.txt');

      expect(createStreamingDownload).toHaveBeenCalledWith('test-export.zip');
    });

    it('should not reinitialize download stream on subsequent writes', async () => {
      const { createStreamingDownload } = await import('drip-fs');
      const service = new StreamingZipService('test-export');

      const blob1 = new Blob(['data1'], { type: 'text/plain' });
      const blob2 = new Blob(['data2'], { type: 'text/plain' });

      await service.addFile(blob1, 'file1.txt');
      await service.addFile(blob2, 'file2.txt');

      // Should only be called once
      expect(createStreamingDownload).toHaveBeenCalledTimes(1);
    });

    it('should write file to writer with correct structure', async () => {
      const service = new StreamingZipService('test-export');
      const blob = new Blob(['test data'], { type: 'text/plain' });
      const filePath = 'folder/test.txt';

      await service.addFile(blob, filePath);

      await mockWriter.ready;
      expect(mockWriter.write).toHaveBeenCalledWith({
        name: filePath,
        lastModified: expect.any(Date),
        stream: expect.any(Function),
      });
    });

    it('should use provided lastModified date', async () => {
      const service = new StreamingZipService('test-export');
      const blob = new Blob(['test data'], { type: 'text/plain' });
      const lastModified = new Date('2026-01-01T00:00:00.000Z');

      await service.addFile(blob, 'test.txt', lastModified);

      await mockWriter.ready;
      const writeCall = mockWriter.write.mock.calls[0][0];
      expect(writeCall.lastModified).toBe(lastModified);
    });

    it('should default to current date if lastModified not provided', async () => {
      const service = new StreamingZipService('test-export');
      const blob = new Blob(['test data'], { type: 'text/plain' });
      const beforeCall = new Date();

      await service.addFile(blob, 'test.txt');

      const afterCall = new Date();
      await mockWriter.ready;
      const writeCall = mockWriter.write.mock.calls[0][0];
      const lastModified = writeCall.lastModified;

      expect(lastModified.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(lastModified.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should create stream function that returns blob body', async () => {
      const service = new StreamingZipService('test-export');
      const blobContent = 'test data';
      const blob = new Blob([blobContent], { type: 'text/plain' });

      await service.addFile(blob, 'test.txt');

      await mockWriter.ready;
      const writeCall = mockWriter.write.mock.calls[0][0];
      const streamFn = writeCall.stream;

      expect(streamFn).toBeTypeOf('function');
      const result = streamFn();
      expect(result).toBeDefined();
    });

    it('should wait for writer to be ready', async () => {
      let readyResolved = false;
      mockWriter.ready = new Promise((resolve) => {
        setTimeout(() => {
          readyResolved = true;
          resolve(undefined);
        }, 10);
      });

      const service = new StreamingZipService('test-export');
      const blob = new Blob(['test data'], { type: 'text/plain' });

      await service.addFile(blob, 'test.txt');

      expect(readyResolved).toBe(true);
    });

    it('should handle multiple files with different paths', async () => {
      const service = new StreamingZipService('test-export');

      await service.addFile(new Blob(['data1']), 'folder1/file1.txt');
      await service.addFile(new Blob(['data2']), 'folder2/file2.txt');
      await service.addFile(new Blob(['data3']), 'folder1/subfolder/file3.txt');

      expect(mockWriter.write).toHaveBeenCalledTimes(3);
      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'folder1/file1.txt' })
      );
      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'folder2/file2.txt' })
      );
      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'folder1/subfolder/file3.txt' })
      );
    });

    it('should handle binary blobs', async () => {
      const service = new StreamingZipService('test-export');
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const blob = new Blob([binaryData], { type: 'image/png' });

      await service.addFile(blob, 'image.png');

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'image.png',
        })
      );
    });

    it('should handle empty blobs', async () => {
      const service = new StreamingZipService('test-export');
      const blob = new Blob([], { type: 'text/plain' });

      await service.addFile(blob, 'empty.txt');

      expect(mockWriter.write).toHaveBeenCalled();
    });
  });

  describe('finalize', () => {
    it('should wait for writer ready', async () => {
      let readyResolved = false;
      mockWriter.ready = new Promise((resolve) => {
        setTimeout(() => {
          readyResolved = true;
          resolve(undefined);
        }, 10);
      });

      const service = new StreamingZipService('test-export');
      await service.finalize();

      expect(readyResolved).toBe(true);
    });

    it('should close writer', async () => {
      const service = new StreamingZipService('test-export');
      await service.finalize();

      expect(mockWriter.close).toHaveBeenCalled();
    });

    it('should finalize without adding files', async () => {
      const service = new StreamingZipService('test-export');

      await service.finalize();

      expect(mockWriter.close).toHaveBeenCalled();
    });

    it('should finalize after adding files', async () => {
      const service = new StreamingZipService('test-export');

      await service.addFile(new Blob(['data1']), 'file1.txt');
      await service.addFile(new Blob(['data2']), 'file2.txt');
      await service.finalize();

      expect(mockWriter.close).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should wait for writer ready', async () => {
      let readyResolved = false;
      mockWriter.ready = new Promise((resolve) => {
        setTimeout(() => {
          readyResolved = true;
          resolve(undefined);
        }, 10);
      });

      const service = new StreamingZipService('test-export');
      await service.cancel();

      expect(readyResolved).toBe(true);
    });

    it('should close writer', async () => {
      const service = new StreamingZipService('test-export');
      await service.cancel();

      expect(mockWriter.close).toHaveBeenCalled();
    });

    it('should handle error gracefully', async () => {
      mockWriter.ready = Promise.reject(new Error('Writer error'));

      const service = new StreamingZipService('test-export');

      // Should not throw
      await expect(service.cancel()).resolves.toBeUndefined();
    });

    it('should handle close error gracefully', async () => {
      mockWriter.close.mockRejectedValue(new Error('Close error'));

      const service = new StreamingZipService('test-export');

      // Should not throw
      await expect(service.cancel()).resolves.toBeUndefined();
    });

    it('should abort download writer when cancelling after addFile', async () => {
      const service = new StreamingZipService('test-export');

      await service.addFile(new Blob(['data']), 'file.txt');

      await service.cancel();

      expect(mockDownloadWriter.abort).toHaveBeenCalled();
    });

    it('should cancel without adding files', async () => {
      const service = new StreamingZipService('test-export');

      await service.cancel();

      expect(mockWriter.close).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete export workflow', async () => {
      const service = new StreamingZipService('complete-export');

      await service.addFile(new Blob(['content1']), 'folder1/file1.txt');
      await service.addFile(new Blob(['content2']), 'folder1/file2.txt');
      await service.addFile(new Blob(['content3']), 'folder2/file3.txt');

      await service.finalize();

      expect(mockWriter.write).toHaveBeenCalledTimes(3);
      expect(mockWriter.close).toHaveBeenCalledTimes(1);
    });

    it('should handle export cancellation mid-operation', async () => {
      const service = new StreamingZipService('cancelled-export');

      await service.addFile(new Blob(['content1']), 'file1.txt');
      await service.addFile(new Blob(['content2']), 'file2.txt');

      await service.cancel();

      expect(mockWriter.write).toHaveBeenCalledTimes(2);
      expect(mockWriter.close).toHaveBeenCalledTimes(1);
      expect(mockDownloadWriter.abort).toHaveBeenCalled();
    });

    it('should handle zip name with special characters', async () => {
      const { createStreamingDownload } = await import('drip-fs');
      const service = new StreamingZipService('my-export-2026-02-25');

      await service.addFile(new Blob(['data']), 'file.txt');

      expect(createStreamingDownload).toHaveBeenCalledWith('my-export-2026-02-25.zip');
    });

    it('should handle large number of files', async () => {
      const service = new StreamingZipService('large-export');

      for (let i = 0; i < 100; i++) {
        await service.addFile(new Blob([`content${i}`]), `file${i}.txt`);
      }

      await service.finalize();

      expect(mockWriter.write).toHaveBeenCalledTimes(100);
      expect(mockWriter.close).toHaveBeenCalledTimes(1);
    });

    it('should handle files in nested directory structure', async () => {
      const service = new StreamingZipService('nested-export');

      await service.addFile(new Blob(['data']), 'level1/level2/level3/file.txt');
      await service.addFile(new Blob(['data']), 'level1/level2/another.txt');
      await service.addFile(new Blob(['data']), 'level1/file.txt');

      await service.finalize();

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'level1/level2/level3/file.txt' })
      );
    });
  });

  describe('multi-part splitting (#207 Arm A)', () => {
    let downloadNames: string[];

    // Fresh streams per part so each part's pipe completes independently.
    const freshStreams = () => ({
      readable: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
      writable: {
        getWriter: () => ({
          ready: Promise.resolve(),
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      },
    });

    beforeEach(async () => {
      const { Writer } = await import('@transcend-io/conflux');
      vi.mocked(Writer).mockImplementation(() => freshStreams() as any);

      downloadNames = [];
      const { createStreamingDownload } = await import('drip-fs');
      vi.mocked(createStreamingDownload).mockImplementation(async (name: string) => {
        downloadNames.push(name);
        return {
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          abort: vi.fn().mockResolvedValue(undefined),
          bytesWritten: 0,
        } as any;
      });
    });

    const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)]);

    it('keeps a single part with the plain name when under the threshold', async () => {
      const svc = new StreamingZipService('bulk-export', { maxPartBytes: 1000 });
      await svc.addFile(blobOf(300), 'a');
      await svc.addFile(blobOf(300), 'b');
      await svc.finalize();
      expect(downloadNames).toEqual(['bulk-export.zip']);
    });

    it('rolls to a new part when a file would cross the byte threshold', async () => {
      const svc = new StreamingZipService('bulk-export', { maxPartBytes: 1000 });
      await svc.addFile(blobOf(600), 'a'); // part 1: 600
      await svc.addFile(blobOf(600), 'b'); // 600+600 > 1000 → part 2
      await svc.addFile(blobOf(100), 'c'); // part 2: 700, ok
      await svc.finalize();
      expect(downloadNames).toEqual(['bulk-export.zip', 'bulk-export-part2.zip']);
    });

    it('never splits when no maxPartBytes is set (legacy single archive)', async () => {
      const svc = new StreamingZipService('bulk-export');
      await svc.addFile(blobOf(5_000_000), 'a');
      await svc.addFile(blobOf(5_000_000), 'b');
      await svc.finalize();
      expect(downloadNames).toEqual(['bulk-export.zip']);
    });

    it('keeps an oversized lone file in its own part, then rolls', async () => {
      const svc = new StreamingZipService('bulk-export', { maxPartBytes: 1000 });
      await svc.addFile(blobOf(5000), 'huge'); // > limit but empty part → stays in part 1
      await svc.addFile(blobOf(100), 'next'); // part 1 already over → part 2
      await svc.finalize();
      expect(downloadNames).toEqual(['bulk-export.zip', 'bulk-export-part2.zip']);
    });

    it('fires onPartStart per part with a 1-based index', async () => {
      const onPartStart = vi.fn();
      const svc = new StreamingZipService('bulk-export', { maxPartBytes: 1000, onPartStart });
      await svc.addFile(blobOf(600), 'a');
      await svc.addFile(blobOf(600), 'b');
      await svc.finalize();
      expect(onPartStart).toHaveBeenCalledWith({ partIndex: 1, fileName: 'bulk-export.zip' });
      expect(onPartStart).toHaveBeenCalledWith({ partIndex: 2, fileName: 'bulk-export-part2.zip' });
    });

    it('warns via onOversizeFile when a single file exceeds the 32-bit zip limit', async () => {
      const onOversizeFile = vi.fn();
      const svc = new StreamingZipService('bulk-export', { maxPartBytes: 1000, onOversizeFile });
      // Fake an >4 GiB blob without allocating it (stream() is never read by the mock).
      const huge = { size: 0xffffffff + 10 } as Blob;
      await svc.addFile(huge, 'huge.bin');
      await svc.finalize();
      expect(onOversizeFile).toHaveBeenCalledWith({ fileName: 'huge.bin', size: 0xffffffff + 10 });
    });
  });
});
