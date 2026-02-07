/* ================================================
   FitTrack — App Logic (v2)
   Features: WOD routines, weight mid-set, history,
   calendar, streaks, PRs, audio beep, elapsed timer
   ================================================ */

// ---------- Exercise Data ----------
const EXERCISES = {
  hiit: [
    "Burpees", "Jump Squats", "Mountain Climbers", "High Knees",
    "Box Jumps", "Jumping Lunges", "Plank Jacks", "Kettlebell Swings",
    "Battle Ropes", "Tuck Jumps",
  ],
  strength: [
    "Bench Press", "Squat", "Deadlift", "Overhead Press",
    "Barbell Row", "Pull-ups", "Dumbbell Curl", "Tricep Dips",
    "Lunges", "Lat Pulldown",
  ],
};

const PREBUILT_WODS = [
  {
    name: "HIIT Burner",
    exercises: ["Burpees", "Jump Squats", "Mountain Climbers", "High Knees"],
    setsEach: 3, repsEach: 15, rest: 20,
  },
  {
    name: "Upper Body Blast",
    exercises: ["Bench Press", "Overhead Press", "Dumbbell Curl", "Tricep Dips"],
    setsEach: 3, repsEach: 10, rest: 60,
  },
  {
    name: "Lower Body Power",
    exercises: ["Squat", "Lunges", "Jump Squats", "Deadlift"],
    setsEach: 3, repsEach: 12, rest: 60,
  },
  {
    name: "Full Body Starter",
    exercises: ["Squat", "Bench Press", "Barbell Row", "Overhead Press"],
    setsEach: 3, repsEach: 10, rest: 90,
  },
  {
    name: "Cardio Blast",
    exercises: ["High Knees", "Burpees", "Plank Jacks", "Tuck Jumps"],
    setsEach: 4, repsEach: 20, rest: 15,
  },
  {
    name: "Quick HIIT (10 min)",
    exercises: ["Burpees", "Mountain Climbers", "Jump Squats"],
    setsEach: 3, repsEach: 12, rest: 15,
  },
];

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

const screens = {
  home: $("screen-home"),
  wod: $("screen-wod"),
  builder: $("screen-builder"),
  picker: $("screen-picker"),
  setup: $("screen-setup"),
  workout: $("screen-workout"),
  done: $("screen-done"),
  history: $("screen-history"),
};

// ---------- State ----------
let state = {
  theme: localStorage.getItem("ft-theme") || "light",
  currentCategory: "hiit",
  customExercises: JSON.parse(localStorage.getItem("ft-custom") || "[]"),
  customRoutines: JSON.parse(localStorage.getItem("ft-routines") || "[]"),

  // Workout state
  currentExercise: null,
  totalSets: 3,
  targetReps: 10,
  weight: 0,
  restSeconds: 30,
  currentSet: 1,
  actualReps: 10,
  actualWeight: 0,
  totalRepsAccum: 0,
  setLog: [],
  timerInterval: null,
  timerRemaining: 0,
  isResting: false,

  // WOD state
  isWod: false,
  wodRoutine: null,
  wodExerciseIndex: 0,
  wodExerciseLogs: [],

  // Elapsed timer
  elapsedInterval: null,
  workoutStartTime: null,

  // Builder state
  builderExercises: [],

  // Calendar state
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelectedDate: null,
};

// ---------- Audio ----------
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "sine";
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.2);
    }, 200);
  } catch (e) { /* audio not supported */ }
}

// ---------- Storage: Workout Log ----------
function getLog() {
  return JSON.parse(localStorage.getItem("ft-log") || "[]");
}

function saveLog(entry) {
  const log = getLog();
  log.unshift(entry);
  localStorage.setItem("ft-log", JSON.stringify(log));
}

// ---------- Storage: Per-Exercise Stats ----------
function getStats() {
  return JSON.parse(localStorage.getItem("ft-stats") || "{}");
}

function getExerciseStats(name) {
  return getStats()[name] || null;
}

function updateExerciseStats(name, setData) {
  const stats = getStats();
  const existing = stats[name] || { bestWeight: 0, bestReps: 0, history: [] };
  const totalReps = setData.reduce((sum, s) => sum + s.reps, 0);
  const maxWeight = Math.max(...setData.map((s) => s.weight), 0);
  const maxReps = Math.max(...setData.map((s) => s.reps), 0);

  const prs = [];
  if (maxWeight > existing.bestWeight && maxWeight > 0) {
    prs.push(`${name}: New weight PR! ${maxWeight} lbs`);
    existing.bestWeight = maxWeight;
  }
  if (maxReps > existing.bestReps) {
    prs.push(`${name}: New reps PR! ${maxReps} reps`);
    existing.bestReps = maxReps;
  }

  existing.lastUsed = new Date().toISOString().slice(0, 10);
  existing.lastSets = setData.length;
  existing.lastReps = setData.length > 0 ? setData[0].reps : 0;
  existing.lastWeight = maxWeight;
  existing.lastTotalReps = totalReps;

  existing.history.unshift({
    date: existing.lastUsed,
    sets: setData.length,
    totalReps,
    maxWeight,
  });
  if (existing.history.length > 50) existing.history.pop();

  stats[name] = existing;
  localStorage.setItem("ft-stats", JSON.stringify(stats));
  return prs;
}

// ---------- Helpers ----------
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function applyTheme() {
  document.body.setAttribute("data-theme", state.theme);
  localStorage.setItem("ft-theme", state.theme);
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CIRCUMFERENCE = 2 * Math.PI * 54;

function setRingProgress(fraction) {
  $("ring-progress").style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return dateKey(new Date());
}

// ---------- Streak Calculation ----------
function calcStreak() {
  const log = getLog();
  const workoutDays = new Set(log.map((e) => e.date.slice(0, 10)));
  let streak = 0;
  const d = new Date();

  // Check if today counts
  if (workoutDays.has(dateKey(d))) {
    streak = 1;
    d.setDate(d.getDate() - 1);
  } else {
    // if no workout today, start from yesterday
    d.setDate(d.getDate() - 1);
  }

  while (workoutDays.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function renderStreak() {
  const streak = calcStreak();
  $("streak-count").textContent = streak;

  const log = getLog();
  const workoutDays = new Set(log.map((e) => e.date.slice(0, 10)));
  const weekContainer = $("streak-week");

  // Show last 7 days as dots
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const isToday = i === 0;
    const hasDot = workoutDays.has(key);
    dots.push(
      `<span class="streak-dot${hasDot ? " filled" : ""}${isToday ? " today" : ""}"></span>`
    );
  }
  weekContainer.innerHTML = dots.join("");
}

// ---------- Theme Toggles ----------
$("theme-toggle").addEventListener("click", toggleTheme);
$("theme-toggle-p").addEventListener("click", toggleTheme);
$("theme-toggle-h").addEventListener("click", toggleTheme);

// ---------- Back Buttons ----------
document.querySelectorAll(".back-btn").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.back));
});

// ---------- Home Navigation ----------
$("nav-wod").addEventListener("click", () => {
  renderWodList();
  showScreen("wod");
});
$("nav-quick").addEventListener("click", () => {
  renderExerciseList();
  showScreen("picker");
});
$("nav-history").addEventListener("click", () => {
  renderCalendar();
  renderHistoryList();
  showScreen("history");
});

// ================================================================
//  WOD PICKER
// ================================================================
let wodCategory = "prebuilt";

document.querySelectorAll(".wod-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".wod-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    wodCategory = tab.dataset.wodCat;
    renderWodList();
  });
});

function renderWodList() {
  const list = $("wod-list");
  const isCustom = wodCategory === "my-routines";

  $("wod-custom-section").classList.toggle("hidden", !isCustom);

  const routines = isCustom ? state.customRoutines : PREBUILT_WODS;

  if (routines.length === 0) {
    list.innerHTML = '<li class="hint" style="padding:24px;text-align:center;">No custom routines yet. Create one!</li>';
    return;
  }

  list.innerHTML = routines
    .map((r, i) => `
      <li class="wod-item" data-wod-index="${i}" data-wod-type="${isCustom ? "custom" : "prebuilt"}">
        <div class="wod-info">
          <span class="name">${r.name}</span>
          <span class="wod-exercises-preview">${r.exercises.join(" / ")} &mdash; ${r.setsEach} sets, ${r.rest}s rest</span>
        </div>
        <span class="action-arrow">&rsaquo;</span>
      </li>
    `).join("");

  list.querySelectorAll(".wod-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.wodIndex, 10);
      const type = item.dataset.wodType;
      const routine = type === "custom" ? state.customRoutines[idx] : PREBUILT_WODS[idx];
      startWod(routine);
    });
  });
}

// ---------- Routine Builder ----------
$("create-routine-btn").addEventListener("click", () => {
  state.builderExercises = [];
  $("routine-name").value = "";
  $("builder-rest").value = 30;
  renderBuilderList();
  populateBuilderSelect();
  showScreen("builder");
});

function populateBuilderSelect() {
  const sel = $("builder-exercise-select");
  const all = [...EXERCISES.hiit, ...EXERCISES.strength, ...state.customExercises];
  sel.innerHTML = '<option value="">Choose...</option>' +
    all.map((e) => `<option value="${e}">${e}</option>`).join("");
}

$("builder-exercise-select").addEventListener("change", (e) => {
  const val = e.target.value;
  if (!val) return;
  if (!state.builderExercises.includes(val)) {
    state.builderExercises.push(val);
    renderBuilderList();
  }
  e.target.value = "";
});

$("builder-add-custom").addEventListener("click", () => {
  const name = $("builder-custom-name").value.trim();
  if (!name || state.builderExercises.includes(name)) return;
  state.builderExercises.push(name);
  $("builder-custom-name").value = "";
  renderBuilderList();
});

function renderBuilderList() {
  const list = $("builder-list");
  if (state.builderExercises.length === 0) {
    list.innerHTML = '<li class="hint" style="padding:16px;text-align:center;">No exercises added yet</li>';
    return;
  }
  list.innerHTML = state.builderExercises
    .map((name, i) => `
      <li class="builder-item">
        <span class="name">${name}</span>
        <button class="builder-remove" data-idx="${i}">&times;</button>
      </li>
    `).join("");

  list.querySelectorAll(".builder-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.builderExercises.splice(parseInt(btn.dataset.idx, 10), 1);
      renderBuilderList();
    });
  });
}

$("save-routine-btn").addEventListener("click", () => {
  const name = $("routine-name").value.trim() || "My Workout";
  if (state.builderExercises.length === 0) {
    alert("Add at least one exercise!");
    return;
  }
  const routine = {
    name,
    exercises: [...state.builderExercises],
    setsEach: 3,
    repsEach: 10,
    rest: parseInt($("builder-rest").value, 10) || 30,
  };
  state.customRoutines.push(routine);
  localStorage.setItem("ft-routines", JSON.stringify(state.customRoutines));
  showScreen("wod");
  renderWodList();
});

// ================================================================
//  EXERCISE PICKER (Quick Exercise)
// ================================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.currentCategory = tab.dataset.category;
    renderExerciseList();
    $("custom-input").classList.toggle("hidden", state.currentCategory !== "custom");
  });
});

function renderExerciseList() {
  const list = $("exercise-list");
  const stats = getStats();
  let exercises = state.currentCategory === "custom"
    ? state.customExercises
    : (EXERCISES[state.currentCategory] || []);

  if (exercises.length === 0) {
    list.innerHTML = '<li class="hint" style="padding:24px;text-align:center;">No exercises yet. Add one above!</li>';
    return;
  }

  list.innerHTML = exercises
    .map((name) => {
      const s = stats[name];
      const prevText = s
        ? `${s.lastSets}x${s.lastReps} @ ${s.lastWeight} lbs`
        : "No history";
      return `
      <li class="exercise-item" data-exercise="${name}">
        <span class="name">${name}</span>
        <span class="prev">${prevText}</span>
      </li>`;
    }).join("");

  list.querySelectorAll(".exercise-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.currentExercise = item.dataset.exercise;
      state.isWod = false;
      openSetup();
    });
  });
}

$("add-custom-btn").addEventListener("click", () => {
  const name = $("custom-name").value.trim();
  if (!name || state.customExercises.includes(name)) return;
  state.customExercises.push(name);
  localStorage.setItem("ft-custom", JSON.stringify(state.customExercises));
  $("custom-name").value = "";
  renderExerciseList();
});

// ================================================================
//  SETUP SCREEN
// ================================================================
function openSetup() {
  $("setup-title").textContent = state.currentExercise;

  const s = getExerciseStats(state.currentExercise);
  if (s) {
    $("input-sets").value = s.lastSets || 3;
    $("input-reps").value = s.lastReps || 10;
    $("input-weight").value = s.lastWeight || 0;
    $("previous-stats").classList.remove("hidden");
    $("prev-summary").textContent =
      `${s.lastSets} sets x ${s.lastReps} reps @ ${s.lastWeight} lbs — ${s.lastTotalReps} total reps`;
  } else {
    $("input-sets").value = 3;
    $("input-reps").value = 10;
    $("input-weight").value = 0;
    $("input-rest").value = 30;
    $("previous-stats").classList.add("hidden");
  }

  showScreen("setup");
}

$("back-to-picker").addEventListener("click", () => showScreen("picker"));

// Stepper buttons (setup fields)
document.querySelectorAll(".stepper-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    if (!target) return;
    const input = $(target);
    if (!input) return;
    const dir = parseInt(btn.dataset.dir, 10);
    let val = parseInt(input.value, 10) || 0;
    val += dir;
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);
    if (!isNaN(min) && val < min) val = min;
    if (!isNaN(max) && val > max) val = max;
    input.value = val;
  });
});

// ================================================================
//  START WORKOUT (single exercise)
// ================================================================
$("start-workout-btn").addEventListener("click", () => {
  state.totalSets = parseInt($("input-sets").value, 10) || 3;
  state.targetReps = parseInt($("input-reps").value, 10) || 10;
  state.weight = parseInt($("input-weight").value, 10) || 0;
  state.restSeconds = parseInt($("input-rest").value, 10) || 30;
  state.isWod = false;

  beginExercise(state.currentExercise);
});

// ================================================================
//  START WOD (multi-exercise routine)
// ================================================================
function startWod(routine) {
  state.isWod = true;
  state.wodRoutine = routine;
  state.wodExerciseIndex = 0;
  state.wodExerciseLogs = [];
  state.totalSets = routine.setsEach;
  state.targetReps = routine.repsEach;
  state.restSeconds = routine.rest;
  state.weight = 0;

  beginExercise(routine.exercises[0]);
  updateWodProgress();
}

function updateWodProgress() {
  if (!state.isWod) {
    $("wod-progress").classList.add("hidden");
    return;
  }
  $("wod-progress").classList.remove("hidden");
  const total = state.wodRoutine.exercises.length;
  const current = state.wodExerciseIndex + 1;
  const pct = (current / total) * 100;
  $("wod-progress-inner").style.width = pct + "%";
  $("wod-progress-label").textContent = `Exercise ${current}/${total}`;
}

// ================================================================
//  BEGIN EXERCISE (shared by single + WOD)
// ================================================================
function beginExercise(exerciseName) {
  state.currentExercise = exerciseName;
  state.currentSet = 1;
  state.actualReps = state.targetReps;
  state.actualWeight = state.weight;
  state.totalRepsAccum = 0;
  state.setLog = [];
  state.isResting = false;
  state.timerStarted = false;

  // Don't start elapsed timer yet — wait for first "Start Set" tap

  // Last time hint
  const s = getExerciseStats(exerciseName);
  if (s) {
    $("last-time-hint").classList.remove("hidden");
    $("last-time-text").textContent =
      `${s.lastSets} sets x ${s.lastReps} reps @ ${s.lastWeight} lbs`;
    // Pre-fill weight from history
    state.weight = s.lastWeight || 0;
    state.actualWeight = state.weight;
  } else {
    $("last-time-hint").classList.add("hidden");
  }

  updateWorkoutUI();
  resetTimerDisplay();
  updateWodProgress();
  showScreen("workout");
  $("workout-title").textContent = exerciseName;
}

// ================================================================
//  ELAPSED TIMER (shown in the ring when not resting)
// ================================================================
function startElapsedTimer() {
  clearInterval(state.elapsedInterval);
  state.elapsedInterval = setInterval(() => {
    if (!state.isResting) {
      const elapsed = Math.floor((Date.now() - state.workoutStartTime) / 1000);
      $("timer-display").textContent = formatTime(elapsed);
    }
  }, 1000);
}

function stopElapsedTimer() {
  clearInterval(state.elapsedInterval);
  state.elapsedInterval = null;
}

function getElapsedSeconds() {
  if (!state.workoutStartTime) return 0;
  return Math.floor((Date.now() - state.workoutStartTime) / 1000);
}

// ================================================================
//  WORKOUT UI
// ================================================================
function updateWorkoutUI() {
  $("stat-set").textContent = `${state.currentSet}/${state.totalSets}`;
  $("stat-reps").textContent = state.targetReps;
  $("stat-weight").textContent = state.actualWeight;
  $("actual-reps").textContent = state.actualReps;
  $("actual-weight").textContent = state.actualWeight;
  $("total-reps").textContent = state.totalRepsAccum;
}

function resetTimerDisplay() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.isResting = false;
  // Show elapsed workout time in the ring (or 0:00 if not started)
  const elapsed = state.timerStarted ? getElapsedSeconds() : 0;
  $("timer-display").textContent = formatTime(elapsed);
  $("timer-label").textContent = state.timerStarted ? "WORKOUT" : "READY";
  setRingProgress(1);
  $("ring-progress").classList.remove("resting");
  $("complete-set-btn").textContent = "Start Set";
  $("complete-set-btn").disabled = false;
}

// ---------- Reps Adjuster ----------
$("reps-minus").addEventListener("click", () => {
  if (state.actualReps > 0) {
    state.actualReps--;
    $("actual-reps").textContent = state.actualReps;
    $("actual-reps").classList.add("pulse");
    setTimeout(() => $("actual-reps").classList.remove("pulse"), 300);
  }
});

$("reps-plus").addEventListener("click", () => {
  state.actualReps++;
  $("actual-reps").textContent = state.actualReps;
  $("actual-reps").classList.add("pulse");
  setTimeout(() => $("actual-reps").classList.remove("pulse"), 300);
});

// ---------- Weight Adjuster (mid-set) ----------
$("weight-minus").addEventListener("click", () => {
  if (state.actualWeight >= 5) {
    state.actualWeight -= 5;
  } else {
    state.actualWeight = 0;
  }
  $("actual-weight").textContent = state.actualWeight;
  $("stat-weight").textContent = state.actualWeight;
  $("actual-weight").classList.add("pulse");
  setTimeout(() => $("actual-weight").classList.remove("pulse"), 300);
});

$("weight-plus").addEventListener("click", () => {
  state.actualWeight += 5;
  $("actual-weight").textContent = state.actualWeight;
  $("stat-weight").textContent = state.actualWeight;
  $("actual-weight").classList.add("pulse");
  setTimeout(() => $("actual-weight").classList.remove("pulse"), 300);
});

// ---------- Rest Timer ----------
function startRestTimer() {
  state.isResting = true;
  state.timerRemaining = state.restSeconds;
  $("ring-progress").classList.add("resting");
  $("timer-label").textContent = "REST";
  $("complete-set-btn").textContent = "Skip Rest";

  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.timerRemaining--;

    if (state.timerRemaining <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      state.isResting = false;
      $("ring-progress").classList.remove("resting");

      playBeep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      state.currentSet++;
      state.actualReps = state.targetReps;
      updateWorkoutUI();
      resetTimerDisplay();
      return;
    }

    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  $("timer-display").textContent = formatTime(state.timerRemaining);
  setRingProgress(state.timerRemaining / state.restSeconds);
}

// ---------- Complete Set ----------
$("complete-set-btn").addEventListener("click", () => {
  if (state.isResting) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.isResting = false;
    $("ring-progress").classList.remove("resting");
    state.currentSet++;
    state.actualReps = state.targetReps;
    updateWorkoutUI();
    resetTimerDisplay();
    return;
  }

  // Start the elapsed timer on first tap
  if (!state.timerStarted) {
    state.timerStarted = true;
    state.workoutStartTime = Date.now();
    startElapsedTimer();
  }

  state.setLog.push({
    set: state.currentSet,
    reps: state.actualReps,
    weight: state.actualWeight,
  });
  state.totalRepsAccum += state.actualReps;
  $("total-reps").textContent = state.totalRepsAccum;

  if (state.currentSet >= state.totalSets) {
    finishExercise();
    return;
  }

  startRestTimer();
});

// ---------- Finish Exercise ----------
function finishExercise() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  const prs = updateExerciseStats(state.currentExercise, state.setLog);

  if (state.isWod) {
    state.wodExerciseLogs.push({
      name: state.currentExercise,
      sets: [...state.setLog],
      totalReps: state.totalRepsAccum,
      prs,
    });

    state.wodExerciseIndex++;
    if (state.wodExerciseIndex < state.wodRoutine.exercises.length) {
      const nextExercise = state.wodRoutine.exercises[state.wodExerciseIndex];
      // Carry weight from stats if available
      const s = getExerciseStats(nextExercise);
      state.weight = s ? (s.lastWeight || 0) : 0;
      beginExercise(nextExercise);
      return;
    }
    // All exercises done
    finishWorkout();
  } else {
    // Single exercise
    state.wodExerciseLogs = [{
      name: state.currentExercise,
      sets: [...state.setLog],
      totalReps: state.totalRepsAccum,
      prs,
    }];
    finishWorkout();
  }
}

// ---------- Finish Workout ----------
function finishWorkout() {
  stopElapsedTimer();
  const duration = getElapsedSeconds();

  const logEntry = {
    id: Date.now().toString(36),
    date: new Date().toISOString(),
    routineName: state.isWod ? state.wodRoutine.name : null,
    duration,
    exercises: state.wodExerciseLogs.map((e) => ({
      name: e.name,
      sets: e.sets,
      totalReps: e.totalReps,
    })),
  };
  saveLog(logEntry);

  // Collect all PRs
  const allPrs = state.wodExerciseLogs.flatMap((e) => e.prs || []);

  // Duration
  $("done-duration").textContent = `Completed in ${formatTime(duration)}`;

  // PR badges
  if (allPrs.length > 0) {
    $("pr-badges").classList.remove("hidden");
    $("pr-badges").innerHTML = allPrs
      .map((p) => `<span class="pr-badge">${p}</span>`)
      .join("");
  } else {
    $("pr-badges").classList.add("hidden");
  }

  // Summary
  let html = "";
  if (state.isWod) {
    html += `<p><strong>${state.wodRoutine.name}</strong></p>`;
  }
  for (const ex of state.wodExerciseLogs) {
    html += `<p><strong>${ex.name}</strong></p>`;
    html += ex.sets
      .map((s) => `Set ${s.set}: <strong>${s.reps} reps</strong> @ ${s.weight} lbs`)
      .join("<br>");
    html += `<br>Total: <strong>${ex.totalReps} reps</strong><br><br>`;
  }
  $("done-summary").innerHTML = html;

  showScreen("done");
}

// ---------- Quit Workout ----------
$("quit-workout").addEventListener("click", () => {
  const hasProgress = state.setLog.length > 0 || state.wodExerciseLogs.length > 0;
  if (hasProgress && !confirm("You have progress. Quit this workout?")) return;
  clearInterval(state.timerInterval);
  stopElapsedTimer();
  showScreen("home");
});

// ---------- Done Screen ----------
$("done-btn").addEventListener("click", () => {
  renderStreak();
  showScreen("home");
});

$("restart-btn").addEventListener("click", () => {
  if (state.isWod && state.wodRoutine) {
    startWod(state.wodRoutine);
  } else {
    beginExercise(state.currentExercise);
  }
});

// ================================================================
//  HISTORY + CALENDAR
// ================================================================
$("cal-prev").addEventListener("click", () => {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  state.calSelectedDate = null;
  renderCalendar();
  renderHistoryList();
});

$("cal-next").addEventListener("click", () => {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  state.calSelectedDate = null;
  renderCalendar();
  renderHistoryList();
});

$("clear-filter").addEventListener("click", () => {
  state.calSelectedDate = null;
  renderCalendar();
  renderHistoryList();
});

function renderCalendar() {
  const year = state.calYear;
  const month = state.calMonth;
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  $("cal-month").textContent = `${months[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const log = getLog();
  const workoutDates = new Set(log.map((e) => e.date.slice(0, 10)));
  const today = todayKey();

  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const classes = ["cal-day"];
    if (key === today) classes.push("today");
    if (workoutDates.has(key)) classes.push("has-workout");
    if (state.calSelectedDate === key) classes.push("selected");
    html += `<div class="${classes.join(" ")}" data-date="${key}">${d}</div>`;
  }

  $("cal-grid").innerHTML = html;

  $("cal-grid").querySelectorAll(".cal-day:not(.empty)").forEach((cell) => {
    cell.addEventListener("click", () => {
      state.calSelectedDate = state.calSelectedDate === cell.dataset.date
        ? null
        : cell.dataset.date;
      renderCalendar();
      renderHistoryList();
    });
  });
}

function renderHistoryList() {
  const log = getLog();
  let filtered = log;

  if (state.calSelectedDate) {
    filtered = log.filter((e) => e.date.slice(0, 10) === state.calSelectedDate);
    $("history-filter").classList.remove("hidden");
    $("history-filter-text").textContent = `Showing: ${state.calSelectedDate}`;
  } else {
    $("history-filter").classList.add("hidden");
  }

  const list = $("history-list");

  if (filtered.length === 0) {
    list.innerHTML = "";
    $("history-empty").style.display = "block";
    return;
  }

  $("history-empty").style.display = "none";

  list.innerHTML = filtered.map((entry, i) => {
    const d = new Date(entry.date);
    const dateStr = d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric"
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit"
    });
    const name = entry.routineName || entry.exercises.map((e) => e.name).join(", ");
    const totalSets = entry.exercises.reduce((s, e) => s + e.sets.length, 0);
    const totalReps = entry.exercises.reduce((s, e) => s + e.totalReps, 0);

    let detail = "";
    for (const ex of entry.exercises) {
      detail += `<strong>${ex.name}</strong><br>`;
      detail += ex.sets
        .map((s) => `&nbsp;&nbsp;Set ${s.set}: ${s.reps} reps @ ${s.weight} lbs`)
        .join("<br>");
      detail += "<br>";
    }

    return `
      <li class="history-item" data-idx="${i}">
        <div class="history-top">
          <span class="history-name">${name}</span>
          <span class="history-date">${dateStr} ${timeStr}</span>
        </div>
        <div class="history-stats">
          ${totalSets} sets &middot; ${totalReps} reps &middot; ${formatTime(entry.duration || 0)}
        </div>
        <div class="history-detail">${detail}</div>
      </li>
    `;
  }).join("");

  list.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => {
      item.classList.toggle("expanded");
    });
  });
}

// ================================================================
//  INIT
// ================================================================
applyTheme();
renderStreak();
