const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

const en = {
  eyebrow: "Import program",
  close: "Close",
  sourceTabs: "Import source",
  steps: { done: "Done", review: "Review", upload: "Upload" },
  sources: {
    excel: {
      description: "Upload an Excel file to build a training program.",
      label: "From Excel",
      title: "Create a program from Excel",
    },
    google: {
      description: "Import exercises and build a program from Google Sheets.",
      label: "Google Sheets",
      title: "Create a program from Google Sheets",
    },
  },
  excel: {
    choose: "Choose Excel file",
    downloadTemplate: "Download template",
    dropHint: "or choose a file from your computer",
    dropTitle: "Drop an .xlsx file here",
    supported: "Supports .xlsx and .xls files",
    traineeColumns: "trainee_name · email (optional, to assign)",
    workbookSheets: "Workbook needs these sheets",
  },
  difficulty: { advanced: "Advanced", beginner: "Beginner", intermediate: "Intermediate" },
  days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  review: {
    allValid: "Every variation_id is valid — ready to create.",
    assignCount: (count: number) => plural(count, "trainee"),
    columns: { exercise: "Exercise", id: "ID", kg: "Kg", reps: "Reps", rir: "RIR", sets: "Sets" },
    day: "Day",
    difficulty: "Difficulty",
    exerciseCount: (count: number) => `· ${plural(count, "exercise")}`,
    invalidTitle: "The import file is not valid",
    invalidVariations: "variation_id values are not in the current library.",
    programName: "Program name",
    removeExercise: "Remove exercise",
    statExercises: "exercises",
    statSessions: "sessions",
    statWeeks: "weeks",
    unknownExercise: "Unknown exercise",
    weeks: "Weeks",
  },
  done: {
    created: (name: string) => `Created “${name}”`,
    createdHelp: "The new program was added to your programs.",
    overwritten: (name: string) => `Overwrote “${name}”`,
    overwrittenHelp: "The earlier program's sessions were replaced. Trainees following it keep going.",
  },
  actions: { back: "Back", cancel: "Cancel", create: "Create program", creating: "Creating...", finish: "Done" },
  errors: {
    create: "Could not create the program.",
    excelRead: "Could not read the Excel file.",
    template: "Could not build the Excel template.",
  },
}

// Typed against `en`, so a key added to one language and not the other fails typecheck.
const vi: typeof en = {
  eyebrow: "Import program",
  close: "Đóng",
  sourceTabs: "Nguồn import",
  steps: { done: "Done", review: "Review", upload: "Upload" },
  sources: {
    excel: {
      description: "Nhập file Excel để tạo chương trình tập luyện.",
      label: "Từ file Excel",
      title: "Tạo program từ Excel",
    },
    google: {
      description: "Import bài tập và tạo program từ Google Sheets.",
      label: "Google Sheets",
      title: "Tạo program từ Google Sheets",
    },
  },
  excel: {
    choose: "Chọn file Excel",
    downloadTemplate: "Tải template mẫu",
    dropHint: "hoặc bấm để chọn file từ máy tính",
    dropTitle: "Kéo file .xlsx vào đây",
    supported: "Hỗ trợ file .xlsx và .xls",
    traineeColumns: "trainee_name · email (tùy chọn, để gán)",
    workbookSheets: "Workbook cần các sheet",
  },
  difficulty: { advanced: "Advanced", beginner: "Beginner", intermediate: "Intermediate" },
  days: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
  review: {
    allValid: "Tất cả variation_id hợp lệ - sẵn sàng tạo.",
    assignCount: (count: number) => `${count} trainee`,
    columns: { exercise: "Bài tập", id: "ID", kg: "Kg", reps: "Reps", rir: "RIR", sets: "Sets" },
    day: "Ngày",
    difficulty: "Độ khó",
    exerciseCount: (count: number) => `· ${count} bài`,
    invalidTitle: "File import chưa hợp lệ",
    invalidVariations: "variation_id không có trong thư viện hiện tại.",
    programName: "Tên program",
    removeExercise: "Xoá bài tập",
    statExercises: "bài tập",
    statSessions: "buổi",
    statWeeks: "tuần",
    unknownExercise: "Bài tập không xác định",
    weeks: "Số tuần",
  },
  done: {
    created: (name: string) => `Đã tạo “${name}”`,
    createdHelp: "Program mới đã được thêm vào danh sách của coach.",
    overwritten: (name: string) => `Đã ghi đè “${name}”`,
    overwrittenHelp: "Buổi tập của program cũ đã được thay mới. Trainee đang theo vẫn giữ nguyên.",
  },
  actions: { back: "Lại", cancel: "Hủy", create: "Tạo program", creating: "Đang tạo...", finish: "Xong" },
  errors: {
    create: "Không thể tạo program.",
    excelRead: "Không đọc được file Excel.",
    template: "Không tạo được template Excel.",
  },
}

export const programImportMessages = { en, vi }
