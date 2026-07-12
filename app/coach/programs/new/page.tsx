"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Dumbbell } from "lucide-react"
import { exercises } from "@/lib/mock-data"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WorkoutDay {
  id: string
  name: string
  exercises: {
    id: string
    exerciseId: string
    sets: number
    reps: number
    restTime: number
  }[]
}

export default function NewProgramPage() {
  const [programName, setProgramName] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("8")
  const [difficulty, setDifficulty] = useState("beginner")
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([
    {
      id: "1",
      name: "Day 1 - Push",
      exercises: [{ id: "1", exerciseId: "1", sets: 4, reps: 8, restTime: 120 }],
    },
  ])

  const addWorkoutDay = () => {
    setWorkoutDays([
      ...workoutDays,
      {
        id: String(Date.now()),
        name: `Day ${workoutDays.length + 1}`,
        exercises: [],
      },
    ])
  }

  const addExercise = (dayId: string) => {
    setWorkoutDays(
      workoutDays.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                { id: String(Date.now()), exerciseId: "1", sets: 3, reps: 10, restTime: 90 },
              ],
            }
          : day,
      ),
    )
  }

  const removeExercise = (dayId: string, exerciseId: string) => {
    setWorkoutDays(
      workoutDays.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.filter((e) => e.id !== exerciseId),
            }
          : day,
      ),
    )
  }

  const removeDay = (dayId: string) => {
    setWorkoutDays(workoutDays.filter((day) => day.id !== dayId))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <Link href="/coach/programs">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold sm:text-2xl">Tạo Program mới</h1>
                <p className="text-sm text-muted-foreground truncate">Thiết kế chương trình tập luyện cho học viên</p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4 sm:space-y-6">
              {/* Basic Info */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-4 sm:text-lg">Thông tin cơ bản</h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm">
                      Tên chương trình
                    </Label>
                    <Input
                      id="name"
                      value={programName}
                      onChange={(e) => setProgramName(e.target.value)}
                      placeholder="VD: Beginner Strength Builder"
                      className="mt-1.5 bg-muted/30 border-border"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm">
                      Mô tả
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Mô tả ngắn về chương trình..."
                      className="mt-1.5 bg-muted/30 border-border min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="duration" className="text-sm">
                        Thời gian (tuần)
                      </Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="mt-1.5 bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {[4, 6, 8, 10, 12, 16].map((w) => (
                            <SelectItem key={w} value={String(w)}>
                              {w} tuần
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="difficulty" className="text-sm">
                        Độ khó
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

              {/* Workout Days */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold sm:text-lg">Các buổi tập</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addWorkoutDay}
                    className="gap-1.5 bg-transparent text-xs sm:text-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm ngày
                  </Button>
                </div>

                <div className="space-y-4">
                  {workoutDays.map((day, dayIndex) => (
                    <div key={day.id} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                      {/* Day Header */}
                      <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border sm:p-4">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <Input
                            value={day.name}
                            onChange={(e) => {
                              setWorkoutDays(
                                workoutDays.map((d) => (d.id === day.id ? { ...d, name: e.target.value } : d)),
                              )
                            }}
                            className="h-8 w-32 sm:w-48 bg-transparent border-0 p-0 font-medium focus-visible:ring-0"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDay(day.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-accent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Exercises */}
                      <div className="p-3 space-y-2 sm:p-4 sm:space-y-3">
                        {day.exercises.map((exercise, exIndex) => (
                          <div
                            key={exercise.id}
                            className="flex flex-col gap-2 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:gap-3"
                          >
                            <Select
                              value={exercise.exerciseId}
                              onValueChange={(value) => {
                                setWorkoutDays(
                                  workoutDays.map((d) =>
                                    d.id === day.id
                                      ? {
                                          ...d,
                                          exercises: d.exercises.map((e) =>
                                            e.id === exercise.id ? { ...e, exerciseId: value } : e,
                                          ),
                                        }
                                      : d,
                                  ),
                                )
                              }}
                            >
                              <SelectTrigger className="flex-1 bg-muted/30 border-border h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border max-h-[200px]">
                                {exercises.map((ex) => (
                                  <SelectItem key={ex.id} value={ex.id}>
                                    {ex.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={exercise.sets}
                                  onChange={(e) => {
                                    setWorkoutDays(
                                      workoutDays.map((d) =>
                                        d.id === day.id
                                          ? {
                                              ...d,
                                              exercises: d.exercises.map((ex) =>
                                                ex.id === exercise.id ? { ...ex, sets: Number(e.target.value) } : ex,
                                              ),
                                            }
                                          : d,
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
                                  onChange={(e) => {
                                    setWorkoutDays(
                                      workoutDays.map((d) =>
                                        d.id === day.id
                                          ? {
                                              ...d,
                                              exercises: d.exercises.map((ex) =>
                                                ex.id === exercise.id ? { ...ex, reps: Number(e.target.value) } : ex,
                                              ),
                                            }
                                          : d,
                                      ),
                                    )
                                  }}
                                  className="w-14 h-9 text-center bg-muted/30 border-border text-sm"
                                />
                                <span className="text-xs text-muted-foreground">reps</span>
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
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Thêm bài tập
                        </Button>
                      </div>
                    </div>
                  ))}

                  {workoutDays.length === 0 && (
                    <div className="text-center py-8">
                      <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Chưa có buổi tập nào. Thêm ngày tập đầu tiên!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Link href="/coach/programs" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full bg-transparent">
                    Hủy
                  </Button>
                </Link>
                <Button className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4" />
                  Lưu Program
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
