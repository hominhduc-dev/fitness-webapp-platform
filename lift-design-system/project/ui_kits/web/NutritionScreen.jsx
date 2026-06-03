/* global React, Icon, Label, Tag, Card, Button, Chip, Input, NumInput, useIsMobile */
const { useState: useStateNU, useMemo: useMemoNU } = React;

/* ============================================================
   Nutrition — daily meal + macro tracking for the trainee
   ============================================================ */

const nutritionTargets = { kcal: 2300, protein: 140, carbs: 280, fat: 70 };

/* Food categories (filter chips) */
const FOOD_CATS = [
  { id: 'all',     label: 'Tất cả' },
  { id: 'staple',  label: 'Tinh bột' },
  { id: 'protein', label: 'Đạm' },
  { id: 'veg',     label: 'Rau củ' },
  { id: 'fruit',   label: 'Trái cây' },
  { id: 'dish',    label: 'Món ăn' },
  { id: 'drink',   label: 'Đồ uống' },
  { id: 'other',   label: 'Khác' },
];

/* Vietnamese food library — values from the Vietnamese Food Composition
   Table (Viện Dinh dưỡng) for raw foods, plus common prepared dishes.
   Macros per the stated serving. */
const foodLibrary = [
  /* --- Tinh bột / staples --- */
  { cat: 'staple', name: 'Cơm trắng',        serving: '1 chén · 150g', kcal: 195, protein: 4,  carbs: 42, fat: 0 },
  { cat: 'staple', name: 'Bún tươi',          serving: '100 g',         kcal: 110, protein: 2,  carbs: 25, fat: 0 },
  { cat: 'staple', name: 'Bánh phở',          serving: '100 g',         kcal: 130, protein: 2,  carbs: 29, fat: 0 },
  { cat: 'staple', name: 'Bánh mì không',     serving: '1 ổ · 80g',     kcal: 200, protein: 6,  carbs: 42, fat: 1 },
  { cat: 'staple', name: 'Xôi trắng',         serving: '1 chén · 150g', kcal: 295, protein: 5,  carbs: 62, fat: 1 },
  { cat: 'staple', name: 'Miến chín',         serving: '100 g',         kcal: 90,  protein: 0,  carbs: 22, fat: 0 },
  { cat: 'staple', name: 'Khoai lang luộc',   serving: '100 g',         kcal: 119, protein: 1,  carbs: 28, fat: 0 },
  { cat: 'staple', name: 'Khoai tây luộc',    serving: '100 g',         kcal: 87,  protein: 2,  carbs: 20, fat: 0 },
  { cat: 'staple', name: 'Ngô nếp luộc',      serving: '1 bắp · 130g',  kcal: 170, protein: 4,  carbs: 37, fat: 2 },
  { cat: 'staple', name: 'Yến mạch',          serving: '1 chén · 80g',  kcal: 300, protein: 11, carbs: 54, fat: 6 },

  /* --- Đạm / protein --- */
  { cat: 'protein', name: 'Ức gà (bỏ da)',    serving: '100 g', kcal: 165, protein: 31, carbs: 0, fat: 4 },
  { cat: 'protein', name: 'Thịt gà ta',       serving: '100 g', kcal: 199, protein: 20, carbs: 0, fat: 13 },
  { cat: 'protein', name: 'Thịt heo nạc',     serving: '100 g', kcal: 143, protein: 19, carbs: 0, fat: 7 },
  { cat: 'protein', name: 'Thịt ba chỉ',      serving: '100 g', kcal: 260, protein: 17, carbs: 0, fat: 21 },
  { cat: 'protein', name: 'Thịt bò nạc',      serving: '100 g', kcal: 143, protein: 21, carbs: 0, fat: 6 },
  { cat: 'protein', name: 'Trứng gà',         serving: '2 quả · 100g', kcal: 166, protein: 15, carbs: 1, fat: 12 },
  { cat: 'protein', name: 'Trứng vịt',        serving: '1 quả · 70g',  kcal: 130, protein: 9,  carbs: 1, fat: 10 },
  { cat: 'protein', name: 'Cá thu',           serving: '100 g', kcal: 166, protein: 19, carbs: 0, fat: 10 },
  { cat: 'protein', name: 'Cá basa',          serving: '100 g', kcal: 170, protein: 18, carbs: 0, fat: 11 },
  { cat: 'protein', name: 'Cá rô phi',        serving: '100 g', kcal: 128, protein: 26, carbs: 0, fat: 3 },
  { cat: 'protein', name: 'Tôm sú',           serving: '100 g', kcal: 90,  protein: 18, carbs: 0, fat: 2 },
  { cat: 'protein', name: 'Mực',              serving: '100 g', kcal: 92,  protein: 15, carbs: 3, fat: 1 },
  { cat: 'protein', name: 'Đậu phụ',          serving: '100 g', kcal: 95,  protein: 11, carbs: 2, fat: 5 },
  { cat: 'protein', name: 'Chả lụa',          serving: '100 g', kcal: 240, protein: 14, carbs: 0, fat: 20 },
  { cat: 'protein', name: 'Sữa đậu nành',     serving: '1 ly · 200ml', kcal: 80, protein: 6, carbs: 8, fat: 4 },
  { cat: 'protein', name: 'Whey protein',     serving: '1 muỗng · 30g', kcal: 120, protein: 24, carbs: 3, fat: 2 },

  /* --- Rau củ / vegetables --- */
  { cat: 'veg', name: 'Rau muống luộc', serving: '100 g', kcal: 23, protein: 3, carbs: 2, fat: 0 },
  { cat: 'veg', name: 'Cải ngọt',       serving: '100 g', kcal: 16, protein: 2, carbs: 2, fat: 0 },
  { cat: 'veg', name: 'Cà chua',        serving: '100 g', kcal: 19, protein: 1, carbs: 4, fat: 0 },
  { cat: 'veg', name: 'Dưa leo',        serving: '100 g', kcal: 16, protein: 1, carbs: 3, fat: 0 },
  { cat: 'veg', name: 'Cà rốt',         serving: '100 g', kcal: 39, protein: 2, carbs: 8, fat: 0 },
  { cat: 'veg', name: 'Bí đỏ',          serving: '100 g', kcal: 27, protein: 0, carbs: 6, fat: 0 },
  { cat: 'veg', name: 'Giá đỗ',         serving: '100 g', kcal: 30, protein: 3, carbs: 4, fat: 0 },
  { cat: 'veg', name: 'Bắp cải',        serving: '100 g', kcal: 29, protein: 2, carbs: 5, fat: 0 },
  { cat: 'veg', name: 'Súp lơ xanh',    serving: '100 g', kcal: 30, protein: 3, carbs: 5, fat: 0 },
  { cat: 'veg', name: 'Nấm rơm',        serving: '100 g', kcal: 31, protein: 4, carbs: 3, fat: 0 },

  /* --- Trái cây / fruit --- */
  { cat: 'fruit', name: 'Chuối',     serving: '1 quả · 100g', kcal: 97, protein: 1, carbs: 22, fat: 0 },
  { cat: 'fruit', name: 'Cam',       serving: '1 quả · 150g', kcal: 65, protein: 1, carbs: 16, fat: 0 },
  { cat: 'fruit', name: 'Táo',       serving: '1 quả · 150g', kcal: 78, protein: 0, carbs: 21, fat: 0 },
  { cat: 'fruit', name: 'Xoài',      serving: '100 g', kcal: 60, protein: 1, carbs: 15, fat: 0 },
  { cat: 'fruit', name: 'Đu đủ',     serving: '100 g', kcal: 36, protein: 1, carbs: 8,  fat: 0 },
  { cat: 'fruit', name: 'Dưa hấu',   serving: '100 g', kcal: 25, protein: 1, carbs: 6,  fat: 0 },
  { cat: 'fruit', name: 'Thanh long', serving: '100 g', kcal: 50, protein: 1, carbs: 13, fat: 0 },
  { cat: 'fruit', name: 'Bơ',        serving: '½ quả · 70g', kcal: 112, protein: 1, carbs: 6, fat: 10 },
  { cat: 'fruit', name: 'Nho',       serving: '100 g', kcal: 71, protein: 1, carbs: 18, fat: 0 },

  /* --- Món ăn / prepared dishes --- */
  { cat: 'dish', name: 'Phở bò',         serving: '1 tô', kcal: 420, protein: 25, carbs: 55, fat: 10 },
  { cat: 'dish', name: 'Bún bò Huế',     serving: '1 tô', kcal: 490, protein: 28, carbs: 56, fat: 15 },
  { cat: 'dish', name: 'Bún chả',        serving: '1 phần', kcal: 460, protein: 26, carbs: 50, fat: 18 },
  { cat: 'dish', name: 'Cơm tấm sườn',   serving: '1 dĩa', kcal: 630, protein: 30, carbs: 75, fat: 22 },
  { cat: 'dish', name: 'Bánh mì thịt',   serving: '1 ổ', kcal: 460, protein: 20, carbs: 55, fat: 18 },
  { cat: 'dish', name: 'Gỏi cuốn',       serving: '1 cuốn', kcal: 70, protein: 5, carbs: 10, fat: 1 },
  { cat: 'dish', name: 'Chả giò (nem rán)', serving: '1 cái', kcal: 120, protein: 4, carbs: 11, fat: 7 },
  { cat: 'dish', name: 'Bánh xèo',       serving: '1 cái', kcal: 350, protein: 12, carbs: 35, fat: 18 },
  { cat: 'dish', name: 'Cháo gà',        serving: '1 tô', kcal: 280, protein: 16, carbs: 40, fat: 6 },
  { cat: 'dish', name: 'Hủ tiếu',        serving: '1 tô', kcal: 400, protein: 22, carbs: 58, fat: 8 },
  { cat: 'dish', name: 'Mì gói',         serving: '1 gói', kcal: 350, protein: 8, carbs: 52, fat: 13 },
  { cat: 'dish', name: 'Cơm chiên',      serving: '1 dĩa', kcal: 560, protein: 15, carbs: 72, fat: 22 },

  /* --- Đồ uống / drinks --- */
  { cat: 'drink', name: 'Cà phê sữa đá', serving: '1 ly', kcal: 140, protein: 3, carbs: 20, fat: 5 },
  { cat: 'drink', name: 'Trà sữa trân châu', serving: '1 ly', kcal: 320, protein: 5, carbs: 55, fat: 9 },
  { cat: 'drink', name: 'Nước mía',      serving: '1 ly', kcal: 240, protein: 0, carbs: 60, fat: 0 },
  { cat: 'drink', name: 'Nước ngọt',     serving: '1 lon · 330ml', kcal: 140, protein: 0, carbs: 39, fat: 0 },
  { cat: 'drink', name: 'Bia',           serving: '1 lon · 330ml', kcal: 150, protein: 2, carbs: 13, fat: 0 },
  { cat: 'drink', name: 'Nước cam ép',   serving: '1 ly', kcal: 110, protein: 2, carbs: 26, fat: 1 },

  /* --- Khác / other --- */
  { cat: 'other', name: 'Lạc rang',   serving: '30 g', kcal: 170, protein: 7, carbs: 5, fat: 14 },
  { cat: 'other', name: 'Hạt điều',   serving: '30 g', kcal: 175, protein: 5, carbs: 9, fat: 14 },
  { cat: 'other', name: 'Dầu ăn',     serving: '1 thìa', kcal: 120, protein: 0, carbs: 0, fat: 14 },
  { cat: 'other', name: 'Sữa tươi',   serving: '1 ly · 200ml', kcal: 130, protein: 7, carbs: 10, fat: 7 },
  { cat: 'other', name: 'Sữa chua',   serving: '1 hộp · 100g', kcal: 100, protein: 4, carbs: 16, fat: 3 },
];

const findFood = (name) => foodLibrary.find(f => f.name === name);

const MEALS = [
  { id: 'breakfast', label: 'Bữa sáng', icon: 'sunrise' },
  { id: 'lunch',     label: 'Bữa trưa', icon: 'sun' },
  { id: 'dinner',    label: 'Bữa tối',  icon: 'sunset' },
  { id: 'snacks',    label: 'Ăn vặt',   icon: 'cookie' },
];

let _fid = 100;
const mkItem = (food, qty, amount) => ({ id: ++_fid, ...food, qty, amount });

/* trích số gram/ml gốc từ chuỗi khẩu phần, vd "1 chén · 150g" → 150, "1 tô" → null */
const getBaseGrams = (serving) => {
  const m = String(serving).match(/(\d+)\s*(g|ml)\b/i);
  return m ? parseInt(m[1], 10) : null;
};

const initialLog = {
  breakfast: [mkItem(findFood('Phở bò'), 1), mkItem(findFood('Cà phê sữa đá'), 1)],
  lunch:     [mkItem(findFood('Cơm trắng'), 2), mkItem(findFood('Thịt heo nạc'), 1), mkItem(findFood('Rau muống luộc'), 1)],
  dinner:    [mkItem(findFood('Cơm trắng'), 1), mkItem(findFood('Cá rô phi'), 1), mkItem(findFood('Bắp cải'), 1)],
  snacks:    [mkItem(findFood('Chuối'), 1)],
};

const sumItems = (items, key) => items.reduce((a, it) => a + it[key] * it.qty, 0);

/* ---------- calorie ring ---------- */
function CalorieRing({ consumed, target }) {
  const r = 52, c = 2 * Math.PI * r, size = 128;
  const pct = Math.min(consumed / target, 1);
  const over = consumed > target;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-100)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={over ? 'var(--warn)' : 'var(--accent)'} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: 'var(--ink-900)', fontFeatureSettings: '"tnum" 1', lineHeight: 1 }}>{consumed.toLocaleString()}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', marginTop: 3 }}>of {target.toLocaleString()}</div>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target, accent }) {
  const pct = Math.min(consumed / target, 1);
  const over = consumed > target;
  const fill = over ? 'var(--warn)' : accent ? 'var(--accent)' : 'var(--ink-400)';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-600)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-600)', fontFeatureSettings: '"tnum" 1' }}>
          <span style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{Math.round(consumed)}</span> / {target} g
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
        <div style={{ width: (pct * 100) + '%', height: '100%', borderRadius: 999, background: fill }} />
      </div>
    </div>
  );
}

/* ---------- water tracker ---------- */
function WaterTracker({ glasses, goal, onChange }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Label>Nước</Label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-600)', fontFeatureSettings: '"tnum" 1' }}>
          <span style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{glasses}</span> / {goal} ly
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: goal }).map((_, i) => {
          const filled = i < glasses;
          return (
            <button key={i} onClick={() => onChange(i + 1 === glasses ? i : i + 1)} aria-label={`${i + 1} glasses`}
              style={{ flex: 1, height: 38, borderRadius: 6, cursor: 'pointer',
                border: '1px solid ' + (filled ? 'var(--accent)' : 'var(--ink-150)'),
                background: filled ? 'var(--accent-soft)' : 'var(--ink-0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <Icon name="droplet" size={15} color={filled ? 'var(--accent)' : 'var(--ink-200, #c9c9c2)'} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- add-food modal ---------- */
function AddFoodModal({ meal, library, onCreateFood, onClose, onAdd }) {
  const mobile = useIsMobile();
  const [q, setQ] = useStateNU('');
  const [cat, setCat] = useStateNU('all');
  const [sel, setSel] = useStateNU(null);
  const [qty, setQty] = useStateNU(1);
  const [grams, setGrams] = useStateNU(100);
  const [creating, setCreating] = useStateNU(false);
  const foods = library || foodLibrary;
  const list = foods.filter(f =>
    (cat === 'all' || f.cat === cat) && (!q || f.name.toLowerCase().includes(q.toLowerCase()))
  );
  const mealLabel = MEALS.find(m => m.id === meal).label;

  const pick = (f) => { setSel(f); setQty(1); setGrams(getBaseGrams(f.serving) || 100); };
  const baseG = sel ? getBaseGrams(sel.serving) : null;
  const gramUnit = sel && /ml\b/i.test(sel.serving) ? 'ml' : 'g';
  const effQty = baseG ? (grams > 0 ? grams / baseG : 0) : qty;
  const amountLabel = baseG ? `${grams || 0} ${gramUnit}` : (qty !== 1 ? `×${qty}` : '');

  const handleCreated = (food) => { onCreateFood && onCreateFood(food); setCreating(false); setQ(''); setCat(food.cat); pick(food); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,11,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100, padding: mobile ? 0 : 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--ink-0)', borderRadius: mobile ? '16px 16px 0 0' : 14, width: '100%', maxWidth: mobile ? '100%' : 460, maxHeight: mobile ? '86vh' : '84vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)' }}>
        {creating ? (
          <CreateFoodForm onCancel={() => setCreating(false)} onSave={handleCreated} />
        ) : (
        <React.Fragment>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <Label style={{ marginBottom: 6 }}>Thêm vào {mealLabel}</Label>
              <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: 'var(--ink-900)' }}>Ghi món ăn</h2>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}><Icon name="x" size={18} /></button>
          </div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
            <Input value={q} onChange={e => { setQ(e.target.value); setSel(null); }} placeholder="Tìm món ăn…" style={{ width: '100%', paddingLeft: 32 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
            {FOOD_CATS.map(c => (
              <Chip key={c.id} active={cat === c.id} onClick={() => { setCat(c.id); setSel(null); }}>{c.label}</Chip>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.map(f => {
            const active = sel && sel.name === f.name;
            return (
              <button key={f.name} onClick={() => pick(f)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '11px 22px', border: 'none', borderBottom: '1px solid var(--ink-50)',
                background: active ? 'var(--accent-soft)' : 'transparent', cursor: 'pointer',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{f.serving} · P{f.protein} C{f.carbs} F{f.fat}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-600)', fontFeatureSettings: '"tnum" 1' }}>{f.kcal}<span style={{ fontSize: 10, color: 'var(--ink-400)' }}> kcal</span></span>
              </button>
            );
          })}
          {list.length === 0 && <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>Không tìm thấy món nào.</div>}
        </div>

        <div style={{ borderTop: '1px solid var(--ink-100)', padding: '10px 22px' }}>
          <button onClick={() => setCreating(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
            border: '1px dashed var(--ink-150)', background: 'transparent', borderRadius: 8,
            padding: '9px 12px', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-sans)',
            fontSize: 13, fontWeight: 500,
          }}>
            <Icon name="plus" size={14} color="var(--accent)" /> Tạo món mới
          </button>
        </div>

        {sel && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{sel.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', fontFeatureSettings: '"tnum" 1' }}>
                {Math.round(sel.kcal * effQty)} kcal · P{Math.round(sel.protein * effQty)} C{Math.round(sel.carbs * effQty)} F{Math.round(sel.fat * effQty)}
              </div>
            </div>
            {baseG ? (
              /* món tính theo gram/ml → nhập khối lượng trực tiếp */
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setGrams(g => Math.max(1, (Number(g) || 0) - 10))} style={stepBtn}><Icon name="minus" size={14} /></button>
                <div style={{ position: 'relative' }}>
                  <input type="number" inputMode="decimal" value={grams}
                    onChange={e => setGrams(e.target.value === '' ? '' : Math.max(0, +e.target.value))}
                    style={{ width: 66, padding: '7px 22px 7px 10px', fontFamily: 'var(--font-mono)', fontSize: 14, textAlign: 'right', border: '1px solid var(--ink-150)', borderRadius: 6, color: 'var(--ink-900)', background: 'var(--ink-0)' }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', pointerEvents: 'none' }}>{gramUnit}</span>
                </div>
                <button onClick={() => setGrams(g => (Number(g) || 0) + 10)} style={stepBtn}><Icon name="plus" size={14} /></button>
              </div>
            ) : (
              /* món tính theo phần (1 tô, 1 cái…) → bội số khẩu phần */
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setQty(q => Math.max(0.5, +((Number(q) || 0) - 0.5).toFixed(2)))} style={stepBtn}><Icon name="minus" size={14} /></button>
                <input type="number" inputMode="decimal" value={qty}
                  onChange={e => setQty(e.target.value === '' ? '' : Math.max(0, +e.target.value))}
                  style={{ width: 52, padding: '7px 8px', fontFamily: 'var(--font-mono)', fontSize: 14, textAlign: 'center', border: '1px solid var(--ink-150)', borderRadius: 6, color: 'var(--ink-900)', background: 'var(--ink-0)' }} />
                <button onClick={() => setQty(q => +((Number(q) || 0) + 0.5).toFixed(2))} style={stepBtn}><Icon name="plus" size={14} /></button>
              </div>
            )}
            <Button variant="dark" icon="check" disabled={effQty <= 0} onClick={() => onAdd(meal, mkItem(sel, effQty, amountLabel))} style={effQty <= 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>Thêm</Button>
          </div>
        )}
        </React.Fragment>
        )}
      </div>
    </div>
  );
}

/* ---------- create custom food form ---------- */
function CreateFoodForm({ onCancel, onSave }) {
  const [name, setName] = useStateNU('');
  const [cat, setCat] = useStateNU('dish');
  const [serving, setServing] = useStateNU('100 g');
  const [kcal, setKcal] = useStateNU('');
  const [protein, setProtein] = useStateNU('');
  const [carbs, setCarbs] = useStateNU('');
  const [fat, setFat] = useStateNU('');
  const num = (v) => (v === '' || isNaN(+v) ? 0 : +v);
  const canSave = name.trim() && serving.trim() && num(kcal) > 0;
  const cats = FOOD_CATS.filter(c => c.id !== 'all');

  const macroField = (label, val, set) => (
    <div style={{ flex: 1 }}>
      <Label style={{ marginBottom: 6 }}>{label}</Label>
      <input type="number" inputMode="decimal" value={val} onChange={e => set(e.target.value)} placeholder="0"
        style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 14, border: '1px solid var(--ink-150)', borderRadius: 6, color: 'var(--ink-900)', background: 'var(--ink-0)' }} />
    </div>
  );

  return (
    <React.Fragment>
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Label style={{ marginBottom: 6 }}>Thư viện món ăn</Label>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: 'var(--ink-900)' }}>Tạo món mới</h2>
        </div>
        <button onClick={onCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}><Icon name="x" size={18} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Label style={{ marginBottom: 6 }}>Tên món</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Bún riêu cua" style={{ width: '100%' }} />
        </div>
        <div>
          <Label style={{ marginBottom: 8 }}>Nhóm</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.map(c => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
          </div>
        </div>
        <div>
          <Label style={{ marginBottom: 6 }}>Khẩu phần</Label>
          <Input value={serving} onChange={e => setServing(e.target.value)} placeholder="VD: 100 g · 1 tô · 1 ly · 200ml" style={{ width: '100%' }} />
          <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 5 }}>Có “g” hoặc “ml” → cho nhập khối lượng. Số liệu nhập theo đúng khẩu phần này.</div>
        </div>
        <div>
          <Label style={{ marginBottom: 6 }}>Calo (kcal)</Label>
          <input type="number" inputMode="decimal" value={kcal} onChange={e => setKcal(e.target.value)} placeholder="0"
            style={{ width: '100%', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 14, border: '1px solid var(--ink-150)', borderRadius: 6, color: 'var(--ink-900)', background: 'var(--ink-0)' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {macroField('Đạm (g)', protein, setProtein)}
          {macroField('Tinh bột (g)', carbs, setCarbs)}
          {macroField('Béo (g)', fat, setFat)}
        </div>
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="ghost" onClick={onCancel}>Huỷ</Button>
        <Button variant="dark" icon="check" disabled={!canSave}
          onClick={() => onSave({ cat, name: name.trim(), serving: serving.trim(), kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat) })}
          style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>Lưu món</Button>
      </div>
    </React.Fragment>
  );
}

const stepBtn = { width: 30, height: 30, borderRadius: 6, border: '1px solid var(--ink-150)', background: 'var(--ink-0)', color: 'var(--ink-600)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

/* ---------- meal section ---------- */
function MealSection({ meal, items, onAdd, onRemove }) {
  const kcal = Math.round(sumItems(items, 'kcal'));
  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: items.length ? '1px solid var(--ink-100)' : 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--ink-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={meal.icon} size={15} color="var(--ink-600)" />
        </div>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>{meal.label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-600)', fontFeatureSettings: '"tnum" 1' }}>{kcal} kcal</span>
        <button onClick={() => onAdd(meal.id)} title={`Add to ${meal.label}`} style={{ ...stepBtn, marginLeft: 4, borderColor: 'var(--accent)', color: 'var(--accent)' }}><Icon name="plus" size={15} color="var(--accent)" /></button>
      </div>
      {items.map(it => (
        <div key={it.id} className="meal-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--ink-50)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: 'var(--ink-900)' }}>{it.name}{(it.amount || (it.qty !== 1 ? '×' + it.qty : '')) ? <span style={{ color: 'var(--ink-400)' }}> {it.amount || '×' + it.qty}</span> : ''}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', fontFeatureSettings: '"tnum" 1' }}>P{Math.round(it.protein * it.qty)} · C{Math.round(it.carbs * it.qty)} · F{Math.round(it.fat * it.qty)}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-600)', fontFeatureSettings: '"tnum" 1' }}>{Math.round(it.kcal * it.qty)}</span>
          <button onClick={() => onRemove(meal.id, it.id)} title="Remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-200)', padding: 4, borderRadius: 5 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-200)'}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </Card>
  );
}

function NutritionScreen() {
  const mobile = useIsMobile();
  const [log, setLog] = useStateNU(initialLog);
  const [water, setWater] = useStateNU(5);
  const [addTo, setAddTo] = useStateNU(null);
  const [library, setLibrary] = useStateNU(foodLibrary);

  const addCustomFood = (food) => setLibrary(prev => [{ ...food }, ...prev]);

  const all = useMemoNU(() => Object.values(log).flat(), [log]);
  const totals = {
    kcal: Math.round(sumItems(all, 'kcal')),
    protein: sumItems(all, 'protein'),
    carbs: sumItems(all, 'carbs'),
    fat: sumItems(all, 'fat'),
  };
  const left = nutritionTargets.kcal - totals.kcal;

  const addFood = (meal, item) => { setLog(prev => ({ ...prev, [meal]: [...prev[meal], item] })); setAddTo(null); };
  const removeFood = (meal, id) => setLog(prev => ({ ...prev, [meal]: prev[meal].filter(it => it.id !== id) }));

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'baseline', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 14 : 0, justifyContent: 'space-between', marginBottom: mobile ? 20 : 28 }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Dinh dưỡng · Hôm nay</Label>
          <h1 style={{ fontSize: mobile ? 26 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            {left > 0 ? `Còn ${left.toLocaleString()} kcal.` : `Vượt ${Math.abs(left).toLocaleString()} kcal.`}
          </h1>
        </div>
        <Button variant="dark" icon="plus" onClick={() => setAddTo('snacks')}>Thêm nhanh</Button>
      </div>

      {/* summary */}
      <Card style={{ padding: mobile ? 18 : 24, marginBottom: mobile ? 18 : 24 }}>
        <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'center', gap: mobile ? 22 : 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: mobile ? 'center' : 'flex-start' }}>
            <CalorieRing consumed={totals.kcal} target={nutritionTargets.kcal} />
            <div>
              <Label>Calo</Label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: left < 0 ? 'var(--warn)' : 'var(--ink-900)', fontFeatureSettings: '"tnum" 1' }}>{Math.abs(left).toLocaleString()}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>kcal {left < 0 ? 'vượt' : 'còn lại'}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>{totals.kcal.toLocaleString()} đã ăn · mục tiêu {nutritionTargets.kcal.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: mobile ? 'auto' : 240 }}>
            <MacroBar label="Protein" consumed={totals.protein} target={nutritionTargets.protein} accent />
            <MacroBar label="Carbs" consumed={totals.carbs} target={nutritionTargets.carbs} />
            <MacroBar label="Fat" consumed={totals.fat} target={nutritionTargets.fat} />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.55fr 1fr', gap: mobile ? 0 : 20, alignItems: 'start' }}>
        {/* meals */}
        <div>
          <Label style={{ marginBottom: 12 }}>Bữa ăn</Label>
          {MEALS.map(m => (
            <MealSection key={m.id} meal={m} items={log[m.id]} onAdd={setAddTo} onRemove={removeFood} />
          ))}
        </div>
        {/* side: water + macro split */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: mobile ? 8 : 28 }}>
          <WaterTracker glasses={water} goal={8} onChange={setWater} />
          <Card style={{ padding: 18 }}>
            <Label style={{ marginBottom: 14 }}>Tỷ lệ macro · hôm nay</Label>
            {[['Protein', totals.protein * 4, 'var(--accent)'], ['Carbs', totals.carbs * 4, 'var(--ink-400)'], ['Fat', totals.fat * 9, 'var(--ink-600)']].map(([n, cals, color]) => {
              const totalCals = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9 || 1;
              const p = Math.round((cals / totalCals) * 100);
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 56, fontSize: 13, color: 'var(--ink-600)' }}>{n}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
                    <div style={{ width: p + '%', height: '100%', borderRadius: 999, background: color }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-600)', width: 34, textAlign: 'right', fontFeatureSettings: '"tnum" 1' }}>{p}%</span>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      {addTo && <AddFoodModal meal={addTo} library={library} onCreateFood={addCustomFood} onClose={() => setAddTo(null)} onAdd={addFood} />}
    </div>
  );
}

Object.assign(window, { NutritionScreen });
