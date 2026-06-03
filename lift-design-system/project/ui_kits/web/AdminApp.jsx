/* global React, Icon, Label, Button, useIsMobile, AdminSidebar, AdminDashboard, AdminUsers, AdminExercises, AdminRequests, AdminConnections, AdminPrograms, AdminAudit, adminRequests */
const { useState: useStateAA, useEffect: useEffectAA } = React;

/* lightweight toast */
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink-900)', color: 'var(--ink-0)', padding: '10px 18px',
      borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 12px 32px -8px rgba(13,13,11,0.4)', animation: 'lift-toast-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <Icon name="check" size={15} color="var(--ok)" /> {msg}
    </div>
  );
}

/* compact exercise import dialog (mirrors the admin exercise template) */
function ExerciseImport({ onClose, onToast }) {
  const mobile = useIsMobile();
  const [stage, setStage] = useStateAA(0); // 0 upload, 1 review
  const sampleRows = [
    ['Bench Press', 'Chest', 'Incline Barbell', 'Barbell'],
    ['Bench Press', 'Chest', 'Decline Dumbbell', 'Dumbbell'],
    ['Cable Crossover', 'Chest', 'High-to-low', 'Cable'],
    ['Seated Row', 'Back', 'Neutral Grip', 'Cable'],
    ['Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Dumbbell'],
    ['Face Pull', 'Shoulders', 'Rope', 'Cable'],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,11,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', zIndex: 100, padding: mobile ? 0 : 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--ink-0)', borderRadius: mobile ? 0 : 14, width: '100%', maxWidth: mobile ? '100%' : 560, maxHeight: mobile ? '100%' : '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Label style={{ marginBottom: 6 }}>Import exercises</Label>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: 'var(--ink-900)' }}>Bulk add from Excel</h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {stage === 0 ? (
            <div>
              <div onClick={() => setStage(1)} style={{ border: '1.5px dashed var(--ink-150)', background: 'var(--ink-50)', borderRadius: 10, padding: '36px 24px', textAlign: 'center', cursor: 'pointer' }}>
                <Icon name="upload-cloud" size={30} color="var(--ink-400)" />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-800)', marginTop: 12 }}>Drop .xlsx here</div>
                <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>or click to choose a file</div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <Button variant="secondary" icon="sparkles" onClick={() => setStage(1)}>Use sample data</Button>
              </div>
              <div style={{ marginTop: 18 }}>
                <Label style={{ marginBottom: 8 }}>Required columns</Label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', lineHeight: 1.6 }}>
                  exercise_name · muscle_group · variation_name · equipment · is_default · sort_order
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name="check-circle-2" size={15} color="var(--ok)" />
                <span style={{ fontSize: 13, color: 'var(--ok)' }}><b>{sampleRows.length}</b> rows ready to import.</span>
              </div>
              <div style={{ border: '1px solid var(--ink-100)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-400)', background: 'var(--ink-50)' }}>
                  {['Exercise', 'Muscle', 'Variation', 'Equipment'].map(h => <div key={h} style={{ padding: '8px 10px' }}>{h}</div>)}
                </div>
                {sampleRows.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr', fontSize: 12, color: 'var(--ink-600)', borderTop: '1px solid var(--ink-50)' }}>
                    {r.map((c, j) => <div key={j} style={{ padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {stage === 1 && <Button variant="dark" icon="check" onClick={() => { onToast('Imported 6 exercise variations'); onClose(); }}>Import 6</Button>}
        </div>
      </div>
    </div>
  );
}

function AdminApp() {
  const [screen, setScreen] = useStateAA('dashboard');
  const [toast, setToast] = useStateAA(null);
  const [openUserId, setOpenUserId] = useStateAA(null);
  const [importing, setImporting] = useStateAA(false);
  const pending = adminRequests.filter(r => r.status === 'pending').length;

  const showToast = (msg) => { setToast(msg); };
  useEffectAA(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const goUser = (id) => { setOpenUserId(id); setScreen('users'); };

  let view;
  if (screen === 'dashboard') view = <AdminDashboard onOpenUser={goUser} />;
  else if (screen === 'users') view = <AdminUsers key={openUserId || 'u'} initialUserId={openUserId} onToast={showToast} />;
  else if (screen === 'requests') view = <AdminRequests onToast={showToast} />;
  else if (screen === 'connections') view = <AdminConnections onToast={showToast} />;
  else if (screen === 'programs') view = <AdminPrograms onToast={showToast} />;
  else if (screen === 'exercises') view = <AdminExercises onToast={showToast} onImport={() => setImporting(true)} />;
  else if (screen === 'audit') view = <AdminAudit />;

  return (
    <>
      <AdminSidebar active={screen} onNavigate={(s) => { setOpenUserId(null); setScreen(s); }} pendingCount={pending} />
      <main>{view}</main>
      <Toast msg={toast} />
      {importing && <ExerciseImport onClose={() => setImporting(false)} onToast={showToast} />}
    </>
  );
}

window.lucide && window.lucide.createIcons();
const adminRoot = ReactDOM.createRoot(document.getElementById('root'));
adminRoot.render(<AdminApp />);
