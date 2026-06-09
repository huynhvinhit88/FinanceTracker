import { db } from './db';
import { saveLocalHandle } from './localHandleStore';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.readonly email';
const BACKUP_FILE_NAME = 'finance_tracker_backup.json';

/** Danh sách tất cả các bảng cần backup */
const BACKUP_TABLES = ['settings', 'accounts', 'categories', 'transactions', 'loans', 'budgets', 'investments', 'savings', 'goals'];

const getFormattedTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

/**
 * Export toàn bộ dữ liệu từ Supabase bao gồm cả localStorage
 */
async function exportFullBackup() {
  const backup = {
    format: 'finance_tracker_supabase',
    version: 1,
    created_at: new Date().toISOString(),
    data: {}
  };

  // Query tất cả bảng từ Supabase
  for (const table of BACKUP_TABLES) {
    const records = await db[table].toArray();
    // Loại bỏ user_id khỏi dữ liệu export (sẽ được gắn lại khi import)
    backup.data[table] = records.map(({ user_id, ...rest }) => rest);
  }

  // Lấy dữ liệu từ localStorage (hồ sơ khoản vay, kế hoạch tiết kiệm, giao diện)
  const localStorageData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('loan_profiles') || key.startsWith('savings_plan') || key === 'theme') {
      localStorageData[key] = localStorage.getItem(key);
    }
  }
  backup._extra_data = { localStorage: localStorageData };

  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

/**
 * Quy tắc khóa ngoại để LÀM SẠCH dữ liệu trước khi chèn. Một bản backup có thể chứa
 * tham chiếu mồ côi (vd giao dịch trỏ tới tài khoản/danh mục/khoản vay đã bị xóa, hoặc
 * tới bảng cha mà bản thân bảng cha khôi phục thất bại). Postgres bắt buộc khóa ngoại
 * NGAY khi chèn, nên chỉ một dòng mồ côi cũng đủ làm hỏng cả lô `bulkAdd` (atomic) →
 * MẤT SẠCH giao dịch. Vì vậy:
 *   - cột `required` mồ côi  → BỎ cả dòng (không thể NULL vì NOT NULL).
 *   - cột không bắt buộc mồ côi → set NULL (giữ lại phần còn lại của dòng).
 * `parent: 'self'` dùng cho khóa ngoại tự tham chiếu (categories.parent_id).
 */
const FK_RULES = {
  transactions: [
    { col: 'account_id', parent: 'accounts', required: true },
    { col: 'to_account_id', parent: 'accounts', required: false },
    { col: 'category_id', parent: 'categories', required: false },
    { col: 'loan_id', parent: 'loans', required: false },
  ],
  budgets: [
    { col: 'category_id', parent: 'categories', required: true },
  ],
  loans: [
    { col: 'account_id', parent: 'accounts', required: false },
    { col: 'linked_investment_id', parent: 'investments', required: false },
  ],
  investments: [
    { col: 'account_id', parent: 'accounts', required: false },
  ],
  savings: [
    { col: 'account_id', parent: 'accounts', required: false },
    { col: 'category_id', parent: 'categories', required: false },
  ],
  categories: [
    { col: 'parent_id', parent: 'self', required: false },
  ],
};

/**
 * Trích tên cột mà PostgREST báo "không tồn tại trong schema cache" (mã PGRST204):
 *   "Could not find the 'foo' column of 'transactions' in the schema cache"
 * Trả về tên cột hoặc null nếu không phải lỗi dạng này.
 */
function extractMissingColumn(err) {
  const msg = err?.message || '';
  if (err?.code === 'PGRST204' || /schema cache/i.test(msg)) {
    const m = msg.match(/'([^']+)' column/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Chèn một bảng theo kiểu CHỊU LỖI:
 *   1. Thử `bulkAdd`. Nếu lỗi do CỘT LẠ (backup cũ chứa cột không còn trong schema),
 *      loại bỏ cột đó khỏi mọi dòng rồi thử lại — nếu không, một cột lạ sẽ làm hỏng
 *      CẢ LÔ và mất sạch dữ liệu (đặc biệt là giao dịch).
 *   2. Nếu vẫn lỗi vì lý do khác (vd 1 dòng vi phạm CHECK/khóa ngoại), fallback chèn
 *      TỪNG DÒNG để các dòng hợp lệ vẫn được khôi phục.
 * Trả về { ids, inserted, failed }.
 */
async function resilientInsert(table, records) {
  if (!records || records.length === 0) return { ids: [], inserted: 0, failed: 0 };

  let working = records;
  const droppedCols = [];

  // Vòng lặp loại cột lạ: mỗi lần PostgREST chỉ báo 1 cột, nên lặp tới khi hết.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const data = await db[table].bulkAdd(working);
      const ids = (data || []).map(r => r?.id).filter(Boolean);
      if (droppedCols.length) {
        console.warn(`Khôi phục "${table}" sau khi bỏ cột lạ: ${droppedCols.join(', ')}`);
      }
      return { ids, inserted: working.length, failed: 0 };
    } catch (bulkErr) {
      const badCol = extractMissingColumn(bulkErr);
      if (badCol) {
        droppedCols.push(badCol);
        working = working.map(({ [badCol]: _omit, ...rest }) => rest);
        continue; // thử lại không có cột lạ này
      }
      // Không phải lỗi cột → chuyển sang chèn từng dòng.
      console.warn(`bulkAdd bảng "${table}" thất bại, chuyển sang chèn từng dòng:`, bulkErr.message);
      break;
    }
  }

  // Fallback: chèn từng dòng trên dữ liệu đã được dọn cột lạ.
  const ids = [];
  let failed = 0;
  for (const rec of working) {
    try {
      const inserted = await db[table].add(rec);
      if (inserted?.id) ids.push(inserted.id);
    } catch (rowErr) {
      failed++;
      console.error(`Bỏ qua 1 dòng không khôi phục được ở bảng "${table}":`, rowErr.message, rec);
    }
  }
  return { ids, inserted: ids.length, failed };
}

/**
 * Import toàn bộ dữ liệu vào Supabase bao gồm cả localStorage.
 * Trả về { ok, summary } với summary[table] = { inserted, skipped, failed } để
 * lớp UI có thể cảnh báo nếu có dữ liệu bị bỏ sót (thay vì báo "thành công" giả).
 */
async function importFullBackup(blob) {
  const text = await blob.text();
  const rawData = JSON.parse(text);

  // Phát hiện và chuyển đổi format
  let backupData;
  if (rawData.formatName === 'dexie') {
    // Bản backup cũ từ Dexie — chuyển sang format mới
    console.log('Phát hiện bản backup Dexie cũ, đang chuyển đổi...');
    backupData = convertDexieFormat(rawData);
  } else if (rawData.format === 'finance_tracker_supabase') {
    // Bản backup mới từ Supabase
    backupData = rawData;
  } else {
    throw new Error('Định dạng file backup không được hỗ trợ. Vui lòng chọn file JSON đúng.');
  }

  // Khôi phục localStorage nếu có
  if (backupData._extra_data?.localStorage) {
    Object.entries(backupData._extra_data.localStorage).forEach(([key, val]) => {
      if (val !== null && val !== undefined) {
        const stringVal = typeof val === 'string' ? val : JSON.stringify(val);
        localStorage.setItem(key, stringVal);
      }
    });
  }

  // Xóa toàn bộ dữ liệu hiện tại (thứ tự: bảng con trước, bảng cha sau)
  const clearOrder = ['transactions', 'budgets', 'goals', 'savings', 'investments', 'loans', 'accounts', 'categories', 'settings'];
  for (const table of clearOrder) {
    try {
      await db[table].clear();
    } catch (err) {
      console.warn(`Không thể xóa bảng ${table}:`, err.message);
    }
  }

  // Insert dữ liệu (thứ tự: bảng cha trước, bảng con sau để tránh lỗi foreign key).
  // LƯU Ý: investments phải đứng TRƯỚC loans vì loans.linked_investment_id tham chiếu investments.
  const insertOrder = ['settings', 'categories', 'accounts', 'investments', 'loans', 'savings', 'goals', 'budgets', 'transactions'];

  // Theo dõi id thực sự đã khôi phục thành công ở mỗi bảng cha, để làm sạch khóa ngoại con.
  const restoredIds = {};
  const summary = {};

  for (const table of insertOrder) {
    const records = backupData.data[table];
    if (!records || records.length === 0) {
      restoredIds[table] = new Set();
      continue;
    }

    // Loại bỏ user_id cũ (wrapper sẽ tự gắn user_id hiện tại)
    let cleanRecords = records.map(({ user_id, ...rest }) => rest);

    // Làm sạch khóa ngoại: bỏ dòng mồ côi (cột bắt buộc) hoặc set NULL (cột tùy chọn).
    let skipped = 0;
    const rules = FK_RULES[table];
    if (rules) {
      cleanRecords = cleanRecords.filter(rec => {
        for (const rule of rules) {
          const ref = rec[rule.col];
          if (ref === null || ref === undefined) continue;
          const parentSet = rule.parent === 'self' ? null : restoredIds[rule.parent];
          // Với self-reference, ta chấp nhận mọi id có trong chính lô đang chèn.
          const exists = rule.parent === 'self'
            ? records.some(r => r.id === ref)
            : (parentSet ? parentSet.has(ref) : false);
          if (!exists) {
            if (rule.required) {
              skipped++;
              return false; // bỏ cả dòng
            }
            rec[rule.col] = null; // cắt tham chiếu mồ côi
          }
        }
        return true;
      });
    }

    if (table === 'settings') {
      // Settings dùng upsert theo key
      let inserted = 0, failed = 0;
      for (const record of cleanRecords) {
        try {
          await db.settings.put(record);
          inserted++;
        } catch (err) {
          failed++;
          console.error('Lỗi khôi phục settings:', err.message, record);
        }
      }
      summary[table] = { inserted, skipped, failed };
      restoredIds[table] = new Set();
      continue;
    }

    const { ids, inserted, failed } = await resilientInsert(table, cleanRecords);
    restoredIds[table] = new Set(ids);
    summary[table] = { inserted, skipped, failed };
  }

  // Cập nhật timestamp
  try {
    const { updateLastModified } = await import('./db');
    await updateLastModified();
  } catch (e) {
    console.error('Failed to update timestamp after import:', e);
  }

  // Tổng hợp số dòng bị bỏ sót để cảnh báo người dùng.
  const totalSkipped = Object.values(summary).reduce((s, t) => s + (t.skipped || 0) + (t.failed || 0), 0);
  return { ok: true, summary, totalSkipped };
}

/**
 * Chuyển đổi bản backup cũ (Dexie format) sang format mới (Supabase)
 * Hỗ trợ backward compatibility với các file backup đã tạo trước khi chuyển sang Supabase
 */
function convertDexieFormat(dexieData) {
  const converted = {
    format: 'finance_tracker_supabase',
    version: 1,
    created_at: new Date().toISOString(),
    data: {},
    _extra_data: dexieData._extra_data || {}
  };

  // Dexie format: data.data = [{ tableName: 'xxx', rows: [...] }, ...]
  if (dexieData.data?.data && Array.isArray(dexieData.data.data)) {
    for (const tableData of dexieData.data.data) {
      if (tableData.tableName && BACKUP_TABLES.includes(tableData.tableName)) {
        converted.data[tableData.tableName] = tableData.rows || [];
      }
    }
  }

  // Đảm bảo tất cả bảng đều có mặt (dù rỗng)
  for (const table of BACKUP_TABLES) {
    if (!converted.data[table]) {
      converted.data[table] = [];
    }
  }

  return converted;
}

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
    const query = `'${parentId}' in parents and trashed = false and (mimeType = 'application/json' or name contains '.json')`;
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
    const blob = await exportFullBackup();
    
    // Nếu là folder do người dùng chọn, dùng tên file có ngày tháng + giờ phút để tránh trùng lặp và lỗi quyền ghi
    const isCustomFolder = targetFolderId !== 'appDataFolder';
    const timestamp = getFormattedTimestamp();
    const filename = isCustomFolder 
      ? `finance_tracker_backup_${timestamp}.json`
      : BACKUP_FILE_NAME;

    const metadata = {
      name: filename,
      parents: isCustomFolder ? [targetFolderId] : ['appDataFolder'],
      mimeType: 'application/json'
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
    formData.append('file', new Blob([blob], { type: 'application/json' }), filename);

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
 * Đẩy MỘT file bất kỳ (CSV/XLSX báo cáo...) lên thư mục Google Drive do người dùng chọn.
 * Khác uploadToDrive (vốn chỉ đẩy bản backup JSON đầy đủ), hàm này nhận blob + tên file tùy ý.
 * Nếu trong thư mục đã có file trùng tên thì PATCH (ghi đè) để mỗi báo cáo chỉ giữ 1 bản,
 * tránh tích tụ nhiều bản trùng sau mỗi lần xuất.
 */
export async function uploadFileToDrive(targetFolderId, filename, blob, mimeType = 'application/octet-stream') {
  const token = await getValidToken();

  const existingFile = await findBackupFile(token, targetFolderId, filename);

  const metadata = { name: filename, mimeType };
  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';
  if (existingFile) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    method = 'PATCH';
  } else {
    metadata.parents = [targetFolderId];
  }

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([blob], { type: mimeType }), filename);

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
    throw new Error(errorData.error?.message || 'Không thể tải file lên Google Drive');
  }

  return true;
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
    return await importFullBackup(blob);
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
    const blob = await exportFullBackup();
    const timestamp = getFormattedTimestamp();
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
  // Lưu handle vào IndexedDB cục bộ (KHÔNG dùng Supabase: handle không serialize được
  // sang JSON nên sẽ thành {} và mất sau khi reload).
  await saveLocalHandle('localDirectoryHandle', handle);
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
    return await importFullBackup(file);
  } catch (error) {
    console.error('Import error: ', error);
    throw error;
  }
}
