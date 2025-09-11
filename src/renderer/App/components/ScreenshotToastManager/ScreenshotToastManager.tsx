import React, { useState, useEffect, useCallback, useRef } from 'react';
import ScreenshotToast from '../ScreenshotToast';
import './ScreenshotToastManager.scss';

interface ScreenshotToastData {
  id: string;
  path: string;
  timestamp: number;
}

const ScreenshotToastManager: React.FC = () => {
  const [toasts, setToasts] = useState<ScreenshotToastData[]>([]);
  const [knownScreenshots, setKnownScreenshots] = useState<Set<string>>(new Set());
  const monitoringInterval = useRef<NodeJS.Timeout | null>(null);

  const checkForNewScreenshots = useCallback(async () => {
    try {
      const result = await window.app.screenshot.getScreenshotPaths();
      if (result.success && result.paths) {
        const currentPaths = new Set(result.paths);
        
        // Find new screenshots that we haven't seen before
        const newScreenshots = result.paths.filter(path => !knownScreenshots.has(path));
        
        if (newScreenshots.length > 0) {
          // Create toasts for new screenshots
          const newToasts: ScreenshotToastData[] = newScreenshots.map(path => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path,
            timestamp: Date.now()
          }));

          setToasts(prev => {
            // Add new toasts and keep only the last 3 toasts
            const updated = [...newToasts, ...prev].slice(0, 3);
            return updated;
          });

          // Keep toasts persistent - no auto-remove
        }
        
        // Update known screenshots
        setKnownScreenshots(currentPaths);
      }
    } catch (error) {
      console.error('Error checking for new screenshots:', error);
    }
  }, [knownScreenshots]);

  useEffect(() => {
    // Start monitoring screenshots directory
    const startMonitoring = () => {
      // Check immediately
      checkForNewScreenshots();
      
      // Then check every 1 second
      monitoringInterval.current = setInterval(checkForNewScreenshots, 1000);
    };

    startMonitoring();

    // Cleanup
    return () => {
      if (monitoringInterval.current) {
        clearInterval(monitoringInterval.current);
      }
    };
  }, [checkForNewScreenshots]);

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  const handleDeleteScreenshot = useCallback(async (path: string) => {
    try {
      const result = await window.app.screenshot.deleteScreenshot(path);
      if (!result.success) {
        console.error('Failed to delete screenshot:', result.error);
      }
    } catch (error) {
      console.error('Error deleting screenshot:', error);
    }
  }, []);

  const handleOpenScreenshot = useCallback((path: string) => {
    try {
      // Use the proper API to open file
      window.app.tools.showItemInFolder(path);
    } catch (error) {
      console.error('Error opening screenshot:', error);
    }
  }, []);


  const handleCopyFilenameToChatGPT = useCallback((filename: string) => {
    if (window.app) {
      window.app.tools.copyFilenameToChatGPT?.(filename);
    }
  }, []);

  return (
    <div className="screenshot-toast-manager">
      {toasts.map((toast, index) => {
        // Calculate proper vertical positioning to prevent overlapping
        // Each toast is approximately 230px tall (header ~40px + content ~148px + actions ~40px), with 30px spacing
        const toastHeight = 230;
        const spacing = 30;
        const topPosition = 20 + (index * (toastHeight + spacing));
        
        return (
          <div
            key={toast.id}
            className="screenshot-toast-wrapper"
            style={{
              top: `${topPosition}px`,
              zIndex: 10000 - index // Higher z-index for newer toasts
            }}
          >
            <ScreenshotToast
              screenshot={toast}
              onClose={() => removeToast(toast.id)}
              onDelete={handleDeleteScreenshot}
              onOpen={handleOpenScreenshot}
              onCopyFilenameToChatGPT={handleCopyFilenameToChatGPT}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ScreenshotToastManager;
