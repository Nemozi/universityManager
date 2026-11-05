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

// Default recurring weekly classes (day: 0=Mon, 1=Tue, ..., 4=Fri)
const initialEvents = [
  { day: 0, start: "12:30", end: "14:00", title: "20846 - Econometrics II", type: "Group 102 - Seminar", room: "Classroom 20.047", color: "orange" },
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
  { day: 4, start: "13:00", end: "14:30", title: "23171 - Principles of Public Economics", type: "Group 1 - Theory", room: "Classroom 40.144", color: "pink" },

  // Example of a specific date exam (Format: YYYY-MM-DD)
  { date: "2026-11-04", start: "09:00", end: "11:00", title: "Econometrics II Final Exam", type: "Exam", room: "Auditorium 1", color: "orange" }
];

let events = [];
let currentMobileDay = 0;

// --- People / schedules ---
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

// --- Date & Week Navigation State ---
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
}

function formatDateISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let currentMonday = getMonday(new Date());

function getWeekDates(mondayDate) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// --- Time helpers ---
function toMinutes(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
function toHM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function toPercent(min) {
  return ((min - START_MIN) / TOTAL_MIN) * 100;
}

// --- Render Headers ---
function renderHeaders() {
  const weekDates = getWeekDates(currentMonday);
  const fmt = (d, o) => d.toLocaleDateString('en-GB', o);
  const first = weekDates[0], last = weekDates[4];

  document.getElementById('week-title').textContent =
    `${fmt(first, { month: 'short', day: 'numeric' })} – ${fmt(last, { month: 'short', day: 'numeric' })}, ${last.getFullYear()}`;

  document.querySelectorAll('.day-header').forEach((el, i) => {
    const dayDate = weekDates[i];
    el.textContent = `${fmt(dayDate, { weekday: 'short' })} ${dayDate.getDate()}/${dayDate.getMonth() + 1}`;
  });

  const todayIdx = getTodayIndex();
  document.querySelectorAll('.day-column').forEach((col, i) =>
    col.classList.toggle('today', i === todayIdx));
}

// Index (0-4) of today within currently displayed week, or -1
function getTodayIndex() {
  const weekDates = getWeekDates(currentMonday);
  const now = new Date();
  return weekDates.findIndex(d =>
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate());
}

// --- Time Axis ---
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

// --- Overlap Layout ---
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
  div.textContent = text;
  parent.appendChild(div);
}

// --- Render Events for Current Week ---
function renderEvents() {
  const weekDates = getWeekDates(currentMonday);

  for (let i = 0; i < 5; i++) {
    const el = document.getElementById(`day-${i}`);
    if (!el) continue;
    el.innerHTML = '';

    const currentDayDateStr = formatDateISO(weekDates[i]);

    // Filter events matching either specific date OR recurring day index
    const dayEvents = events
      .filter(ev => {
        if (ev.date) {
          return ev.date === currentDayDateStr;
        }
        return Number(ev.day) === i;
      })
      .map(ev => ({
        ev,
        s: Math.max(toMinutes(ev.start), START_MIN),
        e: Math.min(toMinutes(ev.end), END_HOUR * 60)
      }))
      .filter(x => Number.isFinite(x.s) && Number.isFinite(x.e) && x.e > x.s);

    layoutDay(dayEvents).forEach(({ ev, s, e, col, cols }) => {
      const card = document.createElement('div');
      card.className = `event-card ${ev.color || 'blue'} ${ev.date ? 'date-specific' : ''}`;
      card.style.top = `${toPercent(s)}%`;
      card.style.height = `${((e - s) / TOTAL_MIN) * 100}%`;
      card.style.left = `calc(${(col / cols) * 100}% + 0.15rem)`;
      card.style.width = `calc(${100 / cols}% - 0.3rem)`;

      addLine(card, 'event-time', `${toHM(toMinutes(ev.start))} - ${toHM(toMinutes(ev.end))}`);
      if (ev.date) {
        addLine(card, 'event-badge', ev.type === 'Exam' ? 'EXAM' : 'ONE-OFF');
      }
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

// --- Fetch Events ---
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
  return person === PEOPLE[0].id ? [...initialEvents] : [];
}

// --- Live Marker ---
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

// --- Navigation Controls ---
document.getElementById('prev-week-btn').addEventListener('click', () => {
  currentMonday.setDate(currentMonday.getDate() - 7);
  updateCalendarView();
});
document.getElementById('next-week-btn').addEventListener('click', () => {
  currentMonday.setDate(currentMonday.getDate() + 7);
  updateCalendarView();
});
document.getElementById('today-btn').addEventListener('click', () => {
  currentMonday = getMonday(new Date());
  updateCalendarView();
});
document.getElementById('jump-date-picker').addEventListener('change', (e) => {
  if (e.target.value) {
    const selectedDate = new Date(e.target.value + "T00:00:00");
    currentMonday = getMonday(selectedDate);
    updateCalendarView();
  }
});

function updateCalendarView() {
  renderHeaders();
  renderEvents();
  document.getElementById('jump-date-picker').value = formatDateISO(currentMonday);
}

// --- Mobile Day View ---
function setMobileDay(dayIdx) {
  currentMobileDay = Math.min(Math.max(dayIdx, 0), 4);
  document.querySelectorAll('.day-column').forEach((col, idx) =>
    col.classList.toggle('active-mobile', idx === currentMobileDay));
  document.getElementById('current-day-label').textContent =
    document.querySelectorAll('.day-header')[currentMobileDay].textContent;
}
document.getElementById('prev-day-btn').addEventListener('click', () => setMobileDay(currentMobileDay - 1));
document.getElementById('next-day-btn').addEventListener('click', () => setMobileDay(currentMobileDay + 1));

// --- Modal Handling ---
const modal = document.getElementById('exam-modal');
const form = document.getElementById('exam-form');
const modalTitle = modal.querySelector('h3');
const typeSelect = document.getElementById('exam-type');
const modeSelect = document.getElementById('exam-mode');
const dateGroup = document.getElementById('specific-date-group');
const dayGroup = document.getElementById('recurring-day-group');
const saveBtn = document.getElementById('save-exam-btn');
const ADD_TITLE = modalTitle.textContent;
const ADD_SAVE = saveBtn.textContent;
let editingEvent = null;

const deleteBtn = document.createElement('button');
deleteBtn.type = 'button';
deleteBtn.className = 'danger hidden';
deleteBtn.textContent = 'Delete';
modal.querySelector('.modal-actions').prepend(deleteBtn);

modeSelect.addEventListener('change', () => {
  const isDate = modeSelect.value === 'date';
  dateGroup.classList.toggle('hidden', !isDate);
  dayGroup.classList.toggle('hidden', isDate);
});

function openModal(ev = null) {
  editingEvent = ev;
  form.reset();

  const todayStr = formatDateISO(new Date());
  document.getElementById('exam-date').value = todayStr;

  if (ev) {
    if (![...typeSelect.options].some(o => o.value === ev.type)) {
      typeSelect.add(new Option(ev.type, ev.type));
    }
    document.getElementById('exam-title').value = ev.title;
    typeSelect.value = ev.type;

    if (ev.date) {
      modeSelect.value = 'date';
      document.getElementById('exam-date').value = ev.date;
    } else {
      modeSelect.value = 'recurring';
      document.getElementById('exam-day').value = String(ev.day ?? 0);
    }

    document.getElementById('exam-start').value = toHM(toMinutes(ev.start));
    document.getElementById('exam-end').value = toHM(toMinutes(ev.end));
    document.getElementById('exam-room').value = ev.room;
  } else {
    modeSelect.value = 'date';
  }

  modeSelect.dispatchEvent(new Event('change'));
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
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const isDateMode = modeSelect.value === 'date';
  const data = {
    title: document.getElementById('exam-title').value,
    type: typeSelect.value,
    start: document.getElementById('exam-start').value,
    end: document.getElementById('exam-end').value,
    room: document.getElementById('exam-room').value,
    color: typeSelect.value === 'Exam' ? 'orange' : 'blue',
    person: currentPerson
  };

  if (isDateMode) {
    data.date = document.getElementById('exam-date').value;
    data.day = null;
  } else {
    data.day = parseInt(document.getElementById('exam-day').value, 10);
    data.date = null;
  }

  if (toMinutes(data.end) <= toMinutes(data.start)) {
    alert('End time must be after start time.');
    return;
  }

  if (editingEvent) {
    if (supabaseClient && editingEvent.id != null) {
      const { data: rows, error } = await supabaseClient
        .from('exams').update(data).eq('id', editingEvent.id).select();
      if (error || !rows || rows.length === 0) {
        alert(`Could not save changes: ${error ? error.message : 'no row updated'}`);
        return;
      }
    }
    // Update local object
    delete editingEvent.date;
    delete editingEvent.day;
    Object.assign(editingEvent, data);
  } else {
    let saved = { ...data };
    if (supabaseClient) {
      const { data: rows, error } = await supabaseClient.from('exams').insert([data]).select();
      if (error) {
        alert(`Could not save event: ${error.message}`);
        return;
      }
      if (rows && rows[0]) saved = rows[0];
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
      alert(`Could not delete: ${error ? error.message : 'no row deleted'}`);
      return;
    }
  }
  events = events.filter(x => x !== editingEvent);
  renderEvents();
  closeModal();
});

// --- Person Switcher ---
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
  if (token !== loadToken) return;
  events = list;
  renderEvents();
});

// --- Init ---
window.addEventListener('DOMContentLoaded', async () => {
  renderTimeAxis();
  updateNameLink();
  events = await fetchEvents(currentPerson);
  updateCalendarView();

  setInterval(() => {
    updateLiveMarker();
  }, 30000);

  const todayIdx = getTodayIndex();
  setMobileDay(todayIdx >= 0 ? todayIdx : 0);
});