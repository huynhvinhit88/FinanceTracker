import React, { useState, useEffect } from 'react';
import { 
  FileJson, ArrowLeft, Loader2, RefreshCw, Download
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { listDriveFiles } from '../../lib/syncService';

export function DriveFilePicker({ isOpen, onClose, onSelect, folderId, folderName }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && folderId) {
      loadFiles();
    }
  }, [isOpen, folderId]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDriveFiles(folderId);
      setFiles(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tập tin.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Chọn bản sao lưu từ Drive"
      size="md"
    >
      <div className="flex flex-col space-y-4 min-h-[400px]">
        {/* Header info */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-slate-500">Thư mục</span>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100 italic">{folderName}</span>
          </div>
          <button 
            onClick={loadFiles}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-indigo-600"
            title="Làm mới"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-rose-900/10 border border-red-100 dark:border-rose-900/20 rounded-2xl flex flex-col items-center">
            <p className="text-xs text-red-600 dark:text-rose-400 font-bold text-center mb-3">{error}</p>
            <button 
              onClick={loadFiles}
              className="px-4 py-2 bg-red-100 dark:bg-rose-900/30 text-red-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-80"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto max-h-[400px] -mx-1 px-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 size={32} className="text-indigo-600 animate-spin" />
              <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center">Đang tìm bản sao lưu...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <FileJson size={32} className="text-gray-300 dark:text-slate-700" />
              </div>
              <p className="text-sm font-bold text-gray-400 dark:text-slate-500 px-8">
                Không tìm thấy file .json nào trong thư mục này.
              </p>
              <p className="text-[10px] text-gray-300 mt-2 italic px-8">
                Hãy đảm bảo bạn đã sao lưu dữ liệu vào đúng thư mục đã chọn.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-slate-500 px-2">
                Tìm thấy {files.length} bản sao lưu
              </p>
              {files.map(file => (
                <button 
                  key={file.id}
                  onClick={() => onSelect(file)}
                  className="w-full flex items-center space-x-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group text-left shadow-sm"
                >
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-2xl shrink-0">
                    <FileJson size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-slate-100 truncate group-hover:text-indigo-600 transition-colors">
                      {file.name}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{formatSize(file.size)}</span>
                      <span className="text-[10px] font-medium text-gray-300 dark:text-slate-600">•</span>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{formatDate(file.modifiedTime)}</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Download size={16} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            null
          )}
        </div>

        <div className="pt-2">
          <p className="text-[10px] text-center text-gray-400 dark:text-slate-500 font-medium italic leading-relaxed">
            Chọn một bản ghi để bắt đầu khôi phục dữ liệu.<br/>Lưu ý: Dữ liệu hiện tại trên máy sẽ bị ghi đè.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
