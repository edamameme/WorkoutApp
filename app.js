/* ================================================
   FitTrack — App Logic
   ================================================ */

// ---------- Exercise Data ----------
const EXERCISES = {
  hiit: [
    "Burpees",
    "Jump Squats",
    "Mountain Climbers",
    "High Knees",
    "Box Jumps",
    "Jumping Lunges",
    "Plank Jacks",
    "Kettlebell Swings",
    "Battle Ropes",
    "Tuck Jumps",
  ],
  strength: [
    "Bench Press",
    "Squat",
    "Deadlift",
    "Overhead Press",
    "Barbell Row",
    "Pull-ups",
    "Dumbbell Curl",
    "Tricep Dips",
    "Lunges",
    "Lat Pulldown",
  ],
};

// ---------- DOM References ----------
const $ = (id) => document.getElementById(id);

const screens = {
  picker: $("screen-picker"),
  setup: $("screen-setup"),
  workout: $("screen-workout"),
  done: $("screen-done"),
};

// ---------- State ----------
let state = {
  theme: localStorage.getItem("ft-theme") || "light",
  currentExercise: null,
  currentCategory: "hiit",
  totalSets: 3,
  targetReps: 10,
  weight: 0,
  restSeconds: 30,
  currentSet: 1,
  actualReps: 10,
  totalRepsAccum: 0,
  setLog: [],
  timerInterval: null,
  timerRemaining: 0,
  isResting: false,
  customExercises: JSON.parse(localStorage.getItem("ft-custom") || "[]"),
};

// ---------- Helpers ----------
function getHistory() {
  return JSON.parse(localStorage.getItem("ft-history") || "{}");
}

function saveHistory(exercise, data) {
  const history = getHistory();
  history[exercise] = data;
  localStorage.setItem("ft-history", JSON.stringify(history));
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function applyTheme() {
  document.body.setAttribute("data-theme", state.theme);
  localStorage.setItem("ft-theme", state.theme);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// SVG ring circumference for r=54
const CIRCUMFERENCE = 2 * Math.PI * 54; // ~339.292

function setRingProgress(fraction) {
  const offset = CIRCUMFERENCE * (1 - fraction);
  $("ring-progress").style.strokeDashoffset = offset;
}

// ---------- Theme Toggle ----------
function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme();
}

$("theme-toggle").addEventListener("click", toggleTheme);
$("theme-toggle-2").addEventListener("click", toggleTheme);

// ---------- Category Tabs ----------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.currentCategory = tab.dataset.category;
    renderExerciseList();

    // Show/hide custom input
    if (state.currentCategory === "custom") {
      $("custom-input").classList.remove("hidden");
    } else {
      $("custom-input").classList.add("hidden");
    }
  });
});

// ---------- Render Exercise List ----------
function renderExerciseList() {
  const list = $("exercise-list");
  const history = getHistory();
  let exercises;

  if (state.currentCategory === "custom") {
    exercises = state.customExercises;
  } else {
    exercises = EXERCISES[state.currentCategory] || [];
  }

  if (exercises.length === 0) {
    list.innerHTML = '<li class="hint" style="padding:24px;text-align:center;">No exercises yet. Add one above!</li>';
    return;
  }

  list.innerHTML = exercises
    .map((name) => {
      const prev = history[name];
      const prevText = prev
        ? `${prev.sets}×${prev.reps} @ ${prev.weight} lbs`
        : "No history";
      return `
      <li class="exercise-item" data-exercise="${name}">
        <span class="name">${name}</span>
        <span class="prev">${prevText}</span>
      </li>`;
    })
    .join("");

  // Click handler for each exercise
  list.querySelectorAll(".exercise-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.currentExercise = item.dataset.exercise;
      openSetup();
    });
  });
}

// ---------- Add Custom Exercise ----------
$("add-custom-btn").addEventListener("click", () => {
  const name = $("custom-name").value.trim();
  if (!name) return;
  if (state.customExercises.includes(name)) return;

  state.customExercises.push(name);
  localStorage.setItem("ft-custom", JSON.stringify(state.customExercises));
  $("custom-name").value = "";
  renderExerciseList();
});

// ---------- Setup Screen ----------
function openSetup() {
  $("setup-title").textContent = state.currentExercise;

  // Load previous values if available
  const prev = getHistory()[state.currentExercise];
  if (prev) {
    $("input-sets").value = prev.sets;
    $("input-reps").value = prev.reps;
    $("input-weight").value = prev.weight;
    $("input-rest").value = prev.rest || 30;
    $("previous-stats").classList.remove("hidden");
    $("prev-summary").textContent = `${prev.sets} sets × ${prev.reps} reps @ ${prev.weight} lbs — ${prev.totalReps} total reps`;
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

// Stepper buttons
document.querySelectorAll(".stepper-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    if (!target) return; // reps adjuster buttons handled separately
    const input = $(target);
    const dir = parseInt(btn.dataset.dir, 10);
    const step = Math.abs(dir);
    let val = parseInt(input.value, 10) || 0;
    val += dir;
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);
    if (val < min) val = min;
    if (val > max) val = max;
    input.value = val;
  });
});

// ---------- Start Workout ----------
$("start-workout-btn").addEventListener("click", () => {
  state.totalSets = parseInt($("input-sets").value, 10) || 3;
  state.targetReps = parseInt($("input-reps").value, 10) || 10;
  state.weight = parseInt($("input-weight").value, 10) || 0;
  state.restSeconds = parseInt($("input-rest").value, 10) || 30;

  state.currentSet = 1;
  state.actualReps = state.targetReps;
  state.totalRepsAccum = 0;
  state.setLog = [];
  state.isResting = false;

  updateWorkoutUI();
  resetTimerDisplay();
  showScreen("workout");

  $("workout-title").textContent = state.currentExercise;
});

// ---------- Workout UI Updates ----------
function updateWorkoutUI() {
  $("stat-set").textContent = `${state.currentSet}/${state.totalSets}`;
  $("stat-reps").textContent = state.targetReps;
  $("stat-weight").textContent = state.weight;
  $("actual-reps").textContent = state.actualReps;
  $("total-reps").textContent = state.totalRepsAccum;
}

function resetTimerDisplay() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.isResting = false;
  $("timer-display").textContent = formatTime(state.restSeconds);
  $("timer-label").textContent = "REST";
  setRingProgress(1);
  $("ring-progress").classList.remove("resting");
  $("complete-set-btn").textContent = "Complete Set";
  $("complete-set-btn").disabled = false;
}

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

      // Beep or vibrate
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
  const fraction = state.timerRemaining / state.restSeconds;
  setRingProgress(fraction);
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

// ---------- Complete Set ----------
$("complete-set-btn").addEventListener("click", () => {
  // If resting, skip rest
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

  // Log this set
  state.setLog.push({
    set: state.currentSet,
    reps: state.actualReps,
    weight: state.weight,
  });
  state.totalRepsAccum += state.actualReps;
  $("total-reps").textContent = state.totalRepsAccum;

  // Check if done
  if (state.currentSet >= state.totalSets) {
    finishWorkout();
    return;
  }

  // Start rest timer
  startRestTimer();
});

// ---------- Finish Workout ----------
function finishWorkout() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  // Save to history
  saveHistory(state.currentExercise, {
    sets: state.totalSets,
    reps: state.targetReps,
    weight: state.weight,
    rest: state.restSeconds,
    totalReps: state.totalRepsAccum,
    setLog: state.setLog,
    date: new Date().toISOString(),
  });

  // Show summary
  const lines = state.setLog
    .map((s) => `Set ${s.set}: <strong>${s.reps} reps</strong> @ ${s.weight} lbs`)
    .join("<br>");

  $("done-summary").innerHTML = `
    <p><strong>${state.currentExercise}</strong></p>
    <p>${lines}</p>
    <br>
    <p>Total reps: <strong>${state.totalRepsAccum}</strong></p>
  `;

  showScreen("done");
}

// ---------- Quit Workout ----------
$("quit-workout").addEventListener("click", () => {
  if (state.setLog.length > 0) {
    if (!confirm("You have progress. Quit this workout?")) return;
  }
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  showScreen("picker");
});

// ---------- Done ----------
$("done-btn").addEventListener("click", () => {
  showScreen("picker");
  renderExerciseList(); // Refresh to show updated history
});

// ---------- Init ----------
applyTheme();
renderExerciseList();
