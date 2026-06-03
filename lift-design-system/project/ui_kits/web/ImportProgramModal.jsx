/* global React, Icon, Label, Input, NumInput, Chip, Tag, Button, useIsMobile, XLSX */
const { useState: useStateIM, useRef: useRefIM, useMemo: useMemoIM } = React;

/* ============================================================
   ImportProgramModal — tạo program từ workbook Excel của hệ thống
   Định dạng thật (nhiều sheet):
     • Program   — field/value: name, description, duration_weeks, difficulty, assign_to_emails
     • Workouts  — workout_name, scheduled_day, exercise_name, variation_name,
                   variation_id, sets, reps_range, weight   (1 dòng = 1 bài tập)
     • Reference — variation_id → exercise (để validate ID)
     • Trainees  — trainee_name, email
   variation_id ĐÃ có sẵn → không cần khớp tên; chỉ validate ID.
   Luồng: Upload → Review (gom theo buổi/ngày) → Done
   ============================================================ */

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
/* alias coi là cùng một ngày (theo Instructions sheet) */
const DAY_ALIAS = {
  '0': 'sunday', '7': 'sunday', 'cn': 'sunday', 'sun': 'sunday', 'sunday': 'sunday',
  '1': 'monday', 't2': 'monday', 'mon': 'monday', 'monday': 'monday', 'day 1': 'monday',
  '2': 'tuesday', 't3': 'tuesday', 'tue': 'tuesday', 'tuesday': 'tuesday', 'day 2': 'tuesday',
  '3': 'wednesday', 't4': 'wednesday', 'wed': 'wednesday', 'wednesday': 'wednesday', 'day 3': 'wednesday',
  '4': 'thursday', 't5': 'thursday', 'thu': 'thursday', 'thursday': 'thursday', 'day 4': 'thursday',
  '5': 'friday', 't6': 'friday', 'fri': 'friday', 'friday': 'friday', 'day 5': 'friday',
  '6': 'saturday', 't7': 'saturday', 'sat': 'saturday', 'saturday': 'saturday', 'day 6': 'saturday',
};
const dayKey = (v) => DAY_ALIAS[String(v || '').trim().toLowerCase()] || String(v || '').trim().toLowerCase();

/* ---- Dữ liệu mẫu: chính là file "Cutting Phase Meso 1" của coach ---- */
const sampleMeta = {
  name: 'Duc Training — Cutting Phase Meso 1',
  description: 'UL Split 4x/week. Upper days train Back, Chest, Triceps, Delts. Lower days train Hamstrings, Quads, Calves, Traps, Biceps. Saturday optional Arms & Shoulders.',
  duration_weeks: 4,
  difficulty: 'intermediate',
  assign_to_emails: 'minhduc06062005@gmail.com',
};
const sampleWorkouts = [
  ['Upper A','Monday','Lat Pulldown','Wide Grip','0bde50ad-58b4-4d34-874a-7cb5306631ad','2','12-13','70'],
  ['Upper A','Monday','Bentover Row','Machine','2a74c616-dd29-4ce0-b681-6617aa8cb2f1','2','10-12','40'],
  ['Upper A','Monday','Lat Pulldown','Frontal 1 Arm','d418d012-c36e-4095-ad56-053453119dba','3','11-13','80'],
  ['Upper A','Monday','Bench Press','Dumbbell Flat','3de57c02-8dc2-405e-83aa-057bafcef26d','2','8-11','35'],
  ['Upper A','Monday','Machine Chest Press','Converging','8a060527-4b82-438f-b4d0-68c5280d4a6b','2','11-12','30'],
  ['Upper A','Monday','Chest Fly','High-to-low Cable','fcc4d6f8-d56f-4eef-87bf-725523743e35','3','11-12','23'],
  ['Upper A','Monday','Cable Triceps Extension','Overhead','cb19d8a5-1144-43cb-aded-7968c421d02b','3','14-15','57'],
  ['Upper A','Monday','Lateral Raise','1 Arm Cable Y','a9ccb844-78d4-473c-b8ce-7436f7bda31f','3','10-12','10'],
  ['Lower A','Tuesday','Romanian Deadlift','Barbell','3651be58-89e9-4892-a313-7e39010f6c44','2','7-9','100'],
  ['Lower A','Tuesday','Hack Squat','Machine','49984fcc-102f-4e58-965d-baf481b92d94','2','10-12','130'],
  ['Lower A','Tuesday','Leg Extension','Seated','259f8044-f074-4b9b-bf8f-7c164889d54e','3','10-12','70'],
  ['Lower A','Tuesday','Leg Curl','Seated','b36d0064-7615-4b2d-bb7e-5fe51b0dfd65','3','10-12','57'],
  ['Lower A','Tuesday','Calf Raise','Standing','e22a2816-77ba-49ec-934f-31f11ed56822','2','12-13','50'],
  ['Lower A','Tuesday','Shrug','Cable','cf0bc2d2-5cb3-4fa1-bfff-f04c2b5414b8','2','10-12','50'],
  ['','Tuesday','Preacher Curl','1 Arm Cable','85489073-c08a-4b9a-97c7-a5faa7665a53','2','10-12','23'],
  ['Lower A','Tuesday','Incline Curl','Dumbbell','185f1fea-5901-4c4c-8465-17249222c5d2','2','8-10','12'],
  ['Upper B','Thursday','Lat Pulldown','Close Grip','135d5b36-b5dd-4955-8cc6-de5b97b1856f','2','12-13','64'],
  ['Upper B','Thursday','Chest Supported Row','Default','f3ce2def-b47c-42c6-a789-7464a01f8ec4','2','10-12','57'],
  ['Upper B','Thursday','Lat Pulldown','Single Arm','ef55167a-7799-4860-99cb-749aa8bd0cc3','3','11-13','30'],
  ['Upper B','Thursday','Bench Press','Incline Smith','322c79d3-b342-43bd-bc5f-2e2527f59e6a','2','12-13','55'],
  ['Upper B','Thursday','Bench Press','Low Incline Dumbbell','9597b4cf-f870-47dc-a903-2b5cc109088c','2','7-9','25'],
  ['Upper B','Thursday','Chest Fly','Pec-Deck','a1ca8404-04ec-4ab7-936f-9bd025dc1921','3','11-12','50'],
  ['Upper B','Thursday','Cable Triceps Extension','Pushdown','5f94cb80-b817-4b34-aebf-fae6022466a9','3','10-12','76'],
  ['','Thursday','Lateral Raise','1 Arm Cable','799e3662-5b6c-4d40-8641-688309ad0d53','3','10-12','94'],
  ['Lower B','Friday','Romanian Deadlift','Barbell','3651be58-89e9-4892-a313-7e39010f6c44','2','7-9','94'],
  ['Lower B','Friday','Squat','High Bar Back','5d7a169d-716e-4ea2-941e-e5db365c65cb','2','7-9','94'],
  ['Lower B','Friday','Leg Extension','Seated','259f8044-f074-4b9b-bf8f-7c164889d54e','3','10-12','94'],
  ['Lower B','Friday','Leg Curl','Lying','e86e2b30-e67b-497b-bfdc-24fde4b0bb98','3','10-12','94'],
  ['Lower B','Friday','Calf Raise','Standing','e22a2816-77ba-49ec-934f-31f11ed56822','2','12-13','94'],
  ['Lower B','Friday','Shrug','Barbell','1521d92c-3b08-480b-acf7-10e5deb9495a','2','10-12','94'],
  ['Lower B','Friday','EZ Bar Curl','Default','009b5efd-c6a0-4925-aa51-740aa6e2ddee','2','10-12','20'],
  ['Lower B','Friday','Cable Curl','Pulley','1e18e742-e6a3-4319-909c-8daf2b8ef813','2','10-12','15'],
  ['Optional','Saturday','Cable Triceps Extension','Over-ROM Pushdown','5ffdd75d-b588-4bdf-bcad-9c3dd61856d7','2','10-15','30'],
  ['Optional','Saturday','Cable Triceps Extension','1 Arm','540d3695-f149-402f-a652-1e15178f132b','2','10-12','14'],
  ['Optional','Saturday','Lateral Raise','Dumbbell','616f3edd-0efd-4626-8751-bc0ce6b29ec3','2','12-15','10'],
  ['Optional','Saturday','Lateral Raise','1 Arm Cable Behind-the-back','20ac88ad-2942-442a-8f18-90bc220674e8','2','10-12','9'],
  ['Optional','Saturday','Reverse Fly','Pec Deck','8f548306-9aa0-4cd3-b3a7-cb1fe618df31','3','10-12','50'],
];
const sampleTrainees = [{ name: 'Minh Duc', email: 'minhduc06062005@gmail.com' }];

/* Build parsed model từ rows (đã gồm header-less arrays) */
function buildModel(meta, workoutRows, refIds, trainees) {
  const exercises = workoutRows.map((r, i) => ({
    _i: i,
    workout: (r[0] || '').toString().trim(),
    day: dayKey(r[1]),
    dayRaw: (r[1] || '').toString().trim(),
    exercise: (r[2] || '').toString().trim(),
    variation: (r[3] || '').toString().trim(),
    variationId: (r[4] || '').toString().trim(),
    sets: parseInt(r[5], 10) || 0,
    reps: (r[6] || '').toString().trim(),
    weight: r[7] === '' || r[7] == null ? null : Number(r[7]),
    valid: refIds ? refIds.has((r[4] || '').toString().trim()) : !!(r[4] || '').toString().trim(),
  }));
  // gom theo ngày, forward-fill workout_name = first non-empty in day
  const dayMap = {};
  exercises.forEach((e) => {
    dayMap[e.day] = dayMap[e.day] || { day: e.day, dayRaw: e.dayRaw, workout: '', items: [] };
    if (!dayMap[e.day].workout && e.workout) dayMap[e.day].workout = e.workout;
    dayMap[e.day].items.push(e);
  });
  const days = Object.values(dayMap).sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  return { meta, exercises, days, trainees: trainees || [] };
}

function StepDots({ step }) {
  const steps = ['Upload', 'Review', 'Done'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              background: i < step ? 'var(--ok)' : i === step ? 'var(--ink-800)' : 'var(--ink-100)',
              color: i <= step ? '#fff' : 'var(--ink-400)',
            }}>{i < step ? '✓' : i + 1}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: i === step ? 'var(--ink-800)' : 'var(--ink-400)' }}>{s}</span>
          </div>
          {i < steps.length - 1 && <span style={{ width: 24, height: 1, background: 'var(--ink-150)' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* Tải template .xlsx đúng định dạng hệ thống (Program + Workouts) */
function downloadTemplate() {
  if (!window.XLSX) { alert('Không tải được thư viện Excel.'); return; }
  const wb = XLSX.utils.book_new();
  const program = [
    ['field', 'value'],
    ['name', 'My Program'],
    ['description', 'UL split 4x/week.'],
    ['duration_weeks', 4],
    ['difficulty', 'intermediate'],
    ['assign_to_emails', ''],
  ];
  const workouts = [
    ['workout_name', 'scheduled_day', 'exercise_name', 'variation_name', 'variation_id', 'sets', 'reps_range', 'weight'],
    ...sampleWorkouts,
  ];
  const trainees = [['trainee_name', 'email'], ...sampleTrainees.map((t) => [t.name, t.email])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(program), 'Program');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(workouts), 'Workouts');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trainees), 'Trainees');
  XLSX.writeFile(wb, 'program-template.xlsx');
}

function DayCard({ day, mobile }) {
  const invalid = day.items.filter((e) => !e.valid).length;
  return (
    <div style={{ border: '1px solid var(--ink-100)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag tone="neutral">{DAY_SHORT[day.day] || day.dayRaw}</Tag>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{day.workout || '—'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>· {day.items.length} bài</span>
        {invalid > 0 && <Tag tone="danger">{invalid} ID lỗi</Tag>}
      </div>
      {!mobile && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) 84px 52px 60px 56px', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-400)', paddingBottom: 5, borderBottom: '1px solid var(--ink-100)' }}>
          <span>Exercise</span><span>ID</span><span style={{ textAlign: 'center' }}>Sets</span><span style={{ textAlign: 'center' }}>Reps</span><span style={{ textAlign: 'center' }}>Kg</span>
        </div>
      )}
      {day.items.map((e) => (
        <div key={e._i} style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr auto' : 'minmax(0,1.6fr) 84px 52px 60px 56px',
          gap: 8, alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--ink-50)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.exercise}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.variation}</div>
          </div>
          {mobile ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>
              {e.sets}×{e.reps}{e.weight != null ? ' · ' + e.weight + 'kg' : ''}
            </div>
          ) : (
            <>
              <span title={e.variationId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name={e.valid ? 'check-circle-2' : 'alert-circle'} size={13} color={e.valid ? 'var(--ok)' : 'var(--danger)'} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{e.variationId.slice(0, 6)}…</span>
              </span>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-800)' }}>{e.sets}</span>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-800)' }}>{e.reps}</span>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-600)' }}>{e.weight != null ? e.weight : '—'}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ImportProgramModal({ onClose, onImport }) {
  const mobile = useIsMobile();
  const [step, setStep] = useStateIM(0);
  const [fileName, setFileName] = useStateIM('');
  const [model, setModel] = useStateIM(null);
  const [parseErrors, setParseErrors] = useStateIM([]);
  const [dragging, setDragging] = useStateIM(false);
  const [name, setName] = useStateIM('');
  const [difficulty, setDifficulty] = useStateIM('intermediate');
  const [weeks, setWeeks] = useStateIM(4);
  const [assign, setAssign] = useStateIM(true);
  const fileRef = useRefIM(null);

  const ingest = (m, errors, fname) => {
    setModel(m); setParseErrors(errors || []);
    setName(m.meta.name || fname.replace(/\.[^.]+$/, ''));
    setDifficulty(m.meta.difficulty || 'intermediate');
    setWeeks(Number(m.meta.duration_weeks) || 4);
    setAssign(!!m.meta.assign_to_emails);
    setFileName(fname); setStep(1);
  };

  const loadSample = () =>
    ingest(buildModel(sampleMeta, sampleWorkouts, null, sampleTrainees), [], 'coach-program-duc-final.xlsx');

  const handleFile = async (file) => {
    if (!file) return;
    if (!window.XLSX) { loadSample(); return; }
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = (n) => wb.Sheets[wb.SheetNames.find((s) => s.toLowerCase() === n)];
      // Program (field/value)
      const meta = {};
      const progAoa = sheet('program') ? XLSX.utils.sheet_to_json(sheet('program'), { header: 1 }) : [];
      progAoa.slice(1).forEach((r) => { if (r[0]) meta[String(r[0]).trim()] = r[1]; });
      // Reference → valid ids
      let refIds = null;
      if (sheet('reference')) {
        refIds = new Set(XLSX.utils.sheet_to_json(sheet('reference'), { header: 1 }).slice(1).map((r) => String(r[0] || '').trim()).filter(Boolean));
      }
      // Workouts
      const wAoa = sheet('workouts') ? XLSX.utils.sheet_to_json(sheet('workouts'), { header: 1 }) : [];
      const workoutRows = wAoa.slice(1).filter((r) => r && (r[2] || r[4]));
      // Trainees
      const trainees = sheet('trainees')
        ? XLSX.utils.sheet_to_json(sheet('trainees'), { header: 1 }).slice(1).map((r) => ({ name: r[0], email: r[1] })).filter((t) => t.email)
        : [];
      const errors = [];
      if (!meta.name) errors.push('Sheet Program: thiếu "name"');
      if (workoutRows.length === 0) errors.push('Sheet Workouts: không có dòng bài tập nào');
      ingest(buildModel(meta, workoutRows, refIds, trainees), errors, file.name);
    } catch (err) {
      setParseErrors(['Không đọc được file. Cần workbook có sheet Program và Workouts.']);
      setStep(1);
    }
  };

  const invalidCount = model ? model.exercises.filter((e) => !e.valid).length : 0;
  const dayCount = model ? model.days.length : 0;
  const exCount = model ? model.exercises.length : 0;
  const assignEmails = model && model.meta.assign_to_emails ? String(model.meta.assign_to_emails).split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
  const canCreate = name.trim() && exCount > 0 && invalidCount === 0 && parseErrors.length === 0;

  const doImport = () => {
    onImport && onImport({ name: name.trim(), difficulty, weeks, daysPerWeek: dayCount, exerciseCount: exCount, assigned: assign ? assignEmails.length : 0 });
    setStep(2);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,11,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', zIndex: 100, padding: mobile ? 0 : 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--ink-0)', borderRadius: mobile ? 0 : 14, width: '100%', maxWidth: mobile ? '100%' : 780, maxHeight: mobile ? '100%' : '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)' }}>
        {/* Header */}
        <div style={{ padding: mobile ? '18px 18px 14px' : '22px 26px 16px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <Label style={{ marginBottom: 6 }}>Import program</Label>
              <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>Tạo program từ Excel</h2>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}><Icon name="x" size={18} /></button>
          </div>
          <StepDots step={step} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? 18 : 26 }}>
          {step === 0 && (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current && fileRef.current.click()}
                style={{ border: '1.5px dashed ' + (dragging ? 'var(--accent)' : 'var(--ink-150)'), background: dragging ? 'var(--accent-soft)' : 'var(--ink-50)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 120ms, background 120ms' }}
              >
                <Icon name="upload-cloud" size={32} color="var(--ink-400)" />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-800)', marginTop: 12 }}>Kéo file .xlsx vào đây</div>
                <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>hoặc bấm để chọn file</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <Button variant="secondary" icon="file-down" onClick={downloadTemplate}>Tải template mẫu</Button>
                <Button variant="ghost" icon="sparkles" onClick={loadSample}>Dùng dữ liệu mẫu</Button>
              </div>

              <div style={{ marginTop: 22 }}>
                <Label style={{ marginBottom: 10 }}>Workbook cần các sheet</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Program', 'name · description · duration_weeks · difficulty · assign_to_emails'],
                    ['Workouts', 'workout_name · scheduled_day · exercise_name · variation_name · variation_id · sets · reps_range · weight'],
                    ['Trainees', 'trainee_name · email (tùy chọn, để gán)'],
                  ].map(([s, cols]) => (
                    <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-800)', minWidth: 78 }}>{s}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', lineHeight: 1.5 }}>{cols}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 10, lineHeight: 1.5 }}>
                  Mỗi dòng Workouts là một bài tập; các dòng cùng <b>scheduled_day</b> gộp thành một buổi.
                  <b> variation_id</b> đã có sẵn nên được dùng trực tiếp — không cần khớp tên.
                </div>
              </div>
            </div>
          )}

          {step === 1 && model && (
            <div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <Label style={{ marginBottom: 6 }}>Tên program</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <Label style={{ marginBottom: 6 }}>Độ khó</Label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['beginner', 'intermediate', 'advanced'].map((d) => (
                      <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{d}</Chip>
                    ))}
                  </div>
                </div>
              </div>

              {model.meta.description && (
                <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '0 0 16px', lineHeight: 1.55 }}>{model.meta.description}</p>
              )}

              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
                {[[weeks, 'weeks'], [dayCount, 'days/week'], [exCount, 'exercises']].map(([v, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', fontFeatureSettings: '"tnum" 1' }}>{v}</span>
                    <Label>{l}</Label>
                  </div>
                ))}
              </div>

              {parseErrors.length > 0 && (
                <div style={{ background: 'var(--danger-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    <Icon name="alert-triangle" size={14} /> {parseErrors.length} lỗi
                  </div>
                  {parseErrors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--danger)' }}>{e}</div>)}
                </div>
              )}

              {invalidCount > 0 ? (
                <div style={{ background: 'var(--warn-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="alert-circle" size={15} color="var(--warn)" />
                  <span style={{ fontSize: 13, color: 'var(--warn)' }}><b>{invalidCount}</b> variation_id không có trong thư viện — kiểm tra lại file.</span>
                </div>
              ) : (
                <div style={{ background: 'var(--ok-soft)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="check-circle-2" size={15} color="var(--ok)" />
                  <span style={{ fontSize: 13, color: 'var(--ok)' }}>Tất cả variation_id hợp lệ — sẵn sàng tạo.</span>
                </div>
              )}

              {/* assign */}
              {assignEmails.length > 0 && (
                <div onClick={() => setAssign((a) => !a)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--ink-100)', borderRadius: 8, marginBottom: 18, cursor: 'pointer' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, border: '1.5px solid ' + (assign ? 'var(--accent)' : 'var(--ink-150)'), background: assign ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {assign && <Icon name="check" size={13} color="#fff" />}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink-600)' }}>Gán cho <b>{assignEmails.join(', ')}</b> khi tạo</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {model.days.map((d) => <DayCard key={d.day} day={d} mobile={mobile} />)}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '32px 12px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ok-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name="check" size={26} color="var(--ok)" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--ink-900)' }}>Đã tạo “{name}”</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 6 }}>
                {weeks} tuần · {dayCount} buổi/tuần · {exCount} bài tập{assign && assignEmails.length ? ' · đã gán ' + assignEmails.length + ' trainee' : ''}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: mobile ? '12px 18px' : '16px 26px', borderTop: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step === 1 ? fileName : ''}</div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {step === 0 && <Button variant="ghost" onClick={onClose}>Huỷ</Button>}
            {step === 1 && (
              <>
                <Button variant="ghost" icon="arrow-left" onClick={() => setStep(0)}>Lại</Button>
                <Button variant="dark" icon="check" onClick={doImport} disabled={!canCreate} style={!canCreate ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>Tạo program</Button>
              </>
            )}
            {step === 2 && <Button variant="dark" onClick={onClose}>Xong</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ImportProgramModal });
