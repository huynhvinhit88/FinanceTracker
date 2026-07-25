import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Search, Tag, CheckSquare, Square, 
  Calendar, StickyNote, Filter, CheckCircle2, Clock 
} from 'lucide-react';
import { NoteSheet } from '../components/notes/NoteSheet';
import { formatDate } from '../utils/format';

export default function Notes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'completed'

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const data = await db.notes.orderBy('created_at').reverse().toArray();
      setNotes(data || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách ghi chú:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trích xuất danh sách tất cả phân loại hiện có từ dữ liệu
  const existingCategories = Array.from(
    new Set(notes.map(n => n.category).filter(Boolean))
  );

  // Lọc ghi chú theo từ khóa, danh mục và trạng thái
  const filteredNotes = notes.filter(n => {
    if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
    if (statusFilter === 'pending' && n.is_completed) return false;
    if (statusFilter === 'completed' && !n.is_completed) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchContent = n.content?.toLowerCase().includes(q);
      const matchCat = n.category?.toLowerCase().includes(q);
      return matchTitle || matchContent || matchCat;
    }
    return true;
  });

  const handleToggleComplete = async (e, note) => {
    e.stopPropagation();
    try {
      const updatedStatus = !note.is_completed;
      await db.notes.update(note.id, {
        is_completed: updatedStatus,
        updated_at: new Date().toISOString()
      });
      fetchNotes();
    } catch (err) {
      console.error('Lỗi đổi trạng thái:', err);
    }
  };

  const handleOpenAdd = () => {
    setSelectedNote(null);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (note) => {
    setSelectedNote(note);
    setIsSheetOpen(true);
  };

  const formatNoteDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const dateFormatted = formatDate(isoStr);
    const timeFormatted = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${dateFormatted} • ${timeFormatted}`;
  };

  const getCategoryColorClass = (catName) => {
    switch (catName) {
      case 'Tài chính':
        return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30';
      case 'Ứng dụng':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30';
      case 'Cá nhân':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30';
      default:
        return 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30';
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-950 min-h-screen pb-24 transition-colors duration-300">
      {/* App Bar pinned top */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 safe-top sticky top-0 z-40 border-b border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between transition-colors duration-300">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-800 dark:text-slate-100" />
        </button>
        <h1 className="font-bold text-lg text-gray-900 dark:text-slate-100 absolute left-1/2 -translate-x-1/2">
          Ghi chú
        </h1>
        <button
          onClick={handleOpenAdd}
          className="p-2 -mr-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center space-x-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Thêm mới</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Search & Filters */}
        <div className="space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nội dung ghi chú..."
              className="w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 pl-10 pr-4 py-2.5 rounded-2xl border border-gray-100 dark:border-white/10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          {/* Status & Category Filters */}
          <div className="flex items-center space-x-2 overflow-x-auto hide-scrollbar pb-1">
            {/* Status Chips */}
            {[
              { id: 'all', label: 'Tất cả trạng thái' },
              { id: 'pending', label: 'Chưa xong' },
              { id: 'completed', label: 'Đã xong' }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  statusFilter === st.id
                    ? 'bg-gray-900 dark:bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-white/5 hover:bg-gray-100'
                }`}
              >
                {st.label}
              </button>
            ))}

            <div className="h-4 w-px bg-gray-200 dark:bg-slate-800 shrink-0 mx-1" />

            {/* Dynamic Category Chips */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-white/5'
              }`}
            >
              Tất cả loại
            </button>

            {existingCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Grid / List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-white/10 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-slate-800 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <StickyNote size={32} />
            </div>
            <p className="text-gray-800 dark:text-slate-200 font-bold text-base">Chưa có ghi chú nào</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1 max-w-xs mx-auto">
              Ghi lại thông tin tài chính cần nhớ hoặc các ý tưởng nâng cấp app tại đây.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-5 px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
            >
              + Tạo ghi chú đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotes.map(n => (
              <div
                key={n.id}
                onClick={() => handleOpenEdit(n)}
                className={`bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 flex flex-col justify-between cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all group ${
                  n.is_completed ? 'opacity-65' : ''
                }`}
              >
                <div>
                  {/* Header row: Category & Completion Status */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${getCategoryColorClass(n.category)}`}>
                      {n.category || 'Tài chính'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleToggleComplete(e, n)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      title={n.is_completed ? "Mở lại" : "Hoàn thành"}
                    >
                      {n.is_completed ? (
                        <CheckSquare size={18} className="text-emerald-500" />
                      ) : (
                        <Square size={18} className="text-gray-400 dark:text-slate-500 hover:text-indigo-500" />
                      )}
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className={`font-bold text-gray-900 dark:text-slate-100 text-base leading-snug mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                    n.is_completed ? 'line-through text-gray-500 dark:text-slate-500' : ''
                  }`}>
                    {n.title}
                  </h3>

                  {/* Content Preview */}
                  {n.content && (
                    <p className="text-xs text-gray-600 dark:text-slate-400 font-normal line-clamp-3 leading-relaxed mb-3 whitespace-pre-wrap">
                      {n.content}
                    </p>
                  )}
                </div>

                {/* Footer: Timestamp */}
                <div className="pt-3 mt-1 border-t border-gray-50 dark:border-white/5 flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                  <div className="flex items-center space-x-1">
                    <Clock size={12} />
                    <span>{formatNoteDate(n.created_at)}</span>
                  </div>
                  {n.updated_at && n.updated_at !== n.created_at && (
                    <span className="italic">Đã sửa</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB Floating Add Button */}
      <button
        onClick={handleOpenAdd}
        className="fixed right-6 bottom-20 lg:bottom-8 z-30 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-400/40 dark:shadow-none flex items-center justify-center active:scale-95 hover:scale-105 transition-all"
        title="Thêm ghi chú mới"
      >
        <Plus size={28} />
      </button>

      {/* Sheet Thêm / Sửa Ghi chú */}
      <NoteSheet
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setTimeout(() => setSelectedNote(null), 300);
        }}
        note={selectedNote}
        existingCategories={existingCategories}
        onSuccess={fetchNotes}
      />
    </div>
  );
}
