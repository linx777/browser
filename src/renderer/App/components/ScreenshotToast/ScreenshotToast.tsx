import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import './ScreenshotToast.scss';

interface ScreenshotToastProps {
  screenshot: {
    path: string;
    timestamp: number;
  };
  onClose: () => void;
  onDelete?: (path: string) => void;
  onOpen?: (path: string) => void;
}

const ScreenshotToast: React.FC<ScreenshotToastProps> = ({
  screenshot,
  onClose,
  onDelete,
  onOpen
}) => {
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadPreview();
  }, [screenshot.path]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const result = await window.app.screenshot.getImagePreview(screenshot.path);
      if (result.success && result.preview) {
        setPreview(result.preview);
      }
    } catch (error) {
      console.error('Error loading screenshot preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(screenshot.path);
      onClose();
    } catch (error) {
      console.error('Error deleting screenshot:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpen = () => {
    if (onOpen) {
      onOpen(screenshot.path);
    }
  };


  return (
    <div className="screenshot-toast">

      <div className="screenshot-toast-content">
        <div className="screenshot-preview">
          {loading ? (
            <div className="screenshot-loading">
              <div className="loading-spinner" />
            </div>
          ) : preview ? (
            <img 
              src={preview} 
              alt="Screenshot preview"
              className="screenshot-image"
            />
          ) : (
            <div className="screenshot-placeholder">
              <span>No Preview</span>
            </div>
          )}
          
          {/* Delete button at top right of preview */}
          <button 
            className="screenshot-delete-btn"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete screenshot"
          >
            {isDeleting ? (
              <div className="loading-spinner small" />
            ) : (
              <X size={16} />
            )}
          </button>
        </div>
      </div>

      <div className="screenshot-toast-actions">
        {onOpen && (
          <button 
            className="screenshot-action-btn open-btn"
            onClick={handleOpen}
            disabled={isDeleting}
            title="Open screenshot"
          >
            <ExternalLink size={14} />
            <span>Open</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ScreenshotToast;
