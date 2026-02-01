/**
 * @flowsight/desktop-test - NutJS Adapter
 *
 * Native desktop control adapter using NutJS.
 * Provides cross-platform mouse, keyboard, and screenshot capabilities.
 */

import type { NutJSConfig, NutJSAdapterInterface } from '../types.js';

/**
 * Key mapping for NutJS
 */
const KEY_MAP: Record<string, string> = {
  'ctrl': 'LeftControl',
  'control': 'LeftControl',
  'cmd': 'LeftSuper',
  'command': 'LeftSuper',
  'meta': 'LeftSuper',
  'alt': 'LeftAlt',
  'option': 'LeftAlt',
  'shift': 'LeftShift',
  'enter': 'Return',
  'return': 'Return',
  'esc': 'Escape',
  'escape': 'Escape',
  'backspace': 'Backspace',
  'delete': 'Delete',
  'tab': 'Tab',
  'space': 'Space',
  'up': 'Up',
  'down': 'Down',
  'left': 'Left',
  'right': 'Right',
  'home': 'Home',
  'end': 'End',
  'pageup': 'PageUp',
  'pagedown': 'PageDown',
  'insert': 'Insert',
  'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
  'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
  'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
};

/**
 * NutJS Adapter - native desktop control
 */
export class NutJSAdapter implements NutJSAdapterInterface {
  private config: Required<NutJSConfig>;
  private initialized: boolean = false;
  private nut: NutJSModule | null = null;

  constructor(config: NutJSConfig = {}) {
    this.config = {
      keyboard: config.keyboard ?? true,
      mouse: config.mouse ?? true,
      keyDelay: config.keyDelay ?? 50,
      mouseSpeed: config.mouseSpeed ?? 500,
    };
  }

  /**
   * Initialize NutJS
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid bundling issues
      // Try @computer-use/nut-js first (newer package), fallback to @nut-tree/nut-js
      let nutModule: NutJSModule;
      
      try {
        // @ts-expect-error - Dynamic import, types not bundled
        nutModule = await import('@computer-use/nut-js') as NutJSModule;
      } catch {
        try {
          // @ts-expect-error - Dynamic import, types not bundled
          nutModule = await import('@nut-tree/nut-js') as NutJSModule;
        } catch {
          throw new Error('NutJS not installed. Run: npm install @nut-tree/nut-js');
        }
      }

      this.nut = nutModule;

      // Configure
      if (this.nut.keyboard) {
        this.nut.keyboard.config.autoDelayMs = this.config.keyDelay;
      }
      if (this.nut.mouse) {
        this.nut.mouse.config.mouseSpeed = this.config.mouseSpeed;
      }

      this.initialized = true;
    } catch (error: unknown) {
      // NutJS is optional - fall back gracefully
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[NutJS Adapter] Not available: ${message}`);
      this.initialized = false;
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.nut = null;
  }

  /**
   * Check if NutJS is available
   */
  isAvailable(): boolean {
    return this.initialized && this.nut !== null;
  }

  /**
   * Click at coordinates
   */
  async click(
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle' = 'left',
    count: number = 1
  ): Promise<void> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { mouse, Button, Point } = this.nut;

    await mouse.setPosition(new Point(x, y));

    const mouseButton = button === 'right' ? Button.RIGHT :
                        button === 'middle' ? Button.MIDDLE : Button.LEFT;

    for (let i = 0; i < count; i++) {
      await mouse.click(mouseButton);
      if (i < count - 1) {
        await this.sleep(50);
      }
    }
  }

  /**
   * Move mouse to coordinates
   */
  async moveTo(x: number, y: number): Promise<void> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { mouse, Point } = this.nut;
    await mouse.move([new Point(x, y)]);
  }

  /**
   * Type text
   */
  async type(text: string, delay?: number): Promise<void> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { keyboard } = this.nut;

    if (delay) {
      keyboard.config.autoDelayMs = delay;
    }

    await keyboard.type(text);

    if (delay) {
      keyboard.config.autoDelayMs = this.config.keyDelay;
    }
  }

  /**
   * Press key or key combination
   */
  async press(key: string): Promise<void> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { keyboard, Key } = this.nut;

    // Parse key combination (e.g., "Control+a", "Meta+Shift+s")
    const parts = key.split('+');
    const keys: number[] = [];

    for (const part of parts) {
      const normalizedKey = this.normalizeKey(part.trim());
      const nutKey = Key[normalizedKey as keyof typeof Key];
      if (nutKey !== undefined) {
        keys.push(nutKey);
      }
    }

    if (keys.length === 0) {
      throw new Error(`Unknown key: ${key}`);
    }

    if (keys.length === 1) {
      await keyboard.pressKey(keys[0]);
      await keyboard.releaseKey(keys[0]);
    } else {
      // Hold modifiers, press main key, release all
      const modifiers = keys.slice(0, -1);
      const mainKey = keys[keys.length - 1];

      for (const mod of modifiers) {
        await keyboard.pressKey(mod);
      }
      await keyboard.pressKey(mainKey);
      await keyboard.releaseKey(mainKey);
      for (const mod of modifiers.reverse()) {
        await keyboard.releaseKey(mod);
      }
    }
  }

  /**
   * Scroll
   */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number): Promise<void> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { mouse } = this.nut;

    switch (direction) {
      case 'up':
        await mouse.scrollUp(amount);
        break;
      case 'down':
        await mouse.scrollDown(amount);
        break;
      case 'left':
        await mouse.scrollLeft(amount);
        break;
      case 'right':
        await mouse.scrollRight(amount);
        break;
    }
  }

  /**
   * Drag from one point to another
   */
  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { mouse, Point } = this.nut;

    await mouse.setPosition(new Point(fromX, fromY));
    await mouse.drag([new Point(toX, toY)]);
  }

  /**
   * Take screenshot and return base64
   */
  async screenshot(): Promise<string> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { screen } = this.nut;

    // Import Jimp dynamically
    const { Jimp } = await import('jimp');

    const capture = await screen.capture();
    const image = new Jimp({
      width: capture.width,
      height: capture.height,
      data: Buffer.from(capture.data),
    });

    const buffer = await image.getBuffer('image/jpeg', { quality: 75 });
    return buffer.toString('base64');
  }

  /**
   * Get screen size
   */
  async getScreenSize(): Promise<{ width: number; height: number }> {
    if (!this.isAvailable() || !this.nut) {
      throw new Error('NutJS not available');
    }

    const { screen } = this.nut;
    const size = await screen.size();
    return { width: size.width, height: size.height };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private normalizeKey(key: string): string {
    const lower = key.toLowerCase();
    if (KEY_MAP[lower]) {
      return KEY_MAP[lower];
    }

    // Single letter key
    if (key.length === 1) {
      return key.toUpperCase();
    }

    // Return as-is (capitalized)
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Type definitions for NutJS module
// ============================================================================

interface NutJSModule {
  mouse: {
    config: { mouseSpeed: number };
    setPosition: (point: NutPoint) => Promise<void>;
    move: (path: NutPoint[]) => Promise<void>;
    click: (button: number) => Promise<void>;
    drag: (path: NutPoint[]) => Promise<void>;
    scrollUp: (amount: number) => Promise<void>;
    scrollDown: (amount: number) => Promise<void>;
    scrollLeft: (amount: number) => Promise<void>;
    scrollRight: (amount: number) => Promise<void>;
  };
  keyboard: {
    config: { autoDelayMs: number };
    type: (text: string) => Promise<void>;
    pressKey: (key: number) => Promise<void>;
    releaseKey: (key: number) => Promise<void>;
  };
  screen: {
    capture: () => Promise<{ width: number; height: number; data: Uint8Array }>;
    size: () => Promise<{ width: number; height: number }>;
  };
  Button: {
    LEFT: number;
    RIGHT: number;
    MIDDLE: number;
  };
  Key: Record<string, number>;
  Point: new (x: number, y: number) => NutPoint;
}

interface NutPoint {
  x: number;
  y: number;
}
