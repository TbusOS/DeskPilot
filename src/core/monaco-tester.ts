/**
 * MonacoTester - Monaco Editor Testing Module
 * 
 * Specialized testing for Monaco Editor integration.
 * Supports syntax highlighting, code navigation, completions, and more.
 */

import type { DesktopTest } from './desktop-test';

/** Cursor position */
export interface CursorPosition {
  lineNumber: number;
  column: number;
}

/** Selection range */
export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** Token info */
export interface TokenInfo {
  /** Token text */
  text: string;
  /** Token type/scope */
  type: string;
  /** Start column */
  startColumn: number;
  /** End column */
  endColumn: number;
  /** Foreground color */
  foreground?: string;
  /** Font style (bold, italic) */
  fontStyle?: string;
}

/** Completion item */
export interface CompletionItem {
  /** Label */
  label: string;
  /** Kind (function, variable, etc.) */
  kind: string;
  /** Detail */
  detail?: string;
  /** Documentation */
  documentation?: string;
  /** Insert text */
  insertText?: string;
}

/** Diagnostic (error/warning) */
export interface Diagnostic {
  /** Severity (error, warning, info, hint) */
  severity: 'error' | 'warning' | 'info' | 'hint';
  /** Message */
  message: string;
  /** Start line */
  startLineNumber: number;
  /** Start column */
  startColumn: number;
  /** End line */
  endLineNumber: number;
  /** End column */
  endColumn: number;
  /** Source */
  source?: string;
  /** Code */
  code?: string;
}

/** Editor state */
export interface EditorState {
  /** Current content */
  content: string;
  /** Line count */
  lineCount: number;
  /** Current cursor position */
  cursor: CursorPosition;
  /** Current selection */
  selection: SelectionRange | null;
  /** Language ID */
  language: string;
  /** Is read-only */
  readOnly: boolean;
  /** Has focus */
  hasFocus: boolean;
  /** Visible line range */
  visibleRange: { startLine: number; endLine: number };
}

/**
 * MonacoTester - Test Monaco Editor functionality
 * 
 * @example
 * ```typescript
 * const editor = new MonacoTester(test, '[data-testid="code-editor"]');
 * 
 * // Set content
 * await editor.setValue('int main() { return 0; }');
 * 
 * // Navigate
 * await editor.goToLine(10);
 * 
 * // Test syntax highlighting
 * const tokens = await editor.getTokensAtLine(1);
 * await editor.assertTokenType(1, 'int', 'keyword');
 * 
 * // Test code completion
 * await editor.triggerCompletion();
 * await editor.selectCompletion('printf');
 * ```
 */
export class MonacoTester {
  private test: DesktopTest;
  private selector: string;

  constructor(test: DesktopTest, selector: string = '[data-testid="code-editor"]') {
    this.test = test;
    this.selector = selector;
  }

  /**
   * Get the current editor state
   */
  async getState(): Promise<EditorState> {
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
    `) as EditorState | null;

    if (!state) {
      throw new Error(`Monaco editor not found: ${this.selector}`);
    }

    return state;
  }

  /**
   * Get editor content
   */
  async getValue(): Promise<string> {
    const state = await this.getState();
    return state.content;
  }

  /**
   * Set editor content
   */
  async setValue(content: string): Promise<void> {
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
  async insertText(text: string): Promise<void> {
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
  async getLineContent(lineNumber: number): Promise<string> {
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
    `) as string;

    return content;
  }

  /**
   * Go to a specific line
   */
  async goToLine(lineNumber: number, column: number = 1): Promise<void> {
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
  async setCursor(lineNumber: number, column: number): Promise<void> {
    await this.goToLine(lineNumber, column);
  }

  /**
   * Get cursor position
   */
  async getCursor(): Promise<CursorPosition> {
    const state = await this.getState();
    return state.cursor;
  }

  /**
   * Select text range
   */
  async select(range: SelectionRange): Promise<void> {
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
  async selectAll(): Promise<void> {
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
  async getTokensAtLine(lineNumber: number): Promise<TokenInfo[]> {
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
    `) as TokenInfo[];

    return tokens;
  }

  /**
   * Trigger code completion
   */
  async triggerCompletion(): Promise<void> {
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

    // Wait for suggestions to appear
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Get completion suggestions
   */
  async getCompletions(): Promise<CompletionItem[]> {
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
    `) as CompletionItem[];

    return completions;
  }

  /**
   * Select a completion item
   */
  async selectCompletion(label: string): Promise<void> {
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
  async goToDefinition(): Promise<void> {
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
  async findReferences(): Promise<void> {
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
  async getDiagnostics(): Promise<Diagnostic[]> {
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
    `) as Diagnostic[];

    return diagnostics;
  }

  /**
   * Focus the editor
   */
  async focus(): Promise<void> {
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
  async executeAction(actionId: string): Promise<void> {
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
  async undo(): Promise<void> {
    await this.executeAction('undo');
  }

  /**
   * Redo
   */
  async redo(): Promise<void> {
    await this.executeAction('redo');
  }

  /**
   * Format document
   */
  async format(): Promise<void> {
    await this.executeAction('editor.action.formatDocument');
  }

  /**
   * Toggle comment
   */
  async toggleComment(): Promise<void> {
    await this.executeAction('editor.action.commentLine');
  }

  /**
   * Assert content equals
   */
  async assertContent(expected: string, message?: string): Promise<void> {
    const content = await this.getValue();
    if (content !== expected) {
      throw new Error(message || `Expected content to equal:\n${expected}\n\nActual:\n${content}`);
    }
  }

  /**
   * Assert content contains
   */
  async assertContains(text: string, message?: string): Promise<void> {
    const content = await this.getValue();
    if (!content.includes(text)) {
      throw new Error(message || `Expected content to contain: ${text}`);
    }
  }

  /**
   * Assert token type at position
   */
  async assertTokenType(lineNumber: number, tokenText: string, expectedType: string, message?: string): Promise<void> {
    const tokens = await this.getTokensAtLine(lineNumber);
    const token = tokens.find(t => t.text.trim() === tokenText);
    
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
  async assertNoErrors(message?: string): Promise<void> {
    const diagnostics = await this.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 'error');
    
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `  Line ${e.startLineNumber}: ${e.message}`).join('\n');
      throw new Error(message || `Expected no errors, found ${errors.length}:\n${errorMessages}`);
    }
  }

  /**
   * Assert cursor position
   */
  async assertCursor(lineNumber: number, column: number, message?: string): Promise<void> {
    const cursor = await this.getCursor();
    if (cursor.lineNumber !== lineNumber || cursor.column !== column) {
      throw new Error(message || `Expected cursor at (${lineNumber}, ${column}), got (${cursor.lineNumber}, ${cursor.column})`);
    }
  }
}

export default MonacoTester;
