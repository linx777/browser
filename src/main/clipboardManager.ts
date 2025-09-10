/* eslint-disable import/no-cycle */
/* eslint-disable import/prefer-default-export */

import { clipboard } from 'electron';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
}

export class ClipboardManager {
  private static instance: ClipboardManager;
  private clipboardItems: ClipboardItem[] = [];
  private lastClipboardContent: string = '';
  private clipboardFilePath: string;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 2000; // Check every 2 seconds
  private readonly MAX_ITEMS = 100; // Maximum number of items to store

  private constructor() {
    this.clipboardFilePath = path.join(__dirname, '..', '..', 'clipboard-items.json');
    this.clearClipboardItems(); // Clear clipboard history on app start
  }

  public static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  /**
   * Loads clipboard items from JSON file
   */
  private loadClipboardItems(): void {
    try {
      if (fs.existsSync(this.clipboardFilePath)) {
        const data = fs.readFileSync(this.clipboardFilePath, 'utf8');
        this.clipboardItems = JSON.parse(data);
      } else {
        this.clipboardItems = [];
      }
    } catch (error) {
      console.error('[ClipboardManager] Error loading clipboard items:', error);
      this.clipboardItems = [];
    }
  }

  /**
   * Saves clipboard items to JSON file
   */
  private saveClipboardItems(): void {
    try {
      fs.writeFileSync(this.clipboardFilePath, JSON.stringify(this.clipboardItems, null, 2));
    } catch (error) {
      console.error('[ClipboardManager] Error saving clipboard items:', error);
    }
  }

  /**
   * Generates a unique ID for clipboard items
   */
  private generateId(): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `${timestamp}${random}`;
  }

  /**
   * Adds a new clipboard item
   */
  public addClipboardItem(content: string): ClipboardItem {
    // Don't add empty content or duplicate content
    if (!content.trim() || content === this.lastClipboardContent) {
      return null;
    }

    const item: ClipboardItem = {
      id: this.generateId(),
      content: content.trim(),
      timestamp: Date.now()
    };

    // Add to the beginning of the array (most recent first)
    this.clipboardItems.unshift(item);

    // Limit the number of items
    if (this.clipboardItems.length > this.MAX_ITEMS) {
      this.clipboardItems = this.clipboardItems.slice(0, this.MAX_ITEMS);
    }

    this.lastClipboardContent = content;
    this.saveClipboardItems();

    return item;
  }

  /**
   * Gets all clipboard items
   */
  public getClipboardItems(): ClipboardItem[] {
    return [...this.clipboardItems];
  }

  /**
   * Clears all clipboard items
   */
  public clearClipboardItems(): void {
    this.clipboardItems = [];
    this.saveClipboardItems();
  }

  /**
   * Removes a specific clipboard item
   */
  public removeClipboardItem(id: string): boolean {
    const initialLength = this.clipboardItems.length;
    this.clipboardItems = this.clipboardItems.filter(item => item.id !== id);
    
    if (this.clipboardItems.length < initialLength) {
      this.saveClipboardItems();
      return true;
    }
    
    return false;
  }

  /**
   * Reads current clipboard content
   */
  public readClipboard(): string {
    try {
      return clipboard.readText();
    } catch (error) {
      console.error('[ClipboardManager] Error reading clipboard:', error);
      return '';
    }
  }

  /**
   * Writes text to clipboard
   */
  public writeClipboard(text: string): void {
    try {
      clipboard.writeText(text);
    } catch (error) {
      console.error('[ClipboardManager] Error writing to clipboard:', error);
      throw error;
    }
  }

  /**
   * Starts monitoring clipboard for changes
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.lastClipboardContent = this.readClipboard();

    this.monitoringInterval = setInterval(() => {
      try {
        const currentContent = this.readClipboard();
        
        if (currentContent && currentContent !== this.lastClipboardContent) {
          this.addClipboardItem(currentContent);
        }
      } catch (error) {
        console.error('[ClipboardManager] Error during clipboard monitoring:', error);
      }
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stops monitoring clipboard for changes
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Gets monitoring status
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Gets clipboard statistics
   */
  public getStats(): { totalItems: number; oldestItem?: number; newestItem?: number } {
    const totalItems = this.clipboardItems.length;
    const oldestItem = totalItems > 0 ? this.clipboardItems[totalItems - 1]?.timestamp : undefined;
    const newestItem = totalItems > 0 ? this.clipboardItems[0]?.timestamp : undefined;

    return {
      totalItems,
      oldestItem,
      newestItem
    };
  }
}

// Export singleton instance
export const clipboardManager = ClipboardManager.getInstance();
