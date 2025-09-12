import React, { useState, useEffect } from 'react';
import './ScreenshotManager.scss';

interface ScreenshotItem {
  path: string;
  preview?: string;
  timestamp: number;
}

interface ScreenshotStats {
  totalScreenshots: number;
  directory: string;
}

const ScreenshotManager: React.FC = () => {
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [stats, setStats] = useState<ScreenshotStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load screenshots on component mount
  useEffect(() => {
    loadScreenshots();
    loadStats();
  }, []);

  // Listen for screenshot events from main process
  useEffect(() => {
    const handleScreenshotTaken = (event: any, data: { path: string; timestamp: number }) => {
      loadScreenshots();
      loadStats();
    };

    const handleScreenshotError = (event: any, data: { error: string }) => {
      console.error('Screenshot error:', data.error);
      setError(data.error);
    };

    // Add event listeners
    window.app.listener.screenshotTaken(handleScreenshotTaken);
    window.app.listener.screenshotError(handleScreenshotError);

    // Cleanup
    return () => {
      window.app.off.screenshotTaken();
      window.app.off.screenshotError();
    };
  }, []);

  const loadScreenshots = async () => {
    try {
      const result = await window.app.screenshot.getScreenshotPaths();
      if (result.success && result.paths) {
        const screenshotItems: ScreenshotItem[] = [];
        
        // Load previews for each screenshot
        for (const path of result.paths) {
          const previewResult = await window.app.screenshot.getImagePreview(path);
          const timestamp = Date.now(); // You could extract this from filename if needed
          
          screenshotItems.push({
            path,
            preview: previewResult.success ? previewResult.preview : undefined,
            timestamp
          });
        }
        
        // Sort by timestamp (newest first)
        screenshotItems.sort((a, b) => b.timestamp - a.timestamp);
        setScreenshots(screenshotItems);
      }
    } catch (error) {
      console.error('Error loading screenshots:', error);
      setError('Failed to load screenshots');
    }
  };

  const loadStats = async () => {
    try {
      const result = await window.app.screenshot.getStats();
      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading screenshot stats:', error);
    }
  };

  const takeScreenshot = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.app.screenshot.takeScreenshot();
      if (result.success) {
        // The event listener will handle updating the UI
      } else {
        setError(result.error || 'Failed to take screenshot');
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      setError('Failed to take screenshot');
    } finally {
      setLoading(false);
    }
  };

  const deleteScreenshot = async (path: string) => {
    try {
      const result = await window.app.screenshot.deleteScreenshot(path);
      if (result.success) {
        setScreenshots(prev => prev.filter(s => s.path !== path));
        loadStats();
      } else {
        setError(result.error || 'Failed to delete screenshot');
      }
    } catch (error) {
      console.error('Error deleting screenshot:', error);
      setError('Failed to delete screenshot');
    }
  };

  const clearAllScreenshots = async () => {
    if (!window.confirm('Are you sure you want to delete all screenshots?')) {
      return;
    }
    
    try {
      const result = await window.app.screenshot.clearScreenshots();
      if (result.success) {
        setScreenshots([]);
        loadStats();
      } else {
        setError(result.error || 'Failed to clear screenshots');
      }
    } catch (error) {
      console.error('Error clearing screenshots:', error);
      setError('Failed to clear screenshots');
    }
  };

  const openScreenshotDirectory = async () => {
    try {
      const result = await window.app.screenshot.getScreenshotDirectory();
      if (result.success && result.directory) {
        // Open the directory in the system file manager
        window.electron?.shell?.openPath(result.directory);
      }
    } catch (error) {
      console.error('Error opening screenshot directory:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getFileName = (path: string) => {
    return path.split('/').pop() || path.split('\\').pop() || path;
  };

  const handleSingleClick = async (screenshotPath: string) => {
    try {
      await window.app.clipboard.copyImageToClipboard(screenshotPath);
      
      // Start listening for ChatGPT input clicks with timeout
      await window.app.browser.startChatGPTClickListening();
    } catch (error) {
      console.error('Error copying screenshot to clipboard:', error);
    }
  };

  return (
    <div className="screenshot-manager">
      <div className="screenshot-header">
        <h2>Screenshot Manager</h2>
        <div className="screenshot-controls">
          <button 
            onClick={takeScreenshot} 
            disabled={loading}
            className="take-screenshot-btn"
          >
            {loading ? 'Taking...' : 'Take Screenshot'}
          </button>
          <button 
            onClick={openScreenshotDirectory}
            className="open-directory-btn"
          >
            Open Directory
          </button>
          {screenshots.length > 0 && (
            <button 
              onClick={clearAllScreenshots}
              className="clear-all-btn"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {stats && (
        <div className="screenshot-stats">
          <p>Total Screenshots: {stats.totalScreenshots}</p>
          <p>Directory: {stats.directory}</p>
        </div>
      )}

      <div className="screenshot-shortcut-info">
        <p><strong>Shortcut:</strong> Cmd+H (Mac) or Ctrl+H (Windows/Linux)</p>
      </div>

      <div className="screenshots-grid">
        {screenshots.length === 0 ? (
          <div className="no-screenshots">
            <p>No screenshots yet. Press Cmd+H (or Ctrl+H) to take your first screenshot!</p>
          </div>
        ) : (
          screenshots.map((screenshot) => (
            <div key={screenshot.path} className="screenshot-item">
              <div className="screenshot-preview">
                {screenshot.preview ? (
                  <img 
                    src={screenshot.preview} 
                    alt="Screenshot preview"
                    onClick={() => handleSingleClick(screenshot.path)}
                    title="Click to copy to clipboard"
                  />
                ) : (
                  <div className="no-preview">No Preview</div>
                )}
              </div>
              <div className="screenshot-info">
                <p className="filename">{getFileName(screenshot.path)}</p>
                <p className="timestamp">{formatTimestamp(screenshot.timestamp)}</p>
                <div className="screenshot-actions">
                  <button 
                    onClick={() => deleteScreenshot(screenshot.path)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScreenshotManager;
