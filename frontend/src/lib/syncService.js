import { exportDB, importInto } from 'dexie-export-import';
import { db } from './db';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.readonly email';
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
export async function getValidToken() {
  return new Promise((resolve, reject) => {
    try {
      if (!tokenClient) initGoogleDriveSync();
      
      // Nếu đã có token và chưa hết hạn (đơn giản hóa bằng cách check biến)
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
 * Liệt kê các thư mục trên Drive
 */
export async function listDriveFolders(parentId = 'root') {
  try {
    const token = await getValidToken();
    const query = `mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,iconLink)&orderBy=name`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    if (!response.ok) {
      if (response.status === 401) {
        accessToken = null; // Clear expired token
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng thử lại.');
      }
      if (response.status === 403) {
        accessToken = null; // Force re-consent next time
        throw new Error('Thiếu quyền truy cập. Vui lòng cấp quyền xem thư mục Drive khi đăng nhập.');
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Không thể lấy danh sách thư mục');
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('List folders error:', error);
    throw error;
  }
}

/**
 * Liệt kê các file trong thư mục Drive
 */
export async function listDriveFiles(parentId = 'root', mimeType = 'application/json') {
  try {
    const token = await getValidToken();
    const query = `'${parentId}' in parents and trashed = false${mimeType ? ` and mimeType = '${mimeType}'` : ''}`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size,iconLink)&orderBy=modifiedTime desc`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    if (!response.ok) {
      throw new Error('Không thể lấy danh sách tập tin');
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('List files error:', error);
    throw error;
  }
}

/**
 * Tạo thư mục mới trên Drive
 */
export async function createDriveFolder(name, parentId = 'root') {
  try {
    const token = await getValidToken();
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId === 'root' ? [] : [parentId]
    };

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) throw new Error('Không thể tạo thư mục');
    return await response.json();
  } catch (error) {
    console.error('Create folder error:', error);
    throw error;
  }
}

/**
 * Tìm file backup trong folder cụ thể hoặc appDataFolder
 */
async function findBackupFile(token, folderId = 'appDataFolder', filename = BACKUP_FILE_NAME) {
  const query = `name='${filename}' and '${folderId}' in parents and trashed = false`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`,
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
export async function uploadToDrive(targetFolderId = 'appDataFolder') {
  try {
    const token = await getValidToken();
    const blob = await exportDB(db);
    
    // Nếu là folder do người dùng chọn, dùng tên file có ngày tháng + giờ phút để tránh trùng lặp và lỗi quyền ghi
    const isCustomFolder = targetFolderId !== 'appDataFolder';
    const timestamp = new Date().toLocaleString('sv').replace(/[: ]/g, '-');
    const filename = isCustomFolder 
      ? `finance_tracker_backup_${timestamp}.json`
      : BACKUP_FILE_NAME;

    const metadata = {
      name: filename,
      parents: isCustomFolder ? [targetFolderId] : ['appDataFolder']
    };

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    // Chỉ PATCH nếu là appDataFolder và file đã tồn tại (để giữ 1 bản duy nhất trong appData)
    if (!isCustomFolder) {
      const existingFile = await findBackupFile(token, 'appDataFolder', BACKUP_FILE_NAME);
      if (existingFile) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
        method = 'PATCH';
        delete metadata.parents;
      }
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
      console.error('Drive Upload Error:', errorData);
      if (response.status === 401) {
        accessToken = null;
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng thử lại.');
      }
      throw new Error(errorData.error?.message || 'Không thể tải dữ liệu lên Google Drive');
    }
    
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
export async function downloadFromDrive(fileId = null) {
  try {
    const token = await getValidToken();
    let targetFileId = fileId;

    if (!targetFileId) {
      const file = await findBackupFile(token);
      if (!file) {
        throw new Error('Không tìm thấy bản sao lưu trên Drive');
      }
      targetFileId = file.id;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media`,
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
    const timestamp = new Date().toLocaleString('sv').replace(/[: ]/g, '-');
    const filename = `finance_tracker_backup_${timestamp}.json`;

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
