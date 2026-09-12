import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { renderWithProviders as baseRender } from "@/lib/queries/test-utils"
import { ToastProvider } from "@/components/providers/toast-provider"
import { GoogleProgramSource } from "./google-program-source"
import { ImportProgramDialog } from "./import-program-dialog"
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: { id: "coach-1" } }) }))
vi.mock("@/lib/queries/token", () => ({ requireAccessToken: vi.fn().mockResolvedValue("test") }))
const api = vi.hoisted(() => ({ connection: vi.fn(), spreadsheet: vi.fn(), import: vi.fn(), disconnect: vi.fn(), createTemplate: vi.fn() }))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: { common: { dismissNotification: "Dismiss notification" } } }),
}))
vi.mock("@/lib/fitness/api", () => ({ fetchGoogleConnection: api.connection, fetchGoogleSpreadsheet: api.spreadsheet, importGoogleProgram: api.import, disconnectGoogle: api.disconnect, createGoogleProgramTemplate: api.createTemplate, authorizeGoogle: vi.fn(), createCoachProgram: vi.fn(), overwriteGoogleProgram: vi.fn(), overwriteNotionProgram: vi.fn(), importNotionProgram: vi.fn(), fetchNotionProgramTemplates: vi.fn().mockResolvedValue({ configured: false, templates: [] }) }))
/** Toasts now come from the shared provider, so every render needs it. */
const render: typeof baseRender = (ui, options) => baseRender(<ToastProvider>{ui}</ToastProvider>, options)

describe("Google program import UI", () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(cleanup)
  it("hides the Google tab when the backend is unconfigured", async () => {
    api.connection.mockResolvedValue({ configured: false, connected: false, email: null })
    render(<ImportProgramDialog open token="test" exerciseOptions={[]} trainees={[]} onClose={vi.fn()} onImported={vi.fn()} />)
    await waitFor(() => expect(api.connection).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: "Google Sheets" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Connect Google" })).not.toBeInTheDocument()
  })
  it("loads sheets and passes selected template plus weeks to the shared preview", async () => {
    const onImport = vi.fn()
    const result = { spreadsheetId: "id", sheetName: "Week 1", rows: [], existingProgram: null }
    api.spreadsheet.mockResolvedValue({ spreadsheetId: "id", title: "Training", sheets: ["Exercise Table", "Week 1"] })
    api.import.mockResolvedValue(result)
    render(<GoogleProgramSource token="test" connection={{ configured: true, connected: true, email: "coach@example.invalid" }} onConnection={vi.fn()} onImport={onImport} />)
    fireEvent.change(screen.getByLabelText("Spreadsheet link"), { target: { value: "sheet-link" } })
    fireEvent.click(screen.getByRole("button", { name: "Load sheets" }))
    await screen.findByLabelText("Template week sheet")
    // The picker is the app's own Select, so the chosen sheet shows as the
    // trigger's text rather than a form value.
    expect(screen.getByLabelText("Template week sheet")).toHaveTextContent("Week 1")
    fireEvent.click(screen.getByRole("button", { name: "Preview program" }))
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(result, "Training", 4))
  })
  it("creates a template in Drive and prefills its link so the coach can import it straight back", async () => {
    api.createTemplate.mockResolvedValue({
      exerciseCount: 12,
      folderName: "YeahBuddy program templates",
      sheetName: "Week 1",
      spreadsheetId: "new-id",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/new-id/edit",
      title: "Program template",
    })
    render(<GoogleProgramSource token="test" connection={{ configured: true, connected: true, email: "coach@example.invalid" }} onConnection={vi.fn()} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Create template in Google Sheets" }))
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalled())
    expect(screen.getByLabelText("Spreadsheet link")).toHaveValue("https://docs.google.com/spreadsheets/d/new-id/edit")
    expect(screen.getByRole("link", { name: "Open the new template" })).toHaveAttribute("href", "https://docs.google.com/spreadsheets/d/new-id/edit")

    // The coach is told it worked, and where it went.
    const success = await screen.findByRole("status")
    expect(success).toHaveTextContent("Template created")
    expect(success).toHaveTextContent("saved to YeahBuddy program templates")
  })

  it("sends the chosen Drive folder, and reports a failure without losing the reason", async () => {
    api.createTemplate.mockRejectedValue(new Error("Đã tạo template nhưng không chuyển được vào thư mục đã chọn."))
    render(<GoogleProgramSource token="test" connection={{ configured: true, connected: true, email: "coach@example.invalid" }} onConnection={vi.fn()} onImport={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Drive folder (optional)"), { target: { value: "https://drive.google.com/drive/folders/abc123xyz789" } })
    fireEvent.click(screen.getByRole("button", { name: "Create template in Google Sheets" }))

    await waitFor(() => expect(api.createTemplate).toHaveBeenCalledWith("test", { folder: "https://drive.google.com/drive/folders/abc123xyz789" }))

    const failure = await screen.findByRole("alert")
    expect(failure).toHaveTextContent("Could not create the template")
    expect(failure).toHaveTextContent("không chuyển được vào thư mục")

    // It stays until dismissed, because the reason names something to go and fix.
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }))
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  })
})
