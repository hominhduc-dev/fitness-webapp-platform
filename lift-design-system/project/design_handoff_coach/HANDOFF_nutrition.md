# Handoff: Trang Nutrition / Meals

## TL;DR
Route `app/(shell)/meals/` **đã tồn tại và chạy thật** trong repo. Module này có đầy đủ fetch, log, delete, history, weekly chart. Việc cần làm là **Lift polish** (bỏ `rounded-xl`/`font-bold`/gradient macro cards) + nâng thêm UX gram-input và quick-add từ prototype.

---

## 1. Food data — fetch link thật

### Tìm kiếm món ăn
```
POST /api/foods/search          (proxy backend của bạn)
     → calls USDA FoodData Central API
     → https://api.nal.usda.gov/fdc/v1/foods/search
```
Trong code gọi qua:
```ts
import { searchFoods } from "@/lib/fitness/api"
const response = await searchFoods(session.access_token, query)
// response: FoodSearchResult[] { fdcId, name, nutritionPreview{kcal,protein,carbs,fat...} }
```
`fdcId` là ID của **USDA FoodData Central** — dùng để log bữa ăn. Mỗi kết quả có `nutritionPreview` per 100g, và flag `canLogByGram` (nếu false → không thể log theo gram, nên ẩn).

### Xem thêm về FDC
- **Trang chủ:** https://fdc.nal.usda.gov
- **API docs:** https://fdc.nal.usda.gov/api-guide.html
- **Dữ liệu Việt:** FDC chủ yếu là thực phẩm Mỹ. Với món Việt, backend của bạn nên seed thêm từ **Bảng thành phần thực phẩm Việt Nam** (Viện Dinh dưỡng — file prototype `NutritionScreen.jsx` có đủ ~70 món chuẩn để seed).

### Log bữa ăn
```ts
import { logMeal } from "@/lib/fitness/api"
const meal = await logMeal(session.access_token, {
  fdcId: selectedFood.fdcId,     // USDA FDC ID
  mealType: "breakfast",         // "breakfast" | "lunch" | "dinner" | "snack"
  weightGrams: 250,              // gram thật user nhập
})
```

### Xoá bữa ăn
```ts
import { deleteMeal } from "@/lib/fitness/api"
await deleteMeal(session.access_token, mealId)
```

### Load ngày
```ts
import { fetchMeals } from "@/lib/fitness/api"
const data = await fetchMeals(accessToken, "2026-06-03")
// data: { meals: Meal[], dailyNutrition: { targetCalories }, weeklyCalories[] }
```

### Lịch sử (recent foods)
```ts
import { fetchMealHistory } from "@/lib/fitness/api"
const history = await fetchMealHistory(accessToken, { limit: 12, cursor? })
// dùng để rút ra "recently eaten" (theo fdcId unique)
```

---

## 2. Data model thật

```ts
// @/lib/types
type Meal = {
  id: string
  type: "breakfast" | "lunch" | "dinner" | "snack"
  name: string
  calories: number
  protein?: number    // gram
  carbs?: number      // gram
  fat?: number        // gram
  fiber?: number      // gram
  sodium?: number     // mg
  sugar?: number      // gram
  weightGrams?: number
  fdcId?: number
  loggedAt?: Date
}

// @/lib/fitness/types
type FoodSearchResult = {
  fdcId: number
  name: string
  brandOwner?: string
  dataType?: string
  canLogByGram?: boolean        // false → disabled
  logWarning?: string
  nutritionPreview?: {          // per 100g
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
    fiber?: number
    sugar?: number
    sodium?: number
  }
}
```

---

## 3. Cấu trúc hiện tại

| File | Vai trò | Trạng thái Lift |
|---|---|---|
| `app/(shell)/meals/page.tsx` | Server component, fetch + seed | ✅ OK |
| `components/meals/meals-client.tsx` | Client shell: date nav, tổng kcal/macro, layout | ⚠️ Cần polish |
| `components/meals/log-food-dialog.tsx` | Dialog tìm + log món ăn | ⚠️ Cần polish |
| `components/meals/meal-type-list.tsx` | Danh sách theo bữa (breakfast/lunch/dinner/snack) | ⚠️ Cần polish |
| `components/meals/meal-history-list.tsx` | Danh sách lịch sử | ✅ Khá ổn |
| `components/meals/weekly-calories-chart.tsx` | Biểu đồ cột theo tuần | ⚠️ Kiểm tra gradient |

---

## 4. Lift polish — danh sách thay đổi cụ thể

### `meals-client.tsx`

| Chỗ cần sửa | Hiện tại | Lift spec |
|---|---|---|
| Card calo chính | `rounded-xl border` | `rounded-[10px] border border-border` |
| Header số calo | `text-3xl font-bold` | `font-semibold tracking-[-0.02em]` + `font-mono tnum` |
| Icon Flame trong vòng tròn | Flame icon trong `bg-primary-soft` circle | Bỏ icon vòng tròn → dùng calorie ring SVG như prototype (arc progress) |
| Macro cards | `bg-info/10 text-info`, `bg-warn-soft text-warning`, `bg-accent/10 text-accent` | `bg-muted rounded-md` + `font-mono tnum`, màu text = `--foreground` (không color-code per macro) hoặc chỉ dùng `--primary` cho protein |
| Section header bữa ăn | `text-lg font-semibold` (OK) | Thêm `.label-micro` cho sub-labels |
| Weekly chart | Kiểm tra recharts có gradient fill không | Bars = `--primary` flat, track = `--muted`, không gradient |

### `log-food-dialog.tsx`

| Chỗ cần sửa | Hiện tại | Lift spec |
|---|---|---|
| Border radius dialog | shadcn default `DialogContent` (14px) | Giữ shadcn — đã đủ |
| Search result cards | `rounded-lg border` | `rounded-[8px] border border-border` hover `border-primary/30` |
| Selected state | `border-primary bg-primary-soft` | OK — đúng Lift |
| Nutrition preview | `bg-muted/40 rounded-md` | `bg-muted rounded-md` (bỏ opacity trick) |
| Macro pills per nutrient | `bg-background` | `bg-card border border-border rounded-md` |
| Weight input | `Input` chuẩn | Thêm nút −10/+10g bên cạnh (xem pattern gram-input trong prototype) |
| Recent foods | Badge `outline` cho meal type | Dùng `.label-micro` text thay badge |

### `meal-type-list.tsx`
- Đọc và audit — bỏ `shadow-*` nếu có, `rounded-xl` → `rounded-[10px]`.

---

## 5. Tính năng trong prototype CHƯA có trong repo (thêm nếu cần)

| Tính năng | File prototype | Ghi chú |
|---|---|---|
| Calorie ring (arc SVG) | `NutritionScreen.jsx → CalorieRing` | Thay thế Flame icon + Progress bar |
| Nhập gram với nút ±10 | `NutritionScreen.jsx → AddFoodModal` | UX tốt hơn cho mobile |
| Macro split % (pie-like bars) | `NutritionScreen.jsx → tỷ lệ macro` | Supplement cho 3 macro cards |
| Water tracker | `NutritionScreen.jsx → WaterTracker` | Mới hoàn toàn — cần endpoint `logWater` |
| Tạo món custom | `NutritionScreen.jsx → CreateFoodForm` | Cần endpoint tạo food entry riêng |

---

## 6. Cách áp dụng

```bash
# 1. Xem prototype chạy được để tham chiếu UX
open ui_kits/web/index.html   # tab Nutrition

# 2. Polish meals-client.tsx
# Thay rounded-xl → rounded-[10px], font-bold → font-semibold
# Đổi macro cards về bg-muted (bỏ màu per-macro)
# Thêm CalorieRing thay Flame icon

# 3. Polish log-food-dialog.tsx
# Thêm nút ±10g bên input weight
# Đổi recent food badge → label-micro text
# Bỏ bg opacity trick

# 4. Verify
npm run build
```

---

## 7. API endpoint thật (tổng hợp)

| Action | Hàm | Mô tả |
|---|---|---|
| Tìm món ăn | `searchFoods(token, query)` | Proxy → USDA FDC |
| Log bữa ăn | `logMeal(token, {fdcId, mealType, weightGrams})` | Lưu vào DB |
| Xoá bữa ăn | `deleteMeal(token, mealId)` | |
| Load ngày | `fetchMeals(token, "YYYY-MM-DD")` | `MealCollection` |
| Lịch sử | `fetchMealHistory(token, {limit, cursor?})` | Dùng cho recent foods |

Tất cả dùng `session.access_token` từ `useAuth()` — pattern giống `pending-requests-panel.tsx`.

---

## 8. Tham chiếu thiết kế

Mở `ui_kits/web/index.html` → tab **Nutrition** để xem:
- Calorie ring + macro bars
- Bữa ăn theo nhóm với gram input
- Modal tìm kiếm + tạo món mới
- Water tracker + macro split %

File prototype: `ui_kits/web/NutritionScreen.jsx`
