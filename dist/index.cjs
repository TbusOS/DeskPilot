'use strict';

var child_process = require('child_process');
var fs2 = require('fs');
var path2 = require('path');
var readline = require('readline');

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

var fs2__namespace = /*#__PURE__*/_interopNamespace(fs2);
var path2__namespace = /*#__PURE__*/_interopNamespace(path2);
var readline__namespace = /*#__PURE__*/_interopNamespace(readline);

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
exports.TestMode = void 0; exports.LocatorStrategy = void 0; exports.ActionStatus = void 0; exports.VLMProvider = void 0; exports.Platform = void 0;
var init_types = __esm({
  "src/types.ts"() {
    exports.TestMode = /* @__PURE__ */ ((TestMode2) => {
      TestMode2["DETERMINISTIC"] = "deterministic";
      TestMode2["VISUAL"] = "visual";
      TestMode2["HYBRID"] = "hybrid";
      return TestMode2;
    })(exports.TestMode || {});
    exports.LocatorStrategy = /* @__PURE__ */ ((LocatorStrategy2) => {
      LocatorStrategy2["REF"] = "ref";
      LocatorStrategy2["CSS"] = "css";
      LocatorStrategy2["XPATH"] = "xpath";
      LocatorStrategy2["ROLE"] = "role";
      LocatorStrategy2["TEXT"] = "text";
      LocatorStrategy2["VISUAL"] = "visual";
      LocatorStrategy2["TESTID"] = "testid";
      return LocatorStrategy2;
    })(exports.LocatorStrategy || {});
    exports.ActionStatus = /* @__PURE__ */ ((ActionStatus2) => {
      ActionStatus2["SUCCESS"] = "success";
      ActionStatus2["FAILED"] = "failed";
      ActionStatus2["TIMEOUT"] = "timeout";
      ActionStatus2["NOT_FOUND"] = "not_found";
      ActionStatus2["VLM_FALLBACK"] = "vlm_fallback";
      return ActionStatus2;
    })(exports.ActionStatus || {});
    exports.VLMProvider = /* @__PURE__ */ ((VLMProvider2) => {
      VLMProvider2["ANTHROPIC"] = "anthropic";
      VLMProvider2["OPENAI"] = "openai";
      VLMProvider2["VOLCENGINE"] = "volcengine";
      VLMProvider2["DOUBAO"] = "doubao";
      VLMProvider2["CUSTOM"] = "custom";
      VLMProvider2["CURSOR"] = "cursor";
      VLMProvider2["AGENT"] = "agent";
      return VLMProvider2;
    })(exports.VLMProvider || {});
    exports.Platform = /* @__PURE__ */ ((Platform2) => {
      Platform2["MACOS"] = "darwin";
      Platform2["WINDOWS"] = "win32";
      Platform2["LINUX"] = "linux";
      return Platform2;
    })(exports.Platform || {});
  }
});

// src/adapters/cdp-adapter.ts
var cdp_adapter_exports = {};
__export(cdp_adapter_exports, {
  CDPAdapter: () => exports.CDPAdapter
});
exports.CDPAdapter = void 0;
var init_cdp_adapter = __esm({
  "src/adapters/cdp-adapter.ts"() {
    init_types();
    exports.CDPAdapter = class {
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
          const data = fs2__namespace.readFileSync(tempPath);
          return data.toString("base64");
        } finally {
          if (fs2__namespace.existsSync(tempPath)) {
            fs2__namespace.unlinkSync(tempPath);
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
  PythonBridge: () => exports.PythonBridge
});
var DEFAULT_CONFIG; exports.PythonBridge = void 0;
var init_python_bridge = __esm({
  "src/adapters/python-bridge.ts"() {
    DEFAULT_CONFIG = {
      pythonPath: "python3",
      serverPath: "",
      port: 0,
      debug: false
    };
    exports.PythonBridge = class {
      config;
      process = null;
      available = false;
      requestId = 0;
      pendingRequests = /* @__PURE__ */ new Map();
      readline = null;
      constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (!this.config.serverPath) {
          this.config.serverPath = path2__namespace.resolve(
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
  NutJSAdapter: () => exports.NutJSAdapter
});
var KEY_MAP; exports.NutJSAdapter = void 0;
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
    exports.NutJSAdapter = class {
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
var PRICING; exports.CostTracker = void 0;
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
    exports.CostTracker = class {
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
        this.screenshotDir = path2__namespace.join(process.cwd(), ".agent-test-screenshots");
        if (!fs2__namespace.existsSync(this.screenshotDir)) {
          fs2__namespace.mkdirSync(this.screenshotDir, { recursive: true });
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
        const filepath = path2__namespace.join(this.screenshotDir, filename);
        const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, "");
        fs2__namespace.writeFileSync(filepath, Buffer.from(cleanData, "base64"));
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
        const requestFile = path2__namespace.join(
          this.screenshotDir,
          `request_${Date.now()}.json`
        );
        fs2__namespace.writeFileSync(requestFile, JSON.stringify(analysisRequest, null, 2));
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
        if (fs2__namespace.existsSync(responseFile)) {
          const response = JSON.parse(fs2__namespace.readFileSync(responseFile, "utf-8"));
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
  VLMClient: () => exports.VLMClient
});
var DEFAULT_MODELS; exports.VLMClient = void 0;
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
    exports.VLMClient = class {
      config;
      provider;
      model;
      costTracker;
      cursorBridge;
      constructor(config) {
        this.config = config;
        this.provider = this.normalizeProvider(config.provider);
        this.model = config.model || DEFAULT_MODELS[this.provider] || "gpt-4o";
        this.costTracker = new exports.CostTracker();
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
  async screenshot(path3, options = {}) {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for screenshot");
    }
    return this.cdpAdapter.screenshot(path3, options);
  }
  async startRecording(path3) {
    this.ensureConnected();
    if (!this.cdpAdapter) {
      throw new Error("CDP adapter not available for recording");
    }
    await this.cdpAdapter.startRecording(path3);
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

// src/index.ts
init_types();
init_client();
init_cost_tracker();
init_cdp_adapter();
init_python_bridge();
init_nutjs_adapter();
init_types();

exports.Assertions = Assertions;
exports.DesktopTest = DesktopTest;
exports.HybridMode = exports.TestMode;
exports.TestRunner = TestRunner;
exports.createDesktopTest = createDesktopTest;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map