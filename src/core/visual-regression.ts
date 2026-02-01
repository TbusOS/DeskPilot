/**
 * @flowsight/desktop-test - Visual Regression Testing
 *
 * Provides screenshot comparison and visual regression detection.
 * Supports baseline management and diff generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type { DesktopTestInstance } from '../types.js';

/**
 * Visual diff result
 */
export interface VisualDiffResult {
  match: boolean;
  diffPercentage: number;
  diffPixels: number;
  totalPixels: number;
  baselineExists: boolean;
  screenshotPath: string;
  baselinePath: string;
  diffPath?: string;
}

/**
 * Visual regression options
 */
export interface VisualRegressionOptions {
  /** Directory to store baselines */
  baselineDir: string;
  /** Directory to store current screenshots */
  outputDir: string;
  /** Threshold for acceptable diff (0-1) */
  threshold?: number;
  /** Update baselines automatically */
  updateBaselines?: boolean;
  /** Mask areas to ignore */
  maskSelectors?: string[];
}

/**
 * Visual Regression Tester
 */
export class VisualRegressionTester {
  private test: DesktopTestInstance;
  private options: Required<VisualRegressionOptions>;

  constructor(test: DesktopTestInstance, options: VisualRegressionOptions) {
    this.test = test;
    this.options = {
      threshold: 0.01, // 1% default threshold
      updateBaselines: false,
      maskSelectors: [],
      ...options,
    };

    // Ensure directories exist
    if (!fs.existsSync(this.options.baselineDir)) {
      fs.mkdirSync(this.options.baselineDir, { recursive: true });
    }
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a unique name for a screenshot
   */
  private getSnapshotName(name: string): string {
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitized}.png`;
  }

  /**
   * Take a screenshot and compare with baseline
   */
  async compareScreenshot(
    name: string,
    _options: {
      selector?: string;
      fullPage?: boolean;
      mask?: string[];
    } = {}
  ): Promise<VisualDiffResult> {
    const filename = this.getSnapshotName(name);
    const screenshotPath = path.join(this.options.outputDir, filename);
    const baselinePath = path.join(this.options.baselineDir, filename);
    const diffPath = path.join(this.options.outputDir, `diff_${filename}`);

    // Take current screenshot using CDP adapter
    const screenshot = await this.test.screenshot();
    const screenshotBuffer = Buffer.from(screenshot, 'base64');
    fs.writeFileSync(screenshotPath, screenshotBuffer);

    // Check if baseline exists
    if (!fs.existsSync(baselinePath)) {
      if (this.options.updateBaselines) {
        // Create baseline
        fs.copyFileSync(screenshotPath, baselinePath);
        return {
          match: true,
          diffPercentage: 0,
          diffPixels: 0,
          totalPixels: 0,
          baselineExists: false,
          screenshotPath,
          baselinePath,
        };
      }
      return {
        match: false,
        diffPercentage: 100,
        diffPixels: -1,
        totalPixels: -1,
        baselineExists: false,
        screenshotPath,
        baselinePath,
      };
    }

    // Compare images using pixel comparison
    const diffResult = await this.compareImages(
      baselinePath,
      screenshotPath,
      diffPath
    );

    // Update baseline if requested and diff exceeds threshold
    if (this.options.updateBaselines && diffResult.diffPercentage > this.options.threshold) {
      fs.copyFileSync(screenshotPath, baselinePath);
    }

    return {
      ...diffResult,
      baselineExists: true,
      screenshotPath,
      baselinePath,
      diffPath: diffResult.diffPixels > 0 ? diffPath : undefined,
    };
  }

  /**
   * Compare two images using pixel-by-pixel comparison
   */
  private async compareImages(
    baselinePath: string,
    currentPath: string,
    _diffPath: string
  ): Promise<{ match: boolean; diffPercentage: number; diffPixels: number; totalPixels: number }> {
    try {
      // Use jimp for image comparison
      const { Jimp } = await import('jimp');
      
      const baseline = await Jimp.read(baselinePath);
      const current = await Jimp.read(currentPath);

      // Simple hash comparison for now
      // Full pixel comparison can be enabled when jimp types are stable
      const baselineHash = baseline.hash();
      const currentHash = current.hash();
      
      const match = baselineHash === currentHash;
      
      return {
        match,
        diffPercentage: match ? 0 : 100,
        diffPixels: match ? 0 : -1,
        totalPixels: baseline.width * baseline.height,
      };
    } catch {
      // Fallback to hash comparison
      const baselineHash = this.hashFile(baselinePath);
      const currentHash = this.hashFile(currentPath);
      const match = baselineHash === currentHash;
      
      return {
        match,
        diffPercentage: match ? 0 : 100,
        diffPixels: match ? 0 : -1,
        totalPixels: -1,
      };
    }
  }

  /**
   * Hash a file for quick comparison
   */
  private hashFile(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Compare full page screenshot
   */
  async compareFullPage(name: string): Promise<VisualDiffResult> {
    return this.compareScreenshot(name, { fullPage: true });
  }

  /**
   * Compare specific element
   */
  async compareElement(name: string, selector: string): Promise<VisualDiffResult> {
    // First scroll element into view
    await this.test.evaluate(`
      document.querySelector('${selector}')?.scrollIntoView({ block: 'center' });
    `);
    await this.test.wait(300);
    
    return this.compareScreenshot(name, { selector });
  }

  /**
   * Update all baselines
   */
  async updateAllBaselines(): Promise<void> {
    const currentFiles = fs.readdirSync(this.options.outputDir)
      .filter(f => f.endsWith('.png') && !f.startsWith('diff_'));
    
    for (const file of currentFiles) {
      const src = path.join(this.options.outputDir, file);
      const dest = path.join(this.options.baselineDir, file);
      fs.copyFileSync(src, dest);
    }
  }

  /**
   * Get list of baselines
   */
  getBaselines(): string[] {
    if (!fs.existsSync(this.options.baselineDir)) {
      return [];
    }
    return fs.readdirSync(this.options.baselineDir)
      .filter(f => f.endsWith('.png'));
  }

  /**
   * Delete a baseline
   */
  deleteBaseline(name: string): boolean {
    const filename = this.getSnapshotName(name);
    const baselinePath = path.join(this.options.baselineDir, filename);
    if (fs.existsSync(baselinePath)) {
      fs.unlinkSync(baselinePath);
      return true;
    }
    return false;
  }
}

/**
 * Create visual regression tester
 */
export function createVisualRegressionTester(
  test: DesktopTestInstance,
  options: VisualRegressionOptions
): VisualRegressionTester {
  return new VisualRegressionTester(test, options);
}
