import { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ user, token, onLogout }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [openToAll, setOpenToAll] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [downloadId, setDownloadId] = useState('');
  const [downloadingById, setDownloadingById] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/files', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      setError('File size exceeds 16MB limit');
      return;
    }

    setSelectedFile(file);
    setShowUploadModal(true);
    setError('');
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('openToAll', openToAll);
      formData.append('allowedEmails', allowedEmails);

      const response = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess('File uploaded successfully!');
      setShowUploadModal(false);
      setSelectedFile(null);
      setOpenToAll(false);
      setAllowedEmails('');
      await fetchFiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/${file._id || file.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownloadById = async () => {
    if (!downloadId.trim()) {
      setError('Please enter a file ID');
      return;
    }

    setDownloadingById(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:3001/api/files/share/${downloadId.trim()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Download failed. You may not have access to this file.');
      }

      // Get filename from Content-Disposition header or use a default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'download';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('File downloaded successfully!');
      setDownloadId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingById(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setSuccess('File deleted successfully!');
      await fetchFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateAccess = async (file) => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/${file._id || file.id}/access`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          openToAll: openToAll,
          allowedEmails: allowedEmails
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update access settings');
      }

      setSuccess('Access settings updated successfully!');
      setEditingFile(null);
      setOpenToAll(false);
      setAllowedEmails('');
      await fetchFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyShareLink = (uniqueId) => {
    navigator.clipboard.writeText(uniqueId);
    setSuccess('Unique ID copied to clipboard!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getFileIcon = (mimetype, originalName) => {
    const extension = originalName?.split('.').pop()?.toLowerCase();
    
    if (mimetype?.includes('video') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      );
    }
    if (mimetype?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      );
    }
    if (mimetype?.includes('pdf') || extension === 'pdf') {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
    }
    if (mimetype?.includes('audio') || ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(extension)) {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      );
    }
    if (mimetype?.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      );
    }
    // Default file icon
    return (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>FireShare</h1>
          <div className="header-actions">
            <span className="user-name">Welcome, {user.name}</span>
            <button onClick={onLogout} className="logout-button">Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="upload-section">
            <div className="upload-card">
              <h2>Upload Files</h2>
              <div className="upload-area">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" className="upload-button">
                  {uploading ? 'Uploading...' : 'Choose File to Upload'}
                </label>
                <p className="upload-hint">Maximum file size: 16MB</p>
              </div>
            </div>
          </div>

          <div className="download-by-id-section">
            <div className="download-card">
              <h2>Download File by ID</h2>
              <p className="download-hint">Enter the unique file ID shared with you</p>
              <div className="download-input-group">
                <input
                  type="text"
                  value={downloadId}
                  onChange={(e) => setDownloadId(e.target.value)}
                  placeholder="Enter file unique ID (e.g., 550e8400-e29b-41d4-a716-446655440000)"
                  className="download-id-input"
                  disabled={downloadingById}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !downloadingById) {
                      handleDownloadById();
                    }
                  }}
                />
                <button
                  onClick={handleDownloadById}
                  disabled={downloadingById || !downloadId.trim()}
                  className="download-by-id-button"
                >
                  {downloadingById ? 'Downloading...' : 'Download'}
                </button>
              </div>
              <p className="download-note">
                Note: You can only download if the file is open to all or your email is authorized by the file owner.
              </p>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Upload File: {selectedFile?.name}</h3>
                <div className="access-control">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={openToAll}
                      onChange={(e) => setOpenToAll(e.target.checked)}
                      disabled={uploading}
                    />
                    <span>Open to All (Anyone can download)</span>
                  </label>
                  {!openToAll && (
                    <div className="email-input-group">
                      <label>Allowed Emails (comma-separated):</label>
                      <input
                        type="text"
                        value={allowedEmails}
                        onChange={(e) => setAllowedEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                        disabled={uploading}
                      />
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button onClick={() => setShowUploadModal(false)} disabled={uploading} className="cancel-button">
                    Cancel
                  </button>
                  <button onClick={handleFileUpload} disabled={uploading} className="upload-confirm-button">
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Access Modal */}
          {editingFile && (
            <div className="modal-overlay" onClick={() => setEditingFile(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Edit Access: {editingFile.originalName}</h3>
                <div className="access-control">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={openToAll}
                      onChange={(e) => setOpenToAll(e.target.checked)}
                    />
                    <span>Open to All (Anyone can download)</span>
                  </label>
                  {!openToAll && (
                    <div className="email-input-group">
                      <label>Allowed Emails (comma-separated):</label>
                      <input
                        type="text"
                        value={allowedEmails}
                        onChange={(e) => setAllowedEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                      />
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button onClick={() => {
                    setEditingFile(null);
                    setOpenToAll(false);
                    setAllowedEmails('');
                  }} className="cancel-button">
                    Cancel
                  </button>
                  <button onClick={() => handleUpdateAccess(editingFile)} className="upload-confirm-button">
                    Update Access
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="files-section">
            <h2>Your Files</h2>
            {loading ? (
              <div className="loading">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="empty-state">
                <p>No files uploaded yet</p>
                <p className="empty-hint">Upload your first file to get started!</p>
              </div>
            ) : (
              <div className="files-grid">
                {files.map((file) => (
                  <div key={file._id || file.id} className="file-card">
                    <div className="file-icon">
                      {getFileIcon(file.mimetype, file.originalName)}
                    </div>
                    <div className="file-info">
                      <h3 className="file-name" title={file.originalName}>
                        {file.originalName}
                      </h3>
                      <p className="file-meta">
                        {formatFileSize(file.size)} • {formatDate(file.uploadDate)}
                      </p>
                      <div className="file-access-info">
                        <span className={`access-badge ${file.openToAll ? 'public' : 'private'}`}>
                          {file.openToAll ? 'Public' : 'Private'}
                        </span>
                        {file.uniqueId && (
                          <span className="unique-id">ID: {file.uniqueId.substring(0, 8)}...</span>
                        )}
                      </div>
                      {file.uniqueId && (
                        <div className="share-link-section">
                          <button
                            onClick={() => copyShareLink(file.uniqueId)}
                            className="share-link-button"
                            title="Copy unique ID"
                          >
                            📋 Copy Unique ID
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="file-actions">
                      <button
                        onClick={() => handleDownload(file)}
                        className="action-button download-button"
                        title="Download"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setEditingFile(file);
                          setOpenToAll(file.openToAll);
                          setAllowedEmails(file.allowedEmails ? file.allowedEmails.join(', ') : '');
                        }}
                        className="action-button edit-button"
                        title="Edit Access"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(file._id || file.id)}
                        className="action-button delete-button"
                        title="Delete"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
