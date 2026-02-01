import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// src/adapters/cdp-adapter.ts
var CDPAdapter = class {
  config;
  connected = false;
  refMap = /* @__PURE__ */ new Map();
  refCounter = 0;
  session;
  constructor(config) {
    this.config = {
      endpoint: config.endpoint,
      timeout: config.timeout || 3e4
    };
    this.session = `session_${Date.now()}`;
  }
  /**
   * Initialize adapter
   */
  async initialize() {
    try {
      execSync("agent-browser --version", { encoding: "utf-8", stdio: "pipe" });
    } catch {
      console.warn("[CDP Adapter] agent-browser not found. Install with: npm install -g agent-browser");
    }
  }
  /**
   * Cleanup adapter
   */
  async cleanup() {
    await this.disconnect();
  }
  /**
   * Check if available
   */
  isAvailable() {
    try {
      execSync("agent-browser --version", { encoding: "utf-8", stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Connect to the browser/app via CDP
   */
  async connect() {
    const endpoint = typeof this.config.endpoint === "number" ? String(this.config.endpoint) : this.config.endpoint;
    try {
      this.exec(["open", `--cdp=${endpoint}`]);
      this.connected = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect via CDP: ${message}`);
    }
  }
  /**
   * Disconnect from the browser/app
   */
  async disconnect() {
    if (!this.connected) return;
    try {
      this.exec(["close"]);
    } catch {
    }
    this.connected = false;
  }
  /**
   * Get accessibility snapshot with refs
   */
  async getSnapshot(options = {}) {
    this.ensureConnected();
    const args = ["snapshot"];
    if (options.interactive) args.push("-i");
    const result = this.execJson(args);
    const refs = {};
    if (result.refs) {
      for (const [key, value] of Object.entries(result.refs)) {
        refs[key] = {
          id: key,
          role: value.role,
          name: value.name,
          source: "dom"
        };
        this.refMap.set(key, refs[key]);
      }
    }
    let screenshot;
    if (options.includeScreenshot) {
      screenshot = await this.getScreenshotBase64();
    }
    return {
      tree: result.snapshot || "",
      refs,
      timestamp: Date.now(),
      screenshot
    };
  }
  /**
   * Find single element
   */
  async find(locator) {
    this.ensureConnected();
    try {
      const selector = this.locatorToSelector(locator);
      const result = this.execJson(["is", "visible", selector]);
      if (result.visible) {
        const refId = `cdp_${++this.refCounter}`;
        return {
          id: refId,
          role: "element",
          name: locator.value,
          source: "dom"
        };
      }
    } catch {
    }
    return null;
  }
  /**
   * Find all matching elements
   */
  async findAll(locator) {
    this.ensureConnected();
    try {
      const selector = this.locatorToSelector(locator);
      const result = this.execJson(["get", "count", selector]);
      const count = result.count || 0;
      return Array.from({ length: count }, (_, i) => ({
        id: `cdp_${++this.refCounter}`,
        role: "element",
        name: locator.value,
        nth: i,
        source: "dom"
      }));
    } catch {
      return [];
    }
  }
  /**
   * Click element
   */
  async click(element, options = {}) {
    this.ensureConnected();
    const selector = this.elementToSelector(element);
    const args = ["click", selector];
    if (options.count && options.count > 1) {
      this.exec(["dblclick", selector]);
    } else {
      this.exec(args);
    }
  }
  /**
   * Type text
   */
  async type(element, text, _options = {}) {
    this.ensureConnected();
    const selector = this.elementToSelector(element);
    const escapedText = text.replace(/"/g, '\\"');
    this.exec(["type", selector, `"${escapedText}"`]);
  }
  /**
   * Press key
   */
  async press(key) {
    this.ensureConnected();
    this.exec(["press", key]);
  }
  /**
   * Hover over element
   */
  async hover(element) {
    this.ensureConnected();
    const selector = this.elementToSelector(element);
    this.exec(["hover", selector]);
  }
  /**
   * Scroll
   */
  async scroll(options) {
    this.ensureConnected();
    const amount = options.amount || 100;
    this.exec(["scroll", options.direction, String(amount)]);
  }
  /**
   * Drag element
   */
  async drag(from, to) {
    this.ensureConnected();
    const fromSelector = this.elementToSelector(from);
    const toSelector = this.elementToSelector(to);
    this.exec(["drag", fromSelector, toSelector]);
  }
  /**
   * Get element text
   */
  async getText(element) {
    this.ensureConnected();
    const selector = this.elementToSelector(element);
    const result = this.execJson(["get", "text", selector]);
    return result.text || "";
  }
  /**
   * Get element value
   */
  async getValue(element) {
    this.ensureConnected();
    const selector = this.elementToSelector(element);
    const result = this.execJson(["get", "value", selector]);
    return result.value || "";
  }
  /**
   * Get element attribute
   */
  async getAttribute(element, attr) {
    this.ensureConnected();
    const selector = this.elementToSelector(element);
    const result = this.execJson(["get", "attr", selector, attr]);
    return result.value;
  }
  /**
   * Check if element is visible
   */
  async isVisible(element) {
    this.ensureConnected();
    try {
      const selector = this.elementToSelector(element);
      const result = this.execJson(["is", "visible", selector]);
      return result.visible;
    } catch {
      return false;
    }
  }
  /**
   * Check if element is enabled
   */
  async isEnabled(element) {
    this.ensureConnected();
    try {
      const selector = this.elementToSelector(element);
      const result = this.execJson(["is", "enabled", selector]);
      return result.enabled;
    } catch {
      return false;
    }
  }
  /**
   * Get current URL
   */
  async getUrl() {
    this.ensureConnected();
    const result = this.execJson(["get", "url"]);
    return result.url || "";
  }
  /**
   * Get page title
   */
  async getTitle() {
    this.ensureConnected();
    const result = this.execJson(["get", "title"]);
    return result.title || "";
  }
  /**
   * Evaluate JavaScript
   */
  async evaluate(script) {
    this.ensureConnected();
    const escapedScript = script.replace(/"/g, '\\"');
    const result = this.execJson(["eval", `"${escapedScript}"`]);
    return result.result;
  }
  /**
   * Take screenshot
   */
  async screenshot(screenshotPath, options = {}) {
    this.ensureConnected();
    const args = ["screenshot"];
    if (screenshotPath) args.push(screenshotPath);
    if (options.fullPage) args.push("--full");
    const result = this.execJson(args);
    return result.path;
  }
  /**
   * Get screenshot as base64
   */
  async getScreenshotBase64() {
    const tempPath = `/tmp/desktop-test-screenshot-${Date.now()}.jpg`;
    try {
      this.exec(["screenshot", tempPath]);
      const data = fs.readFileSync(tempPath);
      return data.toString("base64");
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
  /**
   * Start recording
   */
  async startRecording(recordingPath) {
    this.ensureConnected();
    this.exec(["record", "start", recordingPath]);
  }
  /**
   * Stop recording
   */
  async stopRecording() {
    this.ensureConnected();
    const result = this.execJson(["record", "stop"]);
    return { path: result.path || "" };
  }
  /**
   * Wait for page to be idle
   */
  async waitForIdle(timeout = 5e3) {
    this.ensureConnected();
    this.exec(["wait", "--load", "networkidle"], { timeout });
  }
  // ============================================================================
  // Private Helpers
  // ============================================================================
  ensureConnected() {
    if (!this.connected) {
      throw new Error("CDP adapter not connected");
    }
  }
  exec(args, options = {}) {
    const sessionArg = `--session=${this.session}`;
    const cmd = `agent-browser ${sessionArg} ${args.join(" ")}`.trim();
    try {
      return execSync(cmd, {
        encoding: "utf-8",
        timeout: options.timeout ?? this.config.timeout,
        stdio: ["pipe", "pipe", "pipe"]
      }).trim();
    } catch (err) {
      const error = err;
      const stderr = error.stderr?.toString() || "";
      const stdout = error.stdout?.toString() || "";
      throw new Error(`agent-browser command failed: ${cmd}
stderr: ${stderr}
stdout: ${stdout}`);
    }
  }
  execJson(args) {
    const result = this.exec([...args, "--json"]);
    try {
      const parsed = JSON.parse(result);
      if (!parsed.success && parsed.error) {
        throw new Error(parsed.error);
      }
      return parsed.data || parsed;
    } catch (err) {
      if (err instanceof Error && err.message.includes("agent-browser")) {
        throw err;
      }
      throw new Error(`JSON parse failed: ${result}`);
    }
  }
  locatorToSelector(locator) {
    switch (locator.strategy) {
      case "ref" /* REF */:
        return locator.value.startsWith("@") ? locator.value : `@${locator.value}`;
      case "css" /* CSS */:
        return locator.value;
      case "xpath" /* XPATH */:
        return `xpath=${locator.value}`;
      case "text" /* TEXT */:
        return `text=${locator.value}`;
      case "role" /* ROLE */:
        return `role=${locator.value}`;
      case "testid" /* TESTID */:
        return locator.value;
      default:
        return locator.value;
    }
  }
  elementToSelector(element) {
    if (element.id.startsWith("cdp_")) {
      return element.name || "";
    }
    return `@${element.id}`;
  }
};
var DEFAULT_CONFIG = {
  pythonPath: "python3",
  serverPath: "",
  port: 0,
  debug: false
};
var PythonBridge = class {
  config;
  process = null;
  available = false;
  requestId = 0;
  pendingRequests = /* @__PURE__ */ new Map();
  readline = null;
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!this.config.serverPath) {
      this.config.serverPath = path.resolve(
        __dirname,
        "../../../../app/tests/desktop/bridge_server.py"
      );
    }
  }
  /**
   * Initialize the Python bridge
   */
  async initialize() {
    try {
      this.process = spawn(this.config.pythonPath, [this.config.serverPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1"
        }
      });
      if (!this.process.stdout || !this.process.stdin) {
        throw new Error("Failed to create Python process streams");
      }
      this.readline = readline.createInterface({
        input: this.process.stdout,
        terminal: false
      });
      this.readline.on("line", (line) => {
        this.handleResponse(line);
      });
      this.process.stderr?.on("data", (data) => {
        if (this.config.debug) {
          console.error(`[Python Bridge stderr] ${data.toString()}`);
        }
      });
      this.process.on("exit", (code) => {
        this.available = false;
        if (this.config.debug) {
          console.log(`[Python Bridge] Process exited with code ${code}`);
        }
      });
      await this.waitForReady();
      this.available = true;
      if (this.config.debug) {
        console.log("[Python Bridge] Initialized successfully");
      }
    } catch (error) {
      this.available = false;
      throw error;
    }
  }
  /**
   * Cleanup the Python bridge
   */
  async cleanup() {
    if (this.process) {
      try {
        await this.call("shutdown");
      } catch {
      }
      this.process.kill();
      this.process = null;
    }
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
    this.available = false;
    this.pendingRequests.clear();
  }
  /**
   * Check if available
   */
  isAvailable() {
    return this.available && this.process !== null;
  }
  /**
   * Call a Python method
   */
  async call(method, args = []) {
    if (!this.isAvailable()) {
      throw new Error("Python bridge not available");
    }
    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params: args
    };
    return new Promise((resolve2, reject) => {
      this.pendingRequests.set(id, { resolve: resolve2, reject });
      this.process.stdin.write(JSON.stringify(request) + "\n");
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Python bridge timeout for method: ${method}`));
        }
      }, 3e4);
    });
  }
  /**
   * Take screenshot via Python
   */
  async screenshot() {
    return this.call("screenshot");
  }
  /**
   * Click at coordinates via Python
   */
  async click(x, y, button = "left") {
    await this.call("click", [x, y, button]);
  }
  /**
   * Type text via Python
   */
  async typeText(text) {
    await this.call("type_text", [text]);
  }
  /**
   * Press key via Python
   */
  async pressKey(key, modifiers = []) {
    await this.call("press_key", [key, modifiers]);
  }
  /**
   * Get accessibility tree via Python
   */
  async getAccessibilityTree() {
    return this.call("get_accessibility_tree");
  }
  /**
   * Analyze screenshot with VLM via Python
   */
  async analyzeVisual(screenshotBase64) {
    return this.call("analyze_visual", [screenshotBase64]);
  }
  // ============================================================================
  // Additional Desktop Control Methods
  // ============================================================================
  /**
   * Move mouse to coordinates
   */
  async moveMouse(x, y) {
    await this.call("move_mouse", [x, y]);
  }
  /**
   * Double click
   */
  async doubleClick(x, y) {
    await this.call("double_click", [x, y]);
  }
  /**
   * Right click
   */
  async rightClick(x, y) {
    await this.call("click", [x, y, "right"]);
  }
  /**
   * Drag from one point to another
   */
  async drag(fromX, fromY, toX, toY) {
    await this.call("drag", [fromX, fromY, toX, toY]);
  }
  /**
   * Scroll
   */
  async scroll(x, y, deltaX, deltaY) {
    await this.call("scroll", [x, y, deltaX, deltaY]);
  }
  /**
   * Find application window
   */
  async findApplication(appName) {
    return this.call("find_application", [appName]);
  }
  /**
   * Activate application window
   */
  async activateApplication(appName) {
    await this.call("activate_application", [appName]);
  }
  /**
   * Get screen size
   */
  async getScreenSize() {
    return this.call("get_screen_size");
  }
  /**
   * Find element by name
   */
  async findElementByName(name, elementType) {
    return this.call("find_element_by_name", [name, elementType]);
  }
  // ============================================================================
  // Private Methods
  // ============================================================================
  /**
   * Wait for Python process to be ready
   */
  async waitForReady() {
    return new Promise((resolve2, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Python bridge startup timeout"));
      }, 1e4);
      const handler = (line) => {
        try {
          const data = JSON.parse(line);
          if (data.status === "ready") {
            clearTimeout(timeout);
            this.readline?.off("line", handler);
            resolve2();
          }
        } catch {
        }
      };
      this.readline?.on("line", handler);
    });
  }
  /**
   * Handle response from Python process
   */
  handleResponse(line) {
    try {
      const response = JSON.parse(line);
      if (response.status) {
        return;
      }
      const { id, result, error } = response;
      if (id && this.pendingRequests.has(id)) {
        const { resolve: resolve2, reject } = this.pendingRequests.get(id);
        this.pendingRequests.delete(id);
        if (error) {
          reject(new Error(error.message || "Python bridge error"));
        } else {
          resolve2(result);
        }
      }
    } catch (e) {
      if (this.config.debug) {
        console.log(`[Python Bridge] Non-JSON output: ${line}`);
      }
    }
  }
};

// src/adapters/nutjs-adapter.ts
var KEY_MAP = {
  "ctrl": "LeftControl",
  "control": "LeftControl",
  "cmd": "LeftSuper",
  "command": "LeftSuper",
  "meta": "LeftSuper",
  "alt": "LeftAlt",
  "option": "LeftAlt",
  "shift": "LeftShift",
  "enter": "Return",
  "return": "Return",
  "esc": "Escape",
  "escape": "Escape",
  "backspace": "Backspace",
  "delete": "Delete",
  "tab": "Tab",
  "space": "Space",
  "up": "Up",
  "down": "Down",
  "left": "Left",
  "right": "Right",
  "home": "Home",
  "end": "End",
  "pageup": "PageUp",
  "pagedown": "PageDown",
  "insert": "Insert",
  "f1": "F1",
  "f2": "F2",
  "f3": "F3",
  "f4": "F4",
  "f5": "F5",
  "f6": "F6",
  "f7": "F7",
  "f8": "F8",
  "f9": "F9",
  "f10": "F10",
  "f11": "F11",
  "f12": "F12"
};
var NutJSAdapter = class {
  config;
  initialized = false;
  nut = null;
  constructor(config = {}) {
    this.config = {
      keyboard: config.keyboard ?? true,
      mouse: config.mouse ?? true,
      keyDelay: config.keyDelay ?? 50,
      mouseSpeed: config.mouseSpeed ?? 500
    };
  }
  /**
   * Initialize NutJS
   */
  async initialize() {
    if (this.initialized) return;
    try {
      let nutModule;
      try {
        nutModule = await import('@computer-use/nut-js');
      } catch {
        try {
          nutModule = await import('@nut-tree/nut-js');
        } catch {
          throw new Error("NutJS not installed. Run: npm install @nut-tree/nut-js");
        }
      }
      this.nut = nutModule;
      if (this.nut.keyboard) {
        this.nut.keyboard.config.autoDelayMs = this.config.keyDelay;
      }
      if (this.nut.mouse) {
        this.nut.mouse.config.mouseSpeed = this.config.mouseSpeed;
      }
      this.initialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[NutJS Adapter] Not available: ${message}`);
      this.initialized = false;
    }
  }
  /**
   * Cleanup
   */
  async cleanup() {
    this.initialized = false;
    this.nut = null;
  }
  /**
   * Check if NutJS is available
   */
  isAvailable() {
    return this.initialized && this.nut !== null;
  }
  /**
   * Click at coordinates
   */
  async click(x, y, button = "left", count = 1) {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { mouse, Button, Point } = this.nut;
    await mouse.setPosition(new Point(x, y));
    const mouseButton = button === "right" ? Button.RIGHT : button === "middle" ? Button.MIDDLE : Button.LEFT;
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
  async moveTo(x, y) {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { mouse, Point } = this.nut;
    await mouse.move([new Point(x, y)]);
  }
  /**
   * Type text
   */
  async type(text, delay) {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
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
  async press(key) {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { keyboard, Key } = this.nut;
    const parts = key.split("+");
    const keys = [];
    for (const part of parts) {
      const normalizedKey = this.normalizeKey(part.trim());
      const nutKey = Key[normalizedKey];
      if (nutKey !== void 0) {
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
  async scroll(direction, amount) {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { mouse } = this.nut;
    switch (direction) {
      case "up":
        await mouse.scrollUp(amount);
        break;
      case "down":
        await mouse.scrollDown(amount);
        break;
      case "left":
        await mouse.scrollLeft(amount);
        break;
      case "right":
        await mouse.scrollRight(amount);
        break;
    }
  }
  /**
   * Drag from one point to another
   */
  async drag(fromX, fromY, toX, toY) {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { mouse, Point } = this.nut;
    await mouse.setPosition(new Point(fromX, fromY));
    await mouse.drag([new Point(toX, toY)]);
  }
  /**
   * Take screenshot and return base64
   */
  async screenshot() {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { screen } = this.nut;
    const { Jimp } = await import('jimp');
    const capture = await screen.capture();
    const image = new Jimp({
      width: capture.width,
      height: capture.height,
      data: Buffer.from(capture.data)
    });
    const buffer = await image.getBuffer("image/jpeg", { quality: 75 });
    return buffer.toString("base64");
  }
  /**
   * Get screen size
   */
  async getScreenSize() {
    if (!this.isAvailable() || !this.nut) {
      throw new Error("NutJS not available");
    }
    const { screen } = this.nut;
    const size = await screen.size();
    return { width: size.width, height: size.height };
  }
  // ============================================================================
  // Private Helpers
  // ============================================================================
  normalizeKey(key) {
    const lower = key.toLowerCase();
    if (KEY_MAP[lower]) {
      return KEY_MAP[lower];
    }
    if (key.length === 1) {
      return key.toUpperCase();
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  sleep(ms) {
    return new Promise((resolve2) => setTimeout(resolve2, ms));
  }
};

export { CDPAdapter, NutJSAdapter, PythonBridge };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map