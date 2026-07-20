// Base de datos de ejercicios disponible
const dbExercises = [
    "Press de Banca", "Sentadilla", "Peso Muerto", "Prensa de Piernas", 
    "Dominadas", "Jalón al Pecho", "Curl de Bíceps", "Extensión de Tríceps", 
    "Cinta de Correr", "Elíptica", "Remo con Barra", "Elevaciones Laterales"
];

// Estado global de la aplicación
let currentUser = null;
let appData = {
    workouts: [],
    history: {}
};
let currentWorkoutId = null;
let currentExerciseName = null;
let chartInstance = null;

// Referencias a las pantallas
const screens = {
    login: document.getElementById('login-screen'),
    main: document.getElementById('main-screen'),
    generate: document.getElementById('generate-screen'),
    daily: document.getElementById('daily-screen'),
    exercise: document.getElementById('exercise-screen')
};

// Utilidad para cambiar pantallas
function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

// --- VERIFICACIÓN DE SESIÓN ACTIVA ---
window.addEventListener('DOMContentLoaded', () => {
    const activeUser = localStorage.getItem('ag_active_user');
    if (activeUser) {
        const usersDb = JSON.parse(localStorage.getItem('ag_users') || '{}');
        if (usersDb[activeUser]) {
            loginSuccess(activeUser, usersDb[activeUser].data);
        } else {
            showScreen('login');
        }
    } else {
        showScreen('login');
    }
});

// --- LÓGICA DE LOGIN ---
document.getElementById('btn-login').addEventListener('click', () => handleAuth(false));
document.getElementById('btn-register').addEventListener('click', () => handleAuth(true));

function handleAuth(isRegister) {
    const user = document.getElementById('username-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    const msg = document.getElementById('login-msg');

    if (!user || !pass) {
        msg.innerText = "Llena todos los campos";
        return;
    }

    const usersDb = JSON.parse(localStorage.getItem('ag_users') || '{}');

    if (isRegister) {
        if (usersDb[user]) {
            msg.innerText = "El usuario ya existe";
        } else {
            usersDb[user] = { password: pass, data: { workouts: [], history: {} } };
            localStorage.setItem('ag_users', JSON.stringify(usersDb));
            loginSuccess(user, usersDb[user].data);
        }
    } else {
        if (usersDb[user] && usersDb[user].password === pass) {
            loginSuccess(user, usersDb[user].data);
        } else {
            msg.innerText = "Credenciales incorrectas";
        }
    }
}

function loginSuccess(username, data) {
    currentUser = username;
    appData = data;
    
    // Guardar sesión activa en LocalStorage
    localStorage.setItem('ag_active_user', username);

    document.getElementById('username-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('login-msg').innerText = '';
    
    document.getElementById('user-greeting').innerText = `Hola, ${username}`;
    document.getElementById('user-avatar').innerText = username.substring(0, 2).toUpperCase();
    
    const options = { weekday: 'long', day: 'numeric', month: 'short' };
    let dateStr = new Date().toLocaleDateString('es-ES', options);
    document.getElementById('current-date').innerText = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    
    renderMainScreen();
    showScreen('main');
}

// Cerrar sesión borra la llave temporal y te devuelve al Login
document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    appData = { workouts: [], history: {} };
    localStorage.removeItem('ag_active_user');
    showScreen('login');
});

function saveData() {
    if (!currentUser) return;
    const usersDb = JSON.parse(localStorage.getItem('ag_users') || '{}');
    usersDb[currentUser].data = appData;
    localStorage.setItem('ag_users', JSON.stringify(usersDb));
}

// --- LÓGICA ESTRICTA DE CÁLCULO DE RACHA (SEMANAS) ---

// Función para obtener la fecha exacta del Lunes de una semana dada
function getMondayTimestamp(date) {
    const d = new Date(date);
    const day = d.getDay(); 
    // Si es domingo (0), restamos 6 días para volver al lunes. Si no, restamos day - 1.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    monday.setHours(0, 0, 0, 0); // Normalizamos a la medianoche
    return monday.getTime();
}

// Función que evalúa la protección y el número de semanas consecutivas
function calculateStreak() {
    if (!appData.workouts) return { streak: 0, isProtected: false };
    
    const completedWorkouts = appData.workouts.filter(w => w.completed);
    if (completedWorkouts.length === 0) return { streak: 0, isProtected: false };

    // Set para almacenar únicamente los "Lunes" en los que se registró actividad
    const weeksSet = new Set();
    completedWorkouts.forEach(w => {
        const timestamp = w.completedAt ? w.completedAt : parseInt(w.id);
        weeksSet.add(getMondayTimestamp(timestamp));
    });

    const currentMonday = getMondayTimestamp(new Date());
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    let streak = 0;
    let checkWeek = currentMonday;
    
    // Verificamos si en la semana ACTUAL ya hay actividad
    let isProtected = weeksSet.has(checkWeek);

    if (isProtected) {
        while (weeksSet.has(checkWeek)) {
            streak++;
            checkWeek -= oneWeekMs;
        }
    } else {
        checkWeek -= oneWeekMs; 
        
        if (weeksSet.has(checkWeek)) {
            while (weeksSet.has(checkWeek)) {
                streak++;
                checkWeek -= oneWeekMs;
            }
        } else {
            streak = 0;
        }
    }

    return { streak, isProtected };
}

// --- PANTALLA PRINCIPAL ---
document.getElementById('btn-nav-generate').addEventListener('click', () => {
    renderGenerateScreen();
    showScreen('generate');
});

function renderMainScreen() {
    const workoutsList = document.getElementById('workouts-list');
    const nextWorkoutContainer = document.getElementById('next-workout-container');
    workoutsList.innerHTML = '';
    
    let completedThisWeek = 0;
    
    // Obtenemos los valores strictos de la racha
    const streakData = calculateStreak(); 
    document.getElementById('streak-weeks-count').innerText = streakData.streak;
    
    // Cambiamos el Emoji dependiendo de si la semana está asegurada
    // 💪 = Protegido / 🦾 (Brazo mecánico) = Aún sin entrenar esta semana
    document.getElementById('streak-emoji').innerText = streakData.isProtected ? "💪" : "🦾";

    if (appData.workouts.length === 0) {
        workoutsList.innerHTML = '<p class="error-text">No hay entrenamientos agendados.</p>';
        nextWorkoutContainer.innerHTML = '<p class="text-center">No hay próximos entrenamientos</p>';
        document.getElementById('weekly-workouts-count').innerText = "0";
        document.getElementById('weekly-progress-pct').innerText = "0%";
        return;
    }

    document.getElementById('weekly-workouts-count').innerText = appData.workouts.length;

    let nextWorkoutFound = false;

    appData.workouts.forEach(workout => {
        if (workout.completed) completedThisWeek++;
        
        const div = document.createElement('div');
        div.className = 'dark-card';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="color: var(--neon-blue)">${workout.name}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted)">${workout.day} - ${workout.time}</p>
                </div>
                <button class="icon-btn" onclick="openDailyWorkout('${workout.id}')">➜</button>
            </div>
        `;
        workoutsList.appendChild(div);

        if (!workout.completed && !nextWorkoutFound) {
            nextWorkoutContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="color: var(--neon-green)">${workout.name}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-muted)">${workout.day} - ${workout.time}</p>
                    </div>
                    <button class="neon-btn green-btn" style="padding: 10px;" onclick="openDailyWorkout('${workout.id}')">Iniciar</button>
                </div>
            `;
            nextWorkoutFound = true;
        }
    });

    if (!nextWorkoutFound) {
        nextWorkoutContainer.innerHTML = '<p class="text-center">¡Todos completados!</p>';
    }

    const pct = Math.round((completedThisWeek / appData.workouts.length) * 100) || 0;
    document.getElementById('weekly-progress-pct').innerText = `${pct}%`;
}

// --- PANTALLA GENERAR ENTRENAMIENTO ---
let tempSelectedExercises = [];

document.getElementById('btn-back-main').addEventListener('click', () => showScreen('main'));

function renderGenerateScreen() {
    tempSelectedExercises = [];
    document.getElementById('new-workout-name').value = '';
    document.getElementById('new-workout-time').value = '';
    
    const grid = document.getElementById('available-exercises');
    grid.innerHTML = '';
    
    dbExercises.forEach(ex => {
        const div = document.createElement('div');
        div.className = 'exercise-item';
        div.innerText = ex;
        div.onclick = () => {
            if (!tempSelectedExercises.includes(ex)) {
                tempSelectedExercises.push(ex);
                renderSelectedExercisesList();
                div.classList.add('selected');
            }
        };
        grid.appendChild(div);
    });
    renderSelectedExercisesList();
}

function renderSelectedExercisesList() {
    const list = document.getElementById('selected-exercises-list');
    list.innerHTML = '';
    tempSelectedExercises.forEach((ex, index) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.index = index;
        li.innerHTML = `<span>${ex}</span> <span style="color:var(--neon-red); cursor:pointer;" onclick="removeTempExercise(${index})">X</span>`;
        
        li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', index); });
        li.addEventListener('dragover', (e) => { e.preventDefault(); });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            const item = tempSelectedExercises.splice(fromIndex, 1)[0];
            tempSelectedExercises.splice(toIndex, 0, item);
            renderSelectedExercisesList();
        });
        
        list.appendChild(li);
    });
}

window.removeTempExercise = function(index) {
    tempSelectedExercises.splice(index, 1);
    renderSelectedExercisesList();
    renderGenerateScreen(); 
}

document.getElementById('btn-save-workout').addEventListener('click', () => {
    const name = document.getElementById('new-workout-name').value || 'Rutina';
    const day = document.getElementById('new-workout-day').value;
    const time = document.getElementById('new-workout-time').value || '12:00';

    if (tempSelectedExercises.length === 0) return alert("Selecciona al menos un ejercicio");

    const newWorkout = {
        id: Date.now().toString(),
        name, day, time,
        exercises: tempSelectedExercises.map(ex => ({ name: ex, completed: false })),
        completed: false
    };

    appData.workouts.push(newWorkout);
    saveData();
    renderMainScreen();
    showScreen('main');
});

// --- PANTALLA ENTRENAMIENTO DEL DÍA ---
document.getElementById('btn-back-main-from-daily').addEventListener('click', () => {
    renderMainScreen();
    showScreen('main');
});

document.getElementById('btn-edit-daily').addEventListener('click', () => {
    appData.workouts = appData.workouts.filter(w => w.id !== currentWorkoutId);
    saveData();
    renderMainScreen();
    showScreen('main');
});

window.openDailyWorkout = function(id) {
    currentWorkoutId = id;
    const workout = appData.workouts.find(w => w.id === id);
    if (!workout) return;

    document.getElementById('daily-title').innerText = `${workout.day} ${workout.time} | ${workout.name}`;
    renderDailyExercises();
    showScreen('daily');
};

function renderDailyExercises() {
    const workout = appData.workouts.find(w => w.id === currentWorkoutId);
    const list = document.getElementById('daily-exercises-list');
    list.innerHTML = '';

    let completedCount = 0;

    workout.exercises.forEach((ex, idx) => {
        if (ex.completed) completedCount++;
        
        let improvement = 0;
        const hist = appData.history[ex.name];
        if (hist && hist.length > 1) {
            const first = hist[0].weight || 0;
            const last = hist[hist.length - 1].weight || 0;
            if (first > 0 && last > first) {
                improvement = Math.round(((last - first) / first) * 100);
            }
        }

        const div = document.createElement('div');
        div.className = `daily-exercise-card ${ex.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div>
                <h4>${ex.name}</h4>
                ${improvement > 0 ? `<span class="improvement-badge">+${improvement}% Mejora</span>` : ''}
            </div>
            <div>
                <input type="checkbox" ${ex.completed ? 'checked' : ''} onclick="toggleExerciseComplete(${idx}, event)" style="transform: scale(1.5); accent-color: var(--neon-green); margin-right: 15px;">
                <button class="icon-btn" onclick="openExerciseDetail('${ex.name}')">📈</button>
            </div>
        `;
        list.appendChild(div);
    });

    const pct = Math.round((completedCount / workout.exercises.length) * 100) || 0;
    document.getElementById('daily-progress-text').innerText = `${pct}%`;
    document.getElementById('daily-circular-progress').style.background = `conic-gradient(var(--neon-green) ${pct}%, #333 0%)`;
}

window.toggleExerciseComplete = function(idx, event) {
    event.stopPropagation();
    const workout = appData.workouts.find(w => w.id === currentWorkoutId);
    workout.exercises[idx].completed = !workout.exercises[idx].completed;
    saveData();
    renderDailyExercises();
};

document.getElementById('btn-finish-workout').addEventListener('click', () => {
    const workout = appData.workouts.find(w => w.id === currentWorkoutId);
    workout.completed = true;
    workout.completedAt = Date.now();
    saveData();
    renderMainScreen();
    showScreen('main');
});

// --- PANTALLA DETALLE DEL EJERCICIO (GRÁFICA) ---
document.getElementById('btn-back-daily').addEventListener('click', () => showScreen('daily'));

window.openExerciseDetail = function(name) {
    currentExerciseName = name;
    document.getElementById('exercise-title').innerText = name;
    document.getElementById('reg-weight').value = '';
    document.getElementById('reg-reps').value = '';
    document.getElementById('reg-time').value = '';
    document.getElementById('reg-speed').value = '';
    
    renderChart();
    showScreen('exercise');
};

document.getElementById('btn-save-record').addEventListener('click', () => {
    const weight = parseFloat(document.getElementById('reg-weight').value) || 0;
    const reps = parseFloat(document.getElementById('reg-reps').value) || 0;
    const time = parseFloat(document.getElementById('reg-time').value) || 0;
    const speed = parseFloat(document.getElementById('reg-speed').value) || 0;

    if (!appData.history[currentExerciseName]) {
        appData.history[currentExerciseName] = [];
    }

    appData.history[currentExerciseName].push({
        date: new Date().toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}),
        weight, reps, time, speed
    });

    saveData();
    renderChart();
});

document.getElementById('chart-metric-selector').addEventListener('change', renderChart);

function renderChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const metric = document.getElementById('chart-metric-selector').value;
    const historyData = appData.history[currentExerciseName] || [];

    const labels = historyData.map(h => h.date);
    const dataPoints = historyData.map(h => h[metric]);

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Avance de ${metric}`,
                data: dataPoints,
                borderColor: '#39ff14',
                backgroundColor: 'rgba(57, 255, 20, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#a0a0a0' } },
                x: { grid: { color: '#333' }, ticks: { color: '#a0a0a0' } }
            }
        }
    });
}