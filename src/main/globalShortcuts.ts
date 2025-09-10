import { globalShortcut, app, BrowserWindow } from 'electron';

/**
 * Global shortcuts helper for BonBon Browser
 */
export class GlobalShortcutsHelper {
  private mainWindow: BrowserWindow | null = null;
  private isClickThrough: boolean = true; // Default to click-through enabled
  private mouseTrackingInterval: NodeJS.Timeout | null = null;
  private lastManualToggle: number = 0; // Track when user manually toggles click-through

  constructor() {
    // Unregister shortcuts when quitting
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      this.stopMouseTracking();
    });
  }

  /**
   * Sets the main window reference and enables click-through by default
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    
    // Enable click-through by default when window is set
    if (window) {
      this.enableClickThrough();
      
      // Start mouse tracking when window is ready
      window.on('ready-to-show', () => {
        this.startMouseTracking();
        console.log('Started mouse tracking for automatic click-through');
      });
      
      // Stop mouse tracking when window is closed
      window.on('closed', () => {
        this.stopMouseTracking();
        console.log('Stopped mouse tracking');
      });
    }
  }

  /**
   * Registers all global shortcuts
   */
  registerGlobalShortcuts(): void {
    // Window movement shortcuts
    globalShortcut.register('CommandOrControl+Left', () => {
      console.log('Command/Ctrl + Left pressed. Moving window left.');
      this.moveWindowLeft();
    });

    globalShortcut.register('CommandOrControl+Right', () => {
      console.log('Command/Ctrl + Right pressed. Moving window right.');
      this.moveWindowRight();
    });

    globalShortcut.register('CommandOrControl+Up', () => {
      console.log('Command/Ctrl + Up pressed. Moving window up.');
      this.moveWindowUp();
    });

    globalShortcut.register('CommandOrControl+Down', () => {
      console.log('Command/Ctrl + Down pressed. Moving window down.');
      this.moveWindowDown();
    });

    // Window visibility toggle
    globalShortcut.register('CommandOrControl+B', () => {
      console.log('Command/Ctrl + B pressed. Toggling window visibility.');
      this.toggleWindowVisibility();
    });

    // Opacity adjustment shortcuts
    globalShortcut.register('CommandOrControl+[', () => {
      console.log('Command/Ctrl + [ pressed. Decreasing opacity.');
      this.adjustOpacity(-0.1);
    });

    globalShortcut.register('CommandOrControl+]', () => {
      console.log('Command/Ctrl + ] pressed. Increasing opacity.');
      this.adjustOpacity(0.1);
    });

    // Click-through toggle shortcut
    globalShortcut.register('CommandOrControl+T', () => {
      console.log('Command/Ctrl + T pressed. Disabling click-through mode.');
      this.disableClickThrough();
    });

    // Screenshot shortcut
    globalShortcut.register('CommandOrControl+H', async () => {
      await this.takeScreenshot();
    });

    console.log('Global shortcuts registered successfully');
  }

  /**
   * Unregisters all global shortcuts
   */
  unregisterGlobalShortcuts(): void {
    globalShortcut.unregisterAll();
    console.log('Global shortcuts unregistered');
  }

  /**
   * Moves the window left
   */
  private moveWindowLeft(): void {
    if (!this.mainWindow) return;
    
    const [currentX, currentY] = this.mainWindow.getPosition();
    const moveDistance = 10;
    const newX = Math.max(0, currentX - moveDistance);
    
    this.mainWindow.setPosition(newX, currentY);
  }

  /**
   * Moves the window right
   */
  private moveWindowRight(): void {
    if (!this.mainWindow) return;
    
    const [currentX, currentY] = this.mainWindow.getPosition();
    const moveDistance = 10;
    const newX = currentX + moveDistance;
    
    this.mainWindow.setPosition(newX, currentY);
  }

  /**
   * Moves the window up
   */
  private moveWindowUp(): void {
    if (!this.mainWindow) return;
    
    const [currentX, currentY] = this.mainWindow.getPosition();
    const moveDistance = 10;
    const newY = Math.max(0, currentY - moveDistance);
    
    this.mainWindow.setPosition(currentX, newY);
  }

  /**
   * Moves the window down
   */
  private moveWindowDown(): void {
    if (!this.mainWindow) return;
    
    const [currentX, currentY] = this.mainWindow.getPosition();
    const moveDistance = 10;
    const newY = currentY + moveDistance;
    
    this.mainWindow.setPosition(currentX, newY);
  }

  /**
   * Toggles window visibility
   */
  private toggleWindowVisibility(): void {
    if (!this.mainWindow) return;
    
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.mainWindow.show();
    }
  }

  /**
   * Adjusts window opacity
   */
  private adjustOpacity(delta: number): void {
    if (!this.mainWindow) return;
    
    const currentOpacity = this.mainWindow.getOpacity();
    const newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    
    console.log(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);
    this.mainWindow.setOpacity(newOpacity);
  }

  /**
   * Enables click-through mode (default state)
   */
  enableClickThrough(): void {
    if (!this.mainWindow) return;

    this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    this.isClickThrough = true;
    console.log('Click-through enabled - clicks will pass through');
  }

  /**
   * Disables click-through mode
   */
  disableClickThrough(): void {
    if (!this.mainWindow) return;

    // Record manual toggle time to prevent mouse tracking interference
    this.lastManualToggle = Date.now();

    this.mainWindow.setIgnoreMouseEvents(false);
    this.isClickThrough = false;
    console.log('Click-through disabled - normal mouse interaction restored');
  }

  /**
   * Toggles click-through mode
   */
  toggleClickThrough(): void {
    if (this.isClickThrough) {
      this.disableClickThrough();
    } else {
      this.enableClickThrough();
    }
  }

  /**
   * Gets the current click-through state
   */
  getClickThroughState(): boolean {
    return this.isClickThrough;
  }

  /**
   * Starts mouse tracking for automatic click-through management
   */
  startMouseTracking(): void {
    if (this.mouseTrackingInterval) return; // Already tracking
    
    this.mouseTrackingInterval = setInterval(() => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
      
      // Don't interfere with manual toggles for 2 seconds
      if (Date.now() - this.lastManualToggle < 2000) return;
      
      const { screen } = require('electron');
      const cursor = screen.getCursorScreenPoint();
      const windowBounds = this.mainWindow.getBounds();
      
      // Check if mouse is within window bounds
      const isMouseInWindow = cursor.x >= windowBounds.x && 
                             cursor.x <= windowBounds.x + windowBounds.width &&
                             cursor.y >= windowBounds.y && 
                             cursor.y <= windowBounds.y + windowBounds.height;
      
      if (!isMouseInWindow && !this.isClickThrough) {
        // Mouse is outside window, enable click-through
        this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
        this.isClickThrough = true;
        console.log('Mouse left window - automatically enabled click-through');
      }
      // Note: We never automatically disable click-through when mouse enters window
      // User must manually use Ctrl+T to disable click-through for interaction
    }, 100); // Check every 100ms for responsive behavior
  }

  /**
   * Stops mouse tracking
   */
  stopMouseTracking(): void {
    if (this.mouseTrackingInterval) {
      clearInterval(this.mouseTrackingInterval);
      this.mouseTrackingInterval = null;
    }
  }

  /**
   * Takes a screenshot using the screenshot helper
   */
  private async takeScreenshot(): Promise<void> {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const screenshotPath = await screenshotHelper.takeScreenshot(this.mainWindow, {
        hideWindow: true,
        format: 'png'
      });
      
      // Notify renderer process about the screenshot
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('screenshot-taken', {
          path: screenshotPath,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      
      // Notify renderer process about the error
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('screenshot-error', {
          error: error.message
        });
      }
    }
  }
}

// Export a singleton instance
export const globalShortcutsHelper = new GlobalShortcutsHelper();
