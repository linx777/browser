/* eslint-disable import/no-cycle */
import electron, { BrowserView, BrowserWindow, app } from 'electron';
import path from 'path';
import { v4 } from 'uuid';

import { getExtensionsObject, installDevtoolsExtensions } from './extensions';
import { resolveHtmlPath } from './util';
import { DARWIN } from './constants';

let selectedView: BrowserView | null = null;
let freeView: BrowserView | null = null;
let mainWindow: BrowserWindow | null = null;

export const getSelectedView = (): BrowserView | null => selectedView;
export const getFreeView = (): BrowserView | null => freeView;
export const setFreeView = (view: BrowserView): void => {
  freeView = view;
};
export const setSelectedView = (view: BrowserView): void => {
  selectedView = view;
};

export const getMainWindow = (): BrowserWindow | null => mainWindow;

export const setBrowserViewBonds = (
  view: BrowserView,
  isFullScreen: boolean
): void => {
  const sizes = mainWindow?.getSize();
  const width = sizes && sizes[0] ? sizes[0] : 0;
  const height = sizes && sizes[1] ? sizes[1] : 0;
  let bWidth: number;
  let bHeight: number;
  let bY: number;

  if (isFullScreen) {
    bWidth = width;
    bHeight = height;
    bY = 0;
  } else {
    bWidth = DARWIN ? width : width - 15;
    bHeight = DARWIN ? height - 30 : height - 45;
    bY = 30;
  }

  if (!isFullScreen && !mainWindow?.isMaximized()) {
    bWidth = width;
    bHeight = height - 30;
  }

  view.setBounds({ x: 0, y: bY, width: bWidth, height: bHeight });
};

const createFreeBrowserView = (options?: {
  newSession?: boolean;
}): BrowserView => {
  const view = new BrowserView({
    webPreferences: {
      partition: options?.newSession
        ? `persist:${v4()}`
        : 'persist:user-partition',
      sandbox: true,
      webviewTag: true,
      safeDialogs: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'appPreload.js')
        : path.join(__dirname, '../../.erb/dll/app.preload.js'),
    },
  });

  mainWindow?.addBrowserView(view);
  setBrowserViewBonds(view, false);
  view.setAutoResize({ width: true, height: true });
  view.webContents.loadURL(resolveHtmlPath('index.html'));
  return view;
};

export const createBrowserView = (options?: {
  newSession?: boolean;
}): BrowserView => {
  const tmpView = getFreeView();
  const view =
    options?.newSession || !tmpView ? createFreeBrowserView(options) : tmpView;
  setFreeView(createFreeBrowserView());

  // Developer tools auto-opening disabled
  // if (!app.isPackaged) view.webContents.toggleDevTools();
  const extensions = getExtensionsObject();
  if (mainWindow) extensions.addTab(view.webContents, mainWindow);
  view.webContents.focus();
  return view;
};

export const createWindow = async (): Promise<BrowserWindow> => {
  if (!app.isPackaged) {
    await installDevtoolsExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    show: false,
    width: Math.floor(3 * width / 5),
    height: process.platform === 'darwin' ? height : 768,
    icon: getAssetPath('icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    transparent: true,
    webPreferences: {
      partition: 'persist:user-partition',
      sandbox: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'titleBarPreload.js')
        : path.join(__dirname, '../../.erb/dll/titleBar.preload.js'),
    },
  });

  mainWindow.setMenu(null);


  // Enhanced screen capture resistance
  mainWindow.setContentProtection(true);

  mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver", 1);

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Prevent window from being captured in screenshots
    mainWindow.setHiddenInMissionControl(true);
    mainWindow.setWindowButtonVisibility(false);
    mainWindow.setBackgroundColor("#00000000");

    // Prevent window from being included in window switcher
    mainWindow.setSkipTaskbar(true);

    // Disable window shadow
    mainWindow.setHasShadow(false);
  }

  // Prevent the window from being captured by screen recording
  mainWindow.webContents.setBackgroundThrottling(false);
  mainWindow.webContents.setFrameRate(60);

  await mainWindow.loadURL(resolveHtmlPath('titleBar.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('focus', () => {
    if (selectedView) selectedView.webContents.focus();
  });

  mainWindow.webContents.executeJavaScript(
    `localStorage.setItem("appIsPackaged", "${app.isPackaged}");`,
    true
  );

  // Initialize clipboard monitoring
  try {
    const { clipboardManager } = require('./clipboardManager');
    clipboardManager.startMonitoring();
  } catch (error) {
    console.error('[Browser] Failed to start clipboard monitoring:', error);
  }

  return mainWindow;
};
