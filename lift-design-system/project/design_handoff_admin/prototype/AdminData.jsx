/* global React */
/* ============================================================
   AdminData — mock data shaped after the real admin API
   (AdminDashboardData, AdminUserListItem, AdminCoachRequest,
    AdminConnectionsData, AdminProgramSummary, AdminExerciseItem,
    AdminAuditLogItem). Prototype-only; no backend.
   ============================================================ */

const adminStats = {
  totalUsers: 1284,
  totalCoaches: 38,
  totalTrainees: 1240,
  totalAdmins: 6,
  activeUsersLast7Days: 612,
  activeUsersLast30Days: 947,
  totalPrograms: 173,
  totalWorkoutLogs: 28940,
  totalMeals: 9120,
};

const adminCharts = {
  userGrowth: {
    weekly: [['W1', 28], ['W2', 41], ['W3', 36], ['W4', 52], ['W5', 47], ['W6', 63]],
    monthly: [['Jan', 96], ['Feb', 128], ['Mar', 142], ['Apr', 171], ['May', 188], ['Jun', 204]],
  },
  activeUsers: {
    weekly: [['W1', 480], ['W2', 512], ['W3', 498], ['W4', 560], ['W5', 590], ['W6', 612]],
    monthly: [['Jan', 720], ['Feb', 780], ['Mar', 815], ['Apr', 870], ['May', 910], ['Jun', 947]],
  },
  workoutLogs: {
    weekly: [['W1', 3120], ['W2', 3480], ['W3', 3290], ['W4', 3910], ['W5', 4205], ['W6', 4480]],
    monthly: [['Jan', 12400], ['Feb', 14200], ['Mar', 15800], ['Apr', 17100], ['May', 19200], ['Jun', 21300]],
  },
};

const adminUsers = [
  { id: 'u1', name: 'Minh Duc',     email: 'minhduc06062005@gmail.com', username: 'minhduc', phone: '0905 112 233', role: 'trainee', isActive: true,  coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, joined: '2025-11-02', lastActive: '2h ago',  workouts: 142, programs: 2 },
  { id: 'u2', name: 'Coach Hoa',    email: 'hoa@lift.app',             username: 'coachhoa', phone: '0912 334 556', role: 'coach',   isActive: true,  coach: null, joined: '2025-03-14', lastActive: '20m ago', workouts: 0,   programs: 14, clients: 22 },
  { id: 'u3', name: 'Theo Sato',    email: 'theo.sato@gmail.com',      username: 'theos',   phone: '0987 221 009', role: 'trainee', isActive: true,  coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, joined: '2025-09-21', lastActive: '1d ago',  workouts: 88,  programs: 1 },
  { id: 'u4', name: 'Hana Kim',     email: 'hana.kim@gmail.com',       username: 'hanak',   phone: '0933 776 112', role: 'trainee', isActive: false, coach: null, joined: '2025-06-30', lastActive: '23d ago', workouts: 12,  programs: 0 },
  { id: 'u5', name: 'Devon Lee',    email: 'devon@lift.app',           username: 'devonadmin', phone: '0901 555 010', role: 'admin', isActive: true, coach: null, joined: '2024-12-01', lastActive: '5m ago',  workouts: 0,   programs: 0 },
  { id: 'u6', name: 'Priya Anand',  email: 'priya.a@gmail.com',        username: 'priyaa',  phone: '0978 010 234', role: 'trainee', isActive: true,  coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, joined: '2026-01-12', lastActive: '4h ago', workouts: 54, programs: 1 },
  { id: 'u7', name: 'Coach Marco',  email: 'marco@lift.app',           username: 'coachmarco', phone: '0967 889 221', role: 'coach', isActive: true, coach: null, joined: '2025-07-08', lastActive: '3h ago',  workouts: 0,   programs: 9, clients: 11 },
  { id: 'u8', name: 'Sam Okafor',   email: 'sam.ok@gmail.com',         username: 'samok',   phone: '0918 332 447', role: 'trainee', isActive: true,  coach: { name: 'Coach Marco', email: 'marco@lift.app' }, joined: '2025-10-19', lastActive: '6d ago', workouts: 31, programs: 1 },
  { id: 'u9', name: 'Lila Brooks',  email: 'lila.b@gmail.com',         username: 'lilab',   phone: '0902 667 113', role: 'trainee', isActive: true,  coach: null, joined: '2026-02-03', lastActive: '12h ago', workouts: 9, programs: 0 },
];

const adminRequests = [
  { id: 'r1', trainee: { name: 'Lila Brooks', email: 'lila.b@gmail.com' }, coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, status: 'pending',  created: '2026-05-28', note: 'Wants a hypertrophy block.' },
  { id: 'r2', trainee: { name: 'Noah West',   email: 'noah.w@gmail.com' }, coach: { name: 'Coach Marco', email: 'marco@lift.app' }, status: 'pending', created: '2026-05-27', note: 'Returning from injury.' },
  { id: 'r3', trainee: { name: 'Hana Kim',    email: 'hana.kim@gmail.com' }, coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, status: 'approved', created: '2026-05-20', note: '' },
  { id: 'r4', trainee: { name: 'Jon B.',      email: 'jon.b@gmail.com' }, coach: { name: 'Coach Marco', email: 'marco@lift.app' }, status: 'rejected', created: '2026-05-18', note: 'Outside coaching capacity.' },
];

const adminConnections = {
  coaches: [
    { id: 'u2', name: 'Coach Hoa',   email: 'hoa@lift.app',   clients: 22 },
    { id: 'u7', name: 'Coach Marco', email: 'marco@lift.app', clients: 11 },
  ],
  unassignedTrainees: [
    { id: 'u4', name: 'Hana Kim',    email: 'hana.kim@gmail.com' },
    { id: 'u9', name: 'Lila Brooks', email: 'lila.b@gmail.com' },
  ],
  connections: [
    { id: 'c1', trainee: { name: 'Minh Duc', email: 'minhduc06062005@gmail.com' }, coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, since: '2025-11-04' },
    { id: 'c2', trainee: { name: 'Theo Sato', email: 'theo.sato@gmail.com' }, coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, since: '2025-09-22' },
    { id: 'c3', trainee: { name: 'Priya Anand', email: 'priya.a@gmail.com' }, coach: { name: 'Coach Hoa', email: 'hoa@lift.app' }, since: '2026-01-13' },
    { id: 'c4', trainee: { name: 'Sam Okafor', email: 'sam.ok@gmail.com' }, coach: { name: 'Coach Marco', email: 'marco@lift.app' }, since: '2025-10-20' },
  ],
};

const adminPrograms = [
  { id: 'p1', name: 'Cutting Phase Meso 1', difficulty: 'intermediate', weeks: 4, createdBy: { name: 'Coach Hoa', email: 'hoa@lift.app' }, assigned: 8, created: '2026-04-02' },
  { id: 'p2', name: 'Strength Block A',     difficulty: 'advanced',     weeks: 12, createdBy: { name: 'Coach Marco', email: 'marco@lift.app' }, assigned: 5, created: '2026-02-18' },
  { id: 'p3', name: 'Beginner Full Body',   difficulty: 'beginner',     weeks: 8,  createdBy: { name: 'Coach Hoa', email: 'hoa@lift.app' }, assigned: 31, created: '2025-12-01' },
  { id: 'p4', name: 'PPL Hypertrophy',      difficulty: 'intermediate', weeks: 6,  createdBy: { name: 'Coach Marco', email: 'marco@lift.app' }, assigned: 0, created: '2026-05-10' },
  { id: 'p5', name: 'Powerbuilding Hybrid', difficulty: 'advanced',     weeks: 10, createdBy: { name: 'Coach Hoa', email: 'hoa@lift.app' }, assigned: 3, created: '2026-03-22' },
];

const adminExercises = [
  { id: 'e1', name: 'Bench Press', variationName: 'Barbell Flat', muscleGroup: 'Chest', equipment: 'Barbell', isDefault: true, usageCount: 412, createdBy: { name: 'System' } },
  { id: 'e2', name: 'Bench Press', variationName: 'Dumbbell Flat', muscleGroup: 'Chest', equipment: 'Dumbbell', isDefault: false, usageCount: 188, createdBy: { name: 'System' } },
  { id: 'e3', name: 'Bench Press', variationName: 'Incline Smith', muscleGroup: 'Chest', equipment: 'Smith Machine', isDefault: false, usageCount: 96, createdBy: { name: 'Coach Hoa' } },
  { id: 'e4', name: 'Chest Fly', variationName: 'Pec-Deck', muscleGroup: 'Chest', equipment: 'Machine', isDefault: true, usageCount: 142, createdBy: { name: 'System' } },
  { id: 'e5', name: 'Lat Pulldown', variationName: 'Wide Grip', muscleGroup: 'Back', equipment: 'Cable', isDefault: true, usageCount: 366, createdBy: { name: 'System' } },
  { id: 'e6', name: 'Barbell Row', variationName: 'Bentover', muscleGroup: 'Back', equipment: 'Barbell', isDefault: true, usageCount: 254, createdBy: { name: 'System' } },
  { id: 'e7', name: 'Deadlift', variationName: 'Conventional', muscleGroup: 'Back', equipment: 'Barbell', isDefault: true, usageCount: 301, createdBy: { name: 'System' } },
  { id: 'e8', name: 'Barbell Squat', variationName: 'High Bar', muscleGroup: 'Legs', equipment: 'Barbell', isDefault: true, usageCount: 388, createdBy: { name: 'System' } },
  { id: 'e9', name: 'Leg Press', variationName: 'Machine', muscleGroup: 'Legs', equipment: 'Machine', isDefault: true, usageCount: 210, createdBy: { name: 'System' } },
  { id: 'e10', name: 'Romanian Deadlift', variationName: 'Barbell', muscleGroup: 'Legs', equipment: 'Barbell', isDefault: true, usageCount: 176, createdBy: { name: 'Coach Marco' } },
  { id: 'e11', name: 'Overhead Press', variationName: 'Barbell', muscleGroup: 'Shoulders', equipment: 'Barbell', isDefault: true, usageCount: 198, createdBy: { name: 'System' } },
  { id: 'e12', name: 'Lateral Raise', variationName: 'Dumbbell', muscleGroup: 'Shoulders', equipment: 'Dumbbell', isDefault: true, usageCount: 244, createdBy: { name: 'System' } },
  { id: 'e13', name: 'Barbell Curl', variationName: 'Default', muscleGroup: 'Arms', equipment: 'Barbell', isDefault: true, usageCount: 220, createdBy: { name: 'System' } },
  { id: 'e14', name: 'Cable Triceps Extension', variationName: 'Pushdown', muscleGroup: 'Arms', equipment: 'Cable', isDefault: true, usageCount: 232, createdBy: { name: 'System' } },
  { id: 'e15', name: 'Plank', variationName: 'Default', muscleGroup: 'Core', equipment: 'Bodyweight', isDefault: true, usageCount: 134, createdBy: { name: 'System' } },
  { id: 'e16', name: 'Hanging Leg Raise', variationName: 'Default', muscleGroup: 'Core', equipment: 'Bodyweight', isDefault: true, usageCount: 88, createdBy: { name: 'Coach Hoa' } },
];

const adminAudit = [
  { id: 'a1', action: 'user.role.update', entityType: 'user', entityLabel: 'Devon Lee → admin', admin: { name: 'System' }, at: '2026-05-30 09:12' },
  { id: 'a2', action: 'coach_request.approve', entityType: 'request', entityLabel: 'Hana Kim ↔ Coach Hoa', admin: { name: 'Devon Lee' }, at: '2026-05-29 16:40' },
  { id: 'a3', action: 'exercise.import', entityType: 'exercise', entityLabel: '24 variations imported', admin: { name: 'Devon Lee' }, at: '2026-05-29 11:02' },
  { id: 'a4', action: 'program.delete', entityType: 'program', entityLabel: 'Old Bro Split', admin: { name: 'Devon Lee' }, at: '2026-05-28 14:25' },
  { id: 'a5', action: 'user.lock', entityType: 'user', entityLabel: 'Hana Kim', admin: { name: 'Devon Lee' }, at: '2026-05-27 08:50' },
  { id: 'a6', action: 'connection.remove', entityType: 'connection', entityLabel: 'Jon B. ✕ Coach Marco', admin: { name: 'Devon Lee' }, at: '2026-05-26 19:15' },
  { id: 'a7', action: 'user.password.reset', entityType: 'user', entityLabel: 'Theo Sato', admin: { name: 'Devon Lee' }, at: '2026-05-25 10:30' },
];

Object.assign(window, {
  adminStats, adminCharts, adminUsers, adminRequests,
  adminConnections, adminPrograms, adminExercises, adminAudit,
});
