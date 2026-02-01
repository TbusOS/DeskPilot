/**
 * ThemeTester - Test theme switching and CSS variables
 * 
 * Tests dark/light mode switching and validates CSS custom properties.
 */

import type { DesktopTest } from './desktop-test';

/** Theme name */
export type ThemeName = 'light' | 'dark' | 'system' | string;

/** CSS variable value */
export interface CSSVariableValue {
  /** Variable name (without --) */
  name: string;
  /** Computed value */
  value: string;
  /** Raw value (from stylesheet) */
  rawValue?: string;
}

/** Color information */
export interface ColorInfo {
  /** Hex value */
  hex: string;
  /** RGB values */
  rgb: { r: number; g: number; b: number };
  /** HSL values */
  hsl: { h: number; s: number; l: number };
  /** Alpha */
  alpha: number;
  /** Is dark color (luminance < 0.5) */
  isDark: boolean;
}

/** Theme state */
export interface ThemeState {
  /** Current theme name */
  current: ThemeName;
  /** Available themes */
  available: ThemeName[];
  /** System preference */
  systemPreference: 'light' | 'dark';
  /** Is using system theme */
  isSystem: boolean;
  /** Root element class */
  rootClass: string;
  /** Data-theme attribute */
  dataTheme?: string;
}

/** Theme comparison result */
export interface ThemeComparison {
  /** Variables that differ */
  differences: Array<{
    variable: string;
    theme1Value: string;
    theme2Value: string;
  }>;
  /** Variables that are the same */
  same: Array<{
    variable: string;
    value: string;
  }>;
}

/**
 * ThemeTester - Test theme functionality
 * 
 * @example
 * ```typescript
 * const theme = new ThemeTester(test);
 * 
 * // Get current theme
 * const state = await theme.getState();
 * console.log(`Current theme: ${state.current}`);
 * 
 * // Switch theme
 * await theme.switch('dark');
 * await theme.assertCurrentTheme('dark');
 * 
 * // Verify CSS variables
 * await theme.assertVariable('--bg-primary', '#1a1a1a');
 * 
 * // Check contrast
 * const contrast = await theme.checkContrast('--text-primary', '--bg-primary');
 * console.log(`Contrast ratio: ${contrast.ratio}`);
 * ```
 */
export class ThemeTester {
  private test: DesktopTest;
  private themeVariablePrefix: string;

  constructor(test: DesktopTest, options: { variablePrefix?: string } = {}) {
    this.test = test;
    this.themeVariablePrefix = options.variablePrefix || '';
  }

  /**
   * Get current theme state
   */
  async getState(): Promise<ThemeState> {
    const state = await this.test.evaluate(`
      (() => {
        const root = document.documentElement;
        const body = document.body;
        
        // Detect current theme from various sources
        const dataTheme = root.getAttribute('data-theme') || body.getAttribute('data-theme');
        const rootClass = root.className;
        const bodyClass = body.className;
        
        // Check for common theme class patterns
        let current = 'light';
        if (dataTheme) {
          current = dataTheme;
        } else if (rootClass.includes('dark') || bodyClass.includes('dark')) {
          current = 'dark';
        } else if (rootClass.includes('light') || bodyClass.includes('light')) {
          current = 'light';
        }
        
        // Get system preference
        const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? 'dark' 
          : 'light';
        
        // Check if using system theme
        const isSystem = dataTheme === 'system' || 
          (!dataTheme && !rootClass.includes('dark') && !rootClass.includes('light'));
        
        // Find available themes (from stylesheets or data attributes)
        const available = ['light', 'dark'];
        
        return {
          current,
          available,
          systemPreference,
          isSystem,
          rootClass,
          dataTheme: dataTheme || undefined
        };
      })()
    `) as ThemeState;

    return state;
  }

  /**
   * Switch to a different theme
   */
  async switch(theme: ThemeName): Promise<void> {
    await this.test.evaluate(`
      (() => {
        const root = document.documentElement;
        const body = document.body;
        
        // Try various methods to switch theme
        
        // Method 1: data-theme attribute
        root.setAttribute('data-theme', '${theme}');
        
        // Method 2: class name
        root.classList.remove('light', 'dark', 'theme-light', 'theme-dark');
        body.classList.remove('light', 'dark', 'theme-light', 'theme-dark');
        
        if ('${theme}' !== 'system') {
          root.classList.add('${theme}');
          body.classList.add('${theme}');
        }
        
        // Method 3: localStorage (for persistence)
        try {
          localStorage.setItem('theme', '${theme}');
        } catch (e) {}
        
        // Method 4: Dispatch event for React/Vue apps
        window.dispatchEvent(new CustomEvent('theme-change', { 
          detail: { theme: '${theme}' }
        }));
        
        // For Jotai-based apps (FlowSight)
        if (window.__JOTAI_SET_THEME__) {
          window.__JOTAI_SET_THEME__('${theme}');
        }
      })()
    `);

    // Wait for transition
    await new Promise(r => setTimeout(r, 300));
  }

  /**
   * Toggle between light and dark
   */
  async toggle(): Promise<ThemeName> {
    const state = await this.getState();
    const newTheme = state.current === 'dark' ? 'light' : 'dark';
    await this.switch(newTheme);
    return newTheme;
  }

  /**
   * Get a CSS variable value
   */
  async getVariable(name: string): Promise<CSSVariableValue> {
    const varName = name.startsWith('--') ? name : `--${name}`;
    
    const result = await this.test.evaluate(`
      (() => {
        const root = document.documentElement;
        const computed = getComputedStyle(root).getPropertyValue('${varName}').trim();
        
        // Try to get raw value from stylesheet
        let rawValue;
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText === ':root' || rule.selectorText?.includes('html')) {
                const value = rule.style?.getPropertyValue('${varName}');
                if (value) {
                  rawValue = value.trim();
                  break;
                }
              }
            }
          } catch (e) {}
        }
        
        return {
          name: '${varName.replace('--', '')}',
          value: computed,
          rawValue: rawValue || computed
        };
      })()
    `) as CSSVariableValue;

    return result;
  }

  /**
   * Get multiple CSS variables
   */
  async getVariables(names: string[]): Promise<CSSVariableValue[]> {
    const results: CSSVariableValue[] = [];
    for (const name of names) {
      results.push(await this.getVariable(name));
    }
    return results;
  }

  /**
   * Get all CSS variables with a prefix
   */
  async getAllVariables(prefix?: string): Promise<CSSVariableValue[]> {
    const searchPrefix = prefix || this.themeVariablePrefix;
    
    const variables = await this.test.evaluate(`
      (() => {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        const variables = [];
        
        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          if (prop.startsWith('--') && (!${JSON.stringify(searchPrefix)} || prop.includes(${JSON.stringify(searchPrefix)}))) {
            variables.push({
              name: prop.replace('--', ''),
              value: computed.getPropertyValue(prop).trim()
            });
          }
        }
        
        return variables;
      })()
    `) as CSSVariableValue[];

    return variables;
  }

  /**
   * Parse a color value to ColorInfo
   */
  async parseColor(value: string): Promise<ColorInfo> {
    const result = await this.test.evaluate(`
      (() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '${value}';
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        
        // Convert to hex
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        
        // Convert to HSL
        const r1 = r / 255, g1 = g / 255, b1 = b / 255;
        const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break;
            case g1: h = ((b1 - r1) / d + 2) / 6; break;
            case b1: h = ((r1 - g1) / d + 4) / 6; break;
          }
        }
        
        // Calculate luminance
        const luminance = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        
        return {
          hex,
          rgb: { r, g, b },
          hsl: { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) },
          alpha: a / 255,
          isDark: luminance < 0.5
        };
      })()
    `) as ColorInfo;

    return result;
  }

  /**
   * Check contrast ratio between two colors
   */
  async checkContrast(
    foregroundVar: string,
    backgroundVar: string
  ): Promise<{
    ratio: number;
    meetsAA: boolean;
    meetsAAA: boolean;
    meetsAALarge: boolean;
    meetsAAALarge: boolean;
  }> {
    const fg = await this.getVariable(foregroundVar);
    const bg = await this.getVariable(backgroundVar);
    
    const fgColor = await this.parseColor(fg.value);
    const bgColor = await this.parseColor(bg.value);
    
    // Calculate relative luminance
    const getLuminance = (rgb: { r: number; g: number; b: number }) => {
      const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    
    const l1 = getLuminance(fgColor.rgb);
    const l2 = getLuminance(bgColor.rgb);
    
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    
    return {
      ratio: Math.round(ratio * 100) / 100,
      meetsAA: ratio >= 4.5,
      meetsAAA: ratio >= 7,
      meetsAALarge: ratio >= 3,
      meetsAAALarge: ratio >= 4.5
    };
  }

  /**
   * Compare two themes
   */
  async compare(theme1: ThemeName, theme2: ThemeName): Promise<ThemeComparison> {
    // Get current state
    const currentState = await this.getState();
    
    // Get variables for theme1
    await this.switch(theme1);
    const vars1 = await this.getAllVariables();
    
    // Get variables for theme2
    await this.switch(theme2);
    const vars2 = await this.getAllVariables();
    
    // Restore original
    await this.switch(currentState.current);
    
    // Compare
    const vars1Map = new Map(vars1.map(v => [v.name, v.value]));
    const vars2Map = new Map(vars2.map(v => [v.name, v.value]));
    
    const differences: ThemeComparison['differences'] = [];
    const same: ThemeComparison['same'] = [];
    
    for (const [name, value1] of vars1Map) {
      const value2 = vars2Map.get(name);
      if (value2 && value1 !== value2) {
        differences.push({
          variable: name,
          theme1Value: value1,
          theme2Value: value2
        });
      } else if (value2 && value1 === value2) {
        same.push({ variable: name, value: value1 });
      }
    }
    
    return { differences, same };
  }

  /**
   * Assert current theme
   */
  async assertCurrentTheme(expected: ThemeName): Promise<void> {
    const state = await this.getState();
    if (state.current !== expected) {
      throw new Error(
        `Expected theme to be "${expected}", but got "${state.current}"`
      );
    }
  }

  /**
   * Assert CSS variable value
   */
  async assertVariable(name: string, expected: string): Promise<void> {
    const variable = await this.getVariable(name);
    
    // Normalize both values for comparison
    const normalize = (v: string) => v.replace(/\s+/g, ' ').trim().toLowerCase();
    
    if (normalize(variable.value) !== normalize(expected)) {
      throw new Error(
        `Expected ${name} to be "${expected}", but got "${variable.value}"`
      );
    }
  }

  /**
   * Assert color is dark/light
   */
  async assertColorIsDark(variableName: string): Promise<void> {
    const variable = await this.getVariable(variableName);
    const color = await this.parseColor(variable.value);
    
    if (!color.isDark) {
      throw new Error(
        `Expected ${variableName} to be a dark color, but luminance is >= 0.5`
      );
    }
  }

  /**
   * Assert color is light
   */
  async assertColorIsLight(variableName: string): Promise<void> {
    const variable = await this.getVariable(variableName);
    const color = await this.parseColor(variable.value);
    
    if (color.isDark) {
      throw new Error(
        `Expected ${variableName} to be a light color, but luminance is < 0.5`
      );
    }
  }

  /**
   * Assert contrast meets WCAG AA
   */
  async assertContrastAA(foregroundVar: string, backgroundVar: string): Promise<void> {
    const contrast = await this.checkContrast(foregroundVar, backgroundVar);
    
    if (!contrast.meetsAA) {
      throw new Error(
        `Contrast ratio ${contrast.ratio} does not meet WCAG AA (requires 4.5:1)`
      );
    }
  }

  /**
   * Assert contrast meets WCAG AAA
   */
  async assertContrastAAA(foregroundVar: string, backgroundVar: string): Promise<void> {
    const contrast = await this.checkContrast(foregroundVar, backgroundVar);
    
    if (!contrast.meetsAAA) {
      throw new Error(
        `Contrast ratio ${contrast.ratio} does not meet WCAG AAA (requires 7:1)`
      );
    }
  }

  /**
   * Take a theme screenshot for visual comparison
   */
  async captureTheme(theme: ThemeName, outputPath?: string): Promise<string> {
    const currentState = await this.getState();
    
    await this.switch(theme);
    await new Promise(r => setTimeout(r, 500)); // Wait for transitions
    
    const screenshot = await this.test.screenshot(outputPath);
    
    await this.switch(currentState.current);
    
    return screenshot;
  }
}

export default ThemeTester;
