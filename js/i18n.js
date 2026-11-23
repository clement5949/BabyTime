const D = {
  en: {
    appName: "Baby Tracker",
    today: "Today", yesterday: "Yesterday",
    tabHome: "Home", tabHistory: "History", tabTrends: "Trends", tabSettings: "Settings",
    // login
    signIn: "Sign in", email: "Email", password: "Password",
    signInErr: "Couldn't sign in. Check your email and password.",
    demoBanner: "Demo mode: data stays on this device only",
    // home
    milkToday: "Milk today", feedsCount: "Feeds: {n}", pumpedToday: "Pumped today", pumpsCount: "Sessions: {n}",
    lastFeed: "Last feed", noFeedYet: "No feeds yet", ago: "{t} ago", justNow: "just now",
    hm: "{h}h {m}m", mOnly: "{m}m", dh: "{d}d {h}h",
    recent: "Recent", seeAll: "See all", nothingYet: "Nothing logged yet",
    // timer
    feedTimer: "Feeding timer", timerPlan: "Relax {a} min, then burp {b} min", start: "Start",
    relaxPhase: "Let baby relax", relaxDesc: "Keep baby calm and upright",
    burpPhase: "Burp time", burpDesc: "Hold upright and gently pat the back",
    donePhase: "All done", doneDesc: "Burping finished. Well done!",
    skip: "Skip", stop: "Stop", dismiss: "Dismiss",
    burpNow: "Time to burp baby!", allDone: "Burping done!",
    // quick add
    feed: "Feed", pump: "Pump", temp: "Temperature", weight: "Weight", last: "Last: {v}", none: "No entry yet",
    // sheet
    breastMilk: "Breast milk", formula: "Formula", pumpEntry: "Pumped",
    amountMl: "Amount (ml)", tempC: "Temperature (°C)", weightKg: "Weight (kg)",
    when: "Date & time", note: "Note (optional)", save: "Save", cancel: "Cancel", del: "Delete",
    startTimerAfter: "Start relax & burp timer after saving",
    confirmDelete: "Delete this entry?", saved: "Saved", deleted: "Deleted",
    high: "High",
    // history
    all: "All", feeds: "Feeds", pumps: "Pumps", temps: "Temp", weights: "Weight",
    dayTotals: "Milk {a} ml · Pumped {b} ml",
    // trends
    d7: "7 days", d30: "30 days", d90: "90 days",
    milkPerDay: "Milk per day (ml)", pumpPerDay: "Pumped per day (ml)",
    weightTrend: "Weight (kg)", tempTrend: "Temperature (°C)", noData: "Not enough data yet",
    // settings
    babyName: "Baby's name", relaxMin: "Relax time (min)", burpMin: "Burp time (min)",
    language: "Language", sound: "Alert sound", on: "On", off: "Off",
    testSound: "Test sound", signOut: "Sign out", account: "Signed in as {e}",
    settingsSaved: "Settings saved", timerNote: "Timers keep running if you close the app, and alert when you reopen it.",
    welcomeDesc: "A private space for your baby's records. Only people with your private link can see them.",
    createSpace: "Create our private space", joinLabel: "Already have one? Paste the private link",
    join: "Join", invalidCode: "That doesn't look right. Paste the full private link.",
    yourName: "Your name (this phone)", privateLink: "Private link",
    privateLinkDesc: "Keep it private. Anyone with this link can see and edit your records.",
    leaveSpace: "Leave this space on this phone", leaveConfirm: "Leave this space? You'll need the private link to come back.",
    copy: "Copy link", share: "Share", copied: "Link copied",
    sendLinkTitle: "Send this private link to your partner",
    sendLinkDesc: "Open it on their phone once. Anyone with this link can see and edit your records, so only share it with family.",
    connectErr: "Couldn't connect. Check your internet and that Anonymous sign-in is turned on in Firebase.",
    retry: "Try again",
    soundBlocked: "Couldn't play sound. Turn up the volume and tap again.", soundOffNote: "Alert sound is turned off.",
    probiotic: "Probiotic", spray: "Nose spray", care: "Care", logNow: "Log now", undo: "Undo",
    loggedProbiotic: "Probiotic logged", loggedSpray: "Nose spray logged", todayN: "Today: {n}",
    editTime: "Time", saveTime: "Save time",
    left: "{n} ml left", limitReached: "Daily limit reached", overBy: "Over today's limit by {n} ml",
    basedOn: "Daily limit: {w} kg × {k} ml", needWeight: "Log your baby's weight to see the daily limit.", logWeight: "Log weight",
    afterFeed: "After this feed: {n} ml left today", goesOver: "This feed goes over today's limit by {n} ml",
    hitsLimit: "This feed reaches today's limit",
    savedLeft: "Saved · {n} ml left today", savedOver: "Saved · OVER today's limit by {n} ml", savedLimit: "Saved · daily limit reached",
    mlPerKg: "Daily milk limit (ml per kg)", limitLine: "Dashed line: daily limit ({n} ml)",
  },
  zh: {
    appName: "宝宝记录",
    today: "今天", yesterday: "昨天",
    tabHome: "首页", tabHistory: "记录", tabTrends: "趋势", tabSettings: "设置",
    signIn: "登录", email: "邮箱", password: "密码",
    signInErr: "登录失败，请检查邮箱和密码。",
    demoBanner: "演示模式：数据只保存在本机",
    milkToday: "今日奶量", feedsCount: "{n} 次喂奶", pumpedToday: "今日泵奶", pumpsCount: "{n} 次",
    lastFeed: "上次喂奶", noFeedYet: "还没有喂奶记录", ago: "{t}前", justNow: "刚刚",
    hm: "{h}小时{m}分钟", mOnly: "{m}分钟", dh: "{d}天{h}小时",
    recent: "最近记录", seeAll: "查看全部", nothingYet: "还没有记录",
    feedTimer: "喂奶计时", timerPlan: "放松 {a} 分钟，然后拍嗝 {b} 分钟", start: "开始",
    relaxPhase: "让宝宝放松", relaxDesc: "保持安静，竖抱宝宝",
    burpPhase: "拍嗝时间", burpDesc: "竖抱宝宝，轻拍背部",
    donePhase: "完成", doneDesc: "拍嗝完成，辛苦了！",
    skip: "跳过", stop: "停止", dismiss: "关闭",
    burpNow: "该给宝宝拍嗝了！", allDone: "拍嗝完成！",
    feed: "喂奶", pump: "泵奶", temp: "体温", weight: "体重", last: "上次：{v}", none: "暂无记录",
    breastMilk: "母乳", formula: "配方奶", pumpEntry: "泵奶",
    amountMl: "奶量 (毫升)", tempC: "体温 (°C)", weightKg: "体重 (公斤)",
    when: "日期和时间", note: "备注（可选）", save: "保存", cancel: "取消", del: "删除",
    startTimerAfter: "保存后开始放松和拍嗝计时",
    confirmDelete: "确定删除这条记录吗？", saved: "已保存", deleted: "已删除",
    high: "偏高",
    all: "全部", feeds: "喂奶", pumps: "泵奶", temps: "体温", weights: "体重",
    dayTotals: "奶量 {a} ml · 泵奶 {b} ml",
    d7: "7 天", d30: "30 天", d90: "90 天",
    milkPerDay: "每日奶量 (ml)", pumpPerDay: "每日泵奶量 (ml)",
    weightTrend: "体重 (kg)", tempTrend: "体温 (°C)", noData: "数据还不够",
    babyName: "宝宝名字", relaxMin: "放松时间（分钟）", burpMin: "拍嗝时间（分钟）",
    language: "语言", sound: "提示音", on: "开", off: "关",
    testSound: "试听", signOut: "退出登录", account: "当前账号：{e}",
    settingsSaved: "设置已保存", timerNote: "关闭应用后计时仍会继续，重新打开时会提醒你。",
    welcomeDesc: "宝宝记录的私人空间，只有拿到你私人链接的人才能查看。",
    createSpace: "创建我们的私人空间", joinLabel: "已经有了？粘贴私人链接",
    join: "加入", invalidCode: "链接不正确，请粘贴完整的私人链接。",
    yourName: "你的名字（这部手机）", privateLink: "私人链接",
    privateLinkDesc: "请保密。拿到此链接的人都能查看和修改记录。",
    leaveSpace: "在这部手机上退出此空间", leaveConfirm: "确定退出吗？之后需要私人链接才能回来。",
    copy: "复制链接", share: "分享", copied: "链接已复制",
    sendLinkTitle: "把私人链接发给太太",
    sendLinkDesc: "在她的手机上打开一次即可。拿到链接的人都能查看和修改记录，请只分享给家人。",
    connectErr: "连接失败。请检查网络，并确认 Firebase 已开启匿名登录。",
    retry: "重试",
    soundBlocked: "无法播放声音。请调高音量后再点一次。", soundOffNote: "提示音已关闭。",
    probiotic: "益生菌", spray: "鼻喷剂", care: "护理", logNow: "现在记录", undo: "撤销",
    loggedProbiotic: "已记录益生菌", loggedSpray: "已记录鼻喷剂", todayN: "今天：{n} 次",
    editTime: "时间", saveTime: "保存时间",
    left: "今天还可喂 {n} ml", limitReached: "已达今日上限", overBy: "已超出今日上限 {n} ml",
    basedOn: "每日上限：{w} kg × {k} ml", needWeight: "记录宝宝体重后即可显示每日上限。", logWeight: "记录体重",
    afterFeed: "喂完后今天还可喂 {n} ml", goesOver: "这次会超出今日上限 {n} ml",
    hitsLimit: "这次喂完刚好达到今日上限",
    savedLeft: "已保存 · 今天还可喂 {n} ml", savedOver: "已保存 · 已超出今日上限 {n} ml！", savedLimit: "已保存 · 已达今日上限",
    mlPerKg: "每日奶量上限（每公斤 ml）", limitLine: "虚线：每日上限（{n} ml）",
  },
};

let lang = localStorage.getItem("bt_lang") || "en";
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

export const getLang = () => lang;
export const locale = () => (lang === "zh" ? "zh-CN" : "en-GB");
export function setLang(l) {
  lang = l;
  localStorage.setItem("bt_lang", l);
  document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
}
export function t(key, vars = {}) {
  let s = D[lang][key] ?? D.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
