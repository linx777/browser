import React, { useState, useEffect, useCallback } from 'react';
import './ClipboardManager.scss';

interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
}

interface ClipboardStats {
  totalItems: number;
  oldestItem?: number;
  newestItem?: number;
}

const ClipboardManager: React.FC = () => {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState<ClipboardStats>({ totalItems: 0 });
  const [currentClipboard, setCurrentClipboard] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clipboard items and status on component mount
  useEffect(() => {
    loadClipboardData();
  }, []);

  const loadClipboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load clipboard items
      const itemsResult = await window.app.clipboard.getClipboardItems();
      if (itemsResult.success && itemsResult.items) {
        setClipboardItems(itemsResult.items);
      }

      // Load monitoring status
      const statusResult = await window.app.clipboard.getMonitoringStatus();
      if (statusResult.success) {
        setIsMonitoring(statusResult.isMonitoring || false);
        if (statusResult.stats) {
          setStats(statusResult.stats);
        }
      }

      // Load current clipboard content
      const currentContent = await window.app.clipboard.readClipboard();
      setCurrentClipboard(currentContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clipboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartMonitoring = useCallback(async () => {
    try {
      setError(null);
      const result = await window.app.clipboard.startMonitoring();
      if (result.success) {
        setIsMonitoring(true);
        await loadClipboardData(); // Refresh data
      } else {
        setError(result.error || 'Failed to start monitoring');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
    }
  }, [loadClipboardData]);

  const handleStopMonitoring = useCallback(async () => {
    try {
      setError(null);
      const result = await window.app.clipboard.stopMonitoring();
      if (result.success) {
        setIsMonitoring(false);
      } else {
        setError(result.error || 'Failed to stop monitoring');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      setError(null);
      const result = await window.app.clipboard.clearClipboardItems();
      if (result.success) {
        setClipboardItems([]);
        setStats({ totalItems: 0 });
      } else {
        setError(result.error || 'Failed to clear clipboard items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear clipboard items');
    }
  }, []);

  const handleRemoveItem = useCallback(async (id: string) => {
    try {
      setError(null);
      const result = await window.app.clipboard.removeClipboardItem(id);
      if (result.success) {
        setClipboardItems(prev => prev.filter(item => item.id !== id));
        setStats(prev => ({ ...prev, totalItems: prev.totalItems - 1 }));
      } else {
        setError(result.error || 'Failed to remove item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  }, []);

  const handleCopyToClipboard = useCallback(async (content: string) => {
    try {
      setError(null);
      await window.app.clipboard.writeClipboard(content);
      setCurrentClipboard(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy to clipboard');
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadClipboardData();
  }, [loadClipboardData]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const isCodeContent = (text: string) => {
    const codeIndicators = [
      /^\s*[{}[\]]/, // Starts with braces/brackets
      /^\s*(function|class|import|export|const|let|var|if|for|while)/, // Programming keywords
      /^\s*[#!@]/, // Shebang or special characters
      /^\s*\/\/|\/\*/, // Comments
      /^\s*<\?|<[a-zA-Z]/, // XML/HTML
      /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*/, // Variable assignments
    ];
    
    return codeIndicators.some(pattern => pattern.test(text));
  };

  return (
    <div className="clipboard-manager">
      <div className="clipboard-manager__header">
        <h2>Clipboard Manager</h2>
        <div className="clipboard-manager__controls">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn btn--secondary"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          {isMonitoring ? (
            <button
              onClick={handleStopMonitoring}
              className="btn btn--danger"
            >
              Stop Monitoring
            </button>
          ) : (
            <button
              onClick={handleStartMonitoring}
              className="btn btn--primary"
            >
              Start Monitoring
            </button>
          )}
          <button
            onClick={handleClearAll}
            disabled={clipboardItems.length === 0}
            className="btn btn--danger"
          >
            Clear All
          </button>
        </div>
      </div>

      {error && (
        <div className="clipboard-manager__error">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="clipboard-manager__status">
        <div className="status-item">
          <span className="status-label">Monitoring:</span>
          <span className={`status-value ${isMonitoring ? 'status-value--active' : 'status-value--inactive'}`}>
            {isMonitoring ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Total Items:</span>
          <span className="status-value">{stats.totalItems}</span>
        </div>
        {stats.newestItem && (
          <div className="status-item">
            <span className="status-label">Latest:</span>
            <span className="status-value">{formatTimestamp(stats.newestItem)}</span>
          </div>
        )}
      </div>

      <div className="clipboard-manager__current">
        <h3>Current Clipboard</h3>
        <div className="current-clipboard">
          {currentClipboard ? (
            <div className="current-clipboard__content">
              <div className="current-clipboard__text">
                {isCodeContent(currentClipboard) ? (
                  <pre className="code-content">{currentClipboard}</pre>
                ) : (
                  <p>{currentClipboard}</p>
                )}
              </div>
              <div className="current-clipboard__actions">
                <span className="char-count">{currentClipboard.length} characters</span>
                <button
                  onClick={() => handleCopyToClipboard(currentClipboard)}
                  className="btn btn--small btn--primary"
                >
                  Copy Again
                </button>
              </div>
            </div>
          ) : (
            <p className="current-clipboard__empty">No clipboard content</p>
          )}
        </div>
      </div>

      <div className="clipboard-manager__history">
        <h3>Clipboard History</h3>
        {clipboardItems.length === 0 ? (
          <p className="history-empty">No clipboard history available</p>
        ) : (
          <div className="history-list">
            {clipboardItems.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-item__header">
                  <span className="history-item__timestamp">
                    {formatTimestamp(item.timestamp)}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="btn btn--small btn--danger"
                    title="Remove item"
                  >
                    ×
                  </button>
                </div>
                <div className="history-item__content">
                  {isCodeContent(item.content) ? (
                    <pre className="code-content">{truncateContent(item.content, 200)}</pre>
                  ) : (
                    <p>{truncateContent(item.content, 200)}</p>
                  )}
                </div>
                <div className="history-item__actions">
                  <span className="char-count">{item.content.length} characters</span>
                  <button
                    onClick={() => handleCopyToClipboard(item.content)}
                    className="btn btn--small btn--primary"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClipboardManager;
