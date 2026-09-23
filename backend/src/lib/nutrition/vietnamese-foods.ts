type VietnameseFoodSeed = {
  calories: number
  carbs: number
  category: "staple" | "protein" | "veg" | "fruit" | "dish" | "drink" | "other"
  fat: number
  name: string
  /** Shown when the trainee switches food names to English. */
  nameEn: string
  protein: number
  servingLabel: string
  /**
   * What one serving weighs, so a portion can be shown and entered in grams
   * rather than in bowls.
   *
   * Where the label already names a weight this is that number. For prepared
   * dishes it is an estimate of the portion **as served** — a bowl of phở is
   * weighed with its broth, which is why its calories per gram look low. The
   * figure always describes the thing the calories above were measured for:
   * instant noodles are the dry packet, not the bowl after water goes in.
   * These are reference portions, not measured ones; correct them here and
   * every screen follows.
   */
  servingGrams: number
}

const VIETNAMESE_FOODS: VietnameseFoodSeed[] = [
  { category: "staple", name: "Cơm trắng", nameEn: "Steamed white rice", servingLabel: "1 chén · 150g", servingGrams: 150, calories: 195, protein: 4, carbs: 42, fat: 0 },
  { category: "staple", name: "Bún tươi", nameEn: "Fresh rice vermicelli", servingLabel: "100 g", servingGrams: 100, calories: 110, protein: 2, carbs: 25, fat: 0 },
  { category: "staple", name: "Bánh phở", nameEn: "Pho rice noodles", servingLabel: "100 g", servingGrams: 100, calories: 130, protein: 2, carbs: 29, fat: 0 },
  { category: "staple", name: "Bánh mì không", nameEn: "Plain baguette", servingLabel: "1 ổ · 80g", servingGrams: 80, calories: 200, protein: 6, carbs: 42, fat: 1 },
  { category: "staple", name: "Xôi trắng", nameEn: "Plain sticky rice", servingLabel: "1 chén · 150g", servingGrams: 150, calories: 295, protein: 5, carbs: 62, fat: 1 },
  { category: "staple", name: "Miến chín", nameEn: "Cooked glass noodles", servingLabel: "100 g", servingGrams: 100, calories: 90, protein: 0, carbs: 22, fat: 0 },
  { category: "staple", name: "Khoai lang luộc", nameEn: "Boiled sweet potato", servingLabel: "100 g", servingGrams: 100, calories: 119, protein: 1, carbs: 28, fat: 0 },
  { category: "staple", name: "Khoai tây luộc", nameEn: "Boiled potato", servingLabel: "100 g", servingGrams: 100, calories: 87, protein: 2, carbs: 20, fat: 0 },
  { category: "staple", name: "Ngô nếp luộc", nameEn: "Boiled waxy corn", servingLabel: "1 bắp · 130g", servingGrams: 130, calories: 170, protein: 4, carbs: 37, fat: 2 },
  { category: "staple", name: "Yến mạch", nameEn: "Oats", servingLabel: "1 chén · 80g", servingGrams: 80, calories: 300, protein: 11, carbs: 54, fat: 6 },

  { category: "protein", name: "Ức gà (bỏ da)", nameEn: "Chicken breast (skinless)", servingLabel: "100 g", servingGrams: 100, calories: 165, protein: 31, carbs: 0, fat: 4 },
  { category: "protein", name: "Thịt gà ta", nameEn: "Free-range chicken", servingLabel: "100 g", servingGrams: 100, calories: 199, protein: 20, carbs: 0, fat: 13 },
  { category: "protein", name: "Thịt heo nạc", nameEn: "Lean pork", servingLabel: "100 g", servingGrams: 100, calories: 143, protein: 19, carbs: 0, fat: 7 },
  { category: "protein", name: "Thịt ba chỉ", nameEn: "Pork belly", servingLabel: "100 g", servingGrams: 100, calories: 260, protein: 17, carbs: 0, fat: 21 },
  { category: "protein", name: "Thịt bò nạc", nameEn: "Lean beef", servingLabel: "100 g", servingGrams: 100, calories: 143, protein: 21, carbs: 0, fat: 6 },
  { category: "protein", name: "Trứng gà", nameEn: "Chicken eggs", servingLabel: "2 quả · 100g", servingGrams: 100, calories: 166, protein: 15, carbs: 1, fat: 12 },
  { category: "protein", name: "Trứng vịt", nameEn: "Duck egg", servingLabel: "1 quả · 70g", servingGrams: 70, calories: 130, protein: 9, carbs: 1, fat: 10 },
  { category: "protein", name: "Cá thu", nameEn: "Mackerel", servingLabel: "100 g", servingGrams: 100, calories: 166, protein: 19, carbs: 0, fat: 10 },
  { category: "protein", name: "Cá basa", nameEn: "Basa fish", servingLabel: "100 g", servingGrams: 100, calories: 170, protein: 18, carbs: 0, fat: 11 },
  { category: "protein", name: "Cá rô phi", nameEn: "Tilapia", servingLabel: "100 g", servingGrams: 100, calories: 128, protein: 26, carbs: 0, fat: 3 },
  { category: "protein", name: "Tôm sú", nameEn: "Tiger prawns", servingLabel: "100 g", servingGrams: 100, calories: 90, protein: 18, carbs: 0, fat: 2 },
  { category: "protein", name: "Mực", nameEn: "Squid", servingLabel: "100 g", servingGrams: 100, calories: 92, protein: 15, carbs: 3, fat: 1 },
  { category: "protein", name: "Đậu phụ", nameEn: "Tofu", servingLabel: "100 g", servingGrams: 100, calories: 95, protein: 11, carbs: 2, fat: 5 },
  { category: "protein", name: "Chả lụa", nameEn: "Vietnamese pork roll (chả lụa)", servingLabel: "100 g", servingGrams: 100, calories: 240, protein: 14, carbs: 0, fat: 20 },
  { category: "protein", name: "Sữa đậu nành", nameEn: "Soy milk", servingLabel: "1 ly · 200ml", servingGrams: 200, calories: 80, protein: 6, carbs: 8, fat: 4 },
  { category: "protein", name: "Whey protein", nameEn: "Whey protein", servingLabel: "1 muỗng · 30g", servingGrams: 30, calories: 120, protein: 24, carbs: 3, fat: 2 },

  { category: "veg", name: "Rau muống luộc", nameEn: "Boiled water spinach", servingLabel: "100 g", servingGrams: 100, calories: 23, protein: 3, carbs: 2, fat: 0 },
  { category: "veg", name: "Cải ngọt", nameEn: "Choy sum", servingLabel: "100 g", servingGrams: 100, calories: 16, protein: 2, carbs: 2, fat: 0 },
  { category: "veg", name: "Cà chua", nameEn: "Tomato", servingLabel: "100 g", servingGrams: 100, calories: 19, protein: 1, carbs: 4, fat: 0 },
  { category: "veg", name: "Dưa leo", nameEn: "Cucumber", servingLabel: "100 g", servingGrams: 100, calories: 16, protein: 1, carbs: 3, fat: 0 },
  { category: "veg", name: "Cà rốt", nameEn: "Carrot", servingLabel: "100 g", servingGrams: 100, calories: 39, protein: 2, carbs: 8, fat: 0 },
  { category: "veg", name: "Bí đỏ", nameEn: "Pumpkin", servingLabel: "100 g", servingGrams: 100, calories: 27, protein: 0, carbs: 6, fat: 0 },
  { category: "veg", name: "Giá đỗ", nameEn: "Bean sprouts", servingLabel: "100 g", servingGrams: 100, calories: 30, protein: 3, carbs: 4, fat: 0 },
  { category: "veg", name: "Bắp cải", nameEn: "Cabbage", servingLabel: "100 g", servingGrams: 100, calories: 29, protein: 2, carbs: 5, fat: 0 },
  { category: "veg", name: "Súp lơ xanh", nameEn: "Broccoli", servingLabel: "100 g", servingGrams: 100, calories: 30, protein: 3, carbs: 5, fat: 0 },
  { category: "veg", name: "Nấm rơm", nameEn: "Straw mushrooms", servingLabel: "100 g", servingGrams: 100, calories: 31, protein: 4, carbs: 3, fat: 0 },

  { category: "fruit", name: "Chuối", nameEn: "Banana", servingLabel: "1 quả · 100g", servingGrams: 100, calories: 97, protein: 1, carbs: 22, fat: 0 },
  { category: "fruit", name: "Cam", nameEn: "Orange", servingLabel: "1 quả · 150g", servingGrams: 150, calories: 65, protein: 1, carbs: 16, fat: 0 },
  { category: "fruit", name: "Táo", nameEn: "Apple", servingLabel: "1 quả · 150g", servingGrams: 150, calories: 78, protein: 0, carbs: 21, fat: 0 },
  { category: "fruit", name: "Xoài", nameEn: "Mango", servingLabel: "100 g", servingGrams: 100, calories: 60, protein: 1, carbs: 15, fat: 0 },
  { category: "fruit", name: "Đu đủ", nameEn: "Papaya", servingLabel: "100 g", servingGrams: 100, calories: 36, protein: 1, carbs: 8, fat: 0 },
  { category: "fruit", name: "Dưa hấu", nameEn: "Watermelon", servingLabel: "100 g", servingGrams: 100, calories: 25, protein: 1, carbs: 6, fat: 0 },
  { category: "fruit", name: "Thanh long", nameEn: "Dragon fruit", servingLabel: "100 g", servingGrams: 100, calories: 50, protein: 1, carbs: 13, fat: 0 },
  { category: "fruit", name: "Bơ", nameEn: "Avocado", servingLabel: "1/2 quả · 70g", servingGrams: 70, calories: 112, protein: 1, carbs: 6, fat: 10 },
  { category: "fruit", name: "Nho", nameEn: "Grapes", servingLabel: "100 g", servingGrams: 100, calories: 71, protein: 1, carbs: 18, fat: 0 },

  // Dish weights are the portion as served, broth included.
  { category: "dish", name: "Phở bò", nameEn: "Beef pho", servingLabel: "1 tô", servingGrams: 700, calories: 420, protein: 25, carbs: 55, fat: 10 },
  { category: "dish", name: "Bún bò Huế", nameEn: "Hue spicy beef noodle soup", servingLabel: "1 tô", servingGrams: 700, calories: 490, protein: 28, carbs: 56, fat: 15 },
  { category: "dish", name: "Bún chả", nameEn: "Grilled pork with vermicelli (bún chả)", servingLabel: "1 phần", servingGrams: 450, calories: 460, protein: 26, carbs: 50, fat: 18 },
  { category: "dish", name: "Cơm tấm sườn", nameEn: "Broken rice with grilled pork chop", servingLabel: "1 dĩa", servingGrams: 400, calories: 630, protein: 30, carbs: 75, fat: 22 },
  { category: "dish", name: "Bánh mì thịt", nameEn: "Banh mi sandwich", servingLabel: "1 ổ", servingGrams: 200, calories: 460, protein: 20, carbs: 55, fat: 18 },
  { category: "dish", name: "Gỏi cuốn", nameEn: "Fresh spring roll", servingLabel: "1 cuốn", servingGrams: 60, calories: 70, protein: 5, carbs: 10, fat: 1 },
  { category: "dish", name: "Chả giò (nem rán)", nameEn: "Fried spring roll", servingLabel: "1 cái", servingGrams: 40, calories: 120, protein: 4, carbs: 11, fat: 7 },
  { category: "dish", name: "Bánh xèo", nameEn: "Vietnamese sizzling crepe", servingLabel: "1 cái", servingGrams: 150, calories: 350, protein: 12, carbs: 35, fat: 18 },
  { category: "dish", name: "Cháo gà", nameEn: "Chicken rice porridge", servingLabel: "1 tô", servingGrams: 500, calories: 280, protein: 16, carbs: 40, fat: 6 },
  { category: "dish", name: "Hủ tiếu", nameEn: "Hu tieu noodle soup", servingLabel: "1 tô", servingGrams: 600, calories: 400, protein: 22, carbs: 58, fat: 8 },
  // The dry packet, which is what the calories describe.
  { category: "dish", name: "Mì gói", nameEn: "Instant noodles", servingLabel: "1 gói", servingGrams: 75, calories: 350, protein: 8, carbs: 52, fat: 13 },
  { category: "dish", name: "Cơm chiên", nameEn: "Fried rice", servingLabel: "1 dĩa", servingGrams: 350, calories: 560, protein: 15, carbs: 72, fat: 22 },

  // Drinks are counted at 1 ml ≈ 1 g.
  { category: "drink", name: "Cà phê sữa đá", nameEn: "Iced milk coffee", servingLabel: "1 ly", servingGrams: 200, calories: 140, protein: 3, carbs: 20, fat: 5 },
  { category: "drink", name: "Trà sữa trân châu", nameEn: "Bubble milk tea", servingLabel: "1 ly", servingGrams: 500, calories: 320, protein: 5, carbs: 55, fat: 9 },
  { category: "drink", name: "Nước mía", nameEn: "Sugarcane juice", servingLabel: "1 ly", servingGrams: 400, calories: 240, protein: 0, carbs: 60, fat: 0 },
  { category: "drink", name: "Nước ngọt", nameEn: "Soft drink", servingLabel: "1 lon · 330ml", servingGrams: 330, calories: 140, protein: 0, carbs: 39, fat: 0 },
  { category: "drink", name: "Bia", nameEn: "Beer", servingLabel: "1 lon · 330ml", servingGrams: 330, calories: 150, protein: 2, carbs: 13, fat: 0 },
  { category: "drink", name: "Nước cam ép", nameEn: "Orange juice", servingLabel: "1 ly", servingGrams: 250, calories: 110, protein: 2, carbs: 26, fat: 1 },

  { category: "other", name: "Lạc rang", nameEn: "Roasted peanuts", servingLabel: "30 g", servingGrams: 30, calories: 170, protein: 7, carbs: 5, fat: 14 },
  { category: "other", name: "Hạt điều", nameEn: "Cashews", servingLabel: "30 g", servingGrams: 30, calories: 175, protein: 5, carbs: 9, fat: 14 },
  { category: "other", name: "Dầu ăn", nameEn: "Cooking oil", servingLabel: "1 thìa", servingGrams: 14, calories: 120, protein: 0, carbs: 0, fat: 14 },
  { category: "other", name: "Sữa tươi", nameEn: "Fresh milk", servingLabel: "1 ly · 200ml", servingGrams: 200, calories: 130, protein: 7, carbs: 10, fat: 7 },
  { category: "other", name: "Sữa chua", nameEn: "Yogurt", servingLabel: "1 hộp · 100g", servingGrams: 100, calories: 100, protein: 4, carbs: 16, fat: 3 },
]

export type { VietnameseFoodSeed }
export { VIETNAMESE_FOODS }
