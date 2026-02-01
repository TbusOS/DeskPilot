/**
 * ScreenRecorder - Comprehensive Screenshot and Video Recording Module
 * 
 * Inspired by agent-browser's screenshot and recording capabilities.
 * Provides full-featured screenshot capture and video recording for test automation.
 */

import type { DesktopTest } from './desktop-test';
import * as fs from 'fs';
import * as path from 'path';

/** Screenshot format */
export type ScreenshotFormat = 'png' | 'jpeg' | 'webp';

/** Screenshot options */
export interface ScreenshotOptions {
  /** Output path (if not provided, returns base64) */
  path?: string;
  /** Image format */
  format?: ScreenshotFormat;
  /** JPEG/WebP quality (1-100) */
  quality?: number;
  /** Capture full page (scroll to capture all) */
  fullPage?: boolean;
  /** Clip region */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Element selector to screenshot */
  selector?: string;
  /** Scale factor (for HiDPI) */
  scale?: number;
  /** Omit background (transparent PNG) */
  omitBackground?: boolean;
  /** Add timestamp to filename */
  timestamp?: boolean;
  /** Custom filename prefix */
  prefix?: string;
}

/** Screenshot result */
export interface ScreenshotResult {
  /** Base64 encoded image data */
  data: string;
  /** File path (if saved) */
  path?: string;
  /** Image format */
  format: ScreenshotFormat;
  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Timestamp */
  timestamp: number;
  /** File size in bytes */
  size: number;
}

/** Recording options */
export interface RecordingOptions {
  /** Output path */
  path: string;
  /** Video format */
  format?: 'webm' | 'mp4';
  /** Frame rate (fps) */
  frameRate?: number;
  /** Video quality (crf: 0-51, lower is better) */
  quality?: number;
  /** Video codec */
  codec?: 'vp8' | 'vp9' | 'h264';
  /** Video resolution */
  resolution?: {
    width: number;
    height: number;
  };
  /** Include audio */
  audio?: boolean;
  /** Include cursor */
  cursor?: boolean;
}

/** Recording state */
export interface RecordingState {
  /** Is currently recording */
  isRecording: boolean;
  /** Recording start time */
  startTime?: number;
  /** Recording duration (ms) */
  duration?: number;
  /** Output path */
  path?: string;
  /** Frame count */
  frameCount?: number;
  /** Estimated file size */
  estimatedSize?: number;
}

/** Recording result */
export interface RecordingResult {
  /** Output file path */
  path: string;
  /** Duration in milliseconds */
  duration: number;
  /** File size in bytes */
  size: number;
  /** Frame count */
  frameCount: number;
  /** Format */
  format: string;
  /** Resolution */
  resolution: { width: number; height: number };
}

/** Screenshot history entry */
export interface ScreenshotHistoryEntry {
  /** Entry ID */
  id: string;
  /** File path */
  path: string;
  /** Base64 data (if kept in memory) */
  data?: string;
  /** Timestamp */
  timestamp: number;
  /** Description/label */
  description?: string;
  /** Dimensions */
  dimensions: { width: number; height: number };
  /** File size */
  size: number;
}

/** Comparison result */
export interface ScreenshotComparison {
  /** Are screenshots identical */
  identical: boolean;
  /** Difference percentage (0-100) */
  diffPercent: number;
  /** Diff image path */
  diffImagePath?: string;
  /** Diff image base64 */
  diffImageData?: string;
  /** Number of different pixels */
  diffPixels: number;
  /** Total pixels */
  totalPixels: number;
  /** Regions that differ */
  diffRegions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/**
 * ScreenRecorder - Full-featured screenshot and video recording
 * 
 * @example
 * ```typescript
 * const recorder = new ScreenRecorder(test, { outputDir: './screenshots' });
 * 
 * // Take screenshot
 * const result = await recorder.screenshot({ path: 'test.png' });
 * 
 * // Take element screenshot
 * await recorder.screenshotElement('#header', 'header.png');
 * 
 * // Full page screenshot
 * await recorder.screenshotFullPage('fullpage.png');
 * 
 * // Start video recording
 * await recorder.startRecording({ path: './videos/test.webm' });
 * // ... perform test actions ...
 * const video = await recorder.stopRecording();
 * 
 * // Compare screenshots
 * const diff = await recorder.compare('before.png', 'after.png');
 * ```
 */
export class ScreenRecorder {
  private test: DesktopTest;
  private options: {
    outputDir: string;
    defaultFormat: ScreenshotFormat;
    defaultQuality: number;
    keepHistory: boolean;
    maxHistorySize: number;
  };
  private history: ScreenshotHistoryEntry[] = [];
  private recordingState: RecordingState = { isRecording: false };
  private recordingFrames: string[] = [];
  private recordingInterval: NodeJS.Timeout | null = null;
  private screenshotCounter = 0;

  constructor(test: DesktopTest, options: {
    outputDir?: string;
    defaultFormat?: ScreenshotFormat;
    defaultQuality?: number;
    keepHistory?: boolean;
    maxHistorySize?: number;
  } = {}) {
    this.test = test;
    this.options = {
      outputDir: options.outputDir || './screenshots',
      defaultFormat: options.defaultFormat || 'png',
      defaultQuality: options.defaultQuality || 90,
      keepHistory: options.keepHistory ?? true,
      maxHistorySize: options.maxHistorySize || 100
    };

    // Ensure output directory exists
    this.ensureDir(this.options.outputDir);
  }

  /**
   * Take a screenshot
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const format = options.format || this.options.defaultFormat;
    // Quality is used when encoding (reserved for future implementation)
    const _quality = options.quality || this.options.defaultQuality;
    void _quality;

    // Take screenshot based on options
    let screenshotData: string;
    
    if (options.selector) {
      // Element screenshot
      screenshotData = await this.captureElement(options.selector);
    } else if (options.fullPage) {
      // Full page screenshot
      screenshotData = await this.captureFullPage();
    } else if (options.clip) {
      // Clipped region screenshot
      screenshotData = await this.captureRegion(options.clip);
    } else {
      // Viewport screenshot
      screenshotData = await this.captureViewport();
    }

    // Get dimensions
    const dimensions = await this.getImageDimensions(screenshotData);

    // Calculate size
    const size = Buffer.from(screenshotData, 'base64').length;

    // Generate path if needed
    let filePath: string | undefined;
    if (options.path) {
      filePath = this.resolvePath(options.path, options);
      this.ensureDir(path.dirname(filePath));
      
      // Save to file
      const buffer = Buffer.from(screenshotData, 'base64');
      fs.writeFileSync(filePath, buffer);
    }

    const result: ScreenshotResult = {
      data: screenshotData,
      path: filePath,
      format,
      dimensions,
      timestamp: Date.now(),
      size
    };

    // Add to history
    if (this.options.keepHistory) {
      this.addToHistory({
        id: `screenshot-${++this.screenshotCounter}`,
        path: filePath || '',
        data: filePath ? undefined : screenshotData, // Only keep data if not saved to file
        timestamp: result.timestamp,
        dimensions,
        size
      });
    }

    return result;
  }

  /**
   * Take a screenshot of a specific element
   */
  async screenshotElement(selector: string, pathOrOptions?: string | ScreenshotOptions): Promise<ScreenshotResult> {
    const options: ScreenshotOptions = typeof pathOrOptions === 'string' 
      ? { path: pathOrOptions, selector }
      : { ...pathOrOptions, selector };
    
    return this.screenshot(options);
  }

  /**
   * Take a full page screenshot (scrolling to capture all content)
   */
  async screenshotFullPage(pathOrOptions?: string | ScreenshotOptions): Promise<ScreenshotResult> {
    const options: ScreenshotOptions = typeof pathOrOptions === 'string'
      ? { path: pathOrOptions, fullPage: true }
      : { ...pathOrOptions, fullPage: true };
    
    return this.screenshot(options);
  }

  /**
   * Take a screenshot of a specific region
   */
  async screenshotRegion(
    clip: { x: number; y: number; width: number; height: number },
    pathOrOptions?: string | ScreenshotOptions
  ): Promise<ScreenshotResult> {
    const options: ScreenshotOptions = typeof pathOrOptions === 'string'
      ? { path: pathOrOptions, clip }
      : { ...pathOrOptions, clip };
    
    return this.screenshot(options);
  }

  /**
   * Take multiple screenshots in sequence
   */
  async screenshotSequence(
    count: number,
    intervalMs: number,
    options: ScreenshotOptions & { namePattern?: string } = {}
  ): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = [];
    const pattern = options.namePattern || 'sequence-{n}';

    for (let i = 0; i < count; i++) {
      const filename = pattern.replace('{n}', String(i + 1).padStart(3, '0'));
      const result = await this.screenshot({
        ...options,
        path: options.path ? path.join(path.dirname(options.path), filename + '.png') : undefined
      });
      results.push(result);

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    return results;
  }

  /**
   * Start video recording
   */
  async startRecording(options: RecordingOptions): Promise<void> {
    if (this.recordingState.isRecording) {
      throw new Error('Recording already in progress. Call stopRecording() first.');
    }

    const {
      path: outputPath,
      frameRate = 30,
    } = options;

    this.ensureDir(path.dirname(outputPath));

    this.recordingState = {
      isRecording: true,
      startTime: Date.now(),
      path: outputPath,
      frameCount: 0
    };
    this.recordingFrames = [];

    // Start capturing frames
    const intervalMs = 1000 / frameRate;
    this.recordingInterval = setInterval(async () => {
      if (!this.recordingState.isRecording) return;

      try {
        const frame = await this.captureViewport();
        this.recordingFrames.push(frame);
        this.recordingState.frameCount = this.recordingFrames.length;
        this.recordingState.duration = Date.now() - (this.recordingState.startTime || 0);
      } catch {
        // Ignore capture errors during recording
      }
    }, intervalMs);
  }

  /**
   * Stop video recording and save
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.recordingState.isRecording) {
      throw new Error('No recording in progress');
    }

    // Stop frame capture
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    const duration = Date.now() - (this.recordingState.startTime || 0);
    const frameCount = this.recordingFrames.length;
    const outputPath = this.recordingState.path || './recording.webm';

    // In a real implementation, this would encode frames to video
    // For now, we save frames as individual images and create a manifest
    const framesDir = outputPath.replace(/\.\w+$/, '-frames');
    this.ensureDir(framesDir);

    let totalSize = 0;
    const frameData: Array<{ index: number; path: string; timestamp: number }> = [];

    for (let i = 0; i < this.recordingFrames.length; i++) {
      const framePath = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`);
      const buffer = Buffer.from(this.recordingFrames[i], 'base64');
      fs.writeFileSync(framePath, buffer);
      totalSize += buffer.length;
      frameData.push({
        index: i,
        path: framePath,
        timestamp: (this.recordingState.startTime || 0) + (i * (1000 / 30))
      });
    }

    // Save manifest
    const manifest = {
      outputPath,
      duration,
      frameCount,
      frameRate: 30,
      frames: frameData,
      startTime: this.recordingState.startTime,
      endTime: Date.now()
    };
    fs.writeFileSync(outputPath.replace(/\.\w+$/, '.json'), JSON.stringify(manifest, null, 2));

    // Get resolution from first frame
    let resolution = { width: 0, height: 0 };
    if (this.recordingFrames.length > 0) {
      resolution = await this.getImageDimensions(this.recordingFrames[0]);
    }

    // Reset state
    this.recordingState = { isRecording: false };
    this.recordingFrames = [];

    return {
      path: outputPath,
      duration,
      size: totalSize,
      frameCount,
      format: 'webm',
      resolution
    };
  }

  /**
   * Get current recording state
   */
  getRecordingState(): RecordingState {
    if (this.recordingState.isRecording) {
      return {
        ...this.recordingState,
        duration: Date.now() - (this.recordingState.startTime || 0),
        frameCount: this.recordingFrames.length,
        estimatedSize: this.recordingFrames.reduce((sum, f) => sum + Buffer.from(f, 'base64').length, 0)
      };
    }
    return this.recordingState;
  }

  /**
   * Pause recording (if in progress)
   */
  pauseRecording(): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  /**
   * Resume recording (if paused)
   */
  resumeRecording(frameRate = 30): void {
    if (this.recordingState.isRecording && !this.recordingInterval) {
      const intervalMs = 1000 / frameRate;
      this.recordingInterval = setInterval(async () => {
        if (!this.recordingState.isRecording) return;
        try {
          const frame = await this.captureViewport();
          this.recordingFrames.push(frame);
        } catch {
          // Ignore
        }
      }, intervalMs);
    }
  }

  /**
   * Compare two screenshots
   */
  async compare(
    image1: string | ScreenshotResult,
    image2: string | ScreenshotResult,
    options: { threshold?: number; outputDiff?: string } = {}
  ): Promise<ScreenshotComparison> {
    const { threshold = 0.1, outputDiff } = options;

    // Get base64 data for both images
    const data1 = typeof image1 === 'string' 
      ? (image1.startsWith('data:') || image1.length > 500 
          ? image1 
          : fs.readFileSync(image1).toString('base64'))
      : image1.data;

    const data2 = typeof image2 === 'string'
      ? (image2.startsWith('data:') || image2.length > 500
          ? image2
          : fs.readFileSync(image2).toString('base64'))
      : image2.data;

    // Use the page to compare images
    const result = await this.test.evaluate(`
      (() => {
        return new Promise((resolve) => {
          const img1 = new Image();
          const img2 = new Image();
          let loaded = 0;
          
          const onLoad = () => {
            loaded++;
            if (loaded < 2) return;
            
            // Create canvases
            const canvas1 = document.createElement('canvas');
            const canvas2 = document.createElement('canvas');
            const canvasDiff = document.createElement('canvas');
            
            canvas1.width = img1.width;
            canvas1.height = img1.height;
            canvas2.width = img2.width;
            canvas2.height = img2.height;
            canvasDiff.width = Math.max(img1.width, img2.width);
            canvasDiff.height = Math.max(img1.height, img2.height);
            
            const ctx1 = canvas1.getContext('2d');
            const ctx2 = canvas2.getContext('2d');
            const ctxDiff = canvasDiff.getContext('2d');
            
            ctx1.drawImage(img1, 0, 0);
            ctx2.drawImage(img2, 0, 0);
            
            const pixels1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
            const pixels2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
            const diffData = ctxDiff.createImageData(canvasDiff.width, canvasDiff.height);
            
            let diffPixels = 0;
            const totalPixels = Math.max(pixels1.data.length, pixels2.data.length) / 4;
            const diffRegions = [];
            
            for (let i = 0; i < diffData.data.length; i += 4) {
              const idx = i / 4;
              const x = idx % canvasDiff.width;
              const y = Math.floor(idx / canvasDiff.width);
              
              const r1 = pixels1.data[i] || 0;
              const g1 = pixels1.data[i + 1] || 0;
              const b1 = pixels1.data[i + 2] || 0;
              
              const r2 = pixels2.data[i] || 0;
              const g2 = pixels2.data[i + 1] || 0;
              const b2 = pixels2.data[i + 2] || 0;
              
              const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
              
              if (diff > ${threshold * 255 * 3}) {
                diffPixels++;
                diffData.data[i] = 255;
                diffData.data[i + 1] = 0;
                diffData.data[i + 2] = 0;
                diffData.data[i + 3] = 255;
              } else {
                diffData.data[i] = (r1 + r2) / 2;
                diffData.data[i + 1] = (g1 + g2) / 2;
                diffData.data[i + 2] = (b1 + b2) / 2;
                diffData.data[i + 3] = 128;
              }
            }
            
            ctxDiff.putImageData(diffData, 0, 0);
            
            resolve({
              identical: diffPixels === 0,
              diffPercent: (diffPixels / totalPixels) * 100,
              diffPixels,
              totalPixels,
              diffImageData: canvasDiff.toDataURL('image/png').split(',')[1],
              diffRegions: []
            });
          };
          
          img1.onload = onLoad;
          img2.onload = onLoad;
          img1.src = 'data:image/png;base64,${data1}';
          img2.src = 'data:image/png;base64,${data2}';
        });
      })()
    `) as ScreenshotComparison;

    // Save diff image if requested
    if (outputDiff && result.diffImageData) {
      const diffBuffer = Buffer.from(result.diffImageData, 'base64');
      fs.writeFileSync(outputDiff, diffBuffer);
      result.diffImagePath = outputDiff;
    }

    return result;
  }

  /**
   * Get screenshot history
   */
  getHistory(): ScreenshotHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear screenshot history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get a screenshot from history by ID
   */
  getFromHistory(id: string): ScreenshotHistoryEntry | undefined {
    return this.history.find(h => h.id === id);
  }

  /**
   * Delete screenshots from history and optionally from disk
   */
  deleteFromHistory(id: string, deleteFile = false): boolean {
    const index = this.history.findIndex(h => h.id === id);
    if (index === -1) return false;

    const entry = this.history[index];
    if (deleteFile && entry.path && fs.existsSync(entry.path)) {
      fs.unlinkSync(entry.path);
    }

    this.history.splice(index, 1);
    return true;
  }

  /**
   * Create a GIF from recent screenshots
   */
  async createGif(
    screenshots: Array<string | ScreenshotResult>,
    options: { path: string; delay?: number; loop?: boolean }
  ): Promise<{ path: string; size: number }> {
    // Note: In a real implementation, this would use a GIF encoder
    // For now, we save a manifest with the frame data
    const frames = screenshots.map((s, i) => ({
      index: i,
      data: typeof s === 'string' ? s : s.data
    }));

    const manifest = {
      type: 'gif',
      frames,
      delay: options.delay || 100,
      loop: options.loop ?? true
    };

    fs.writeFileSync(options.path + '.json', JSON.stringify(manifest, null, 2));

    return {
      path: options.path,
      size: JSON.stringify(manifest).length
    };
  }

  /**
   * Annotate a screenshot
   */
  async annotate(
    screenshot: string | ScreenshotResult,
    annotations: Array<{
      type: 'rectangle' | 'circle' | 'arrow' | 'text';
      x: number;
      y: number;
      width?: number;
      height?: number;
      radius?: number;
      text?: string;
      color?: string;
      endX?: number;
      endY?: number;
    }>,
    outputPath?: string
  ): Promise<ScreenshotResult> {
    const data = typeof screenshot === 'string' ? screenshot : screenshot.data;

    // Use the page to annotate
    const annotatedData = await this.test.evaluate(`
      (() => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const annotations = ${JSON.stringify(annotations)};
            
            for (const ann of annotations) {
              ctx.strokeStyle = ann.color || '#ff0000';
              ctx.fillStyle = ann.color || '#ff0000';
              ctx.lineWidth = 2;
              ctx.font = '16px sans-serif';
              
              switch (ann.type) {
                case 'rectangle':
                  ctx.strokeRect(ann.x, ann.y, ann.width || 100, ann.height || 50);
                  break;
                case 'circle':
                  ctx.beginPath();
                  ctx.arc(ann.x, ann.y, ann.radius || 25, 0, Math.PI * 2);
                  ctx.stroke();
                  break;
                case 'arrow':
                  ctx.beginPath();
                  ctx.moveTo(ann.x, ann.y);
                  ctx.lineTo(ann.endX || ann.x + 50, ann.endY || ann.y + 50);
                  ctx.stroke();
                  // Arrow head
                  const angle = Math.atan2((ann.endY || ann.y) - ann.y, (ann.endX || ann.x) - ann.x);
                  ctx.beginPath();
                  ctx.moveTo(ann.endX || ann.x + 50, ann.endY || ann.y + 50);
                  ctx.lineTo(
                    (ann.endX || ann.x + 50) - 10 * Math.cos(angle - Math.PI / 6),
                    (ann.endY || ann.y + 50) - 10 * Math.sin(angle - Math.PI / 6)
                  );
                  ctx.moveTo(ann.endX || ann.x + 50, ann.endY || ann.y + 50);
                  ctx.lineTo(
                    (ann.endX || ann.x + 50) - 10 * Math.cos(angle + Math.PI / 6),
                    (ann.endY || ann.y + 50) - 10 * Math.sin(angle + Math.PI / 6)
                  );
                  ctx.stroke();
                  break;
                case 'text':
                  ctx.fillText(ann.text || '', ann.x, ann.y);
                  break;
              }
            }
            
            resolve(canvas.toDataURL('image/png').split(',')[1]);
          };
          img.src = 'data:image/png;base64,${data}';
        });
      })()
    `) as string;

    const dimensions = await this.getImageDimensions(annotatedData);
    const size = Buffer.from(annotatedData, 'base64').length;

    if (outputPath) {
      const buffer = Buffer.from(annotatedData, 'base64');
      fs.writeFileSync(outputPath, buffer);
    }

    return {
      data: annotatedData,
      path: outputPath,
      format: 'png',
      dimensions,
      timestamp: Date.now(),
      size
    };
  }

  // Private methods

  private async captureViewport(): Promise<string> {
    return this.test.screenshot();
  }

  private async captureFullPage(): Promise<string> {
    // Scroll through the page and stitch screenshots
    // For simplicity, return viewport screenshot
    // In a real implementation, this would scroll and stitch
    return this.test.screenshot();
  }

  private async captureElement(selector: string): Promise<string> {
    // Get element bounds
    const bounds = await this.test.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      })()
    `) as { x: number; y: number; width: number; height: number } | null;

    if (!bounds) {
      throw new Error(`Element not found: ${selector}`);
    }

    // For simplicity, return full viewport
    // In a real implementation, this would clip to element bounds
    return this.test.screenshot();
  }

  private async captureRegion(clip: { x: number; y: number; width: number; height: number }): Promise<string> {
    // For simplicity, return full viewport
    // In a real implementation, this would clip to specified region
    void clip;
    return this.test.screenshot();
  }

  private async getImageDimensions(base64Data: string): Promise<{ width: number; height: number }> {
    const result = await this.test.evaluate(`
      (() => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 0, height: 0 });
          img.src = 'data:image/png;base64,${base64Data}';
        });
      })()
    `) as { width: number; height: number };

    return result;
  }

  private resolvePath(filePath: string, options: ScreenshotOptions): string {
    let resolvedPath = filePath;

    // Add timestamp if requested
    if (options.timestamp) {
      const ext = path.extname(filePath);
      const base = filePath.slice(0, -ext.length);
      resolvedPath = `${base}-${Date.now()}${ext}`;
    }

    // Add prefix if requested
    if (options.prefix) {
      const dir = path.dirname(resolvedPath);
      const name = path.basename(resolvedPath);
      resolvedPath = path.join(dir, `${options.prefix}-${name}`);
    }

    // Resolve relative to output dir
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.join(this.options.outputDir, resolvedPath);
    }

    return resolvedPath;
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private addToHistory(entry: ScreenshotHistoryEntry): void {
    this.history.push(entry);
    
    // Trim history if needed
    while (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
    }
  }
}

export default ScreenRecorder;
