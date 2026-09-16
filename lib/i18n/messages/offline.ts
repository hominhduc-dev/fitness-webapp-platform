export const offlineMessages = {
  en: {
    offlineSync: {
      offline: "Offline",
      offlinePending: (count: number) => `Offline · ${count} to sync`,
      syncing: "Syncing",
      synced: "Synced",
      syncFailed: "Sync failed",
      retrySync: "Retry sync",
      syncFailedDetail: (count: number) =>
        `${count} workout${count === 1 ? "" : "s"} could not be saved to the server. Tap to try again.`,
      workoutUnavailableOffline: "You're offline and this workout hasn't been opened on this device yet. Reconnect to load it.",
    },
  },
  vi: {
    offlineSync: {
      offline: "Offline",
      offlinePending: (count: number) => `Offline · ${count} chờ đồng bộ`,
      syncing: "Đang đồng bộ",
      synced: "Đã đồng bộ",
      syncFailed: "Đồng bộ lỗi",
      retrySync: "Thử đồng bộ lại",
      syncFailedDetail: (count: number) => `${count} buổi tập chưa lưu được lên server. Nhấn để thử lại.`,
      workoutUnavailableOffline: "Bạn đang offline và buổi tập này chưa từng được mở trên thiết bị. Kết nối mạng để tải.",
    },
  },
} as const
