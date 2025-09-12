import { TFunction } from 'react-i18next';
import { EventParams } from 'types/analytics';
import { Bookmark, Provider, Tag } from 'types/bookmarks';
import { Download } from 'types/downloads';
import { Extension } from 'types/extensions';
import { History } from 'types/history';
import { Locale } from 'types/i18n';
import {
  IpcAddBookmark,
  IpcAddDownload,
  IpcAddHistory,
  IpcCertificateErrorAnswer,
  IpcInspectElement,
  IpcSetStoreValue,
  IpcSetWindowsCount,
  IpcShowBoardContextMenu,
  IpcShowLeftbarContextMenu,
} from 'types/ipc';
import { DomainSuggestion } from 'types/suggestions';
import { Board } from 'types/boards';
import { DownloadState } from 'renderer/TitleBar/components/TopBar/Types';

declare global {
  interface Window {
    app: {
      board: {
        close: () => void;
        add: (params?: { newSession?: boolean }) => void;
        selectNext: () => void;
        setWindowsCount: (args: IpcSetWindowsCount) => void;
        getAllBoards: () => Promise<
          { id: string; boardId: string; content: string }[]
        >;
        save: (board: Board) => void;
        delete: (boardId: string) => void;
        load: (board: Board) => void;
      };
      bookmark: {
        importBookmarks: (bookmarks: Partial<Bookmark>[]) => Promise<void>;
        getBookmarksTags: () => Promise<Tag[]>;
        editBookmark: (bookmark: Partial<Bookmark>) => Promise<Bookmark>;
        getBookmarksProviders: () => Promise<Provider[]>;
        getBookmarksFromProvider: (provider: Provider) => Promise<Bookmark[]>;
        isBookmarked: (url: string) => Promise<boolean>;
        addBookmark: (args: IpcAddBookmark) => Promise<Bookmark>;
        removeBookmark: (url: string) => Promise<void>;
        getAllBookmarks: () => Promise<Bookmark[]>;
        findInBookmarks: (str: string) => Promise<any>;
      };
    browser: {
      select: (webContentsId: number) => void;
      selectBrowserView: () => void;
      certificateErrorAnswer: (args: IpcCertificateErrorAnswer) => void;
      requestCapture: (webContentsId: number) => Promise<string>;
      getUrlToOpen: () => Promise<string | undefined>;
      switchToBrowser: (webContentsId: number) => Promise<{success: boolean, browserId?: string, error?: string}>;
      startChatGPTClickListening: () => Promise<{success: boolean, error?: string}>;
      stopChatGPTClickListening: () => Promise<{success: boolean, error?: string}>;
      focusChatGPTInput: () => Promise<{success: boolean, error?: string}>;
      simulatePaste: () => Promise<{success: boolean, error?: string}>;
    };
      config: {
        getAll: () => Promise<Record<string, any>>;
        get: (key: string) => Promise<unknown>;
        set: (args: IpcSetStoreValue) => Promise<void>;
      };
      download: {
        hideDownloadsPreview: () => void;
        addDownload: (args: IpcAddDownload) => Promise<void>;
        getAllDownloads: () => Promise<Download[]>;
        clearDownloads: () => Promise<void>;
        removeDownload: (id: number) => Promise<void>;
      };
      extension: {
        getAllExtensions: () => Promise<Extension[]>;
        deleteExtension: (id: string) => Promise<void>;
        installExtension: (id: string) => Promise<void>;
      };
      history: {
        addHistory: (args: IpcAddHistory) => Promise<History>;
        findInHistory: (str: string) => Promise<History[]>;
        removeHistory: (id: number) => Promise<void>;
        clearHistory: () => Promise<void>;
        getAllHistory: () => Promise<History[]>;
      };
      listener: {
        newWindow: (
          action: (_e: IpcRendererEvent, args: { url: string }) => void
        ) => void;
        loadBoard: (
          action: (_e: any, args: { boardId: string }) => void
        ) => void;
        loadSavedBoard: (
          action: (_e: any, args: { boardId: string; board?: Board }) => void
        ) => void;
        purge: (action: () => void) => void;
        saveBoard: (action: (_e: any, args: { tabId: string }) => void) => void;
        renameBoard: (
          action: (_e: IpcRendererEvent, args: { label: string }) => void
        ) => void;
        closeWebview: (
          action: (_e: IpcRendererEvent, args: Position) => void
        ) => void;
        pinWebview: (
          action: (_e: IpcRendererEvent, args: Position) => void
        ) => void;
        closeAllWebview: (action: () => void) => void;
        closeOthersWebview: (
          action: (_e: IpcRendererEvent, args: Position) => void
        ) => void;
        showAppMenu: (action: () => void) => void;
        certificateError: (
          action: (
            _e: IpcRendererEvent,
            args: { webContentsId: number; fingerprint: string }
          ) => void
        ) => void;
        downloading: (
          action: (
            _e: IpcRendererEvent,
            args: {
              savePath: string;
              filename: string;
              progress: number;
              etag: string;
              startTime: number;
              state: DownloadState;
            }
          ) => void
        ) => void;
        showDownloadsPreview: (action: () => void) => void;
        distributeWindowsEvenly: (action: () => void) => void;
        setDefaultWindowSize: (
          action: (_e: IpcRendererEvent, wcId: number) => void
        ) => void;
        resetBoard: (
          action: (_e: IpcRendererEvent, boardId?: string) => void
        ) => void;
        autotileWindows: (
          action: (
            _e: IpcRendererEvent,
            horizontal: number,
            vertical: number
          ) => void
        ) => void;
      };
      off: {
        newWindow: () => void;
        loadBoard: () => void;
        loadSavedBoard: () => void;
        purge: () => void;
        saveBoard: () => void;
        renameBoard: () => void;
        closeWebview: () => void;
        closeAllWebview: () => void;
        closeOthersWebview: () => void;
        showAppMenu: () => void;
        certificateError: () => void;
        downloading: () => void;
        showDownloadsPreview: () => void;
        distributeWindowsEvenly: () => void;
        setDefaultWindowSize: () => void;
        pinWebview: () => void;
        resetBoard: () => void;
        autotileWindows: () => void;
      };
      os: {
        getPlatform: () => string;
      };
      tools: {
        inspectElement: (point: IpcInspectElement) => void;
        toggleDarkMode: () => void;
        changeLanguage: (locale: Locale) => Promise<TFunction>;
        showItemInFolder: (filepath: string) => void;
        showLeftbarContextMenu: (params: IpcShowLeftbarContextMenu) => void;
        showBoardContextMenu: (params: IpcShowBoardContextMenu) => void;
        clicked: () => void;
        findInKnownDomains: (input: string) => Promise<DomainSuggestion[]>;
      };
      clipboard: {
        readClipboard: () => Promise<string>;
        writeClipboard: (text: string) => Promise<void>;
        getClipboardItems: () => Promise<{success: boolean, items?: Array<{id: string, content: string, timestamp: number}>, error?: string}>;
        clearClipboardItems: () => Promise<{success: boolean, error?: string}>;
        removeClipboardItem: (id: string) => Promise<{success: boolean, error?: string}>;
        startMonitoring: () => Promise<{success: boolean, error?: string}>;
        stopMonitoring: () => Promise<{success: boolean, error?: string}>;
      getMonitoringStatus: () => Promise<{success: boolean, isMonitoring?: boolean, stats?: {totalItems: number, oldestItem?: number, newestItem?: number}, error?: string}>;
      copyImageToClipboard: (imagePath: string) => Promise<{success: boolean, error?: string}>;
    };
    screenshot: {
      takeScreenshot: () => Promise<{success: boolean, path?: string, error?: string}>;
      getScreenshotPaths: () => Promise<{success: boolean, paths?: string[], error?: string}>;
      getScreenshotDirectory: () => Promise<{success: boolean, directory?: string, error?: string}>;
      getImagePreview: (filepath: string) => Promise<{success: boolean, preview?: string, error?: string}>;
      deleteScreenshot: (filepath: string) => Promise<{success: boolean, error?: string}>;
      clearScreenshots: () => Promise<{success: boolean, error?: string}>;
      getStats: () => Promise<{success: boolean, stats?: {totalScreenshots: number, directory: string}, error?: string}>;
    };
    keyboard: {
      simulatePaste: () => Promise<{success: boolean, error?: string}>;
    };
    };
  }
}

export {};
