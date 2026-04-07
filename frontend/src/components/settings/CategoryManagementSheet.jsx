import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
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
  const [icon, setIcon] = useState('🍔');
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
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (cat) => {
    setEditingCat(cat);
    setName(cat.name);
    setIcon(cat.icon || '📌');
    setColorHex(cat.color_hex || COLORS[0]);
    setError('');
  };

  const handleOpenAdd = () => {
    setEditingCat({ isNew: true });
    setName('');
    setIcon('✨');
    setColorHex(COLORS[0]);
    setError('');
  };

  const handleDelete = async (catId) => {
    if (!window.confirm('Chắc chắn xoá danh mục này? Các giao dịch cũ có thể bị mất danh mục.')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;
      fetchCategories();
    } catch (err) {
      alert('Không thể xóa: ' + err.message);
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
          user_id: user.id,
          name: name.trim(),
          type: activeTab,
          icon,
          color_hex: colorHex
        };
        const { error } = await supabase.from('categories').insert([payload]);
        if (error) throw error;
      } else {
        const payload = {
          name: name.trim(),
          icon,
          color_hex: colorHex
        };
        const { error } = await supabase.from('categories').update(payload).eq('id', editingCat.id);
        if (error) throw error;
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
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('expense')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'expense' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Khoản Chi
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'income' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Khoản Thu
            </button>
          </div>

          <div className="space-y-2 mt-4">
            {currentList.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: cat.color_hex + '20', color: cat.color_hex }}>
                    {cat.icon}
                  </div>
                  <span className="font-semibold text-gray-800">{cat.name}</span>
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
                <p className="text-gray-400 text-sm">Chưa có danh mục nào.</p>
              </div>
            )}
          </div>

          <button 
            onClick={handleOpenAdd}
            className="w-full py-4 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-xl mt-4 flex items-center justify-center space-x-2 transition-colors active:scale-95"
          >
            <Plus size={18} />
            <span>Thêm danh mục {activeTab === 'expense' ? 'Chi' : 'Thu'}</span>
          </button>
        </div>
      )}

      {/* --- EDIT / ADD VIEW --- */}
      {editingCat && (
        <form onSubmit={handleSave} className="space-y-6 pb-6 animate-in slide-in-from-right-2">
          
          <button type="button" onClick={() => setEditingCat(null)} className="flex items-center space-x-2 text-gray-500 hover:text-gray-800 transition-colors font-medium text-sm mb-2">
             <ArrowLeft size={16} />
             <span>Quay lại</span>
          </button>

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

          <div>
             <label className="block text-sm font-semibold text-gray-700 mb-2">Tên danh mục</label>
             <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Mua sắm shoppee" className="w-full bg-gray-50 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 outline-none font-medium text-lg"/>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Biểu tượng (Emoji)</label>
                <div className="relative">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl" style={{ pointerEvents: 'none' }}>{icon}</div>
                   <input type="text" value={icon} onChange={e => {
                      // Only keep first character if multiple typed, or regex for emoji
                      const val = e.target.value.trim();
                      if (val) setIcon(Array.from(val)[val.length-1]);
                      else setIcon('');
                   }} className="w-full bg-gray-50 border border-transparent rounded-xl py-3 pl-12 pr-4 outline-none font-medium text-lg text-transparent caret-blue-500" placeholder="Thêm Icon..."/>
                </div>
             </div>
          </div>

          <div>
             <label className="block text-sm font-semibold text-gray-700 mb-3">Màu sắc nhận diện</label>
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

          <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 mt-8 active:scale-95 transition-transform">
            Lưu danh mục
          </button>
        </form>
      )}

    </BottomSheet>
  );
}
