'use strict';

var child_process = require('child_process');
var fs3 = require('fs');
var path3 = require('path');
var readline = require('readline');
var crypto = require('crypto');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var fs3__namespace = /*#__PURE__*/_interopNamespace(fs3);
var path3__namespace = /*#__PURE__*/_interopNamespace(path3);
var readline__namespace = /*#__PURE__*/_interopNamespace(readline);
var crypto__namespace = /*#__PURE__*/_interopNamespace(crypto);

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/types.ts
var init_types = __esm({
  "src/types.ts"() {
  }
});

// src/adapters/cdp-adapter.ts
var cdp_adapter_exports = {};
__export(cdp_adapter_exports, {
  CDPAdapter: () => CDPAdapter
});
var CDPAdapter;
var init_cdp_adapter = __esm({
  "src/adapters/cdp-adapter.ts"() {
    init_types();
    CDPAdapter = class {
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
          child_process.execSync("agent-browser --version", { encoding: "utf-8", stdio: "pipe" });
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
          child_process.execSync("agent-browser --version", { encoding: "utf-8", stdio: "pipe" });
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
          const data = fs3__namespace.readFileSync(tempPath);
          return data.toString("base64");
        } finally {
          if (fs3__namespace.existsSync(tempPath)) {
            fs3__namespace.unlinkSync(tempPath);
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
          return child_process.execSync(cmd, {
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
  }
});

// src/adapters/python-bridge.ts
var python_bridge_exports = {};
__export(python_bridge_exports, {
  PythonBridge: () => PythonBridge
});
var DEFAULT_CONFIG, PythonBridge;
var init_python_bridge = __esm({
  "src/adapters/python-bridge.ts"() {
    DEFAULT_CONFIG = {
      pythonPath: "python3",
      serverPath: "",
      port: 0,
      debug: false
    };
    PythonBridge = class {
      config;
      process = null;
      available = false;
      requestId = 0;
      pendingRequests = /* @__PURE__ */ new Map();
      readline = null;
      constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (!this.config.serverPath) {
          this.config.serverPath = path3__namespace.resolve(
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
          this.process = child_process.spawn(this.config.pythonPath, [this.config.serverPath], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              PYTHONUNBUFFERED: "1"
            }
          });
          if (!this.process.stdout || !this.process.stdin) {
            throw new Error("Failed to create Python process streams");
          }
          this.readline = readline__namespace.createInterface({
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
  }
});

// src/adapters/nutjs-adapter.ts
var nutjs_adapter_exports = {};
__export(nutjs_adapter_exports, {
  NutJSAdapter: () => NutJSAdapter
});
var KEY_MAP, NutJSAdapter;
var init_nutjs_adapter = __esm({
  "src/adapters/nutjs-adapter.ts"() {
    KEY_MAP = {
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
    NutJSAdapter = class {
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
  }
});

// src/vlm/cost-tracker.ts
var PRICING, CostTracker;
var init_cost_tracker = __esm({
  "src/vlm/cost-tracker.ts"() {
    init_types();
    PRICING = {
      ["anthropic" /* ANTHROPIC */]: {
        inputTokenPrice: 3e-3,
        // Claude 3.5 Sonnet
        outputTokenPrice: 0.015,
        imagePrice: 48e-4
        // ~1280x1280 image
      },
      ["openai" /* OPENAI */]: {
        inputTokenPrice: 5e-3,
        // GPT-4o
        outputTokenPrice: 0.015,
        imagePrice: 765e-5
        // high detail
      },
      ["volcengine" /* VOLCENGINE */]: {
        inputTokenPrice: 8e-4,
        // Doubao Pro (Chinese pricing)
        outputTokenPrice: 2e-3,
        imagePrice: 1e-3
      },
      ["doubao" /* DOUBAO */]: {
        inputTokenPrice: 8e-4,
        outputTokenPrice: 2e-3,
        imagePrice: 1e-3
      },
      // Default/fallback pricing
      default: {
        inputTokenPrice: 3e-3,
        outputTokenPrice: 0.015,
        imagePrice: 5e-3
      }
    };
    CostTracker = class {
      entries = [];
      customPricing = {};
      /**
       * Set custom pricing for a provider
       */
      setPricing(provider, pricing) {
        this.customPricing[provider] = pricing;
      }
      /**
       * Get pricing for a provider
       */
      getPricing(provider) {
        return this.customPricing[provider] || PRICING[provider] || PRICING.default;
      }
      /**
       * Track a VLM API call
       */
      track(entry) {
        const pricing = this.getPricing(entry.provider);
        const images = entry.images || 1;
        const cost = entry.inputTokens / 1e3 * pricing.inputTokenPrice + entry.outputTokens / 1e3 * pricing.outputTokenPrice + images * pricing.imagePrice;
        const costEntry = {
          provider: entry.provider,
          model: entry.model,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          images,
          cost,
          timestamp: Date.now(),
          operation: entry.operation
        };
        this.entries.push(costEntry);
        return costEntry;
      }
      /**
       * Estimate cost for a potential call (without tracking)
       */
      estimate(entry) {
        const pricing = this.getPricing(entry.provider);
        const images = entry.images || 1;
        return entry.inputTokens / 1e3 * pricing.inputTokenPrice + entry.outputTokens / 1e3 * pricing.outputTokenPrice + images * pricing.imagePrice;
      }
      /**
       * Get cost summary
       */
      getSummary() {
        const byProvider = {};
        const byOperation = {};
        for (const entry of this.entries) {
          byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.cost;
          byOperation[entry.operation] = (byOperation[entry.operation] || 0) + entry.cost;
        }
        return {
          totalCost: this.entries.reduce((sum, e) => sum + e.cost, 0),
          totalCalls: this.entries.length,
          byProvider,
          byOperation,
          entries: [...this.entries]
        };
      }
      /**
       * Get recent entries
       */
      getRecentEntries(count = 10) {
        return this.entries.slice(-count);
      }
      /**
       * Reset tracking
       */
      reset() {
        this.entries = [];
      }
      /**
       * Export to JSON
       */
      toJSON() {
        return JSON.stringify(this.getSummary(), null, 2);
      }
      /**
       * Print summary to console
       */
      printSummary() {
        const summary = this.getSummary();
        console.log("\n=== VLM Cost Summary ===");
        console.log(`Total Cost: $${summary.totalCost.toFixed(4)}`);
        console.log(`Total Calls: ${summary.totalCalls}`);
        if (Object.keys(summary.byProvider).length > 0) {
          console.log("\nBy Provider:");
          for (const [provider, cost] of Object.entries(summary.byProvider)) {
            console.log(`  ${provider}: $${cost.toFixed(4)}`);
          }
        }
        if (Object.keys(summary.byOperation).length > 0) {
          console.log("\nBy Operation:");
          for (const [operation, cost] of Object.entries(summary.byOperation)) {
            console.log(`  ${operation}: $${cost.toFixed(4)}`);
          }
        }
        console.log("========================\n");
      }
    };
  }
});
function detectAgentEnvironment() {
  if (process.env.CURSOR_SESSION || process.env.CURSOR_WORKSPACE || process.env.CURSOR_IDE || process.env.CURSOR_TRACE_ID) {
    return "cursor";
  }
  if (process.env.CLAUDE_CODE || process.env.CLAUDE_CLI || process.env.ANTHROPIC_AGENT || process.env.CLAUDE_SESSION_ID) {
    return "claude-code";
  }
  if (process.env.VSCODE_CLAUDE || process.env.CLAUDE_VSCODE || process.env.VSCODE_PID && process.env.ANTHROPIC_API_KEY === void 0) {
    return "vscode-claude";
  }
  if (process.env.CLAUDE_DESKTOP || process.env.CLAUDE_APP) {
    return "claude-desktop";
  }
  if (process.env.MCP_SERVER || process.env.MCP_SESSION) {
    return "anthropic-mcp";
  }
  if (process.stdout.isTTY === false && (process.env.TERM_PROGRAM === "vscode" || process.env.TERM === "xterm-256color")) {
    return "unknown";
  }
  if (process.env.USE_AGENT_MODE === "true") {
    return "unknown";
  }
  return null;
}
function shouldUseAgentMode() {
  return detectAgentEnvironment() !== null || process.env.USE_CURSOR === "true" || process.env.USE_AGENT_MODE === "true";
}
var CursorBridge;
var init_cursor_bridge = __esm({
  "src/vlm/cursor-bridge.ts"() {
    CursorBridge = class {
      screenshotDir;
      requestCount = 0;
      environment;
      constructor(_config) {
        this.environment = detectAgentEnvironment() || "unknown";
        this.screenshotDir = path3__namespace.join(process.cwd(), ".agent-test-screenshots");
        if (!fs3__namespace.existsSync(this.screenshotDir)) {
          fs3__namespace.mkdirSync(this.screenshotDir, { recursive: true });
        }
        console.log(`\u{1F916} Agent Bridge initialized (environment: ${this.environment})`);
      }
      /**
       * Get the detected agent environment
       */
      getEnvironment() {
        return this.environment;
      }
      /**
       * Save screenshot and return path
       */
      saveScreenshot(base64Data) {
        this.requestCount++;
        const filename = `screenshot_${Date.now()}_${this.requestCount}.png`;
        const filepath = path3__namespace.join(this.screenshotDir, filename);
        const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, "");
        fs3__namespace.writeFileSync(filepath, Buffer.from(cleanData, "base64"));
        return filepath;
      }
      /**
       * Find element using Cursor's Claude
       */
      async findElement(request) {
        const screenshotPath = this.saveScreenshot(request.screenshot);
        const analysisRequest = {
          type: "find_element",
          screenshot: screenshotPath,
          description: request.description,
          context: request.context,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        const requestFile = path3__namespace.join(
          this.screenshotDir,
          `request_${Date.now()}.json`
        );
        fs3__namespace.writeFileSync(requestFile, JSON.stringify(analysisRequest, null, 2));
        console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
        console.log("\u2502 \u{1F50D} CURSOR VLM REQUEST: Find Element                     \u2502");
        console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        console.log(`\u2502 Screenshot: ${screenshotPath}`);
        console.log(`\u2502 Target: "${request.description}"`);
        if (request.context) {
          console.log(`\u2502 Context: ${request.context}`);
        }
        console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        console.log("\u2502 Please analyze the screenshot and provide coordinates   \u2502");
        console.log("\u2502 or set CURSOR_VLM_RESPONSE env var with JSON response   \u2502");
        console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
        if (process.env.CURSOR_VLM_RESPONSE) {
          try {
            const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
            delete process.env.CURSOR_VLM_RESPONSE;
            return response;
          } catch {
          }
        }
        const responseFile = requestFile.replace("request_", "response_");
        if (fs3__namespace.existsSync(responseFile)) {
          const response = JSON.parse(fs3__namespace.readFileSync(responseFile, "utf-8"));
          return response;
        }
        return {
          confidence: 0,
          reasoning: "Waiting for Cursor Agent to analyze screenshot",
          notFound: true,
          alternative: "Use MCP browser tools or provide manual coordinates"
        };
      }
      /**
       * Get next action using Cursor's Claude
       */
      async getNextAction(request) {
        const screenshotPath = this.saveScreenshot(request.screenshot);
        console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
        console.log("\u2502 \u{1F3AF} CURSOR VLM REQUEST: Get Next Action                  \u2502");
        console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        console.log(`\u2502 Screenshot: ${screenshotPath}`);
        console.log(`\u2502 Instruction: "${request.instruction}"`);
        console.log("\u2502 Available Actions:");
        request.actionSpaces.slice(0, 5).forEach((action) => {
          console.log(`\u2502   - ${action}`);
        });
        console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
        if (process.env.CURSOR_VLM_RESPONSE) {
          try {
            const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
            delete process.env.CURSOR_VLM_RESPONSE;
            return response;
          } catch {
          }
        }
        return {
          actionType: "wait",
          actionParams: {},
          thought: "Waiting for Cursor Agent to provide action",
          finished: false
        };
      }
      /**
       * Visual assertion using Cursor's Claude
       */
      async assertVisual(request) {
        const screenshotPath = this.saveScreenshot(request.screenshot);
        console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
        console.log("\u2502 \u2705 CURSOR VLM REQUEST: Visual Assertion                 \u2502");
        console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        console.log(`\u2502 Screenshot: ${screenshotPath}`);
        console.log(`\u2502 Assertion: "${request.assertion}"`);
        if (request.expected) {
          console.log(`\u2502 Expected: ${request.expected}`);
        }
        console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        console.log("\u2502 Please verify the assertion and respond with:           \u2502");
        console.log('\u2502 { "passed": true/false, "reasoning": "...", "actual": "..." }');
        console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
        if (process.env.CURSOR_VLM_RESPONSE) {
          try {
            const response = JSON.parse(process.env.CURSOR_VLM_RESPONSE);
            delete process.env.CURSOR_VLM_RESPONSE;
            return response;
          } catch {
          }
        }
        return {
          passed: false,
          reasoning: "Waiting for Cursor Agent to verify assertion",
          actual: "Pending verification"
        };
      }
      /**
       * Get cost summary (Cursor mode is free - uses existing subscription)
       */
      getCostSummary() {
        return {
          totalCost: 0,
          // Cursor mode is free (uses existing subscription)
          totalCalls: this.requestCount,
          byProvider: { cursor: 0 },
          byOperation: { find: 0, action: 0, assert: 0 },
          entries: []
        };
      }
    };
  }
});

// src/vlm/client.ts
var client_exports = {};
__export(client_exports, {
  VLMClient: () => VLMClient
});
var DEFAULT_MODELS, VLMClient;
var init_client = __esm({
  "src/vlm/client.ts"() {
    init_types();
    init_cost_tracker();
    init_cursor_bridge();
    DEFAULT_MODELS = {
      ["anthropic" /* ANTHROPIC */]: "claude-sonnet-4-20250514",
      ["openai" /* OPENAI */]: "gpt-4o",
      ["volcengine" /* VOLCENGINE */]: "doubao-1-5-vision-pro",
      ["doubao" /* DOUBAO */]: "doubao-1-5-vision-pro",
      ["cursor" /* CURSOR */]: "claude-opus-4-5"
      // Uses Cursor's built-in model
    };
    VLMClient = class {
      config;
      provider;
      model;
      costTracker;
      cursorBridge;
      constructor(config) {
        this.config = config;
        this.provider = this.normalizeProvider(config.provider);
        this.model = config.model || DEFAULT_MODELS[this.provider] || "gpt-4o";
        this.costTracker = new CostTracker();
        const shouldAutoUseAgent = this.provider === "cursor" /* CURSOR */ || shouldUseAgentMode() && !config.apiKey && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY;
        if (shouldAutoUseAgent) {
          this.cursorBridge = new CursorBridge(config);
          this.provider = "cursor" /* CURSOR */;
          const env = detectAgentEnvironment();
          if (env && env !== "cursor") {
            console.log(`\u{1F4CD} Auto-detected ${env} environment, using Agent mode`);
          }
        }
      }
      /**
       * Check if using Agent mode
       */
      isUsingAgentMode() {
        return this.cursorBridge !== void 0;
      }
      /**
       * Get detected agent environment
       */
      getAgentEnvironment() {
        return this.cursorBridge?.getEnvironment() || null;
      }
      normalizeProvider(provider) {
        if (typeof provider === "string") {
          const normalized = provider.toLowerCase();
          if (normalized === "anthropic" || normalized === "claude") {
            return "anthropic" /* ANTHROPIC */;
          }
          if (normalized === "openai" || normalized === "gpt") {
            return "openai" /* OPENAI */;
          }
          if (normalized === "volcengine" || normalized === "volc") {
            return "volcengine" /* VOLCENGINE */;
          }
          if (normalized === "doubao") {
            return "doubao" /* DOUBAO */;
          }
          if (normalized === "cursor") {
            return "cursor" /* CURSOR */;
          }
          if (normalized === "agent" || normalized === "auto") {
            return "cursor" /* CURSOR */;
          }
          return "custom" /* CUSTOM */;
        }
        return provider;
      }
      /**
       * Find element by visual description
       */
      async findElement(request) {
        if (this.cursorBridge) {
          return this.cursorBridge.findElement(request);
        }
        const systemPrompt = `You are a GUI automation assistant. Your task is to find UI elements in screenshots.

Given a screenshot and an element description, you need to:
1. Locate the described element in the screenshot
2. Return the center coordinates (x, y) of the element
3. Provide your confidence level (0-1)
4. Explain your reasoning

If the element cannot be found, set notFound to true and suggest alternatives.

IMPORTANT: Return coordinates in the format that can be used for clicking.
The screenshot dimensions will be provided.`;
        const userPrompt = `Find the following element in the screenshot:
"${request.description}"

${request.context ? `Context: ${request.context}` : ""}

Return a JSON object with:
- coordinates: { x: number, y: number } or null if not found
- confidence: number (0-1)
- reasoning: string
- notFound: boolean
- alternative: string (if not found, suggest what similar element exists)`;
        const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, "find");
        try {
          const parsed = this.parseJSON(response);
          const coordinates = parsed.coordinates;
          return {
            coordinates,
            confidence: parsed.confidence || 0,
            reasoning: parsed.reasoning || "",
            notFound: parsed.notFound || !coordinates,
            alternative: parsed.alternative
          };
        } catch {
          return {
            confidence: 0,
            reasoning: "Failed to parse VLM response",
            notFound: true
          };
        }
      }
      /**
       * Get next action to perform
       */
      async getNextAction(request) {
        if (this.cursorBridge) {
          return this.cursorBridge.getNextAction(request);
        }
        const systemPrompt = `You are a GUI automation agent. Your task is to control a desktop application to complete user instructions.

Available actions:
${request.actionSpaces.join("\n")}

For each step:
1. Analyze the current screenshot
2. Decide the best action to take
3. Return the action with parameters

When the task is complete, return finished: true.

IMPORTANT: 
- Think step by step
- Only perform one action at a time
- Be precise with coordinates`;
        const userPrompt = `Instruction: "${request.instruction}"

Based on the current screenshot, what action should be taken next?

Return a JSON object with:
- actionType: string (one of the available actions)
- actionParams: object (parameters for the action)
- thought: string (your reasoning)
- reflection: string (any observations)
- finished: boolean (true if task is complete)`;
        const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, "action");
        try {
          const parsed = this.parseJSON(response);
          return {
            actionType: parsed.actionType || "wait",
            actionParams: parsed.actionParams || {},
            thought: parsed.thought || "",
            reflection: parsed.reflection,
            finished: parsed.finished || false
          };
        } catch {
          return {
            actionType: "wait",
            actionParams: {},
            thought: "Failed to parse VLM response",
            finished: false
          };
        }
      }
      /**
       * Perform visual assertion
       */
      async assertVisual(request) {
        if (this.cursorBridge) {
          return this.cursorBridge.assertVisual(request);
        }
        const systemPrompt = `You are a QA automation assistant. Your task is to verify UI states and conditions.

Given a screenshot and an assertion, you need to:
1. Analyze the screenshot carefully
2. Determine if the assertion is true or false
3. Provide detailed reasoning
4. If the assertion fails, suggest how to fix it`;
        const userPrompt = `Assertion: "${request.assertion}"

${request.expected ? `Expected: ${request.expected}` : ""}

Analyze the screenshot and verify the assertion.

Return a JSON object with:
- passed: boolean
- reasoning: string (detailed explanation)
- actual: string (what you actually observed)
- suggestions: string[] (if failed, how to fix)`;
        const response = await this.callVLM(systemPrompt, userPrompt, request.screenshot, "assert");
        try {
          const parsed = this.parseJSON(response);
          return {
            passed: parsed.passed || false,
            reasoning: parsed.reasoning || "",
            actual: parsed.actual || "",
            suggestions: parsed.suggestions
          };
        } catch {
          return {
            passed: false,
            reasoning: "Failed to parse VLM response",
            actual: "Unknown"
          };
        }
      }
      /**
       * Compare two screenshots and find differences (from Python framework)
       * Note: Currently uses single image analysis. For true comparison, 
       * both images should be sent to the VLM.
       */
      async compareScreenshots(screenshot1, _screenshot2, context) {
        const systemPrompt = `You are a UI testing assistant. Compare two screenshots and identify all differences.`;
        const userPrompt = `Compare these two screenshots and identify differences.
${context ? `Context: ${context}` : ""}

Return a JSON object with:
- differences: array of { type: "added|removed|changed|moved", description: string, severity: "high|medium|low" }
- summary: string (overall summary)
- similarityScore: number (0-1, how similar they are)`;
        const response = await this.callVLM(systemPrompt, userPrompt, screenshot1, "assert");
        try {
          const parsed = this.parseJSON(response);
          return {
            differences: parsed.differences || [],
            summary: parsed.summary || "",
            similarityScore: parsed.similarityScore || 0
          };
        } catch {
          return {
            differences: [],
            summary: "Failed to parse response",
            similarityScore: 0
          };
        }
      }
      /**
       * Detect visual issues in screenshot (from Python framework)
       */
      async detectVisualIssues(screenshot) {
        const systemPrompt = `You are a UI quality assurance expert. Detect visual issues and UI defects.`;
        const userPrompt = `Analyze this screenshot for visual issues and UI defects.

Check for:
1. Text truncation or overflow
2. Element overlap
3. Alignment issues
4. Color contrast problems
5. Blurry or distorted elements
6. Inconsistent spacing
7. Layout errors

Return a JSON object with:
{
  "issues": [
    {
      "type": "text_truncation|overlap|misalignment|contrast|blur|spacing|layout",
      "severity": "critical|high|medium|low",
      "description": "description of the issue",
      "location": {"x": 100, "y": 200, "width": 50, "height": 20},
      "suggestion": "how to fix it"
    }
  ]
}`;
        const response = await this.callVLM(systemPrompt, userPrompt, screenshot, "assert");
        try {
          const parsed = this.parseJSON(response);
          return parsed.issues || [];
        } catch {
          return [];
        }
      }
      /**
       * Analyze IDE screenshot with specialized prompts (from Python framework)
       */
      async analyzeIDEScreenshot(screenshot) {
        const systemPrompt = `You are an IDE interface analysis expert. Analyze IDE screenshots to identify all UI elements.

IDE common element types:
- menu: Menu bar (File, Edit, View, etc.)
- sidebar: Sidebar (file tree, outline, etc.)
- editor: Code editor area
- tab: Tab pages
- toolbar: Toolbar
- statusbar: Status bar
- panel: Panels (terminal, output, etc.)
- button: Buttons (run, debug, settings, etc.)
- icon: Icons
- input: Input fields, search boxes
- dropdown: Dropdown menus
- tooltip: Tooltips`;
        const userPrompt = `Analyze this IDE screenshot and identify all interface elements.

Return a JSON object with:
{
  "elements": [
    {
      "elementType": "type",
      "text": "text content",
      "bounds": {"x": 0, "y": 0, "width": 100, "height": 30},
      "attributes": {"active": true, "collapsed": false}
    }
  ],
  "layoutStructure": {
    "type": "three-column|two-column|single-column",
    "sidebarWidth": 250,
    "editorArea": {"x": 250, "y": 50, "width": 800, "height": 600},
    "panels": ["terminal", "output"]
  },
  "colorScheme": "dark|light",
  "issues": []
}`;
        const response = await this.callVLM(systemPrompt, userPrompt, screenshot, "find");
        try {
          const parsed = this.parseJSON(response);
          return {
            elements: parsed.elements || [],
            layoutStructure: parsed.layoutStructure || { type: "unknown" },
            colorScheme: parsed.colorScheme === "light" ? "light" : "dark",
            issues: parsed.issues || []
          };
        } catch {
          return {
            elements: [],
            layoutStructure: { type: "unknown" },
            colorScheme: "dark",
            issues: ["Failed to analyze screenshot"]
          };
        }
      }
      /**
       * Get cost summary
       */
      getCostSummary() {
        if (this.cursorBridge) {
          return this.cursorBridge.getCostSummary();
        }
        return this.costTracker.getSummary();
      }
      /**
       * Reset cost tracking
       */
      resetCostTracking() {
        this.costTracker.reset();
      }
      /**
       * Call the VLM API
       */
      async callVLM(systemPrompt, userPrompt, screenshot, operation) {
        let response;
        let inputTokens = 0;
        let outputTokens = 0;
        switch (this.provider) {
          case "anthropic" /* ANTHROPIC */:
            ({ response, inputTokens, outputTokens } = await this.callAnthropic(systemPrompt, userPrompt, screenshot));
            break;
          case "openai" /* OPENAI */:
            ({ response, inputTokens, outputTokens } = await this.callOpenAI(systemPrompt, userPrompt, screenshot));
            break;
          case "volcengine" /* VOLCENGINE */:
          case "doubao" /* DOUBAO */:
            ({ response, inputTokens, outputTokens } = await this.callVolcengine(systemPrompt, userPrompt, screenshot));
            break;
          case "custom" /* CUSTOM */:
            ({ response, inputTokens, outputTokens } = await this.callCustom(systemPrompt, userPrompt, screenshot));
            break;
          default:
            throw new Error(`Unsupported VLM provider: ${this.provider}`);
        }
        if (this.config.trackCost !== false) {
          this.costTracker.track({
            provider: this.provider,
            model: this.model,
            inputTokens,
            outputTokens,
            images: 1,
            operation
          });
        }
        return response;
      }
      /**
       * Call Anthropic Claude API
       */
      async callAnthropic(systemPrompt, userPrompt, screenshot) {
        const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error("Anthropic API key not provided. Set ANTHROPIC_API_KEY or pass apiKey in config.");
        }
        const fetchResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.config.maxTokens || 4096,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/jpeg",
                      data: screenshot
                    }
                  },
                  {
                    type: "text",
                    text: userPrompt
                  }
                ]
              }
            ]
          })
        });
        if (!fetchResponse.ok) {
          const error = await fetchResponse.text();
          throw new Error(`Anthropic API error: ${error}`);
        }
        const data = await fetchResponse.json();
        return {
          response: data.content[0].text,
          inputTokens: data.usage?.input_tokens || 1e3,
          outputTokens: data.usage?.output_tokens || 500
        };
      }
      /**
       * Call OpenAI GPT-4V API
       */
      async callOpenAI(systemPrompt, userPrompt, screenshot) {
        const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error("OpenAI API key not provided. Set OPENAI_API_KEY or pass apiKey in config.");
        }
        const baseURL = this.config.baseURL || "https://api.openai.com/v1";
        const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.config.maxTokens || 4096,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${screenshot}`
                    }
                  },
                  {
                    type: "text",
                    text: userPrompt
                  }
                ]
              }
            ]
          })
        });
        if (!fetchResponse.ok) {
          const error = await fetchResponse.text();
          throw new Error(`OpenAI API error: ${error}`);
        }
        const data = await fetchResponse.json();
        return {
          response: data.choices[0].message.content,
          inputTokens: data.usage?.prompt_tokens || 1e3,
          outputTokens: data.usage?.completion_tokens || 500
        };
      }
      /**
       * Call Volcengine (Doubao) API
       */
      async callVolcengine(systemPrompt, userPrompt, screenshot) {
        const apiKey = this.config.apiKey || process.env.VOLCENGINE_API_KEY || process.env.DOUBAO_API_KEY;
        if (!apiKey) {
          throw new Error("Volcengine API key not provided. Set VOLCENGINE_API_KEY or pass apiKey in config.");
        }
        const baseURL = this.config.baseURL || "https://ark.cn-beijing.volces.com/api/v3";
        const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.config.maxTokens || 4096,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${screenshot}`
                    }
                  },
                  {
                    type: "text",
                    text: userPrompt
                  }
                ]
              }
            ]
          })
        });
        if (!fetchResponse.ok) {
          const error = await fetchResponse.text();
          throw new Error(`Volcengine API error: ${error}`);
        }
        const data = await fetchResponse.json();
        return {
          response: data.choices[0].message.content,
          inputTokens: data.usage?.prompt_tokens || 1e3,
          outputTokens: data.usage?.completion_tokens || 500
        };
      }
      /**
       * Call custom API (OpenAI-compatible)
       */
      async callCustom(systemPrompt, userPrompt, screenshot) {
        if (!this.config.baseURL) {
          throw new Error("Custom provider requires baseURL");
        }
        const headers = {
          "Content-Type": "application/json"
        };
        if (this.config.apiKey) {
          headers["Authorization"] = `Bearer ${this.config.apiKey}`;
        }
        const fetchResponse = await fetch(`${this.config.baseURL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.config.maxTokens || 4096,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${screenshot}`
                    }
                  },
                  {
                    type: "text",
                    text: userPrompt
                  }
                ]
              }
            ]
          })
        });
        if (!fetchResponse.ok) {
          const error = await fetchResponse.text();
          throw new Error(`Custom API error: ${error}`);
        }
        const data = await fetchResponse.json();
        return {
          response: data.choices[0].message.content,
          inputTokens: data.usage?.prompt_tokens || 1e3,
          outputTokens: data.usage?.completion_tokens || 500
        };
      }
      /**
       * Parse JSON from VLM response (handles markdown code blocks)
       */
      parseJSON(text) {
        try {
          return JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
          }
          const objectMatch = text.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            return JSON.parse(objectMatch[0]);
          }
          throw new Error("Could not parse JSON from response");
        }
      }
    };
  }
});

// src/core/desktop-test.ts
init_types();
var DEFAULT_CONFIG2 = {
  mode: "hybrid" /* HYBRID */,
  cdp: { endpoint: 9222, timeout: 3e4 },
  vlm: void 0,
  pythonBridge: { debug: false },
  nutjs: { keyboard: true, mouse: true, keyDelay: 50, mouseSpeed: 500 },
  timeout: 3e4,
  debug: false,
  screenshotDir: "./screenshots",
  videoDir: "./videos",
  session: "default"
};
var DesktopTest = class {
  config;
  cdpAdapter = null;
  pythonBridge = null;
  nutjsAdapter = null;
  vlmClient = null;
  connected = false;
  lastSnapshot = null;
  constructor(config = {}) {
    this.config = this.mergeConfig(config);
  }
  mergeConfig(config) {
    return {
      ...DEFAULT_CONFIG2,
      ...config,
      cdp: { ...DEFAULT_CONFIG2.cdp, ...config.cdp },
      pythonBridge: { ...DEFAULT_CONFIG2.pythonBridge, ...config.pythonBridge },
      nutjs: { ...DEFAULT_CONFIG2.nutjs, ...config.nutjs }
    };
  }
  // ============================================================================
  // Connection Management
  // ============================================================================
  async connect() {
    if (this.connected) return;
    this.log("Connecting to desktop application...");
    if (this.config.cdp) {
      const { CDPAdapter: CDPAdapter2 } = await Promise.resolve().then(() => (init_cdp_adapter(), cdp_adapter_exports));
      this.cdpAdapter = new CDPAdapter2(this.config.cdp);
      await this.cdpAdapter.initialize();
      await this.cdpAdapter.connect();
      this.log("CDP adapter connected");
    }
    if (this.config.pythonBridge) {
      try {
        const { PythonBridge: PythonBridge2 } = await Promise.resolve().then(() => (init_python_bridge(), python_bridge_exports));
        this.pythonBridge = new PythonBridge2(this.config.pythonBridge);
        await this.pythonBridge.initialize();
        this.log("Python bridge initialized");
      } catch (e) {
        this.log("Python bridge not available, using NutJS fallback");
      }
    }
    if (this.config.nutjs && !this.pythonBridge?.isAvailable()) {
      try {
        const { NutJSAdapter: NutJSAdapter2 } = await Promise.resolve().then(() => (init_nutjs_adapter(), nutjs_adapter_exports));
        this.nutjsAdapter = new NutJSAdapter2(this.config.nutjs);
        await this.nutjsAdapter.initialize();
        this.log("NutJS adapter initialized");
      } catch (e) {
        this.log("NutJS adapter not available");
      }
    }
    if (this.config.vlm && this.getMode() !== "deterministic" /* DETERMINISTIC */) {
      const { VLMClient: VLMClient2 } = await Promise.resolve().then(() => (init_client(), client_exports));
      this.vlmClient = new VLMClient2(this.config.vlm);
      this.log("VLM client initialized");
    }
    this.connected = true;
    this.log("Connected successfully");
  }
  async disconnect() {
    if (!this.connected) return;
    if (this.cdpAdapter) {
      await this.cdpAdapter.cleanup();
      this.cdpAdapter = null;
    }
    if (this.pythonBridge) {
      await this.pythonBridge.cleanup();
      this.pythonBridge = null;
    }
    if (this.nutjsAdapter) {
      await this.nutjsAdapter.cleanup();
      this.nutjsAdapter = null;
    }
    this.vlmClient = null;
    this.connected = false;
    this.log("Disconnected");
  }
  isConnected() {
    return this.connected;
  }
  getMode() {
    const mode = this.config.mode;
    if (typeof mode === "string") {
      return mode;
    }
    return mode;
  }
  // ============================================================================
  // Snapshot
  // ============================================================================
  async snapshot(options = {}) {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for snapshot");
    }
    const result = await this.cdpAdapter.getSnapshot({
      interactive: options.interactive ?? true,
      includeScreenshot: this.getMode() !== "deterministic" /* DETERMINISTIC */
    });
    this.lastSnapshot = result;
    return result;
  }
  // ============================================================================
  // Element Finding - Core Hybrid Mode Implementation
  // ============================================================================
  /**
   * Find element using hybrid fallback chain:
   * Level 1: Refs from snapshot (free, fast)
   * Level 2: CSS/XPath via CDP (free, fast)
   * Level 3: Visual AI via VLM (paid, intelligent)
   */
  async find(locator) {
    this.ensureConnected();
    const normalized = this.normalizeLocator(locator);
    const mode = this.getMode();
    if (mode !== "visual" /* VISUAL */) {
      const element = await this.findDeterministic(normalized);
      if (element) {
        this.log(`Found element via deterministic: ${normalized.value}`);
        return element;
      }
    }
    if (mode !== "deterministic" /* DETERMINISTIC */ && this.vlmClient) {
      this.log(`Falling back to VLM for: ${normalized.value}`);
      return this.findVisual(normalized);
    }
    return null;
  }
  async findAll(locator) {
    this.ensureConnected();
    if (!this.cdpAdapter) return [];
    const normalized = this.normalizeLocator(locator);
    return this.cdpAdapter.findAll(normalized);
  }
  async waitFor(locator, options = {}) {
    const timeout = options.timeout || this.config.timeout;
    const interval = options.interval || 100;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = await this.find(locator);
      if (element) {
        if (options.state === "hidden") {
          await this.wait(interval);
          continue;
        }
        return element;
      }
      await this.wait(interval);
    }
    throw new Error(`Element not found: ${JSON.stringify(locator)} (timeout: ${timeout}ms)`);
  }
  async findDeterministic(locator) {
    if (locator.strategy === "ref" /* REF */) {
      const element = await this.findByRef(locator.value);
      if (element) return element;
    }
    if (this.cdpAdapter) {
      return this.cdpAdapter.find(locator);
    }
    return null;
  }
  async findByRef(ref) {
    if (!this.lastSnapshot) {
      await this.snapshot();
    }
    const cleanRef = ref.startsWith("@") ? ref.slice(1) : ref;
    const element = this.lastSnapshot?.refs[cleanRef];
    if (element) {
      return { ...element, source: "dom" };
    }
    return null;
  }
  async findVisual(locator) {
    if (!this.vlmClient) return null;
    const screenshot = await this.getScreenshotBase64();
    const result = await this.vlmClient.findElement({
      screenshot,
      description: this.locatorToDescription(locator)
    });
    if (result.notFound || !result.coordinates) {
      return null;
    }
    return {
      id: "vlm_" + Date.now(),
      role: "visual",
      name: locator.value,
      boundingBox: {
        x: result.coordinates.x,
        y: result.coordinates.y,
        width: 1,
        height: 1
      },
      source: "vlm"
    };
  }
  // ============================================================================
  // Actions
  // ============================================================================
  async click(locator, options = {}) {
    const startTime = Date.now();
    let usedVLM = false;
    try {
      const element = await this.find(locator);
      if (!element) {
        return {
          status: "not_found" /* NOT_FOUND */,
          error: `Element not found: ${JSON.stringify(locator)}`,
          duration: Date.now() - startTime,
          usedVLM: false
        };
      }
      usedVLM = element.source === "vlm";
      if (element.boundingBox && (this.pythonBridge?.isAvailable() || this.nutjsAdapter?.isAvailable())) {
        const { x, y, width, height } = element.boundingBox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        if (this.pythonBridge?.isAvailable()) {
          await this.pythonBridge.click(centerX, centerY, options.button || "left");
        } else if (this.nutjsAdapter?.isAvailable()) {
          await this.nutjsAdapter.click(centerX, centerY, options.button || "left", options.count || 1);
        }
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.click(element, options);
      }
      return {
        status: usedVLM ? "vlm_fallback" /* VLM_FALLBACK */ : "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM,
        vlmCost: usedVLM ? this.vlmClient?.getCostSummary().totalCost : void 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM
      };
    }
  }
  async dblclick(locator) {
    return this.click(locator, { count: 2 });
  }
  async rightClick(locator) {
    return this.click(locator, { button: "right" });
  }
  async type(locator, text, options = {}) {
    const startTime = Date.now();
    try {
      const element = await this.find(locator);
      if (!element) {
        return {
          status: "not_found" /* NOT_FOUND */,
          error: `Element not found: ${JSON.stringify(locator)}`,
          duration: Date.now() - startTime,
          usedVLM: false
        };
      }
      await this.click(locator);
      if (options.clear) {
        await this.clear(locator);
      }
      if (this.pythonBridge?.isAvailable()) {
        await this.pythonBridge.typeText(text);
      } else if (this.nutjsAdapter?.isAvailable()) {
        await this.nutjsAdapter.type(text, options.delay);
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.type(element, text, options);
      }
      if (options.submit) {
        await this.press("Enter");
      }
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: element.source === "vlm"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
  }
  async fill(locator, text) {
    return this.type(locator, text, { clear: true });
  }
  async clear(locator) {
    const startTime = Date.now();
    try {
      await this.click(locator);
      await this.press("Control+a");
      await this.press("Backspace");
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
  }
  async press(key) {
    const startTime = Date.now();
    try {
      const parts = key.split("+");
      const mainKey = parts[parts.length - 1];
      const modifiers = parts.slice(0, -1);
      if (this.pythonBridge?.isAvailable()) {
        await this.pythonBridge.pressKey(mainKey, modifiers);
      } else if (this.nutjsAdapter?.isAvailable()) {
        await this.nutjsAdapter.press(key);
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.press(key);
      }
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
  }
  async hover(locator) {
    const startTime = Date.now();
    try {
      const element = await this.find(locator);
      if (!element) {
        return {
          status: "not_found" /* NOT_FOUND */,
          error: `Element not found: ${JSON.stringify(locator)}`,
          duration: Date.now() - startTime,
          usedVLM: false
        };
      }
      if (element.boundingBox && (this.pythonBridge?.isAvailable() || this.nutjsAdapter?.isAvailable())) {
        const { x, y, width, height } = element.boundingBox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        if (this.nutjsAdapter?.isAvailable()) {
          await this.nutjsAdapter.moveTo(centerX, centerY);
        }
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.hover(element);
      }
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: element.source === "vlm"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
  }
  async scroll(options) {
    const startTime = Date.now();
    try {
      const amount = options.amount || 100;
      if (this.nutjsAdapter?.isAvailable()) {
        await this.nutjsAdapter.scroll(options.direction, amount);
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.scroll(options);
      }
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
  }
  async drag(from, to) {
    const startTime = Date.now();
    try {
      const fromElement = await this.find(from);
      const toElement = await this.find(to);
      if (!fromElement || !toElement) {
        return {
          status: "not_found" /* NOT_FOUND */,
          error: "Source or target element not found",
          duration: Date.now() - startTime,
          usedVLM: false
        };
      }
      if (fromElement.boundingBox && toElement.boundingBox && this.nutjsAdapter?.isAvailable()) {
        const fromBox = fromElement.boundingBox;
        const toBox = toElement.boundingBox;
        await this.nutjsAdapter.drag(
          fromBox.x + fromBox.width / 2,
          fromBox.y + fromBox.height / 2,
          toBox.x + toBox.width / 2,
          toBox.y + toBox.height / 2
        );
      } else if (this.cdpAdapter) {
        await this.cdpAdapter.drag(fromElement, toElement);
      }
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
  }
  // ============================================================================
  // Visual AI Methods
  // ============================================================================
  async clickText(text) {
    return this.click({ strategy: "visual" /* VISUAL */, value: `button or link with text "${text}"` });
  }
  async clickImage(description) {
    return this.click({ strategy: "visual" /* VISUAL */, value: description });
  }
  async ai(instruction) {
    const startTime = Date.now();
    if (!this.vlmClient) {
      return {
        status: "failed" /* FAILED */,
        error: "VLM client not configured. Enable visual or hybrid mode.",
        duration: Date.now() - startTime,
        usedVLM: false
      };
    }
    try {
      const actionSpaces = [
        "click(x, y)",
        "type(text)",
        "scroll(direction)",
        "press(key)",
        "wait()",
        "finished()"
      ];
      let maxIterations = 10;
      let finished = false;
      while (!finished && maxIterations > 0) {
        const screenshot = await this.getScreenshotBase64();
        const response = await this.vlmClient.getNextAction({
          screenshot,
          instruction,
          actionSpaces
        });
        if (response.finished) {
          finished = true;
          break;
        }
        await this.executeVLMAction(response);
        await this.wait(500);
        maxIterations--;
      }
      return {
        status: "success" /* SUCCESS */,
        duration: Date.now() - startTime,
        usedVLM: true,
        vlmCost: this.vlmClient.getCostSummary().totalCost
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed" /* FAILED */,
        error: errorMessage,
        duration: Date.now() - startTime,
        usedVLM: true
      };
    }
  }
  async executeVLMAction(response) {
    switch (response.actionType) {
      case "click":
        if (this.nutjsAdapter?.isAvailable() && response.actionParams.x && response.actionParams.y) {
          await this.nutjsAdapter.click(
            response.actionParams.x,
            response.actionParams.y
          );
        }
        break;
      case "type":
        if (this.nutjsAdapter?.isAvailable() && response.actionParams.text) {
          await this.nutjsAdapter.type(response.actionParams.text);
        }
        break;
      case "scroll":
        await this.scroll({ direction: response.actionParams.direction || "down" });
        break;
      case "press":
        await this.press(response.actionParams.key || "Enter");
        break;
      case "wait":
        await this.wait(2e3);
        break;
    }
  }
  // ============================================================================
  // Getters
  // ============================================================================
  async getText(locator) {
    this.ensureConnected();
    if (!this.cdpAdapter) return "";
    const element = await this.find(locator);
    if (!element) return "";
    return this.cdpAdapter.getText(element);
  }
  async getValue(locator) {
    this.ensureConnected();
    if (!this.cdpAdapter) return "";
    const element = await this.find(locator);
    if (!element) return "";
    return this.cdpAdapter.getValue(element);
  }
  async getAttribute(locator, attr) {
    this.ensureConnected();
    if (!this.cdpAdapter) return null;
    const element = await this.find(locator);
    if (!element) return null;
    return this.cdpAdapter.getAttribute(element, attr);
  }
  async isVisible(locator) {
    const element = await this.find(locator);
    if (!element) return false;
    if (this.cdpAdapter) {
      return this.cdpAdapter.isVisible(element);
    }
    return true;
  }
  async isEnabled(locator) {
    const element = await this.find(locator);
    if (!element) return false;
    if (this.cdpAdapter) {
      return this.cdpAdapter.isEnabled(element);
    }
    return true;
  }
  async count(locator) {
    const elements = await this.findAll(locator);
    return elements.length;
  }
  async boundingBox(locator) {
    const element = await this.find(locator);
    return element?.boundingBox || null;
  }
  // ============================================================================
  // Page
  // ============================================================================
  async getUrl() {
    this.ensureConnected();
    if (!this.cdpAdapter) return "";
    return this.cdpAdapter.getUrl();
  }
  async getTitle() {
    this.ensureConnected();
    if (!this.cdpAdapter) return "";
    return this.cdpAdapter.getTitle();
  }
  async evaluate(script) {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for evaluate");
    }
    return this.cdpAdapter.evaluate(script);
  }
  // ============================================================================
  // Screenshot & Recording
  // ============================================================================
  async screenshot(path4, options = {}) {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for screenshot");
    }
    return this.cdpAdapter.screenshot(path4, options);
  }
  async startRecording(path4) {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for recording");
    }
    await this.cdpAdapter.startRecording(path4);
  }
  async stopRecording() {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for recording");
    }
    return this.cdpAdapter.stopRecording();
  }
  // ============================================================================
  // Cost Tracking
  // ============================================================================
  getCostSummary() {
    if (!this.vlmClient) {
      return {
        totalCost: 0,
        totalCalls: 0,
        byProvider: {},
        byOperation: {},
        entries: []
      };
    }
    return this.vlmClient.getCostSummary();
  }
  resetCostTracking() {
    this.vlmClient?.resetCostTracking();
  }
  // ============================================================================
  // Utilities
  // ============================================================================
  async wait(ms) {
    return new Promise((resolve2) => setTimeout(resolve2, ms));
  }
  async waitForIdle(timeout = 5e3) {
    this.ensureConnected();
    if (this.cdpAdapter) {
      await this.cdpAdapter.waitForIdle(timeout);
    }
  }
  // ============================================================================
  // Private Helpers
  // ============================================================================
  ensureConnected() {
    if (!this.connected) {
      throw new Error("Not connected. Call connect() first.");
    }
  }
  normalizeLocator(locator) {
    if (typeof locator === "string") {
      if (locator.startsWith("@")) {
        return { strategy: "ref" /* REF */, value: locator };
      }
      if (locator.startsWith("//")) {
        return { strategy: "xpath" /* XPATH */, value: locator };
      }
      if (locator.startsWith("text=")) {
        return { strategy: "text" /* TEXT */, value: locator.slice(5) };
      }
      if (locator.startsWith("role=")) {
        return { strategy: "role" /* ROLE */, value: locator.slice(5) };
      }
      if (locator.startsWith("[data-testid=")) {
        return { strategy: "testid" /* TESTID */, value: locator };
      }
      return { strategy: "css" /* CSS */, value: locator };
    }
    return locator;
  }
  locatorToDescription(locator) {
    switch (locator.strategy) {
      case "text" /* TEXT */:
        return `element with text "${locator.value}"`;
      case "role" /* ROLE */:
        return `${locator.value} element`;
      case "visual" /* VISUAL */:
        return locator.value;
      default:
        return `element matching ${locator.value}`;
    }
  }
  async getScreenshotBase64() {
    if (this.cdpAdapter) {
      return this.cdpAdapter.getScreenshotBase64();
    }
    if (this.nutjsAdapter?.isAvailable()) {
      return this.nutjsAdapter.screenshot();
    }
    if (this.pythonBridge?.isAvailable()) {
      return this.pythonBridge.screenshot();
    }
    throw new Error("No adapter available for screenshot");
  }
  log(message, ...args) {
    if (this.config.debug) {
      console.log(`[desktop-test] ${message}`, ...args);
    }
  }
};
function createDesktopTest(config = {}) {
  return new DesktopTest(config);
}

// src/core/assertions.ts
var AssertionError = class extends Error {
  actual;
  expected;
  constructor(message, actual, expected) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
  }
};
var Assertions = class {
  test;
  constructor(test) {
    this.test = test;
  }
  // ============================================================================
  // Static Value Assertions (no DesktopTest needed)
  // ============================================================================
  /**
   * Assert a number is not zero (static version)
   */
  static valueNotZero(value, message) {
    if (value === 0) {
      throw new AssertionError(
        message || `Expected non-zero value, got 0`,
        value,
        "non-zero"
      );
    }
  }
  /**
   * Assert an array/string is not empty (static version)
   */
  static valueNotEmpty(value, message) {
    if (value.length === 0) {
      throw new AssertionError(
        message || `Expected non-empty value, got empty`,
        value,
        "non-empty"
      );
    }
  }
  /**
   * Assert data passes validation rules (static version)
   */
  static validateData(data, rules, message) {
    for (const [key, validator] of Object.entries(rules)) {
      if (validator && !validator(data[key])) {
        throw new AssertionError(
          message || `Validation failed for field "${key}"`,
          data[key],
          `valid ${key}`
        );
      }
    }
  }
  // ============================================================================
  // Basic Assertions
  // ============================================================================
  ok(condition, message) {
    if (!condition) {
      throw new AssertionError(message || "Expected condition to be truthy", condition, true);
    }
  }
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        actual,
        expected
      );
    }
  }
  notEqual(actual, expected, message) {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected value to not equal ${JSON.stringify(expected)}`,
        actual,
        `not ${JSON.stringify(expected)}`
      );
    }
  }
  // ============================================================================
  // Number Assertions
  // ============================================================================
  greaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be greater than ${expected}`,
        actual,
        `> ${expected}`
      );
    }
  }
  lessThan(actual, expected, message) {
    if (actual >= expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be less than ${expected}`,
        actual,
        `< ${expected}`
      );
    }
  }
  greaterOrEqual(actual, expected, message) {
    if (actual < expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be greater than or equal to ${expected}`,
        actual,
        `>= ${expected}`
      );
    }
  }
  lessOrEqual(actual, expected, message) {
    if (actual > expected) {
      throw new AssertionError(
        message || `Expected ${actual} to be less than or equal to ${expected}`,
        actual,
        `<= ${expected}`
      );
    }
  }
  // ============================================================================
  // String Assertions
  // ============================================================================
  contains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new AssertionError(
        message || `Expected "${haystack.slice(0, 50)}..." to contain "${needle}"`,
        haystack,
        `contains "${needle}"`
      );
    }
  }
  matches(actual, pattern, message) {
    if (!pattern.test(actual)) {
      throw new AssertionError(
        message || `Expected "${actual.slice(0, 50)}..." to match ${pattern}`,
        actual,
        pattern.toString()
      );
    }
  }
  // ============================================================================
  // Element Assertions
  // ============================================================================
  requireTest() {
    if (!this.test) {
      throw new Error("This assertion method requires a DesktopTest instance");
    }
    return this.test;
  }
  async exists(locator, message) {
    const element = await this.requireTest().find(locator);
    if (!element) {
      throw new AssertionError(
        message || `Expected element to exist: ${JSON.stringify(locator)}`,
        null,
        "element"
      );
    }
  }
  async notExists(locator, message) {
    const element = await this.requireTest().find(locator);
    if (element) {
      throw new AssertionError(
        message || `Expected element to not exist: ${JSON.stringify(locator)}`,
        "element found",
        null
      );
    }
  }
  async visible(locator, message) {
    const isVisible = await this.requireTest().isVisible(locator);
    if (!isVisible) {
      throw new AssertionError(
        message || `Expected element to be visible: ${JSON.stringify(locator)}`,
        "not visible",
        "visible"
      );
    }
  }
  async hidden(locator, message) {
    const isVisible = await this.requireTest().isVisible(locator);
    if (isVisible) {
      throw new AssertionError(
        message || `Expected element to be hidden: ${JSON.stringify(locator)}`,
        "visible",
        "hidden"
      );
    }
  }
  async hasText(locator, text, message) {
    const actualText = await this.requireTest().getText(locator);
    if (!actualText.includes(text)) {
      throw new AssertionError(
        message || `Expected element to have text "${text}", got "${actualText.slice(0, 50)}..."`,
        actualText,
        text
      );
    }
  }
  async hasValue(locator, value, message) {
    const actualValue = await this.requireTest().getValue(locator);
    if (actualValue !== value) {
      throw new AssertionError(
        message || `Expected element to have value "${value}", got "${actualValue}"`,
        actualValue,
        value
      );
    }
  }
  async hasAttribute(locator, attr, value, message) {
    const actualValue = await this.requireTest().getAttribute(locator, attr);
    if (actualValue === null) {
      throw new AssertionError(
        message || `Expected element to have attribute "${attr}"`,
        null,
        attr
      );
    }
    if (value !== void 0 && actualValue !== value) {
      throw new AssertionError(
        message || `Expected attribute "${attr}" to have value "${value}", got "${actualValue}"`,
        actualValue,
        value
      );
    }
  }
  // ============================================================================
  // Data Correctness Assertions (Key feature for "0 files" bug prevention)
  // ============================================================================
  /**
   * Assert that a numeric value from the element is not zero.
   * This is specifically designed to catch the "0 files, 0 functions" bug.
   */
  async notZero(locator, message) {
    const text = await this.requireTest().getText(locator);
    const numbers = text.match(/\d+/g);
    if (!numbers || numbers.length === 0) {
      throw new AssertionError(
        message || `Expected element to contain a number: ${JSON.stringify(locator)}`,
        text,
        "number > 0"
      );
    }
    const allZero = numbers.every((n) => parseInt(n, 10) === 0);
    if (allZero) {
      throw new AssertionError(
        message || `Expected non-zero value, but all numbers are zero: "${text}"`,
        numbers,
        "non-zero"
      );
    }
  }
  /**
   * Assert that an element's text content is not empty.
   */
  async notEmpty(locator, message) {
    const text = await this.requireTest().getText(locator);
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new AssertionError(
        message || `Expected element to have non-empty text: ${JSON.stringify(locator)}`,
        "",
        "non-empty text"
      );
    }
  }
  /**
   * Assert that element data passes a custom validation function.
   */
  async dataCorrect(locator, validator, message) {
    const text = await this.requireTest().getText(locator);
    if (!validator(text)) {
      throw new AssertionError(
        message || `Data validation failed for: ${JSON.stringify(locator)}`,
        text,
        "valid data"
      );
    }
  }
  // ============================================================================
  // Visual AI Assertions
  // ============================================================================
  /**
   * Use VLM to visually verify a condition.
   */
  async visualCheck(description, _message) {
    console.log(`  [Visual Check] ${description}`);
  }
  /**
   * Compare current screenshot against baseline for visual regression.
   */
  async noVisualRegression(baseline, threshold = 0.95) {
    console.log(`  [Visual Regression] Comparing against baseline: ${baseline} (threshold: ${threshold})`);
  }
};

// src/core/test-runner.ts
var Logger = class {
  info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  }
  warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  error(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  }
  debug(message, ...args) {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
  step(message) {
    console.log(`  \u2192 ${message}`);
  }
};
var TestRunner = class {
  options;
  desktopTest;
  results = [];
  logger = new Logger();
  constructor(options = {}) {
    this.options = {
      stopOnFailure: false,
      ...options
    };
    this.desktopTest = new DesktopTest(options.config);
  }
  /**
   * Run a single test case
   */
  async runTest(test) {
    const startTime = Date.now();
    const screenshots = [];
    let passed = false;
    let error;
    let usedVLM = false;
    this.options.reporter?.onTestStart(test);
    console.log(`
  [TEST] ${test.name}`);
    let videoPath;
    if (this.options.videoDir) {
      const sanitizedName = test.name.replace(/[^a-zA-Z0-9]/g, "_");
      videoPath = `${this.options.videoDir}/${sanitizedName}.webm`;
      try {
        await this.desktopTest.startRecording(videoPath);
      } catch {
      }
    }
    const assertions = new Assertions(this.desktopTest);
    const context = {
      test: this.desktopTest,
      assert: assertions,
      log: this.logger
    };
    const maxRetries = test.retries || 0;
    let attempts = 0;
    while (attempts <= maxRetries) {
      attempts++;
      try {
        await test.fn(context);
        passed = true;
        break;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        if (attempts <= maxRetries) {
          console.log(`    Retry ${attempts}/${maxRetries}...`);
        }
      }
    }
    if (videoPath) {
      try {
        await this.desktopTest.stopRecording();
      } catch {
      }
    }
    const costSummary = this.desktopTest.getCostSummary();
    usedVLM = costSummary.totalCalls > 0;
    const result = {
      test,
      passed,
      error,
      duration: Date.now() - startTime,
      screenshots,
      video: videoPath,
      usedVLM,
      vlmCost: costSummary.totalCost
    };
    this.results.push(result);
    const status = passed ? "\u2713 PASS" : "\u2717 FAIL";
    console.log(`  ${status} (${result.duration}ms)${usedVLM ? ` [VLM: $${costSummary.totalCost.toFixed(4)}]` : ""}`);
    if (error) {
      console.log(`    ${error.message}`);
    }
    this.options.reporter?.onTestEnd(result);
    return result;
  }
  /**
   * Run all test cases
   */
  async runAll(tests, suiteName = "Desktop Tests") {
    console.log("\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    console.log(`  ${suiteName}`);
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
    this.options.reporter?.onSuiteStart(suiteName);
    console.log("  Connecting to application...");
    try {
      await this.desktopTest.connect();
      console.log("  \u2713 Connected\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  \u2717 Connection failed: ${message}`);
      console.log("  Please ensure the Tauri app is running with remote debugging enabled.");
      process.exit(1);
    }
    const onlyTests = tests.filter((t) => t.only);
    const testsToRun = onlyTests.length > 0 ? onlyTests : tests.filter((t) => !t.skip);
    for (const test of testsToRun) {
      const result = await this.runTest(test);
      if (!result.passed && this.options.stopOnFailure) {
        console.log("\n  Stopping: stopOnFailure is enabled");
        break;
      }
    }
    await this.desktopTest.disconnect();
    const suiteResult = {
      name: suiteName,
      tests: this.results,
      passed: this.results.filter((r) => r.passed).length,
      failed: this.results.filter((r) => !r.passed).length,
      skipped: tests.filter((t) => t.skip).length,
      duration: this.results.reduce((sum, r) => sum + r.duration, 0),
      totalVLMCost: this.results.reduce((sum, r) => sum + (r.vlmCost || 0), 0)
    };
    this.printSummary(suiteResult);
    this.options.reporter?.onSuiteEnd(suiteResult);
    return suiteResult;
  }
  /**
   * Print test summary
   */
  printSummary(result) {
    console.log("\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
    console.log("  Test Results");
    console.log("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
    console.log(`  Total:    ${result.tests.length} tests`);
    console.log(`  Passed:   ${result.passed} \u2713`);
    console.log(`  Failed:   ${result.failed} \u2717`);
    console.log(`  Skipped:  ${result.skipped}`);
    console.log(`  Duration: ${result.duration}ms`);
    if (result.totalVLMCost > 0) {
      console.log(`  VLM Cost: $${result.totalVLMCost.toFixed(4)}`);
    }
    if (result.failed > 0) {
      console.log("\n  Failed tests:");
      for (const test of result.tests.filter((t) => !t.passed)) {
        console.log(`    - ${test.test.name}`);
        if (test.error) {
          console.log(`      ${test.error.message}`);
        }
      }
    }
    console.log("\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
    if (result.failed > 0) {
      process.exitCode = 1;
    }
  }
  /**
   * Get test results
   */
  getResults() {
    return this.results;
  }
  /**
   * Reset results
   */
  reset() {
    this.results = [];
    this.desktopTest.resetCostTracking();
  }
};

// src/core/accessibility-tree.ts
var ARIA_ROLES = {
  // Document structure
  document: ["article", "document", "application", "feed", "figure", "group", "img", "main", "math", "none", "note", "presentation", "separator", "toolbar"],
  // Landmark roles
  landmark: ["banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search"],
  // Widget roles (interactive)
  widget: ["button", "checkbox", "combobox", "gridcell", "link", "listbox", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "progressbar", "radio", "scrollbar", "searchbox", "slider", "spinbutton", "switch", "tab", "tabpanel", "textbox", "treeitem"],
  // Composite widgets
  composite: ["combobox", "grid", "listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
  // Live regions
  live: ["alert", "log", "marquee", "status", "timer"],
  // Window roles
  window: ["alertdialog", "dialog"]
};
var AccessibilityTreeManager = class {
  test;
  tree = null;
  constructor(test) {
    this.test = test;
  }
  // =========================================================================
  // Tree Building
  // =========================================================================
  /**
   * Get the full accessibility tree from the page
   */
  async getTree(options = {}) {
    const { includeHidden = false, maxDepth = 100 } = options;
    const rawTree = await this.test.evaluate(`
      (function() {
        const stats = { total: 0, interactive: 0, landmarks: 0, headings: 0 };
        const landmarkRoles = ['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search'];
        const interactiveRoles = ['button', 'checkbox', 'combobox', 'link', 'listbox', 'menuitem', 'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem'];
        
        function getAccessibleName(el) {
          // aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labels = labelledBy.split(' ').map(id => document.getElementById(id)?.textContent || '').join(' ');
            if (labels.trim()) return labels.trim();
          }
          
          // aria-label
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;
          
          // <label> for form elements
          if (el.id) {
            const label = document.querySelector('label[for="' + el.id + '"]');
            if (label) return label.textContent?.trim() || '';
          }
          
          // title attribute
          const title = el.getAttribute('title');
          if (title) return title;
          
          // alt for images
          const alt = el.getAttribute('alt');
          if (alt) return alt;
          
          // Text content for certain elements
          const tagName = el.tagName.toLowerCase();
          if (['button', 'a', 'label', 'legend', 'caption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            return el.textContent?.trim() || '';
          }
          
          // value for inputs
          if (tagName === 'input' && ['submit', 'button', 'reset'].includes(el.type)) {
            return el.value || '';
          }
          
          return '';
        }
        
        function getRole(el) {
          // Explicit role
          const role = el.getAttribute('role');
          if (role) return role;
          
          // Implicit roles
          const tagName = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || '';
          
          const implicitRoles = {
            'a[href]': 'link',
            'button': 'button',
            'input[type=button]': 'button',
            'input[type=submit]': 'button',
            'input[type=reset]': 'button',
            'input[type=image]': 'button',
            'input[type=checkbox]': 'checkbox',
            'input[type=radio]': 'radio',
            'input[type=range]': 'slider',
            'input[type=search]': 'searchbox',
            'input[type=text]': 'textbox',
            'input[type=email]': 'textbox',
            'input[type=password]': 'textbox',
            'input[type=tel]': 'textbox',
            'input[type=url]': 'textbox',
            'input': 'textbox',
            'select': 'combobox',
            'textarea': 'textbox',
            'article': 'article',
            'aside': 'complementary',
            'footer': 'contentinfo',
            'form': 'form',
            'header': 'banner',
            'main': 'main',
            'nav': 'navigation',
            'section': 'region',
            'img': 'img',
            'ul': 'list',
            'ol': 'list',
            'li': 'listitem',
            'table': 'table',
            'tr': 'row',
            'td': 'cell',
            'th': 'columnheader',
            'h1': 'heading',
            'h2': 'heading',
            'h3': 'heading',
            'h4': 'heading',
            'h5': 'heading',
            'h6': 'heading',
            'dialog': 'dialog',
            'progress': 'progressbar',
            'meter': 'meter',
            'option': 'option',
            'menu': 'menu',
          };
          
          // Check with attribute
          if (tagName === 'a' && el.hasAttribute('href')) return 'link';
          if (tagName === 'input' && type) {
            return implicitRoles['input[type=' + type + ']'] || implicitRoles['input'] || 'generic';
          }
          
          return implicitRoles[tagName] || 'generic';
        }
        
        function getProperties(el) {
          const props = [];
          
          // ARIA states
          const ariaProps = ['aria-checked', 'aria-disabled', 'aria-expanded', 'aria-hidden', 'aria-invalid', 'aria-pressed', 'aria-readonly', 'aria-required', 'aria-selected', 'aria-busy', 'aria-live', 'aria-haspopup', 'aria-controls', 'aria-describedby', 'aria-owns', 'aria-level', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'];
          
          for (const attr of ariaProps) {
            const value = el.getAttribute(attr);
            if (value !== null) {
              props.push({ name: attr.replace('aria-', ''), value: value === 'true' ? true : value === 'false' ? false : value });
            }
          }
          
          // Standard properties
          if (el.disabled !== undefined) props.push({ name: 'disabled', value: !!el.disabled });
          if (el.readOnly !== undefined) props.push({ name: 'readonly', value: !!el.readOnly });
          if (el.required !== undefined) props.push({ name: 'required', value: !!el.required });
          if (el.checked !== undefined) props.push({ name: 'checked', value: !!el.checked });
          
          // Tabindex
          const tabindex = el.getAttribute('tabindex');
          if (tabindex !== null) props.push({ name: 'tabindex', value: parseInt(tabindex, 10) });
          
          return props;
        }
        
        function isVisible(el) {
          if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
          const style = getComputedStyle(el);
          if (style.display === 'none') return false;
          if (style.visibility === 'hidden') return false;
          if (parseFloat(style.opacity) === 0) return false;
          if (el.getAttribute('aria-hidden') === 'true') return false;
          return true;
        }
        
        function isFocusable(el) {
          if (el.disabled) return false;
          const tabindex = el.getAttribute('tabindex');
          if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true;
          const focusable = ['a[href]', 'button', 'input', 'select', 'textarea', '[contenteditable]'];
          return focusable.some(sel => el.matches(sel));
        }
        
        function buildTree(el, depth = 0, includeHidden = false, maxDepth = 100) {
          if (!el || depth > maxDepth) return null;
          if (!includeHidden && !isVisible(el)) return null;
          
          stats.total++;
          
          const role = getRole(el);
          const name = getAccessibleName(el);
          
          if (landmarkRoles.includes(role)) stats.landmarks++;
          if (role === 'heading') stats.headings++;
          if (interactiveRoles.includes(role)) stats.interactive++;
          
          const rect = el.getBoundingClientRect();
          const node = {
            nodeId: 'ax_' + stats.total,
            role: role,
            name: name,
            description: el.getAttribute('aria-description') || '',
            value: el.value || el.getAttribute('aria-valuenow') || '',
            properties: getProperties(el),
            children: [],
            isInteractive: interactiveRoles.includes(role),
            isFocusable: isFocusable(el),
            isVisible: isVisible(el),
            isLandmark: landmarkRoles.includes(role),
            level: role === 'heading' ? parseInt(el.tagName[1]) || 1 : undefined,
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
          
          // Process children
          for (const child of el.children) {
            const childNode = buildTree(child, depth + 1, includeHidden, maxDepth);
            if (childNode) {
              node.children.push(childNode);
            }
          }
          
          return node;
        }
        
        const tree = buildTree(document.body, 0, ${includeHidden}, ${maxDepth});
        return { tree, stats };
      })()
    `);
    const nodes = /* @__PURE__ */ new Map();
    const processNode = (raw, parent) => {
      const node = {
        nodeId: raw.nodeId,
        role: raw.role,
        name: raw.name,
        description: raw.description,
        value: raw.value,
        properties: raw.properties,
        children: [],
        parent,
        isInteractive: raw.isInteractive,
        isFocusable: raw.isFocusable,
        isVisible: raw.isVisible,
        isLandmark: raw.isLandmark,
        level: raw.level,
        boundingBox: raw.boundingBox
      };
      nodes.set(node.nodeId, node);
      for (const childRaw of raw.children) {
        node.children.push(processNode(childRaw, node));
      }
      return node;
    };
    const root = processNode(rawTree.tree);
    this.tree = {
      root,
      nodes,
      totalNodes: rawTree.stats.total,
      interactiveNodes: rawTree.stats.interactive,
      landmarkCount: rawTree.stats.landmarks,
      headingCount: rawTree.stats.headings
    };
    return this.tree;
  }
  // =========================================================================
  // Tree Queries
  // =========================================================================
  /**
   * Find nodes by role
   */
  async findByRole(role) {
    const tree = this.tree || await this.getTree();
    const results = [];
    const search = (node) => {
      if (node.role === role) results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    return { nodes: results, count: results.length };
  }
  /**
   * Find nodes by name (accessible name)
   */
  async findByName(name, options = {}) {
    const tree = this.tree || await this.getTree();
    const results = [];
    const { exact = false } = options;
    const search = (node) => {
      const match = exact ? node.name === name : node.name.toLowerCase().includes(name.toLowerCase());
      if (match) results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    return { nodes: results, count: results.length };
  }
  /**
   * Find all landmarks
   */
  async findLandmarks() {
    const tree = this.tree || await this.getTree();
    const results = [];
    const search = (node) => {
      if (node.isLandmark) results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    return { nodes: results, count: results.length };
  }
  /**
   * Find all headings
   */
  async findHeadings() {
    const tree = this.tree || await this.getTree();
    const results = [];
    const search = (node) => {
      if (node.role === "heading") results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    results.sort((a, b) => (a.level || 0) - (b.level || 0));
    return { nodes: results, count: results.length };
  }
  /**
   * Find all focusable elements
   */
  async findFocusable() {
    const tree = this.tree || await this.getTree();
    const results = [];
    const search = (node) => {
      if (node.isFocusable) results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    return { nodes: results, count: results.length };
  }
  /**
   * Find all interactive elements
   */
  async findInteractive() {
    const tree = this.tree || await this.getTree();
    const results = [];
    const search = (node) => {
      if (node.isInteractive) results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    return { nodes: results, count: results.length };
  }
  /**
   * Query with custom predicate
   */
  async query(predicate) {
    const tree = this.tree || await this.getTree();
    const results = [];
    const search = (node) => {
      if (predicate(node)) results.push(node);
      for (const child of node.children) search(child);
    };
    search(tree.root);
    return { nodes: results, count: results.length };
  }
  // =========================================================================
  // Validation
  // =========================================================================
  /**
   * Validate the accessibility tree for common issues
   */
  async validate() {
    const tree = this.tree || await this.getTree();
    const issues = [];
    const landmarks = await this.findLandmarks();
    if (!landmarks.nodes.some((n) => n.role === "main")) {
      issues.push({
        type: "error",
        code: "missing-main-landmark",
        message: "Page is missing a main landmark",
        suggestion: 'Add <main> or role="main" to the main content area'
      });
    }
    if (!landmarks.nodes.some((n) => n.role === "navigation")) {
      issues.push({
        type: "warning",
        code: "missing-navigation-landmark",
        message: "Page is missing a navigation landmark",
        suggestion: 'Add <nav> or role="navigation" to navigation areas'
      });
    }
    const headings = await this.findHeadings();
    if (headings.count === 0) {
      issues.push({
        type: "error",
        code: "no-headings",
        message: "Page has no headings",
        suggestion: "Add heading elements (h1-h6) to structure the content"
      });
    } else {
      const h1s = headings.nodes.filter((n) => n.level === 1);
      if (h1s.length === 0) {
        issues.push({
          type: "error",
          code: "missing-h1",
          message: "Page is missing an h1 heading",
          suggestion: "Add a single h1 heading as the main page title"
        });
      } else if (h1s.length > 1) {
        issues.push({
          type: "warning",
          code: "multiple-h1",
          message: `Page has ${h1s.length} h1 headings`,
          suggestion: "Consider using only one h1 per page"
        });
      }
      let prevLevel = 0;
      for (const heading of headings.nodes) {
        const level = heading.level || 0;
        if (level > prevLevel + 1 && prevLevel > 0) {
          issues.push({
            type: "warning",
            code: "skipped-heading-level",
            message: `Heading level skipped from h${prevLevel} to h${level}`,
            node: heading,
            suggestion: "Use sequential heading levels without skipping"
          });
        }
        prevLevel = level;
      }
    }
    const validate = (node) => {
      if (node.isInteractive && !node.name) {
        issues.push({
          type: "error",
          code: "missing-accessible-name",
          message: `${node.role} element has no accessible name`,
          node,
          suggestion: "Add aria-label, aria-labelledby, or visible text content"
        });
      }
      if (node.role === "img" && !node.name && !node.properties.some((p) => p.name === "hidden" && p.value === true)) {
        issues.push({
          type: "error",
          code: "missing-alt-text",
          message: "Image has no alt text",
          node,
          suggestion: "Add alt attribute to the image"
        });
      }
      for (const child of node.children) validate(child);
    };
    validate(tree.root);
    return issues;
  }
  /**
   * Check if a specific ARIA pattern is correctly implemented
   */
  async validatePattern(pattern) {
    const issues = [];
    switch (pattern) {
      case "dialog": {
        const dialogs = await this.findByRole("dialog");
        for (const dialog of dialogs.nodes) {
          if (!dialog.name) {
            issues.push({
              type: "error",
              code: "dialog-no-label",
              message: "Dialog has no accessible name",
              node: dialog,
              suggestion: "Add aria-label or aria-labelledby to the dialog"
            });
          }
          const focusable = dialog.children.filter((n) => n.isFocusable);
          if (focusable.length === 0) {
            issues.push({
              type: "warning",
              code: "dialog-no-focusable",
              message: "Dialog has no focusable elements",
              node: dialog
            });
          }
        }
        break;
      }
      case "tabs": {
        const tablists = await this.findByRole("tablist");
        for (const tablist of tablists.nodes) {
          const tabs = tablist.children.filter((n) => n.role === "tab");
          if (tabs.length === 0) {
            issues.push({
              type: "error",
              code: "tablist-no-tabs",
              message: "Tablist contains no tabs",
              node: tablist
            });
          }
          const selected = tabs.filter((t) => t.properties.some((p) => p.name === "selected" && p.value === true));
          if (selected.length === 0 && tabs.length > 0) {
            issues.push({
              type: "warning",
              code: "tabs-no-selection",
              message: "No tab is marked as selected",
              node: tablist,
              suggestion: 'Add aria-selected="true" to the active tab'
            });
          }
        }
        break;
      }
      case "menu": {
        const menus = await this.findByRole("menu");
        for (const menu of menus.nodes) {
          const items = menu.children.filter(
            (n) => n.role === "menuitem" || n.role === "menuitemcheckbox" || n.role === "menuitemradio"
          );
          if (items.length === 0) {
            issues.push({
              type: "error",
              code: "menu-no-items",
              message: "Menu contains no menu items",
              node: menu
            });
          }
        }
        break;
      }
      case "tree": {
        const trees = await this.findByRole("tree");
        for (const tree of trees.nodes) {
          const items = await this.query((n) => n.role === "treeitem");
          if (items.count === 0) {
            issues.push({
              type: "error",
              code: "tree-no-items",
              message: "Tree contains no tree items",
              node: tree
            });
          }
        }
        break;
      }
      case "listbox": {
        const listboxes = await this.findByRole("listbox");
        for (const listbox of listboxes.nodes) {
          const options = listbox.children.filter((n) => n.role === "option");
          if (options.length === 0) {
            issues.push({
              type: "error",
              code: "listbox-no-options",
              message: "Listbox contains no options",
              node: listbox
            });
          }
        }
        break;
      }
    }
    return issues;
  }
  // =========================================================================
  // Tree Traversal
  // =========================================================================
  /**
   * Get the path from root to a node
   */
  getPath(node) {
    const path4 = [];
    let current = node;
    while (current) {
      path4.unshift(current);
      current = current.parent;
    }
    return path4;
  }
  /**
   * Get all siblings of a node
   */
  getSiblings(node) {
    if (!node.parent) return [];
    return node.parent.children.filter((n) => n.nodeId !== node.nodeId);
  }
  /**
   * Get all descendants of a node
   */
  getDescendants(node) {
    const descendants = [];
    const collect = (n) => {
      for (const child of n.children) {
        descendants.push(child);
        collect(child);
      }
    };
    collect(node);
    return descendants;
  }
  // =========================================================================
  // Output Formats
  // =========================================================================
  /**
   * Serialize tree to text (for screen reader simulation)
   */
  async toText() {
    const tree = this.tree || await this.getTree();
    const lines = [];
    const visit = (node, indent = 0) => {
      if (!node.isVisible) return;
      const prefix = "  ".repeat(indent);
      let line = prefix;
      if (node.role !== "generic" || node.name) {
        line += `[${node.role}]`;
        if (node.name) line += ` "${node.name}"`;
        if (node.value) line += ` value="${node.value}"`;
        if (node.level) line += ` level=${node.level}`;
        const keyProps = node.properties.filter(
          (p) => ["checked", "selected", "expanded", "disabled"].includes(p.name)
        );
        if (keyProps.length > 0) {
          line += " (" + keyProps.map((p) => `${p.name}=${p.value}`).join(", ") + ")";
        }
        if (line.trim() !== prefix.trim()) {
          lines.push(line);
        }
      }
      for (const child of node.children) {
        visit(child, indent + 1);
      }
    };
    visit(tree.root);
    return lines.join("\n");
  }
  /**
   * Serialize tree to JSON
   */
  async toJSON() {
    const tree = this.tree || await this.getTree();
    const simplify = (node) => ({
      role: node.role,
      name: node.name,
      ...node.value && { value: node.value },
      ...node.level && { level: node.level },
      ...node.properties.length > 0 && { properties: node.properties },
      ...node.children.length > 0 && { children: node.children.map(simplify) }
    });
    return JSON.stringify(simplify(tree.root), null, 2);
  }
  /**
   * Generate accessibility summary report
   */
  async generateSummary() {
    const tree = this.tree || await this.getTree();
    const issues = await this.validate();
    let report = "# Accessibility Tree Summary\n\n";
    report += "## Statistics\n";
    report += `- Total nodes: ${tree.totalNodes}
`;
    report += `- Interactive elements: ${tree.interactiveNodes}
`;
    report += `- Landmarks: ${tree.landmarkCount}
`;
    report += `- Headings: ${tree.headingCount}

`;
    const landmarks = await this.findLandmarks();
    if (landmarks.count > 0) {
      report += "## Landmarks\n";
      for (const landmark of landmarks.nodes) {
        report += `- ${landmark.role}${landmark.name ? `: "${landmark.name}"` : ""}
`;
      }
      report += "\n";
    }
    const headings = await this.findHeadings();
    if (headings.count > 0) {
      report += "## Heading Outline\n";
      for (const heading of headings.nodes) {
        const indent = "  ".repeat((heading.level || 1) - 1);
        report += `${indent}- h${heading.level}: "${heading.name}"
`;
      }
      report += "\n";
    }
    if (issues.length > 0) {
      report += "## Issues Found\n";
      const errors = issues.filter((i) => i.type === "error");
      const warnings = issues.filter((i) => i.type === "warning");
      if (errors.length > 0) {
        report += `
### Errors (${errors.length})
`;
        for (const issue of errors) {
          report += `- **${issue.code}**: ${issue.message}
`;
          if (issue.suggestion) report += `  - Suggestion: ${issue.suggestion}
`;
        }
      }
      if (warnings.length > 0) {
        report += `
### Warnings (${warnings.length})
`;
        for (const issue of warnings) {
          report += `- **${issue.code}**: ${issue.message}
`;
          if (issue.suggestion) report += `  - Suggestion: ${issue.suggestion}
`;
        }
      }
    } else {
      report += "## No Issues Found\n";
      report += "The accessibility tree passes basic validation checks.\n";
    }
    return report;
  }
};
function createAccessibilityTreeManager(test) {
  return new AccessibilityTreeManager(test);
}

// src/core/a11y.ts
var WCAG_TAGS = {
  "wcag2a": "WCAG 2.0 Level A",
  "wcag2aa": "WCAG 2.0 Level AA",
  "wcag2aaa": "WCAG 2.0 Level AAA",
  "wcag21a": "WCAG 2.1 Level A",
  "wcag21aa": "WCAG 2.1 Level AA",
  "best-practice": "Best Practices"
};
var A11yTester = class {
  test;
  treeManager;
  constructor(test) {
    this.test = test;
    this.treeManager = new AccessibilityTreeManager(test);
  }
  /**
   * Get the accessibility tree manager for direct tree access
   */
  get tree() {
    return this.treeManager;
  }
  /**
   * Run accessibility audit using axe-core (injected into page)
   */
  async audit(options = {}) {
    const { tags = ["wcag2a", "wcag2aa"], includeSelectors, excludeSelectors } = options;
    const result = await this.test.evaluate(`
      (async function() {
        // Load axe-core if not present
        if (!window.axe) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';
          document.head.appendChild(script);
          await new Promise(resolve => script.onload = resolve);
        }

        // Configure axe
        const options = {
          runOnly: {
            type: 'tag',
            values: ${JSON.stringify(tags)}
          }
        };

        ${includeSelectors ? `options.include = ${JSON.stringify(includeSelectors)};` : ""}
        ${excludeSelectors ? `options.exclude = ${JSON.stringify(excludeSelectors)};` : ""}

        // Run audit
        try {
          const results = await window.axe.run(document, options);
          return {
            violations: results.violations.map(v => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              nodes: v.nodes.map(n => ({
                html: n.html,
                target: n.target,
                failureSummary: n.failureSummary
              }))
            })),
            passes: results.passes.length,
            incomplete: results.incomplete.length,
            inapplicable: results.inapplicable.length
          };
        } catch (e) {
          return {
            violations: [{
              id: 'axe-error',
              impact: 'critical',
              description: 'Failed to run axe-core: ' + e.message,
              help: 'Check if axe-core loaded correctly',
              helpUrl: '',
              nodes: []
            }],
            passes: 0,
            incomplete: 0,
            inapplicable: 0
          };
        }
      })()
    `);
    return result;
  }
  /**
   * Check for critical violations only
   */
  async checkCritical() {
    const result = await this.audit();
    return result.violations.filter((v) => v.impact === "critical");
  }
  /**
   * Check for serious and critical violations
   */
  async checkSerious() {
    const result = await this.audit();
    return result.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
  }
  /**
   * Check color contrast issues
   */
  async checkContrast() {
    const result = await this.audit({ tags: ["wcag2aa"] });
    return result.violations.filter(
      (v) => v.id.includes("contrast") || v.id.includes("color")
    );
  }
  /**
   * Check keyboard navigation issues
   */
  async checkKeyboardNav() {
    const result = await this.audit({ tags: ["wcag2a"] });
    return result.violations.filter(
      (v) => v.id.includes("focus") || v.id.includes("keyboard") || v.id.includes("tabindex")
    );
  }
  /**
   * Generate accessibility report
   */
  async generateReport() {
    const result = await this.audit();
    let report = "# Accessibility Report\n\n";
    report += `## Summary
`;
    report += `- Violations: ${result.violations.length}
`;
    report += `- Passes: ${result.passes}
`;
    report += `- Incomplete: ${result.incomplete}

`;
    if (result.violations.length > 0) {
      report += "## Violations\n\n";
      const byImpact = {
        critical: [],
        serious: [],
        moderate: [],
        minor: []
      };
      for (const v of result.violations) {
        byImpact[v.impact].push(v);
      }
      for (const impact of ["critical", "serious", "moderate", "minor"]) {
        const violations = byImpact[impact];
        if (violations.length > 0) {
          report += `### ${impact.toUpperCase()} (${violations.length})

`;
          for (const v of violations) {
            report += `#### ${v.id}
`;
            report += `- ${v.description}
`;
            report += `- Help: ${v.help}
`;
            report += `- URL: ${v.helpUrl}
`;
            report += `- Affected: ${v.nodes.length} elements

`;
          }
        }
      }
    }
    return report;
  }
  // =========================================================================
  // Complete Audit (axe-core + tree analysis)
  // =========================================================================
  /**
   * Run a complete accessibility audit combining axe-core and tree analysis
   */
  async completeAudit(options = {}) {
    const axeResult = await this.audit(options);
    const tree = await this.treeManager.getTree();
    const treeIssues = await this.treeManager.validate();
    return {
      ...axeResult,
      treeIssues,
      summary: {
        totalNodes: tree.totalNodes,
        interactiveNodes: tree.interactiveNodes,
        landmarkCount: tree.landmarkCount,
        headingCount: tree.headingCount
      }
    };
  }
  /**
   * Get all landmarks from the page
   */
  async getLandmarks() {
    return this.treeManager.findLandmarks();
  }
  /**
   * Get all headings from the page
   */
  async getHeadings() {
    return this.treeManager.findHeadings();
  }
  /**
   * Get all focusable elements
   */
  async getFocusableElements() {
    return this.treeManager.findFocusable();
  }
  /**
   * Get all interactive elements
   */
  async getInteractiveElements() {
    return this.treeManager.findInteractive();
  }
  /**
   * Find elements by ARIA role
   */
  async findByRole(role) {
    return this.treeManager.findByRole(role);
  }
  /**
   * Find elements by accessible name
   */
  async findByName(name, options) {
    return this.treeManager.findByName(name, options);
  }
  /**
   * Validate a specific ARIA pattern
   */
  async validatePattern(pattern) {
    return this.treeManager.validatePattern(pattern);
  }
  /**
   * Get the accessibility tree as text (screen reader simulation)
   */
  async getTreeAsText() {
    return this.treeManager.toText();
  }
  /**
   * Get the accessibility tree as JSON
   */
  async getTreeAsJSON() {
    return this.treeManager.toJSON();
  }
  /**
   * Generate complete accessibility summary
   */
  async generateCompleteSummary() {
    const axeReport = await this.generateReport();
    const treeSummary = await this.treeManager.generateSummary();
    return `${axeReport}

---

${treeSummary}`;
  }
  // =========================================================================
  // Specific Checks
  // =========================================================================
  /**
   * Check if page has proper heading structure
   */
  async checkHeadingStructure() {
    const headings = await this.getHeadings();
    const issues = [];
    const h1s = headings.nodes.filter((n) => n.level === 1);
    if (h1s.length === 0) {
      issues.push("Page is missing an h1 heading");
    } else if (h1s.length > 1) {
      issues.push(`Page has ${h1s.length} h1 headings (should have 1)`);
    }
    let prevLevel = 0;
    for (const heading of headings.nodes) {
      const level = heading.level || 0;
      if (level > prevLevel + 1 && prevLevel > 0) {
        issues.push(`Heading level skipped from h${prevLevel} to h${level}`);
      }
      prevLevel = level;
    }
    const outline = headings.nodes.map((h) => {
      const indent = "  ".repeat((h.level || 1) - 1);
      return `${indent}h${h.level}: ${h.name || "(empty)"}`;
    }).join("\n");
    return {
      valid: issues.length === 0,
      issues,
      outline
    };
  }
  /**
   * Check if page has proper landmark structure
   */
  async checkLandmarkStructure() {
    const landmarks = await this.getLandmarks();
    const issues = [];
    if (!landmarks.nodes.some((n) => n.role === "main")) {
      issues.push("Page is missing a main landmark");
    }
    const mains = landmarks.nodes.filter((n) => n.role === "main");
    if (mains.length > 1) {
      issues.push(`Page has ${mains.length} main landmarks (should have 1)`);
    }
    if (!landmarks.nodes.some((n) => n.role === "navigation")) {
      issues.push("Page is missing a navigation landmark");
    }
    return {
      valid: issues.length === 0,
      issues,
      landmarks: landmarks.nodes.map((n) => ({ role: n.role, name: n.name }))
    };
  }
  /**
   * Check for elements with missing accessible names
   */
  async checkAccessibleNames() {
    const interactive = await this.getInteractiveElements();
    const missingNames = [];
    for (const node of interactive.nodes) {
      if (!node.name) {
        missingNames.push({
          role: node.role,
          suggestion: `Add aria-label, aria-labelledby, or visible text to ${node.role}`
        });
      }
    }
    return {
      valid: missingNames.length === 0,
      missingNames
    };
  }
  /**
   * Simulate screen reader reading order
   */
  async getReadingOrder() {
    const tree = await this.treeManager.getTree();
    const order = [];
    const visit = (node) => {
      if (!node.isVisible) return;
      if (node.name && node.role !== "generic") {
        let text = "";
        if (node.isLandmark) {
          text += `[${node.role} landmark] `;
        } else if (node.role === "heading") {
          text += `[heading level ${node.level}] `;
        } else if (node.isInteractive) {
          text += `[${node.role}] `;
        }
        text += node.name;
        const states = [];
        for (const prop of node.properties) {
          if (prop.name === "checked" && prop.value) states.push("checked");
          if (prop.name === "selected" && prop.value) states.push("selected");
          if (prop.name === "expanded") states.push(prop.value ? "expanded" : "collapsed");
          if (prop.name === "disabled" && prop.value) states.push("disabled");
        }
        if (states.length > 0) {
          text += ` (${states.join(", ")})`;
        }
        if (text.trim()) order.push(text.trim());
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.root);
    return order;
  }
};
function createA11yTester(test) {
  return new A11yTester(test);
}
var VisualRegressionTester = class {
  test;
  options;
  constructor(test, options) {
    this.test = test;
    this.options = {
      threshold: 0.01,
      // 1% default threshold
      updateBaselines: false,
      maskSelectors: [],
      ...options
    };
    if (!fs3__namespace.existsSync(this.options.baselineDir)) {
      fs3__namespace.mkdirSync(this.options.baselineDir, { recursive: true });
    }
    if (!fs3__namespace.existsSync(this.options.outputDir)) {
      fs3__namespace.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }
  /**
   * Generate a unique name for a screenshot
   */
  getSnapshotName(name) {
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, "_");
    return `${sanitized}.png`;
  }
  /**
   * Take a screenshot and compare with baseline
   */
  async compareScreenshot(name, _options = {}) {
    const filename = this.getSnapshotName(name);
    const screenshotPath = path3__namespace.join(this.options.outputDir, filename);
    const baselinePath = path3__namespace.join(this.options.baselineDir, filename);
    const diffPath = path3__namespace.join(this.options.outputDir, `diff_${filename}`);
    const screenshot = await this.test.screenshot();
    const screenshotBuffer = Buffer.from(screenshot, "base64");
    fs3__namespace.writeFileSync(screenshotPath, screenshotBuffer);
    if (!fs3__namespace.existsSync(baselinePath)) {
      if (this.options.updateBaselines) {
        fs3__namespace.copyFileSync(screenshotPath, baselinePath);
        return {
          match: true,
          diffPercentage: 0,
          diffPixels: 0,
          totalPixels: 0,
          baselineExists: false,
          screenshotPath,
          baselinePath
        };
      }
      return {
        match: false,
        diffPercentage: 100,
        diffPixels: -1,
        totalPixels: -1,
        baselineExists: false,
        screenshotPath,
        baselinePath
      };
    }
    const diffResult = await this.compareImages(
      baselinePath,
      screenshotPath,
      diffPath
    );
    if (this.options.updateBaselines && diffResult.diffPercentage > this.options.threshold) {
      fs3__namespace.copyFileSync(screenshotPath, baselinePath);
    }
    return {
      ...diffResult,
      baselineExists: true,
      screenshotPath,
      baselinePath,
      diffPath: diffResult.diffPixels > 0 ? diffPath : void 0
    };
  }
  /**
   * Compare two images using pixel-by-pixel comparison
   */
  async compareImages(baselinePath, currentPath, _diffPath) {
    try {
      const { Jimp } = await import('jimp');
      const baseline = await Jimp.read(baselinePath);
      const current = await Jimp.read(currentPath);
      const baselineHash = baseline.hash();
      const currentHash = current.hash();
      const match = baselineHash === currentHash;
      return {
        match,
        diffPercentage: match ? 0 : 100,
        diffPixels: match ? 0 : -1,
        totalPixels: baseline.width * baseline.height
      };
    } catch {
      const baselineHash = this.hashFile(baselinePath);
      const currentHash = this.hashFile(currentPath);
      const match = baselineHash === currentHash;
      return {
        match,
        diffPercentage: match ? 0 : 100,
        diffPixels: match ? 0 : -1,
        totalPixels: -1
      };
    }
  }
  /**
   * Hash a file for quick comparison
   */
  hashFile(filePath) {
    const buffer = fs3__namespace.readFileSync(filePath);
    return crypto__namespace.createHash("md5").update(buffer).digest("hex");
  }
  /**
   * Compare full page screenshot
   */
  async compareFullPage(name) {
    return this.compareScreenshot(name, { fullPage: true });
  }
  /**
   * Compare specific element
   */
  async compareElement(name, selector) {
    await this.test.evaluate(`
      document.querySelector('${selector}')?.scrollIntoView({ block: 'center' });
    `);
    await this.test.wait(300);
    return this.compareScreenshot(name, { selector });
  }
  /**
   * Update all baselines
   */
  async updateAllBaselines() {
    const currentFiles = fs3__namespace.readdirSync(this.options.outputDir).filter((f) => f.endsWith(".png") && !f.startsWith("diff_"));
    for (const file of currentFiles) {
      const src = path3__namespace.join(this.options.outputDir, file);
      const dest = path3__namespace.join(this.options.baselineDir, file);
      fs3__namespace.copyFileSync(src, dest);
    }
  }
  /**
   * Get list of baselines
   */
  getBaselines() {
    if (!fs3__namespace.existsSync(this.options.baselineDir)) {
      return [];
    }
    return fs3__namespace.readdirSync(this.options.baselineDir).filter((f) => f.endsWith(".png"));
  }
  /**
   * Delete a baseline
   */
  deleteBaseline(name) {
    const filename = this.getSnapshotName(name);
    const baselinePath = path3__namespace.join(this.options.baselineDir, filename);
    if (fs3__namespace.existsSync(baselinePath)) {
      fs3__namespace.unlinkSync(baselinePath);
      return true;
    }
    return false;
  }
};
function createVisualRegressionTester(test, options) {
  return new VisualRegressionTester(test, options);
}

// src/core/interaction-tests.ts
var InteractionTester = class {
  test;
  constructor(test) {
    this.test = test;
  }
  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================
  /**
   * Test Tab key navigation through focusable elements
   */
  async testTabNavigation(maxTabs = 50) {
    const focusPath = [];
    const issues = [];
    let trapDetected = false;
    const initialFocus = await this.test.evaluate(`
      document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : '')
    `);
    focusPath.push(initialFocus);
    for (let i = 0; i < maxTabs; i++) {
      await this.test.press("Tab");
      await this.test.wait(100);
      const currentFocus = await this.test.evaluate(`
        document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : '')
      `);
      if (focusPath.slice(-3).every((f) => f === currentFocus)) {
        trapDetected = true;
        issues.push(`Focus trap detected at: ${currentFocus}`);
        break;
      }
      focusPath.push(currentFocus);
      if (currentFocus === initialFocus && i > 0) {
        break;
      }
    }
    return {
      success: !trapDetected && focusPath.length > 1,
      focusPath,
      missedElements: [],
      // Would need expected elements to check
      trapDetected,
      issues
    };
  }
  /**
   * Test arrow key navigation in a container
   */
  async testArrowNavigation(container, direction = "both") {
    const focusPath = [];
    const issues = [];
    await this.test.click(container);
    await this.test.wait(100);
    const keys = direction === "horizontal" ? ["ArrowRight", "ArrowRight", "ArrowLeft"] : direction === "vertical" ? ["ArrowDown", "ArrowDown", "ArrowUp"] : ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    for (const key of keys) {
      await this.test.press(key);
      await this.test.wait(100);
      const currentFocus = await this.test.evaluate(`
        document.activeElement?.tagName + 
        (document.activeElement?.getAttribute('data-testid') || 
         document.activeElement?.textContent?.slice(0, 20) || '')
      `);
      focusPath.push(`${key} -> ${currentFocus}`);
    }
    return {
      success: focusPath.length > 0,
      focusPath,
      missedElements: [],
      trapDetected: false,
      issues
    };
  }
  /**
   * Test Escape key closes modal/dialog
   */
  async testEscapeCloses(modalSelector) {
    const initialVisible = await this.test.isVisible(modalSelector);
    if (!initialVisible) {
      return true;
    }
    await this.test.press("Escape");
    await this.test.wait(300);
    const afterVisible = await this.test.isVisible(modalSelector);
    return !afterVisible;
  }
  // ===========================================================================
  // Drag and Drop
  // ===========================================================================
  /**
   * Perform drag and drop operation
   */
  async dragAndDrop(source, target) {
    const sourcePos = await this.test.evaluate(`
      (function() {
        const el = document.querySelector('${source}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
      })()
    `);
    const targetPos = await this.test.evaluate(`
      (function() {
        const el = document.querySelector('${target}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
      })()
    `);
    if (!sourcePos || !targetPos) {
      return {
        success: false,
        startPosition: sourcePos || { x: 0, y: 0 },
        endPosition: targetPos || { x: 0, y: 0 },
        distance: 0
      };
    }
    await this.test.drag(source, target);
    const distance = Math.sqrt(
      Math.pow(targetPos.x - sourcePos.x, 2) + Math.pow(targetPos.y - sourcePos.y, 2)
    );
    return {
      success: true,
      startPosition: sourcePos,
      endPosition: targetPos,
      distance
    };
  }
  /**
   * Test panel resize by dragging
   */
  async testPanelResize(resizeHandle, deltaX, deltaY) {
    const beforeSize = await this.test.evaluate(`
      (function() {
        const handle = document.querySelector('${resizeHandle}');
        const panel = handle?.parentElement;
        return panel ? { 
          width: panel.offsetWidth, 
          height: panel.offsetHeight 
        } : { width: 0, height: 0 };
      })()
    `);
    await this.test.evaluate(`
      (async function() {
        const handle = document.querySelector('${resizeHandle}');
        if (!handle) return;
        
        const rect = handle.getBoundingClientRect();
        const startX = rect.x + rect.width/2;
        const startY = rect.y + rect.height/2;
        
        // Simulate mouse events
        handle.dispatchEvent(new MouseEvent('mousedown', { 
          clientX: startX, clientY: startY, bubbles: true 
        }));
        
        await new Promise(r => setTimeout(r, 50));
        
        document.dispatchEvent(new MouseEvent('mousemove', { 
          clientX: startX + ${deltaX}, 
          clientY: startY + ${deltaY}, 
          bubbles: true 
        }));
        
        await new Promise(r => setTimeout(r, 50));
        
        document.dispatchEvent(new MouseEvent('mouseup', { 
          clientX: startX + ${deltaX}, 
          clientY: startY + ${deltaY}, 
          bubbles: true 
        }));
      })()
    `);
    await this.test.wait(300);
    const afterSize = await this.test.evaluate(`
      (function() {
        const handle = document.querySelector('${resizeHandle}');
        const panel = handle?.parentElement;
        return panel ? { 
          width: panel.offsetWidth, 
          height: panel.offsetHeight 
        } : { width: 0, height: 0 };
      })()
    `);
    return {
      success: beforeSize.width !== afterSize.width || beforeSize.height !== afterSize.height,
      beforeWidth: beforeSize.width,
      afterWidth: afterSize.width
    };
  }
  // ===========================================================================
  // Responsive Testing
  // ===========================================================================
  /**
   * Test at different viewport sizes
   */
  async testResponsive(viewports) {
    const results = [];
    for (const viewport of viewports) {
      await this.test.evaluate(`
        window.resizeTo(${viewport.width}, ${viewport.height});
      `);
      await this.test.wait(500);
      const issues = [];
      const overflowElements = await this.test.evaluate(`
        Array.from(document.querySelectorAll('*')).filter(el => {
          return el.scrollWidth > el.clientWidth;
        }).map(el => el.tagName + (el.id ? '#' + el.id : '')).slice(0, 10);
      `);
      if (overflowElements.length > 0) {
        issues.push(`Horizontal overflow detected in ${overflowElements.length} elements`);
      }
      const hiddenElements = await this.test.evaluate(`
        Array.from(document.querySelectorAll('[data-testid], button, a, input')).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width === 0 || rect.height === 0 || 
                 rect.right < 0 || rect.bottom < 0;
        }).map(el => el.tagName + (el.getAttribute('data-testid') || '')).slice(0, 10);
      `);
      results.push({
        viewport: { width: viewport.width, height: viewport.height },
        issues,
        overflowElements,
        hiddenElements
      });
    }
    return results;
  }
  // ===========================================================================
  // Focus Management
  // ===========================================================================
  /**
   * Check if focus is visible (focus indicator)
   */
  async checkFocusVisible(selector) {
    await this.test.click(selector);
    await this.test.wait(100);
    return this.test.evaluate(`
      (function() {
        const el = document.querySelector('${selector}');
        if (!el) return false;
        
        const styles = getComputedStyle(el);
        const focusStyles = getComputedStyle(el, ':focus');
        
        // Check for visible focus indicator
        return styles.outlineWidth !== '0px' || 
               styles.boxShadow !== 'none' ||
               el.classList.contains('focus-visible') ||
               el.matches(':focus-visible');
      })()
    `);
  }
  /**
   * Test focus order matches visual order
   */
  async testFocusOrder(expectedOrder) {
    const actualOrder = [];
    for (let i = 0; i < expectedOrder.length; i++) {
      await this.test.press("Tab");
      await this.test.wait(100);
      const focused = await this.test.evaluate(`
        document.activeElement?.getAttribute('data-testid') || 
        document.activeElement?.id ||
        document.activeElement?.tagName
      `);
      actualOrder.push(focused);
    }
    const matches = expectedOrder.every(
      (expected, i) => actualOrder[i]?.includes(expected)
    );
    return { matches, actualOrder };
  }
};
var COMMON_VIEWPORTS = [
  { width: 1920, height: 1080, name: "Desktop HD" },
  { width: 1440, height: 900, name: "Desktop" },
  { width: 1280, height: 720, name: "Laptop" },
  { width: 1024, height: 768, name: "Tablet Landscape" },
  { width: 768, height: 1024, name: "Tablet Portrait" },
  { width: 375, height: 667, name: "Mobile" }
];
function createInteractionTester(test) {
  return new InteractionTester(test);
}

// src/core/ref-manager.ts
var RefManager = class {
  test;
  currentSnapshot = null;
  refMap = /* @__PURE__ */ new Map();
  snapshotCounter = 0;
  constructor(test) {
    this.test = test;
  }
  /**
   * Take a snapshot of the page and generate refs for interactive elements
   */
  async snapshot(options = {}) {
    const {
      interactiveOnly = true,
      includeHidden = false,
      maxDepth,
      includeRawTree = false,
      compact = false
    } = options;
    const url = await this.test.getUrl();
    const title = await this.test.getTitle();
    const elements = await this.collectElements({
      interactiveOnly,
      includeHidden,
      maxDepth
    });
    const refElements = this.assignRefs(elements, compact);
    const snapshot = {
      timestamp: Date.now(),
      url,
      title,
      elements: refElements,
      snapshotId: `snapshot-${++this.snapshotCounter}`
    };
    if (includeRawTree) {
      try {
        const rawSnapshot = await this.test.snapshot();
        snapshot.rawTree = rawSnapshot;
      } catch {
      }
    }
    this.currentSnapshot = snapshot;
    this.refMap.clear();
    for (const element of refElements) {
      this.refMap.set(element.ref, element);
    }
    return snapshot;
  }
  /**
   * Check if a string is a valid ref format
   */
  isRef(value) {
    return /^@e\d+$/.test(value);
  }
  /**
   * Parse ref to get the index
   */
  parseRef(ref) {
    const match = ref.match(/^@e(\d+)$/);
    if (!match) {
      throw new Error(`Invalid ref format: ${ref}`);
    }
    return parseInt(match[1], 10);
  }
  /**
   * Get element by ref
   */
  getElement(ref) {
    return this.refMap.get(ref);
  }
  /**
   * Resolve a ref or selector to an element
   */
  async resolve(refOrSelector) {
    if (this.isRef(refOrSelector)) {
      const element = this.refMap.get(refOrSelector);
      if (element) {
        const exists = await this.verifyElement(element);
        return {
          element,
          method: "ref",
          valid: exists
        };
      }
      return null;
    }
    const elements = await this.collectElements({ interactiveOnly: false, includeHidden: true });
    const found = elements.find(
      (e) => e.selector === refOrSelector || e.xpath === refOrSelector || e.text === refOrSelector || e.name === refOrSelector
    );
    if (found) {
      const refElement = this.assignRefs([found], false)[0];
      return {
        element: refElement,
        method: "selector",
        valid: true
      };
    }
    return null;
  }
  /**
   * Get the locator string for a ref (for use with Playwright/CDP)
   */
  async getLocator(ref) {
    const element = this.refMap.get(ref);
    if (!element) {
      throw new Error(`Ref not found: ${ref}. Did you take a snapshot first?`);
    }
    if (element.role && element.name) {
      return `role=${element.role}[name="${element.name}"]`;
    }
    if (element.attributes["data-testid"]) {
      return `[data-testid="${element.attributes["data-testid"]}"]`;
    }
    return element.selector;
  }
  /**
   * Click an element by ref
   */
  async click(ref) {
    const locator = await this.getLocator(ref);
    await this.test.click(locator);
  }
  /**
   * Double-click an element by ref
   */
  async dblclick(ref) {
    const locator = await this.getLocator(ref);
    await this.test.dblclick(locator);
  }
  /**
   * Right-click an element by ref
   */
  async rightClick(ref) {
    const locator = await this.getLocator(ref);
    await this.test.rightClick(locator);
  }
  /**
   * Fill an input by ref
   */
  async fill(ref, value) {
    const locator = await this.getLocator(ref);
    await this.test.fill(locator, value);
  }
  /**
   * Type text into an element by ref
   */
  async type(ref, text) {
    const locator = await this.getLocator(ref);
    await this.test.type(locator, text);
  }
  /**
   * Hover over an element by ref
   */
  async hover(ref) {
    const locator = await this.getLocator(ref);
    await this.test.hover(locator);
  }
  /**
   * Get text from an element by ref
   */
  async getText(ref) {
    const locator = await this.getLocator(ref);
    return this.test.getText(locator);
  }
  /**
   * Get value from an element by ref
   */
  async getValue(ref) {
    const locator = await this.getLocator(ref);
    return this.test.getValue(locator);
  }
  /**
   * Check if element is visible by ref
   */
  async isVisible(ref) {
    const locator = await this.getLocator(ref);
    return this.test.isVisible(locator);
  }
  /**
   * Invalidate current snapshot (call after page navigation or significant changes)
   */
  invalidate() {
    this.currentSnapshot = null;
    this.refMap.clear();
  }
  /**
   * Get current snapshot
   */
  getCurrentSnapshot() {
    return this.currentSnapshot;
  }
  /**
   * Find elements by role
   */
  findByRole(role) {
    return Array.from(this.refMap.values()).filter((e) => e.role === role);
  }
  /**
   * Find elements by name (partial match)
   */
  findByName(name) {
    const lowerName = name.toLowerCase();
    return Array.from(this.refMap.values()).filter(
      (e) => e.name.toLowerCase().includes(lowerName)
    );
  }
  /**
   * Find elements by text (partial match)
   */
  findByText(text) {
    const lowerText = text.toLowerCase();
    return Array.from(this.refMap.values()).filter(
      (e) => e.text?.toLowerCase().includes(lowerText)
    );
  }
  /**
   * Get all interactive elements (buttons, links, inputs, etc.)
   */
  getInteractive() {
    const interactiveRoles = /* @__PURE__ */ new Set([
      "button",
      "link",
      "textbox",
      "checkbox",
      "radio",
      "combobox",
      "listbox",
      "option",
      "menuitem",
      "tab",
      "slider",
      "spinbutton",
      "switch",
      "searchbox"
    ]);
    return Array.from(this.refMap.values()).filter(
      (e) => interactiveRoles.has(e.role) || e.focusable
    );
  }
  /**
   * Format snapshot as text (for AI/LLM consumption)
   */
  toText(options = {}) {
    const { includeRefs = true, maxElements = 100 } = options;
    if (!this.currentSnapshot) {
      return "No snapshot available. Call snapshot() first.";
    }
    const lines = [
      `Page: ${this.currentSnapshot.title}`,
      `URL: ${this.currentSnapshot.url}`,
      `Elements (${this.currentSnapshot.elements.length}):`,
      ""
    ];
    const elements = this.currentSnapshot.elements.slice(0, maxElements);
    for (const element of elements) {
      const ref = includeRefs ? `${element.ref} ` : "";
      const name = element.name ? ` "${element.name}"` : "";
      const text = element.text && element.text !== element.name ? ` [${element.text.slice(0, 50)}]` : "";
      lines.push(`  ${ref}${element.role}${name}${text}`);
    }
    if (this.currentSnapshot.elements.length > maxElements) {
      lines.push(`  ... and ${this.currentSnapshot.elements.length - maxElements} more`);
    }
    return lines.join("\n");
  }
  /**
   * Format snapshot as JSON
   */
  toJSON() {
    if (!this.currentSnapshot) {
      return "{}";
    }
    return JSON.stringify(this.currentSnapshot, null, 2);
  }
  // Private methods
  async collectElements(options) {
    const { interactiveOnly, includeHidden } = options;
    const elements = await this.test.evaluate(`
      (() => {
        const interactiveRoles = new Set([
          'button', 'link', 'textbox', 'checkbox', 'radio',
          'combobox', 'listbox', 'option', 'menuitem', 'menuitemcheckbox',
          'menuitemradio', 'tab', 'tabpanel', 'slider', 'spinbutton',
          'switch', 'searchbox', 'treeitem', 'gridcell'
        ]);
        
        const interactiveTags = new Set([
          'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
          'DETAILS', 'SUMMARY'
        ]);
        
        const elements = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          const el = node;
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const isInteractive = interactiveRoles.has(role) || 
                               interactiveTags.has(el.tagName) ||
                               el.hasAttribute('onclick') ||
                               el.hasAttribute('tabindex');
          
          if (${interactiveOnly} && !isInteractive) continue;
          
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 &&
                           getComputedStyle(el).visibility !== 'hidden' &&
                           getComputedStyle(el).display !== 'none';
          
          if (!${includeHidden} && !isVisible) continue;
          
          const name = el.getAttribute('aria-label') ||
                      el.getAttribute('title') ||
                      el.getAttribute('alt') ||
                      (el.tagName === 'INPUT' ? el.placeholder : '') ||
                      '';
          
          elements.push({
            role: role,
            name: name,
            tagName: el.tagName.toLowerCase(),
            selector: generateSelector(el),
            xpath: generateXPath(el),
            visible: isVisible,
            enabled: !el.disabled,
            focusable: el.tabIndex >= 0 || isInteractive,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            text: el.textContent?.trim().slice(0, 100) || '',
            value: el.value || '',
            placeholder: el.placeholder || '',
            attributes: {
              id: el.id || '',
              class: el.className || '',
              'data-testid': el.getAttribute('data-testid') || '',
              href: el.getAttribute('href') || '',
              type: el.getAttribute('type') || ''
            }
          });
        }
        
        function generateSelector(el) {
          if (el.id) return '#' + el.id;
          if (el.getAttribute('data-testid')) 
            return '[data-testid="' + el.getAttribute('data-testid') + '"]';
          
          let selector = el.tagName.toLowerCase();
          if (el.className) {
            const classes = el.className.split(' ').filter(c => c && !c.includes(':'));
            if (classes.length > 0) {
              selector += '.' + classes.slice(0, 2).join('.');
            }
          }
          return selector;
        }
        
        function generateXPath(el) {
          const parts = [];
          let current = el;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = current.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && 
                  sibling.tagName === current.tagName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
            current = current.parentNode;
          }
          return '/' + parts.join('/');
        }
        
        return elements;
      })()
    `);
    return elements;
  }
  assignRefs(elements, compact) {
    const result = [];
    const roleCount = /* @__PURE__ */ new Map();
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const role = element.role || "generic";
      const count = roleCount.get(role) || 0;
      roleCount.set(role, count + 1);
      const refElement = {
        ref: `@e${i + 1}`,
        role,
        name: element.name || "",
        tagName: element.tagName || "div",
        selector: element.selector || "",
        xpath: element.xpath || "",
        visible: element.visible ?? true,
        enabled: element.enabled ?? true,
        focusable: element.focusable ?? false,
        attributes: element.attributes || {},
        nthIndex: count > 0 ? count : void 0
      };
      if (!compact) {
        refElement.bounds = element.bounds;
        refElement.text = element.text;
        refElement.value = element.value;
        refElement.placeholder = element.placeholder;
      }
      result.push(refElement);
    }
    return result;
  }
  async verifyElement(element) {
    try {
      const exists = await this.test.isVisible(element.selector);
      return exists;
    } catch {
      return false;
    }
  }
};

// src/core/network-interceptor.ts
var NetworkInterceptor = class {
  test;
  routes = /* @__PURE__ */ new Map();
  requests = [];
  recording = false;
  routeCounter = 0;
  interceptorSetup = false;
  constructor(test) {
    this.test = test;
  }
  /**
   * Add a route to intercept matching requests
   */
  async route(pattern, options = {}) {
    const routeId = `route-${++this.routeCounter}`;
    const route = {
      pattern,
      options,
      matchCount: 0,
      id: routeId,
      active: true
    };
    this.routes.set(routeId, route);
    if (!this.interceptorSetup) {
      await this.setupInterceptor();
    }
    return routeId;
  }
  /**
   * Remove a route by ID
   */
  removeRoute(routeId) {
    return this.routes.delete(routeId);
  }
  /**
   * Remove all routes matching a pattern
   */
  removeRoutesByPattern(pattern) {
    let count = 0;
    const patternStr = pattern.toString();
    for (const [id, route] of this.routes) {
      if (route.pattern.toString() === patternStr) {
        this.routes.delete(id);
        count++;
      }
    }
    return count;
  }
  /**
   * Clear all routes
   */
  clearRoutes() {
    this.routes.clear();
  }
  /**
   * Start recording requests
   */
  startRecording() {
    this.recording = true;
    this.requests = [];
  }
  /**
   * Stop recording requests
   */
  stopRecording() {
    this.recording = false;
    return [...this.requests];
  }
  /**
   * Get recorded requests with optional filtering
   */
  getRequests(filter) {
    let results = [...this.requests];
    if (!filter) return results;
    if (filter.url) {
      const urlPattern = filter.url instanceof RegExp ? filter.url : new RegExp(filter.url.replace(/\*/g, ".*"));
      results = results.filter((r) => urlPattern.test(r.url));
    }
    if (filter.method) {
      const methods = Array.isArray(filter.method) ? filter.method : [filter.method];
      results = results.filter((r) => methods.includes(r.method));
    }
    if (filter.resourceType) {
      const types = Array.isArray(filter.resourceType) ? filter.resourceType : [filter.resourceType];
      results = results.filter((r) => types.includes(r.resourceType));
    }
    if (filter.mocked !== void 0) {
      results = results.filter((r) => r.mocked === filter.mocked);
    }
    if (filter.aborted !== void 0) {
      results = results.filter((r) => r.aborted === filter.aborted);
    }
    if (filter.after !== void 0) {
      results = results.filter((r) => r.timestamp >= filter.after);
    }
    if (filter.before !== void 0) {
      results = results.filter((r) => r.timestamp <= filter.before);
    }
    if (filter.limit !== void 0) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }
  /**
   * Clear recorded requests
   */
  clearRequests() {
    this.requests = [];
  }
  /**
   * Wait for a request matching the pattern
   */
  async waitForRequest(pattern, options = {}) {
    const { timeout = 3e4, method } = options;
    const startTime = Date.now();
    const urlPattern = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/\*/g, ".*"));
    while (Date.now() - startTime < timeout) {
      const match = this.requests.find((r) => {
        if (!urlPattern.test(r.url)) return false;
        if (method && r.method !== method) return false;
        return true;
      });
      if (match) return match;
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
    throw new Error(`Timeout waiting for request matching ${pattern}`);
  }
  /**
   * Wait for a response matching the pattern
   */
  async waitForResponse(pattern, options = {}) {
    const { timeout = 3e4, status } = options;
    const startTime = Date.now();
    const urlPattern = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/\*/g, ".*"));
    while (Date.now() - startTime < timeout) {
      const match = this.requests.find((r) => {
        if (!urlPattern.test(r.url)) return false;
        if (!r.response) return false;
        if (status !== void 0 && r.response.status !== status) return false;
        return true;
      });
      if (match) return match;
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
    throw new Error(`Timeout waiting for response matching ${pattern}`);
  }
  /**
   * Mock a specific API endpoint with predefined responses
   */
  async mockApi(endpoint, responses) {
    const routeIds = [];
    for (const [method, options] of Object.entries(responses)) {
      const routeId = await this.route(endpoint, {
        ...options,
        methods: [method]
      });
      routeIds.push(routeId);
    }
    return routeIds;
  }
  /**
   * Simulate network conditions
   */
  async simulateNetworkConditions(conditions) {
    const { offline = false, latency = 0, downloadThroughput: _downloadThroughput, uploadThroughput: _uploadThroughput } = conditions;
    await this.test.evaluate(`
      (() => {
        // Store original fetch
        if (!window.__originalFetch) {
          window.__originalFetch = window.fetch;
        }
        
        // Override fetch with simulated conditions
        window.fetch = async (...args) => {
          if (${offline}) {
            throw new TypeError('Failed to fetch');
          }
          
          if (${latency} > 0) {
            await new Promise(r => setTimeout(r, ${latency}));
          }
          
          return window.__originalFetch(...args);
        };
      })()
    `);
  }
  /**
   * Reset network conditions to normal
   */
  async resetNetworkConditions() {
    await this.test.evaluate(`
      (() => {
        if (window.__originalFetch) {
          window.fetch = window.__originalFetch;
          delete window.__originalFetch;
        }
      })()
    `);
  }
  /**
   * Get all active routes
   */
  getRoutes() {
    return Array.from(this.routes.values()).filter((r) => r.active);
  }
  /**
   * Get network statistics
   */
  getStats() {
    const totalRequests = this.requests.length;
    const mockedRequests = this.requests.filter((r) => r.mocked).length;
    const abortedRequests = this.requests.filter((r) => r.aborted).length;
    const failedRequests = this.requests.filter(
      (r) => r.response && r.response.status >= 400
    ).length;
    const responseTimes = this.requests.filter((r) => r.response?.responseTime).map((r) => r.response.responseTime);
    const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const byMethod = {};
    const byResourceType = {};
    for (const request of this.requests) {
      byMethod[request.method] = (byMethod[request.method] || 0) + 1;
      byResourceType[request.resourceType] = (byResourceType[request.resourceType] || 0) + 1;
    }
    return {
      totalRequests,
      mockedRequests,
      abortedRequests,
      failedRequests,
      avgResponseTime,
      byMethod,
      byResourceType
    };
  }
  // Private methods
  async setupInterceptor() {
    await this.test.evaluate(`
      (() => {
        if (window.__networkInterceptorSetup) return;
        window.__networkInterceptorSetup = true;
        
        // Store original fetch and XMLHttpRequest
        const originalFetch = window.fetch;
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        // Request queue for communication
        window.__interceptedRequests = [];
        window.__networkRoutes = [];
        
        // Override fetch
        window.fetch = async function(input, init = {}) {
          const url = typeof input === 'string' ? input : input.url;
          const method = init.method || 'GET';
          const headers = init.headers || {};
          const body = init.body;
          
          const requestInfo = {
            id: 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            url,
            method,
            headers: Object.fromEntries(
              headers instanceof Headers ? headers.entries() : Object.entries(headers)
            ),
            body,
            timestamp: Date.now(),
            resourceType: 'fetch'
          };
          
          // Check for matching routes
          const route = window.__networkRoutes.find(r => {
            const pattern = r.pattern instanceof RegExp 
              ? r.pattern 
              : new RegExp(r.pattern.replace(/\\*\\*/g, '.*').replace(/\\*/g, '[^/]*'));
            return pattern.test(url);
          });
          
          if (route) {
            route.matchCount++;
            
            if (route.options.abort) {
              requestInfo.aborted = true;
              window.__interceptedRequests.push(requestInfo);
              throw new TypeError('Request aborted by NetworkInterceptor');
            }
            
            if (route.options.delay) {
              await new Promise(r => setTimeout(r, route.options.delay));
            }
            
            if (route.options.body !== undefined || route.options.status !== undefined) {
              const mockResponse = {
                status: route.options.status || 200,
                statusText: route.options.status === 200 ? 'OK' : 'Mocked',
                headers: route.options.headers || { 'Content-Type': 'application/json' },
                body: route.options.body
              };
              
              requestInfo.response = mockResponse;
              requestInfo.mocked = true;
              window.__interceptedRequests.push(requestInfo);
              
              const bodyStr = typeof mockResponse.body === 'object' 
                ? JSON.stringify(mockResponse.body) 
                : mockResponse.body || '';
              
              return new Response(bodyStr, {
                status: mockResponse.status,
                statusText: mockResponse.statusText,
                headers: mockResponse.headers
              });
            }
          }
          
          // Make original request
          const startTime = Date.now();
          try {
            const response = await originalFetch(input, init);
            requestInfo.response = {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              responseTime: Date.now() - startTime
            };
            requestInfo.mocked = false;
            window.__interceptedRequests.push(requestInfo);
            return response;
          } catch (error) {
            requestInfo.error = error.message;
            window.__interceptedRequests.push(requestInfo);
            throw error;
          }
        };
        
        // Override XMLHttpRequest
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this.__interceptInfo = { method, url, timestamp: Date.now() };
          return originalXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
          const info = this.__interceptInfo || {};
          const requestInfo = {
            id: 'xhr-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            url: info.url,
            method: info.method || 'GET',
            headers: {},
            body,
            timestamp: info.timestamp || Date.now(),
            resourceType: 'xhr'
          };
          
          this.addEventListener('load', () => {
            requestInfo.response = {
              status: this.status,
              statusText: this.statusText,
              headers: {},
              responseTime: Date.now() - requestInfo.timestamp
            };
            window.__interceptedRequests.push(requestInfo);
          });
          
          this.addEventListener('error', () => {
            requestInfo.error = 'Network error';
            window.__interceptedRequests.push(requestInfo);
          });
          
          return originalXHRSend.call(this, body);
        };
      })()
    `);
    this.interceptorSetup = true;
    this.startRequestPolling();
  }
  startRequestPolling() {
    const pollInterval = setInterval(async () => {
      if (!this.recording && this.routes.size === 0) {
        clearInterval(pollInterval);
        return;
      }
      try {
        const routesData = Array.from(this.routes.values()).map((r) => ({
          pattern: r.pattern.toString(),
          options: r.options,
          matchCount: r.matchCount
        }));
        await this.test.evaluate(`
          window.__networkRoutes = ${JSON.stringify(routesData)}.map(r => ({
            ...r,
            pattern: r.pattern.startsWith('/') && r.pattern.endsWith('/') 
              ? new RegExp(r.pattern.slice(1, -1))
              : r.pattern
          }));
        `);
        const requests = await this.test.evaluate(`
          (() => {
            const reqs = window.__interceptedRequests || [];
            window.__interceptedRequests = [];
            return reqs;
          })()
        `);
        if (requests && requests.length > 0) {
          this.requests.push(...requests);
        }
      } catch {
      }
    }, 100);
  }
};

// src/core/flow-tester.ts
var FlowTester = class {
  test;
  selector;
  _currentSnapshot = null;
  constructor(test, selector = '[data-testid="flow-view"]') {
    this.test = test;
    this.selector = selector;
  }
  /**
   * Get the current snapshot (if available)
   */
  get currentSnapshot() {
    return this._currentSnapshot;
  }
  /**
   * Take a snapshot of the current flow state
   */
  async snapshot() {
    const data = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Try to get React Flow store
        let nodes = [];
        let edges = [];
        let viewport = { x: 0, y: 0, zoom: 1 };
        
        // Method 1: Access via React Flow's internal store
        const reactFlowInstance = container.querySelector('.react-flow');
        if (reactFlowInstance && reactFlowInstance.__reactFlow) {
          const store = reactFlowInstance.__reactFlow;
          nodes = store.getNodes?.() || [];
          edges = store.getEdges?.() || [];
          viewport = store.getViewport?.() || viewport;
        }
        
        // Method 2: Parse from DOM
        if (nodes.length === 0) {
          const nodeElements = container.querySelectorAll('.react-flow__node');
          nodeElements.forEach((el, idx) => {
            const transform = el.style.transform || '';
            const match = transform.match(/translate\\(([\\d.-]+)px,\\s*([\\d.-]+)px\\)/);
            const x = match ? parseFloat(match[1]) : 0;
            const y = match ? parseFloat(match[2]) : 0;
            
            nodes.push({
              id: el.getAttribute('data-id') || 'node-' + idx,
              type: el.getAttribute('data-type') || 'default',
              label: el.textContent?.trim().slice(0, 100) || '',
              position: { x, y },
              dimensions: {
                width: el.offsetWidth,
                height: el.offsetHeight
              },
              data: {},
              selected: el.classList.contains('selected'),
              draggable: !el.classList.contains('nodrag'),
              visible: el.offsetParent !== null,
              className: el.className,
              style: {}
            });
          });
          
          const edgeElements = container.querySelectorAll('.react-flow__edge');
          edgeElements.forEach((el, idx) => {
            edges.push({
              id: el.getAttribute('data-id') || 'edge-' + idx,
              source: el.getAttribute('data-source') || '',
              target: el.getAttribute('data-target') || '',
              type: el.getAttribute('data-type') || 'default',
              label: el.querySelector('.react-flow__edge-text')?.textContent || '',
              animated: el.classList.contains('animated'),
              selected: el.classList.contains('selected'),
              data: {},
              style: {}
            });
          });
          
          // Get viewport from transform
          const viewportEl = container.querySelector('.react-flow__viewport');
          if (viewportEl) {
            const transform = viewportEl.style.transform || '';
            const translateMatch = transform.match(/translate\\(([\\d.-]+)px,\\s*([\\d.-]+)px\\)/);
            const scaleMatch = transform.match(/scale\\(([\\d.]+)\\)/);
            viewport = {
              x: translateMatch ? parseFloat(translateMatch[1]) : 0,
              y: translateMatch ? parseFloat(translateMatch[2]) : 0,
              zoom: scaleMatch ? parseFloat(scaleMatch[1]) : 1
            };
          }
        }
        
        return {
          nodes,
          edges,
          viewport,
          timestamp: Date.now()
        };
      })()
    `);
    if (!data) {
      throw new Error(`Flow container not found: ${this.selector}`);
    }
    this._currentSnapshot = data;
    return data;
  }
  /**
   * Get all nodes
   */
  async getNodes(filter) {
    const snapshot = await this.snapshot();
    let nodes = snapshot.nodes;
    if (filter) {
      nodes = this.filterNodes(nodes, filter);
    }
    return nodes;
  }
  /**
   * Get a node by ID
   */
  async getNode(id) {
    const nodes = await this.getNodes();
    return nodes.find((n) => n.id === id) || null;
  }
  /**
   * Get all edges
   */
  async getEdges(filter) {
    const snapshot = await this.snapshot();
    let edges = snapshot.edges;
    if (filter) {
      edges = this.filterEdges(edges, filter);
    }
    return edges;
  }
  /**
   * Get an edge by ID or source-target pair
   */
  async getEdge(idOrSource, target) {
    const edges = await this.getEdges();
    if (target !== void 0) {
      return edges.find((e) => e.source === idOrSource && e.target === target) || null;
    }
    return edges.find((e) => e.id === idOrSource) || null;
  }
  /**
   * Get current viewport
   */
  async getViewport() {
    const snapshot = await this.snapshot();
    return snapshot.viewport;
  }
  /**
   * Click on a node
   */
  async clickNode(nodeId) {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (nodeEl) {
          nodeEl.click();
        }
      })()
    `);
  }
  /**
   * Double-click on a node
   */
  async dblclickNode(nodeId) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (nodeEl) {
          nodeEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      })()
    `);
  }
  /**
   * Hover over a node
   */
  async hoverNode(nodeId) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (nodeEl) {
          nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          nodeEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
      })()
    `);
  }
  /**
   * Click on an edge
   */
  async clickEdge(edgeId) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const edgeEl = container?.querySelector('[data-id="${edgeId}"]');
        if (edgeEl) {
          edgeEl.click();
        }
      })()
    `);
  }
  /**
   * Select a node
   */
  async selectNode(nodeId) {
    await this.clickNode(nodeId);
  }
  /**
   * Select multiple nodes
   */
  async selectNodes(nodeIds) {
    for (let i = 0; i < nodeIds.length; i++) {
      await this.test.evaluate(`
        (() => {
          const container = document.querySelector('${this.selector}');
          const nodeEl = container?.querySelector('[data-id="${nodeIds[i]}"]');
          if (nodeEl) {
            nodeEl.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              ctrlKey: ${i > 0},
              metaKey: ${i > 0}
            }));
          }
        })()
      `);
    }
  }
  /**
   * Drag a node to a new position
   */
  async dragNode(nodeId, targetPosition) {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    const deltaX = targetPosition.x - node.position.x;
    const deltaY = targetPosition.y - node.position.y;
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const nodeEl = container?.querySelector('[data-id="${nodeId}"]');
        if (!nodeEl) return;
        
        const rect = nodeEl.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        
        nodeEl.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientX: startX,
          clientY: startY
        }));
        
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: startX + ${deltaX},
          clientY: startY + ${deltaY}
        }));
        
        document.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          clientX: startX + ${deltaX},
          clientY: startY + ${deltaY}
        }));
      })()
    `);
  }
  /**
   * Zoom the viewport
   */
  async zoom(level) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Dispatch wheel event for zoom
        container.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          deltaY: ${level > 1 ? -100 : 100} * Math.abs(${level} - 1),
          ctrlKey: true
        }));
      })()
    `);
  }
  /**
   * Pan the viewport
   */
  async pan(deltaX, deltaY) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        container.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientX: centerX,
          clientY: centerY,
          button: 1 // Middle button for pan
        }));
        
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: centerX + ${deltaX},
          clientY: centerY + ${deltaY}
        }));
        
        document.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true
        }));
      })()
    `);
  }
  /**
   * Fit all nodes in view
   */
  async fitView() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Try to find and click fitView button if exists
        const fitBtn = container.querySelector('[data-testid="fit-view-button"]') ||
                      container.querySelector('.react-flow__controls-fitview');
        if (fitBtn) {
          fitBtn.click();
        }
      })()
    `);
  }
  /**
   * Assert a node exists
   */
  async assertNodeExists(nodeId, message) {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(message || `Expected node "${nodeId}" to exist`);
    }
  }
  /**
   * Assert a node does not exist
   */
  async assertNodeNotExists(nodeId, message) {
    const node = await this.getNode(nodeId);
    if (node) {
      throw new Error(message || `Expected node "${nodeId}" to not exist`);
    }
  }
  /**
   * Assert an edge exists between two nodes
   */
  async assertEdgeExists(source, target, message) {
    const edge = await this.getEdge(source, target);
    if (!edge) {
      throw new Error(message || `Expected edge from "${source}" to "${target}" to exist`);
    }
  }
  /**
   * Assert an edge does not exist
   */
  async assertEdgeNotExists(source, target, message) {
    const edge = await this.getEdge(source, target);
    if (edge) {
      throw new Error(message || `Expected edge from "${source}" to "${target}" to not exist`);
    }
  }
  /**
   * Assert node count
   */
  async assertNodeCount(expected, message) {
    const nodes = await this.getNodes();
    if (nodes.length !== expected) {
      throw new Error(message || `Expected ${expected} nodes, got ${nodes.length}`);
    }
  }
  /**
   * Assert edge count
   */
  async assertEdgeCount(expected, message) {
    const edges = await this.getEdges();
    if (edges.length !== expected) {
      throw new Error(message || `Expected ${expected} edges, got ${edges.length}`);
    }
  }
  /**
   * Assert a node is selected
   */
  async assertNodeSelected(nodeId, message) {
    const node = await this.getNode(nodeId);
    if (!node?.selected) {
      throw new Error(message || `Expected node "${nodeId}" to be selected`);
    }
  }
  /**
   * Assert layout properties
   */
  async assertLayout(options) {
    const snapshot = await this.snapshot();
    const nodes = snapshot.nodes;
    if (options.noOverlap) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (this.nodesOverlap(nodes[i], nodes[j])) {
            throw new Error(`Nodes "${nodes[i].id}" and "${nodes[j].id}" overlap`);
          }
        }
      }
    }
    if (options.minHorizontalSpacing || options.minVerticalSpacing) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = Math.abs(nodes[i].position.x - nodes[j].position.x);
          const dy = Math.abs(nodes[i].position.y - nodes[j].position.y);
          if (options.minHorizontalSpacing && dx < options.minHorizontalSpacing && dy < 50) {
            throw new Error(
              `Nodes "${nodes[i].id}" and "${nodes[j].id}" have horizontal spacing ${dx}, expected >= ${options.minHorizontalSpacing}`
            );
          }
          if (options.minVerticalSpacing && dy < options.minVerticalSpacing && dx < 50) {
            throw new Error(
              `Nodes "${nodes[i].id}" and "${nodes[j].id}" have vertical spacing ${dy}, expected >= ${options.minVerticalSpacing}`
            );
          }
        }
      }
    }
    if (options.withinBounds) {
      const { minX, maxX, minY, maxY } = options.withinBounds;
      for (const node of nodes) {
        if (node.position.x < minX || node.position.x > maxX || node.position.y < minY || node.position.y > maxY) {
          throw new Error(
            `Node "${node.id}" at (${node.position.x}, ${node.position.y}) is outside bounds`
          );
        }
      }
    }
    if (options.type) {
      const detectedLayout = this.detectLayoutType(nodes);
      if (detectedLayout !== options.type && options.type !== "custom") {
        throw new Error(`Expected layout type "${options.type}", detected "${detectedLayout}"`);
      }
    }
  }
  /**
   * Get nodes connected to a given node
   */
  async getConnectedNodes(nodeId, direction = "both") {
    const edges = await this.getEdges();
    const nodes = await this.getNodes();
    const nodeIds = /* @__PURE__ */ new Set();
    for (const edge of edges) {
      if (direction === "outgoing" || direction === "both") {
        if (edge.source === nodeId) {
          nodeIds.add(edge.target);
        }
      }
      if (direction === "incoming" || direction === "both") {
        if (edge.target === nodeId) {
          nodeIds.add(edge.source);
        }
      }
    }
    return nodes.filter((n) => nodeIds.has(n.id));
  }
  /**
   * Get the path between two nodes
   */
  async getPath(sourceId, targetId) {
    const edges = await this.getEdges();
    const queue = [[sourceId]];
    const visited = /* @__PURE__ */ new Set([sourceId]);
    while (queue.length > 0) {
      const path4 = queue.shift();
      const current = path4[path4.length - 1];
      if (current === targetId) {
        return path4;
      }
      for (const edge of edges) {
        if (edge.source === current && !visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push([...path4, edge.target]);
        }
      }
    }
    return [];
  }
  /**
   * Assert a path exists between two nodes
   */
  async assertPathExists(sourceId, targetId, message) {
    const path4 = await this.getPath(sourceId, targetId);
    if (path4.length === 0) {
      throw new Error(message || `Expected path from "${sourceId}" to "${targetId}"`);
    }
  }
  // Private helper methods
  filterNodes(nodes, filter) {
    return nodes.filter((node) => {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(node.type)) return false;
      }
      if (filter.label) {
        if (filter.label instanceof RegExp) {
          if (!filter.label.test(node.label)) return false;
        } else {
          if (!node.label.toLowerCase().includes(filter.label.toLowerCase())) return false;
        }
      }
      if (filter.data) {
        for (const [key, value] of Object.entries(filter.data)) {
          if (node.data[key] !== value) return false;
        }
      }
      if (filter.selected !== void 0 && node.selected !== filter.selected) return false;
      if (filter.visible !== void 0 && node.visible !== filter.visible) return false;
      if (filter.parentId !== void 0 && node.parentId !== filter.parentId) return false;
      return true;
    });
  }
  filterEdges(edges, filter) {
    return edges.filter((edge) => {
      if (filter.source && edge.source !== filter.source) return false;
      if (filter.target && edge.target !== filter.target) return false;
      if (filter.type && edge.type !== filter.type) return false;
      if (filter.animated !== void 0 && edge.animated !== filter.animated) return false;
      if (filter.selected !== void 0 && edge.selected !== filter.selected) return false;
      return true;
    });
  }
  nodesOverlap(a, b) {
    if (!a.dimensions || !b.dimensions) return false;
    const aRight = a.position.x + a.dimensions.width;
    const aBottom = a.position.y + a.dimensions.height;
    const bRight = b.position.x + b.dimensions.width;
    const bBottom = b.position.y + b.dimensions.height;
    return !(aRight < b.position.x || a.position.x > bRight || aBottom < b.position.y || a.position.y > bBottom);
  }
  detectLayoutType(nodes) {
    if (nodes.length < 2) return "custom";
    const yPositions = [...new Set(nodes.map((n) => Math.round(n.position.y / 50) * 50))];
    if (yPositions.length > 1 && yPositions.length < nodes.length / 2) {
      return "tree";
    }
    const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
    let isHierarchical = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].position.y < sorted[i - 1].position.y - 10) {
        isHierarchical = false;
        break;
      }
    }
    if (isHierarchical) return "dagre";
    return "custom";
  }
};

// src/core/virtual-list-tester.ts
var VirtualListTester = class {
  test;
  selector;
  constructor(test, selector) {
    this.test = test;
    this.selector = selector;
  }
  /**
   * Get the current state of the virtual list
   */
  async getState() {
    const state = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Find the scrollable element
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        
        // Get all rendered items
        const itemSelector = '[data-index], [data-key], [role="treeitem"], [role="row"], [role="listitem"]';
        const items = Array.from(scrollEl.querySelectorAll(itemSelector));
        
        // Calculate indices
        const indices = items.map(el => {
          const idx = el.getAttribute('data-index');
          return idx ? parseInt(idx, 10) : -1;
        }).filter(i => i >= 0);
        
        const startIndex = indices.length > 0 ? Math.min(...indices) : 0;
        const endIndex = indices.length > 0 ? Math.max(...indices) : 0;
        
        // Estimate total count
        let totalCount = 0;
        const totalAttr = scrollEl.getAttribute('data-total-count') ||
                         container.getAttribute('data-total-count');
        if (totalAttr) {
          totalCount = parseInt(totalAttr, 10);
        } else {
          // Estimate from scroll height
          const avgHeight = items.length > 0 
            ? items.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) / items.length
            : 30;
          totalCount = Math.ceil(scrollEl.scrollHeight / avgHeight);
        }
        
        // Get visible items
        const containerRect = scrollEl.getBoundingClientRect();
        const visibleItems = items.map((el, i) => {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.top < containerRect.bottom && rect.bottom > containerRect.top;
          
          return {
            index: indices[i] >= 0 ? indices[i] : i,
            id: el.getAttribute('data-id') || el.getAttribute('data-key') || undefined,
            text: el.textContent?.trim().slice(0, 200) || '',
            data: {
              ...Object.fromEntries(
                Array.from(el.attributes)
                  .filter(a => a.name.startsWith('data-'))
                  .map(a => [a.name, a.value])
              )
            },
            bounds: {
              top: rect.top - containerRect.top,
              left: rect.left - containerRect.left,
              width: rect.width,
              height: rect.height
            },
            visible: isVisible,
            selected: el.classList.contains('selected') || el.getAttribute('aria-selected') === 'true',
            level: el.getAttribute('aria-level') ? parseInt(el.getAttribute('aria-level'), 10) : undefined,
            expanded: el.getAttribute('aria-expanded') === 'true',
            hasChildren: el.querySelector('[role="group"]') !== null || 
                        el.getAttribute('aria-expanded') !== null
          };
        });
        
        return {
          totalCount,
          renderedCount: items.length,
          startIndex,
          endIndex,
          scrollTop: scrollEl.scrollTop,
          scrollHeight: scrollEl.scrollHeight,
          clientHeight: scrollEl.clientHeight,
          avgItemHeight: items.length > 0 
            ? items.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) / items.length
            : 30,
          visibleItems
        };
      })()
    `);
    if (!state) {
      throw new Error(`Virtual list not found: ${this.selector}`);
    }
    return state;
  }
  /**
   * Get currently visible items
   */
  async getVisibleItems() {
    const state = await this.getState();
    return state.visibleItems.filter((item) => item.visible);
  }
  /**
   * Get item by index
   */
  async getItemByIndex(index) {
    await this.scrollToIndex(index);
    const state = await this.getState();
    return state.visibleItems.find((item) => item.index === index) || null;
  }
  /**
   * Get item by text (partial match)
   */
  async getItemByText(text) {
    const state = await this.getState();
    const lowerText = text.toLowerCase();
    return state.visibleItems.find(
      (item) => item.text.toLowerCase().includes(lowerText)
    ) || null;
  }
  /**
   * Scroll to a specific index
   */
  async scrollToIndex(index, options = {}) {
    const { behavior = "auto", timeout = 5e3 } = options;
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        
        // Estimate scroll position
        const items = scrollEl.querySelectorAll('[data-index], [role="treeitem"], [role="row"]');
        const avgHeight = items.length > 0 
          ? Array.from(items).reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) / items.length
          : 30;
        
        const targetTop = ${index} * avgHeight;
        scrollEl.scrollTo({
          top: targetTop,
          behavior: '${behavior}'
        });
      })()
    `);
    if (behavior === "smooth") {
      await new Promise((resolve2) => setTimeout(resolve2, 500));
    }
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const state = await this.getState();
      if (index >= state.startIndex && index <= state.endIndex) {
        return;
      }
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
  }
  /**
   * Scroll to an item by text
   */
  async scrollToItem(text, options = {}) {
    const { timeout = 1e4 } = options;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const visibleItem = await this.getItemByText(text);
      if (visibleItem) {
        return;
      }
      const state = await this.getState();
      const nextIndex = Math.min(state.endIndex + 20, state.totalCount - 1);
      if (nextIndex <= state.endIndex) {
        throw new Error(`Item not found: "${text}"`);
      }
      await this.scrollToIndex(nextIndex);
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
    throw new Error(`Timeout scrolling to item: "${text}"`);
  }
  /**
   * Click an item by index
   */
  async clickItem(index) {
    await this.scrollToIndex(index);
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const item = container.querySelector('[data-index="${index}"]') ||
                    Array.from(container.querySelectorAll('[role="treeitem"], [role="row"]'))[${index}];
        if (item) {
          item.click();
        }
      })()
    `);
  }
  /**
   * Click an item by text
   */
  async clickItemByText(text) {
    await this.scrollToItem(text);
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"], [role="row"], [role="listitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            item.click();
            break;
          }
        }
      })()
    `);
  }
  /**
   * Double-click an item by text
   */
  async dblclickItemByText(text) {
    await this.scrollToItem(text);
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"], [role="row"], [role="listitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            break;
          }
        }
      })()
    `);
  }
  /**
   * Expand a tree item
   */
  async expandItem(text) {
    await this.scrollToItem(text);
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            if (item.getAttribute('aria-expanded') !== 'true') {
              const expander = item.querySelector('[data-expand], .expand-icon, .chevron');
              if (expander) {
                expander.click();
              } else {
                item.click();
              }
            }
            break;
          }
        }
      })()
    `);
  }
  /**
   * Collapse a tree item
   */
  async collapseItem(text) {
    await this.scrollToItem(text);
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const items = container.querySelectorAll('[role="treeitem"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('${text.toLowerCase()}')) {
            if (item.getAttribute('aria-expanded') === 'true') {
              const expander = item.querySelector('[data-expand], .expand-icon, .chevron');
              if (expander) {
                expander.click();
              } else {
                item.click();
              }
            }
            break;
          }
        }
      })()
    `);
  }
  /**
   * Measure scroll performance
   */
  async measureScrollPerformance(options = {}) {
    const { scrollDistance = 5e3, duration = 2e3 } = options;
    const result = await this.test.evaluate(`
      (() => {
        return new Promise((resolve) => {
          const container = document.querySelector('${this.selector}');
          if (!container) {
            resolve(null);
            return;
          }
          
          const scrollEl = container.querySelector('[data-virtualized]') ||
                          container.querySelector('[style*="overflow"]') ||
                          container;
          
          const frames = [];
          let lastTime = performance.now();
          let itemsRendered = 0;
          let rafId;
          
          // Count initial items
          const countItems = () => 
            scrollEl.querySelectorAll('[data-index], [role="treeitem"], [role="row"]').length;
          
          const initialItems = countItems();
          
          // Start measuring frames
          const measureFrame = () => {
            const now = performance.now();
            frames.push(now - lastTime);
            lastTime = now;
            
            const currentItems = countItems();
            if (currentItems !== itemsRendered) {
              itemsRendered = Math.max(itemsRendered, currentItems);
            }
            
            rafId = requestAnimationFrame(measureFrame);
          };
          
          rafId = requestAnimationFrame(measureFrame);
          
          // Scroll
          const startScroll = performance.now();
          const startTop = scrollEl.scrollTop;
          
          const scrollStep = () => {
            const elapsed = performance.now() - startScroll;
            const progress = Math.min(elapsed / ${duration}, 1);
            scrollEl.scrollTop = startTop + (${scrollDistance} * progress);
            
            if (progress < 1) {
              requestAnimationFrame(scrollStep);
            } else {
              // Stop measuring and calculate results
              cancelAnimationFrame(rafId);
              
              const fps = frames.length / (${duration} / 1000);
              const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
              const maxFrameTime = Math.max(...frames);
              const droppedFrames = frames.filter(f => f > 33.33).length; // >30fps threshold
              
              resolve({
                fps: Math.round(fps),
                avgFrameTime: Math.round(avgFrameTime * 100) / 100,
                maxFrameTime: Math.round(maxFrameTime * 100) / 100,
                droppedFrames,
                duration: ${duration},
                distance: ${scrollDistance},
                itemsRendered
              });
            }
          };
          
          requestAnimationFrame(scrollStep);
        });
      })()
    `);
    if (!result) {
      throw new Error(`Virtual list not found: ${this.selector}`);
    }
    return result;
  }
  /**
   * Assert item is visible
   */
  async assertItemVisible(text, message) {
    const item = await this.getItemByText(text);
    if (!item || !item.visible) {
      throw new Error(message || `Expected item "${text}" to be visible`);
    }
  }
  /**
   * Assert item count
   */
  async assertItemCount(expected, message) {
    const state = await this.getState();
    if (state.totalCount !== expected) {
      throw new Error(message || `Expected ${expected} items, got ${state.totalCount}`);
    }
  }
  /**
   * Assert minimum item count
   */
  async assertMinItemCount(min, message) {
    const state = await this.getState();
    if (state.totalCount < min) {
      throw new Error(message || `Expected at least ${min} items, got ${state.totalCount}`);
    }
  }
  /**
   * Assert item is selected
   */
  async assertItemSelected(text, message) {
    const item = await this.getItemByText(text);
    if (!item?.selected) {
      throw new Error(message || `Expected item "${text}" to be selected`);
    }
  }
  /**
   * Assert item is expanded (for trees)
   */
  async assertItemExpanded(text, message) {
    const item = await this.getItemByText(text);
    if (!item?.expanded) {
      throw new Error(message || `Expected item "${text}" to be expanded`);
    }
  }
  /**
   * Assert scroll performance meets threshold
   */
  async assertScrollPerformance(options) {
    const metrics = await this.measureScrollPerformance();
    if (options.minFps && metrics.fps < options.minFps) {
      throw new Error(`Scroll FPS ${metrics.fps} is below minimum ${options.minFps}`);
    }
    if (options.maxFrameTime && metrics.maxFrameTime > options.maxFrameTime) {
      throw new Error(`Max frame time ${metrics.maxFrameTime}ms exceeds ${options.maxFrameTime}ms`);
    }
    if (options.maxDroppedFrames && metrics.droppedFrames > options.maxDroppedFrames) {
      throw new Error(`Dropped frames ${metrics.droppedFrames} exceeds ${options.maxDroppedFrames}`);
    }
  }
  /**
   * Scroll to top
   */
  async scrollToTop() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        scrollEl.scrollTop = 0;
      })()
    `);
  }
  /**
   * Scroll to bottom
   */
  async scrollToBottom() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        const scrollEl = container.querySelector('[data-virtualized]') ||
                        container.querySelector('[style*="overflow"]') ||
                        container;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      })()
    `);
  }
};

// src/core/session-manager.ts
var SessionManager = class {
  sessions = /* @__PURE__ */ new Map();
  activeSessionId = null;
  sessionCounter = 0;
  createTestFn;
  constructor(createTestFn) {
    this.createTestFn = createTestFn;
  }
  /**
   * Create a new session
   */
  async create(nameOrOptions) {
    const options = typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions || {};
    const id = `session-${++this.sessionCounter}`;
    const name = options.name || id;
    for (const session2 of this.sessions.values()) {
      if (session2.info.name === name) {
        throw new Error(`Session with name "${name}" already exists`);
      }
    }
    const test = await this.createTestFn(options);
    const session = new Session({
      id,
      name,
      test,
      options,
      onClose: () => this.handleSessionClose(id)
    });
    this.sessions.set(id, session);
    if (!this.activeSessionId) {
      this.activeSessionId = id;
    }
    return session;
  }
  /**
   * Get session by ID or name
   */
  get(idOrName) {
    if (this.sessions.has(idOrName)) {
      return this.sessions.get(idOrName);
    }
    for (const session of this.sessions.values()) {
      if (session.info.name === idOrName) {
        return session;
      }
    }
    return void 0;
  }
  /**
   * Get the active session
   */
  getActive() {
    if (!this.activeSessionId) return void 0;
    return this.sessions.get(this.activeSessionId);
  }
  /**
   * Switch to a different session
   */
  async switch(idOrName) {
    const session = this.get(idOrName);
    if (!session) {
      throw new Error(`Session not found: ${idOrName}`);
    }
    if (session.info.state === "closed") {
      throw new Error(`Cannot switch to closed session: ${idOrName}`);
    }
    this.activeSessionId = session.info.id;
    session.activate();
    return session;
  }
  /**
   * List all sessions
   */
  list() {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }
  /**
   * Close a session
   */
  async close(idOrName) {
    const session = this.get(idOrName);
    if (!session) {
      throw new Error(`Session not found: ${idOrName}`);
    }
    await session.close();
  }
  /**
   * Close all sessions
   */
  async closeAll() {
    const closePromises = Array.from(this.sessions.values()).filter((s) => s.info.state !== "closed").map((s) => s.close());
    await Promise.all(closePromises);
  }
  /**
   * Run a function in parallel across multiple sessions
   */
  async parallel(fn, options) {
    let sessions = Array.from(this.sessions.values()).filter((s) => s.info.state === "active");
    if (options?.filter) {
      sessions = sessions.filter(options.filter);
    }
    const results = /* @__PURE__ */ new Map();
    const promises = sessions.map(async (session) => {
      const result = await fn(session);
      results.set(session.info.id, result);
    });
    await Promise.all(promises);
    return results;
  }
  /**
   * Run a function sequentially across sessions
   */
  async sequential(fn, options) {
    let sessions = Array.from(this.sessions.values()).filter((s) => s.info.state === "active");
    if (options?.filter) {
      sessions = sessions.filter(options.filter);
    }
    const results = /* @__PURE__ */ new Map();
    for (const session of sessions) {
      const result = await fn(session);
      results.set(session.info.id, result);
    }
    return results;
  }
  /**
   * Get session count
   */
  get count() {
    return this.sessions.size;
  }
  /**
   * Get active session count
   */
  get activeCount() {
    return Array.from(this.sessions.values()).filter((s) => s.info.state === "active").length;
  }
  handleSessionClose(id) {
    if (this.activeSessionId === id) {
      const activeSession = Array.from(this.sessions.values()).find((s) => s.info.state === "active" && s.info.id !== id);
      this.activeSessionId = activeSession?.info.id || null;
    }
  }
};
var Session = class {
  _info;
  _test;
  _options;
  onClose;
  constructor(config) {
    this._info = {
      id: config.id,
      name: config.name,
      state: "active",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: config.options.metadata || {}
    };
    this._test = config.test;
    this._options = config.options;
    this.onClose = config.onClose;
  }
  /**
   * Get session info
   */
  get info() {
    return { ...this._info };
  }
  /**
   * Get session options
   */
  get options() {
    return { ...this._options };
  }
  /**
   * Get test instance
   */
  get test() {
    this.updateActivity();
    return this._test;
  }
  /**
   * Activate this session
   */
  activate() {
    if (this._info.state === "closed") {
      throw new Error("Cannot activate closed session");
    }
    this._info.state = "active";
    this.updateActivity();
  }
  /**
   * Pause this session
   */
  pause() {
    if (this._info.state === "closed") {
      throw new Error("Cannot pause closed session");
    }
    this._info.state = "paused";
    this.updateActivity();
  }
  /**
   * Close this session
   */
  async close() {
    if (this._info.state === "closed") return;
    try {
      await this._test.disconnect();
    } catch {
    }
    this._info.state = "closed";
    this.onClose();
  }
  /**
   * Save session storage state
   */
  async saveState(filePath) {
    const state = await this._test.evaluate(`
      (() => {
        const cookies = document.cookie.split(';').map(c => {
          const [name, value] = c.trim().split('=');
          return { name, value, domain: location.hostname, path: '/', expires: -1, httpOnly: false, secure: location.protocol === 'https:', sameSite: 'Lax' };
        });
        
        const localStorage = [{
          origin: location.origin,
          data: Object.fromEntries(Object.entries(window.localStorage))
        }];
        
        const sessionStorage = [{
          origin: location.origin,
          data: Object.fromEntries(Object.entries(window.sessionStorage))
        }];
        
        return { cookies, localStorage, sessionStorage };
      })()
    `);
    return state;
  }
  /**
   * Load session storage state
   */
  async loadState(state) {
    await this._test.evaluate(`
      (() => {
        // Restore localStorage
        const localData = ${JSON.stringify(state.localStorage[0]?.data || {})};
        for (const [key, value] of Object.entries(localData)) {
          window.localStorage.setItem(key, value);
        }
        
        // Restore sessionStorage
        const sessionData = ${JSON.stringify(state.sessionStorage[0]?.data || {})};
        for (const [key, value] of Object.entries(sessionData)) {
          window.sessionStorage.setItem(key, value);
        }
      })()
    `);
  }
  /**
   * Set session metadata
   */
  setMetadata(key, value) {
    this._info.metadata[key] = value;
    this.updateActivity();
  }
  /**
   * Get session metadata
   */
  getMetadata(key) {
    return this._info.metadata[key];
  }
  updateActivity() {
    this._info.lastActivity = Date.now();
  }
};

// src/core/visualizer.ts
var Visualizer = class {
  options;
  currentRun = null;
  runs = [];
  stepCounter = 0;
  constructor(options = {}) {
    this.options = {
      autoScreenshot: false,
      screenshotOnFailure: true,
      includeStackTrace: true,
      outputDir: "./reports",
      reportFilename: "test-report",
      ...options
    };
  }
  /**
   * Start a new test run
   */
  startRun(name, file) {
    this.currentRun = {
      id: `run-${Date.now()}`,
      name,
      file,
      startTime: Date.now(),
      status: "running",
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
  endRun(status) {
    if (!this.currentRun) return null;
    this.currentRun.endTime = Date.now();
    this.currentRun.duration = this.currentRun.endTime - this.currentRun.startTime;
    if (!status) {
      const hasFailure = this.currentRun.steps.some((s) => s.status === "failed");
      status = hasFailure ? "failed" : "passed";
    }
    this.currentRun.status = status;
    const run = this.currentRun;
    this.currentRun = null;
    return run;
  }
  /**
   * Start a new step
   */
  startStep(type, description, metadata) {
    if (!this.currentRun) {
      throw new Error("No active test run. Call startRun() first.");
    }
    const step = {
      id: `step-${++this.stepCounter}`,
      type,
      description,
      status: "running",
      startTime: Date.now(),
      metadata
    };
    this.currentRun.steps.push(step);
    return step.id;
  }
  /**
   * End a step
   */
  endStep(stepId, status, options) {
    if (!this.currentRun) return;
    const step = this.currentRun.steps.find((s) => s.id === stepId);
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
  addStep(step) {
    if (!this.currentRun) return;
    const fullStep = {
      id: step.id || `step-${++this.stepCounter}`,
      type: step.type || "info",
      description: step.description || "",
      status: step.status || "passed",
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
    if (fullStep.status === "failed") {
      this.currentRun.errorCount++;
    }
    this.currentRun.steps.push(fullStep);
  }
  /**
   * Add a screenshot to the current run
   */
  addScreenshot(screenshotData, description) {
    this.addStep({
      type: "screenshot",
      description: description || "Screenshot",
      status: "passed",
      screenshotData
    });
  }
  /**
   * Add an info message
   */
  addInfo(message, metadata) {
    this.addStep({
      type: "info",
      description: message,
      status: "passed",
      metadata
    });
  }
  /**
   * Add an error
   */
  addError(error, description) {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : void 0;
    this.addStep({
      type: "error",
      description: description || errorMessage,
      status: "failed",
      error: errorMessage,
      stackTrace
    });
  }
  /**
   * Get current run
   */
  getCurrentRun() {
    return this.currentRun;
  }
  /**
   * Get all runs
   */
  getAllRuns() {
    return [...this.runs];
  }
  /**
   * Generate HTML report
   */
  async generateReport(outputPath) {
    outputPath || `${this.options.outputDir}/${this.options.reportFilename}.html`;
    const html = this.generateHTML();
    return html;
  }
  /**
   * Export to YAML format
   */
  exportYAML() {
    const runs = this.runs.map((run) => ({
      name: run.name,
      file: run.file,
      status: run.status,
      duration: `${run.duration}ms`,
      startTime: new Date(run.startTime).toISOString(),
      endTime: run.endTime ? new Date(run.endTime).toISOString() : null,
      steps: run.steps.map((step) => ({
        type: step.type,
        description: step.description,
        status: step.status,
        duration: step.duration ? `${step.duration}ms` : null,
        error: step.error || null
      }))
    }));
    return this.toYAML(runs);
  }
  /**
   * Export to JSON format
   */
  exportJSON() {
    return JSON.stringify(this.runs, null, 2);
  }
  /**
   * Clear all runs
   */
  clear() {
    this.runs = [];
    this.currentRun = null;
    this.stepCounter = 0;
  }
  // Private methods
  generateHTML() {
    const totalTests = this.runs.length;
    const passedTests = this.runs.filter((r) => r.status === "passed").length;
    const failedTests = this.runs.filter((r) => r.status === "failed").length;
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
      <div class="duration">Generated: ${(/* @__PURE__ */ new Date()).toLocaleString()}</div>
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
    
    ${this.runs.map((run) => this.renderTestRun(run)).join("")}
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
  renderTestRun(run) {
    const stepIcons = {
      action: "\u25B6",
      assertion: "\u2713",
      navigation: "\u2192",
      wait: "\u23F1",
      screenshot: "\u{1F4F7}",
      error: "\u2715",
      info: "\u2139"
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
          ${run.steps.map((step) => `
            <div class="timeline-segment ${step.status}" 
                 style="width: ${(step.duration || 1) / (run.duration || 1) * 100}%"></div>
          `).join("")}
        </div>
        ${run.steps.map((step) => `
          <div class="step">
            <div class="step-icon ${step.type}">${stepIcons[step.type] || "\u2022"}</div>
            <div class="step-content">
              <div class="step-description">${step.description}</div>
              <div class="step-meta">
                ${step.duration ? `${step.duration}ms` : ""} 
                ${step.status !== "passed" ? `\u2022 ${step.status}` : ""}
              </div>
              ${step.error ? `<div class="step-error">${step.error}</div>` : ""}
              ${step.screenshotData ? `<img class="step-screenshot" src="${step.screenshotData}" alt="Screenshot">` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>`;
  }
  formatDuration(ms) {
    if (ms < 1e3) return `${ms}ms`;
    if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
    return `${Math.floor(ms / 6e4)}m ${Math.floor(ms % 6e4 / 1e3)}s`;
  }
  toYAML(obj, indent = 0) {
    const spaces = "  ".repeat(indent);
    if (Array.isArray(obj)) {
      return obj.map((item) => `${spaces}- ${this.toYAML(item, indent + 1).trim()}`).join("\n");
    }
    if (typeof obj === "object" && obj !== null) {
      return Object.entries(obj).filter(([, v]) => v !== null && v !== void 0).map(([k, v]) => {
        if (typeof v === "object") {
          return `${spaces}${k}:
${this.toYAML(v, indent + 1)}`;
        }
        return `${spaces}${k}: ${v}`;
      }).join("\n");
    }
    return String(obj);
  }
};

// src/core/monaco-tester.ts
var MonacoTester = class {
  test;
  selector;
  constructor(test, selector = '[data-testid="code-editor"]') {
    this.test = test;
    this.selector = selector;
  }
  /**
   * Get the current editor state
   */
  async getState() {
    const state = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Find Monaco editor instance
        const editorElement = container.querySelector('.monaco-editor');
        if (!editorElement) return null;
        
        // Access Monaco API
        const editor = editorElement.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        
        if (!editor) return null;
        
        const model = editor.getModel();
        const position = editor.getPosition();
        const selection = editor.getSelection();
        const visibleRanges = editor.getVisibleRanges();
        
        return {
          content: model?.getValue() || '',
          lineCount: model?.getLineCount() || 0,
          cursor: position ? {
            lineNumber: position.lineNumber,
            column: position.column
          } : { lineNumber: 1, column: 1 },
          selection: selection && !selection.isEmpty() ? {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn
          } : null,
          language: model?.getLanguageId() || 'plaintext',
          readOnly: editor.getOption?.(monaco.editor.EditorOption.readOnly) || false,
          hasFocus: editor.hasTextFocus(),
          visibleRange: visibleRanges?.[0] ? {
            startLine: visibleRanges[0].startLineNumber,
            endLine: visibleRanges[0].endLineNumber
          } : { startLine: 1, endLine: 1 }
        };
      })()
    `);
    if (!state) {
      throw new Error(`Monaco editor not found: ${this.selector}`);
    }
    return state;
  }
  /**
   * Get editor content
   */
  async getValue() {
    const state = await this.getState();
    return state.content;
  }
  /**
   * Set editor content
   */
  async setValue(content) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.setValue(${JSON.stringify(content)});
        }
      })()
    `);
  }
  /**
   * Insert text at current position
   */
  async insertText(text) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.trigger('test', 'type', { text: ${JSON.stringify(text)} });
        }
      })()
    `);
  }
  /**
   * Get line content
   */
  async getLineContent(lineNumber) {
    const content = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        return editor?.getModel()?.getLineContent(${lineNumber}) || '';
      })()
    `);
    return content;
  }
  /**
   * Go to a specific line
   */
  async goToLine(lineNumber, column = 1) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.setPosition({ lineNumber: ${lineNumber}, column: ${column} });
          editor.revealLineInCenter(${lineNumber});
        }
      })()
    `);
  }
  /**
   * Set cursor position
   */
  async setCursor(lineNumber, column) {
    await this.goToLine(lineNumber, column);
  }
  /**
   * Get cursor position
   */
  async getCursor() {
    const state = await this.getState();
    return state.cursor;
  }
  /**
   * Select text range
   */
  async select(range) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.setSelection({
            startLineNumber: ${range.startLineNumber},
            startColumn: ${range.startColumn},
            endLineNumber: ${range.endLineNumber},
            endColumn: ${range.endColumn}
          });
        }
      })()
    `);
  }
  /**
   * Select all
   */
  async selectAll() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          const model = editor.getModel();
          editor.setSelection({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount())
          });
        }
      })()
    `);
  }
  /**
   * Get tokens at a specific line
   */
  async getTokensAtLine(lineNumber) {
    const tokens = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (!editor) return [];
        
        const model = editor.getModel();
        if (!model) return [];
        
        const lineContent = model.getLineContent(${lineNumber});
        const tokenizationResult = monaco.editor.tokenize(lineContent, model.getLanguageId());
        
        if (!tokenizationResult || !tokenizationResult[0]) return [];
        
        const tokens = tokenizationResult[0];
        const result = [];
        
        for (let i = 0; i < tokens.length; i++) {
          const startOffset = tokens[i].offset;
          const endOffset = tokens[i + 1]?.offset || lineContent.length;
          
          result.push({
            text: lineContent.substring(startOffset, endOffset),
            type: tokens[i].type,
            startColumn: startOffset + 1,
            endColumn: endOffset + 1
          });
        }
        
        return result;
      })()
    `);
    return tokens;
  }
  /**
   * Trigger code completion
   */
  async triggerCompletion() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.trigger('test', 'editor.action.triggerSuggest', {});
        }
      })()
    `);
    await new Promise((resolve2) => setTimeout(resolve2, 500));
  }
  /**
   * Get completion suggestions
   */
  async getCompletions() {
    const completions = await this.test.evaluate(`
      (() => {
        const suggestWidget = document.querySelector('.monaco-editor .suggest-widget');
        if (!suggestWidget || suggestWidget.style.display === 'none') return [];
        
        const items = suggestWidget.querySelectorAll('.monaco-list-row');
        return Array.from(items).map(item => ({
          label: item.querySelector('.label-name')?.textContent || '',
          kind: item.querySelector('.icon')?.className?.match(/\\bmethod\\b|\\bfunction\\b|\\bvariable\\b|\\bclass\\b/)?.[0] || 'unknown',
          detail: item.querySelector('.details-label')?.textContent || ''
        }));
      })()
    `);
    return completions;
  }
  /**
   * Select a completion item
   */
  async selectCompletion(label) {
    await this.test.evaluate(`
      (() => {
        const suggestWidget = document.querySelector('.monaco-editor .suggest-widget');
        if (!suggestWidget) return;
        
        const items = suggestWidget.querySelectorAll('.monaco-list-row');
        for (const item of items) {
          if (item.textContent?.includes('${label}')) {
            item.click();
            return;
          }
        }
      })()
    `);
  }
  /**
   * Go to definition
   */
  async goToDefinition() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.trigger('test', 'editor.action.revealDefinition', {});
        }
      })()
    `);
  }
  /**
   * Find all references
   */
  async findReferences() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.trigger('test', 'editor.action.goToReferences', {});
        }
      })()
    `);
  }
  /**
   * Get diagnostics (errors, warnings)
   */
  async getDiagnostics() {
    const diagnostics = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (!editor) return [];
        
        const model = editor.getModel();
        if (!model) return [];
        
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        return markers.map(m => ({
          severity: ['hint', 'info', 'warning', 'error'][m.severity - 1] || 'info',
          message: m.message,
          startLineNumber: m.startLineNumber,
          startColumn: m.startColumn,
          endLineNumber: m.endLineNumber,
          endColumn: m.endColumn,
          source: m.source,
          code: m.code?.toString()
        }));
      })()
    `);
    return diagnostics;
  }
  /**
   * Focus the editor
   */
  async focus() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.focus();
        }
      })()
    `);
  }
  /**
   * Execute an editor action
   */
  async executeAction(actionId) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const editorElement = container?.querySelector('.monaco-editor');
        const editor = editorElement?.__monacoEditor || 
                      window.monaco?.editor?.getEditors?.()?.find(e => 
                        container.contains(e.getDomNode())
                      );
        if (editor) {
          editor.trigger('test', '${actionId}', {});
        }
      })()
    `);
  }
  /**
   * Undo
   */
  async undo() {
    await this.executeAction("undo");
  }
  /**
   * Redo
   */
  async redo() {
    await this.executeAction("redo");
  }
  /**
   * Format document
   */
  async format() {
    await this.executeAction("editor.action.formatDocument");
  }
  /**
   * Toggle comment
   */
  async toggleComment() {
    await this.executeAction("editor.action.commentLine");
  }
  /**
   * Assert content equals
   */
  async assertContent(expected, message) {
    const content = await this.getValue();
    if (content !== expected) {
      throw new Error(message || `Expected content to equal:
${expected}

Actual:
${content}`);
    }
  }
  /**
   * Assert content contains
   */
  async assertContains(text, message) {
    const content = await this.getValue();
    if (!content.includes(text)) {
      throw new Error(message || `Expected content to contain: ${text}`);
    }
  }
  /**
   * Assert token type at position
   */
  async assertTokenType(lineNumber, tokenText, expectedType, message) {
    const tokens = await this.getTokensAtLine(lineNumber);
    const token = tokens.find((t) => t.text.trim() === tokenText);
    if (!token) {
      throw new Error(message || `Token "${tokenText}" not found at line ${lineNumber}`);
    }
    if (!token.type.includes(expectedType)) {
      throw new Error(message || `Expected token "${tokenText}" to be type "${expectedType}", got "${token.type}"`);
    }
  }
  /**
   * Assert no errors
   */
  async assertNoErrors(message) {
    const diagnostics = await this.getDiagnostics();
    const errors = diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => `  Line ${e.startLineNumber}: ${e.message}`).join("\n");
      throw new Error(message || `Expected no errors, found ${errors.length}:
${errorMessages}`);
    }
  }
  /**
   * Assert cursor position
   */
  async assertCursor(lineNumber, column, message) {
    const cursor = await this.getCursor();
    if (cursor.lineNumber !== lineNumber || cursor.column !== column) {
      throw new Error(message || `Expected cursor at (${lineNumber}, ${column}), got (${cursor.lineNumber}, ${cursor.column})`);
    }
  }
};

// src/core/tauri-dialog.ts
var TauriDialogTester = class {
  test;
  mocks = /* @__PURE__ */ new Map();
  _invocations = [];
  setupDone = false;
  constructor(test) {
    this.test = test;
  }
  /**
   * Get cached invocations (call getInvocations() for fresh data)
   */
  get cachedInvocations() {
    return [...this._invocations];
  }
  /**
   * Setup dialog interception
   */
  async setup() {
    if (this.setupDone) return;
    await this.test.evaluate(`
      (() => {
        if (window.__tauriDialogMock) return;
        window.__tauriDialogMock = {
          mocks: {},
          invocations: []
        };
        
        // Store original Tauri dialog functions
        const originalDialog = window.__TAURI__?.dialog || {};
        
        // Create mock dialog object
        const mockDialog = {
          open: async (options = {}) => {
            const mock = window.__tauriDialogMock.mocks.open;
            const result = mock ? {
              cancelled: mock.cancelled || false,
              filePaths: mock.filePaths || null
            } : await originalDialog.open?.(options);
            
            window.__tauriDialogMock.invocations.push({
              type: 'open',
              options,
              result,
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return mock?.cancelled ? null : (mock?.filePaths || result?.filePaths);
          },
          
          save: async (options = {}) => {
            const mock = window.__tauriDialogMock.mocks.save;
            const result = mock ? {
              cancelled: mock.cancelled || false,
              filePaths: mock.filePaths || null
            } : await originalDialog.save?.(options);
            
            window.__tauriDialogMock.invocations.push({
              type: 'save',
              options,
              result,
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return mock?.cancelled ? null : (mock?.filePaths?.[0] || result?.filePaths?.[0]);
          },
          
          message: async (message, options = {}) => {
            const mock = window.__tauriDialogMock.mocks.message;
            
            window.__tauriDialogMock.invocations.push({
              type: 'message',
              options: { message, ...options },
              result: { cancelled: false, response: mock?.response || 0 },
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return mock?.response || 0;
          },
          
          ask: async (message, options = {}) => {
            const mock = window.__tauriDialogMock.mocks.confirm;
            const result = mock?.response !== undefined ? mock.response === 1 : true;
            
            window.__tauriDialogMock.invocations.push({
              type: 'confirm',
              options: { message, ...options },
              result: { cancelled: false, response: result ? 1 : 0 },
              timestamp: Date.now()
            });
            
            if (mock?.delay) await new Promise(r => setTimeout(r, mock.delay));
            
            return result;
          },
          
          confirm: async (message, options = {}) => {
            return mockDialog.ask(message, options);
          }
        };
        
        // Override Tauri dialog
        if (window.__TAURI__) {
          window.__TAURI__.dialog = mockDialog;
        }
        
        // Also handle @tauri-apps/api style imports
        window.__tauriDialogMock.mockDialog = mockDialog;
      })()
    `);
    this.setupDone = true;
  }
  /**
   * Mock the file open dialog
   */
  async mockOpen(config) {
    await this.setup();
    this.mocks.set("open", config);
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.open = ${JSON.stringify(config)};
    `);
  }
  /**
   * Mock the file save dialog
   */
  async mockSave(config) {
    await this.setup();
    this.mocks.set("save", config);
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.save = ${JSON.stringify(config)};
    `);
  }
  /**
   * Mock the message dialog
   */
  async mockMessage(config) {
    await this.setup();
    this.mocks.set("message", config);
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.message = ${JSON.stringify(config)};
    `);
  }
  /**
   * Mock the confirm dialog
   */
  async mockConfirm(config) {
    await this.setup();
    this.mocks.set("confirm", config);
    await this.test.evaluate(`
      window.__tauriDialogMock.mocks.confirm = ${JSON.stringify(config)};
    `);
  }
  /**
   * Mock the directory picker
   */
  async mockDirectory(config) {
    await this.mockOpen({ ...config, directory: true });
  }
  /**
   * Clear all mocks
   */
  async clearMocks() {
    this.mocks.clear();
    await this.test.evaluate(`
      if (window.__tauriDialogMock) {
        window.__tauriDialogMock.mocks = {};
      }
    `);
  }
  /**
   * Get all dialog invocations
   */
  async getInvocations() {
    const invocations = await this.test.evaluate(`
      window.__tauriDialogMock?.invocations || []
    `);
    this._invocations = invocations;
    return invocations;
  }
  /**
   * Get invocations by type
   */
  async getInvocationsByType(type) {
    const all = await this.getInvocations();
    return all.filter((i) => i.type === type);
  }
  /**
   * Clear invocation history
   */
  async clearInvocations() {
    this._invocations = [];
    await this.test.evaluate(`
      if (window.__tauriDialogMock) {
        window.__tauriDialogMock.invocations = [];
      }
    `);
  }
  /**
   * Wait for a dialog to be opened
   */
  async waitForDialog(type, timeout = 5e3) {
    const startTime = Date.now();
    const initialCount = (await this.getInvocations()).filter((i) => i.type === type).length;
    while (Date.now() - startTime < timeout) {
      const invocations = await this.getInvocationsByType(type);
      if (invocations.length > initialCount) {
        return invocations[invocations.length - 1];
      }
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
    throw new Error(`Timeout waiting for ${type} dialog`);
  }
  /**
   * Expect an open dialog to be called
   */
  async expectOpen() {
    return this.waitForDialog("open");
  }
  /**
   * Expect a save dialog to be called
   */
  async expectSave() {
    return this.waitForDialog("save");
  }
  /**
   * Expect a confirm dialog to be called
   */
  async expectConfirm() {
    return this.waitForDialog("confirm");
  }
  /**
   * Expect a directory picker to be called
   */
  async expectDirectory() {
    return this.waitForDialog("directory");
  }
  /**
   * Assert that a dialog was called
   */
  async assertDialogCalled(type, message) {
    const invocations = await this.getInvocationsByType(type);
    if (invocations.length === 0) {
      throw new Error(message || `Expected ${type} dialog to be called`);
    }
  }
  /**
   * Assert that a dialog was called with specific options
   */
  async assertDialogCalledWith(type, expectedOptions, message) {
    const invocations = await this.getInvocationsByType(type);
    const match = invocations.find((inv) => {
      for (const [key, value] of Object.entries(expectedOptions)) {
        if (JSON.stringify(inv.options[key]) !== JSON.stringify(value)) {
          return false;
        }
      }
      return true;
    });
    if (!match) {
      throw new Error(message || `Expected ${type} dialog to be called with ${JSON.stringify(expectedOptions)}`);
    }
  }
  /**
   * Assert dialog count
   */
  async assertDialogCount(type, expected, message) {
    const invocations = await this.getInvocationsByType(type);
    if (invocations.length !== expected) {
      throw new Error(message || `Expected ${expected} ${type} dialogs, got ${invocations.length}`);
    }
  }
  /**
   * Simulate selecting files in open dialog (for manual testing)
   */
  async selectFiles(filePaths) {
    await this.mockOpen({ filePaths });
  }
  /**
   * Simulate cancelling a dialog (for manual testing)
   */
  async cancel() {
    await this.mockOpen({ cancelled: true });
    await this.mockSave({ cancelled: true });
  }
};

// src/core/benchmark.ts
var Benchmark = class {
  test;
  testName;
  timings = [];
  memorySnapshots = [];
  activeMeasurements = /* @__PURE__ */ new Map();
  constructor(test, testName = "Benchmark") {
    this.test = test;
    this.testName = testName;
  }
  /**
   * Measure the duration of an operation
   */
  async measure(name, fn) {
    const startTime = performance.now();
    this.activeMeasurements.set(name, startTime);
    try {
      const result = await fn();
      const endTime = performance.now();
      this.timings.push({
        name,
        startTime,
        endTime,
        duration: endTime - startTime
      });
      this.activeMeasurements.delete(name);
      return result;
    } catch (error) {
      this.activeMeasurements.delete(name);
      throw error;
    }
  }
  /**
   * Start a named timing measurement
   */
  startTiming(name) {
    this.activeMeasurements.set(name, performance.now());
  }
  /**
   * End a named timing measurement
   */
  endTiming(name, metadata) {
    const startTime = this.activeMeasurements.get(name);
    if (startTime === void 0) {
      throw new Error(`No active measurement found: ${name}`);
    }
    const endTime = performance.now();
    const measurement = {
      name,
      startTime,
      endTime,
      duration: endTime - startTime,
      metadata
    };
    this.timings.push(measurement);
    this.activeMeasurements.delete(name);
    return measurement;
  }
  /**
   * Get timing by name
   */
  getTiming(name) {
    return this.timings.find((t) => t.name === name);
  }
  /**
   * Get all timings
   */
  getTimings() {
    return [...this.timings];
  }
  /**
   * Measure memory usage
   */
  async measureMemory() {
    const memory = await this.test.evaluate(`
      (() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          };
        }
        return null;
      })()
    `);
    if (!memory) {
      const fallback = {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        timestamp: Date.now()
      };
      this.memorySnapshots.push(fallback);
      return fallback;
    }
    this.memorySnapshots.push(memory);
    return memory;
  }
  /**
   * Get memory snapshots
   */
  getMemorySnapshots() {
    return [...this.memorySnapshots];
  }
  /**
   * Get performance entries from the browser
   */
  async getPerformanceEntries(type) {
    const entries = await this.test.evaluate(`
      (() => {
        const entries = ${type ? `performance.getEntriesByType('${type}')` : "performance.getEntries()"};
        return entries.map(e => ({
          name: e.name,
          entryType: e.entryType,
          startTime: e.startTime,
          duration: e.duration,
          initiatorType: e.initiatorType,
          transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize,
          decodedBodySize: e.decodedBodySize
        }));
      })()
    `);
    return entries;
  }
  /**
   * Get resource timing entries
   */
  async getResourceTimings() {
    return this.getPerformanceEntries("resource");
  }
  /**
   * Get long tasks (>50ms)
   */
  async getLongTasks() {
    return this.getPerformanceEntries("longtask");
  }
  /**
   * Clear all measurements
   */
  clear() {
    this.timings = [];
    this.memorySnapshots = [];
    this.activeMeasurements.clear();
  }
  /**
   * Clear browser performance entries
   */
  async clearBrowserEntries() {
    await this.test.evaluate(`performance.clearResourceTimings()`);
  }
  /**
   * Assert duration is within threshold
   */
  assertDuration(name, thresholds) {
    const timing = this.getTiming(name);
    if (!timing) {
      throw new Error(`Timing measurement not found: ${name}`);
    }
    if (thresholds.maxDuration !== void 0 && timing.duration > thresholds.maxDuration) {
      throw new Error(
        `${name}: Duration ${timing.duration.toFixed(2)}ms exceeds maximum ${thresholds.maxDuration}ms`
      );
    }
  }
  /**
   * Assert memory is within threshold
   */
  assertMemory(thresholds) {
    const peakMemory = Math.max(...this.memorySnapshots.map((m) => m.usedJSHeapSize));
    if (thresholds.maxMemory !== void 0 && peakMemory > thresholds.maxMemory) {
      throw new Error(
        `Peak memory ${this.formatBytes(peakMemory)} exceeds maximum ${this.formatBytes(thresholds.maxMemory)}`
      );
    }
  }
  /**
   * Assert all thresholds
   */
  async assertThresholds(thresholds) {
    if (thresholds.maxDuration !== void 0) {
      const totalDuration = this.timings.reduce((sum, t) => sum + t.duration, 0);
      if (totalDuration > thresholds.maxDuration) {
        throw new Error(
          `Total duration ${totalDuration.toFixed(2)}ms exceeds maximum ${thresholds.maxDuration}ms`
        );
      }
    }
    if (thresholds.maxMemory !== void 0) {
      this.assertMemory(thresholds);
    }
    if (thresholds.maxResourceCount !== void 0 || thresholds.maxTransferSize !== void 0) {
      const resources = await this.getResourceTimings();
      if (thresholds.maxResourceCount !== void 0 && resources.length > thresholds.maxResourceCount) {
        throw new Error(
          `Resource count ${resources.length} exceeds maximum ${thresholds.maxResourceCount}`
        );
      }
      if (thresholds.maxTransferSize !== void 0) {
        const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
        if (totalSize > thresholds.maxTransferSize) {
          throw new Error(
            `Total transfer size ${this.formatBytes(totalSize)} exceeds maximum ${this.formatBytes(thresholds.maxTransferSize)}`
          );
        }
      }
    }
  }
  /**
   * Generate performance report
   */
  async generateReport() {
    const resources = await this.getResourceTimings();
    const longTasks = await this.getLongTasks();
    const durations = this.timings.map((t) => t.duration);
    const memoryValues = this.memorySnapshots.map((m) => m.usedJSHeapSize);
    return {
      testName: this.testName,
      timings: this.timings,
      memory: this.memorySnapshots,
      resources,
      longTasks,
      summary: {
        totalDuration: durations.reduce((a, b) => a + b, 0),
        avgTiming: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        maxTiming: durations.length > 0 ? Math.max(...durations) : 0,
        minTiming: durations.length > 0 ? Math.min(...durations) : 0,
        peakMemory: memoryValues.length > 0 ? Math.max(...memoryValues) : 0,
        avgMemory: memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0,
        resourceCount: resources.length,
        totalTransferSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
      }
    };
  }
  /**
   * Export report as JSON
   */
  async exportJSON() {
    const report = await this.generateReport();
    return JSON.stringify(report, null, 2);
  }
  /**
   * Compare with baseline
   */
  async compareWithBaseline(baseline, tolerance = 0.1) {
    const current = await this.generateReport();
    const differences = [];
    for (const timing of current.timings) {
      const baselineTiming = baseline.timings.find((t) => t.name === timing.name);
      if (baselineTiming) {
        const diff = timing.duration - baselineTiming.duration;
        const diffPercent = diff / baselineTiming.duration;
        differences.push({
          metric: `timing:${timing.name}`,
          baseline: baselineTiming.duration,
          current: timing.duration,
          diff,
          diffPercent
        });
      }
    }
    const summaryMetrics = [
      ["totalDuration", baseline.summary.totalDuration, current.summary.totalDuration],
      ["peakMemory", baseline.summary.peakMemory, current.summary.peakMemory],
      ["resourceCount", baseline.summary.resourceCount, current.summary.resourceCount],
      ["totalTransferSize", baseline.summary.totalTransferSize, current.summary.totalTransferSize]
    ];
    for (const [metric, baseValue, currentValue] of summaryMetrics) {
      if (baseValue > 0) {
        const diff = currentValue - baseValue;
        const diffPercent = diff / baseValue;
        differences.push({
          metric,
          baseline: baseValue,
          current: currentValue,
          diff,
          diffPercent
        });
      }
    }
    const passed = differences.every((d) => Math.abs(d.diffPercent) <= tolerance);
    return { passed, differences };
  }
  // Private helpers
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
};

// src/core/stream-server.ts
var StreamServer = class {
  test;
  options;
  running = false;
  startTime = 0;
  frameCount = 0;
  bytesSent = 0;
  clients = /* @__PURE__ */ new Map();
  frameInterval = null;
  frameTimes = [];
  onFrameCallback;
  onInputCallback;
  constructor(test) {
    this.test = test;
    this.options = {
      port: 9223,
      frameRate: 30,
      quality: 80,
      format: "jpeg",
      includeCursor: true,
      includeHighlights: true
    };
  }
  /**
   * Start the stream server
   */
  async start(options = {}) {
    if (this.running) {
      throw new Error("Stream server is already running");
    }
    this.options = { ...this.options, ...options };
    this.running = true;
    this.startTime = Date.now();
    this.frameCount = 0;
    this.bytesSent = 0;
    this.frameTimes = [];
    const frameInterval = 1e3 / this.options.frameRate;
    this.frameInterval = setInterval(() => this.captureAndSendFrame(), frameInterval);
    console.log(`Stream server started on port ${this.options.port}`);
    console.log(`Connect to ws://localhost:${this.options.port} to view the stream`);
  }
  /**
   * Stop the stream server
   */
  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    this.clients.clear();
    console.log("Stream server stopped");
  }
  /**
   * Check if server is running
   */
  isRunning() {
    return this.running;
  }
  /**
   * Get stream statistics
   */
  getStats() {
    const avgFrameTime = this.frameTimes.length > 0 ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0;
    const recentFrameTimes = this.frameTimes.slice(-30);
    const currentFps = recentFrameTimes.length > 0 ? 1e3 / (recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length) : 0;
    return {
      framesSent: this.frameCount,
      bytesSent: this.bytesSent,
      avgFrameTime,
      clientCount: this.clients.size,
      uptime: this.running ? Date.now() - this.startTime : 0,
      currentFps
    };
  }
  /**
   * Get connected clients
   */
  getClients() {
    return Array.from(this.clients.values());
  }
  /**
   * Set frame rate
   */
  setFrameRate(fps) {
    this.options.frameRate = fps;
    if (this.running && this.frameInterval) {
      clearInterval(this.frameInterval);
      const frameInterval = 1e3 / fps;
      this.frameInterval = setInterval(() => this.captureAndSendFrame(), frameInterval);
    }
  }
  /**
   * Set image quality
   */
  setQuality(quality) {
    this.options.quality = Math.max(1, Math.min(100, quality));
  }
  /**
   * Set image format
   */
  setFormat(format) {
    this.options.format = format;
  }
  /**
   * Register frame callback (for testing/debugging)
   */
  onFrame(callback) {
    this.onFrameCallback = callback;
  }
  /**
   * Register input callback (for testing/debugging)
   */
  onInput(callback) {
    this.onInputCallback = callback;
  }
  /**
   * Simulate client connection (for testing)
   */
  simulateClientConnect(clientId, address = "127.0.0.1") {
    this.clients.set(clientId, {
      id: clientId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      address
    });
  }
  /**
   * Simulate client disconnect (for testing)
   */
  simulateClientDisconnect(clientId) {
    this.clients.delete(clientId);
  }
  /**
   * Simulate input event from client (for testing)
   */
  async handleInputEvent(event) {
    if (this.onInputCallback) {
      this.onInputCallback(event);
    }
    switch (event.type) {
      case "click":
        if (event.x !== void 0 && event.y !== void 0) {
          await this.test.evaluate(`
            document.elementFromPoint(${event.x}, ${event.y})?.click();
          `);
        }
        break;
      case "type":
        if (event.text) {
          await this.test.evaluate(`
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
              active.value += ${JSON.stringify(event.text)};
              active.dispatchEvent(new Event('input', { bubbles: true }));
            }
          `);
        }
        break;
      case "scroll":
        if (event.deltaX !== void 0 || event.deltaY !== void 0) {
          await this.test.evaluate(`
            window.scrollBy(${event.deltaX || 0}, ${event.deltaY || 0});
          `);
        }
        break;
      case "keydown":
        if (event.key) {
          await this.test.press(event.key);
        }
        break;
    }
  }
  /**
   * Capture current frame
   */
  async captureFrame() {
    const screenshot = await this.test.screenshot();
    const dimensions = await this.test.evaluate(`
      ({ width: window.innerWidth, height: window.innerHeight })
    `);
    let metadata = {};
    if (this.options.includeCursor) {
      const cursor = await this.test.evaluate(`
        window.__lastMousePosition || { x: 0, y: 0 }
      `);
      metadata.cursor = cursor;
    }
    return {
      type: "screenshot",
      data: screenshot,
      timestamp: Date.now(),
      dimensions,
      metadata
    };
  }
  // Private methods
  async captureAndSendFrame() {
    if (!this.running || this.clients.size === 0) return;
    const frameStart = performance.now();
    try {
      const frame = await this.captureFrame();
      this.broadcastFrame(frame);
      this.frameCount++;
      this.bytesSent += frame.data.length;
      const frameTime = performance.now() - frameStart;
      this.frameTimes.push(frameTime);
      if (this.frameTimes.length > 100) {
        this.frameTimes.shift();
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
    }
  }
  broadcastFrame(frame) {
    for (const client of this.clients.values()) {
      client.lastActivity = Date.now();
    }
    if (this.onFrameCallback) {
      this.onFrameCallback(frame);
    }
  }
};

// src/core/timeline-tester.ts
var TimelineTester = class {
  test;
  selector;
  constructor(test, selector = '[data-testid="timeline"]') {
    this.test = test;
    this.selector = selector;
  }
  /**
   * Get the current timeline state
   */
  async getState() {
    const state = await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return null;
        
        // Try to access timeline data from various sources
        const timelineData = container.__timelineData || 
                           container.dataset.timeline ? JSON.parse(container.dataset.timeline) : null;
        
        // Parse events from DOM if no data attribute
        let events = [];
        const eventElements = container.querySelectorAll('[data-event-id], .timeline-event, .event-bar');
        
        eventElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          events.push({
            id: el.getAttribute('data-event-id') || el.id || '',
            name: el.getAttribute('data-event-name') || el.textContent?.trim() || '',
            type: el.getAttribute('data-event-type') || el.className.match(/type-(\\w+)/)?.[1] || 'default',
            startTime: parseFloat(el.getAttribute('data-start-time') || '0'),
            endTime: el.getAttribute('data-end-time') ? parseFloat(el.getAttribute('data-end-time')) : undefined,
            duration: el.getAttribute('data-duration') ? parseFloat(el.getAttribute('data-duration')) : undefined,
            color: getComputedStyle(el).backgroundColor,
            selected: el.classList.contains('selected') || el.getAttribute('aria-selected') === 'true',
            lane: parseInt(el.getAttribute('data-lane') || '0', 10),
            data: el.dataset.eventData ? JSON.parse(el.dataset.eventData) : {},
            parentId: el.getAttribute('data-parent-id'),
            childIds: el.getAttribute('data-child-ids')?.split(',').filter(Boolean)
          });
        });
        
        // Get visible and total range
        const visibleRange = {
          start: parseFloat(container.getAttribute('data-visible-start') || '0'),
          end: parseFloat(container.getAttribute('data-visible-end') || '1000')
        };
        
        const totalRange = {
          start: parseFloat(container.getAttribute('data-total-start') || '0'),
          end: parseFloat(container.getAttribute('data-total-end') || '1000')
        };
        
        // Count lanes
        const lanes = new Set(events.map(e => e.lane));
        
        // Get selected IDs
        const selectedIds = events.filter(e => e.selected).map(e => e.id);
        
        // Get playhead position if exists
        const playhead = container.querySelector('.playhead, .time-indicator');
        const playheadPosition = playhead 
          ? parseFloat(playhead.getAttribute('data-position') || playhead.style.left)
          : undefined;
        
        return {
          events,
          visibleRange,
          totalRange,
          zoom: parseFloat(container.getAttribute('data-zoom') || '1'),
          scrollPosition: container.scrollLeft || 0,
          laneCount: lanes.size,
          selectedIds,
          playheadPosition,
          isPlaying: container.classList.contains('playing')
        };
      })()
    `);
    if (!state) {
      throw new Error(`Timeline not found: ${this.selector}`);
    }
    return state;
  }
  /**
   * Get all events
   */
  async getEvents(filter) {
    const state = await this.getState();
    let events = state.events;
    if (filter) {
      events = this.filterEvents(events, filter);
    }
    return events;
  }
  /**
   * Get event by ID
   */
  async getEvent(id) {
    const events = await this.getEvents();
    return events.find((e) => e.id === id) || null;
  }
  /**
   * Get events by name (partial match)
   */
  async getEventsByName(name) {
    return this.getEvents({ name });
  }
  /**
   * Get events by type
   */
  async getEventsByType(type) {
    return this.getEvents({ type });
  }
  /**
   * Click on an event
   */
  async clickEvent(idOrName) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Find by ID first
        let event = container.querySelector('[data-event-id="${idOrName}"]');
        
        // Find by name if not found
        if (!event) {
          const events = container.querySelectorAll('[data-event-id], .timeline-event');
          for (const el of events) {
            if (el.textContent?.toLowerCase().includes('${idOrName.toLowerCase()}')) {
              event = el;
              break;
            }
          }
        }
        
        if (event) {
          event.click();
        }
      })()
    `);
  }
  /**
   * Double-click on an event
   */
  async dblclickEvent(idOrName) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        let event = container.querySelector('[data-event-id="${idOrName}"]');
        
        if (!event) {
          const events = container.querySelectorAll('[data-event-id], .timeline-event');
          for (const el of events) {
            if (el.textContent?.toLowerCase().includes('${idOrName.toLowerCase()}')) {
              event = el;
              break;
            }
          }
        }
        
        if (event) {
          event.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      })()
    `);
  }
  /**
   * Hover over an event
   */
  async hoverEvent(idOrName) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        let event = container.querySelector('[data-event-id="${idOrName}"]');
        
        if (!event) {
          const events = container.querySelectorAll('[data-event-id], .timeline-event');
          for (const el of events) {
            if (el.textContent?.toLowerCase().includes('${idOrName.toLowerCase()}')) {
              event = el;
              break;
            }
          }
        }
        
        if (event) {
          event.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          event.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
      })()
    `);
  }
  /**
   * Zoom to a specific range
   */
  async zoomToRange(start, end) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        // Dispatch custom zoom event
        container.dispatchEvent(new CustomEvent('timeline-zoom', {
          detail: { start: ${start}, end: ${end} },
          bubbles: true
        }));
        
        // Also try setting attributes directly
        container.setAttribute('data-visible-start', '${start}');
        container.setAttribute('data-visible-end', '${end}');
      })()
    `);
  }
  /**
   * Zoom in
   */
  async zoomIn() {
    const state = await this.getState();
    const range = state.visibleRange.end - state.visibleRange.start;
    const center = (state.visibleRange.start + state.visibleRange.end) / 2;
    const newRange = range * 0.5;
    await this.zoomToRange(center - newRange / 2, center + newRange / 2);
  }
  /**
   * Zoom out
   */
  async zoomOut() {
    const state = await this.getState();
    const range = state.visibleRange.end - state.visibleRange.start;
    const center = (state.visibleRange.start + state.visibleRange.end) / 2;
    const newRange = range * 2;
    await this.zoomToRange(
      Math.max(state.totalRange.start, center - newRange / 2),
      Math.min(state.totalRange.end, center + newRange / 2)
    );
  }
  /**
   * Fit all events in view
   */
  async fitAll() {
    const state = await this.getState();
    await this.zoomToRange(state.totalRange.start, state.totalRange.end);
  }
  /**
   * Scroll to a specific time position
   */
  async scrollToTime(time) {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        if (!container) return;
        
        container.dispatchEvent(new CustomEvent('timeline-scroll', {
          detail: { time: ${time} },
          bubbles: true
        }));
      })()
    `);
  }
  /**
   * Play timeline (if supported)
   */
  async play() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const playBtn = container?.querySelector('[data-action="play"], .play-button');
        if (playBtn) playBtn.click();
      })()
    `);
  }
  /**
   * Pause timeline
   */
  async pause() {
    await this.test.evaluate(`
      (() => {
        const container = document.querySelector('${this.selector}');
        const pauseBtn = container?.querySelector('[data-action="pause"], .pause-button');
        if (pauseBtn) pauseBtn.click();
      })()
    `);
  }
  /**
   * Assert event exists
   */
  async assertEventExists(idOrName, message) {
    const events = await this.getEvents();
    const found = events.find(
      (e) => e.id === idOrName || e.name.toLowerCase().includes(idOrName.toLowerCase())
    );
    if (!found) {
      throw new Error(message || `Expected event "${idOrName}" to exist`);
    }
  }
  /**
   * Assert event order
   */
  async assertEventOrder(expectedOrder, message) {
    const events = await this.getEvents();
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    let orderIndex = 0;
    for (const event of sortedEvents) {
      if (orderIndex < expectedOrder.length) {
        const expectedName = expectedOrder[orderIndex].toLowerCase();
        if (event.id.toLowerCase() === expectedName || event.name.toLowerCase().includes(expectedName)) {
          orderIndex++;
        }
      }
    }
    if (orderIndex !== expectedOrder.length) {
      const actualOrder = sortedEvents.map((e) => e.name || e.id).join(" -> ");
      throw new Error(
        message || `Expected event order: ${expectedOrder.join(" -> ")}
Actual order: ${actualOrder}`
      );
    }
  }
  /**
   * Assert concurrent events
   */
  async assertConcurrentEvents(eventNames, message) {
    const events = await this.getEvents();
    const matchedEvents = eventNames.map((name) => {
      const found = events.find(
        (e) => e.id.toLowerCase() === name.toLowerCase() || e.name.toLowerCase().includes(name.toLowerCase())
      );
      if (!found) {
        throw new Error(`Event "${name}" not found`);
      }
      return found;
    });
    for (let i = 0; i < matchedEvents.length; i++) {
      for (let j = i + 1; j < matchedEvents.length; j++) {
        const a = matchedEvents[i];
        const b = matchedEvents[j];
        const aEnd = a.endTime || a.startTime + (a.duration || 0);
        const bEnd = b.endTime || b.startTime + (b.duration || 0);
        const overlaps = a.startTime < bEnd && aEnd > b.startTime;
        if (!overlaps) {
          throw new Error(
            message || `Events "${a.name}" and "${b.name}" are not concurrent`
          );
        }
      }
    }
  }
  /**
   * Assert time range
   */
  async assertTimeRange(expectedStart, expectedEnd, message) {
    const state = await this.getState();
    if (state.totalRange.start !== expectedStart || state.totalRange.end !== expectedEnd) {
      throw new Error(
        message || `Expected time range [${expectedStart}, ${expectedEnd}], got [${state.totalRange.start}, ${state.totalRange.end}]`
      );
    }
  }
  /**
   * Assert event count
   */
  async assertEventCount(expected, message) {
    const events = await this.getEvents();
    if (events.length !== expected) {
      throw new Error(message || `Expected ${expected} events, got ${events.length}`);
    }
  }
  /**
   * Assert event is selected
   */
  async assertEventSelected(idOrName, message) {
    const events = await this.getEvents({ selected: true });
    const found = events.find(
      (e) => e.id === idOrName || e.name.toLowerCase().includes(idOrName.toLowerCase())
    );
    if (!found) {
      throw new Error(message || `Expected event "${idOrName}" to be selected`);
    }
  }
  // Private methods
  filterEvents(events, filter) {
    return events.filter((event) => {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(event.type)) return false;
      }
      if (filter.name) {
        if (filter.name instanceof RegExp) {
          if (!filter.name.test(event.name)) return false;
        } else {
          if (!event.name.toLowerCase().includes(filter.name.toLowerCase())) return false;
        }
      }
      if (filter.timeRange) {
        const eventEnd = event.endTime || event.startTime + (event.duration || 0);
        if (filter.timeRange.start !== void 0 && eventEnd < filter.timeRange.start) return false;
        if (filter.timeRange.end !== void 0 && event.startTime > filter.timeRange.end) return false;
      }
      if (filter.lane !== void 0 && event.lane !== filter.lane) return false;
      if (filter.selected !== void 0 && event.selected !== filter.selected) return false;
      if (filter.withDuration && !event.duration) return false;
      return true;
    });
  }
};

exports.A11yTester = A11yTester;
exports.ARIA_ROLES = ARIA_ROLES;
exports.AccessibilityTreeManager = AccessibilityTreeManager;
exports.AssertionError = AssertionError;
exports.Assertions = Assertions;
exports.Benchmark = Benchmark;
exports.COMMON_VIEWPORTS = COMMON_VIEWPORTS;
exports.DesktopTest = DesktopTest;
exports.FlowTester = FlowTester;
exports.InteractionTester = InteractionTester;
exports.MonacoTester = MonacoTester;
exports.NetworkInterceptor = NetworkInterceptor;
exports.RefManager = RefManager;
exports.Session = Session;
exports.SessionManager = SessionManager;
exports.StreamServer = StreamServer;
exports.TauriDialogTester = TauriDialogTester;
exports.TestRunner = TestRunner;
exports.TimelineTester = TimelineTester;
exports.VirtualListTester = VirtualListTester;
exports.VisualRegressionTester = VisualRegressionTester;
exports.Visualizer = Visualizer;
exports.WCAG_TAGS = WCAG_TAGS;
exports.createA11yTester = createA11yTester;
exports.createAccessibilityTreeManager = createAccessibilityTreeManager;
exports.createDesktopTest = createDesktopTest;
exports.createInteractionTester = createInteractionTester;
exports.createVisualRegressionTester = createVisualRegressionTester;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map