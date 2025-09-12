/* eslint-disable import/no-cycle */
/* eslint-disable import/prefer-default-export */

import path from 'path';
import fs from 'fs';
import { BrowserWindow, screen } from 'electron';
import screenshot from 'screenshot-desktop';

export interface ScreenshotOptions {
  hideWindow?: boolean;
  format?: 'png' | 'jpg';
  quality?: number;
}

export class ScreenshotHelper {
  private static instance: ScreenshotHelper;
  private screenshotQueue: string[] = [];
  private readonly MAX_SCREENSHOTS = 10; // Maximum number of screenshots to keep
  private isTakingScreenshot = false;
  private lastScreenshotTime = 0;
  private readonly MIN_SCREENSHOT_INTERVAL = 100; // Minimum time between screenshots (ms)
  private readonly screenshotDir: string;

  private constructor() {
    // Store screenshots in project directory
    this.screenshotDir = path.join(__dirname, '..', '..', 'screenshots');
    this.ensureDirectoriesExist();
    this.clearAllScreenshots(); // Clear all screenshots on app start
  }

  public static getInstance(): ScreenshotHelper {
    if (!ScreenshotHelper.instance) {
      ScreenshotHelper.instance = new ScreenshotHelper();
    }
    return ScreenshotHelper.instance;
  }

  /**
   * Ensures screenshot directory exists
   */
  private ensureDirectoriesExist(): void {
    try {
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir, { recursive: true });
      }
    } catch (error) {
      console.error('[ScreenshotHelper] Error creating screenshot directory:', error);
    }
  }

  /**
   * Detects which screen the window is currently on
   */
  private getWindowScreenIndex(window?: BrowserWindow): number {
    if (!window) {
      return 0;
    }

    try {
      const windowBounds = window.getBounds();
      const windowCenterX = windowBounds.x + windowBounds.width / 2;
      const windowCenterY = windowBounds.y + windowBounds.height / 2;
      
      const displays = screen.getAllDisplays();
      
      for (let i = 0; i < displays.length; i++) {
        const display = displays[i];
        const { x, y, width, height } = display.bounds;
        
        // Check if window center is within this display's bounds
        if (windowCenterX >= x && windowCenterX < x + width &&
            windowCenterY >= y && windowCenterY < y + height) {
          return i;
        }
      }
      
      // Fallback to primary screen if window position doesn't match any display
      return 0;
    } catch (error) {
      console.error('[ScreenshotHelper] Error detecting window screen:', error);
      return 0;
    }
  }


  /**
   * Captures screenshot using screenshot-desktop library
   */
  private async captureScreenshot(window?: BrowserWindow): Promise<Buffer> {
    try {
      // Detect which screen the window is on
      const screenIndex = this.getWindowScreenIndex(window);
      
      // Use PNG format for better quality
      const buffer = await screenshot({ 
        format: 'png',
        screen: screenIndex, // Use the screen where the window is located
      });
      
      if (!buffer || buffer.length === 0) {
        throw new Error('Screenshot returned empty buffer');
      }
      
      return buffer;
    } catch (error) {
      console.error('[ScreenshotHelper] Error capturing screenshot:', error);
      
      // Fallback: try without screen specification
      try {
        const buffer = await screenshot({ format: 'png' });
        if (buffer && buffer.length > 0) {
          return buffer;
        }
      } catch (fallbackError) {
        console.error('[ScreenshotHelper] Fallback screenshot method failed:', fallbackError);
      }
      
      throw new Error(`Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Takes a screenshot with optional window hiding
   */
  public async takeScreenshot(
    mainWindow?: BrowserWindow,
    options: ScreenshotOptions = {}
  ): Promise<string> {
    // Prevent multiple simultaneous screenshots
    if (this.isTakingScreenshot) {
      throw new Error('Screenshot already in progress');
    }
    
    // Rate limiting - prevent too frequent screenshots
    const now = Date.now();
    if (now - this.lastScreenshotTime < this.MIN_SCREENSHOT_INTERVAL) {
      throw new Error('Screenshot rate limited');
    }
    
    this.isTakingScreenshot = true;
    this.lastScreenshotTime = now;
    
    let screenshotPath = '';
    
    try {
      // Ensure directory exists
      this.ensureDirectoriesExist();
      
      // Hide window if requested and mainWindow is provided
      if (options.hideWindow && mainWindow) {
        mainWindow.hide();
        
        // Minimal delay for window hiding
        const hideDelay = process.platform === 'win32' ? 15 : 10;
        await new Promise((resolve) => setTimeout(resolve, hideDelay));
      }
      
      // Capture screenshot
      const screenshotBuffer = await this.captureScreenshot(mainWindow);
      
      if (!screenshotBuffer || screenshotBuffer.length === 0) {
        throw new Error('Screenshot capture returned empty buffer');
      }
      
      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      screenshotPath = path.join(this.screenshotDir, filename);
      
      // Save screenshot
      await fs.promises.writeFile(screenshotPath, screenshotBuffer);
      
      // Add to queue and manage old screenshots
      this.manageScreenshotQueue(screenshotPath);
      
    } catch (error) {
      console.error('[ScreenshotHelper] Screenshot error:', error);
      throw error;
    } finally {
      // Always try to show window if it was hidden
      if (options.hideWindow && mainWindow) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          mainWindow.show();
        } catch (showError) {
          console.error('[ScreenshotHelper] Failed to show window after screenshot:', showError);
        }
      }
      
      // Always reset the flag
      this.isTakingScreenshot = false;
    }
    
    return screenshotPath;
  }

  /**
   * Manages screenshot queue to prevent too many files
   */
  private manageScreenshotQueue(newPath: string): void {
    this.screenshotQueue.push(newPath);
    
    if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
      // Remove the oldest screenshot
      const removedPath = this.screenshotQueue.shift();
      if (removedPath && fs.existsSync(removedPath)) {
        try {
          fs.unlinkSync(removedPath);
        } catch (error) {
          console.error('[ScreenshotHelper] Error removing old screenshot:', error);
        }
      }
    }
  }

  /**
   * Gets all screenshot paths
   */
  public getScreenshotPaths(): string[] {
    return [...this.screenshotQueue];
  }

  /**
   * Gets screenshot directory path
   */
  public getScreenshotDirectory(): string {
    return this.screenshotDir;
  }

  /**
   * Clears all screenshots
   */
  public clearScreenshots(): void {
    this.screenshotQueue.forEach((screenshotPath) => {
      if (fs.existsSync(screenshotPath)) {
        try {
          fs.unlinkSync(screenshotPath);
        } catch (error) {
          console.error(`[ScreenshotHelper] Error deleting screenshot ${screenshotPath}:`, error);
        }
      }
    });
    this.screenshotQueue = [];
  }

  /**
   * Clears all files in the screenshots directory
   */
  public clearAllScreenshots(): void {
    try {
      if (fs.existsSync(this.screenshotDir)) {
        const files = fs.readdirSync(this.screenshotDir);
        files.forEach((file) => {
          const filePath = path.join(this.screenshotDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.error(`[ScreenshotHelper] Error deleting file ${filePath}:`, error);
          }
        });
      }
      this.screenshotQueue = [];
    } catch (error) {
      console.error('[ScreenshotHelper] Error clearing all screenshots:', error);
    }
  }

  /**
   * Gets image preview as base64
   */
  public async getImagePreview(filepath: string): Promise<{ success: boolean; preview?: string; error?: string }> {
    try {
      if (!fs.existsSync(filepath)) {
        return { success: false, error: 'Image file does not exist' };
      }
      
      const stats = fs.statSync(filepath);
      if (!stats.isFile()) {
        return { success: false, error: 'Path is not a file' };
      }
      
      const data = fs.readFileSync(filepath);
      if (data.length === 0) {
        return { success: false, error: 'Image file is empty' };
      }
      
      const preview = `data:image/png;base64,${data.toString('base64')}`;
      return { success: true, preview };
    } catch (error) {
      console.error('[ScreenshotHelper] Error reading image:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Deletes a specific screenshot
   */
  public async deleteScreenshot(filepath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove from queue
      this.screenshotQueue = this.screenshotQueue.filter(path => path !== filepath);
      
      // Delete file
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      return { success: true };
    } catch (error) {
      console.error('[ScreenshotHelper] Error deleting screenshot:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Gets screenshot statistics
   */
  public getStats(): { totalScreenshots: number; directory: string } {
    return {
      totalScreenshots: this.screenshotQueue.length,
      directory: this.screenshotDir
    };
  }
}

// Export singleton instance
export const screenshotHelper = ScreenshotHelper.getInstance();
