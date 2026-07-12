"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth/auth-modal"
import { ArrowRight, Dumbbell, Users, Apple } from "lucide-react"

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<"login" | "register">("login")

  const openLogin = () => {
    setAuthTab("login")
    setAuthOpen(true)
  }

  const openRegister = () => {
    setAuthTab("register")
    setAuthOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-secondary/10 via-transparent to-transparent" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6 md:px-12">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
              <DumbbellIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight">YeahBuddy</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              onClick={openLogin}
              className="text-foreground hover:text-primary px-2 sm:px-4 text-sm sm:text-base"
            >
              <span className="hidden xs:inline">Đăng nhập</span>
              <span className="xs:hidden">Đăng nhập</span>
            </Button>
            <Button
              onClick={openRegister}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 text-sm sm:text-base whitespace-nowrap"
            >
              <span className="hidden sm:inline">Bắt đầu ngay</span>
              <span className="sm:hidden">Bắt đầu</span>
            </Button>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-20 md:px-12 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              Nền tảng fitness #1 Việt Nam
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl text-balance">
              Nâng tầm{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                sức mạnh
              </span>
              <br />
              của bạn
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl text-pretty">
              Theo dõi workout, quản lý dinh dưỡng, và kết nối với huấn luyện viên chuyên nghiệp. Tất cả trong một ứng
              dụng.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={openRegister}
                className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg shadow-lg shadow-primary/25"
              >
                Tạo tài khoản miễn phí
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={openLogin}
                className="h-14 px-8 border-border bg-card/50 hover:bg-card text-foreground font-semibold text-lg"
              >
                Đã có tài khoản?
              </Button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 px-6 pb-20 md:px-12">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="group rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Workout Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Ghi lại mọi bài tập với chi tiết sets, reps, và trọng lượng. Theo dõi tiến độ theo thời gian.
                </p>
              </div>

              <div className="group rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-all group-hover:bg-secondary group-hover:text-secondary-foreground">
                  <Apple className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Nutrition Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Theo dõi calories và macros hàng ngày. Đạt được mục tiêu dinh dưỡng dễ dàng hơn.
                </p>
              </div>

              <div className="group rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all group-hover:bg-accent group-hover:text-accent-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Coach Connection</h3>
                <p className="text-sm text-muted-foreground">
                  Kết nối với huấn luyện viên chuyên nghiệp. Nhận lịch tập và hướng dẫn cá nhân hóa.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 border-t border-border bg-card/30 px-6 py-12 md:px-12">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary md:text-4xl">50K+</div>
              <div className="text-sm text-muted-foreground">Người dùng</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary md:text-4xl">1M+</div>
              <div className="text-sm text-muted-foreground">Workouts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent md:text-4xl">500+</div>
              <div className="text-sm text-muted-foreground">Coaches</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground md:text-4xl">4.9★</div>
              <div className="text-sm text-muted-foreground">Đánh giá</div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </div>
  )
}

function DumbbellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.828-2.829l6.364-6.364a2 2 0 1 1 2.829 2.828l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="m21.5 21.5-1.4-1.4" />
      <path d="M3.9 3.9 2.5 2.5" />
      <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.828 2.829z" />
    </svg>
  )
}
