import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ meta: vi.fn(), create: vi.fn(), save: vi.fn() }))
vi.mock('../config/env', () => ({ env: {} }))
vi.mock('./google-connection.service', () => ({ getGoogleAccessToken: vi.fn() }))
vi.mock('./fitness-data/shared/guards', () => ({ assertTrainee: vi.fn(), ensurePrisma: () => ({ programAssignment: { updateMany: mocks.save } }) }))
vi.mock('../lib/google', () => ({ fetchSpreadsheetMeta: mocks.meta, createSpreadsheet: mocks.create, findOrCreateDriveFolder: vi.fn(), moveFileToFolder: vi.fn(), batchUpdateSpreadsheet: vi.fn(), updateSpreadsheetValues: vi.fn() }))
import { ensureTraineeSpreadsheet } from './google-trainee-export.service'
import type { SerializedProfile } from './auth.service'

const profile = { id: 'trainee', name: 'Duc' } as SerializedProfile
describe('one export file per assigned program', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ count: 1 }) })
  it('reuses the original spreadsheet on successive exports', async () => {
    mocks.meta.mockResolvedValue({ sheetProperties: [{ sheetId: 1, title: 'Program' }] })
    const assignment = { id: 'a1', program: { name: 'Bulk' }, traineeGoogleSpreadsheetId: 'original-file' }
    for (let i = 0; i < 2; i++) {
      expect((await ensureTraineeSpreadsheet('token', profile, assignment)).spreadsheetId).toBe('original-file')
    }
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('creates and remembers a separate file for another program', async () => {
    mocks.create.mockResolvedValue({ spreadsheetId: 'second-file', sheetIdsByTitle: new Map([['Program', 1]]) })
    const result = await ensureTraineeSpreadsheet('token', profile, { id: 'a2', program: { name: 'Cut' }, traineeGoogleSpreadsheetId: null })
    expect(result.spreadsheetId).toBe('second-file')
    expect(mocks.save).toHaveBeenCalledWith({ data: { traineeGoogleSpreadsheetId: 'second-file' }, where: { id: 'a2', traineeGoogleSpreadsheetId: null } })
  })
  it('does not create a replacement on permission errors', async () => {
    mocks.meta.mockRejectedValue({ details: { status: 403 } })
    await expect(ensureTraineeSpreadsheet('token', profile, { id: 'a1', program: { name: 'Bulk' }, traineeGoogleSpreadsheetId: 'original-file' })).rejects.toEqual({ details: { status: 403 } })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
