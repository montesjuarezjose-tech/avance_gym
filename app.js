// Base de datos simulada del gimnasio (JSON)
const gymDatabase = [
    { id: 'e1', name: 'Press de Pecho', type: 'strength' },
    { id: 'e2', name: 'Sentadilla', type: 'strength' },
    { id: 'e3', name: 'Peso Muerto', type: 'strength' },
    { id: 'e4', name: 'Extensión de Pierna', type: 'strength' },
    { id: 'e5', name: 'Caminadora', type: 'cardio' },
    { id: 'e6', name: 'Elíptica', type: 'cardio' },
    { id: 'e7', name: 'Bicicleta Estática', type: 'cardio' }
];

// Estado de la aplicación
let currentUser = null;
let currentWorkoutId = null;
let currentExerciseIndex = null;
let chartInstance = null;

// Inicialización
window.onload = () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        navigate('main-screen');
    }
};

// Navegación
function navigate(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'main-screen') renderMainScreen();
    if (screenId === 'generate-screen') renderGenerateScreen();
    if (screenId === 'daily-screen') renderDailyScreen();
    if (screenId === 'exercise-screen') renderExerciseScreen();
}

// Lógica de Autenticación Local
function login() {
    const user = document.getElementById('username').value.trim();
    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', user);
        
        // Inicializar estructura si es usuario nuevo
        if (!localStorage.getItem(`workouts_${user}`)) {
            localStorage.setItem(`workouts_${user}`, JSON.stringify([]));
        }
        navigate('main-screen');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    navigate('login-screen');
}

// Utilidades de Datos
function getWorkouts() {
    return JSON.parse(localStorage.getItem(`workouts_${currentUser}`)) || [];
}

function saveWorkoutsToStorage(workouts) {
    localStorage.setItem(`workouts_${currentUser}`, JSON.stringify(workouts));
}

// Pantalla Principal
function renderMainScreen() {
    document.getElementById('greeting').innerText = `Hola, ${currentUser}`;
    const workouts = getWorkouts();
    
    // Lista
    const listEl = document.getElementById('upcoming-workouts');
    listEl.innerHTML = '';
    
    // Ordenar por fecha y hora
    workouts.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    
    let completedCount = 0;
    
    workouts.forEach(w => {
        const isCompleted = w.exercises.every(e => e.completed);
        if (isCompleted) completedCount++;
        
        const li = document.createElement('li');
        li.className = 'exercise-item';
        li.innerHTML = `<span>${w.date} - ${w.time}</span> <span>${w.exercises.length} ej.</span>`;
        li.onclick = () => {
            currentWorkoutId = w.id;
            navigate('daily-screen');
        };
        listEl.appendChild(li);
    });

    // Progreso
    const total = workouts.length;
    const percentage = total === 0 ? 0 : (completedCount / total) * 100;
    document.getElementById('weekly-progress').style.width = `${percentage}%`;
    document.getElementById('weekly-stats').innerText = `${completedCount}/${total} Entrenamientos completados`;
}

// Pantalla Generar (Incluye Drag & Drop)
function renderGenerateScreen() {
    document.getElementById('workout-date').value = '';
    document.getElementById('workout-time').value = '';
    
    const catalog = document.getElementById('exercise-catalog');
    const selected = document.getElementById('selected-exercises');
    catalog.innerHTML = '';
    selected.innerHTML = '';

    gymDatabase.forEach(ex => {
        const li = document.createElement('li');
        li.className = 'exercise-item';
        li.draggable = true;
        li.id = `cat-${ex.id}`;
        li.innerText = ex.name;
        li.ondragstart = drag;
        li.onclick = () => moveToSelected(ex);
        catalog.appendChild(li);
    });
}

function moveToSelected(exercise) {
    const selected = document.getElementById('selected-exercises');
    const li = document.createElement('li');
    li.className = 'exercise-item';
    li.draggable = true;
    li.id = `sel-${Date.now()}-${exercise.id}`;
    li.dataset.exId = exercise.id;
    li.innerText = exercise.name;
    li.ondragstart = drag;
    li.ondblclick = () => li.remove(); // Doble clic para remover
    selected.appendChild(li);
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const nodeCopy = document.getElementById(data).cloneNode(true);
    
    if (data.startsWith('cat-')) {
        nodeCopy.id = `sel-${Date.now()}-${data.replace('cat-', '')}`;
        nodeCopy.dataset.exId = data.replace('cat-', '');
        nodeCopy.ondblclick = () => nodeCopy.remove();
        document.getElementById('selected-exercises').appendChild(nodeCopy);
    } else if (data.startsWith('sel-')) {
        // Reordenamiento básico
        document.getElementById('selected-exercises').appendChild(document.getElementById(data));
    }
}

function saveWorkout() {
    const date = document.getElementById('workout-date').value;
    const time = document.getElementById('workout-time').value;
    const selectedNodes = document.getElementById('selected-exercises').children;

    if (!date || !time || selectedNodes.length === 0) {
        alert('Selecciona fecha, hora y al menos un ejercicio.');
        return;
    }

    const exercises = Array.from(selectedNodes).map(node => {
        const exDb = gymDatabase.find(g => g.id === node.dataset.exId);
        return {
            id: Date.now().toString() + Math.random(),
            baseId: exDb.id,
            name: exDb.name,
            type: exDb.type,
            completed: false,
            history: [] // { date, weight, reps, time, etc }
        };
    });

    const workouts = getWorkouts();
    workouts.push({ id: Date.now().toString(), date, time, exercises });
    saveWorkoutsToStorage(workouts);
    navigate('main-screen');
}

// Pantalla Entrenamiento Diario
function renderDailyScreen() {
    const workouts = getWorkouts();
    const workout = workouts.find(w => w.id === currentWorkoutId);
    if (!workout) return;

    document.getElementById('daily-title').innerText = `${workout.date} (${workout.time})`;
    
    const container = document.getElementById('daily-exercise-list');
    container.innerHTML = '';

    let completedCount = 0;

    workout.exercises.forEach((ex, index) => {
        if (ex.completed) completedCount++;

        // Cálculo de mejora %
        let improvementText = '';
        if (ex.history.length > 1) {
            const first = ex.history[0];
            const last = ex.history[ex.history.length - 1];
            
            // Lógica simple: comparamos el peso (strength) o el tiempo (cardio)
            if (ex.type === 'strength' && first.weight) {
                const diff = ((last.weight - first.weight) / first.weight) * 100;
                improvementText = diff > 0 ? `+${diff.toFixed(1)}% Fuerza` : '';
            } else if (ex.type === 'cardio' && first.time) {
                const diff = ((last.time - first.time) / first.time) * 100;
                improvementText = diff > 0 ? `+${diff.toFixed(1)}% Tiempo` : '';
            }
        }

        const div = document.createElement('div');
        div.className = `daily-card ${ex.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div>
                <h4>${ex.name}</h4>
                <div class="improvement-badge">${improvementText}</div>
            </div>
            <input type="checkbox" ${ex.completed ? 'checked' : ''} onclick="toggleComplete(event, ${index})">
        `;
        div.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                currentExerciseIndex = index;
                navigate('exercise-screen');
            }
        };
        container.appendChild(div);
    });

    // Círculo de porcentaje superior
    const percentage = workout.exercises.length === 0 ? 0 : Math.round((completedCount / workout.exercises.length) * 100);
    const circle = document.getElementById('daily-progress-circle');
    circle.style.background = `conic-gradient(var(--success-color) ${percentage}%, var(--bg-color) ${percentage}%)`;
    document.getElementById('daily-progress-text').innerText = `${percentage}%`;
}

function toggleComplete(event, index) {
    const workouts = getWorkouts();
    const workout = workouts.find(w => w.id === currentWorkoutId);
    workout.exercises[index].completed = event.target.checked;
    saveWorkoutsToStorage(workouts);
    renderDailyScreen(); 
}

function editWorkout() {
    alert("Función para ir a Generar Entrenamiento y cargar datos actuales. Por simplicidad de la prueba, te redigirá a Generar.");
    navigate('generate-screen');
}

// Pantalla Detalle de Ejercicio y Gráfica
function renderExerciseScreen() {
    const workouts = getWorkouts();
    const exercise = workouts.find(w => w.id === currentWorkoutId).exercises[currentExerciseIndex];
    
    document.getElementById('detail-title').innerText = exercise.name;
    const container = document.getElementById('input-container');
    container.innerHTML = '';

    // Inputs dinámicos
    if (exercise.type === 'strength') {
        container.innerHTML = `
            <input type="number" id="val-weight" placeholder="Peso (kg/lbs)" class="neumorphic-input">
            <input type="number" id="val-reps" placeholder="Repeticiones" class="neumorphic-input">
        `;
    } else {
        container.innerHTML = `
            <input type="number" id="val-time" placeholder="Tiempo (min)" class="neumorphic-input">
            <input type="number" id="val-speed" placeholder="Velocidad" class="neumorphic-input">
            <input type="number" id="val-incline" placeholder="Inclinación" class="neumorphic-input">
        `;
    }

    renderChart(exercise);
}

function logExerciseData() {
    const workouts = getWorkouts();
    const exercise = workouts.find(w => w.id === currentWorkoutId).exercises[currentExerciseIndex];
    
    const entry = { date: new Date().toLocaleDateString() };
    
    if (exercise.type === 'strength') {
        entry.weight = parseFloat(document.getElementById('val-weight').value) || 0;
        entry.reps = parseInt(document.getElementById('val-reps').value) || 0;
    } else {
        entry.time = parseFloat(document.getElementById('val-time').value) || 0;
        entry.speed = parseFloat(document.getElementById('val-speed').value) || 0;
        entry.incline = parseFloat(document.getElementById('val-incline').value) || 0;
    }

    exercise.history.push(entry);
    saveWorkoutsToStorage(workouts);
    
    document.querySelectorAll('#input-container input').forEach(input => input.value = '');
    renderChart(exercise);
}

function renderChart(exercise) {
    const ctx = document.getElementById('progressChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = exercise.history.map(h => h.date);
    let data = [];
    let labelText = '';

    if (exercise.type === 'strength') {
        data = exercise.history.map(h => h.weight);
        labelText = 'Evolución de Peso';
    } else {
        data = exercise.history.map(h => h.time);
        labelText = 'Evolución de Tiempo';
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: labelText,
                data: data,
                borderColor: '#6c5ce7',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(108, 92, 231, 0.2)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}