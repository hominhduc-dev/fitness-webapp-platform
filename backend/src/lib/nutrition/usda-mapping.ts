/**
 * Which USDA FoodData Central (SR Legacy) entry each library ingredient takes
 * its micronutrients from, keyed by the Vietnamese name in `vietnamese-foods.ts`.
 *
 * `description` is USDA's exact description; the import script resolves it to
 * an fdcId and refuses anything that is not an exact match, so a typo here
 * shows up as an error rather than as the wrong food's numbers.
 *
 * The state matters as much as the food: boiled sweet potato and raw sweet
 * potato differ, so each entry names the form the library's serving is eaten
 * in. `note` records where the closest USDA entry is not the same thing.
 *
 * Anything not listed here is a prepared dish or a food USDA does not carry;
 * those are estimated from a standard recipe instead (see
 * `scripts/estimate-dish-nutrients.ts`).
 */
type UsdaMapping = { description: string; note?: string }

const USDA_MAPPING: Record<string, UsdaMapping> = {
  // Staples
  "Cơm trắng": { description: "Rice, white, long-grain, regular, enriched, cooked" },
  "Bún tươi": { description: "Rice noodles, cooked" },
  "Bánh phở": { description: "Rice noodles, cooked" },
  "Bánh mì không": { description: "Bread, french or vienna (includes sourdough)" },
  "Xôi trắng": { description: "Rice, white, glutinous, cooked" },
  "Khoai lang luộc": { description: "Sweet potato, cooked, boiled, without skin" },
  "Khoai tây luộc": { description: "Potatoes, boiled, cooked without skin, flesh, without salt" },
  "Ngô nếp luộc": {
    description: "Corn, sweet, yellow, cooked, boiled, drained, without salt",
    note: "USDA has no waxy corn; sweet corn is the closest cooked cob.",
  },
  "Yến mạch": { description: "Cereals, oats, regular and quick, not fortified, dry" },

  // Protein
  "Ức gà (bỏ da)": { description: "Chicken, broilers or fryers, breast, meat only, cooked, roasted" },
  "Thịt gà ta": {
    description: "Chicken, broilers or fryers, meat and skin, cooked, roasted",
    note: "Free-range chicken is leaner than broilers; minerals are close.",
  },
  "Thịt heo nạc": { description: "Pork, fresh, loin, whole, separable lean only, raw" },
  "Thịt ba chỉ": { description: "Pork, fresh, belly, raw" },
  "Thịt bò nạc": { description: "Beef, round, top round, separable lean only, trimmed to 0\" fat, select, raw" },
  "Trứng gà": { description: "Egg, whole, raw, fresh" },
  "Trứng vịt": { description: "Egg, duck, whole, fresh, raw" },
  "Cá thu": { description: "Fish, mackerel, spanish, raw", note: "Cá thu is Spanish (king) mackerel." },
  "Cá basa": {
    description: "Fish, catfish, channel, farmed, raw",
    note: "Basa (Pangasius) is not in USDA; farmed catfish is the closest.",
  },
  "Cá rô phi": { description: "Fish, tilapia, raw" },
  "Tôm sú": { description: "Crustaceans, shrimp, raw (not previously frozen)" },
  "Mực": { description: "Mollusks, squid, mixed species, raw" },
  "Đậu phụ": {
    description: "Tofu, raw, regular, prepared with calcium sulfate",
    note: "Vietnamese tofu is set with gypsum (calcium sulfate), which is why its calcium is high.",
  },
  "Sữa đậu nành": { description: "Soymilk, original and vanilla, unfortified" },
  "Whey protein": { description: "Beverages, Protein powder whey based" },

  // Vegetables
  "Rau muống luộc": {
    description: "Swamp cabbage, (skunk cabbage), cooked, boiled, drained, without salt",
    note: "USDA's swamp cabbage is water spinach (Ipomoea aquatica).",
  },
  "Cải ngọt": { description: "Cabbage, chinese (pak-choi), raw", note: "Choy sum is closest to pak-choi." },
  "Cà chua": { description: "Tomatoes, red, ripe, raw, year round average" },
  "Dưa leo": { description: "Cucumber, with peel, raw" },
  "Cà rốt": { description: "Carrots, raw" },
  "Bí đỏ": { description: "Pumpkin, raw" },
  "Giá đỗ": { description: "Mung beans, mature seeds, sprouted, raw" },
  "Bắp cải": { description: "Cabbage, raw" },
  "Súp lơ xanh": { description: "Broccoli, raw" },
  "Nấm rơm": { description: "Mushrooms, straw, canned, drained solids", note: "USDA only has canned straw mushrooms." },

  // Fruit
  "Chuối": { description: "Bananas, raw" },
  "Cam": { description: "Oranges, raw, all commercial varieties" },
  "Táo": { description: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)" },
  "Xoài": { description: "Mangos, raw" },
  "Đu đủ": { description: "Papayas, raw" },
  "Dưa hấu": { description: "Watermelon, raw" },
  "Bơ": { description: "Avocados, raw, all commercial varieties" },
  "Nho": { description: "Grapes, red or green (European type, such as Thompson seedless), raw" },

  // Drinks
  "Nước ngọt": { description: "Beverages, carbonated, cola, contains caffeine" },
  "Bia": { description: "Alcoholic beverage, beer, regular, all" },
  "Nước cam ép": { description: "Orange juice, raw (Includes foods for USDA's Food Distribution Program)" },

  // Other
  "Lạc rang": { description: "Peanuts, all types, dry-roasted, without salt" },
  "Hạt điều": { description: "Nuts, cashew nuts, dry roasted, without salt added" },
  "Dầu ăn": { description: "Oil, soybean, salad or cooking" },
  "Sữa tươi": { description: "Milk, whole, 3.25% milkfat, with added vitamin D" },
  "Sữa chua": { description: "Yogurt, plain, whole milk" },
}

export { USDA_MAPPING, type UsdaMapping }
