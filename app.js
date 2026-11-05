// --- Supabase Config ---
const SUPABASE_URL = "https://coltzqgllwrebqkfbufd.supabase.co";
const SUPABASE_KEY = "sb_publishable_jDvtuqeue72tzsuYrwc7SA_JfIHeOMz";

let supabaseClient = null;

if (window.supabase && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Correct Schedule Data
const initialEvents = [
  // Monday (day 0)
  { day: 0, start: "12:30", end: "14:00", title: "20846 - Econometrics II", type: "Group 102 - Seminar", room: "Classroom 20.047", color: "pink" },
  { day: 0, start: "15:00", end: "16:30", title: "25259 - Financial Derivatives & Risk Mgmt", type: "Group 1 - Theory", room: "Classroom 13.007", color: "blue" },
  { day: 0, start: "17:00", end: "18:30", title: "26178 - Multivariate Data Analysis", type: "Group 1 - Theory", room: "Classroom 40.063", color: "green" },
  
  // Tuesday (day 1)
  { day: 1, start: "12:30", end: "14:00", title: "23171 - Principles of Public Economics", type: "Group 103 - Seminar", room: "Classroom 13.004", color: "pink" },
  { day: 1, start: "15:00", end: "16:30", title: "25259 - Financial Derivatives & Risk Mgmt", type: "Group 1 - Theory", room: "Classroom 13.007", color: "blue" },
  { day: 1, start: "17:00", end: "18:30", title: "26178 - Multivariate Data Analysis", type: "Group 1 - Theory", room: "Classroom 40.063", color: "green" },

  // Wednesday (day 2)
  { day: 2, start: "15:00", end: "16:30", title: "25259 - Financial Derivatives & Risk Mgmt", type: "Group 101 - Seminar", room: "Classroom 13.004", color: "blue" },

  // Thursday (day 3)
  { day: 3, start: "11:00", end: "12:30", title: "20845 - Econometrics II", type: "Group 1 - Theory", room: "Classroom 40.148", color: "orange" },
  { day: 3, start: "13:00", end: "14:30", title: "23171 - Principles of Public Economics", type: "Group 1 - Theory", room: "Classroom 40.144", color: "pink" },
  { day: 3, start: "15:00", end: "16:30", title: "26178 - Multivariate Data Analysis", type: "Group 101 - Seminar", room: "Classroom 40.153", color: "green" },

  // Friday (day 4)
  { day: 4, start: "11:00", end: "12:30", title: "20846 - Econometrics II", type: "Group 1 - Theory", room: "Classroom 40.148", color: "orange" },
  { day: 4, start: "13:00", end: "14:30", title: "23171 - Principles of Public Economics", type: "Group 1 - Theory", room: "Classroom 40.144", color: "pink" }
];

let events = [];
let currentMobileDay = 0;

// Passcode Logic
const CORRECT_PASS = "Nemo";

document.getElementById('login-btn').addEventListener('click', handleLogin);
function handleLogin() {
  const input = document.getElementById('password-input').value;
  if (input === CORRECT_PASS) {
    document.getElementById('login-overlay').classList.add('hidden');
    localStorage.setItem('sched_authenticated', 'true');
  } else {
    document.getElementById('login-error').textContent = "Invalid passcode.";
  }
}

if (localStorage.getItem('sched_authenticated') === 'true') {
  document.getElementById('login-overlay').classList.add('hidden');
}

// Convert "HH:MM" to offset pixels relative to 08:00 AM start
function timeToPixels(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const startHour = 8; // Timeline starts at 08:00 AM
  const totalMinutes = (hours - startHour) * 60 + minutes;
  return (totalMinutes / 60) * 60; // 60px per hour
}

// Format time for card badges
function formatTimeBadge(start, end) {
  return `${start} - ${end}`;
}

// Render Schedule Events
function renderEvents() {
  for (let i = 0; i < 5; i++) {
    const el = document.getElementById(`day-${i}`);
    if (el) el.innerHTML = '';
  }

  events.forEach(evt => {
    const dayContainer = document.getElementById(`day-${evt.day}`);
    if (!dayContainer) return;

    const topPx = timeToPixels(evt.start);
    const endPx = timeToPixels(evt.end);
    const heightPx = endPx - topPx;

    const card = document.createElement('div');
    card.className = `event-card ${evt.color || 'blue'}`;
    card.style.top = `${topPx}px`;
    card.style.height = `${heightPx}px`;

    card.innerHTML = `
      <div class="event-time" style="font-weight:bold; font-size:0.75rem; border-bottom:1px solid rgba(0,0,0,0.15); margin-bottom:2px; padding-bottom:1px;">${formatTimeBadge(evt.start, evt.end)}</div>
      <div class="event-title">${evt.title}</div>
      <div class="event-type">${evt.type}</div>
      <div class="event-room">${evt.room}</div>
    `;

    dayContainer.appendChild(card);
  });
}

// Fetch Events from Supabase or Fallbacks
async function loadEvents() {
  let loadedFromSupabase = false;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('exams').select('*');
      if (!error && data && data.length > 0) {
        events = data;
        loadedFromSupabase = true;
      }
    } catch (err) {
      console.warn('Supabase fetch blocked by local file:// protocol. Falling back to initialEvents.');
    }
  }

  // If Supabase fails (e.g. running locally), bypass local storage completely and use correct initial data
  if (!loadedFromSupabase) {
    events = [...initialEvents];
  }
}

// Live Time Indicator Line
function updateLiveMarker() {
  const marker = document.getElementById('live-marker');
  const label = document.getElementById('live-time-label');
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours >= 8 && hours <= 19) {
    marker.classList.remove('hidden');
    // Offset +30px to align with .day-header height
    const topPx = timeToPixels(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`) + 30; 
    marker.style.top = `${topPx}px`;
    label.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
  } else {
    marker.classList.add('hidden');
  }
}

// Mobile Day View
function setMobileDay(dayIdx) {
  if (dayIdx < 0) dayIdx = 0;
  if (dayIdx > 4) dayIdx = 4;
  currentMobileDay = dayIdx;

  const dayColumns = document.querySelectorAll('.day-column');
  dayColumns.forEach((col, idx) => {
    if (idx === dayIdx) {
      col.classList.add('active-mobile');
    } else {
      col.classList.remove('active-mobile');
    }
  });

  const dayNames = ["19 Monday", "20 Tuesday", "21 Wednesday", "22 Thursday", "23 Friday"];
  document.getElementById('current-day-label').textContent = dayNames[dayIdx];
}

document.getElementById('prev-day-btn').addEventListener('click', () => setMobileDay(currentMobileDay - 1));
document.getElementById('next-day-btn').addEventListener('click', () => setMobileDay(currentMobileDay + 1));

// Add Exam / Test Modal Controls
const modal = document.getElementById('exam-modal');
document.getElementById('add-exam-btn').addEventListener('click', () => modal.classList.remove('hidden'));
document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.add('hidden'));

document.getElementById('exam-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newEvent = {
    title: document.getElementById('exam-title').value,
    type: document.getElementById('exam-type').value,
    day: parseInt(document.getElementById('exam-day').value),
    start: document.getElementById('exam-start').value,
    end: document.getElementById('exam-end').value,
    room: document.getElementById('exam-room').value,
    color: 'orange'
  };

  if (supabaseClient) {
    await supabaseClient.from('exams').insert([newEvent]);
  }

  events.push(newEvent);
  renderEvents();
  
  document.getElementById('exam-form').reset();
  modal.classList.add('hidden');
});

// Application Initialization
window.addEventListener('DOMContentLoaded', async () => {
  // THIS LINE FIXES THE ISSUE: It permanently deletes the corrupted saved schedule from your browser
  localStorage.removeItem('sched_events'); 

  await loadEvents();
  renderEvents();
  updateLiveMarker();
  setInterval(updateLiveMarker, 60000);
  
  const todayDay = new Date().getDay(); 
  const mobileStartDay = (todayDay >= 1 && todayDay <= 5) ? todayDay - 1 : 0;
  setMobileDay(mobileStartDay);
});