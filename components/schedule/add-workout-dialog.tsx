"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, X } from "lucide-react"
import { exercises as allExercises, sampleWorkouts } from "@/lib/mock-data"
import type { Workout, Exercise } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AddWorkoutDialogProps {
  open: boolean
  selectedDay: number | null
  onClose: () => void
  onSubmit: (workout: Workout, day: number) => void
  onSelectTemplate: (workout: Workout, day: number) => void
}

export function AddWorkoutDialog({
  open,
  selectedDay,
  onClose,
  onSubmit,
  onSelectTemplate,
}: AddWorkoutDialogProps) {
  const [workoutName, setWorkoutName] = useState("")
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([])
  const [workoutNotes, setWorkoutNotes] = useState("")

  const calculateDuration = () => {
    if (selectedExercises.length === 0) return 0
    const totalSets = selectedExercises.reduce((sum, ex) => {
      const exercise = allExercises.find((e) => e.id === ex.id)
      return sum + 4 // Assume 4 sets per exercise
    }, 0)
    // Rough estimate: 2 minutes per set + 15 minutes setup
    return Math.ceil((totalSets * 2.5) + 15)
  }

  const handleAddExercise = (exercise: Exercise) => {
    if (!selectedExercises.find((e) => e.id === exercise.id)) {
      setSelectedExercises([...selectedExercises, exercise])
    }
  }

  const handleRemoveExercise = (exerciseId: string) => {
    setSelectedExercises(selectedExercises.filter((e) => e.id !== exerciseId))
  }

  const handleCreateWorkout = () => {
    if (!workoutName || selectedExercises.length === 0 || selectedDay === null) return

    const newWorkout: Workout = {
      id: `new-${Date.now()}`,
      name: workoutName,
      duration: calculateDuration(),
      exercises: selectedExercises.map((ex, idx) => ({
        id: `${idx}`,
        exercise: ex,
        sets: [
          { id: "1", setNumber: 1, targetReps: 8, weight: 0, completed: false },
          { id: "2", setNumber: 2, targetReps: 8, weight: 0, completed: false },
          { id: "3", setNumber: 3, targetReps: 8, weight: 0, completed: false },
          { id: "4", setNumber: 4, targetReps: 8, weight: 0, completed: false },
        ],
        restTime: 90,
      })),
      notes: workoutNotes,
    }

    onSubmit(newWorkout, selectedDay)

    // Reset form
    setWorkoutName("")
    setSelectedExercises([])
    setWorkoutNotes("")
    onClose()
  }

  const handleSelectTemplate = (template: Workout) => {
    if (selectedDay === null) return
    onSelectTemplate(template, selectedDay)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Workout to {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][selectedDay ?? 0]}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Create New</TabsTrigger>
            <TabsTrigger value="template">From Template</TabsTrigger>
          </TabsList>

          {/* Create New Workout Tab */}
          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Workout Name</label>
              <Input
                placeholder="e.g. Chest Day, Upper Body Push"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Exercises</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded-lg bg-surface">
                {allExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => handleAddExercise(exercise)}
                    disabled={selectedExercises.some((e) => e.id === exercise.id)}
                    className={cn(
                      "p-2 rounded-lg border text-left text-sm transition-all",
                      selectedExercises.some((e) => e.id === exercise.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/30",
                      selectedExercises.some((e) => e.id === exercise.id) && "cursor-default opacity-60",
                    )}
                  >
                    <p className="font-medium">{exercise.name}</p>
                    <p className="text-xs text-muted-foreground">{exercise.muscleGroup}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedExercises.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Exercises ({selectedExercises.length})</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className="flex items-center justify-between bg-surface p-3 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-medium text-sm">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">{exercise.muscleGroup}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveExercise(exercise.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Duration: {calculateDuration()} min</label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes about this workout..."
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                className="min-h-20 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkout}
                disabled={!workoutName || selectedExercises.length === 0}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Workout
              </Button>
            </div>
          </TabsContent>

          {/* From Template Tab */}
          <TabsContent value="template" className="space-y-4 mt-4">
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {sampleWorkouts.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border border-border rounded-lg bg-card hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold group-hover:text-primary transition-colors">{template.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.exercises.length} exercises · {template.duration} min
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 flex-shrink-0">
                      Select
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(template.exercises.map((e) => e.exercise.muscleGroup))].map((group) => (
                        <span key={group} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {group}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {template.exercises.map((e) => e.exercise.name).join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
