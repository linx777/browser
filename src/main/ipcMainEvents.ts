/* eslint-disable import/no-cycle */
/* eslint-disable import/prefer-default-export */

// External modules
import AutoLaunch from 'easy-auto-launch';
import { TFunction } from 'react-i18next';

// Electron modules
import {
  app,
  BrowserView,
  ipcMain,
  IpcMainEvent,
  nativeTheme,
  shell,
  WebContents,
} from 'electron';

// Type definitions
import { Bookmark, Provider as BookmarkProvider, Tag } from 'types/bookmarks';
import { Download } from 'types/downloads';
import { Extension } from 'types/extensions';
import { History } from 'types/history';
import { Locale } from 'types/i18n';
import {
  IpcAddBookmark,
  IpcAddDownload,
  IpcAddHistory,
  IpcAnalyticsEvent,
  IpcAnalyticsPage,
  IpcCertificateErrorAnswer,
  IpcInspectElement,
  IpcRenameTab,
  IpcSaveTab,
  IpcSetStoreValue,
  IpcSetWindowsCount,
  IpcShowBoardContextMenu,
  IpcShowLeftbarContextMenu,
  IpcShowTabContextMenu,
  IpcTabPurge,
  IpcTabSelect,
} from 'types/ipc';
import { DomainSuggestion } from 'types/suggestions';
import { Board } from 'types/boards';

// Local modules
import { getUrlToOpen, setUrlToOpen } from './appEvents';
import {
  addBookmark,
  editBookmark,
  findBookmarksByDomain,
  findInBookmarks,
  getAllBookmarks,
  getBookmarksFromProvider,
  getBookmarksProviders,
  getBookmarksTags,
  importBookmarks,
  isBookmarked,
  removeBookmark,
} from './bookmarks';
import { getMainWindow, getSelectedView, setBrowserViewBonds } from './browser';
import {
  showBoardContextMenu,
  showLeftbarContextMenu,
  showTabContextMenu,
} from './contextMenu';
import {
  addDownload,
  clearDownloads,
  getAllDownloads,
  removeDownload,
} from './downloads';
import {
  deleteExtension,
  getAllExtensions,
  getExtensionsObject,
  installExtension,
} from './extensions';
import {
  addHistory,
  clearHistory,
  findHistoryByDomain,
  findInHistory,
  getAllHistory,
  removeHistory,
} from './history';
import i18n from './i18n';
import { getStore } from './store';
import {
  deleteBoard,
  getAllBoards,
  purgeTab,
  renameTab,
  saveBoardCallback,
  saveTab,
  selectTab,
} from './tabs';

/**
 * Store instance to manage application settings and data.
 */
const store = getStore();

/**
 * Stores the currently open BrowserViews.
 */
let views: Record<string, BrowserView> = {};

/**
 * Stores the WebContents of the browsers.
 */
const browsers: Record<string, WebContents> = {};

/**
 * Stores the certificate error authorizations.
 */
const certificateErrorAuth: { webContentsId: number; fingerprint: string }[] =
  [];

/**
 * Returns the current browsers.
 */
export const getBrowsers = () => browsers;

/**
 * Returns the current BrowserViews.
 */
export const getViews = () => views;

/**
 * Sets the current BrowserViews.
 * @param newViews The new BrowserViews to set.
 */
export const setViews = (newViews: Record<string, BrowserView>) => {
  views = newViews;
};

/**
 * Checks if a certificate error has been authorized.
 * @param webContentsId The ID of the WebContents.
 * @param fingerprint The fingerprint of the certificate.
 * @returns True if authorized, false otherwise.
 */
export const getCertificateErrorAuth = (
  webContentsId: number,
  fingerprint: string
) => {
  const auth = certificateErrorAuth.find(
    (c) => c.webContentsId === webContentsId && c.fingerprint === fingerprint
  );
  return !!auth;
};

/**
 * Instance of AutoLaunch to manage application startup settings.
 */
const bonbonAutoLauncher = new AutoLaunch({
  name: 'BonBon',
});

/**
 * Initializes the IPC main events.
 */
export const makeIpcMainEvents = (): void => {
  const extensions = getExtensionsObject();

  // Theme-related handlers
  /**
   * Toggles dark mode.
   */
  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'dark';
    }
    return nativeTheme.shouldUseDarkColors;
  });

  /**
   * Sets theme to system default.
   */
  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system';
  });

  // Development and debugging handlers
  /**
   * Opens the developer tools for inspecting elements.
   */
  ipcMain.on('inspectElement', (e: IpcMainEvent, args: IpcInspectElement) => {
    e.sender.inspectElement(args.x, args.y);
  });

  // Analytics handlers (currently empty)
  ipcMain.on('analytics-event', (_event, _args: IpcAnalyticsEvent) => {});
  ipcMain.on('analytics-page', (_event, _args: IpcAnalyticsPage) => {});

  // Tab management handlers
  /**
   * Selects a tab.
   */
  ipcMain.on('tab-select', (_event, args: IpcTabSelect) => {
    selectTab(args);
  });

  /**
   * Closes the active board.
   */
  ipcMain.on('close-active-board', () => {
    getMainWindow()?.webContents.send('close-active-tab');
  });

  /**
   * Purges a tab.
   */
  ipcMain.on('tab-purge', (_event, args: IpcTabPurge) => {
    purgeTab(args);
  });

  /**
   * Saves a tab.
   */
  ipcMain.on('save-board', (_event, args: IpcSaveTab) => {
    saveTab(args);
  });

  /**
   * Renames a tab.
   */
  ipcMain.on('rename-tab', (_event, args: IpcRenameTab) => {
    renameTab(args);
  });

  // Browser selection handlers
  /**
   * Selects a browser by WebContents ID.
   */
  ipcMain.on('select-browser', (_event, webContentsId: string) => {
    if (browsers[webContentsId]) extensions.selectTab(browsers[webContentsId]);
  });

  /**
   * Selects the current BrowserView.
   */
  ipcMain.on('select-browserView', () => {
    const selectedView = getSelectedView();
    if (selectedView) extensions.selectTab(selectedView.webContents);
  });

  /**
   * Selects the next board.
   */
  ipcMain.on('select-next-board', () => {
    getMainWindow()?.webContents.send('select-next-board');
  });

  // Application window control handlers
  /**
   * Closes the application.
   */
  ipcMain.on('close-app', () => {
    app.quit();
  });

  /**
   * Minimizes the application window.
   */
  ipcMain.on('minimize-app', () => {
    getMainWindow()?.minimize();
  });

  /**
   * Maximizes or unmaximizes the application window.
   */
  ipcMain.on('maximize-app', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.isMaximized()
        ? mainWindow.unmaximize()
        : mainWindow.maximize();
      const view = getSelectedView();
      if (view) setBrowserViewBonds(view, false);
    }
  });

  /**
   * Checks if the application window is maximized.
   */
  ipcMain.handle('is-app-maximized', () => {
    return getMainWindow()?.isMaximized() || false;
  });

  // Application menu handlers
  /**
   * Shows the application menu.
   */
  ipcMain.on('show-app-menu', () => {
    getSelectedView()?.webContents.send('show-app-menu');
  });

  /**
   * Shows the downloads preview.
   */
  ipcMain.on('show-downloads-preview', () => {
    getSelectedView()?.webContents.send('show-downloads-preview');
  });

  /**
   * Hides the downloads preview.
   */
  ipcMain.on('hide-downloads-preview', () => {
    getMainWindow()?.webContents.send('hide-downloads-preview');
  });

  // Store (settings) handlers
  /**
   * Gets a value from the store.
   */
  ipcMain.handle('get-store-value', (_event, key: string) => {
    return store.get(key);
  });

  /**
   * Gets all values from the store.
   */
  ipcMain.handle('get-all-store-values', (_event) => {
    return store.store;
  });

  /**
   * Sets a value in the store.
   */
  ipcMain.handle(
    'set-store-value',
    (_e, args: IpcSetStoreValue): Promise<void> => {
      return new Promise((resolve, reject) => {
        let rejected = false;

        store.set(args.key, args.value);

        switch (args.key) {
          case 'application.launchAtStartup':
            if (args.value === true) {
              bonbonAutoLauncher.enable().catch(() => {
                reject(new Error(`Couldn't enable BonBon Browser at startup.`));
                rejected = true;
              });
            } else {
              bonbonAutoLauncher.disable().catch(() => {
                reject(
                  new Error(`Couldn't disable BonBon Browser at startup.`)
                );
                rejected = true;
              });
            }
            break;

          default:
            break;
        }

        if (!rejected) resolve();
      });
    }
  );

  // Language and i18n handlers
  /**
   * Changes the application language.
   */
  ipcMain.handle(
    'change-language',
    (_e, locale: Locale): Promise<TFunction> => {
      return i18n.changeLanguage(locale);
    }
  );

  // History-related handlers
  /**
   * Adds an entry to the history.
   */
  ipcMain.handle('add-history', (_e, args: IpcAddHistory): Promise<History> => {
    return addHistory(args);
  });

  /**
   * Removes an entry from the history.
   */
  ipcMain.handle('remove-history', (_e, id: number): Promise<void> => {
    return removeHistory(id);
  });

  /**
   * Clears the history.
   */
  ipcMain.handle('clear-history', (): Promise<void> => {
    return clearHistory();
  });

  /**
   * Finds entries in the history matching a string.
   */
  ipcMain.handle('find-in-history', (_e, str: string): Promise<History[]> => {
    return findInHistory(str);
  });

  /**
   * Gets all history entries.
   */
  ipcMain.handle('get-all-history', (_e): Promise<History[]> => {
    return getAllHistory();
  });

  // Bookmarks-related handlers
  /**
   * Checks if a URL is bookmarked.
   */
  ipcMain.handle('is-bookmarked', (_e, url: string): Promise<boolean> => {
    return isBookmarked(url);
  });

  /**
   * Adds a bookmark.
   */
  ipcMain.handle(
    'add-bookmark',
    (_e, args: IpcAddBookmark): Promise<Bookmark> => {
      return addBookmark(args);
    }
  );

  /**
   * Removes a bookmark.
   */
  ipcMain.handle('remove-bookmark', (_e, url: string): Promise<void> => {
    return removeBookmark(url);
  });

  /**
   * Gets all bookmarks.
   */
  ipcMain.handle('get-all-bookmarks', () => {
    return getAllBookmarks();
  });

  /**
   * Gets bookmark providers.
   */
  ipcMain.handle('get-bookmarks-providers', (): BookmarkProvider[] => {
    return getBookmarksProviders();
  });

  /**
   * Gets bookmarks from a provider.
   */
  ipcMain.handle(
    'get-bookmarks-from-provider',
    (_e, provider: BookmarkProvider): Bookmark[] => {
      return getBookmarksFromProvider(provider);
    }
  );

  /**
   * Imports bookmarks.
   */
  ipcMain.handle(
    'import-bookmarks',
    (_e, bookmarks: Partial<Bookmark>[]): Promise<void> => {
      return importBookmarks(bookmarks);
    }
  );

  /**
   * Gets bookmark tags.
   */
  ipcMain.handle('get-bookmarks-tags', (): Promise<Tag[]> => {
    return getBookmarksTags();
  });

  /**
   * Edits a bookmark.
   */
  ipcMain.handle('edit-bookmark', (_e, bookmark: Partial<Bookmark>) => {
    return editBookmark(bookmark);
  });

  /**
   * Finds bookmarks matching a string.
   */
  ipcMain.handle(
    'find-in-bookmarks',
    (_e, str: string): Promise<Bookmark[]> => {
      return findInBookmarks(str);
    }
  );

  /**
   * Finds domain suggestions from known domains (bookmarks and history).
   */
  ipcMain.handle(
    'find-in-known-domains',
    (_e, input: string): Promise<DomainSuggestion[]> => {
      return new Promise((resolve, reject) => {
        Promise.all([findBookmarksByDomain(input), findHistoryByDomain(input)])
          .then((res) => {
            const result = res.flat();
            resolve(result);
          })
          .catch((e) =>
            reject(new Error(`Error while looking for domains: ${e.message}`))
          );
      });
    }
  );

  // Downloads-related handlers
  /**
   * Adds a download.
   */
  ipcMain.handle('add-download', (_e, args: IpcAddDownload): Promise<void> => {
    return addDownload(args);
  });

  /**
   * Gets all downloads.
   */
  ipcMain.handle('get-all-downloads', (): Promise<Download[]> => {
    return getAllDownloads();
  });

  /**
   * Clears downloads.
   */
  ipcMain.handle('clear-downloads', (): Promise<void> => {
    return clearDownloads();
  });

  /**
   * Removes a download.
   */
  ipcMain.handle('remove-download', (_e, id: number): Promise<void> => {
    return removeDownload(id);
  });

  /**
   * Shows an item in the folder.
   */
  ipcMain.on('show-item-in-folder', (_e, filepath: string) => {
    shell.showItemInFolder(filepath);
  });

  // Extensions-related handlers
  /**
   * Gets all extensions.
   */
  ipcMain.handle('get-all-extensions', (): Extension[] => {
    return getAllExtensions();
  });

  /**
   * Deletes an extension.
   */
  ipcMain.handle('delete-extension', (_e, id: string): Promise<void> => {
    return deleteExtension(id);
  });

  /**
   * Installs an extension.
   */
  ipcMain.handle('install-extension', (_e, id: string): Promise<void> => {
    return installExtension(id);
  });

  // Context menu handlers
  /**
   * Shows the tab context menu.
   */
  ipcMain.on(
    'show-tab-context-menu',
    (e, params: IpcShowTabContextMenu): void => {
      showTabContextMenu(e, params);
    }
  );

  /**
   * Shows the leftbar context menu.
   */
  ipcMain.on(
    'show-leftbar-context-menu',
    (e, params: IpcShowLeftbarContextMenu): void => {
      showLeftbarContextMenu(e, params);
    }
  );

  /**
   * Shows the board context menu.
   */
  ipcMain.on(
    'show-board-context-menu',
    (e, params: IpcShowBoardContextMenu): void => {
      showBoardContextMenu(e, params);
    }
  );

  // Boards (tabs) management handlers
  /**
   * Opens a new board.
   */
  ipcMain.on('open-new-board', (_e, params?: { newSession?: boolean }) => {
    getMainWindow()?.webContents.send('open-tab', params);
  });

  /**
   * Gets all boards.
   */
  ipcMain.handle('get-all-boards', () => {
    return getAllBoards();
  });

  /**
   * Deletes a board.
   */
  ipcMain.on('delete-board', (_e, boardId: string) => {
    deleteBoard(boardId);
  });

  /**
   * Loads a saved board.
   */
  ipcMain.on('load-saved-board', (_e, boardId: string) => {
    getMainWindow()?.webContents.send('load-saved-board', boardId);
  });

  /**
   * Callback after saving a board.
   */
  ipcMain.on('save-board-callback', (_e, board: Board) => {
    saveBoardCallback(board).then(console.log).catch(console.log);
  });

  // Certificate error handling
  /**
   * Handles certificate error authorization.
   */
  ipcMain.on(
    'certificate-error-answer',
    (_e, args: IpcCertificateErrorAnswer) => {
      if (args.isTrusted) {
        certificateErrorAuth.push({
          webContentsId: args.webContentsId,
          fingerprint: args.fingerprint,
        });
      }
    }
  );

  // Page capture
  /**
   * Requests a page capture (screenshot) from a WebContents ID.
   */
  ipcMain.handle('request-capture', (_e, wcId: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (browsers[wcId]) {
        browsers[wcId]
          .capturePage()
          .then((img) => {
            return resolve(img.resize({ width: 185 }).toDataURL());
          })
          .catch(reject);
      } else {
        reject(new Error('WebContentId does not exist.'));
      }
    });
  });

  // URL handling
  /**
   * Gets the URL to open, if any.
   */
  ipcMain.handle('get-url-to-open', (): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const urlToOpen = getUrlToOpen();
      setUrlToOpen(undefined);
      resolve(urlToOpen);
    });
  });

  // Miscellaneous handlers
  /**
   * Handles app click events.
   */
  ipcMain.on('app-clicked', () => {
    getMainWindow()?.webContents.send('app-clicked');
  });

  /**
   * Sets the window count.
   */
  ipcMain.on('set-windows-count', (_event, args: IpcSetWindowsCount) => {
    getMainWindow()?.webContents.send('set-windows-count', args);
  });

  /**
   * Shows the library.
   */
  ipcMain.on('show-library', () => {
    getSelectedView()?.webContents.send('show-library');
  });

  /**
   * Shows the settings.
   */
  ipcMain.on('show-settings', () => {
    getSelectedView()?.webContents.send('show-settings');
  });

  // Click-through control handlers
  /**
   * Toggles click-through mode
   */
  ipcMain.handle('toggle-click-through', () => {
    try {
      const { globalShortcutsHelper } = require('./globalShortcuts');
      globalShortcutsHelper.toggleClickThrough();
      return { success: true, isClickThrough: globalShortcutsHelper.getClickThroughState() };
    } catch (error) {
      console.error('Error toggling click-through:', error);
      return { error: 'Failed to toggle click-through' };
    }
  });

  /**
   * Gets the current click-through state
   */
  ipcMain.handle('get-click-through-state', () => {
    try {
      const { globalShortcutsHelper } = require('./globalShortcuts');
      return { success: true, isClickThrough: globalShortcutsHelper.getClickThroughState() };
    } catch (error) {
      console.error('Error getting click-through state:', error);
      return { error: 'Failed to get click-through state' };
    }
  });

  // Clipboard handlers
  /**
   * Reads clipboard content
   */
  ipcMain.handle('read-clipboard', () => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      return clipboardManager.readClipboard();
    } catch (error) {
      console.error('Error reading clipboard:', error);
      return '';
    }
  });

  /**
   * Writes text to clipboard
   */
  ipcMain.handle('write-clipboard', (_event, text: string) => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      clipboardManager.writeClipboard(text);
    } catch (error) {
      console.error('Error writing to clipboard:', error);
      throw error;
    }
  });

  /**
   * Gets clipboard items
   */
  ipcMain.handle('get-clipboard-items', (_event) => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      const items = clipboardManager.getClipboardItems();
      return { success: true, items };
    } catch (error) {
      console.error('[IPC] Error getting clipboard items:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Clears all clipboard items
   */
  ipcMain.handle('clear-clipboard-items', (_event) => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      clipboardManager.clearClipboardItems();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error clearing clipboard items:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Removes a specific clipboard item
   */
  ipcMain.handle('remove-clipboard-item', (_event, id: string) => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      const success = clipboardManager.removeClipboardItem(id);
      return { success };
    } catch (error) {
      console.error('[IPC] Error removing clipboard item:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Starts clipboard monitoring
   */
  ipcMain.handle('start-clipboard-monitoring', () => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      clipboardManager.startMonitoring();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error starting clipboard monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Stops clipboard monitoring
   */
  ipcMain.handle('stop-clipboard-monitoring', () => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      clipboardManager.stopMonitoring();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error stopping clipboard monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Gets clipboard monitoring status
   */
  ipcMain.handle('get-clipboard-monitoring-status', () => {
    try {
      const { clipboardManager } = require('./clipboardManager');
      const isMonitoring = clipboardManager.isMonitoringActive();
      const stats = clipboardManager.getStats();
      return { success: true, isMonitoring, stats };
    } catch (error) {
      console.error('[IPC] Error getting clipboard monitoring status:', error);
      return { success: false, error: error.message };
    }
  });

  // Screenshot handlers
  /**
   * Takes a screenshot
   */
  ipcMain.handle('take-screenshot', async () => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const mainWindow = getMainWindow();
      const screenshotPath = await screenshotHelper.takeScreenshot(mainWindow, {
        hideWindow: true,
        format: 'png'
      });
      return { success: true, path: screenshotPath };
    } catch (error) {
      console.error('[IPC] Error taking screenshot:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Gets all screenshot paths
   */
  ipcMain.handle('get-screenshot-paths', () => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const paths = screenshotHelper.getScreenshotPaths();
      return { success: true, paths };
    } catch (error) {
      console.error('[IPC] Error getting screenshot paths:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Gets screenshot directory
   */
  ipcMain.handle('get-screenshot-directory', () => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const directory = screenshotHelper.getScreenshotDirectory();
      return { success: true, directory };
    } catch (error) {
      console.error('[IPC] Error getting screenshot directory:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Gets image preview
   */
  ipcMain.handle('get-image-preview', async (_event, filepath: string) => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const preview = await screenshotHelper.getImagePreview(filepath);
      return { success: true, preview };
    } catch (error) {
      console.error('[IPC] Error getting image preview:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Deletes a screenshot
   */
  ipcMain.handle('delete-screenshot', async (_event, filepath: string) => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const result = await screenshotHelper.deleteScreenshot(filepath);
      return result;
    } catch (error) {
      console.error('[IPC] Error deleting screenshot:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Clears all screenshots
   */
  ipcMain.handle('clear-screenshots', () => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      screenshotHelper.clearScreenshots();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error clearing screenshots:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Gets screenshot statistics
   */
  ipcMain.handle('get-screenshot-stats', () => {
    try {
      const { screenshotHelper } = require('./screenshotHelper');
      const stats = screenshotHelper.getStats();
      return { success: true, stats };
    } catch (error) {
      console.error('[IPC] Error getting screenshot stats:', error);
      return { success: false, error: error.message };
    }
  });
};
