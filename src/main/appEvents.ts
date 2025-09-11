/* eslint-disable import/no-cycle */
/* eslint-disable promise/catch-or-return */
/* eslint-disable import/prefer-default-export */
/* eslint-disable promise/no-callback-in-promise */
/* eslint-disable promise/no-nesting */
/* eslint-disable promise/always-return */
import { app, session } from 'electron';
import contextMenu from 'electron-context-menu';
import path from 'path';

import { Electron } from 'namespaces/_electronist';
import { makeAssociation } from './association';
import { globalShortcutsHelper } from './globalShortcuts';
import {
  createWindow,
  getMainWindow,
  getSelectedView,
  setBrowserViewBonds,
} from './browser';
import {
  getExtensionsObject,
  installAndLoadUserExtensions,
  makeChromeExtensionSupport,
} from './extensions';
import i18n from './i18n';
import {
  getBrowsers,
  getCertificateErrorAuth,
  makeIpcMainEvents,
} from './ipcMainEvents';
import { isValidUrl } from './util';
import Tracker from './analytics/tracker';

// Function to switch focus to ChatGPT and paste content
const switchToChatGPTAndPaste = (content: string) => {
  try {
    // Get all browser webviews
    const browsers = getBrowsers();
    
    // Find ChatGPT tab/webview
    let chatgptWebContents = null;
    for (const [, webContents] of Object.entries(browsers)) {
      const url = webContents.getURL();
      if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
        chatgptWebContents = webContents;
        break;
      }
    }
    
    if (chatgptWebContents) {
      // Focus the ChatGPT webview
      chatgptWebContents.focus();
      
      // Wait a moment for focus to take effect, then paste the content
      setTimeout(() => {
        chatgptWebContents.executeJavaScript(`
          (() => {
            // Look for ChatGPT input field with various selectors
            const chatgptSelectors = [
              'div[contenteditable="true"][id="prompt-textarea"]',
              'div[contenteditable="true"][id="prompt-textarea"].ProseMirror',
              'textarea[placeholder*="Ask anything"]',
              'textarea[placeholder*="ask anything"]', 
              'textarea[placeholder*="Ask"]',
              'textarea[placeholder*="ask"]',
              'input[placeholder*="Ask anything"]',
              'input[placeholder*="ask anything"]',
              'input[placeholder*="Ask"]',
              'input[placeholder*="ask"]',
              'textarea[data-testid*="input"]',
              'textarea[data-testid*="textbox"]',
              'textarea[aria-label*="input"]',
              'textarea[aria-label*="textbox"]',
              'div[contenteditable="true"][data-testid*="input"]',
              'div[contenteditable="true"][data-testid*="textbox"]'
            ];
            
            let inputElement = null;
            
            // Try each selector
            for (const selector of chatgptSelectors) {
              inputElement = document.querySelector(selector);
              if (inputElement) {
                break;
              }
            }
            
            // If no specific ChatGPT input found, look for any textarea or input that might be a chat input
            if (!inputElement) {
              const allInputs = document.querySelectorAll('textarea, input[type="text"]');
              for (const input of allInputs) {
                const placeholder = input.placeholder?.toLowerCase() || '';
                const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
                const className = input.className?.toLowerCase() || '';
                
                // Check if this looks like a chat input
                if (placeholder.includes('ask') || 
                    placeholder.includes('message') || 
                    placeholder.includes('chat') ||
                    ariaLabel.includes('input') ||
                    ariaLabel.includes('textbox') ||
                    className.includes('input') ||
                    className.includes('textbox')) {
                  inputElement = input;
                  break;
                }
              }
            }
            
            if (inputElement) {
              // Check if the input already has the same content to avoid unnecessary updates
              const currentValue = inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT' 
                ? inputElement.value 
                : inputElement.textContent;
              
              if (currentValue === '${content.replace(/'/g, "\\'")}') {
                return;
              }
              
              // Focus the input
              inputElement.focus();
              
              // Clear existing content and set new content
              if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
                inputElement.value = '${content.replace(/'/g, "\\'")}';
              } else if (inputElement.contentEditable === 'true') {
                inputElement.textContent = '${content.replace(/'/g, "\\'")}';
              }
              
              // Trigger input events to ensure the content is properly set
              const inputEvent = new Event('input', { bubbles: true });
              const changeEvent = new Event('change', { bubbles: true });
              inputElement.dispatchEvent(inputEvent);
              inputElement.dispatchEvent(changeEvent);
              
              // Show a temporary notification
              const notification = document.createElement('div');
              notification.textContent = '✓ Auto-pasted to ChatGPT';
              notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                z-index: 2147483647;
                pointer-events: none;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: default !important;
                max-width: 300px;
                word-wrap: break-word;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
              \`;
              
              document.body.appendChild(notification);
              
              // Auto-remove after 2 seconds
              setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                  }
                }, 300);
              }, 2000);
            }
          })();
        `).catch(err => {
          console.error('Error pasting to ChatGPT:', err);
        });
      }, 500); // Wait 500ms for focus to take effect
    } else {
      console.log('ChatGPT tab not found');
    }
  } catch (error) {
    console.error('Error switching to ChatGPT:', error);
  }
};

let urlToOpen: string | undefined;

export const tracker = new Tracker();

export const setUrlToOpen = (url: string | undefined) => {
  urlToOpen = url;
};
export const getUrlToOpen = () => urlToOpen;

const getUrlInArgv = (argv: string[]) => {
  if (argv.length > 0 && isValidUrl(argv[argv.length - 1])) {
    return argv[argv.length - 1];
  }
  return undefined;
};

const downloadItemEventAction = (
  item: Electron.DownloadItem,
  state: string
) => {
  if (item.getSavePath()) {
    getMainWindow()?.webContents.send('download-state', state);
    getSelectedView()?.webContents.send('downloading', {
      savePath: item.getSavePath(),
      filename: item.getFilename(),
      progress: item.getReceivedBytes() / item.getTotalBytes(),
      etag: item.getETag(),
      startTime: item.getStartTime(),
      state,
    });
  }
};

const makeAppEvents = () => {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) app.quit();

  app.on('before-quit', () => {
    tracker.cleanup();
  });

  app.on('second-instance', (_e, argv) => {
    const mainWindow = getMainWindow();
    if (argv.length > 0 && isValidUrl(argv[argv.length - 1])) {
      const selectedView = getSelectedView();
      selectedView?.webContents.send('new-window', {
        url: argv[argv.length - 1],
      });

      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });

  app.on('open-url', (_e, url) => {
    const mainWindow = getMainWindow();
    const selectedView = getSelectedView();
    if (isValidUrl(url)) selectedView?.webContents.send('new-window', { url });
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('web-contents-created', (_event, contents) => {
    const extensions = getExtensionsObject();

    // Intercept new-window events and prevent default popups
    contents.setWindowOpenHandler(({ url }) => {
      const selectedView = getSelectedView();
      selectedView?.webContents.send('new-window', { url });
      return { action: 'deny' };
    });

    contents.on('enter-html-full-screen', () => {
      const view = getSelectedView();
      if (view) setBrowserViewBonds(view, true);
    });

    contents.on('leave-html-full-screen', () => {
      const view = getSelectedView();
      if (view) setBrowserViewBonds(view, false);
    });

    contents.on('new-window' as 'zoom-changed', (e: any, url: any) => {
      e.preventDefault();
      const selectedView = getSelectedView();
      selectedView?.webContents.send('new-window', { url });
    });

    contents.on('will-attach-webview', (wawevent) => {
      const pathToPreloadScipt = app.isPackaged
        ? path.join(__dirname, '../../../assets/webview-preload.js')
        : path.join(__dirname, '../../assets/webview-preload.js');
      // @ts-ignore
      wawevent.sender.session.setPreloads([`${pathToPreloadScipt}`]);
    });

    contents.on('did-attach-webview', (_daw, webContents) => {
      getBrowsers()[webContents.id] = webContents;
      webContents.session.setMaxListeners(99);
      
      // Listen for custom messages from the webview
      webContents.addListener('console-message', (_event, _level, message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'ADD_CLIPBOARD_ITEM' && data.content) {
            const { clipboardManager } = require('./clipboardManager');
            const item = clipboardManager.addClipboardItem(data.content);
            if (item) {
              // Send the item ID back to the webview
              webContents.executeJavaScript(`
                window.dispatchEvent(new CustomEvent('clipboard-item-added', {
                  detail: { id: '${item.id}' }
                }));
              `);
            }
          } else if (data.type === 'REMOVE_CLIPBOARD_ITEM' && data.itemId) {
            const { clipboardManager } = require('./clipboardManager');
            clipboardManager.removeClipboardItem(data.itemId);
          } else if (data.type === 'SWITCH_TO_CHATGPT_AND_PASTE' && data.content) {
            // Switch focus to ChatGPT and paste content
            switchToChatGPTAndPaste(data.content);
          }
        } catch (error) {
          // Ignore non-JSON messages
        }
      });
      
      webContents.addListener('dom-ready', () => {
        if (webContents.getURL() === 'https://web.whatsapp.com/') {
          webContents.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
          );
        } else {
          webContents.setUserAgent('');
        }

        webContents.send('created-webcontents', {
          webContentsId: webContents.id,
        });

        // Inject auto-copy script and force arrow cursor after DOM is ready
        webContents.executeJavaScript(`
          (() => {
            // Only inject if not already injected
            if (window.bonbonAutoCopyInjected) return;
            window.bonbonAutoCopyInjected = true;
            
            
            // Force arrow cursor for all elements
            function forceArrowCursor() {
              const style = document.createElement('style');
              style.id = 'bonbon-cursor-style';
              style.textContent = \`
                *, *::before, *::after {
                  cursor: default !important;
                }
                input, textarea, [contenteditable] {
                  cursor: default !important;
                }
                a, button, [role="button"], [onclick] {
                  cursor: default !important;
                }
                .bonbon-notification {
                  cursor: default !important;
                }
              \`;
              document.head.appendChild(style);
            }
            
            let lastSelectedText = '';
            let isProcessing = false;
            
            function cleanupOldNotifications() {
              const notifications = document.querySelectorAll('.bonbon-notification');
              const maxNotifications = 5; // Keep only the last 5 notifications
              
              if (notifications.length > maxNotifications) {
                // Remove oldest notifications (they appear first in the DOM)
                for (let i = 0; i < notifications.length - maxNotifications; i++) {
                  notifications[i].remove();
                }
              }
              
              // Recalculate positions for remaining notifications
              const remainingNotifications = document.querySelectorAll('.bonbon-notification');
              const toastHeight = 50;
              const spacing = 10;
              const topOffset = 20;
              
              remainingNotifications.forEach((notification, index) => {
                const verticalPosition = topOffset + (index * (toastHeight + spacing));
                notification.style.top = \`\${verticalPosition}px\`;
              });
            }
            
            function showTemporaryNotification(message, duration = 300) {
              // Create a temporary notification that auto-disappears
              const tempNotification = document.createElement('div');
              tempNotification.className = 'bonbon-temp-notification';
              tempNotification.textContent = message;
              
              // Calculate position for temporary notification (top of screen)
              const existingNotifications = document.querySelectorAll('.bonbon-notification');
              const toastHeight = 50;
              const spacing = 10;
              const topOffset = 20;
              const verticalPosition = topOffset + (existingNotifications.length * (toastHeight + spacing));
              
              tempNotification.style.cssText = \`
                position: fixed;
                top: \${verticalPosition}px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                z-index: 2147483647;
                pointer-events: none;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: default !important;
                max-width: 300px;
                word-wrap: break-word;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
              \`;
              
              document.body.appendChild(tempNotification);
              
              // Auto-remove after specified duration
              setTimeout(() => {
                tempNotification.style.opacity = '0';
                tempNotification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                  if (tempNotification.parentNode) {
                    tempNotification.parentNode.removeChild(tempNotification);
                  }
                }, 300);
              }, duration);
            }
            
            function showNotification(message, fullText = null, clipboardItemId = null) {
              // Create a unique ID for this notification
              const notificationId = 'bonbon-notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              
              const feedback = document.createElement('div');
              feedback.className = 'bonbon-notification';
              feedback.id = notificationId;
              feedback.setAttribute('data-clipboard-item-id', clipboardItemId || '');
              
              // Create close button
              const closeButton = document.createElement('div');
              closeButton.innerHTML = '×';
              closeButton.style.cssText = \`
                position: absolute;
                top: 4px;
                right: 8px;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: bold;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                border-radius: 3px;
                transition: all 0.2s ease;
                z-index: 1;
              \`;
              
              // Add hover effect for close button
              closeButton.addEventListener('mouseenter', () => {
                closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
                closeButton.style.color = 'rgba(255, 255, 255, 1)';
              });
              
              closeButton.addEventListener('mouseleave', () => {
                closeButton.style.background = 'transparent';
                closeButton.style.color = 'rgba(255, 255, 255, 0.7)';
              });
              
              // Add click handler for close button
              closeButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering double-click on toast
                
                // Store the clipboard item ID in the notification for later removal
                const itemId = feedback.getAttribute('data-clipboard-item-id');
                if (itemId) {
                  // Send a custom event to the main process to remove the clipboard item
                  console.log(JSON.stringify({
                    type: 'REMOVE_CLIPBOARD_ITEM',
                    itemId: itemId
                  }));
                }
                
                feedback.remove();
                cleanupOldNotifications(); // Recalculate positions
              });
              
              // Create content area
              const content = document.createElement('div');
              content.textContent = message;
              content.style.cssText = \`
                padding-right: 30px;
                word-wrap: break-word;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
              \`;
              
              feedback.appendChild(content);
              feedback.appendChild(closeButton);
              
              // Calculate vertical position based on existing notifications
              const existingNotifications = document.querySelectorAll('.bonbon-notification');
              const toastHeight = 50; // Approximate height of each toast
              const spacing = 10; // Spacing between toasts
              const topOffset = 20; // Initial top offset
              const verticalPosition = topOffset + (existingNotifications.length * (toastHeight + spacing));
              
              // Make toast clickable if it has full text (for auto-paste functionality)
              const isClickable = fullText !== null;
              
              feedback.style.cssText = \`
                position: fixed;
                top: \${verticalPosition}px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                z-index: 2147483647;
                pointer-events: auto;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: \${isClickable ? 'pointer' : 'default'};
                max-width: 300px;
                word-wrap: break-word;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
              \`;
              
              // Add double-click event listener for auto-paste functionality
              if (isClickable) {
                feedback.addEventListener('dblclick', () => {
                  // Send message to main process to switch focus to ChatGPT and paste content
                  console.log(JSON.stringify({
                    type: 'SWITCH_TO_CHATGPT_AND_PASTE',
                    content: fullText
                  }));
                });
                
                // Add hover effect for clickable toasts
                feedback.addEventListener('mouseenter', () => {
                  feedback.style.background = 'rgba(0, 0, 0, 0.95)';
                  feedback.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                });
                
                feedback.addEventListener('mouseleave', () => {
                  feedback.style.background = 'rgba(0, 0, 0, 0.9)';
                  feedback.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                });
              }
              
              document.body.appendChild(feedback);
              
              // Clean up old notifications to prevent accumulation
              cleanupOldNotifications();
            }
            
            function autoPasteToChatGPT(text) {
              try {
                // Look for ChatGPT input field with various selectors
                const chatgptSelectors = [
                  'div[contenteditable="true"][id="prompt-textarea"]',
                  'div[contenteditable="true"][id="prompt-textarea"].ProseMirror',
                  'textarea[placeholder*="Ask anything"]',
                  'textarea[placeholder*="ask anything"]', 
                  'textarea[placeholder*="Ask"]',
                  'textarea[placeholder*="ask"]',
                  'input[placeholder*="Ask anything"]',
                  'input[placeholder*="ask anything"]',
                  'input[placeholder*="Ask"]',
                  'input[placeholder*="ask"]',
                  'textarea[data-testid*="input"]',
                  'textarea[data-testid*="textbox"]',
                  'textarea[aria-label*="input"]',
                  'textarea[aria-label*="textbox"]',
                  'div[contenteditable="true"][data-testid*="input"]',
                  'div[contenteditable="true"][data-testid*="textbox"]'
                ];
                
                let inputElement = null;
                
                // Try each selector
                for (const selector of chatgptSelectors) {
                  inputElement = document.querySelector(selector);
                  if (inputElement) {
                    break;
                  }
                }
                
                // If no specific ChatGPT input found, look for any textarea or input that might be a chat input
                if (!inputElement) {
                  const allInputs = document.querySelectorAll('textarea, input[type="text"]');
                  for (const input of allInputs) {
                    const placeholder = input.placeholder?.toLowerCase() || '';
                    const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
                    const className = input.className?.toLowerCase() || '';
                    
                    // Check if this looks like a chat input
                    if (placeholder.includes('ask') || 
                        placeholder.includes('message') || 
                        placeholder.includes('chat') ||
                        ariaLabel.includes('input') ||
                        ariaLabel.includes('textbox') ||
                        className.includes('input') ||
                        className.includes('textbox')) {
                      inputElement = input;
                      break;
                    }
                  }
                }
                
                if (inputElement) {
                  // Check if the input already has the same content to avoid unnecessary updates
                  const currentValue = inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT' 
                    ? inputElement.value 
                    : inputElement.textContent;
                  
                  if (currentValue === text) {
                    return;
                  }
                  
                  // Focus the input
                  inputElement.focus();
                  
                  // Clear existing content and set new content
                  if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
                    inputElement.value = text;
                  } else if (inputElement.contentEditable === 'true') {
                    inputElement.textContent = text;
                  }
                  
                  // Trigger input events to ensure the content is properly set
                  const inputEvent = new Event('input', { bubbles: true });
                  const changeEvent = new Event('change', { bubbles: true });
                  inputElement.dispatchEvent(inputEvent);
                  inputElement.dispatchEvent(changeEvent);
                  
                  showTemporaryNotification('✓ Auto-pasted to ChatGPT', 1000);
                } else {
                }
              } catch (error) {
              }
            }
            
            function copyToClipboard(text) {
              if (isProcessing) return;
              isProcessing = true;
              
              // Try modern clipboard API first
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                  // Send message to main process to add clipboard item
                  console.log(JSON.stringify({
                    type: 'ADD_CLIPBOARD_ITEM',
                    content: text
                  }));
                  
                  // Show the actual copied text content
                  const displayText = text.length > 20 ? text.substring(0, 20) + '...' : text;
                  showNotification('✓ ' + displayText, text); // Pass the full text for auto-paste
                  
                  isProcessing = false;
                }).catch(err => {
                  fallbackCopy(text);
                });
              } else {
                fallbackCopy(text);
              }
            }
            
            function fallbackCopy(text) {
              // Fallback method using document.execCommand
              const textArea = document.createElement('textarea');
              textArea.value = text;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              textArea.style.top = '-999999px';
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              
              try {
                const successful = document.execCommand('copy');
                if (successful) {
                  // Send message to main process to add clipboard item
                  console.log(JSON.stringify({
                    type: 'ADD_CLIPBOARD_ITEM',
                    content: text
                  }));
                  
                  // Show the actual copied text content
                  const displayText = text.length > 20 ? text.substring(0, 20) + '...' : text;
                  showNotification('✓ ' + displayText, text); // Pass the full text for auto-paste
                } else {
                  showNotification('❌ Copy failed');
                }
              } catch (err) {
                showNotification('❌ Copy failed');
              } finally {
                document.body.removeChild(textArea);
                isProcessing = false;
              }
            }
            
            // Listen for selection changes
            document.addEventListener('mouseup', () => {
              setTimeout(() => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim().length > 0) {
                  const selectedText = selection.toString().trim();
                  
                  // Only copy if text is different from last selection and not too short
                  if (selectedText !== lastSelectedText && selectedText.length > 2) {
                    lastSelectedText = selectedText;
                    copyToClipboard(selectedText);
                  }
                }
              }, 150); // Slightly longer delay to ensure selection is complete
            });
            
            // Also listen for keyboard selection
            document.addEventListener('keyup', (e) => {
              if (e.shiftKey || e.ctrlKey || e.metaKey) {
                setTimeout(() => {
                  const selection = window.getSelection();
                  if (selection && selection.toString().trim().length > 0) {
                    const selectedText = selection.toString().trim();
                    
                    if (selectedText !== lastSelectedText && selectedText.length > 2) {
                      lastSelectedText = selectedText;
                      copyToClipboard(selectedText);
                    }
                  }
                }, 150);
              }
            });
            
            // Force arrow cursor immediately
            forceArrowCursor();
            
            // Re-apply cursor style when new content is added
            const observer = new MutationObserver(() => {
              const existingStyle = document.getElementById('bonbon-cursor-style');
              if (!existingStyle) {
                forceArrowCursor();
              }
            });
            
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
            
            // Monitor clipboard changes for auto-paste
            let lastClipboardContent = '';
            let clipboardCheckInterval = null;
            
            function startClipboardMonitoring() {
              if (clipboardCheckInterval) return;
              
              clipboardCheckInterval = setInterval(() => {
                try {
                  if (navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(currentContent => {
                      if (currentContent && 
                          currentContent !== lastClipboardContent && 
                          currentContent.length > 2) {
                        lastClipboardContent = currentContent;
                        
                        // Clipboard monitoring is now disabled - auto-paste only happens on double-click
                        // No automatic auto-paste functionality
                      }
                    }).catch(err => {
                      // Ignore clipboard read errors (permissions, etc.)
                    });
                  }
                } catch (error) {
                }
              }, 1000); // Check every second
            }
            
            function stopClipboardMonitoring() {
              if (clipboardCheckInterval) {
                clearInterval(clipboardCheckInterval);
                clipboardCheckInterval = null;
              }
            }
            
            // Start clipboard monitoring
            startClipboardMonitoring();
            
            // Listen for clipboard item added events from main process
            window.addEventListener('clipboard-item-added', (event) => {
              const itemId = event.detail.id;
              // Find the most recent notification and update it with the clipboard item ID
              const notifications = document.querySelectorAll('.bonbon-notification');
              if (notifications.length > 0) {
                const latestNotification = notifications[notifications.length - 1];
                latestNotification.setAttribute('data-clipboard-item-id', itemId);
              }
            });
            
          })();
        `).catch(err => {
          // Ignore errors for pages that don't allow script execution
          console.log('Could not inject auto-copy script:', err.message);
        });
      });

      const mainWindow = getMainWindow();
      if (mainWindow) extensions.addTab(webContents, mainWindow);

      webContents.on(
        'certificate-error',
        (_e, _url, _error, certificate, callback) => {
          const isTrusted = getCertificateErrorAuth(
            webContents.id,
            certificate.fingerprint
          );
          callback(isTrusted);
          if (!isTrusted) {
            getSelectedView()?.webContents.send('certificate-error', {
              webContentsId: webContents.id,
              fingerprint: certificate.fingerprint,
            });
          }
        }
      );

      webContents.session.on('will-download', (_e, item, _wc) => {
        item.on('updated', (_ei, state) => {
          downloadItemEventAction(item, state);
        });
        item.on('done', (_ei, state) => {
          downloadItemEventAction(item, state);
        });
      });

      contextMenu({
        prepend: () => [
          {
            label: i18n.t('Set as default window size'),
            click: () => {
              contents.send('set-default-window-size', webContents.id);
            },
          },
          {
            label: i18n.t('Distribute windows evenly'),
            click: () => {
              contents.send('distribute-windows-evenly');
            },
          },
          {
            label: i18n.t('Autotile'), // Submenu label
            submenu: [
              {
                label: '1x1',
                click: () => {
                  contents.send('autotile-windows', 1, 1);
                },
              },
              {
                label: '1x2',
                click: () => {
                  contents.send('autotile-windows', 1, 2);
                },
              },
              {
                label: '2x1',
                click: () => {
                  contents.send('autotile-windows', 2, 1);
                },
              },
              {
                label: '2x2',
                click: () => {
                  contents.send('autotile-windows', 2, 2);
                },
              },
              {
                label: '3x1',
                click: () => {
                  contents.send('autotile-windows', 3, 1);
                },
              },
              {
                label: '3x2',
                click: () => {
                  contents.send('autotile-windows', 3, 2);
                },
              },
            ],
          },
        ],
        window: webContents,
        showInspectElement: true,
        showSearchWithGoogle: false,
        showCopyImageAddress: true,
      });
    });
  });
};

app
  .whenReady()
  .then(() => {
    makeAssociation();
    makeChromeExtensionSupport();
    makeIpcMainEvents();
    makeAppEvents();
    installAndLoadUserExtensions();
    createWindow()
      .then(() => {
        getMainWindow()
          ?.webContents.executeJavaScript(`localStorage.getItem("i18nextLng");`)
          .then((locale) => {
            if (locale) i18n.changeLanguage(locale);
          });

        setUrlToOpen(getUrlInArgv(process.argv));

        session
          .fromPartition('persist:user-partition')
          .setPermissionRequestHandler((webContents, permission, callback) => {
            const url = webContents.getURL();
            
            // Allow permissions for localhost (app UI)
            if (url === 'http://localhost:1212/index.html') {
              return callback(true);
            }
            
            // Allow essential permissions for web browsing
            const allowedPermissions = [
              'fullscreen',
              'media', // For microphone access (voice search)
              'camera', // For webcam access
              'notifications', // For web notifications
              'geolocation', // For location services
              'clipboard-read', // For clipboard access
              'clipboard-write' // For clipboard writing
            ];
            
            if (allowedPermissions.includes(permission)) {
              // For microphone permissions, temporarily disable click-through
              if (permission === 'media') {
                const { globalShortcutsHelper } = require('./globalShortcuts');
                globalShortcutsHelper.disableClickThrough();
                console.log('Microphone permission requested - temporarily disabled click-through for voice interaction');
                
                // Re-enable click-through after 30 seconds if user doesn't interact
                setTimeout(() => {
                  if (!globalShortcutsHelper.getClickThroughState()) {
                    globalShortcutsHelper.enableClickThrough();
                    console.log('Re-enabled click-through after microphone permission timeout');
                  }
                }, 30000);
              }
              
              return callback(true);
            }
            
            // Block other permissions
            return callback(false);
          });

        const mainWindow = getMainWindow();

        if (mainWindow) {
          const extensions = getExtensionsObject();
          extensions.addTab(mainWindow.webContents, mainWindow);
          extensions.selectTab(mainWindow.webContents);

          if (process.env.START_MINIMIZED) {
            mainWindow.minimize();
          } else {
            mainWindow.show();
            if (process.platform !== 'darwin') {
              mainWindow.maximize();
            }
          }
        }

        if (!app.isPackaged)
          mainWindow?.webContents.openDevTools({ mode: 'detach' });

        // Initialize global shortcuts
        globalShortcutsHelper.setMainWindow(mainWindow);
        globalShortcutsHelper.registerGlobalShortcuts();
      })
      .catch(console.log);

    app.on('activate', () => {
      const mainWindow = getMainWindow();
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
