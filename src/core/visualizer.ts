/**
 * Visualizer - Test Execution Flow Visualization
 * 
 * Inspired by UI-TARS Visualizer.
 * Generates visual reports of test execution for debugging and review.
 */

/** Test step type */
export type StepType = 'action' | 'assertion' | 'navigation' | 'wait' | 'screenshot' | 'error' | 'info';

/** Test step status */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/** Test step */
export interface TestStep {
  /** Step ID */
  id: string;
  /** Step type */
  type: StepType;
  /** Step description */
  description: string;
  /** Step status */
  status: StepStatus;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in ms */
  duration?: number;
  /** Screenshot path (if captured) */
  screenshot?: string;
  /** Screenshot base64 data */
  screenshotData?: string;
  /** Error message (if failed) */
  error?: string;
  /** Error stack trace */
  stackTrace?: string;
  /** Step metadata */
  metadata?: Record<string, unknown>;
  /** Parent step ID (for nested steps) */
  parentId?: string;
  /** Child step IDs */
  childIds?: string[];
}

/** Test run info */
export interface TestRunInfo {
  /** Test run ID */
  id: string;
  /** Test name */
  name: string;
  /** Test file */
  file?: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in ms */
  duration?: number;
  /** Test status */
  status: 'running' | 'passed' | 'failed' | 'skipped';
  /** All steps */
  steps: TestStep[];
  /** Environment info */
  environment?: {
    os: string;
    browser: string;
    viewport: { width: number; height: number };
  };
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
}

/** Visualizer options */
export interface VisualizerOptions {
  /** Auto-capture screenshots on steps */
  autoScreenshot?: boolean;
  /** Screenshot on failure only */
  screenshotOnFailure?: boolean;
  /** Include stack traces */
  includeStackTrace?: boolean;
  /** Output directory */
  outputDir?: string;
  /** Report filename */
  reportFilename?: string;
}

/**
 * Visualizer - Create visual test execution reports
 * 
 * @example
 * ```typescript
 * const visualizer = new Visualizer({ outputDir: './reports' });
 * 
 * visualizer.startRun('Login Test');
 * 
 * const step1 = visualizer.startStep('action', 'Click login button');
 * await test.click('#login');
 * visualizer.endStep(step1, 'passed');
 * 
 * visualizer.endRun();
 * await visualizer.generateReport('./reports/login-test.html');
 * ```
 */
export class Visualizer {
  private options: VisualizerOptions;
  private currentRun: TestRunInfo | null = null;
  private runs: TestRunInfo[] = [];
  private stepCounter = 0;

  constructor(options: VisualizerOptions = {}) {
    this.options = {
      autoScreenshot: false,
      screenshotOnFailure: true,
      includeStackTrace: true,
      outputDir: './reports',
      reportFilename: 'test-report',
      ...options
    };
  }

  /**
   * Start a new test run
   */
  startRun(name: string, file?: string): TestRunInfo {
    this.currentRun = {
      id: `run-${Date.now()}`,
      name,
      file,
      startTime: Date.now(),
      status: 'running',
      steps: [],
      errorCount: 0,
      warningCount: 0
    };

    this.runs.push(this.currentRun);
    return this.currentRun;
  }

  /**
   * End the current test run
   */
  endRun(status?: 'passed' | 'failed' | 'skipped'): TestRunInfo | null {
    if (!this.currentRun) return null;

    this.currentRun.endTime = Date.now();
    this.currentRun.duration = this.currentRun.endTime - this.currentRun.startTime;

    // Determine status from steps if not provided
    if (!status) {
      const hasFailure = this.currentRun.steps.some(s => s.status === 'failed');
      status = hasFailure ? 'failed' : 'passed';
    }

    this.currentRun.status = status;

    const run = this.currentRun;
    this.currentRun = null;
    return run;
  }

  /**
   * Start a new step
   */
  startStep(type: StepType, description: string, metadata?: Record<string, unknown>): string {
    if (!this.currentRun) {
      throw new Error('No active test run. Call startRun() first.');
    }

    const step: TestStep = {
      id: `step-${++this.stepCounter}`,
      type,
      description,
      status: 'running',
      startTime: Date.now(),
      metadata
    };

    this.currentRun.steps.push(step);
    return step.id;
  }

  /**
   * End a step
   */
  endStep(
    stepId: string,
    status: StepStatus,
    options?: { error?: string; screenshot?: string; screenshotData?: string }
  ): void {
    if (!this.currentRun) return;

    const step = this.currentRun.steps.find(s => s.id === stepId);
    if (!step) return;

    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    step.status = status;

    if (options?.error) {
      step.error = options.error;
      if (this.options.includeStackTrace) {
        step.stackTrace = new Error().stack;
      }
      this.currentRun.errorCount++;
    }

    if (options?.screenshot) {
      step.screenshot = options.screenshot;
    }

    if (options?.screenshotData) {
      step.screenshotData = options.screenshotData;
    }
  }

  /**
   * Add a step that already completed
   */
  addStep(step: Partial<TestStep>): void {
    if (!this.currentRun) return;

    const fullStep: TestStep = {
      id: step.id || `step-${++this.stepCounter}`,
      type: step.type || 'info',
      description: step.description || '',
      status: step.status || 'passed',
      startTime: step.startTime || Date.now(),
      endTime: step.endTime || Date.now(),
      duration: step.duration,
      screenshot: step.screenshot,
      screenshotData: step.screenshotData,
      error: step.error,
      stackTrace: step.stackTrace,
      metadata: step.metadata
    };

    if (!fullStep.duration && fullStep.endTime && fullStep.startTime) {
      fullStep.duration = fullStep.endTime - fullStep.startTime;
    }

    if (fullStep.status === 'failed') {
      this.currentRun.errorCount++;
    }

    this.currentRun.steps.push(fullStep);
  }

  /**
   * Add a screenshot to the current run
   */
  addScreenshot(screenshotData: string, description?: string): void {
    this.addStep({
      type: 'screenshot',
      description: description || 'Screenshot',
      status: 'passed',
      screenshotData
    });
  }

  /**
   * Add an info message
   */
  addInfo(message: string, metadata?: Record<string, unknown>): void {
    this.addStep({
      type: 'info',
      description: message,
      status: 'passed',
      metadata
    });
  }

  /**
   * Add an error
   */
  addError(error: Error | string, description?: string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;

    this.addStep({
      type: 'error',
      description: description || errorMessage,
      status: 'failed',
      error: errorMessage,
      stackTrace
    });
  }

  /**
   * Get current run
   */
  getCurrentRun(): TestRunInfo | null {
    return this.currentRun;
  }

  /**
   * Get all runs
   */
  getAllRuns(): TestRunInfo[] {
    return [...this.runs];
  }

  /**
   * Generate HTML report
   */
  async generateReport(outputPath?: string): Promise<string> {
    const _path = outputPath || `${this.options.outputDir}/${this.options.reportFilename}.html`;
    // TODO: Write to file in a real implementation
    void _path;
    
    const html = this.generateHTML();
    return html;
  }

  /**
   * Export to YAML format
   */
  exportYAML(): string {
    const runs = this.runs.map(run => ({
      name: run.name,
      file: run.file,
      status: run.status,
      duration: `${run.duration}ms`,
      startTime: new Date(run.startTime).toISOString(),
      endTime: run.endTime ? new Date(run.endTime).toISOString() : null,
      steps: run.steps.map(step => ({
        type: step.type,
        description: step.description,
        status: step.status,
        duration: step.duration ? `${step.duration}ms` : null,
        error: step.error || null
      }))
    }));

    // Simple YAML serialization
    return this.toYAML(runs);
  }

  /**
   * Export to JSON format
   */
  exportJSON(): string {
    return JSON.stringify(this.runs, null, 2);
  }

  /**
   * Clear all runs
   */
  clear(): void {
    this.runs = [];
    this.currentRun = null;
    this.stepCounter = 0;
  }

  // Private methods

  private generateHTML(): string {
    const totalTests = this.runs.length;
    const passedTests = this.runs.filter(r => r.status === 'passed').length;
    const failedTests = this.runs.filter(r => r.status === 'failed').length;
    const totalDuration = this.runs.reduce((sum, r) => sum + (r.duration || 0), 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DeskPilot Test Report</title>
  <style>
    :root {
      --bg-primary: #0c1222;
      --bg-secondary: #151e32;
      --bg-tertiary: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-red: #ef4444;
      --accent-yellow: #f59e0b;
      --border: #334155;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 20px;
    }
    
    .container { max-width: 1200px; margin: 0 auto; }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .header h1 {
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo {
      width: 40px;
      height: 40px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    
    .summary-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .summary-card .label {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .summary-card.passed .value { color: var(--accent-green); }
    .summary-card.failed .value { color: var(--accent-red); }
    
    .test-run {
      background: var(--bg-secondary);
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    
    .test-run-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      cursor: pointer;
      border-bottom: 1px solid var(--border);
    }
    
    .test-run-header:hover {
      background: var(--bg-tertiary);
    }
    
    .test-name {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .status-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .status-badge.passed {
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }
    
    .status-badge.failed {
      background: rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
    }
    
    .test-run-body {
      padding: 16px 20px;
    }
    
    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    
    .step:last-child { border-bottom: none; }
    
    .step-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    
    .step-icon.action { background: var(--accent-blue); }
    .step-icon.assertion { background: var(--accent-green); }
    .step-icon.navigation { background: var(--accent-yellow); }
    .step-icon.error { background: var(--accent-red); }
    .step-icon.screenshot { background: #8b5cf6; }
    .step-icon.info { background: var(--text-secondary); }
    
    .step-content { flex: 1; }
    
    .step-description {
      margin-bottom: 4px;
    }
    
    .step-meta {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .step-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--accent-red);
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    
    .step-screenshot {
      max-width: 400px;
      border-radius: 8px;
      margin-top: 8px;
      border: 1px solid var(--border);
    }
    
    .duration {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .timeline {
      display: flex;
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      margin: 20px 0;
      overflow: hidden;
    }
    
    .timeline-segment {
      height: 100%;
    }
    
    .timeline-segment.passed { background: var(--accent-green); }
    .timeline-segment.failed { background: var(--accent-red); }
    .timeline-segment.running { background: var(--accent-blue); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <svg class="logo" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6"/>
              <stop offset="100%" stop-color="#8b5cf6"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="54" fill="#0c1222"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="url(#g)" stroke-width="2"/>
          <g fill="#ffffff">
            <polygon points="30,65 90,50 55,60 60,75"/>
            <polygon points="30,65 55,60 50,50" fill-opacity="0.7"/>
          </g>
          <circle cx="25" cy="68" r="3" fill="#22d3ee"/>
        </svg>
        DeskPilot Test Report
      </h1>
      <div class="duration">Generated: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <div class="value">${totalTests}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="summary-card passed">
        <div class="value">${passedTests}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card failed">
        <div class="value">${failedTests}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card">
        <div class="value">${this.formatDuration(totalDuration)}</div>
        <div class="label">Duration</div>
      </div>
    </div>
    
    ${this.runs.map(run => this.renderTestRun(run)).join('')}
  </div>
  
  <script>
    document.querySelectorAll('.test-run-header').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling;
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
      });
    });
  </script>
</body>
</html>`;
  }

  private renderTestRun(run: TestRunInfo): string {
    const stepIcons: Record<StepType, string> = {
      action: '▶',
      assertion: '✓',
      navigation: '→',
      wait: '⏱',
      screenshot: '📷',
      error: '✕',
      info: 'ℹ'
    };

    return `
    <div class="test-run">
      <div class="test-run-header">
        <div class="test-name">
          <span class="status-badge ${run.status}">${run.status.toUpperCase()}</span>
          <span>${run.name}</span>
        </div>
        <div class="duration">${this.formatDuration(run.duration || 0)}</div>
      </div>
      <div class="test-run-body">
        <div class="timeline">
          ${run.steps.map(step => `
            <div class="timeline-segment ${step.status}" 
                 style="width: ${((step.duration || 1) / (run.duration || 1)) * 100}%"></div>
          `).join('')}
        </div>
        ${run.steps.map(step => `
          <div class="step">
            <div class="step-icon ${step.type}">${stepIcons[step.type] || '•'}</div>
            <div class="step-content">
              <div class="step-description">${step.description}</div>
              <div class="step-meta">
                ${step.duration ? `${step.duration}ms` : ''} 
                ${step.status !== 'passed' ? `• ${step.status}` : ''}
              </div>
              ${step.error ? `<div class="step-error">${step.error}</div>` : ''}
              ${step.screenshotData ? `<img class="step-screenshot" src="${step.screenshotData}" alt="Screenshot">` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private toYAML(obj: unknown, indent = 0): string {
    const spaces = '  '.repeat(indent);
    
    if (Array.isArray(obj)) {
      return obj.map(item => `${spaces}- ${this.toYAML(item, indent + 1).trim()}`).join('\n');
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => {
          if (typeof v === 'object') {
            return `${spaces}${k}:\n${this.toYAML(v, indent + 1)}`;
          }
          return `${spaces}${k}: ${v}`;
        })
        .join('\n');
    }
    
    return String(obj);
  }
}

export default Visualizer;
