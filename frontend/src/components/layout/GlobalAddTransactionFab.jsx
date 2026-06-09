import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { AddTransactionSheet } from '../transactions/AddTransactionSheet';
import { emitDataChanged } from '../../hooks/useGlobalRefresh';

/**
 * Nút "+" thêm giao dịch dạng FAB (Floating Action Button) toàn cục.
 * Hiển thị cố định ở mọi trang. Khi thêm giao dịch thành công sẽ phát
 * event `ft:data-changed` để các trang đang mở tự fetch lại dữ liệu.
 *
 * Vị trí: mobile đặt cao hơn Bottom Tab Bar (bottom-24); desktop hạ thấp
 * (lg:bottom-8) vì không có thanh tab dưới.
 */
export function GlobalAddTransactionFab() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Thêm giao dịch"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 lg:bottom-8 right-6 w-14 h-14 bg-gray-900 dark:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-gray-400/50 dark:shadow-indigo-500/40 active:scale-95 transition-all z-40"
      >
        <Plus size={28} />
      </button>

      <AddTransactionSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          emitDataChanged();
        }}
      />
    </>
  );
}
