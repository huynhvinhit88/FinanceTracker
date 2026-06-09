import { useEffect, useRef } from 'react';

/**
 * Tên event toàn cục được phát mỗi khi dữ liệu giao dịch thay đổi
 * (ví dụ: thêm giao dịch từ FAB toàn cục). Các page lắng nghe event này
 * để tự fetch lại dữ liệu mà không cần điều hướng lại.
 */
export const DATA_CHANGED_EVENT = 'ft:data-changed';

/** Phát event báo dữ liệu đã thay đổi để các page đang mở refresh. */
export function emitDataChanged() {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

/**
 * Đăng ký callback để chạy lại mỗi khi có event `ft:data-changed`.
 * Dùng ref để giữ subscription ổn định, tránh re-subscribe mỗi lần render.
 */
export function useGlobalRefresh(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = () => callbackRef.current?.();
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, []);
}
