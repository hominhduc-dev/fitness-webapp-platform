import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Plus,
  Calendar,
  Users,
  Clock,
  Dumbbell,
  ChevronRight,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  Search,
} from "lucide-react"
import { coachPrograms, trainees } from "@/lib/mock-data"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

export default function CoachProgramsPage() {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-success/20 text-success border-success/30"
      case "intermediate":
        return "bg-secondary/20 text-secondary border-secondary/30"
      case "advanced":
        return "bg-accent/20 text-accent border-accent/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getAssignedTrainees = (assignedIds?: string[]) => {
    if (!assignedIds) return []
    return trainees.filter((t) => assignedIds.includes(t.id))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            {/* Header */}
            <div className="flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Programs</h1>
                <p className="mt-1 text-sm text-muted-foreground">Quản lý và tạo chương trình tập luyện cho học viên</p>
              </div>
              <Link href="/coach/programs/new">
                <Button className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  <span>Tạo Program</span>
                </Button>
              </Link>
            </div>

            {/* Search */}
            <div className="relative mb-4 sm:mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm kiếm chương trình..." className="pl-10 bg-card border-border h-10 sm:h-11" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl font-bold text-primary sm:text-2xl">{coachPrograms.length}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Programs</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl font-bold text-secondary sm:text-2xl">
                  {coachPrograms.reduce((acc, p) => acc + (p.assignedTo?.length || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">Đang sử dụng</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl font-bold text-accent sm:text-2xl">
                  {coachPrograms.reduce((acc, p) => acc + p.workouts.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">Workouts</p>
              </div>
            </div>

            {/* Programs List */}
            <div className="space-y-3 sm:space-y-4">
              {coachPrograms.map((program) => {
                const assignedTrainees = getAssignedTrainees(program.assignedTo)

                return (
                  <div
                    key={program.id}
                    className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/30"
                  >
                    <div className="p-3 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold sm:text-lg truncate">{program.name}</h3>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${getDifficultyColor(program.difficulty)}`}
                            >
                              {program.difficulty}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 sm:text-sm">{program.description}</p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem className="gap-2 cursor-pointer">
                              <Pencil className="h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer">
                              <Copy className="h-4 w-4" />
                              Nhân bản
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer text-accent">
                              <Trash2 className="h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Program Stats */}
                      <div className="flex flex-wrap gap-3 mt-3 sm:gap-4 sm:mt-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>{program.duration} tuần</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                          <Dumbbell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>{program.workoutsPerWeek} buổi/tuần</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>{program.workouts.length} bài tập</span>
                        </div>
                      </div>

                      {/* Assigned Trainees */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border sm:mt-4 sm:pt-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {assignedTrainees.length > 0 ? (
                            <div className="flex items-center">
                              <div className="flex -space-x-2">
                                {assignedTrainees.slice(0, 3).map((trainee) => (
                                  <Avatar key={trainee.id} className="h-6 w-6 sm:h-7 sm:w-7 border-2 border-card">
                                    <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {trainee.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                              <span className="ml-2 text-xs text-muted-foreground sm:text-sm">
                                {assignedTrainees.length} học viên
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground sm:text-sm">Chưa gán học viên</span>
                          )}
                        </div>

                        <Link href={`/coach/programs/${program.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs sm:text-sm">
                            Chi tiết
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Empty State */}
            {coachPrograms.length === 0 && (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Dumbbell className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Chưa có chương trình nào</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Tạo chương trình tập luyện đầu tiên cho học viên của bạn
                </p>
                <Link href="/coach/programs/new">
                  <Button className="gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4" />
                    Tạo Program
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
