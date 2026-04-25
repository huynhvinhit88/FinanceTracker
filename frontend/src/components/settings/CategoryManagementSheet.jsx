import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/db';
import { Plus, Edit2, Trash2, ArrowLeft, Check } from 'lucide-react';

const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'];

export function CategoryManagementSheet({ isOpen, onClose }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('expense');
  const [loading, setLoading] = useState(false);
  
  // Editor State
  const [editingCat, setEditingCat] = useState(null); // null = List view. {id: ...} = Edit. {isNew: true} = Add
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [colorHex, setColorHex] = useState(COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setEditingCat(null);
    }
  }, [isOpen, user]);

  const fetchCategories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await db.categories.toArray();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (cat) => {
    setEditingCat(cat);
    setName(cat.name);
    setIcon(cat.icon || '');
    setColorHex(cat.color_hex || COLORS[0]);
    setError('');
  };

  const handleOpenAdd = () => {
    setEditingCat({ isNew: true });
    setName('');
    setIcon('');
    setColorHex(COLORS[0]);
    setError('');
  };

  const handleDelete = async (catId) => {
    if (!window.confirm('Chắc chắn xoá danh mục này? Các ngân sách liên quan sẽ bị xóa và các giao dịch cũ sẽ trở thành "Chưa phân loại".')) return;
    
    setLoading(true);
    try {
      // 1. Xóa các ngân sách liên quan đến danh mục này
      const relatedBudgets = await db.budgets.filter(b => b.category_id === catId).toArray();
      await db.budgets.bulkDelete(relatedBudgets.map(b => b.id));

      // 2. Gỡ danh mục khỏi các giao dịch liên quan (set null)
      const relatedTxs = await db.transactions.filter(t => t.category_id === catId).toArray();
      for(const t of relatedTxs) {
         await db.transactions.update(t.id, { category_id: null });
      }

      // 3. Cuối cùng mới xóa danh mục
      await db.categories.delete(catId);

      fetchCategories();
    } catch (err) {
      alert('Không thể xóa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên danh mục không được trống');
      return;
    }
    
    try {
      if (editingCat.isNew) {
        const payload = {
          id: crypto.randomUUID(),
          name: name.trim(),
          type: activeTab,
          icon,
          color_hex: colorHex
        };
        await db.categories.add(payload);
      } else {
        const payload = {
          name: name.trim(),
          icon,
          color_hex: colorHex
        };
        await db.categories.update(editingCat.id, payload);
      }
      
      setEditingCat(null);
      fetchCategories();
    } catch (err) {
      setError('Lỗi lưu danh mục: ' + err.message);
    }
  };

  const currentList = categories.filter(c => c.type === activeTab);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editingCat ? (editingCat.isNew ? "Thêm danh mục" : "Sửa danh mục") : "Quản lý Danh mục"}>
      
      {/* --- LIST VIEW --- */}
      {!editingCat && (
        <div className="space-y-4 pb-12 animate-in fade-in">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('expense')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'expense' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              Khoản Chi
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'income' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              Khoản Thu
            </button>
            <button
              onClick={() => setActiveTab('savings')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'savings' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              Tiết kiệm
            </button>
          </div>

          <div className="space-y-2 mt-4">
            {currentList.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: cat.color_hex + '20', color: cat.color_hex }}>
                    {cat.icon}
                  </div>
                  <span className="font-semibold text-gray-800 dark:text-slate-100">{cat.name}</span>
                </div>
                <div className="flex items-center">
                  <button onClick={() => handleOpenEdit(cat)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            
            {loading && <p className="text-center text-gray-400 text-sm mt-4">Đang tải...</p>}
            
            {!loading && currentList.length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-400 dark:text-slate-500 text-sm">Chưa có danh mục nào.</p>
              </div>
            )}
          </div>

          <button 
            onClick={handleOpenAdd}
            className="w-full py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 font-bold rounded-xl mt-4 flex items-center justify-center space-x-2 transition-colors active:scale-95 border-none dark:border dark:border-white/5"
          >
            <Plus size={18} />
            <span>Thêm danh mục {activeTab === 'expense' ? 'Chi' : activeTab === 'income' ? 'Thu' : 'Tiết kiệm'}</span>
          </button>
        </div>
      )}

      {/* --- EDIT / ADD VIEW --- */}
      {editingCat && (
        <form onSubmit={handleSave} className="space-y-6 pb-6 animate-in slide-in-from-right-2">
          
          <button type="button" onClick={() => setEditingCat(null)} className="flex items-center space-x-2 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors font-medium text-sm mb-2">
             <ArrowLeft size={16} />
             <span>Quay lại</span>
          </button>

          {error && <div className="p-3 bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 border border-red-100 dark:border-rose-900/30 rounded-xl text-sm font-medium">{error}</div>}

          <div>
             <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Tên danh mục</label>
             <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Mua sắm shoppee" className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"/>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-2">Biểu tượng (Emoji)</label>
                <div className="relative">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl" style={{ pointerEvents: 'none' }}>{icon}</div>
                   <input 
                     type="text" 
                     value={icon} 
                     onChange={e => {
                       const val = e.target.value.trim();
                       const chars = Array.from(val);
                       if (chars.length > 0) setIcon(chars[chars.length - 1]);
                       else setIcon('');
                     }} 
                     className="w-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-transparent focus:border-blue-500 rounded-xl py-3 pl-12 pr-4 outline-none font-medium text-lg caret-blue-500" 
                     placeholder="Thêm Icon..."
                   />
                </div>
             </div>
          </div>

          <div>
             <label className="block text-sm font-semibold text-gray-700 dark:text-slate-400 mb-3">Màu sắc nhận diện</label>
             <div className="flex flex-wrap gap-3">
                {COLORS.map(c => (
                   <button 
                     key={c}
                     type="button"
                     onClick={() => setColorHex(c)}
                     className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${colorHex === c ? 'scale-110 shadow-md ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'}`}
                     style={{ backgroundColor: c }}
                   >
                     {colorHex === c && <Check size={16} className="text-white" />}
                   </button>
                ))}
             </div>
          </div>

          <button type="submit" className="w-full py-4 bg-blue-600 dark:bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none mt-8 active:scale-95 transition-transform">
            Lưu danh mục
          </button>
        </form>
      )}

    </BottomSheet>
  );
}
