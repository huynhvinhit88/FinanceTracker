import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { db } from '../../lib/db';
import { Trash2, Calendar, Tag, CheckSquare, Square } from 'lucide-react';
import { formatDate } from '../../utils/format';

const DEFAULT_SUGGESTED_CATEGORIES = ['Tài chính', 'Ứng dụng', 'Cá nhân', 'Khác'];

export function NoteSheet({ isOpen, onClose, onSuccess, note, existingCategories = [] }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Tài chính');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');

  // Gom danh sách tất cả phân loại sẵn có (từ gợi ý + từ các ghi chú hiện có)
  const categoryOptions = Array.from(
    new Set([...DEFAULT_SUGGESTED_CATEGORIES, ...existingCategories.filter(Boolean)])
  );

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (note) {
        setTitle(note.title || '');
        setContent(note.content || '');
        setIsCompleted(!!note.is_completed);
        const cat = note.category || 'Tài chính';
        if (categoryOptions.includes(cat)) {
          setCategory(cat);
          setIsCustomMode(false);
        } else {
          setCategory('__custom__');
          setCustomCategory(cat);
          setIsCustomMode(true);
        }
      } else {
        setTitle('');
        setContent('');
        setCategory('Tài chính');
        setCustomCategory('');
        setIsCustomMode(false);
        setIsCompleted(false);
      }
    }
  }, [isOpen, note]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề ghi chú');
      return;
    }

    const finalCategory = (isCustomMode || category === '__custom__')
      ? (customCategory.trim() || 'Chưa phân loại')
      : category;

    setLoading(true);
    setError('');

    try {
      const now = new Date().toISOString();
      if (note) {
        // Cập nhật ghi chú cũ
        await db.notes.update(note.id, {
          title: title.trim(),
          content: content.trim(),
          category: finalCategory,
          is_completed: isCompleted,
          updated_at: now
        });
      } else {
        // Thêm ghi chú mới
        await db.notes.add({
          id: crypto.randomUUID(),
          title: title.trim(),
          content: content.trim(),
          category: finalCategory,
          is_completed: isCompleted,
          created_at: now,
          updated_at: now
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu ghi chú');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    if (!window.confirm('Bạn có chắc chắn muốn xoá ghi chú này?')) return;

    setDeleteLoading(true);
    try {
      await db.notes.delete(note.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi xoá ghi chú');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatNoteDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const dateFormatted = formatDate(isoStr);
    const timeFormatted = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${dateFormatted} • ${timeFormatted}`;
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={note ? "Sửa ghi chú" : "Thêm ghi chú mới"}>
      <form onSubmit={handleSubmit} className="space-y-5 pb-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 rounded-xl text-sm font-medium border border-red-100 dark:border-rose-900/30">
            {error}
          </div>
        )}

        {/* Hiển thị ngày khởi tạo nếu đang chỉnh sửa */}
        {note && note.created_at && (
          <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 font-medium space-x-1.5 ml-1">
            <Calendar size={14} />
            <span>Ngày tạo: {formatNoteDate(note.created_at)}</span>
          </div>
        )}

        {/* Tiêu đề */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1">
            Tiêu đề ghi chú *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ví dụ: Rút tạm sổ tiết kiệm VCB..."
            className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-bold px-4 py-3 rounded-xl border border-transparent focus:border-indigo-500 outline-none transition-all text-base"
          />
        </div>

        {/* Phân loại linh hoạt */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1 flex items-center">
            <Tag size={12} className="mr-1" /> Phân loại
          </label>

          <div className="space-y-2">
            <select
              value={isCustomMode ? '__custom__' : category}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setIsCustomMode(true);
                } else {
                  setIsCustomMode(false);
                  setCategory(val);
                }
              }}
              className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-semibold px-4 py-3 rounded-xl border border-transparent focus:border-indigo-500 outline-none transition-all text-sm cursor-pointer"
            >
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="__custom__">+ Thêm loại mới...</option>
            </select>

            {(isCustomMode || category === '__custom__') && (
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="Nhập tên loại mới (vd: Mục tiêu 2026, Xe cửa...)"
                className="w-full bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200 font-semibold px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 outline-none text-sm animate-in fade-in"
              />
            )}
          </div>
        </div>

        {/* Nội dung chi tiết */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1">
            Nội dung chi tiết
          </label>
          <textarea
            rows={4}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Ghi lại chi tiết nội dung, lý do, việc cần làm..."
            className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-medium px-4 py-3 rounded-xl border border-transparent focus:border-indigo-500 outline-none transition-all text-sm resize-none"
          />
        </div>

        {/* Trạng thái Hoàn thành / Chưa xong */}
        <div
          onClick={() => setIsCompleted(!isCompleted)}
          className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors select-none"
        >
          {isCompleted ? (
            <CheckSquare size={20} className="text-emerald-500 shrink-0" />
          ) : (
            <Square size={20} className="text-gray-400 dark:text-slate-500 shrink-0" />
          )}
          <div>
            <p className={`text-xs font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-slate-300'}`}>
              {isCompleted ? 'Đã hoàn thành / Xong việc' : 'Chưa hoàn thành'}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
              Đánh dấu để sắp xếp việc cần ưu tiên xử lý
            </p>
          </div>
        </div>

        {/* Hành động Lưu / Xóa */}
        <div className="flex space-x-3 pt-2">
          {note && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading || loading}
              className="py-3 px-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center border border-rose-100 dark:border-rose-900/30"
            >
              {deleteLoading ? (
                <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={loading || deleteLoading}
            className="flex-1 py-3.5 bg-indigo-600 dark:bg-indigo-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none active:scale-[0.98] transition-transform flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              note ? 'Lưu cập nhật' : 'Tạo ghi chú'
            )}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
