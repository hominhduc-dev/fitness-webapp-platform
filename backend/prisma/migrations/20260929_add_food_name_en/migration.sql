-- English food names.
--
-- The food sheet can now show names in English as well as Vietnamese. Foods
-- without an English name (most trainee-created ones) keep showing `name`.
-- System foods are backfilled here by slug; the same strings live in
-- src/lib/nutrition/vietnamese-foods.ts so a fresh seed matches.

-- AlterTable
ALTER TABLE "Food" ADD COLUMN "nameEn" TEXT;

-- Backfill system foods
UPDATE "Food" AS f
SET "nameEn" = v.name_en
FROM (VALUES
  ('system-com-trang', 'Steamed white rice'),
  ('system-bun-tuoi', 'Fresh rice vermicelli'),
  ('system-banh-pho', 'Pho rice noodles'),
  ('system-banh-mi-khong', 'Plain baguette'),
  ('system-xoi-trang', 'Plain sticky rice'),
  ('system-mien-chin', 'Cooked glass noodles'),
  ('system-khoai-lang-luoc', 'Boiled sweet potato'),
  ('system-khoai-tay-luoc', 'Boiled potato'),
  ('system-ngo-nep-luoc', 'Boiled waxy corn'),
  ('system-yen-mach', 'Oats'),
  ('system-uc-ga-bo-da', 'Chicken breast (skinless)'),
  ('system-thit-ga-ta', 'Free-range chicken'),
  ('system-thit-heo-nac', 'Lean pork'),
  ('system-thit-ba-chi', 'Pork belly'),
  ('system-thit-bo-nac', 'Lean beef'),
  ('system-trung-ga', 'Chicken eggs'),
  ('system-trung-vit', 'Duck egg'),
  ('system-ca-thu', 'Mackerel'),
  ('system-ca-basa', 'Basa fish'),
  ('system-ca-ro-phi', 'Tilapia'),
  ('system-tom-su', 'Tiger prawns'),
  ('system-muc', 'Squid'),
  ('system-dau-phu', 'Tofu'),
  ('system-cha-lua', 'Vietnamese pork roll (chả lụa)'),
  ('system-sua-dau-nanh', 'Soy milk'),
  ('system-whey-protein', 'Whey protein'),
  ('system-rau-muong-luoc', 'Boiled water spinach'),
  ('system-cai-ngot', 'Choy sum'),
  ('system-ca-chua', 'Tomato'),
  ('system-dua-leo', 'Cucumber'),
  ('system-ca-rot', 'Carrot'),
  ('system-bi-do', 'Pumpkin'),
  ('system-gia-do', 'Bean sprouts'),
  ('system-bap-cai', 'Cabbage'),
  ('system-sup-lo-xanh', 'Broccoli'),
  ('system-nam-rom', 'Straw mushrooms'),
  ('system-chuoi', 'Banana'),
  ('system-cam', 'Orange'),
  ('system-tao', 'Apple'),
  ('system-xoai', 'Mango'),
  ('system-du-du', 'Papaya'),
  ('system-dua-hau', 'Watermelon'),
  ('system-thanh-long', 'Dragon fruit'),
  ('system-bo', 'Avocado'),
  ('system-nho', 'Grapes'),
  ('system-pho-bo', 'Beef pho'),
  ('system-bun-bo-hue', 'Hue spicy beef noodle soup'),
  ('system-bun-cha', 'Grilled pork with vermicelli (bún chả)'),
  ('system-com-tam-suon', 'Broken rice with grilled pork chop'),
  ('system-banh-mi-thit', 'Banh mi sandwich'),
  ('system-goi-cuon', 'Fresh spring roll'),
  ('system-cha-gio-nem-ran', 'Fried spring roll'),
  ('system-banh-xeo', 'Vietnamese sizzling crepe'),
  ('system-chao-ga', 'Chicken rice porridge'),
  ('system-hu-tieu', 'Hu tieu noodle soup'),
  ('system-mi-goi', 'Instant noodles'),
  ('system-com-chien', 'Fried rice'),
  ('system-ca-phe-sua-da', 'Iced milk coffee'),
  ('system-tra-sua-tran-chau', 'Bubble milk tea'),
  ('system-nuoc-mia', 'Sugarcane juice'),
  ('system-nuoc-ngot', 'Soft drink'),
  ('system-bia', 'Beer'),
  ('system-nuoc-cam-ep', 'Orange juice'),
  ('system-lac-rang', 'Roasted peanuts'),
  ('system-hat-dieu', 'Cashews'),
  ('system-dau-an', 'Cooking oil'),
  ('system-sua-tuoi', 'Fresh milk'),
  ('system-sua-chua', 'Yogurt')
) AS v(slug, name_en)
WHERE f.slug = v.slug AND f.source = 'system';
