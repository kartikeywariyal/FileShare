import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './SharePage.css';

const SharePage = () => {
  const { uniqueId } = useParams();
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchFileInfo();
  }, [uniqueId]);

  const fetchFileInfo = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:3001/api/files/share/${uniqueId}/info`, {
        headers
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to load file');
      }

      const data = await response.json();
      setFileInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:3001/api/files/share/${uniqueId}`, {
        headers
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="share-page-container">
        <div className="share-card">
          <div className="loading">Loading file information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="share-page-container">
        <div className="share-card error-card">
          <div className="error-icon">⚠️</div>
          <h2>Access Denied</h2>
          <p>{error}</p>
          <p className="error-hint">
            If you believe you should have access to this file, please contact the file owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="share-page-container">
      <div className="share-card">
        <div className="file-icon-large">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
        </div>
        <h2>{fileInfo.originalName}</h2>
        <div className="file-details">
          <p><strong>Size:</strong> {formatFileSize(fileInfo.size)}</p>
          <p><strong>Uploaded:</strong> {new Date(fileInfo.uploadDate).toLocaleString()}</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="download-button-large"
        >
          {downloading ? 'Downloading...' : 'Download File'}
        </button>
      </div>
    </div>
  );
};

export default SharePage;

