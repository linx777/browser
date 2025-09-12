import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ScreenshotToast.scss';

interface ScreenshotToastProps {
  screenshot: {
    id: string;
    path: string;
    timestamp: number;
  };
  onClose: () => void;
  onDelete?: (path: string, toastId: string) => void;
  toastId: string;
}

const ScreenshotToast: React.FC<ScreenshotToastProps> = ({
  screenshot,
  onClose,
  onDelete,
  toastId
}) => {
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadPreview();
  }, [screenshot.path]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const result = await window.app.screenshot.getImagePreview(screenshot.path);
      if (result.success && result.preview) {
        setPreview(result.preview);
      } else if (result.error === 'Image file does not exist') {
        // If the file doesn't exist, close the toast
        console.warn('Screenshot file does not exist, closing toast:', screenshot.path);
        onClose();
      }
    } catch (error) {
      console.error('Error loading screenshot preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent event bubbling to parent div
    if (isDeleting || isExiting || !onDelete) return;
    
    setIsExiting(true);
    setIsDeleting(true);
    
    // Clear the preview immediately to prevent ghost image
    setPreview('');
    setLoading(false);
    
    // Force clear the image source to prevent ghost image
    if (imageRef.current) {
      // Use a transparent 1x1 pixel to completely replace the image
      imageRef.current.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      imageRef.current.style.display = 'none';
      imageRef.current.style.visibility = 'hidden';
      imageRef.current.style.opacity = '0';
      imageRef.current.style.width = '0';
      imageRef.current.style.height = '0';
    }
    
    // Wait for exit animation to complete before calling onDelete
    setTimeout(async () => {
      try {
        await onDelete(screenshot.path, toastId);
        // Note: onClose is now handled by the manager after successful deletion
      } catch (error) {
        console.error('Error deleting screenshot:', error);
      } finally {
        setIsDeleting(false);
      }
    }, 300); // Match the animation duration
  };



  const handleSingleClick = async () => {
    try {
      // Step 1: Focus AI service input area first
      await window.app.browser.focusChatGPTInput();
      
      // Step 2: Wait for focus to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 3: Copy screenshot to clipboard
      const result = await window.app.clipboard.copyImageToClipboard(screenshot.path);
      
      if (result.success) {
        // Step 4: Auto-paste the screenshot
        setTimeout(async () => {
          try {
            await window.app.browser.simulatePaste();
          } catch (pasteError) {
            console.error('Error simulating paste:', pasteError);
          }
        }, 100); // Delay to ensure clipboard is ready
      } else {
        console.warn('Failed to copy screenshot to clipboard:', result.error);
        
        // If the file doesn't exist, close the toast
        if (result.error === 'Image file does not exist') {
          onClose();
        }
      }
    } catch (error) {
      console.error('Error copying screenshot to clipboard:', error);
    }
  };


  return (
    <div className={`screenshot-toast ${isExiting ? 'exiting' : ''}`}>

      <div className="screenshot-toast-content">
        <div 
          className="screenshot-preview"
          onClick={handleSingleClick}
          style={{ cursor: 'pointer' }}
          title="Click to copy image to clipboard"
        >
          {loading && !isExiting ? (
            <div className="screenshot-loading">
              <div className="loading-spinner" />
            </div>
          ) : preview && !isExiting ? (
            <img 
              ref={imageRef}
              key={`${screenshot.id}-${preview.slice(-10)}`}
              src={preview} 
              alt="Screenshot preview"
              className="screenshot-image"
            />
          ) : isExiting ? (
            <div className="screenshot-exiting">
              <span>Deleting...</span>
            </div>
          ) : (
            <div className="screenshot-placeholder">
              <span>No Preview</span>
            </div>
          )}
          
          {/* Delete button at top right of preview */}
          <button 
            className="screenshot-delete-btn"
            onClick={(e) => handleDelete(e)}
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
