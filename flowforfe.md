# Tài liệu API AHP cho Frontend

> **Base URL:** `http://127.0.0.1:8000`  
> **Phương thức:** Tất cả các endpoint đều dùng `POST`  
> **Content-Type:** `application/json`

---

## Quy trình gọi API (theo thứ tự)

```
Nhập ma trận
    ↓
[Bước 1] POST /ahp/step/column-sum   → Lấy column_sums
    ↓
[Bước 2] POST /ahp/step/normalize    → Lấy normalized_matrix
    ↓
[Bước 3] POST /ahp/step/weights      → Lấy weights
    ↓
[Bước 4] POST /ahp/step/consistency  → Kiểm tra CR
    ↓
[Bước 5] POST /ahp/rank              → Xếp hạng phương án
```

> Output của bước trước được dùng làm input cho bước sau.

---

## Bước 1 — Tính tổng cột (Validate + Column Sum)

**URL:** `POST /ahp/step/column-sum`

**Input:**
```json
{
  "matrix": [
    [1, 3, 5],
    [0.333, 1, 2],
    [0.2, 0.5, 1]
  ]
}
```

**Output:**
```json
{
  "column_sums": [1.533, 4.5, 8]
}
```

**Lỗi có thể xảy ra:**
| Mã lỗi | Mô tả |
|--------|-------|
| `400` | Ma trận không vuông hoặc có giá trị ≤ 0 |

---

## Bước 2 — Chuẩn hóa ma trận

**URL:** `POST /ahp/step/normalize`

**Input:** *(Dùng lại `matrix` gốc + `column_sums` từ Bước 1)*
```json
{
  "matrix": [
    [1, 3, 5],
    [0.333, 1, 2],
    [0.2, 0.5, 1]
  ],
  "column_sums": [1.533, 4.5, 8]
}
```

**Output:**
```json
{
  "normalized_matrix": [
    [0.652, 0.667, 0.625],
    [0.217, 0.222, 0.25],
    [0.13, 0.111, 0.125]
  ]
}
```

**Lỗi có thể xảy ra:**
| Mã lỗi | Mô tả |
|--------|-------|
| `400` | Tổng cột bằng 0 (lỗi chia cho 0) |

---

## Bước 3 — Tính trọng số (Priority Vector)

**URL:** `POST /ahp/step/weights`

**Input:** *(Dùng `normalized_matrix` từ Bước 2)*
```json
{
  "normalized_matrix": [
    [0.652, 0.667, 0.625],
    [0.217, 0.222, 0.25],
    [0.13, 0.111, 0.125]
  ]
}
```

**Output:**
```json
{
  "weights": [0.648, 0.23, 0.122]
}
```

---

## Bước 4 — Kiểm tra độ nhất quán (Consistency)

**URL:** `POST /ahp/step/consistency`

**Input:** *(Dùng lại `matrix` gốc + `weights` từ Bước 3)*
```json
{
  "matrix": [
    [1, 3, 5],
    [0.333, 1, 2],
    [0.2, 0.5, 1]
  ],
  "weights": [0.648, 0.23, 0.122]
}
```

**Output:**
```json
{
  "lambda_max": 3.0036,
  "CI": 0.0018,
  "CR": 0.0031,
  "is_consistent": true
}
```

> ⚠️ **Quan trọng:** Nếu `is_consistent = false` (CR ≥ 0.1), yêu cầu người dùng nhập lại ma trận. Không được tiếp tục sang Bước 5.

---

## Bước 5 — Xếp hạng phương án

**URL:** `POST /ahp/rank`

**Input:** *(Dùng `weights` từ Bước 3)*
```json
{
  "criteria_weights": [0.648, 0.23, 0.122],
  "alternative_scores": [
    [0.7, 0.2, 0.1],
    [0.5, 0.3, 0.2],
    [0.2, 0.3, 0.5]
  ],
  "names": ["Samsung A55", "Samsung A35", "Samsung A15"]
}
```

> **Lưu ý:** `names` là tùy chọn. Nếu không truyền, hệ thống tự tạo tên "Phương án 1", "Phương án 2", ...

**Output:** *(Đã sắp xếp giảm dần theo điểm)*
```json
{
  "ranking": [
    { "name": "Samsung A55", "score": 0.5006 },
    { "name": "Samsung A35", "score": 0.415 },
    { "name": "Samsung A15", "score": 0.2296 }
  ]
}
```

**Lỗi có thể xảy ra:**
| Mã lỗi | Mô tả |
|--------|-------|
| `400` | Số tiêu chí của phương án không khớp với số trọng số |

---

## Thêm: Endpoint kiểm tra kết nối

**URL:** `GET /api/test-db`  
Dùng để kiểm tra kết nối server và database còn sống không.

**Output thành công:**
```json
{
  "status": "success",
  "message": "Kết nối Database thành công!",
  "table_name": "samsung_phones",
  "row_count": 0
}
```

---

## Ghi chú cho Frontend

- Tất cả request gửi dưới dạng **JSON body**, không phải form-data.
- Slug đường dẫn không có `/api/` prefix — chỉ có `/ahp/`.
- Xem tài liệu Swagger tương tác tại: **http://127.0.0.1:8000/docs**
