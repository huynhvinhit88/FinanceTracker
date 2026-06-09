import { supabase } from './supabaseClient';
import { db } from './db';

// Cờ chống chạy đồng thời (getInitialSession + onAuthStateChange có thể gọi song song).
let autoRenewInProgress = false;

/**
 * Tự động tái tục các sổ tiết kiệm đã quá ngày đáo hạn và bật cờ `auto_renew`.
 *
 * Vì app chạy thuần client (không có server chạy nền), việc tái tục được xử lý theo kiểu
 * "tự quét khi mở app": mỗi lần khởi tạo phiên, hàm này rà các sổ active có auto_renew và
 * maturity_date <= hôm nay, rồi:
 *   1. Lặp qua từng kỳ ĐÃ đáo hạn (xử lý cả trường hợp quá hạn nhiều kỳ liên tiếp), mỗi kỳ
 *      tính lãi dự kiến theo công thức gốc × lãi suất × (kỳ hạn / 12).
 *      - auto_renew_compound = true  → cộng lãi vào gốc sổ mới (lãi kép).
 *      - auto_renew_compound = false → cộng dồn lãi để trả về tài khoản nguồn (giao dịch Thu nhập).
 *   2. Đánh dấu sổ cũ `status: 'settled'`.
 *   3. Mở sổ mới `active` (cùng lãi suất/kỳ hạn, giữ cờ auto_renew), ngày bắt đầu = ngày đáo
 *      hạn của kỳ hiệu lực hiện tại, tên gắn hậu tố "(Tái tục)".
 *
 * @returns {Promise<number>} số sổ đã được tái tục.
 */
export async function processAutoRenewals() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return 0;

  if (autoRenewInProgress) return 0;
  autoRenewInProgress = true;

  let renewedCount = 0;
  try {
    const all = await db.savings.toArray();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const candidates = all.filter(s =>
      s.status === 'active' && s.auto_renew && s.maturity_date &&
      new Date(s.maturity_date) <= today
    );
    if (candidates.length === 0) return 0;

    // Danh mục Thu nhập để ghi nhận lãi khi tái tục "chỉ gốc".
    const incomeCats = await db.categories.filter(c => c.type === 'income').toArray();
    const interestCat = incomeCats.find(c => c.name.toLowerCase().includes('lãi'));
    const interestCatId = interestCat?.id || incomeCats[0]?.id || null;

    for (const sav of candidates) {
      const termMonths = parseInt(sav.term_months) || 0;
      if (termMonths <= 0) continue; // tránh vòng lặp vô hạn nếu dữ liệu lỗi

      const rate = Number(sav.interest_rate) || 0;
      const compound = !!sav.auto_renew_compound;
      let principal = Number(sav.principal_amount) || 0;
      let totalInterestCash = 0; // lãi cần trả về tài khoản (mode chỉ gốc)

      // Kỳ gốc đáo hạn tại maturity_date (đã <= today). Mỗi vòng lặp xử lý 1 kỳ đã đáo hạn.
      let cycleMaturity = new Date(sav.maturity_date);
      let cycleStart = new Date(sav.maturity_date);
      let guard = 0;
      while (cycleMaturity <= today && guard < 600) {
        const interest = Math.round(principal * (rate / 100) * (termMonths / 12));
        if (compound) principal += interest;
        else totalInterestCash += interest;

        cycleStart = new Date(cycleMaturity);
        cycleMaturity = new Date(cycleMaturity);
        cycleMaturity.setMonth(cycleMaturity.getMonth() + termMonths);
        guard++;
      }
      // Sau vòng lặp: cycleStart..cycleMaturity là kỳ đang hiệu lực (cycleMaturity > today).

      const toISODate = (d) => d.toISOString().split('T')[0];

      // 1. Trả lãi về tài khoản nguồn (mode chỉ gốc)
      if (!compound && totalInterestCash > 0 && sav.account_id) {
        const account = await db.accounts.get(sav.account_id);
        if (account) {
          await db.accounts.update(sav.account_id, {
            balance: (Number(account.balance) || 0) + totalInterestCash
          });
          await db.transactions.add({
            id: crypto.randomUUID(),
            account_id: sav.account_id,
            category_id: interestCatId,
            amount: totalInterestCash,
            date: new Date().toISOString(),
            type: 'income',
            note: `Lãi tái tục tự động: ${sav.name}`
          });
        }
      }

      // 2. Đánh dấu sổ cũ đã tất toán
      await db.savings.update(sav.id, { status: 'settled' });

      // 3. Mở sổ mới
      const newName = sav.name.includes('(Tái tục)') ? sav.name : `${sav.name} (Tái tục)`;
      await db.savings.add({
        id: crypto.randomUUID(),
        account_id: sav.account_id,
        category_id: sav.category_id || null,
        name: newName,
        principal_amount: principal,
        interest_rate: sav.interest_rate,
        term_months: termMonths,
        start_date: toISODate(cycleStart),
        maturity_date: toISODate(cycleMaturity),
        status: 'active',
        auto_renew: true,
        auto_renew_compound: compound
      });

      renewedCount++;
    }
  } catch (err) {
    console.error('Tái tục tự động sổ tiết kiệm thất bại:', err);
  } finally {
    autoRenewInProgress = false;
  }
  return renewedCount;
}
