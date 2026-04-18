import { exportDB, importInto } from 'dexie-export-import';
import { db } from './db';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata email';
const BACKUP_FILE_NAME = 'finance_tracker_backup.json';

let tokenClient = null;
let accessToken = null;

/**
 * Initialize Google Identity Services Token Client
 */
export function initGoogleDriveSync() {
  if (tokenClient) return;
  
  if (typeof window.google === 'undefined') {
    console.error('Google Identity Services script not loaded');
    return;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error !== undefined) {
        throw tokenResponse;
      }
      accessToken = tokenResponse.access_token;
      // Trình kích hoạt callback này thường dành cho các luồng async bên ngoài
    },
  });
}

/**
 * Request Access Token using a Promise wrapper
 */
async function getValidToken() {
  return new Promise((resolve, reject) => {
    try {
      if (!tokenClient) initGoogleDriveSync();
      
      // Nếu đã có token và chưa hết hạn (đơn giản hóa bằng cách check biến)
      // Trong thực tế GIS quản lý token expires, nhưng để đơn giản ta xin token mới nếu chưa có
      if (accessToken) {
        resolve(accessToken);
        return;
      }

      tokenClient.callback = (response) => {
        if (response.error) {
          reject(response);
        } else {
          accessToken = response.access_token;
          resolve(accessToken);
        }
      };

      tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetch Google User Info (email)
 */
export async function getGoogleUserInfo() {
  try {
    const token = await getValidToken();
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

/**
 * Disconnect Google Drive session
 */
export function disconnectGoogleDrive() {
  if (accessToken && window.google) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Google token revoked');
    });
  }
  accessToken = null;
}

/**
 * Tìm file backup trong appDataFolder
 */
async function findBackupFile(token) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILE_NAME}'&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Đẩy dữ liệu lên Google Drive
 */
export async function uploadToDrive() {
  try {
    const token = await getValidToken();
    const blob = await exportDB(db);
    const existingFile = await findBackupFile(token);

    const metadata = {
      name: BACKUP_FILE_NAME,
      parents: ['appDataFolder']
    };

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFile) {
      // Cập nhật file cũ (PATCH)
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
      // Field 'parents' is not writable in update requests
      delete metadata.parents;
    }

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Drive Upload Error:', errorData);
      
      if (response.status === 401) {
        accessToken = null; // Clear token if unauthorized
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng thử lại.');
      }
      
      throw new Error(errorData.error?.message || 'Không thể tải dữ liệu lên Google Drive');
    }
    
    // Lưu lại thời điểm đồng bộ vào Settings local
    const now = new Date().toISOString();
    await db.settings.put({ key: 'lastDriveSync', value: now });
    
    return true;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

/**
 * Tải dữ liệu từ Google Drive và khôi phục vào local
 */
export async function downloadFromDrive() {
  try {
    const token = await getValidToken();
    const file = await findBackupFile(token);

    if (!file) {
      throw new Error('Không tìm thấy bản sao lưu trên Drive');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Drive Download Error:', errorData);
      
      if (response.status === 401) {
        accessToken = null;
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng thử lại.');
      }
      
      throw new Error(errorData.error?.message || 'Tải file từ Drive thất bại');
    }

    const blob = await response.blob();
    
    // Khôi phục vào DB
    await db.delete();
    await db.open();
    await importInto(db, blob, { 
      clearTablesBeforeImport: true,
      overwriteValues: true 
    });

    return true;
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

/**
 * Kiểm tra xem có bản backup mới hơn trên Drive không
 */
export async function checkRemoteBackup() {
  try {
    const token = await getValidToken();
    const file = await findBackupFile(token);
    if (!file) return null;

    const lastLocalSync = await db.settings.get('lastDriveSync');
    
    return {
      remoteTime: file.modifiedTime,
      localTime: lastLocalSync ? lastLocalSync.value : null,
      isNewer: lastLocalSync ? new Date(file.modifiedTime) > new Date(lastLocalSync.value) : true
    };
  } catch (error) {
    console.error('Check remote error:', error);
    return null;
  }
}

// Giữ lại các hàm export/import JSON nội bộ
export async function exportDatabaseToJSON(targetFolderHandle = null) {
  try {
    const blob = await exportDB(db);
    const filename = `finance_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;

    if (targetFolderHandle) {
      await writeBlobToFolder(targetFolderHandle, filename, blob);
      return true;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Export error: ', error);
    throw error;
  }
}

/**
 * File System Access API Helpers
 */

export async function selectDirectoryHandle() {
  if (!window.showDirectoryPicker) {
    throw new Error('Trình duyệt của bạn không hỗ trợ công cụ chọn thư mục. Vui lòng sử dụng Chrome hoặc Edge.');
  }
  const handle = await window.showDirectoryPicker({
    mode: 'readwrite'
  });
  // Lưu handle vào database để tái sử dụng
  await db.settings.put({ key: 'localDirectoryHandle', value: handle });
  return handle;
}

export async function verifyDirectoryPermission(handle, withRequest = false) {
  if (!handle) return false;
  
  const options = { mode: 'readwrite' };
  
  // Kiểm tra quyền hiện tại
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Nếu yêu cầu xác thực mới
  if (withRequest) {
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  }
  
  return false;
}

export async function writeBlobToFolder(dirHandle, filename, blob) {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    console.error('Error writing to local folder:', error);
    throw new Error('Không thể ghi file vào thư mục đã chọn. Vui lòng kiểm tra quyền truy cập.');
  }
}

export async function importDatabaseFromJSON(file) {
  try {
    await db.delete();
    await db.open();
    await importInto(db, file, { 
      clearTablesBeforeImport: true,
      overwriteValues: true 
    });
    return true;
  } catch (error) {
    console.error('Import error: ', error);
    throw error;
  }
}
