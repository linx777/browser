import { globalShortcut, app, BrowserWindow } from 'electron';

/**
 * Global shortcuts helper for BonBon Browser
 */
export class GlobalShortcutsHelper {
  private mainWindow: BrowserWindow | null = null;
  private isClickThrough: boolean = true; // Default to click-through enabled
  private mouseTrackingInterval: NodeJS.Timeout | null = null;
  private lastManualToggle: number = 0; // Track when user manually toggles click-through
  private currentZoomFactor: number = 1; // Track current zoom across views
  // Persistent disable lock toggled by Cmd/Ctrl + double-press T
  private persistentDisableLock: boolean = false;
  private lastTPressTime: number = 0;
  private readonly doublePressThresholdMs: number = 350;
  private tSinglePressTimer: NodeJS.Timeout | null = null;

  // Dynamic registration control for zoom shortcuts
  private zoomShortcutsRegistered: boolean = false;
  private readonly zoomInAccelerators: string[] = [
    'CommandOrControl+=',
    'CommandOrControl+Shift+='
  ];
  private readonly zoomOutAccelerators: string[] = [
    'CommandOrControl+-'
  ];

  // Track critical shortcuts that must remain always-on
  private readonly criticalAccelerators: string[] = [
    'CommandOrControl+B', // toggle visibility
  ];

  constructor() {
    // Unregister shortcuts when quitting
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      this.stopMouseTracking();
      if (this.tSinglePressTimer) {
        clearTimeout(this.tSinglePressTimer);
        this.tSinglePressTimer = null;
      }
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
        this.updateZoomShortcutsRegistration();
      });
      
      // Stop mouse tracking when window is closed
      window.on('closed', () => {
        this.stopMouseTracking();
        console.log('Stopped mouse tracking');
        this.unregisterZoomShortcuts();
      });

      // Update zoom shortcut registration on window visibility changes
      window.on('show', () => this.updateZoomShortcutsRegistration());
      window.on('hide', () => this.updateZoomShortcutsRegistration());
      window.on('minimize', () => this.updateZoomShortcutsRegistration());
      window.on('restore', () => this.updateZoomShortcutsRegistration());

      // Ensure critical shortcuts remain registered regardless of visibility
      const ensure = () => this.ensureCriticalShortcuts();
      window.on('show', ensure);
      window.on('hide', ensure);
      window.on('minimize', ensure);
      window.on('restore', ensure);
      // Also ensure after ready-to-show
      window.on('ready-to-show', ensure);
    }
  }

  /**
   * Registers all global shortcuts
   */
  registerGlobalShortcuts(): void {
    // Window movement shortcuts
    globalShortcut.register('CommandOrControl+Left', () => {
      this.moveWindowLeft();
    });

    globalShortcut.register('CommandOrControl+Right', () => {
      this.moveWindowRight();
    });

    globalShortcut.register('CommandOrControl+Up', () => {
      this.moveWindowUp();
    });

    globalShortcut.register('CommandOrControl+Down', () => {
      this.moveWindowDown();
    });

    // Window visibility toggle
    globalShortcut.register('CommandOrControl+B', () => {
      this.toggleWindowVisibility();
    });

    // Opacity adjustment shortcuts
    globalShortcut.register('CommandOrControl+[', () => {
      this.adjustOpacity(-0.1);
    });

    globalShortcut.register('CommandOrControl+]', () => {
      this.adjustOpacity(0.1);
    });

    // Click-through shortcuts
    // Single press Cmd/Ctrl+T => temporarily disable click-through
    // Double-press Cmd/Ctrl+T within threshold => toggle persistent disable lock
    globalShortcut.register('CommandOrControl+T', () => {
      const now = Date.now();
      // If second press within threshold => treat as double press
      if (now - this.lastTPressTime <= this.doublePressThresholdMs) {
        this.lastTPressTime = 0;
        if (this.tSinglePressTimer) {
          clearTimeout(this.tSinglePressTimer);
          this.tSinglePressTimer = null;
        }
        this.togglePersistentDisable();
        return;
      }
      // First press: arm a timer for single-press action
      this.lastTPressTime = now;
      if (this.tSinglePressTimer) {
        clearTimeout(this.tSinglePressTimer);
        this.tSinglePressTimer = null;
      }
      this.tSinglePressTimer = setTimeout(() => {
        this.tSinglePressTimer = null;
        // Single press behavior: temporarily disable click-through
        this.disableClickThrough();
        this.lastTPressTime = 0;
      }, this.doublePressThresholdMs + 10);
    });

    // Screenshot shortcut
    globalShortcut.register('CommandOrControl+H', async () => {
      await this.takeScreenshot();
    });

    // Register zoom shortcuts dynamically based on visibility and click-through state
    this.updateZoomShortcutsRegistration();

    // Clear all data shortcut (screenshots, toasts, clipboard)
    globalShortcut.register('CommandOrControl+R', async () => {
      await this.clearAllData();
    });

    // Focus ChatGPT input shortcut
    globalShortcut.register('CommandOrControl+W', () => {
      this.focusChatGPTInput();
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
   * Ensure critical shortcuts like Cmd/Ctrl+B stay registered system-wide
   */
  private ensureCriticalShortcuts(): void {
    this.criticalAccelerators.forEach((acc) => {
      try {
        if (!globalShortcut.isRegistered(acc)) {
          globalShortcut.register(acc, () => {
            if (acc === 'CommandOrControl+B') this.toggleWindowVisibility();
          });
          console.log(`Re-registered critical shortcut: ${acc}`);
        }
      } catch (e) {
        // Best-effort: ignore re-register errors
      }
    });
  }

  /**
   * Moves the window left
   */
  private moveWindowLeft(): void {
    if (!this.mainWindow) return;
    
    const [currentX, currentY] = this.mainWindow.getPosition();
    const moveDistance = 10;
    // Allow negative X positions so window can move beyond the left edge
    const newX = currentX - moveDistance;
    
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
   * Adjusts zoom factor of the currently selected BrowserView
   */
  private adjustZoom(delta: number): void {
    try {
      // Only allow zoom when window is visible and click-through is disabled
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
      if (!this.mainWindow.isVisible()) return;
      if (this.isClickThrough) return;

      const { getSelectedView } = require('./browser');
      const view = getSelectedView();
      if (!view || view.webContents.isDestroyed()) return;

      // Use webContents zoomFactor which applies to the page
      const wc: any = view.webContents as any;
      const current: number = typeof wc.getZoomFactor === 'function' ? wc.getZoomFactor() : this.currentZoomFactor;
      const next = Math.max(0.25, Math.min(3, +(current + delta).toFixed(2)));
      if (typeof wc.setZoomFactor === 'function') wc.setZoomFactor(next);
      this.currentZoomFactor = next;
    } catch (err) {
      // ignore
    }
  }

  /**
   * Enables click-through mode (default state)
   */
  enableClickThrough(): void {
    if (!this.mainWindow) return;
    // If persistent disable lock is active, ignore enable requests
    if (this.persistentDisableLock) {
      console.log('Enable click-through ignored due to persistent disable lock');
      return;
    }
    try {
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
      this.isClickThrough = true;
    } catch (e) {
      console.error('Failed to enable click-through:', e);
    }
    console.log('Click-through enabled - clicks will pass through');
    this.updateZoomShortcutsRegistration();
  }

  /**
   * Disables click-through mode
   */
  disableClickThrough(): void {
    if (!this.mainWindow) return;

    // Record manual toggle time to prevent mouse tracking interference
    this.lastManualToggle = Date.now();

    try {
      this.mainWindow.setIgnoreMouseEvents(false);
      this.isClickThrough = false;
    } catch (e) {
      console.error('Failed to disable click-through:', e);
    }
    console.log('Click-through disabled - normal mouse interaction restored');
    this.updateZoomShortcutsRegistration();
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
      // Do not auto-toggle when persistent disable lock is active
      if (this.persistentDisableLock) return;
      
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
   * Toggles persistent disable lock via double-press
   * When enabled, click-through stays disabled until toggled again
   */
  private togglePersistentDisable(): void {
    this.persistentDisableLock = !this.persistentDisableLock;
    if (this.persistentDisableLock) {
      console.log('Persistent disable lock enabled - click-through stays disabled');
      this.disableClickThrough();
    } else {
      console.log('Persistent disable lock disabled - restoring click-through');
      this.enableClickThrough();
    }
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
      // First focus the AI service input area before taking screenshot
      this.focusChatGPTInput();
      
      // Wait a moment for focus to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { screenshotHelper } = require('./screenshotHelper');
      const screenshotPath = await screenshotHelper.takeScreenshot(this.mainWindow, {
        hideWindow: true,
        format: 'png'
      });
      
      if (screenshotPath) {
        // Copy screenshot to clipboard
        try {
          const { clipboard } = require('electron');
          const fs = require('fs');
          
          // Read the image file
          const imageBuffer = fs.readFileSync(screenshotPath);
          
          // Create a native image from buffer
          const { nativeImage } = require('electron');
          const image = nativeImage.createFromBuffer(imageBuffer);
          
          // Copy to clipboard
          clipboard.writeImage(image);
          
          // Automatically simulate Cmd+V paste
          setTimeout(() => {
            try {
              const { simulatePasteWithGlobalShortcut } = require('./keyboardSimulation');
              simulatePasteWithGlobalShortcut();
            } catch (pasteError) {
              console.error('Error simulating paste:', pasteError);
            }
          }, 100); // Delay to ensure clipboard is ready
          
        } catch (clipboardError) {
          console.error('Error copying screenshot to clipboard:', clipboardError);
        }
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }
  }

  /**
   * Focuses ChatGPT input area
   */
  private focusChatGPTInput(): void {
    try {
      // Import the function from appEvents
      const { focusChatGPTInput } = require('./appEvents');
      focusChatGPTInput();
    } catch (error) {
      console.error('Error focusing ChatGPT input:', error);
    }
  }

  /**
   * Clears all data: screenshots, toasts, and clipboard
   */
  private async clearAllData(): Promise<void> {
    try {
      // Clear all screenshots
      const { screenshotHelper } = require('./screenshotHelper');
      screenshotHelper.clearAllScreenshots();
      
      // Clear clipboard items
      const { clipboardManager } = require('./clipboardManager');
      clipboardManager.clearClipboardItems();
      
      // Clear clipboard JSON file
      const fs = require('fs');
      const path = require('path');
      const clipboardFilePath = path.join(__dirname, '..', '..', 'clipboard-items.json');
      if (fs.existsSync(clipboardFilePath)) {
        fs.writeFileSync(clipboardFilePath, '[]');
      }
      
      // Send message to renderer to clear toasts
      if (this.mainWindow) {
        this.mainWindow.webContents.send('clear-all-toasts');
        
        // Also clear copy toasts by executing JavaScript in all webviews
        this.mainWindow.webContents.executeJavaScript(`
          // Clear all copy toasts (bonbon-notification elements)
          document.querySelectorAll('.bonbon-notification').forEach(toast => toast.remove());
        `).catch(() => {
          // Silently handle errors
        });
      }
      
      // Clear copy toasts in all browser webviews
      const { getBrowsers } = require('./ipcMainEvents');
      const browsers = getBrowsers();
      Object.values(browsers).forEach((webContents: any) => {
        if (webContents && !webContents.isDestroyed()) {
          webContents.executeJavaScript(`
            // Clear all copy toasts (bonbon-notification elements)
            document.querySelectorAll('.bonbon-notification').forEach(toast => toast.remove());
          `).catch(() => {
            // Silently handle errors
          });
        }
      });
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  /**
   * Registers zoom-related global shortcuts
   */
  private registerZoomShortcuts(): void {
    if (this.zoomShortcutsRegistered) return;
    let successCount = 0;
    this.zoomInAccelerators.forEach((acc) => {
      try {
        globalShortcut.register(acc, () => this.adjustZoom(0.1));
        successCount += 1;
      } catch (e) {
        console.warn(`Failed to register accelerator: ${acc}`, e);
      }
    });
    this.zoomOutAccelerators.forEach((acc) => {
      try {
        globalShortcut.register(acc, () => this.adjustZoom(-0.1));
        successCount += 1;
      } catch (e) {
        console.warn(`Failed to register accelerator: ${acc}`, e);
      }
    });
    this.zoomShortcutsRegistered = successCount > 0;
    if (this.zoomShortcutsRegistered) console.log('Zoom shortcuts registered');
  }

  /**
   * Unregisters zoom-related global shortcuts
   */
  private unregisterZoomShortcuts(): void {
    if (!this.zoomShortcutsRegistered) return;
    [...this.zoomInAccelerators, ...this.zoomOutAccelerators].forEach((acc) => {
      try {
        globalShortcut.unregister(acc);
      } catch (e) {
        // ignore
      }
    });
    this.zoomShortcutsRegistered = false;
    console.log('Zoom shortcuts unregistered');
  }

  /**
   * Conditionally register/unregister zoom shortcuts based on app visibility and click-through state
   */
  private updateZoomShortcutsRegistration(): void {
    const allowed = !!this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible() && !this.isClickThrough;
    if (allowed) this.registerZoomShortcuts();
    else this.unregisterZoomShortcuts();
  }
}

// Export a singleton instance
export const globalShortcutsHelper = new GlobalShortcutsHelper();
