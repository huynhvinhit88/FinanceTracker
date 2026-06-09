import Dexie from 'dexie';

// Kho lưu trữ CỤC BỘ (IndexedDB) cho dữ liệu KHÔNG serialize được sang JSON/Supabase
// và vốn chỉ có ý nghĩa trên đúng thiết bị/trình duyệt hiện tại.
//
// Trường hợp dùng: FileSystemDirectoryHandle (thư mục lưu backup do người dùng chọn).
// Handle là object "structured-cloneable" nên IndexedDB lưu lại được qua các lần reload,
// trong khi nếu lưu vào Supabase (cột JSON) nó sẽ bị serialize thành {} → mất vĩnh viễn
// (đây là nguyên nhân thư mục lưu trữ luôn bị "undefined" sau khi tải lại trang).
const localDb = new Dexie('finance_tracker_local');
localDb.version(1).stores({ handles: 'key' });

export async function saveLocalHandle(key, handle) {
  try {
    await localDb.handles.put({ key, handle });
  } catch (err) {
    console.error('Không lưu được handle cục bộ:', err);
  }
}

export async function getLocalHandle(key) {
  try {
    const row = await localDb.handles.get(key);
    return row?.handle || null;
  } catch (err) {
    console.error('Không đọc được handle cục bộ:', err);
    return null;
  }
}

export async function deleteLocalHandle(key) {
  try {
    await localDb.handles.delete(key);
  } catch (err) {
    console.error('Không xóa được handle cục bộ:', err);
  }
}
