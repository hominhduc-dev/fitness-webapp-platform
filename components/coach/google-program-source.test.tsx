import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { GoogleProgramSource } from "./google-program-source"
import { ImportProgramDialog } from "./import-program-dialog"
const api = vi.hoisted(() => ({ connection: vi.fn(), spreadsheet: vi.fn(), import: vi.fn(), disconnect: vi.fn() }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ locale: "en" }) }))
vi.mock("@/lib/fitness/api", () => ({ fetchGoogleConnection: api.connection, fetchGoogleSpreadsheet: api.spreadsheet, importGoogleProgram: api.import, disconnectGoogle: api.disconnect, authorizeGoogle: vi.fn(), createCoachProgram: vi.fn(), overwriteGoogleProgram: vi.fn(), overwriteNotionProgram: vi.fn(), importNotionProgram: vi.fn(), fetchNotionProgramTemplates: vi.fn().mockResolvedValue({ configured: false, templates: [] }) }))
describe("Google program import UI", () => {
  beforeEach(() => { vi.clearAllMocks() })
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
})
