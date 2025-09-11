import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './ScreenshotToast.scss';

interface ScreenshotToastProps {
  screenshot: {
    path: string;
    timestamp: number;
  };
  onClose: () => void;
  onDelete?: (path: string) => void;
}

const ScreenshotToast: React.FC<ScreenshotToastProps> = ({
  screenshot,
  onClose,
  onDelete
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



  const handleSingleClick = async () => {
    try {
      await window.app.clipboard.copyImageToClipboard(screenshot.path);
      console.log('Screenshot copied to clipboard');
      
      // Start listening for ChatGPT input clicks with timeout
      await window.app.browser.startChatGPTClickListening();
    } catch (error) {
      console.error('Error copying screenshot to clipboard:', error);
    }
  };


  return (
    <div className="screenshot-toast">

      <div className="screenshot-toast-content">
        <div 
          className="screenshot-preview"
          onClick={handleSingleClick}
          style={{ cursor: 'pointer' }}
          title="Click to copy image to clipboard"
        >
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

    </div>
  );
};

export default ScreenshotToast;
