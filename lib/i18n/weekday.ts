/**
 * The short weekday label for day strips. Vietnamese uses the compact T2…T7 and
 * CN — `toLocaleDateString`'s "Thứ 2" is too wide for a strip cell and wraps.
 * Other locales keep the platform's short weekday ("Mon", "Tue"…).
 */
export function shortWeekday(date: Date, dateLocale: string) {
  if (dateLocale.startsWith("vi")) {
    const day = date.getDay()
    return day === 0 ? "CN" : `T${day + 1}`
  }
  return date.toLocaleDateString(dateLocale, { weekday: "short" })
}
