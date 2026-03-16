"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Dumbbell, GripVertical, Plus, Save, Trash2, Users } from "lucide-react"
import { useEffect, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createCoachProgram,
  deleteCoachProgram,
  fetchCoachProgram,
  fetchExercises,
  updateCoachProgram,
} from "@/lib/fitness/api"
import type { CoachProgram } from "@/lib/fitness/types"
import type { Exercise } from "@/lib/types"

type WorkoutExerciseForm = {
  exerciseId: string
  id: string
  reps: number
  restTime: number
  sets: number
}

type WorkoutDay = {
  exercises: WorkoutExerciseForm[]
  id: string
  name: string
  scheduledDay: string
}

type ProgramEditorProps = {
  programId?: string
}

const DAY_OPTIONS = [
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
  { label: "Sunday", value: "0" },
]

function createWorkoutDay(index: number): WorkoutDay {
  return {
    exercises: [],
    id: String(Date.now() + index),
    name: `Day ${index + 1}`,
    scheduledDay: String((index + 1) % 7),
  }
}

function estimateWorkoutDuration(exercises: WorkoutExerciseForm[]) {
  if (exercises.length === 0) {
    return 30
  }

  return Math.max(
    30,
    Math.round(exercises.reduce((sum, exercise) => sum + exercise.sets * (exercise.restTime / 60 + 2), 0)),
  )
}

function mapProgramToWorkoutDays(program: CoachProgram): WorkoutDay[] {
  return program.workouts.map((workout, index) => ({
    exercises: workout.exercises.map((exercise) => ({
      exerciseId: exercise.exercise.id,
      id: exercise.id,
      reps: exercise.sets[0]?.targetReps ?? 1,
      restTime: exercise.restTime ?? 90,
      sets: exercise.sets.length,
    })),
    id: workout.id,
    name: workout.name,
    scheduledDay: String(workout.scheduledDay ?? ((index + 1) % 7)),
  }))
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export function ProgramEditor({ programId }: ProgramEditorProps) {
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuth()
  const [programName, setProgramName] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("8")
  const [difficulty, setDifficulty] = useState("beginner")
  const [exerciseOptions, setExerciseOptions] = useState<Exercise[]>([])
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([createWorkoutDay(0)])
  const [currentProgram, setCurrentProgram] = useState<CoachProgram | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.access_token) {
      if (!authLoading) {
        setIsLoadingPage(false)
      }

      return
    }

    let cancelled = false

    const loadPage = async () => {
      setIsLoadingPage(true)
      setError(null)

      try {
        const [exercises, program] = await Promise.all([
          fetchExercises(session.access_token),
          programId ? fetchCoachProgram(session.access_token, programId) : Promise.resolve(null),
        ])

        if (cancelled) {
          return
        }

        setExerciseOptions(exercises)

        if (program) {
          setCurrentProgram(program)
          setProgramName(program.name)
          setDescription(program.description ?? "")
          setDuration(String(program.duration))
          setDifficulty(program.difficulty)
          setWorkoutDays(mapProgramToWorkoutDays(program))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu program.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false)
        }
      }
    }

    void loadPage()

    return () => {
      cancelled = true
    }
  }, [authLoading, programId, session?.access_token])

  const addWorkoutDay = () => {
    setWorkoutDays((current) => [...current, createWorkoutDay(current.length)])
  }

  const addExercise = (dayId: string) => {
    const defaultExerciseId = exerciseOptions[0]?.id

    if (!defaultExerciseId) {
      setError("Chưa có bài tập nào trong thư viện để thêm vào program.")
      return
    }

    setWorkoutDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  exerciseId: defaultExerciseId,
                  id: String(Date.now()),
                  reps: 10,
                  restTime: 90,
                  sets: 3,
                },
              ],
            }
          : day,
      ),
    )
  }

  const removeExercise = (dayId: string, exerciseId: string) => {
    setWorkoutDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.filter((exercise) => exercise.id !== exerciseId),
            }
          : day,
      ),
    )
  }

  const removeDay = (dayId: string) => {
    setWorkoutDays((current) => current.filter((day) => day.id !== dayId))
  }

  const buildProgramPayload = () => ({
    description: description.trim() || undefined,
    difficulty: difficulty as "beginner" | "intermediate" | "advanced",
    duration: Number(duration),
    name: programName.trim(),
    workouts: workoutDays
      .map((day, index) => ({
        duration: estimateWorkoutDuration(day.exercises),
        exercises: day.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          reps: exercise.reps,
          restTime: exercise.restTime,
          sets: exercise.sets,
        })),
        name: day.name.trim() || `Day ${index + 1}`,
        scheduledDay: Number(day.scheduledDay),
      }))
      .filter((day) => day.exercises.length > 0),
  })

  const handleSaveProgram = async () => {
    if (!session?.access_token) {
      return
    }

    const payload = buildProgramPayload()

    if (!payload.name) {
      setError("Tên chương trình không được để trống.")
      return
    }

    if (payload.workouts.length === 0) {
      setError("Program cần ít nhất một buổi tập có bài tập.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const savedProgram = programId
        ? await updateCoachProgram(session.access_token, programId, payload)
        : await createCoachProgram(session.access_token, payload)

      if (programId) {
        setCurrentProgram(savedProgram)
      }

      router.push(`/coach/programs/${savedProgram.id}`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu program.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProgram = async () => {
    if (!session?.access_token || !programId) {
      return
    }

    const confirmed = window.confirm("Delete this program? This will remove all workouts under it.")

    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteCoachProgram(session.access_token, programId)
      router.push("/coach/programs")
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa program.")
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoadingPage) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading program...</div>
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <Link href="/coach/programs">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold sm:text-2xl">
                  {programId ? currentProgram?.name || "Program Details" : "Create new program"}
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  {programId ? "Update or remove this saved program" : "Save directly to Prisma/Postgres"}
                </p>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {currentProgram?.assignedTrainees.length ? (
              <div className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold sm:text-lg">Assigned Trainees</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {currentProgram.assignedTrainees.map((trainee) => (
                    <Link
                      key={trainee.id}
                      href={`/coach/trainees/${trainee.id}`}
                      className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:border-primary/30"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs">{getInitials(trainee.name)}</AvatarFallback>
                      </Avatar>
                      <span>{trainee.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-4 sm:text-lg">Basic Information</h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm">
                      Program name
                    </Label>
                    <Input
                      id="name"
                      value={programName}
                      onChange={(event) => setProgramName(event.target.value)}
                      placeholder="e.g. Beginner Strength Builder"
                      className="mt-1.5 bg-muted/30 border-border"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Short summary of the program..."
                      className="mt-1.5 bg-muted/30 border-border min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="duration" className="text-sm">
                        Duration (weeks)
                      </Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="mt-1.5 bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {[4, 6, 8, 10, 12, 16].map((weekCount) => (
                            <SelectItem key={weekCount} value={String(weekCount)}>
                              {weekCount} weeks
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="difficulty" className="text-sm">
                        Difficulty
                      </Label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger className="mt-1.5 bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold sm:text-lg">Workout Days</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addWorkoutDay}
                    className="gap-1.5 bg-transparent text-xs sm:text-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add day
                  </Button>
                </div>

                <div className="space-y-4">
                  {workoutDays.map((day) => (
                    <div key={day.id} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                      <div className="flex flex-col gap-3 p-3 bg-muted/30 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:p-4">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <Input
                            value={day.name}
                            onChange={(event) => {
                              setWorkoutDays((current) =>
                                current.map((item) => (item.id === day.id ? { ...item, name: event.target.value } : item)),
                              )
                            }}
                            className="h-8 w-32 sm:w-48 bg-transparent border-0 p-0 font-medium focus-visible:ring-0"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={day.scheduledDay}
                            onValueChange={(value) => {
                              setWorkoutDays((current) =>
                                current.map((item) => (item.id === day.id ? { ...item, scheduledDay: value } : item)),
                              )
                            }}
                          >
                            <SelectTrigger className="h-8 w-[140px] bg-card border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {DAY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDay(day.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-accent"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-3 space-y-2 sm:p-4 sm:space-y-3">
                        {day.exercises.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="flex flex-col gap-2 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:gap-3"
                          >
                            <Select
                              value={exercise.exerciseId}
                              onValueChange={(value) => {
                                setWorkoutDays((current) =>
                                  current.map((item) =>
                                    item.id === day.id
                                      ? {
                                          ...item,
                                          exercises: item.exercises.map((entry) =>
                                            entry.id === exercise.id ? { ...entry, exerciseId: value } : entry,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }}
                            >
                              <SelectTrigger className="flex-1 bg-muted/30 border-border h-9 text-sm">
                                <SelectValue placeholder="Choose exercise" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border max-h-[200px]">
                                {exerciseOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={exercise.sets}
                                  min={1}
                                  onChange={(event) => {
                                    setWorkoutDays((current) =>
                                      current.map((item) =>
                                        item.id === day.id
                                          ? {
                                              ...item,
                                              exercises: item.exercises.map((entry) =>
                                                entry.id === exercise.id
                                                  ? { ...entry, sets: Number(event.target.value) || 1 }
                                                  : entry,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }}
                                  className="w-14 h-9 text-center bg-muted/30 border-border text-sm"
                                />
                                <span className="text-xs text-muted-foreground">sets</span>
                              </div>
                              <span className="text-muted-foreground">×</span>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={exercise.reps}
                                  min={1}
                                  onChange={(event) => {
                                    setWorkoutDays((current) =>
                                      current.map((item) =>
                                        item.id === day.id
                                          ? {
                                              ...item,
                                              exercises: item.exercises.map((entry) =>
                                                entry.id === exercise.id
                                                  ? { ...entry, reps: Number(event.target.value) || 1 }
                                                  : entry,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }}
                                  className="w-14 h-9 text-center bg-muted/30 border-border text-sm"
                                />
                                <span className="text-xs text-muted-foreground">reps</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={exercise.restTime}
                                  min={0}
                                  onChange={(event) => {
                                    setWorkoutDays((current) =>
                                      current.map((item) =>
                                        item.id === day.id
                                          ? {
                                              ...item,
                                              exercises: item.exercises.map((entry) =>
                                                entry.id === exercise.id
                                                  ? { ...entry, restTime: Number(event.target.value) || 0 }
                                                  : entry,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }}
                                  className="w-16 h-9 text-center bg-muted/30 border-border text-sm"
                                />
                                <span className="text-xs text-muted-foreground">sec</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExercise(day.id, exercise.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-accent shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addExercise(day.id)}
                          className="w-full gap-1.5 bg-transparent border-dashed text-xs sm:text-sm"
                          disabled={exerciseOptions.length === 0}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add exercise
                        </Button>
                      </div>
                    </div>
                  ))}

                  {workoutDays.length === 0 ? (
                    <div className="text-center py-8">
                      <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No workout days yet. Add the first day to continue.</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {programId ? (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void handleDeleteProgram()}
                    disabled={isDeleting || isSaving}
                  >
                    {isDeleting ? "Deleting..." : "Delete Program"}
                  </Button>
                ) : null}
                <Link href="/coach/programs" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full bg-transparent">
                    Cancel
                  </Button>
                </Link>
                <Button className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90" onClick={() => void handleSaveProgram()} disabled={isSaving}>
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : programId ? "Update Program" : "Save Program"}
                </Button>
              </div>
            </div>
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
