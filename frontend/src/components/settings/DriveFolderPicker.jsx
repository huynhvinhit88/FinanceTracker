import React, { useState, useEffect } from 'react';
import { 
  Folder, FolderPlus, ArrowLeft, ChevronRight, 
  Check, Loader2, Search, Plus 
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { listDriveFolders, createDriveFolder } from '../../lib/syncService';

export function DriveFolderPicker({ isOpen, onClose, onSelect, initialFolderId = 'root' }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([{ id: initialFolderId, name: 'Google Drive' }]);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState(null);

  const currentFolder = history[history.length - 1];

  useEffect(() => {
    if (isOpen) {
      loadFolders(currentFolder.id);
    }
  }, [isOpen, currentFolder.id]);

  const loadFolders = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDriveFolders(id);
      setFolders(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách thư mục. Vui lòng kiểm tra kết nối.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (folder) => {
    setHistory([...history, { id: folder.id, name: folder.name }]);
  };

  const handleBack = () => {
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setLoading(true);
    try {
      const newFolder = await createDriveFolder(newFolderName, currentFolder.id);
      setIsCreating(false);
      setNewFolderName('');
      await loadFolders(currentFolder.id);
    } catch (err) {
      setError('Lỗi khi tạo thư mục mới.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCurrent = () => {
    onSelect(currentFolder);
    onClose();
  };

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Chọn thư mục Drive"
      size="md"
    >
      <div className="flex flex-col space-y-4 min-h-[400px]">
        {/* Breadcrumb / Navigation Bar */}
        <div className="flex items-center space-x-2 pb-2 border-b border-gray-100 dark:border-white/5">
          {history.length > 1 && (
            <button 
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft size={18} className="text-gray-500" />
            </button>
          )}
          <div className="flex-1 overflow-x-auto no-scrollbar whitespace-nowrap py-1">
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100 italic">
              {currentFolder.name}
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-slate-500">
            {loading ? 'Đang tải...' : `${folders.length} thư mục`}
          </p>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity"
          >
            <FolderPlus size={14} />
            <span>Tạo mới</span>
          </button>
        </div>

        {/* Create Folder Input */}
        {isCreating && (
          <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl flex items-center space-x-2 border border-indigo-100 dark:border-indigo-900/30">
            <input 
              autoFocus
              className="flex-1 bg-transparent border-none text-sm font-bold focus:ring-0 text-gray-900 dark:text-white"
              placeholder="Tên thư mục mới..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <button 
              onClick={() => { setIsCreating(false); setNewFolderName(''); }}
              className="p-1 px-3 text-xs text-gray-500 font-bold"
            >
              Hủy
            </button>
            <button 
              onClick={handleCreateFolder}
              className="bg-indigo-600 text-white p-2 rounded-xl"
            >
              <Check size={16} />
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-rose-900/10 border border-red-100 dark:border-rose-900/20 rounded-2xl flex flex-col items-center">
            <p className="text-xs text-red-600 dark:text-rose-400 font-bold text-center mb-3">{error}</p>
            <button 
              onClick={() => loadFolders(currentFolder.id)}
              className="px-4 py-2 bg-red-100 dark:bg-rose-900/30 text-red-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-80"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto max-h-[300px] -mx-1 px-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 size={32} className="text-indigo-600 animate-spin" />
              <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center">Đang kết nối Drive...</p>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Folder size={32} className="text-gray-300 dark:text-slate-700" />
              </div>
              <p className="text-sm font-bold text-gray-400 dark:text-slate-500">Chưa có thư mục nào bên trong</p>
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map(folder => (
                <button 
                  key={folder.id}
                  onClick={() => handleNavigate(folder)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-all group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-xl">
                      <Folder size={18} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-slate-200 truncate max-w-[180px]">
                      {folder.name}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Fix / Select Button */}
        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
          <button 
            onClick={handleSelectCurrent}
            disabled={loading}
            className="w-full h-14 bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-500 text-white rounded-2xl font-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg flex items-center justify-center"
          >
            <span>CHỌN THƯ MỤC NÀY</span>
          </button>
          <p className="mt-4 text-[10px] text-gray-400 dark:text-slate-500 font-medium text-center uppercase tracking-widest">
            Dữ liệu sẽ được lưu vào: {currentFolder.name}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
