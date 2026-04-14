---
name: "Global Communication Rule"
description: "Quy tắc toàn cục về cách tiếp nhận câu hỏi của người dùng"
---

# Quy tắc cốt lõi (Core Rule)

Khi người dùng đặt câu hỏi (không mang tính chất yêu cầu thực thi hay tạo/cập nhật file), AI **phải ưu tiên trả lời và giải thích** thay vì đưa ra các hành động sửa đổi mã nguồn (edit code) ngay lập tức.

- Nếu người dùng hỏi: "Có thể làm X được không?", "Tính năng này hoạt động như thế nào?" => **Trọng tâm là trả lời, phân tích khả năng và đưa ra hướng giải quyết, để người dùng quyết định tiếp theo.**
- Chỉ edit code khi người dùng xác nhận "Hãy làm X" hoặc yêu cầu rõ ràng việc thực thi thay đổi.

# Quy tắc quy trình (Workflow Rule)

- **Không thực hiện preview (browser preview/subagent)** sau mỗi lần sửa đổi mã nguồn một cách tự động. AI chỉ thực hiện việc preview hoặc kiểm tra giao diện trên trình duyệt khi người dùng yêu cầu cụ thể hoặc khi kết thúc một module lớn cần nghiệm thu.
- Tập trung vào việc hoàn thành cấu trúc code và giải trình thay đổi trước.
# Quy tắc Tối ưu hóa & Tra cứu (Knowledge Rule)

Để tối ưu hóa thời gian và đảm bảo tính nhất quán, AI **mặc định phải luôn kiểm tra thư mục Knowledge Items (KI)** tại `.agents/knowledge/` trước khi thực hiện bất kỳ phân tích sâu hay chỉnh sửa mã nguồn nào.

- **Tra cứu trước khi Research:** Tìm kiếm các KI liên quan đến kiến trúc (`architecture`), bộ màu/UI (`design-system`) hoặc logic nghiệp vụ (`business-logic`) để nắm bắt bối cảnh dự án.
- **Giảm thiểu việc đọc lại:** Sử dụng thông tin từ KI để khoanh vùng file cần xử lý thay vì liệt kê và đọc lại toàn bộ thư mục project mỗi lần nhận yêu cầu.
- **Cập nhật KI MỖI LẦN thay đổi (Bắt buộc):** Sau khi hoàn thành việc sửa lỗi, thêm tính năng hoặc thay đổi quy trình, AI **phải chủ động cập nhật** lại các file KI tương ứng để phản ánh đúng trạng thái mới nhất của mã nguồn. Không đợi người dùng nhắc nhở.
