type InstallStep = { body: string; title: string }

type InstallCopy = {
  androidButton: string
  androidSteps: InstallStep[]
  androidTitle: string
  benefits: Array<{ body: string; title: string }>
  benefitsTitle: string
  copied: string
  copyLink: string
  description: string
  home: string
  inAppBody: string
  inAppSteps: InstallStep[]
  inAppTitle: string
  installedBody: string
  installedTitle: string
  iosOtherNote: string
  iosSteps: InstallStep[]
  iosTitle: string
  openApp: string
  prompt: { body: string; fullGuide: string; later: string; neverAgain: string; title: string }
  tabAndroid: string
  tabIphone: string
  title: string
  troubleshooting: Array<{ answer: string; question: string }>
  troubleshootingTitle: string
}

const vi: InstallCopy = {
  title: "Thêm YeahBuddy vào Màn hình chính",
  description:
    "Cài YeahBuddy như một ứng dụng trên điện thoại: mở bằng một chạm, chạy toàn màn hình và nhận thông báo nhắc tập.",
  home: "Về trang chủ",
  tabIphone: "iPhone / iPad",
  tabAndroid: "Android",
  benefitsTitle: "Vì sao nên thêm vào Màn hình chính?",
  benefits: [
    { title: "Mở bằng một chạm", body: "Icon YeahBuddy nằm cạnh các app khác, không cần gõ địa chỉ." },
    { title: "Toàn màn hình", body: "Không còn thanh địa chỉ, giao diện gọn như app thật." },
    { title: "Nhận thông báo", body: "Trên iPhone, thông báo nhắc tập và tin từ coach chỉ hoạt động khi mở từ Màn hình chính." },
  ],
  iosTitle: "Trên iPhone / iPad (Safari)",
  iosSteps: [
    { title: "Mở trang này bằng Safari", body: "Safari là trình duyệt có biểu tượng la bàn màu xanh." },
    {
      title: "Mở menu Chia sẻ",
      body: "iOS 26 trở lên: nhấn nút menu (≡ hoặc •••) ở bên trái thanh địa chỉ dưới cùng, rồi chọn Chia sẻ. iOS cũ hơn: nhấn biểu tượng hình vuông có mũi tên hướng lên ở thanh dưới cùng (iPad: góc trên bên phải).",
    },
    { title: "Chọn “Thêm vào MH chính”", body: "Kéo danh sách lên, hoặc nhấn “Xem thêm”, nếu chưa thấy dòng này." },
    { title: "Nhấn “Thêm”", body: "Nếu có tuỳ chọn mở dưới dạng ứng dụng web, hãy giữ nó bật." },
    {
      title: "Mở YeahBuddy từ icon mới",
      body: "Đăng nhập nếu được hỏi, rồi vào Hồ sơ để bật thông báo.",
    },
  ],
  iosOtherNote:
    "Bạn đang dùng trình duyệt khác Safari. Trên iOS 16.4 trở lên vẫn làm được: nhấn nút Chia sẻ (thường cạnh thanh địa chỉ hoặc trong menu) rồi chọn “Thêm vào MH chính”. Nếu không thấy, hãy sao chép link và mở bằng Safari.",
  androidTitle: "Trên Android (Chrome)",
  androidButton: "Cài đặt YeahBuddy",
  androidSteps: [
    { title: "Mở trang này bằng Chrome", body: "Hoặc trình duyệt mặc định của máy (Samsung Internet, Edge…)." },
    { title: "Nhấn nút ⋮ ở góc trên bên phải", body: "Nếu đã thấy nút “Cài đặt YeahBuddy” ở trên, chỉ cần nhấn nút đó." },
    { title: "Chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”", body: "Tên mục khác nhau tuỳ máy." },
    { title: "Xác nhận “Cài đặt”", body: "Icon YeahBuddy sẽ xuất hiện ở màn hình chính và ngăn kéo ứng dụng." },
  ],
  inAppTitle: "Bạn đang mở trong trình duyệt của ứng dụng khác",
  inAppBody:
    "Zalo, Facebook, Messenger và các app tương tự không cho thêm trang web vào Màn hình chính. Hãy mở link này bằng Safari (iPhone) hoặc Chrome (Android) trước.",
  inAppSteps: [
    { title: "Nhấn nút ••• hoặc ⋮ ở góc màn hình", body: "Nút này thường ở góc trên hoặc dưới bên phải." },
    { title: "Chọn “Mở bằng trình duyệt”", body: "Hoặc “Mở trong Safari” / “Mở trong Chrome”. Nếu không có, nhấn Sao chép link bên dưới rồi dán vào Safari hoặc Chrome." },
  ],
  copyLink: "Sao chép link",
  copied: "Đã sao chép",
  installedTitle: "YeahBuddy đã có trên Màn hình chính",
  installedBody: "Bạn đang mở YeahBuddy từ icon trên màn hình chính, không cần làm gì thêm.",
  openApp: "Vào ứng dụng",
  prompt: {
    title: "Thêm YeahBuddy vào Màn hình chính",
    body: "Mở app bằng một chạm, chạy toàn màn hình và nhận thông báo nhắc tập.",
    fullGuide: "Xem hướng dẫn chi tiết",
    later: "Để sau",
    neverAgain: "Không nhắc lại",
  },
  troubleshootingTitle: "Không làm được?",
  troubleshooting: [
    {
      question: "Không thấy “Thêm vào MH chính”",
      answer: "Kiểm tra bạn đang dùng Safari, không phải trình duyệt trong Zalo hay Facebook. Trên iOS 26 trở lên, nút Chia sẻ nằm trong menu ≡ / ••• cạnh thanh địa chỉ. Trong danh sách chia sẻ, kéo lên hết hoặc nhấn “Xem thêm” / “Sửa tác vụ” để tìm mục này.",
    },
    {
      question: "Mở app từ icon lại bắt đăng nhập",
      answer: "Trên iPhone, app ở Màn hình chính có bộ nhớ riêng với Safari nên có thể cần đăng nhập lại một lần.",
    },
    {
      question: "Vẫn không nhận được thông báo",
      answer: "Mở YeahBuddy từ icon (không phải từ Safari), vào Hồ sơ và bật thông báo, rồi cho phép khi iPhone hỏi. Kiểm tra Cài đặt › Thông báo › YeahBuddy.",
    },
  ],
}

const en: InstallCopy = {
  title: "Add YeahBuddy to your Home Screen",
  description:
    "Install YeahBuddy like an app on your phone: one tap to open, full screen, and workout reminders.",
  home: "Back to home",
  tabIphone: "iPhone / iPad",
  tabAndroid: "Android",
  benefitsTitle: "Why add it to your Home Screen?",
  benefits: [
    { title: "One tap to open", body: "The YeahBuddy icon sits next to your other apps, no address to type." },
    { title: "Full screen", body: "No address bar, so it feels like a real app." },
    { title: "Notifications", body: "On iPhone, workout reminders and coach messages only work when opened from the Home Screen." },
  ],
  iosTitle: "On iPhone / iPad (Safari)",
  iosSteps: [
    { title: "Open this page in Safari", body: "Safari is the browser with the blue compass icon." },
    {
      title: "Open the Share menu",
      body: "iOS 26 and later: tap the menu button (≡ or •••) on the left of the address bar at the bottom, then Share. Older iOS: tap the square with an arrow pointing up in the bottom bar (iPad: top right).",
    },
    { title: "Choose “Add to Home Screen”", body: "Scroll the list up, or tap “View More”, if you can't see it yet." },
    { title: "Tap “Add”", body: "If there is an option to open as a web app, keep it on." },
    { title: "Open YeahBuddy from the new icon", body: "Sign in if asked, then turn on notifications in Profile." },
  ],
  iosOtherNote:
    "You're not using Safari. On iOS 16.4 and later it still works: tap the Share button (usually next to the address bar or in its menu), then “Add to Home Screen”. If it isn't there, copy the link and open it in Safari.",
  androidTitle: "On Android (Chrome)",
  androidButton: "Install YeahBuddy",
  androidSteps: [
    { title: "Open this page in Chrome", body: "Or your phone's default browser (Samsung Internet, Edge…)." },
    { title: "Tap ⋮ in the top right", body: "If you already see the “Install YeahBuddy” button above, just tap that." },
    { title: "Choose “Install app” or “Add to Home screen”", body: "The wording varies by phone." },
    { title: "Confirm “Install”", body: "The YeahBuddy icon appears on your Home Screen and in the app drawer." },
  ],
  inAppTitle: "You're inside another app's browser",
  inAppBody:
    "Zalo, Facebook, Messenger and similar apps can't add websites to the Home Screen. Open this link in Safari (iPhone) or Chrome (Android) first.",
  inAppSteps: [
    { title: "Tap ••• or ⋮ in a corner of the screen", body: "It is usually in the top or bottom right." },
    { title: "Choose “Open in browser”", body: "Or “Open in Safari” / “Open in Chrome”. If there's no such option, tap Copy link below and paste it into Safari or Chrome." },
  ],
  copyLink: "Copy link",
  copied: "Copied",
  installedTitle: "YeahBuddy is on your Home Screen",
  installedBody: "You opened YeahBuddy from its Home Screen icon. Nothing more to do.",
  openApp: "Go to the app",
  prompt: {
    title: "Add YeahBuddy to your Home Screen",
    body: "Open it with one tap, full screen, and get workout reminders.",
    fullGuide: "See the full guide",
    later: "Later",
    neverAgain: "Don't remind me",
  },
  troubleshootingTitle: "Not working?",
  troubleshooting: [
    {
      question: "I can't find “Add to Home Screen”",
      answer: "Make sure you're in Safari, not the browser inside Zalo or Facebook. On iOS 26 and later, Share is inside the ≡ / ••• menu next to the address bar. In the share sheet, scroll all the way up or tap “View More” / “Edit Actions” to find it.",
    },
    {
      question: "The icon asks me to sign in again",
      answer: "On iPhone, Home Screen apps keep their own storage separate from Safari, so you may need to sign in once more.",
    },
    {
      question: "I still don't get notifications",
      answer: "Open YeahBuddy from its icon (not from Safari), turn notifications on in Profile, and allow them when iPhone asks. Check Settings › Notifications › YeahBuddy.",
    },
  ],
}

export const installMessages = { en, vi }
export type { InstallCopy }
