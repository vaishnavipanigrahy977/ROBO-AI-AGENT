const categories = window.ROBO_CATEGORIES;

const explorations = window.ROBO_EXPLORATIONS;
const categoryList = document.querySelector("#category-list");
const cardGrid = document.querySelector("#card-grid");
const searchInput = document.querySelector("#search-input");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const exploreDialog = document.querySelector("#explore-dialog");
let activeCategory = "All";
let activeExploration = null;
let activeStep = 0;
let animationPaused = false;
let sceneRotation = { x: 7, y: -8 };
let sceneDrag = null;
let sendingMessage = false;
const CHAT_STORAGE_KEY = "robo-chat-history-v1";
const SETTINGS_STORAGE_KEY = "robo-settings-v1";
const STUDENTS_STORAGE_KEY = "robo-students-v1";
const SCHEDULE_STORAGE_KEY = "robo-schedule-v1";
const CALENDAR_STORAGE_KEY = "robo-calendar-v1";
const TIMETABLE_STORAGE_KEY = "robo-timetable-v1";
const ALARM_STORAGE_KEY = "robo-alarms-v1";
const TIMETABLE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMETABLE_ROW_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const DEFAULT_TIMETABLE = TIMETABLE_ROW_TIMES.map((time, index) => ({
  time,
  Monday: index % 2 === 0 ? "Study block" : "Free reading",
  Tuesday: index % 3 === 0 ? "Math" : "Project work",
  Wednesday: index % 2 === 0 ? "Science" : "Creative task",
  Thursday: index % 3 === 0 ? "History" : "Review notes",
  Friday: index % 2 === 0 ? "Reading" : "Revision",
  Saturday: index % 3 === 0 ? "Practice" : "Family time",
  Sunday: index % 2 === 0 ? "Rest and reset" : "Planning"
}));
let conversations = loadStored(CHAT_STORAGE_KEY, []);
let students = loadStored(STUDENTS_STORAGE_KEY, []);
let authState = { signedIn: false, provider: "Guest", displayName: "Guest", email: "" };
let oauthConfig = null;
let settings = loadStored(SETTINGS_STORAGE_KEY, { theme: "light", responseStyle: "balanced" });
let timetableEntries = loadStored(TIMETABLE_STORAGE_KEY, DEFAULT_TIMETABLE);
let alarmEntries = loadStored(ALARM_STORAGE_KEY, [
  { id: "alarm-1", when: "2026-11-11T07:30", label: "Wake-up review", ringing: false },
  { id: "alarm-2", when: "2026-11-11T18:45", label: "Evening recap", ringing: false }
]);
let activeClockMode = "alarm";
let selectedCalendarMonth = new Date().getMonth();
let selectedCalendarYear = new Date().getFullYear();
let stopwatchStart = null;
let stopwatchElapsedMs = 0;
let stopwatchHandle = null;
let timerRemainingMs = 0;
let timerHandle = null;
let timerRunning = false;
let lastTimetableAnnouncement = null;
let scheduleItems = loadStored(SCHEDULE_STORAGE_KEY, [
  { id: "schedule-1", title: "Freshwater swamp review", date: "2026-11-12", time: "09:00", notes: "Summarize the habitat and biodiversity connections." },
  { id: "schedule-2", title: "Spacecraft re-entry recap", date: "2026-11-15", time: "15:30", notes: "Compare re-entry heat, atmosphere, and safety systems." },
  { id: "schedule-3", title: "Silk Road timeline", date: "2026-11-18", time: "11:15", notes: "Map trade routes and why the network mattered to culture." }
]);
let calendarNotes = loadStored(CALENDAR_STORAGE_KEY, {});
let currentChatId = null;
let selectedDayDate = null;

function loadStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Unable to load ${key} from this browser.`, error);
    return fallback;
  }
}

function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save ${key} in this browser.`, error);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderCategories() {
  categoryList.innerHTML = categories.map(category =>
    `<button class="category-button" type="button" aria-pressed="${category === activeCategory}" data-category="${category}">${category}</button>`
  ).join("");
}

function renderCards() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = explorations.filter(item =>
    (activeCategory === "All" || item.category === activeCategory) &&
    (!query || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query))
  );
  cardGrid.innerHTML = visible.map(item => `
    <button class="exploration-card" type="button" data-id="${item.id}" aria-label="Explore ${item.title}" style="--scene-accent:${item.accent};--scene-tint:${item.tint}">
      <span class="card-art"><span class="card-category">${item.category}</span><span class="card-symbol" aria-hidden="true">${item.icon}</span><span class="mini-land"></span><span class="card-play" aria-hidden="true">▶</span></span>
      <span class="card-info"><span class="card-title-row"><span class="card-title">${item.title}</span><span class="card-level">${item.level}</span></span><span class="card-description">${item.description}</span><span class="card-meta"><span>◷ &nbsp;${item.duration}</span><span>Explore &nbsp;→</span></span></span>
    </button>
  `).join("");
  resultCount.textContent = `${visible.length} ${visible.length === 1 ? "exploration" : "explorations"}`;
  emptyState.hidden = visible.length > 0;
  cardGrid.hidden = visible.length === 0;
}

function renderScene(item) {
  activeExploration = item;
  activeStep = 0;
  animationPaused = false;
  document.querySelector("#scene-category").textContent = item.category;
  document.querySelector("#scene-title").textContent = item.title;
  document.querySelector("#scene-frame").style.setProperty("--scene-accent", item.accent);
  document.querySelector("#scene-frame").style.setProperty("--scene-tint", item.tint);
  document.querySelector("#scene-art").innerHTML = item.art;
  sceneRotation = { x: 7, y: -8 };
  updateSceneRotation();
  document.querySelector("#scene-caption").textContent = item.caption;
  document.querySelector("#scene-frame").classList.remove("paused", "is-rotated");
  document.querySelector("#flow-scene").textContent = "Ⅱ";
  document.querySelector("#flow-scene").setAttribute("aria-label", "Pause scene animation");
  const pins = document.querySelector("#scene-pins");
  pins.innerHTML = item.pins.map((pin, index) => `
    <button type="button" class="scene-pin" data-label-anchor="${pin.x > 60 ? "left" : "right"}" data-label-vertical="${pin.y > 50 ? "below" : "above"}" style="left:${pin.x}%;top:${pin.y}%" data-step="${index}" aria-label="Point ${index + 1}: ${pin.label}" aria-pressed="${index === 0}">
      <span class="pin-dot">${index + 1}</span><span class="scene-pin-label">${pin.label}</span>
    </button>
  `).join("");
  document.querySelector(".scene-scale").textContent = `01 — ${String(item.notes.length).padStart(2, "0")}`;
  document.querySelector("#step-dots").innerHTML = item.notes.map((_, index) =>
    `<button class="step-dot" type="button" data-step="${index}" aria-label="Go to point ${index + 1}" aria-current="${index === 0 ? "step" : "false"}"></button>`
  ).join("");
  updateLesson();
  exploreDialog.showModal();
  document.querySelector("#close-dialog").focus();
}

function updateSceneRotation() {
  document.querySelector("#scene-art").style.transform =
    `rotateX(${sceneRotation.x}deg) rotateY(${sceneRotation.y}deg) scale(.96)`;
}

function updateLesson() {
  const [title, copy, roboNote] = activeExploration.notes[activeStep];
  document.querySelector("#lesson-kicker").textContent = `LOOK CLOSER · ${activeExploration.title.toUpperCase()}`;
  document.querySelector("#lesson-step").textContent = `${String(activeStep + 1).padStart(2, "0")} / ${String(activeExploration.notes.length).padStart(2, "0")}`;
  document.querySelector("#lesson-title").textContent = title;
  document.querySelector("#lesson-copy").textContent = copy;
  document.querySelector("#robo-note-copy").textContent = roboNote;
  document.querySelector("#lesson-progress-bar").style.width = `${((activeStep + 1) / activeExploration.notes.length) * 100}%`;
  document.querySelectorAll(".scene-pin").forEach((pin, index) => pin.setAttribute("aria-pressed", String(index === activeStep)));
  document.querySelectorAll(".step-dot").forEach((dot, index) => dot.setAttribute("aria-current", index === activeStep ? "step" : "false"));
}

function setStep(step) {
  if (!activeExploration) return;
  activeStep = (step + activeExploration.notes.length) % activeExploration.notes.length;
  updateLesson();
}

function setView(name) {
  document.querySelectorAll(".app-view").forEach(view => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  document.querySelector("#sidebar").classList.remove("mobile-open");
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", "false");
  if (name === "students") renderStudents();
  if (name === "scheduled") renderSchedule();
  if (name === "chat") document.querySelector("#workspace-chat-input").focus();
}

function createChat() {
  currentChatId = null;
  document.querySelector("#conversation-messages").replaceChildren();
  document.querySelector("#workspace-chat-input").value = "";
  setView("chat");
}

function saveConversations() {
  conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  saveStored(CHAT_STORAGE_KEY, conversations);
  renderHistory();
}

function currentConversation() {
  return conversations.find(chat => chat.id === currentChatId);
}

function renderHistory() {
  const query = document.querySelector("#history-search").value.trim().toLowerCase();
  const visible = conversations.filter(chat => !query || chat.title.toLowerCase().includes(query) ||
    chat.messages.some(message => message.text.toLowerCase().includes(query)));
  document.querySelector("#history-count").textContent = conversations.length ? String(conversations.length) : "";
  document.querySelector("#history-empty").hidden = visible.length > 0;
  document.querySelector("#history-empty").textContent = conversations.length ? "No chats match your search." : "Your conversations will show up here.";
  document.querySelector("#chat-history").innerHTML = visible.map(chat =>
    `<button class="history-item${chat.id === currentChatId ? " selected" : ""}" type="button" data-chat-id="${escapeHtml(chat.id)}" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</button>`
  ).join("");
}

function renderConversation() {
  const conversation = currentConversation();
  const container = document.querySelector("#conversation-messages");
  const chatContent = document.querySelector(".chat-content");
  container.replaceChildren();
  chatContent.classList.toggle("has-messages", Boolean(conversation?.messages.length));
  if (!conversation) return;
  conversation.messages.forEach(message => {
    const bubble = document.createElement("article");
    bubble.className = `message-row ${message.role === "user" ? "user-message" : "assistant-message"}`;
    if (message.role === "assistant") {
      const avatar = document.createElement("span");
      avatar.className = "robo-avatar message-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "R";
      bubble.append(avatar);
    }
    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message.text;
    bubble.append(text);
    if (message.explorationId) {
      const item = explorations.find(exploration => exploration.id === message.explorationId);
      if (item) {
        const launch = document.createElement("button");
        launch.type = "button";
        launch.className = "chat-launch";
        launch.textContent = `Open ${item.title} →`;
        launch.addEventListener("click", () => renderScene(item));
        bubble.append(launch);
      }
    }
    if (Array.isArray(message.sources) && message.sources.length) {
      const sources = document.createElement("div");
      sources.className = "message-sources";
      const label = document.createElement("span");
      label.textContent = "Sources";
      sources.append(label);
      message.sources.forEach(source => {
        if (!source.url || !/^https?:\/\//i.test(source.url)) return;
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.title || source.url;
        sources.append(link);
      });
      if (sources.childElementCount > 1) bubble.append(sources);
    }
    container.append(bubble);
  });
  container.scrollTop = container.scrollHeight;
}

function findExploration(message) {
  const query = message.toLowerCase();
  const matches = explorations.flatMap(item => item.aliases
    .filter(alias => alias.length > 3 && query.includes(alias))
    .map(alias => ({ item, score: alias.length })));
  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.item || null;
}

function showChatStatus(message, retry = false) {
  const container = document.querySelector("#conversation-messages");
  const status = document.createElement("div");
  status.className = `chat-status${retry ? " chat-error" : ""}`;
  status.setAttribute("role", retry ? "alert" : "status");
  const text = document.createElement("span");
  text.textContent = message;
  status.append(text);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Retry";
    button.addEventListener("click", () => requestAnswer(currentConversation()));
    status.append(button);
  }
  container.append(status);
  container.scrollTop = container.scrollHeight;
}

async function requestAnswer(conversation) {
  if (sendingMessage || !conversation) return;
  sendingMessage = true;
  const sendButton = document.querySelector("#send-chat");
  sendButton.disabled = true;
  document.querySelectorAll(".chat-status").forEach(status => status.remove());
  showChatStatus("ROBO is thinking…");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation.messages.slice(-20).map(({ role, text }) => ({ role, text })),
        responseStyle: settings.responseStyle
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Public search returned HTTP ${response.status}.`);
    if (typeof result.text !== "string" || !result.text.trim()) throw new Error("ROBO found no readable search results. Please try again.");
    const lastQuestion = [...conversation.messages].reverse().find(message => message.role === "user");
    const exploration = lastQuestion ? findExploration(lastQuestion.text) : null;
    conversation.messages.push({
      role: "assistant",
      text: result.text.trim(),
      sources: Array.isArray(result.sources) ? result.sources : [],
      ...(exploration ? { explorationId: exploration.id } : {})
    });
    conversation.updatedAt = Date.now();
    document.querySelectorAll(".chat-status").forEach(status => status.remove());
    renderConversation();
    saveConversations();
  } catch (error) {
    console.error("ROBO could not answer the message.", error);
    document.querySelectorAll(".chat-status").forEach(status => status.remove());
    showChatStatus(error.message || "ROBO couldn't reach its public search sources. Please try again.", true);
  } finally {
    sendingMessage = false;
    sendButton.disabled = false;
  }
}

async function sendMessage(text) {
  const value = text.trim();
  if (!value || sendingMessage) return;
  if (!currentConversation()) {
    currentChatId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    conversations.unshift({ id: currentChatId, title: value.slice(0, 42), messages: [], updatedAt: Date.now() });
  }
  const conversation = currentConversation();
  conversation.messages.push({ role: "user", text: value });
  conversation.updatedAt = Date.now();
  document.querySelector("#workspace-chat-input").value = "";
  if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.?,\s]*$/i.test(value)) {
    conversation.messages.push({ role: "assistant", text: "Hello! How can I help you today?" });
    conversation.updatedAt = Date.now();
    renderConversation();
    saveConversations();
    return;
  }
  renderConversation();
  saveConversations();
  await requestAnswer(conversation);
}

function applyTheme() {
  const dark = settings.theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector("#theme-icon").textContent = dark ? "☀" : "☾";
  document.querySelector("#theme-label").textContent = dark ? "Light theme" : "Dark theme";
  document.querySelector("#settings-theme").textContent = dark ? "Switch to light" : "Switch to dark";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#171c1b" : "#f5f7f4";
}

function toggleTheme() {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  saveStored(SETTINGS_STORAGE_KEY, settings);
  applyTheme();
}

function renderStudents() {
  document.querySelector("#student-list").innerHTML = students.map((student, index) =>
    `<div class="student-card"><span class="student-avatar">${escapeHtml(student.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.grade)}</small></span><button type="button" class="remove-student" data-student-index="${index}" aria-label="Remove ${escapeHtml(student.name)}">×</button></div>`
  ).join("");
}

function formatTimeValue(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateValue(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function formatDateTimeLocal(date) {
  const offsetMinutes = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
}

function normalizeTimeString(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(?:am|pm)?$/i);
  if (!match) return trimmed.toLowerCase();
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const lower = trimmed.toLowerCase();
  if (/[ap]m/i.test(lower)) {
    const isPm = /pm/i.test(lower);
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
  }
  const safeHours = String(hours).padStart(2, "0");
  const safeMinutes = String(minutes).padStart(2, "0");
  return `${safeHours}:${safeMinutes}`;
}

function nextTimetableTime() {
  const last = timetableEntries[timetableEntries.length - 1]?.time || "18:00";
  const [hour, minute] = last.split(":").map(Number);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  next.setMinutes(next.getMinutes() + 60);
  return `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
}

function addTimetableRow() {
  const nextTime = nextTimetableTime();
  const row = { time: nextTime };
  TIMETABLE_DAYS.forEach(day => { row[day] = ""; });
  timetableEntries.push(row);
  saveStored(TIMETABLE_STORAGE_KEY, timetableEntries);
  renderTimetable();
}

function renderTimetable() {
  const grid = document.querySelector("#timetable-grid");
  if (!grid) return;
  const heading = [`<div class="timetable-header-cell">Time</div>`].concat(TIMETABLE_DAYS.map(day => `<div class="timetable-header-cell">${day}</div>`)).join("");
  const rows = timetableEntries.map(row => {
    const cells = TIMETABLE_DAYS.map(day => `
      <input
        class="timetable-cell"
        type="text"
        value="${escapeHtml(row[day] || "")}"
        data-time="${row.time}"
        data-day="${day}"
        aria-label="${day} at ${row.time}"
        placeholder="Write a subject"
      >
    `).join("");
    return `<div class="timetable-row"><input class="timetable-time" type="text" value="${escapeHtml(row.time)}" data-time-field="${row.time}" aria-label="Time for row ${row.time}" data-row-time="${row.time}">${cells}</div>`;
  }).join("");
  grid.innerHTML = `<div class="timetable-header">${heading}</div>${rows}`;
}

function hideSplashScreen() {
  const splash = document.querySelector("#robo-splash-screen");
  if (!splash) return;
  splash.classList.add("hidden");
}

function updateClock() {
  const clock = document.querySelector("#robo-clock");
  if (!clock) return;
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  checkScheduleAnnouncement(now);
  checkAlarms();
  updateTimerDisplay();
}

function showToast(message) {
  if (!message) return;
  const toast = document.createElement("div");
  toast.className = "robo-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

function getDisplayName() {
  if (!authState.signedIn) return "Guest";
  return authState.displayName?.trim() || (authState.email ? authState.email.split("@")[0] : "ROBO learner");
}

function updateAuthUi() {
  const profileName = document.querySelector(".profile-name");
  const profileGlyph = document.querySelector(".profile-button > span:first-child");
  const sidebarSignin = document.querySelector("#google-signin");
  const signoutButton = document.querySelector("#signin-signout");

  if (profileName && profileGlyph) {
    if (authState.signedIn) {
      const displayName = getDisplayName();
      profileName.textContent = displayName;
      profileGlyph.textContent = displayName.slice(0, 1).toUpperCase();
    } else {
      profileName.textContent = "Guest";
      profileGlyph.textContent = "G";
    }
  }

  if (sidebarSignin) {
    if (authState.signedIn) {
      sidebarSignin.innerHTML = '<span class="google-g" aria-hidden="true">✓</span><span><strong>Signed in</strong><small></small></span><span class="signin-arrow" aria-hidden="true">→</span>';
      sidebarSignin.querySelector("small").textContent = `${authState.provider || "ROBO"} account`;
    } else {
      sidebarSignin.innerHTML = '<span class="google-g" aria-hidden="true">G</span><span><strong>Sign in</strong><small>Secure sign-in options</small></span><span class="signin-arrow" aria-hidden="true">↗</span>';
    }
  }

  if (signoutButton) signoutButton.hidden = !authState.signedIn;
}

function signInWithProvider(profile) {
  authState = profile;
  updateAuthUi();
  showToast(`Signed in as ${profile.displayName || profile.email}.`);
}

async function signOutUser() {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("ROBO could not end the sign-in session.");
  } catch (error) {
    console.error("Unable to sign out of ROBO.", error);
    showToast(error.message || "Unable to sign out. Please try again.");
    return;
  }
  authState = { signedIn: false, provider: "Guest", displayName: "Guest", email: "" };
  updateAuthUi();
  showToast("Signed out of ROBO.");
}

function triggerAlarmTone() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    const audio = new AudioCtor();
    const oscillator = audio.createOscillator();
    const gainNode = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, audio.currentTime + 1.1);
    gainNode.gain.setValueAtTime(0.0001, audio.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 1.6);
    oscillator.connect(gainNode);
    gainNode.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 1.7);
    oscillator.onended = () => audio.close();
  } catch (error) {
    console.warn("Unable to play ROBO alarm tone.", error);
  }
}

function renderAlarmList() {
  const list = document.querySelector("#alarm-list");
  if (!list) return;
  if (!alarmEntries.length) {
    list.innerHTML = `<div class="empty-item">No alarms set yet.</div>`;
    return;
  }
  list.innerHTML = alarmEntries.map(alarm => `
    <div class="alarm-item ${alarm.ringing ? "ringing" : ""}" data-alarm-id="${alarm.id}">
      <div>
        <strong>${escapeHtml(alarm.label || "Alarm")}</strong>
        <small>${escapeHtml(new Date(alarm.when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</small>
      </div>
      <button type="button" class="remove-alarm" data-alarm-id="${alarm.id}" aria-label="Remove ${escapeHtml(alarm.label || "Alarm")}">×</button>
    </div>
  `).join("");
}

function addAlarm(whenValue, labelValue) {
  if (!whenValue) return;
  const safeLabel = labelValue.trim() || "Morning review";
  const nextAlarm = {
    id: `alarm-${Date.now()}`,
    when: whenValue,
    label: safeLabel,
    ringing: false
  };
  alarmEntries.push(nextAlarm);
  saveStored(ALARM_STORAGE_KEY, alarmEntries);
  renderAlarmList();
}

function checkAlarms() {
  const now = new Date();
  let triggeredAny = false;
  alarmEntries.forEach(alarm => {
    const target = new Date(alarm.when);
    if (!Number.isNaN(target.getTime()) && target <= now && !alarm.ringing) {
      alarm.ringing = true;
      triggeredAny = true;
      showToast(`Alarm: ${alarm.label || "ROBO reminder"}`);
      triggerAlarmTone();
    }
  });
  if (triggeredAny) {
    saveStored(ALARM_STORAGE_KEY, alarmEntries);
    renderAlarmList();
  }
}

function formatStopwatchDisplay(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

function updateStopwatchDisplay() {
  const display = document.querySelector("#stopwatch-display");
  if (!display) return;
  display.textContent = formatStopwatchDisplay(stopwatchElapsedMs);
}

function setStopwatch(newMs) {
  stopwatchElapsedMs = newMs;
  updateStopwatchDisplay();
}

function startStopwatch() {
  if (stopwatchHandle) return;
  stopwatchStart = Date.now() - stopwatchElapsedMs;
  stopwatchHandle = window.setInterval(() => {
    stopwatchElapsedMs = Date.now() - stopwatchStart;
    updateStopwatchDisplay();
  }, 50);
}

function pauseStopwatch() {
  if (!stopwatchHandle) return;
  window.clearInterval(stopwatchHandle);
  stopwatchHandle = null;
  stopwatchStart = null;
}

function resetStopwatch() {
  pauseStopwatch();
  setStopwatch(0);
}

function updateTimerDisplay() {
  const timerDisplay = document.querySelector("#timer-display");
  if (!timerDisplay) return;
  const totalSeconds = Math.max(0, Math.ceil(timerRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function stopTimerLoop() {
  if (timerHandle) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
  timerRunning = false;
}

function startTimer() {
  const input = document.querySelector("#timer-input");
  if (!input) return;
  if (!timerRemainingMs && Number(input.value) > 0) {
    timerRemainingMs = Number(input.value) * 60 * 1000;
  }
  if (timerRemainingMs <= 0 || timerRunning) return;
  timerRunning = true;
  timerHandle = window.setInterval(() => {
    timerRemainingMs = Math.max(0, timerRemainingMs - 1000);
    updateTimerDisplay();
    if (timerRemainingMs <= 0) {
      stopTimerLoop();
      showToast("Timer complete. Time to move on.");
      triggerAlarmTone();
    }
  }, 1000);
}

function pauseTimer() {
  stopTimerLoop();
}

function resetTimer() {
  stopTimerLoop();
  const input = document.querySelector("#timer-input");
  timerRemainingMs = Number(input.value || 0) * 60 * 1000;
  updateTimerDisplay();
}

function renderCalendar() {
  const grid = document.querySelector("#calendar-grid");
  const monthSelect = document.querySelector("#calendar-month-select");
  const yearSelect = document.querySelector("#calendar-year-select");
  if (!grid || !monthSelect || !yearSelect) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthSelect.innerHTML = monthNames.map((month, index) => `<option value="${index}" ${index === selectedCalendarMonth ? "selected" : ""}>${month}</option>`).join("");
  const years = Array.from({ length: 11 }, (_, offset) => new Date().getFullYear() - 5 + offset);
  yearSelect.innerHTML = years.map(year => `<option value="${year}" ${year === selectedCalendarYear ? "selected" : ""}>${year}</option>`).join("");

  const monthStart = new Date(selectedCalendarYear, selectedCalendarMonth, 1);
  const monthEnd = new Date(selectedCalendarYear, selectedCalendarMonth + 1, 0);
  const firstDayIndex = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const cells = [];

  for (let blank = 0; blank < firstDayIndex; blank += 1) {
    const previousMonthDay = new Date(selectedCalendarYear, selectedCalendarMonth, blank - firstDayIndex + 1);
    cells.push(`<button type="button" class="calendar-day muted" data-date="${formatDateValue(previousMonthDay)}" disabled>${previousMonthDay.getDate()}</button>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(selectedCalendarYear, selectedCalendarMonth, day);
    const iso = formatDateValue(date);
    const selected = selectedDayDate === iso ? "selected" : "";
    const noteClass = calendarNotes[iso] ? "has-note" : "";
    cells.push(`<button type="button" class="calendar-day ${selected} ${noteClass}" data-date="${iso}" aria-label="Open planner for ${date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}"><strong>${day}</strong>${calendarNotes[iso] ? '<span class="calendar-dot" aria-hidden="true"></span>' : ""}</button>`);
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstDayIndex + totalDays) + 1;
    const futureDate = new Date(selectedCalendarYear, selectedCalendarMonth + 1, nextDay);
    cells.push(`<button type="button" class="calendar-day muted" data-date="${formatDateValue(futureDate)}" disabled>${futureDate.getDate()}</button>`);
  }

  grid.innerHTML = cells.join("");
}

function openDayPlanner(date) {
  selectedDayDate = date;
  const label = document.querySelector("#day-note-date");
  const input = document.querySelector("#day-note-input");
  const panel = document.querySelector("#day-note-panel");
  if (!label || !input || !panel) return;
  const selected = new Date(`${date}T12:00:00`);
  label.textContent = selected.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  input.value = calendarNotes[date] || "";
  panel.hidden = false;
  renderCalendar();
}

function saveDayNote() {
  if (!selectedDayDate) return;
  const input = document.querySelector("#day-note-input");
  if (!input) return;
  calendarNotes[selectedDayDate] = input.value.trim();
  saveStored(CALENDAR_STORAGE_KEY, calendarNotes);
  renderCalendar();
  document.querySelector("#day-note-panel").hidden = true;
}

function checkScheduleAnnouncement(now) {
  const weekday = TIMETABLE_DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const currentTime = normalizeTimeString(formatTimeValue(now));
  const entry = timetableEntries.find(row => {
    const rowTime = normalizeTimeString(row.time || "");
    return rowTime === currentTime && row[weekday] && row[weekday].trim();
  });
  if (!entry) return;
  const announcement = `Time for ${entry[weekday].trim()}`;
  const key = `${weekday}-${currentTime}`;
  if (lastTimetableAnnouncement !== key) {
    lastTimetableAnnouncement = key;
    showToast(announcement);
  }
}

function renderSchedule() {
  const list = document.querySelector("#schedule-list");
  const empty = document.querySelector("#schedule-empty");
  const sorted = [...scheduleItems].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  list.innerHTML = sorted.map(item => `
    <article class="schedule-item" data-id="${escapeHtml(item.id)}">
      <div class="schedule-badge" aria-hidden="true">${escapeHtml(item.title.slice(0, 1).toUpperCase())}</div>
      <div class="schedule-copy">
        <div class="schedule-title-row">
          <strong>${escapeHtml(item.title)}</strong>
          <button type="button" class="remove-schedule" data-schedule-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.title)}">×</button>
        </div>
        <div class="schedule-meta">
          <span>${escapeHtml(new Date(`${item.date}T${item.time}`).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }))}</span>
        </div>
        <p>${escapeHtml(item.notes || "No notes added.")}</p>
      </div>
    </article>
  `).join("");
  empty.hidden = sorted.length > 0;
  list.hidden = sorted.length === 0;
  saveStored(SCHEDULE_STORAGE_KEY, scheduleItems);
  renderTimetable();
  renderCalendar();
  renderAlarmList();
}

categoryList.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderCards();
});
searchInput.addEventListener("input", renderCards);
cardGrid.addEventListener("click", event => {
  const card = event.target.closest("[data-id]");
  if (card) renderScene(explorations.find(item => item.id === card.dataset.id));
});
document.querySelector("#close-dialog").addEventListener("click", () => exploreDialog.close());
document.querySelector("#scene-pins").addEventListener("click", event => {
  const pin = event.target.closest("[data-step]");
  if (pin) setStep(Number(pin.dataset.step));
});
document.querySelector("#step-dots").addEventListener("click", event => {
  const dot = event.target.closest("[data-step]");
  if (dot) setStep(Number(dot.dataset.step));
});
document.querySelector("#previous-step").addEventListener("click", () => setStep(activeStep - 1));
document.querySelector("#next-step").addEventListener("click", () => setStep(activeStep + 1));
document.querySelector("#next-lesson").addEventListener("click", () => setStep(activeStep + 1));
document.querySelector("#rotate-scene").addEventListener("click", () => {
  sceneRotation.y += 45;
  updateSceneRotation();
});
document.querySelector("#flow-scene").addEventListener("click", event => {
  animationPaused = !animationPaused;
  document.querySelector("#scene-frame").classList.toggle("paused", animationPaused);
  event.currentTarget.textContent = animationPaused ? "▶" : "Ⅱ";
  event.currentTarget.setAttribute("aria-label", animationPaused ? "Play scene animation" : "Pause scene animation");
});
document.querySelector("#workspace-chat-form").addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(document.querySelector("#workspace-chat-input").value);
});
document.querySelector("#workspace-chat-input").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.querySelector("#workspace-chat-form").requestSubmit();
  }
});
document.querySelector(".starter-prompts").addEventListener("click", event => {
  const suggestion = event.target.closest("[data-prompt]");
  if (suggestion) sendMessage(suggestion.dataset.prompt);
});
document.querySelector(".dashboard-actions").addEventListener("click", event => {
  const action = event.target.closest("[data-view]");
  if (action) {
    setView(action.dataset.view);
    return;
  }
  const prompt = event.target.closest("[data-prompt]");
  if (prompt) sendMessage(prompt.dataset.prompt);
});
document.querySelector("#new-chat").addEventListener("click", createChat);
document.querySelector("#robo-prompt").addEventListener("click", () => renderScene(explorations.find(item => item.featured)));
document.querySelector("#chat-history").addEventListener("click", event => {
  const button = event.target.closest("[data-chat-id]");
  if (!button) return;
  currentChatId = button.dataset.chatId;
  setView("chat");
  renderConversation();
  renderHistory();
});
document.querySelector("#history-search").addEventListener("input", renderHistory);
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelector("#theme-toggle").addEventListener("click", toggleTheme);
document.querySelector("#settings-theme").addEventListener("click", toggleTheme);
document.querySelector("#clear-history").addEventListener("click", () => {
  if (!conversations.length || !window.confirm("Clear all saved ROBO chats from this browser?")) return;
  conversations = [];
  currentChatId = null;
  saveConversations();
  renderConversation();
});
document.querySelectorAll('input[name="response-style"]').forEach(input => {
  input.checked = input.value === settings.responseStyle;
  input.addEventListener("change", () => {
    settings.responseStyle = input.value;
    saveStored(SETTINGS_STORAGE_KEY, settings);
  });
});
document.querySelector("#student-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.querySelector("#student-name").value.trim();
  if (!name) return;
students.push({ name, grade: "Learner" });
  saveStored(STUDENTS_STORAGE_KEY, students);
  document.querySelector("#student-form").reset();
  renderStudents();
});
document.querySelector("#student-list").addEventListener("click", event => {
  const button = event.target.closest("[data-student-index]");
  if (!button) return;
  students.splice(Number(button.dataset.studentIndex), 1);
  saveStored(STUDENTS_STORAGE_KEY, students);
  renderStudents();
});

document.querySelectorAll(".schedule-tab").forEach(button => {
  button.addEventListener("click", () => {
    const selected = button.dataset.scheduleTab;
    document.querySelectorAll(".schedule-tab").forEach(tab => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".schedule-module").forEach(panel => {
      const active = panel.id === `schedule-${selected}-panel`;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    const clockShell = document.querySelector("#clock-shell");
    const clockCard = document.querySelector("#robo-clock-card");
    if (clockShell && clockCard) {
      const shouldExpand = selected === "clock";
      clockShell.classList.toggle("expanded", shouldExpand);
      clockCard.setAttribute("aria-expanded", String(shouldExpand));
    }
  });
});

document.querySelector("#robo-clock-card").addEventListener("click", () => {
  const clockShell = document.querySelector("#clock-shell");
  const clockCard = document.querySelector("#robo-clock-card");
  if (!clockShell || !clockCard) return;
  const expanded = !clockShell.classList.contains("expanded");
  clockShell.classList.toggle("expanded", expanded);
  clockCard.setAttribute("aria-expanded", String(expanded));
});

document.querySelectorAll(".clock-mode").forEach(button => {
  button.addEventListener("click", () => {
    activeClockMode = button.dataset.clockMode;
    document.querySelectorAll(".clock-mode").forEach(modeButton => {
      const active = modeButton === button;
      modeButton.classList.toggle("active", active);
      modeButton.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".clock-section").forEach(section => {
      const active = section.id === `clock-${activeClockMode}-panel`;
      section.hidden = !active;
      section.classList.toggle("active", active);
    });
  });
});

document.querySelector("#timetable-grid").addEventListener("input", event => {
  const cell = event.target.closest(".timetable-cell");
  const timeInput = event.target.closest(".timetable-time");
  if (cell) {
    const row = timetableEntries.find(item => item.time === cell.dataset.time);
    if (!row) return;
    row[cell.dataset.day] = cell.value;
    saveStored(TIMETABLE_STORAGE_KEY, timetableEntries);
    return;
  }
  if (timeInput) {
    const row = timetableEntries.find(item => item.time === timeInput.dataset.rowTime);
    if (!row) return;
    const newTime = normalizeTimeString(timeInput.value || "");
    row.time = newTime || row.time;
    if (!newTime) return;
    timeInput.dataset.rowTime = row.time;
    timeInput.setAttribute("aria-label", `Time for row ${row.time}`);
    saveStored(TIMETABLE_STORAGE_KEY, timetableEntries);
  }
});

document.querySelector("#alarm-form").addEventListener("submit", event => {
  event.preventDefault();
  const whenInput = document.querySelector("#alarm-datetime");
  const labelInput = document.querySelector("#alarm-label");
  addAlarm(whenInput.value, labelInput.value);
  event.currentTarget.reset();
  labelInput.value = "Morning review";
});

document.querySelector("#alarm-list").addEventListener("click", event => {
  const removeButton = event.target.closest("[data-alarm-id]");
  if (!removeButton) return;
  const id = removeButton.dataset.alarmId;
  alarmEntries = alarmEntries.filter(alarm => alarm.id !== id);
  saveStored(ALARM_STORAGE_KEY, alarmEntries);
  renderAlarmList();
});

document.querySelector("#calendar-grid").addEventListener("click", event => {
  const day = event.target.closest("[data-date]");
  if (!day) return;
  openDayPlanner(day.dataset.date);
});
document.querySelector("#calendar-month-select").addEventListener("change", event => {
  selectedCalendarMonth = Number(event.target.value);
  renderCalendar();
});
document.querySelector("#calendar-year-select").addEventListener("change", event => {
  selectedCalendarYear = Number(event.target.value);
  renderCalendar();
});
document.querySelector("#save-day-note").addEventListener("click", saveDayNote);

document.querySelector("#start-stopwatch").addEventListener("click", startStopwatch);
document.querySelector("#pause-stopwatch").addEventListener("click", pauseStopwatch);
document.querySelector("#reset-stopwatch").addEventListener("click", resetStopwatch);
document.querySelector("#start-timer").addEventListener("click", startTimer);
document.querySelector("#pause-timer").addEventListener("click", pauseTimer);
document.querySelector("#reset-timer").addEventListener("click", resetTimer);

document.querySelector("#add-schedule").addEventListener("click", () => {
  const formShell = document.querySelector("#schedule-form-shell");
  formShell.hidden = !formShell.hidden;
  if (!formShell.hidden) document.querySelector("#schedule-title").focus();
});
document.querySelector("#add-timetable-row").addEventListener("click", addTimetableRow);
document.querySelector("#cancel-schedule").addEventListener("click", () => {
  document.querySelector("#schedule-form").reset();
  document.querySelector("#schedule-form-shell").hidden = true;
});
document.querySelector("#schedule-form").addEventListener("submit", event => {
  event.preventDefault();
  const title = document.querySelector("#schedule-title").value.trim();
  const date = document.querySelector("#schedule-date").value;
  const time = document.querySelector("#schedule-time").value;
  const notes = document.querySelector("#schedule-notes").value.trim();
  if (!title || !date || !time) return;
  scheduleItems.push({
    id: `schedule-${Date.now()}`,
    title,
    date,
    time,
    notes
  });
  document.querySelector("#schedule-form").reset();
  document.querySelector("#schedule-form-shell").hidden = true;
  renderSchedule();
});
document.querySelector("#schedule-list").addEventListener("click", event => {
  const button = event.target.closest("[data-schedule-id]");
  if (!button) return;
  scheduleItems = scheduleItems.filter(item => item.id !== button.dataset.scheduleId);
  renderSchedule();
});
const signinDialog = document.querySelector("#signin-dialog");
function showSigninDetails() {
  if (!signinDialog) return;
  signinDialog.showModal();
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomOAuthValue() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function loadOAuthConfig() {
  const response = await fetch("/api/auth/config", { credentials: "same-origin" });
  if (!response.ok) throw new Error("ROBO could not load its sign-in configuration.");
  oauthConfig = await response.json();
  const providerButtons = [...document.querySelectorAll(".signin-provider")];
  providerButtons.forEach(button => {
    const config = oauthConfig.providers?.[button.dataset.provider];
    button.dataset.configured = String(Boolean(config?.configured));
    button.title = config?.configured
      ? `Continue securely with ${button.textContent.trim()}`
      : `${button.textContent.trim()} sign-in needs server OAuth configuration`;
  });
  const configured = providerButtons.some(button => button.dataset.configured === "true");
  const message = configured
    ? "You’ll authenticate directly with your provider. ROBO never receives your password."
    : "Sign-in setup needed: configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET, on the server.";
  document.querySelector("#signin-provider-status").textContent = message;
}

async function startOAuthSignIn(provider) {
  const config = oauthConfig?.providers?.[provider];
  if (!config?.configured) {
    const name = provider === "google" ? "Google" : "Microsoft";
    document.querySelector("#signin-provider-status").textContent =
      `${name} sign-in is not configured yet. The app owner must add its OAuth client ID and secret to the server environment.`;
    return;
  }
  if (!crypto.subtle) {
    showToast("Secure sign-in requires HTTPS (localhost is supported for development).");
    return;
  }
  try {
    const verifier = randomOAuthValue();
    const state = randomOAuthValue();
    const challenge = bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const redirectUri = oauthConfig.redirectUri;
    sessionStorage.setItem("robo-oauth-transaction-v1", JSON.stringify({ provider, state, verifier, redirectUri }));
    const authorization = new URL(config.authorizationEndpoint);
    const parameters = {
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account"
    };
    if (provider === "microsoft") parameters.response_mode = "query";
    authorization.search = new URLSearchParams(parameters);
    window.location.assign(authorization.toString());
  } catch (error) {
    console.error("Could not start provider sign-in.", error);
    showToast(error.message || "Could not start sign-in. Please try again.");
  }
}

async function handleOAuthCallback() {
  const callbackUrl = new URL(window.location.href);
  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  const providerError = callbackUrl.searchParams.get("error");
  if (!code && !providerError) return false;
  window.history.replaceState({}, document.title, callbackUrl.pathname + callbackUrl.hash);
  const transactionText = sessionStorage.getItem("robo-oauth-transaction-v1");
  sessionStorage.removeItem("robo-oauth-transaction-v1");
  let transaction = null;
  try {
    transaction = transactionText ? JSON.parse(transactionText) : null;
  } catch (error) {
    console.error("Invalid saved sign-in transaction.", error);
  }
  if (providerError) {
    showToast("Sign-in was cancelled or declined by the provider.");
    return true;
  }
  if (!transaction || !state || state !== transaction.state || !code) {
    showToast("Sign-in could not be verified. Please try again.");
    return true;
  }
  try {
    const response = await fetch("/api/auth/exchange", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: transaction.provider,
        code,
        codeVerifier: transaction.verifier,
        redirectUri: transaction.redirectUri
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The provider could not complete sign-in.");
    signInWithProvider(result);
    if (signinDialog.open) signinDialog.close();
  } catch (error) {
    console.error("Provider sign-in could not be completed.", error);
    showToast(error.message || "Sign-in failed. Check your provider setup and try again.");
  }
  return true;
}

async function initializeAuth() {
  try {
    await loadOAuthConfig();
    if (await handleOAuthCallback()) return;
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!response.ok) throw new Error("ROBO could not restore the sign-in session.");
    const profile = await response.json();
    if (profile.signedIn) authState = profile;
    updateAuthUi();
  } catch (error) {
    console.error("Unable to initialize ROBO sign-in.", error);
    const status = document.querySelector("#signin-provider-status");
    if (status) status.textContent = error.message || "Sign-in is temporarily unavailable.";
    updateAuthUi();
  }
}

document.querySelector("#google-signin").addEventListener("click", showSigninDetails);
document.querySelector("#settings-signin").addEventListener("click", showSigninDetails);
document.querySelector("#close-signin").addEventListener("click", () => signinDialog.close());
document.querySelectorAll(".signin-provider").forEach(button => {
  button.addEventListener("click", () => startOAuthSignIn(button.dataset.provider));
});
document.querySelector("#signin-guest").addEventListener("click", async () => {
  if (authState.signedIn) await signOutUser();
  signinDialog.close();
});
document.querySelector("#signin-signout").addEventListener("click", () => {
  signOutUser();
  signinDialog.close();
});
signinDialog.addEventListener("click", event => { if (event.target === signinDialog) signinDialog.close(); });
document.querySelector("#mobile-menu").addEventListener("click", event => {
  const opened = document.querySelector("#sidebar").classList.toggle("mobile-open");
  event.currentTarget.setAttribute("aria-expanded", String(opened));
});
document.querySelector("#search-input").addEventListener("keydown", event => {
  if (event.key === "Escape") { searchInput.value = ""; renderCards(); }
});
exploreDialog.addEventListener("click", event => { if (event.target === exploreDialog) exploreDialog.close(); });
const sceneFrame = document.querySelector("#scene-frame");
sceneFrame.addEventListener("pointerdown", event => {
  if (event.target.closest("button")) return;
  sceneDrag = { x: event.clientX, y: event.clientY, rotationX: sceneRotation.x, rotationY: sceneRotation.y };
  sceneFrame.setPointerCapture(event.pointerId);
});
sceneFrame.addEventListener("pointermove", event => {
  if (!sceneDrag) return;
  sceneRotation.y = sceneDrag.rotationY + (event.clientX - sceneDrag.x) * .28;
  sceneRotation.x = Math.max(-28, Math.min(28, sceneDrag.rotationX - (event.clientY - sceneDrag.y) * .22));
  updateSceneRotation();
});
sceneFrame.addEventListener("pointerup", () => { sceneDrag = null; });
sceneFrame.addEventListener("pointercancel", () => { sceneDrag = null; });
document.addEventListener("keydown", event => {
  if (event.key === "/" && !event.target.closest("input, textarea, [contenteditable=true]") && !exploreDialog.open && !signinDialog.open) {
    event.preventDefault();
    document.querySelector("#history-search").focus();
    return;
  }
  if (!exploreDialog.open) return;
  if (event.key === "ArrowRight") setStep(activeStep + 1);
  if (event.key === "ArrowLeft") setStep(activeStep - 1);
});

selectedDayDate = formatDateValue(new Date());
renderCategories();
renderCards();
renderHistory();
renderStudents();
renderSchedule();
renderAlarmList();
updateStopwatchDisplay();
resetTimer();
updateClock();
updateAuthUi();
initializeAuth();
setInterval(updateClock, 1000);
setTimeout(hideSplashScreen, 1100);
applyTheme();
