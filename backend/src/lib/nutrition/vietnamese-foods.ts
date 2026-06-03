type VietnameseFoodSeed = {
  calories: number
  carbs: number
  category: "staple" | "protein" | "veg" | "fruit" | "dish" | "drink" | "other"
  fat: number
  name: string
  protein: number
  servingLabel: string
}

const VIETNAMESE_FOODS: VietnameseFoodSeed[] = [
  { category: "staple", name: "Cơm trắng", servingLabel: "1 chén · 150g", calories: 195, protein: 4, carbs: 42, fat: 0 },
  { category: "staple", name: "Bún tươi", servingLabel: "100 g", calories: 110, protein: 2, carbs: 25, fat: 0 },
  { category: "staple", name: "Bánh phở", servingLabel: "100 g", calories: 130, protein: 2, carbs: 29, fat: 0 },
  { category: "staple", name: "Bánh mì không", servingLabel: "1 ổ · 80g", calories: 200, protein: 6, carbs: 42, fat: 1 },
  { category: "staple", name: "Xôi trắng", servingLabel: "1 chén · 150g", calories: 295, protein: 5, carbs: 62, fat: 1 },
  { category: "staple", name: "Miến chín", servingLabel: "100 g", calories: 90, protein: 0, carbs: 22, fat: 0 },
  { category: "staple", name: "Khoai lang luộc", servingLabel: "100 g", calories: 119, protein: 1, carbs: 28, fat: 0 },
  { category: "staple", name: "Khoai tây luộc", servingLabel: "100 g", calories: 87, protein: 2, carbs: 20, fat: 0 },
  { category: "staple", name: "Ngô nếp luộc", servingLabel: "1 bắp · 130g", calories: 170, protein: 4, carbs: 37, fat: 2 },
  { category: "staple", name: "Yến mạch", servingLabel: "1 chén · 80g", calories: 300, protein: 11, carbs: 54, fat: 6 },

  { category: "protein", name: "Ức gà (bỏ da)", servingLabel: "100 g", calories: 165, protein: 31, carbs: 0, fat: 4 },
  { category: "protein", name: "Thịt gà ta", servingLabel: "100 g", calories: 199, protein: 20, carbs: 0, fat: 13 },
  { category: "protein", name: "Thịt heo nạc", servingLabel: "100 g", calories: 143, protein: 19, carbs: 0, fat: 7 },
  { category: "protein", name: "Thịt ba chỉ", servingLabel: "100 g", calories: 260, protein: 17, carbs: 0, fat: 21 },
  { category: "protein", name: "Thịt bò nạc", servingLabel: "100 g", calories: 143, protein: 21, carbs: 0, fat: 6 },
  { category: "protein", name: "Trứng gà", servingLabel: "2 quả · 100g", calories: 166, protein: 15, carbs: 1, fat: 12 },
  { category: "protein", name: "Trứng vịt", servingLabel: "1 quả · 70g", calories: 130, protein: 9, carbs: 1, fat: 10 },
  { category: "protein", name: "Cá thu", servingLabel: "100 g", calories: 166, protein: 19, carbs: 0, fat: 10 },
  { category: "protein", name: "Cá basa", servingLabel: "100 g", calories: 170, protein: 18, carbs: 0, fat: 11 },
  { category: "protein", name: "Cá rô phi", servingLabel: "100 g", calories: 128, protein: 26, carbs: 0, fat: 3 },
  { category: "protein", name: "Tôm sú", servingLabel: "100 g", calories: 90, protein: 18, carbs: 0, fat: 2 },
  { category: "protein", name: "Mực", servingLabel: "100 g", calories: 92, protein: 15, carbs: 3, fat: 1 },
  { category: "protein", name: "Đậu phụ", servingLabel: "100 g", calories: 95, protein: 11, carbs: 2, fat: 5 },
  { category: "protein", name: "Chả lụa", servingLabel: "100 g", calories: 240, protein: 14, carbs: 0, fat: 20 },
  { category: "protein", name: "Sữa đậu nành", servingLabel: "1 ly · 200ml", calories: 80, protein: 6, carbs: 8, fat: 4 },
  { category: "protein", name: "Whey protein", servingLabel: "1 muỗng · 30g", calories: 120, protein: 24, carbs: 3, fat: 2 },

  { category: "veg", name: "Rau muống luộc", servingLabel: "100 g", calories: 23, protein: 3, carbs: 2, fat: 0 },
  { category: "veg", name: "Cải ngọt", servingLabel: "100 g", calories: 16, protein: 2, carbs: 2, fat: 0 },
  { category: "veg", name: "Cà chua", servingLabel: "100 g", calories: 19, protein: 1, carbs: 4, fat: 0 },
  { category: "veg", name: "Dưa leo", servingLabel: "100 g", calories: 16, protein: 1, carbs: 3, fat: 0 },
  { category: "veg", name: "Cà rốt", servingLabel: "100 g", calories: 39, protein: 2, carbs: 8, fat: 0 },
  { category: "veg", name: "Bí đỏ", servingLabel: "100 g", calories: 27, protein: 0, carbs: 6, fat: 0 },
  { category: "veg", name: "Giá đỗ", servingLabel: "100 g", calories: 30, protein: 3, carbs: 4, fat: 0 },
  { category: "veg", name: "Bắp cải", servingLabel: "100 g", calories: 29, protein: 2, carbs: 5, fat: 0 },
  { category: "veg", name: "Súp lơ xanh", servingLabel: "100 g", calories: 30, protein: 3, carbs: 5, fat: 0 },
  { category: "veg", name: "Nấm rơm", servingLabel: "100 g", calories: 31, protein: 4, carbs: 3, fat: 0 },

  { category: "fruit", name: "Chuối", servingLabel: "1 quả · 100g", calories: 97, protein: 1, carbs: 22, fat: 0 },
  { category: "fruit", name: "Cam", servingLabel: "1 quả · 150g", calories: 65, protein: 1, carbs: 16, fat: 0 },
  { category: "fruit", name: "Táo", servingLabel: "1 quả · 150g", calories: 78, protein: 0, carbs: 21, fat: 0 },
  { category: "fruit", name: "Xoài", servingLabel: "100 g", calories: 60, protein: 1, carbs: 15, fat: 0 },
  { category: "fruit", name: "Đu đủ", servingLabel: "100 g", calories: 36, protein: 1, carbs: 8, fat: 0 },
  { category: "fruit", name: "Dưa hấu", servingLabel: "100 g", calories: 25, protein: 1, carbs: 6, fat: 0 },
  { category: "fruit", name: "Thanh long", servingLabel: "100 g", calories: 50, protein: 1, carbs: 13, fat: 0 },
  { category: "fruit", name: "Bơ", servingLabel: "1/2 quả · 70g", calories: 112, protein: 1, carbs: 6, fat: 10 },
  { category: "fruit", name: "Nho", servingLabel: "100 g", calories: 71, protein: 1, carbs: 18, fat: 0 },

  { category: "dish", name: "Phở bò", servingLabel: "1 tô", calories: 420, protein: 25, carbs: 55, fat: 10 },
  { category: "dish", name: "Bún bò Huế", servingLabel: "1 tô", calories: 490, protein: 28, carbs: 56, fat: 15 },
  { category: "dish", name: "Bún chả", servingLabel: "1 phần", calories: 460, protein: 26, carbs: 50, fat: 18 },
  { category: "dish", name: "Cơm tấm sườn", servingLabel: "1 dĩa", calories: 630, protein: 30, carbs: 75, fat: 22 },
  { category: "dish", name: "Bánh mì thịt", servingLabel: "1 ổ", calories: 460, protein: 20, carbs: 55, fat: 18 },
  { category: "dish", name: "Gỏi cuốn", servingLabel: "1 cuốn", calories: 70, protein: 5, carbs: 10, fat: 1 },
  { category: "dish", name: "Chả giò (nem rán)", servingLabel: "1 cái", calories: 120, protein: 4, carbs: 11, fat: 7 },
  { category: "dish", name: "Bánh xèo", servingLabel: "1 cái", calories: 350, protein: 12, carbs: 35, fat: 18 },
  { category: "dish", name: "Cháo gà", servingLabel: "1 tô", calories: 280, protein: 16, carbs: 40, fat: 6 },
  { category: "dish", name: "Hủ tiếu", servingLabel: "1 tô", calories: 400, protein: 22, carbs: 58, fat: 8 },
  { category: "dish", name: "Mì gói", servingLabel: "1 gói", calories: 350, protein: 8, carbs: 52, fat: 13 },
  { category: "dish", name: "Cơm chiên", servingLabel: "1 dĩa", calories: 560, protein: 15, carbs: 72, fat: 22 },

  { category: "drink", name: "Cà phê sữa đá", servingLabel: "1 ly", calories: 140, protein: 3, carbs: 20, fat: 5 },
  { category: "drink", name: "Trà sữa trân châu", servingLabel: "1 ly", calories: 320, protein: 5, carbs: 55, fat: 9 },
  { category: "drink", name: "Nước mía", servingLabel: "1 ly", calories: 240, protein: 0, carbs: 60, fat: 0 },
  { category: "drink", name: "Nước ngọt", servingLabel: "1 lon · 330ml", calories: 140, protein: 0, carbs: 39, fat: 0 },
  { category: "drink", name: "Bia", servingLabel: "1 lon · 330ml", calories: 150, protein: 2, carbs: 13, fat: 0 },
  { category: "drink", name: "Nước cam ép", servingLabel: "1 ly", calories: 110, protein: 2, carbs: 26, fat: 1 },

  { category: "other", name: "Lạc rang", servingLabel: "30 g", calories: 170, protein: 7, carbs: 5, fat: 14 },
  { category: "other", name: "Hạt điều", servingLabel: "30 g", calories: 175, protein: 5, carbs: 9, fat: 14 },
  { category: "other", name: "Dầu ăn", servingLabel: "1 thìa", calories: 120, protein: 0, carbs: 0, fat: 14 },
  { category: "other", name: "Sữa tươi", servingLabel: "1 ly · 200ml", calories: 130, protein: 7, carbs: 10, fat: 7 },
  { category: "other", name: "Sữa chua", servingLabel: "1 hộp · 100g", calories: 100, protein: 4, carbs: 16, fat: 3 },
]

export type { VietnameseFoodSeed }
export { VIETNAMESE_FOODS }
