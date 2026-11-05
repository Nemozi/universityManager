// --- Supabase Config ---
const SUPABASE_URL = "https://coltzqgllwrebqkfbufd.supabase.co";
const SUPABASE_KEY = "sb_publishable_jDvtuqeue72tzsuYrwc7SA_JfIHeOMz";

let supabaseClient = null;
if (window.supabase && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// --- Timetable scale (must match --hours in style.css) ---
const START_HOUR = 8;
const END_HOUR = 20;
const START_MIN = START_HOUR * 60;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

// Fallback schedule
const initialEvents = [
  { day: 0, start: "12:30", end: "14:00", title: "20846 - Econometrics II", type: "Group 102 - Seminar", room: "Classroom 20.047", color: "pink" },
  { day: 0, start: "15:00", end: "16:30", title: "25259 - Financial Derivatives & Risk Mgmt", type: "Group 1 - Theory", room: "Classroom 13.007", color: "blue" },
  { day: 0, start: "17:00", end: "18:30", title: "26178 - Multivariate Data Analysis", type: "Group 1 - Theory", room: "Classroom 40.063", color: "green" },

  { day: 1, start: "12:30", end: "14:00", title: "23171 - Principles of Public Economics", type: "Group 103 - Seminar", room: "Classroom 13.004", color: "pink" },
  { day: 1, start: "15:00", end: "16:30", title: "25259 - Financial Derivatives & Risk Mgmt", type: "Group 1 - Theory", room: "Classroom 13.007", color: "blue" },
  { day: 1, start: "17:00", end: "18:30", title: "26178 - Multivariate Data Analysis", type: "Group 1 - Theory", room: "Classroom 40.063", color: "green" },

  { day: 2, start: "15:00", end: "16:30", title: "25259 - Financial Derivatives & Risk Mgmt", type: "Group 101 - Seminar", room: "Classroom 13.004", color: "blue" },

  { day: 3, start: "11:00", end: "12:30", title: "20845 - Econometrics II", type: "Group 1 - Theory", room: "Classroom 40.148", color: "orange" },
  { day: 3, start: "13:00", end: "14:30", title: "23171 - Principles of Public Economics", type: "Group 1 - Theory", room: "Classroom 40.144", color: "pink" },
  { day: 3, start: "15:00", end: "16:30", title: "26178 - Multivariate Data Analysis", type: "Group 101 - Seminar", room: "Classroom 40.153", color: "green" },

  { day: 4, start: "11:00", end: "12:30", title: "20846 - Econometrics II", type: "Group 1 - Theory", room: "Classroom 40.148", color: "orange" },
  { day: 4, start: "13:00", end: "14:30", title: "23171 - Principles of Public Economics", type: "Group 1 - Theory", room: "Classroom 40.144", color: "pink" }
];

let events = [];
let currentMobileDay = 0;

// --- People / schedules (first entry is the default) ---
const PEOPLE = [
  { id: 'stasch', label: 'Stasch' },
  { id: 'nemo', label: 'Nemo' }
];
let currentPerson = PEOPLE[0].id;
let loadToken = 0;

// --- Passcode ---
const CORRECT_PASS = "Fabra";

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

// --- Time helpers ---
// Accepts "12:30", "12:30:00" (Supabase time columns), "8:05" -> minutes since midnight
function toMinutes(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
function toHM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
// Minutes -> percentage of the visible timetable height (resolution independent)
function toPercent(min) {
  return ((min - START_MIN) / TOTAL_MIN) * 100;
}

// --- Week handling: always show the current week (Sat/Sun -> next week) ---
function getWeekDates() {
  const now = new Date();
  const dow = now.getDay();                        // 0 = Sun ... 6 = Sat
  const mondayOffset = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  return Array.from({ length: 5 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}
let weekDates = getWeekDates();

function renderHeaders() {
  const fmt = (d, o) => d.toLocaleDateString('en-GB', o);
  const first = weekDates[0], last = weekDates[4];
  document.querySelector('.header h1').textContent =
    `${fmt(first, { month: 'long', day: 'numeric' })} – ${fmt(last, { day: 'numeric' })}, ${last.getFullYear()}`;

  document.querySelectorAll('.day-header').forEach((el, i) => {
    el.textContent = `${weekDates[i].getDate()} ${fmt(weekDates[i], { weekday: 'long' })}`;
  });

  const todayIdx = getTodayIndex();
  document.querySelectorAll('.day-column').forEach((col, i) =>
    col.classList.toggle('today', i === todayIdx));
}

// Index (0-4) of today within the shown week, or -1 (weekend)
function getTodayIndex() {
  const now = new Date();
  return weekDates.findIndex(d =>
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate());
}

// --- Time axis (labels are positioned in %, exactly on their hour line) ---
function renderTimeAxis() {
  const axis = document.getElementById('time-labels');
  axis.innerHTML = '';
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    label.style.top = `${toPercent(h * 60)}%`;
    label.textContent = `${String(h).padStart(2, '0')}:00`;
    axis.appendChild(label);
  }
}

// --- Overlap layout (like Google Calendar: overlapping events share the width) ---
function layoutDay(list) {
  const items = list.sort((a, b) => a.s - b.s || a.e - b.e);
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    cluster.forEach(x => {
      let i = cols.findIndex(end => end <= x.s);
      if (i < 0) i = cols.length;
      cols[i] = x.e;
      x.col = i;
    });
    cluster.forEach(x => (x.cols = cols.length));
    cluster = [];
  };
  items.forEach(x => {
    if (cluster.length && x.s >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(x);
    clusterEnd = Math.max(clusterEnd, x.e);
  });
  flush();
  return items;
}

function addLine(parent, className, text) {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;           // textContent: DB values can't inject HTML
  parent.appendChild(div);
}

// --- Render events ---
function renderEvents() {
  for (let i = 0; i < 5; i++) {
    const el = document.getElementById(`day-${i}`);
    if (!el) continue;
    el.innerHTML = '';

    const dayEvents = events
      .filter(ev => Number(ev.day) === i)
      .map(ev => ({
        ev,
        s: Math.max(toMinutes(ev.start), START_MIN),
        e: Math.min(toMinutes(ev.end), END_HOUR * 60)
      }))
      .filter(x => Number.isFinite(x.s) && Number.isFinite(x.e) && x.e > x.s);

    layoutDay(dayEvents).forEach(({ ev, s, e, col, cols }) => {
      const card = document.createElement('div');
      card.className = `event-card ${ev.color || 'blue'}`;
      card.style.top = `${toPercent(s)}%`;
      card.style.height = `${((e - s) / TOTAL_MIN) * 100}%`;
      card.style.left = `calc(${(col / cols) * 100}% + 0.15rem)`;
      card.style.width = `calc(${100 / cols}% - 0.3rem)`;

      addLine(card, 'event-time', `${toHM(toMinutes(ev.start))} - ${toHM(toMinutes(ev.end))}`);
      addLine(card, 'event-title', ev.title);
      addLine(card, 'event-type', ev.type);
      addLine(card, 'event-room', ev.room);

      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('click', () => openModal(ev));
      card.addEventListener('keydown', (k) => { if (k.key === 'Enter') openModal(ev); });
      el.appendChild(card);
    });
  }
  updateLiveMarker();
}

// --- Load events of one person ---
async function fetchEvents(person) {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('exams').select('*').eq('person', person);
      if (error) console.warn('Supabase error:', error.message);
      else if (data && data.length > 0) return data;
    } catch (err) {
      console.warn('Supabase fetch failed.', err);
    }
  }
  // Offline fallback: the built-in timetable belongs to the default person
  return person === PEOPLE[0].id ? [...initialEvents] : [];
}

// --- Live marker: only in today's column, positioned in % of the same scale ---
function updateLiveMarker() {
  document.querySelectorAll('.live-marker').forEach(m => m.remove());

  const todayIdx = getTodayIndex();
  if (todayIdx < 0) return;

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < START_MIN || minutes > END_HOUR * 60) return;

  const marker = document.createElement('div');
  marker.className = 'live-marker';
  marker.style.top = `${toPercent(minutes)}%`;
  marker.title = toHM(minutes);
  document.getElementById(`day-${todayIdx}`).appendChild(marker);
}

// --- Mobile day view ---
function setMobileDay(dayIdx) {
  currentMobileDay = Math.min(Math.max(dayIdx, 0), 4);
  document.querySelectorAll('.day-column').forEach((col, idx) =>
    col.classList.toggle('active-mobile', idx === currentMobileDay));
  document.getElementById('current-day-label').textContent =
    document.querySelectorAll('.day-header')[currentMobileDay].textContent;
}
document.getElementById('prev-day-btn').addEventListener('click', () => setMobileDay(currentMobileDay - 1));
document.getElementById('next-day-btn').addEventListener('click', () => setMobileDay(currentMobileDay + 1));

// --- Add / Edit / Delete modal ---
const modal = document.getElementById('exam-modal');
const form = document.getElementById('exam-form');
const modalTitle = modal.querySelector('h3');
const typeSelect = document.getElementById('exam-type');
const saveBtn = document.getElementById('save-exam-btn');
const ADD_TITLE = modalTitle.textContent;   // keeps whatever wording index.html uses
const ADD_SAVE = saveBtn.textContent;
let editingEvent = null;   // the event being edited, or null when adding

// Delete button is created here, so index.html needs no change
const deleteBtn = document.createElement('button');
deleteBtn.type = 'button';
deleteBtn.className = 'danger hidden';
deleteBtn.textContent = 'Delete';
modal.querySelector('.modal-actions').prepend(deleteBtn);

function openModal(ev = null) {
  editingEvent = ev;
  form.reset();
  if (ev) {
    // timetable entries have free-text types ("Group 1 - Theory"), make sure the select can show them
    if (![...typeSelect.options].some(o => o.value === ev.type)) {
      typeSelect.add(new Option(ev.type, ev.type));
    }
    document.getElementById('exam-title').value = ev.title;
    typeSelect.value = ev.type;
    document.getElementById('exam-day').value = String(ev.day);
    document.getElementById('exam-start').value = toHM(toMinutes(ev.start));
    document.getElementById('exam-end').value = toHM(toMinutes(ev.end));
    document.getElementById('exam-room').value = ev.room;
  }
  modalTitle.textContent = ev ? 'Edit Event' : ADD_TITLE;
  saveBtn.textContent = ev ? 'Save Changes' : ADD_SAVE;
  deleteBtn.classList.toggle('hidden', !ev);
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  editingEvent = null;
}

document.getElementById('add-exam-btn').addEventListener('click', (e) => { e.preventDefault(); openModal(); });
document.getElementById('close-modal-btn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });   // click on backdrop
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    title: document.getElementById('exam-title').value,
    type: typeSelect.value,
    day: parseInt(document.getElementById('exam-day').value, 10),
    start: document.getElementById('exam-start').value,
    end: document.getElementById('exam-end').value,
    room: document.getElementById('exam-room').value
  };

  if (toMinutes(data.end) <= toMinutes(data.start)) {
    alert('End time must be after start time.');
    return;
  }

  if (editingEvent) {
    // UPDATE
    if (supabaseClient && editingEvent.id != null) {
      const { data: rows, error } = await supabaseClient
        .from('exams').update(data).eq('id', editingEvent.id).select();
      if (error || !rows || rows.length === 0) {
        alert(`Could not save changes: ${error ? error.message : 'no row updated (check your Supabase update policy)'}`);
        return;
      }
    }
    Object.assign(editingEvent, data);
  } else {
    // INSERT
    const newEvent = { ...data, color: 'orange', person: currentPerson };
    let saved = newEvent;
    if (supabaseClient) {
      const { data: rows, error } = await supabaseClient.from('exams').insert([newEvent]).select();
      if (error) {
        alert(`Could not save event: ${error.message}`);
        return;
      }
      if (rows && rows[0]) saved = rows[0];   // contains the new id, needed for edit/delete later
    }
    events.push(saved);
  }

  renderEvents();
  closeModal();
});

deleteBtn.addEventListener('click', async () => {
  if (!editingEvent || !confirm(`Delete "${editingEvent.title}"?`)) return;

  if (supabaseClient && editingEvent.id != null) {
    const { data: rows, error } = await supabaseClient
      .from('exams').delete().eq('id', editingEvent.id).select();
    if (error || !rows || rows.length === 0) {
      alert(`Could not delete: ${error ? error.message : 'no row deleted (check your Supabase delete policy)'}`);
      return;
    }
  }
  events = events.filter(x => x !== editingEvent);
  renderEvents();
  closeModal();
});

// --- Switch schedule by clicking the name in the sidebar ---
const nameLink = document.querySelector('.sidebarHeader');
nameLink.style.cursor = 'pointer';

function updateNameLink() {
  const idx = PEOPLE.findIndex(p => p.id === currentPerson);
  const next = PEOPLE[(idx + 1) % PEOPLE.length];
  nameLink.textContent = PEOPLE[idx].label;
  nameLink.title = `Click to show ${next.label}'s schedule`;
}

nameLink.addEventListener('click', async (e) => {
  e.preventDefault();
  const idx = PEOPLE.findIndex(p => p.id === currentPerson);
  currentPerson = PEOPLE[(idx + 1) % PEOPLE.length].id;
  updateNameLink();

  const token = ++loadToken;
  const list = await fetchEvents(currentPerson);
  if (token !== loadToken) return;      // a newer click already won
  events = list;
  renderEvents();
});

// --- Init ---
window.addEventListener('DOMContentLoaded', async () => {
  renderHeaders();
  renderTimeAxis();
  updateNameLink();
  events = await fetchEvents(currentPerson);
  renderEvents();

  setInterval(() => {
    const newWeek = getWeekDates();
    if (newWeek[0].getTime() !== weekDates[0].getTime()) {   // new week started while page is open
      weekDates = newWeek;
      renderHeaders();
    }
    updateLiveMarker();
  }, 30000);

  const todayIdx = getTodayIndex();
  setMobileDay(todayIdx >= 0 ? todayIdx : 0);
});