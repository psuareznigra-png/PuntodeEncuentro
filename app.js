/**
 * Punto Activo "Centro de Entrenamiento"
 * AplicaciÃ³n principal â€” v3.0 Firebase
 */

const State = {
    user: null,
    currentView: 'dashboard',
    family: [], // Familiares vinculados
    activeProfileId: null, // ID del perfil que estamos viendo (null = el titular)
    onboardingRequired: false // Bloqueo de navegaciÃ³n para ficha obligatoria
};

const Views = {
    dashboard: { title: 'Panel de Control', icon: 'layout-dashboard' },
    activities: { title: 'Actividades', icon: 'zap', role: 'admin' },
    turnos: { title: 'Horarios / Turnos', icon: 'clock', role: 'admin' },
    usuarios: { title: 'Panel de Usuarios', icon: 'users', role: 'admin' },
    bajas_admin: { title: 'Solicitudes de Baja', icon: 'user-minus', role: 'profesor' },
    mis_alumnos: { title: 'Mis Alumnos', icon: 'users', role: 'profesor' },
    payments_admin: { title: 'Pagos Pendientes', icon: 'credit-card', role: 'profesor' },
    payments_history: { title: 'Registro de Cobranzas', icon: 'history', role: 'profesor' },
    morosidades: { title: 'Morosidades', icon: 'alert-circle', role: 'profesor' },
    occupancy: { title: 'OcupaciÃ³n', icon: 'calendar', role: 'profesor' },
    announcements_admin: { title: 'TablÃ³n de Anuncios', icon: 'megaphone', role: 'admin' },
    inscripciones: { title: 'Mis Actividades', icon: 'plus-circle', role: 'alumno' },
    pagos_socio: { title: 'Mis Pagos', icon: 'wallet', role: 'alumno' },
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INIT â€” Firebase Auth state listener
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function initApp() {
    console.log("ðŸš€ PUNTO ACTIVO APP - v4.1 - CARGADA CORRECTAMENTE");
    try {
        if (typeof firebase === 'undefined' || !auth) {
            throw new Error('Firebase no se pudo cargar correctamente. VerificÃ¡ tu conexiÃ³n a internet y el archivo firebase-config.js.');
        }

        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    showAppLoader();
                    const profile = await DB.getUserProfile(firebaseUser.uid);

                    if (!profile) {
                        UI.notify('El usuario no tiene un perfil configurado en Firestore. VerificÃ¡ el "Paso 5" de la guÃ­a.', 'error');
                        console.error('UID sin perfil en Firestore:', firebaseUser.uid);
                        await auth.signOut();
                        return;
                    }

                    State.user = { ...profile, id: firebaseUser.uid };

                    // Chequeo automático de morosidad y perfil en cada login del alumno
                    if (State.user.role === 'alumno' || State.user.role === 'socio') {
                        await DB.checkAndUpdateMorosidad(State.user.id);
                        // Cargar familiares
                        State.family = await DB.getFamilyMembers(State.user.id);
                        
                        // Si hay familiares y no hay perfil seleccionado, mostrar selector
                        if (State.family && State.family.length > 0 && !State.activeProfileId) {
                            showProfileSelector();
                            return;
                        }

                        // Verificar si debe completar la ficha obligatoria
                        // Solo exigimos onboarding a Alumnos/Socios
                        const isAlumno = State.user.role === 'alumno' || State.user.role === 'socio';
                        if (isAlumno && !State.user.profile_completed) {
                            State.onboardingRequired = true;
                        } else {
                            State.onboardingRequired = false;
                        }
                    } else {
                        // Admin o Profesor no requieren onboarding
                        State.onboardingRequired = false;
                    }

                    document.getElementById('app').classList.remove('hidden');
                    document.getElementById('auth-container').classList.add('hidden');
                    updateUserInfo();
                    renderNav();
                    setupGlobalListeners();
                    navigateTo(State.currentView);
                    window.refreshIcons();

                    // Inicializar Notificaciones Push
                    initNotifications();

                } catch (err) {
                    console.error('Error al cargar perfil:', err);
                    UI.notify('Error al obtener datos del servidor: ' + err.message, 'error');
                    await auth.signOut();
                }
            } else {
                State.user = null;
                State.onboardingRequired = false;
                State.currentView = 'dashboard';
                document.getElementById('app').classList.add('hidden');
                showLogin();
                window.refreshIcons();
            }
        });
    } catch (err) {
        console.error('Initialization error:', err);
        document.body.innerHTML = `
            <div style="height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;padding:20px;text-align:center">
                <div style="color:var(--overdue);font-size:40px;margin-bottom:20px">âšï¸</div>
                <h2 style="margin-bottom:10px">Error de ConfiguraciÃ³n</h2>
                <p style="color:#64748b;max-width:400px;line-height:1.5">\${err.message}</p>
                <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600">Reintentar</button>
            </div>
        `;
    }
}

function showAppLoader() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('main-content').innerHTML = `
        <div class="loader-wrapper" style="height:100vh">
            <div style="text-align:center">
                <i data-lucide="loader-2" class="spin-icon" style="width:40px;height:40px"></i>
                <p style="margin-top:16px;color:var(--text-muted);font-size:13px">Cargando sistema...</p>
            </div>
        </div>`;
    window.refreshIcons();
}

function updateUserInfo() {
    if (!State.user) return;
    
    // El perfil activo es el familiar seleccionado o el titular
    const activeProfile = (State.family || []).find(f => f.id === State.activeProfileId) || State.user;
    
    const name = activeProfile.name || 'Usuario';
    const roles = {
        'admin': 'Administrador',
        'profesor': 'Profesor',
        'alumno': 'Alumno',
        'socio': 'Alumno'
    };
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-role').textContent = roles[State.user.role] || 'Usuario';
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();

    // Si hay familiares, mostrar botón de cambio de perfil
    const avatarEl = document.getElementById('user-avatar');
    if (State.family && State.family.length > 0) {
        avatarEl.style.cursor = 'pointer';
        avatarEl.title = 'Cambiar Perfil';
        avatarEl.onclick = showProfileSelector;
    }
}

function showProfileSelector() {
    const profiles = [State.user, ...(State.family || [])];
    
    const html = `
        <div class="profile-selector-container">
            <h2 class="profile-selector-title">¿Quién está entrenando?</h2>
            <div class="profile-grid">
                ${profiles.map(p => `
                    <div class="profile-item ${State.activeProfileId === p.id || (!State.activeProfileId && p.id === State.user.id) ? 'active' : ''}" 
                         onclick="selectProfile('${p.id}')">
                        <div class="profile-avatar">${p.name.charAt(0).toUpperCase()}</div>
                        <div class="profile-name">${p.name}</div>
                        ${p.id === State.user.id ? '<div class="profile-tag">Titular</div>' : ''}
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:30px; text-align:center">
                <button class="btn btn-secondary" onclick="auth.signOut()">Cerrar Sesión</button>
            </div>
        </div>
    `;

    // Usamos el contenedor de auth para que sea a pantalla completa y bloqueante
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('auth-container').innerHTML = html;
    window.refreshIcons();
}

window.selectProfile = (profileId) => {
    // Si seleccionamos al titular, el ID es el del usuario de Auth
    State.activeProfileId = (profileId === State.user.id) ? null : profileId;
    
    // Reiniciar app con el nuevo perfil
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    updateUserInfo();
    renderNav();
    navigateTo('dashboard');
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   NAVIGATION
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function navigateTo(viewId) {
    if (!State.user) return;

    const userRole = (State.user.role === 'socio' || State.user.role === 'alumno') ? 'alumno' : State.user.role;
    const viewRole = Views[viewId]?.role;

    // LÃ³gica de acceso por roles:
    if (userRole === 'admin') {
        // El admin tiene acceso a vistas de admin y profesor, pero NO de alumno.
        if (viewRole === 'alumno') viewId = 'dashboard';
    } else if (userRole === 'profesor') {
        // El profesor tiene acceso a sus vistas y a actividades/turnos (filtrados por lÃ³gica de vista)
        if (viewRole && viewRole !== 'profesor' && !['activities', 'turnos', 'payments_admin', 'payments_history', 'morosidades', 'bajas_admin'].includes(viewId)) {
            viewId = 'dashboard';
        }
    } else {
        // Alumnos solo ven lo suyo o lo compartido
        if (viewRole && viewRole !== 'alumno') viewId = 'dashboard';
    }

    State.currentView = viewId;
    document.getElementById('page-title').textContent = Views[viewId]?.title || 'Dashboard';

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewId);
    });

    document.querySelector('.sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    renderView(viewId);
}

function renderNav() {
    const container = document.getElementById('nav-items-container');
    container.innerHTML = '';
    Object.entries(Views).forEach(([id, view]) => {
        const userRole = State.user.role === 'socio' ? 'alumno' : State.user.role;

        // Filtrar navegaciÃ³n por rol:
        if (userRole === 'admin') {
            // Admin ve admin y profesor, pero no alumno
            if (view.role === 'alumno') return;
        } else if (userRole === 'profesor') {
            // Profesor ve lo suyo (y admin podrÃ­a permitir actividades/turnos si se desea en nav)
            if (view.role && view.role !== 'profesor') return;
        } else {
            // Alumno solo ve alumno
            if (view.role && view.role !== 'alumno') return;
        }
        const btn = document.createElement('button');
        btn.className = `nav-item \${State.currentView === id ? 'active' : ''}`;
        btn.dataset.view = id;
        btn.innerHTML = `<i data-lucide="\${view.icon}"></i><span>\${view.title}</span>`;
        btn.onclick = () => navigateTo(id);
        container.appendChild(btn);
    });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   VIEW ROUTER
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderView(viewId) {
    const content = document.getElementById('main-content');
    const app = document.getElementById('app');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.header');

    // Bloqueo de onboarding
    if (State.onboardingRequired) {
        sidebar?.classList.add('hidden');
        header?.classList.add('hidden');
        if (app) app.style.gridTemplateColumns = '1fr';
        await renderOnboarding(content);
        return;
    }

    // Restaurar layout
    sidebar?.classList.remove('hidden');
    header?.classList.remove('hidden');
    if (app) app.style.gridTemplateColumns = '';

    content.innerHTML = `<div class="loader-wrapper"><i data-lucide="loader-2" class="spin-icon"></i></div>`;
    window.refreshIcons();

    try {
        switch (viewId) {
            case 'dashboard': await renderDashboard(content); break;
            case 'activities': await renderActivities(content); break;
            case 'turnos': await renderTurnos(content); break;
            case 'usuarios': await renderUsers(content); break;
            case 'bajas_admin': await renderBajasAdmin(content); break;
            case 'mis_alumnos': await renderMisAlumnos(content); break;
            case 'payments_admin': await renderPaymentsAdmin(content); break;
            case 'payments_history': await renderPaymentsHistory(content); break;
            case 'morosidades': await renderMorosidades(content); break;
            case 'occupancy': await renderOccupancy(content); break;
            case 'announcements_admin': await renderAnnouncementsAdmin(content); break;
            case 'inscripciones': await renderInscripcionesAlumno(content); break;
            case 'pagos_socio': await renderPagosAlumno(content); break;
            default:
                content.innerHTML = `<div class="empty-state">PrÃ³ximamente...</div>`;
        }
    } catch (err) {
        console.error('Error en vista:', err);
        content.innerHTML = `
            <div class="empty-state">
                <i data-lucide="wifi-off" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:16px"></i>
                <p style="font-weight:700;margin-bottom:8px">Error al cargar datos</p>
                <p style="font-size:13px;color:var(--text-muted)">\${err.message}</p>
                <button class="btn btn-primary mt-4" onclick="renderView('\${viewId}')">Reintentar</button>
            </div>`;
    }
    window.refreshIcons();
}


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   OCCUPANCY GRID â€” Admin/Profesor
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderOccupancy(container) {
    const [activities, turnos, countMap] = await Promise.all([
        DB.getActivities(),
        DB.getTurnos(),
        DB.getInscripcionesCountMap(),
    ]);

    const days = ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado', 'Domingo'];
    
    // Preparar slots individuales para la grilla
    let allSlots = [];
    turnos.forEach(t => {
        const act = activities.find(a => a.id === t.activity_id);
        if (!act) return;

        if (t.slots) {
            t.slots.forEach(s => {
                allSlots.push({ ...s, activity: act, turno: t });
            });
        } else if (t.day) {
            allSlots.push({ day: t.day, start: t.start, end: t.end, activity: act, turno: t });
        }
    });

    // Filtro para Profesores: Solo ven sus propias clases
    if (State.user.role === 'profesor') {
        const profName = State.user.name.toLowerCase();
        allSlots = allSlots.filter(s => {
            const idMatch = s.activity.profesor_id === State.user.id;
            const nameMatch = s.activity.teacher && (
                s.activity.teacher.toLowerCase().includes(profName) || 
                profName.includes(s.activity.teacher.toLowerCase())
            );
            return idMatch || nameMatch;
        });
    }

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">OcupaciÃ³n Semanal</h2>
            <div class="badge badge-active">Vista de GestiÃ³n</div>
        </div>
        
        <div class="occupancy-grid">
            \${days.map(day => {
                const daySlots = allSlots.filter(s => s.day === day);
                // Ordenar por hora de inicio
                daySlots.sort((a, b) => a.start.localeCompare(b.start));

                return `
                <div class="occupancy-day-col">
                    <div class="day-header">\${day}</div>
                    \${daySlots.length === 0 ? '<div class="empty-inline" style="text-align:center">Sin turnos</div>' : 
                        daySlots.map(s => {
                            const used = countMap[s.turno.id] || 0;
                            const pct = Math.round((used / s.turno.max_cupo) * 100);
                            let statusClass = 'occ-low';
                            if (pct > 50) statusClass = 'occ-med';
                            if (pct > 85) statusClass = 'occ-high';

                            return `
                            <div class="shift-grid-card \${statusClass}" onclick="window.showTurnoModal('\${s.turno.id}')">
                                <div class="shift-time">\${s.start} - \${s.end}</div>
                                <div class="shift-act">\${s.activity.name}</div>
                                <div class="shift-teacher">\${s.activity.teacher}</div>
                                <div class="shift-occ-bar">
                                    <div class="shift-occ-fill" style="width:\${Math.min(100, pct)}%"></div>
                                </div>
                                <div class="shift-occ-text">
                                    <span>\${used}/\${s.turno.max_cupo}</span>
                                    <span>\${pct}%</span>
                                </div>
                                <button class="btn-asistencia" onclick="event.stopPropagation(); window.showAttendanceModal('\${s.turno.id}')">
                                    <i data-lucide="check-square"></i> Pasar Lista
                                </button>
                            </div>`;
                        }).join('')
                    }
                </div>`;
            }).join('')}
        </div>
    `;
    window.refreshIcons();
}

/* â”€â”€â”€ ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function renderOnboarding(container) {
    // Intentamos traer la URL del deslinde desde la configuraciÃ³n global
    const config = await DB.getGlobalConfig('deslinde');
    const deslindeUrl = config?.url || '#';

    container.innerHTML = `
        <div class="onboarding-container fade-in">
            <div class="onboarding-card">
                <div class="row-between mb-6">
                    <img src="Img/Punto Activo.jpeg" alt="Logo" class="onboarding-logo" style="margin-bottom:0; width:50px; height:50px">
                    <button onclick="auth.signOut()" class="btn btn-secondary btn-sm" style="gap:6px">
                        <i data-lucide="log-out" style="width:14px"></i> Salir
                    </button>
                </div>

                <div class="onboarding-header" style="text-align:left">
                    <h2 class="welcome-title">Â¡Bienvenido a Punto Activo!</h2>
                    <p class="text-muted">Necesitamos que completes tu ficha de socio para habilitar tu cuenta.</p>
                </div>

                <form id="onboarding-form" class="form-stack mt-6">
                    <div class="form-group">
                        <label class="label">Nombre Completo</label>
                        <input type="text" id="ob-name" class="input" value="\${State.user.name || ''}" required>
                    </div>

                    <div class="form-row-2">
                        <div class="form-group">
                            <label class="label">DNI</label>
                            <input type="text" id="ob-dni" class="input" placeholder="Sin puntos" required>
                        </div>
                        <div class="form-group">
                            <label class="label">Fecha de Nacimiento</label>
                            <input type="date" id="ob-birth" class="input" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="label">Tu TelÃ©fono (WhatsApp)</label>
                        <input type="tel" id="ob-phone" class="input" placeholder="Ej: 2991234567" required>
                    </div>

                    <div class="form-group">
                        <label class="label">Email de Contacto</label>
                        <input type="email" id="ob-email" class="input" placeholder="ejemplo@correo.com" value="\${State.user.personal_email || ''}">
                    </div>

                    <hr class="mt-4 mb-4">
                    <p class="text-xs td-bold mb-4" style="color:var(--primary)">CONTACTO DE EMERGENCIA</p>

                    <div class="form-group">
                        <label class="label">Nombre del Contacto</label>
                        <input type="text" id="ob-emergency-name" class="input" placeholder="Nombre completo" required>
                    </div>

                    <div class="form-row-2">
                        <div class="form-group">
                            <label class="label">TelÃ©fono de Emergencia</label>
                            <input type="tel" id="ob-emergency-phone" class="input" placeholder="Ej: 2991234567" required>
                        </div>
                        <div class="form-group">
                            <label class="label">Parentesco</label>
                            <select id="ob-emergency-rel" class="input" required>
                                <option value="">Seleccionar...</option>
                                <option value="Padre/Madre">Padre/Madre</option>
                                <option value="Hijo/a">Hijo/a</option>
                                <option value="Hermano/a">Hermano/a</option>
                                <option value="Esposo/a">Esposo/a</option>
                                <option value="Amigo/a">Amigo/a</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div class="deslinde-box mt-6">
                        <h4 style="font-size:14px; margin-bottom:10px">Deslinde de Responsabilidad</h4>
                        <div class="deslinde-text">
                            Declaro estar en condiciones fÃ­sicas Ã³ptimas para realizar actividad fÃ­sica. 
                            Libero de toda responsabilidad al establecimiento Punto Activo y a sus profesionales 
                            por cualquier lesiÃ³n o percance derivado de la prÃ¡ctica deportiva.
                        </div>
                        
                        <div class="mt-4 mb-4">
                            <a href="\${deslindeUrl}" target="_blank" class="btn btn-secondary w-full btn-sm" style="gap:8px; justify-content:center">
                                <i data-lucide="download" style="width:16px"></i> Descargar Deslinde para Firmar
                            </a>
                            <p class="text-xs text-muted mt-2">Descargalo, firmalo y entregalo en tu primera clase.</p>
                        </div>

                        <label class="checkbox-container">
                            <input type="checkbox" id="ob-deslinde" required>
                            <span class="checkmark"></span>
                            <span class="text-sm">He leÃ­do y acepto los tÃ©rminos del deslinde.</span>
                        </label>
                    </div>

                    <button type="submit" id="ob-submit" class="btn btn-primary w-full mt-8" style="padding:18px; font-size:16px">
                        FINALIZAR Y ENTRAR
                    </button>
                </form>
            </div>
        </div>`;

    window.refreshIcons();

    document.getElementById('onboarding-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('ob-submit');
        btn.disabled = true; btn.textContent = 'Guardando datos...';

        const data = {
            name: document.getElementById('ob-name').value.trim(),
            dni: document.getElementById('ob-dni').value.trim(),
            birthdate: document.getElementById('ob-birth').value,
            phone: document.getElementById('ob-phone').value.trim(),
            personal_email: document.getElementById('ob-email').value.trim(),
            emergency_name: document.getElementById('ob-emergency-name').value.trim(),
            emergency_phone: document.getElementById('ob-emergency-phone').value.trim(),
            emergency_relationship: document.getElementById('ob-emergency-rel').value,
            profile_completed: true,
            onboarding_date: new Date().toISOString()
        };

        try {
            await DB.updateUserProfile(State.user.id, data);
            State.user = { ...State.user, ...data };
            State.onboardingRequired = false;
            UI.notify('Â¡Ficha completada! Bienvenido.');
            renderView('dashboard');
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = 'FINALIZAR Y ENTRAR';
        }
    };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DASHBOARD
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderDashboard(container) {
    const isAdmin = State.user.role === 'admin';
    const isProfesor = State.user.role === 'profesor';

    if (isAdmin || isProfesor) {
        // 1. CARGA RÃPIDA: Solo lo que es instantÃ¡neo
        const [quickData, announcements] = await Promise.all([
            DB.getQuickStats(isAdmin ? null : State.user.id, isAdmin ? null : State.user.name),
            DB.getAnnouncements().catch(() => [])
        ]);

        const visibleAnnouncements = announcements.filter(a => a.role === 'all' || a.role === State.user.role).slice(0, 2);

        container.innerHTML = `
            \${visibleAnnouncements.length > 0 ? `
                <div class="announcements-stack">
                    \${visibleAnnouncements.map(a => `
                        <div class="announcement-card priority-\${a.priority}">
                            <div class="announcement-header">
                                <h3 class="announcement-title">\${a.title}</h3>
                                <span class="announcement-date">\${a.createdAt ? UI.formatDate(new Date((a.createdAt.seconds || a.createdAt._seconds || 0) * 1000).toISOString().split('T')[0]) : 'Reciente'}</span>
                            </div>
                            <div class="announcement-content">\${a.content}</div>
                        </div>`).join('')}
                </div>
            ` : ''}
            
            <div class="dashboard-grid">
                <div class="stat-card" style="--accent-c: var(--primary); cursor:pointer" onclick="navigateTo('\${isAdmin ? 'usuarios' : 'mis_alumnos'}')">
                    <div class="stat-icon" style="background:rgba(8,145,178,0.1);color:var(--primary)">
                        <i data-lucide="users"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Alumnos Totales</div>
                        <div class="stat-value" id="stat-total-alumnos">...</div>
                    </div>
                </div>
                <div class="stat-card" style="--accent-c: var(--success); cursor:pointer" onclick="navigateTo('morosidades')">
                    <div class="stat-icon" style="background:rgba(22,163,74,0.1);color:var(--success)">
                        <i data-lucide="check-circle"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Estado Pagos</div>
                        <div class="stat-value" id="stat-alumnos-morosos" style="color:var(--overdue)">...</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Ver Morosos â†’</div>
                    </div>
                </div>
                <div class="stat-card" style="--accent-c: var(--overdue); cursor:pointer" onclick="navigateTo('payments_admin')">
                    <div class="stat-icon" style="background:rgba(220,38,38,0.1);color:var(--overdue)">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Pagos Pendientes</div>
                        <div class="stat-value" id="stat-pagos-pendientes" style="color:var(--overdue)">...</div>
                    </div>
                </div>
                <div class="stat-card" style="--accent-c: var(--warning); cursor:pointer" onclick="navigateTo('occupancy')">
                    <div class="stat-icon" style="background:rgba(217,119,6,0.1);color:var(--warning)">
                        <i data-lucide="unlock"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Cupos Libres</div>
                        <div class="stat-value" id="stat-cupos-libres" style="color:var(--warning)">...</div>
                    </div>
                </div>
            </div>

            <div class="two-col-grid mt-8">
                <div class="card">
                    <h3 class="section-title">Actividades</h3>
                    <div class="list-stack">
                        \${quickData.activities.slice(0, 5).map(a => `
                            <div class="list-row">
                                <div>
                                    <div class="row-title">\${a.name}</div>
                                    <div class="row-sub">Prof. \${a.teacher}</div>
                                </div>
                                <span class="badge badge-active">Activa</span>
                            </div>`).join('')}
                    </div>
                </div>
                <div class="card">
                    <h3 class="section-title">OcupaciÃ³n</h3>
                    <div class="list-stack">
                        <button class="btn btn-ghost btn-sm w-full" onclick="navigateTo('occupancy')">Ver Panel Visual â†’</button>
                    </div>
                </div>
            </div>`;

        window.refreshIcons();
        window.fetchBackgroundStats(isAdmin ? null : State.user.id);

    } else {
        await renderAlumnoDashboard(container);
    }
    window.refreshIcons();
}

/* â”€â”€â”€ ALUMNO DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

async function renderAlumnoDashboard(container) {
    const targetUserId = State.activeProfileId || State.user.id;

    const [myStatuses, myInscs, activities, turnos, config, announcements] = await Promise.all([
        DB.getUserStatuses(targetUserId).catch(e => { console.error(e); return []; }),
        DB.getMyInscripciones(targetUserId).catch(e => { console.error(e); return []; }),
        DB.getActivities().catch(e => { console.error(e); return []; }),
        DB.getTurnos().catch(e => { console.error(e); return []; }),
        DB.getGlobalConfig('deslinde').catch(e => { console.warn("Config permission denied"); return null; }),
        DB.getAnnouncements().catch(e => []),
    ]);

    const visibleAnnouncements = announcements.filter(a => a.role === 'all' || a.role === 'alumno').slice(0, 2);
    const firstName = (State.user.name || 'Alumno').split(' ')[0];
    const activeMember = State.family.find(f => f.id === State.activeProfileId);
    const viewingName = activeMember ? activeMember.name : State.user.name;

    container.innerHTML = `
        <div class="welcome-banner">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px">
                <div>
                    <h2 class="welcome-title">Â¡Hola, \${firstName}!</h2>
                    <p class="welcome-sub">EstÃ¡s viendo el panel de: <strong>\${viewingName}</strong></p>
                </div>
                
                \${State.family.length > 0 ? `
                <div class="profile-selector">
                    <button class="profile-chip \${!State.activeProfileId ? 'active' : ''}" onclick="window.switchProfile(null)">Yo</button>
                    \${State.family.map(f => `
                        <button class="profile-chip \${State.activeProfileId === f.id ? 'active' : ''}" onclick="window.switchProfile('\${f.id}')">
                            \${f.name.split(' ')[0]}
                        </button>
                    `).join('')}
                </div>` : ''}
            </div>

            <div class="mt-4" style="display:flex; gap:10px; flex-wrap:wrap">
                \${config?.url ? `
                    <a href="\${config.url}" target="_blank" class="btn btn-secondary btn-sm" style="background:rgba(255,255,255,0.2); border:none; color:white">
                        <i data-lucide="download"></i> Descargar Deslinde + Ficha (Para completar)
                    </a>
                ` : ''}
                \${State.user.waiver_url ? `
                    <a href="\${State.user.waiver_url}" target="_blank" class="btn btn-secondary btn-sm" style="background:rgba(255,255,255,0.3); border:none; color:white">
                        <i data-lucide="file-check"></i> Ver mi Deslinde Completo
                    </a>
                ` : ''}
            </div>
        </div>

        \${visibleAnnouncements.length > 0 ? `
            <div class="announcements-stack mt-6">
                \${visibleAnnouncements.map(a => `
                    <div class="announcement-card priority-\${a.priority}">
                        <div class="announcement-header">
                            <h3 class="announcement-title">\${a.title}</h3>
                            <span class="announcement-date">\${a.createdAt ? UI.formatDate(new Date((a.createdAt.seconds || a.createdAt._seconds || 0) * 1000).toISOString().split('T')[0]) : 'Reciente'}</span>
                        </div>
                        <div class="announcement-content">\${a.content}</div>
                    </div>`).join('')}
            </div>
        ` : ''}
        
        <div class="two-col-grid mt-6">
            \${myInscs.length === 0 ? `
                <div class="empty-state" style="grid-column:1/-1">
                    <div style="font-size:48px;margin-bottom:16px;opacity:0.5">ðŸ—“ï¸</div>
                    <p>No estÃ¡s inscripto en ninguna actividad aÃºn.</p>
                    <button onclick="navigateTo('inscripciones')" class="btn btn-primary mt-4">Ver Actividades</button>
                </div>` :
            (() => {
                // Agrupar inscripciones por actividad para mostrar una tarjeta por actividad
                const nowStr = new Date().toISOString().split('T')[0];
                const actIds = [...new Set(myInscs.map(i => i.activity_id))];
                return actIds.map(aid => {
                    const act = activities.find(a => a.id === aid);
                    const status = myStatuses.find(s => s.activity_id === aid);
                    const inscs = myInscs.filter(i => i.activity_id === aid);
                    
                    const isMoroso = !status || status.status === 'moroso' || (status.expiration && status.expiration < nowStr);

                    // Ordenar turnos cronolÃ³gicamente por dÃ­a y hora
                    const dayOrder = ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado', 'Domingo'];
                    inscs.sort((a, b) => {
                        const t1 = turnos.find(x => x.id === a.turno_id);
                        const t2 = turnos.find(x => x.id === b.turno_id);
                        if (!t1 || !t2) return 0;

                        const s1 = (t1.slots && t1.slots[0]) || t1;
                        const s2 = (t2.slots && t2.slots[0]) || t2;

                        const d1 = dayOrder.indexOf(s1.day);
                        const d2 = dayOrder.indexOf(s2.day);
                        if (d1 !== d2) return d1 - d2;
                        return (s1.start || '').localeCompare(s2.start || '');
                    });

                    return `
                            <div class="card \${isMoroso ? 'card-danger' : 'card-success'}">
                                <div class="row-between mb-3">
                                    <h3 class="row-title">\${act?.name || 'Actividad'}</h3>
                                    <span class="badge \${isMoroso ? 'badge-moroso' : 'badge-active'}">
                                        \${isMoroso ? (status ? 'MOROSO' : 'PAGÃ“ PENDIENTE') : 'AL DÃA'}
                                    </span>
                                </div>
                                <div class="row-sub mb-3">
                                    \${status ? `Vencimiento: <strong>\${UI.formatDate(status.expiration)}</strong>` : 'SuscripciÃ³n no iniciada'}
                                </div>
                                
                                <div class="turno-chips-wrap mb-4">
                                    \${inscs.map(i => {
                        const t = turnos.find(x => x.id === i.turno_id);
                        return t ? `
                                            <div class="turno-chip-row">
                                                <span class="turno-chip-label">
                                                    <i data-lucide="clock" style="width:12px;height:12px"></i>
                                                    \${t.slots ? t.slots.map(s => `\${s.day} \${s.start}-\${s.end}`).join(' | ') : `\${t.day} \${t.start}â€“\${t.end}`}
                                                </span>
                                                <button class="btn btn-cancel btn-xs" onclick="window.cancelInscripcion('\${i.id}')" title="Solicitar Baja">
                                                    <i data-lucide="user-minus" style="width:11px;height:11px"></i>
                                                </button>
                                            </div>` : '';
                    }).join('')}
                                </div>

                                \${isMoroso ? `
                                    <button onclick="navigateTo('pagos_socio')" class="btn btn-danger w-full">
                                        <i data-lucide="credit-card"></i> REPORTAR PAGO
                                    </button>` : `
                                    <div class="status-ok">
                                        <i data-lucide="check-circle"></i> Actividad al dÃ­a
                                    </div>`}
                            </div>`;
                }).join('');
            })()
        }
        </div>`;
}

window.switchProfile = (id) => {
    State.activeProfileId = id;
    renderView('dashboard');
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ACTIVIDADES â€” Admin
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderActivities(container) {
    let activities = await DB.getActivities();

    // Filtrar por profesor si aplica
    if (State.user.role === 'profesor') {
        activities = activities.filter(a => {
            const idMatch = a.profesor_id === State.user.id;
            const nameMatch = a.teacher && State.user.name && (
                a.teacher.toLowerCase().includes(State.user.name.toLowerCase()) ||
                State.user.name.toLowerCase().includes(a.teacher.toLowerCase())
            );
            return idMatch || nameMatch;
        });

    }

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">GestiÃ³n de Actividades</h2>
            <button class="btn btn-primary" onclick="window.showActivityModal()">
                <i data-lucide="plus"></i> Nueva Actividad
            </button>
        </div>
        \${activities.length === 0 ? `
            <div class="empty-state">
                <i data-lucide="zap" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:16px"></i>
                <p>No hay actividades. Â¡CreÃ¡ la primera!</p>
            </div>` : `
            <div class="cards-grid">
                \${activities.map(a => `
                    <div class="card activity-card">
                        <div class="row-between mb-3">
                            <span class="badge \${a.status === 'active' ? 'badge-active' : 'badge-moroso'}">
                                \${a.status === 'active' ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                        <h3 class="act-title">\${a.name}</h3>
                        <p class="act-teacher">Prof. \${a.teacher}</p>
                        <div class="mt-2" style="font-size:12px">
                            <div class="row-between"><span>Efectivo:</span> <strong>$\${Number(a.price_cash || a.price || 0).toLocaleString('es-AR')}</strong></div>
                            <div class="row-between"><span>Transf./MP:</span> <strong>$\${Number(a.price_digital || a.price || 0).toLocaleString('es-AR')}</strong></div>
                        </div>
                        <div class="card-actions">
                            \${State.user.role === 'admin' ? `
                            <button class="btn btn-secondary btn-sm" onclick="window.showActivityModal('\${a.id}')">
                                <i data-lucide="pencil" style="width:13px;height:13px"></i> Editar
                            </button>
                            <button class="btn btn-ghost btn-sm" onclick="window.toggleActivity('\${a.id}','\${a.status}')">
                                <i data-lucide="\${a.status === 'active' ? 'eye-off' : 'eye'}" style="width:13px;height:13px"></i>
                                \${a.status === 'active' ? 'Desactivar' : 'Activar'}
                            </button>
                            <button class="btn btn-danger-ghost btn-sm" onclick="window.deleteActivity('\${a.id}')">
                                <i data-lucide="trash-2" style="width:13px;height:13px"></i>
                            </button>
                            ` : `<p class="text-xs text-muted">Vista de profesor (solo lectura)</p>`}
                        </div>
                    </div>`).join('')}
            </div>`}`;
}

window.showActivityModal = async (actId = null) => {
    let act = null;
    const [allUsers, acts] = await Promise.all([DB.getUsers(), DB.getActivities()]);
    const profesores = allUsers.filter(u => u.role === 'profesor' || u.role === 'admin');

    if (actId) {
        act = acts.find(a => a.id === actId);
    }

    UI.showModal(act ? 'Editar Actividad' : 'Nueva Actividad', `
        <form id="act-form" class="form-stack">
            <div class="form-group">
                <label class="label">Nombre</label>
                <input type="text" id="act-name" class="input" placeholder="Ej: Crossfit" value="\${act?.name || ''}" required>
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label class="label">Profesor Titular (Login)</label>
                    <select id="act-profesor-id" class="input">
                        <option value="">Seleccionar profesor...</option>
                        \${profesores.map(p => `<option value="\${p.id}" \${act?.profesor_id === p.id ? 'selected' : ''}>\${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="label">Nombre Profesor (Texto)</label>
                    <input type="text" id="act-teacher" class="input" placeholder="Nombre visible" value="\${act?.teacher || ''}" required>
                </div>
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label class="label">Precio Efectivo ($)</label>
                    <input type="number" id="act-price-cash" class="input" placeholder="0" value="\${act?.price_cash || act?.price || ''}" required>
                </div>
                <div class="form-group">
                    <label class="label">Precio Transf./Digital ($)</label>
                    <input type="number" id="act-price-digital" class="input" placeholder="0" value="\${act?.price_digital || act?.price || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label class="label">Estado</label>
                <select id="act-status" class="input">
                    <option value="active"   \${!act || act.status === 'active' ? 'selected' : ''}>Activa</option>
                    <option value="inactive" \${act?.status === 'inactive' ? 'selected' : ''}>Inactiva</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
                <button type="submit" id="act-submit" class="btn btn-primary">\${act ? 'Guardar Cambios' : 'Crear Actividad'}</button>
            </div>
        </form>`);

    document.getElementById('act-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('act-submit');
        btn.disabled = true; btn.textContent = 'Guardando...';
        const data = {
            name: document.getElementById('act-name').value.trim(),
            teacher: document.getElementById('act-teacher').value.trim(),
            profesor_id: document.getElementById('act-profesor-id').value,
            price_cash: parseInt(document.getElementById('act-price-cash').value),
            price_digital: parseInt(document.getElementById('act-price-digital').value),
            status: document.getElementById('act-status').value,
        };
        try {
            if (act) { await DB.updateActivity(actId, data); UI.notify('Actividad actualizada.'); }
            else { await DB.addActivity(data); UI.notify('Actividad creada.'); }
            UI.hideModal();
            renderView('activities');
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = act ? 'Guardar Cambios' : 'Crear Actividad';
        }
    };
};

window.toggleActivity = async (actId, currentStatus) => {
    try {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        await DB.updateActivity(actId, { status: newStatus });
        UI.notify(\`Actividad \${newStatus === 'active' ? 'activada' : 'desactivada'}.\`);
        renderView('activities');
    } catch (err) { UI.notify(err.message, 'error'); }
};

window.deleteActivity = (actId) => {
    UI.showModal('Eliminar Actividad', `
        <div class="confirm-danger">
            <i data-lucide="alert-triangle" style="width:40px;height:40px;color:var(--overdue);margin-bottom:12px"></i>
            <p>Â¿EstÃ¡s seguro de que querÃ©s <strong>eliminar</strong> esta actividad?</p>
            <p class="text-sm text-muted" style="margin-top:8px">Esta acciÃ³n no se puede deshacer.</p>
        </div>
        <div class="modal-actions mt-4">
            <button class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
            <button class="btn btn-danger" id="confirm-del-act">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i> Eliminar
            </button>
        </div>`);

    document.getElementById('confirm-del-act').onclick = async () => {
        try {
            await DB.deleteActivity(actId);
            UI.hideModal();
            UI.notify('Actividad eliminada.');
            renderView('activities');
        } catch (err) { UI.notify(err.message, 'error'); }
    };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TURNOS â€” Admin
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderTurnos(container) {
    let [activities, turnos, countMap] = await Promise.all([
        DB.getActivities(),
        DB.getTurnos(),
        DB.getInscripcionesCountMap(),
    ]);

    // Filtrar por profesor si aplica
    if (State.user.role === 'profesor') {
        activities = activities.filter(a => {
            const idMatch = a.profesor_id === State.user.id;
            const nameMatch = a.teacher && State.user.name && (
                a.teacher.toLowerCase().includes(State.user.name.toLowerCase()) ||
                State.user.name.toLowerCase().includes(a.teacher.toLowerCase())
            );
            return idMatch || nameMatch;
        });

    }

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">GestiÃ³n de Turnos</h2>
            <button class="btn btn-primary" onclick="window.showTurnoModal()">
                <i data-lucide="plus"></i> Nuevo Turno
            </button>
        </div>
        \${activities.length === 0 ? \`<div class="empty-state">No hay actividades. CreÃ¡ una primero.</div>\` :
            activities.map(act => {
                const actTurnos = turnos.filter(t => t.activity_id === act.id);
                return \`
                <div class="card mb-4">
                    <div class="row-between mb-4">
                        <div>
                            <h3 class="row-title">\${act.name}</h3>
                            <span class="row-sub">Prof. \${act.teacher}</span>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="window.showTurnoModal(null,'\${act.id}')">
                            <i data-lucide="plus" style="width:13px;height:13px"></i> Turno
                        </button>
                    </div>
                    \${actTurnos.length === 0 ? \`<div class="empty-inline">Sin turnos aÃºn.</div>\` : \`
                        <div class="turnos-table-wrap">
                            <table class="turnos-table">
                                <thead>
                                    <tr><th>DÃ­as y Horarios</th><th>Cupo MÃ¡x.</th><th>Disponibles</th><th>Acciones</th></tr>
                                </thead>
                                <tbody>
                                    \${actTurnos.map(t => {
                    const used = countMap[t.id] || 0;
                    const avail = Math.max(0, t.max_cupo - used);
                    const slotsStr = t.slots ? t.slots.map(s => \`\${s.day} \${s.start}-\${s.end}\`).join('<br>') : \`\${t.day} \${t.start}-\${t.end}\`;
                    return \`
                                        <tr>
                                            <td class="td-bold">\${slotsStr}</td>
                                            <td>\${t.max_cupo}</td>
                                            <td><span class="badge \${avail > 0 ? 'badge-active' : 'badge-moroso'}">\${avail} libres</span></td>
                                            <td>
                                                <div class="action-row">
                                                    <button class="btn btn-secondary btn-xs" onclick="window.showTurnoModal('\${t.id}')">
                                                        <i data-lucide="pencil" style="width:12px;height:12px"></i>
                                                    </button>
                                                    <button class="btn btn-danger-ghost btn-xs" onclick="window.deleteTurno('\${t.id}')">
                                                        <i data-lucide="trash-2" style="width:12px;height:12px"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>\`;
                }).join('')}
                                </tbody>
                            </table>
                        </div>\`}
                </div>\`;
            }).join('')}`;
}

window.showTurnoModal = async (turnoId = null, preselectedActId = null) => {
    const activities = await DB.getActivities();
    let turno = null;
    if (turnoId) {
        const allTurnos = await DB.getTurnos();
        turno = allTurnos.find(t => t.id === turnoId);
    }

    const days = ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado', 'Domingo'];

    UI.showModal(turno ? 'Editar Turno' : 'Nuevo Turno', `
        <form id="turno-form" class="form-stack">
            <div class="form-group">
                <label class="label">Actividad</label>
                <select id="t-activity" class="input" required>
                    \${activities.map(a => \`
                        <option value="\${a.id}" \${(turno?.activity_id === a.id || preselectedActId === a.id) ? 'selected' : ''}>
                            \${a.name}
                        </option>\`).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label class="label">DÃ­as y Horarios</label>
                <div id="slots-container" class="list-stack mb-2">
                    <!-- Slots dynamic -->
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.addSlotRow()">
                    <i data-lucide="plus" style="width:12px;height:12px"></i> Agregar DÃ­a/Hora
                </button>
            </div>

            <div class="form-group">
                <label class="label">Cupo MÃ¡ximo</label>
                <input type="number" id="t-cupo" class="input" min="1" max="200" value="\${turno?.max_cupo || 20}" required>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
                <button type="submit" id="t-submit" class="btn btn-primary">Guardar Turno</button>
            </div>
        </form>`);

    window.addSlotRow = (data = null) => {
        const container = document.getElementById('slots-container');
        const div = document.createElement('div');
        div.className = 'slot-row row-between mb-2';
        div.style = 'gap:8px; align-items:flex-end';
        div.innerHTML = `
            <div style="flex:1">
                <select class="input slot-day" required>
                    \${days.map(d => \`<option value="\${d}" \${data?.day === d ? 'selected' : ''}>\${d}</option>\`).join('')}
                </select>
            </div>
            <div style="width:100px">
                <input type="time" class="input slot-start" value="\${data?.start || '18:00'}" required>
            </div>
            <div style="width:100px">
                <input type="time" class="input slot-end" value="\${data?.end || '19:00'}" required>
            </div>
            <button type="button" class="btn btn-danger-ghost btn-xs" onclick="this.parentElement.remove()">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
        `;
        container.appendChild(div);
        window.refreshIcons();
    };

    if (turno?.slots) {
        turno.slots.forEach(s => window.addSlotRow(s));
    } else if (turno?.day) {
        // Fallback for legacy turnos
        window.addSlotRow({ day: turno.day, start: turno.start, end: turno.end });
    } else {
        window.addSlotRow();
    }

    document.getElementById('turno-form').onsubmit = async (e) => {
        e.preventDefault();
        const slotEls = document.querySelectorAll('.slot-row');
        const slots = Array.from(slotEls).map(el => ({
            day: el.querySelector('.slot-day').value,
            start: el.querySelector('.slot-start').value,
            end: el.querySelector('.slot-end').value,
        }));

        if (slots.length === 0) {
            UI.notify('AgregÃ¡ al menos un horario.', 'error');
            return;
        }

        const btn = document.getElementById('t-submit');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const data = {
            activity_id: document.getElementById('t-activity').value,
            max_cupo: parseInt(document.getElementById('t-cupo').value),
            slots: slots
        };

        try {
            if (turnoId) {
                await DB.updateTurno(turnoId, data);
                UI.notify('Turno actualizado.');
            } else {
                await DB.addTurno(data);
                UI.notify('Turno creado.');
            }
            UI.hideModal();
            renderView('turnos');
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = 'Guardar Turno';
        }
    };
};

window.deleteTurno = (turnoId) => {
    UI.showModal('Eliminar Turno', `
        <div class="confirm-danger">
            <i data-lucide="alert-triangle" style="width:40px;height:40px;color:var(--overdue);margin-bottom:12px"></i>
            <p>Â¿EstÃ¡s seguro de que querÃ©s eliminar este turno?</p>
        </div>
        <div class="modal-actions mt-4">
            <button class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
            <button class="btn btn-danger" id="confirm-del-turno">Eliminar</button>
        </div>`);

    document.getElementById('confirm-del-turno').onclick = async () => {
        try {
            await DB.deleteTurno(turnoId);
            UI.hideModal(); UI.notify('Turno eliminado.'); renderView('turnos');
        } catch (err) { UI.notify(err.message, 'error'); }
    };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MIS ALUMNOS â€” Profesor
   Vista para que el profesor vea solo sus alumnos inscriptos.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */


async function renderMisAlumnos(container) {
    const [activities, allStatuses, users, inscriptions] = await Promise.all([
        DB.getActivities(),
        DB.getAllStatuses(),
        DB.getUsers(),
        DB.getInscripciones()
    ]);

    // Filtrar actividades del profesor (con matching flexible de nombre)
    const myActivities = activities.filter(a => {
        const idMatch = a.profesor_id === State.user.id;
        const nameMatch = a.teacher && State.user.name && (
            a.teacher.toLowerCase().includes(State.user.name.toLowerCase()) ||
            State.user.name.toLowerCase().includes(a.teacher.toLowerCase())
        );
        return idMatch || nameMatch;
    });
    const myActIds = myActivities.map(a => a.id);

    // Obtener alumnos inscriptos en esas actividades (basado en inscripciones reales)
    const myInscriptions = inscriptions.filter(i => myActIds.includes(i.activity_id));
    const studentIds = [...new Set(myInscriptions.map(i => i.user_id))];
    const myStudents = users.filter(u => studentIds.includes(u.id));

    // Estados filtrados por mis actividades (para saber morosidad)
    const myStudentsStatuses = allStatuses.filter(st => myActIds.includes(st.activity_id));

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">Mis Alumnos Inscriptos</h2>
            <div class="badge badge-active" style="padding:6px 12px">\${myStudents.length} Alumno(s)</div>
        </div>
        
        <div class="socios-table-wrap card" style="padding:0;overflow:hidden">
            <table class="turnos-table">
                <thead>
                    <tr><th>Alumno</th><th>Contacto</th><th>Actividad(es)</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                    \${myStudents.length === 0 ? `
                        <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">
                            No tenÃ©s alumnos inscriptos aÃºn en tus actividades.
                        </td></tr>` :
            myStudents.map(u => {
                const userActStats = myStudentsStatuses.filter(st => st.user_id === u.id);
                // Inscripto en:
                const userInscs = myInscriptions.filter(i => i.user_id === u.id);
                const uniqueInscActIds = [...new Set(userInscs.map(i => i.activity_id))];

                const nowStr = new Date().toISOString().split('T')[0];
                // Es moroso si tiene estado 'moroso' en CUALQUIERA de mis actividades
                // O si no tiene estado record para una actividad en la que estÃ¡ inscripto (pago inicial)
                // O si estÃ¡ activo pero EXPIRÃ“
                const isMoroso = uniqueInscActIds.some(aid => {
                    const st = userActStats.find(s => s.activity_id === aid);
                    if (!st) return true;
                    const s = (st.status || '').toLowerCase();
                    const exp = st.expiration;
                    return s === 'moroso' || (s === 'active' && exp && exp < nowStr);
                });

                const displayName = u.name || 'Sin nombre';

                const studentActs = uniqueInscActIds.map(aid => {
                    const a = activities.find(act => act.id === aid);
                    return a ? a.name : 'Actividad';
                }).join(', ');

                return `
                            <tr>
                                <td>
                                    <div class="socio-avatar-wrap">
                                        <div class="socio-avatar">\${displayName.charAt(0).toUpperCase()}</div>
                                        <div>
                                            <div class="td-bold">\${displayName}</div>
                                            <div class="text-xs text-muted">@\${u.usuario || 'â€”'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="text-sm">\${u.phone || 'â€”'}</div>
                                    <div class="text-xs text-muted">DNI: \${u.dni || 'â€”'}</div>
                                </td>
                                <td>
                                    <div class="text-xs" style="font-weight:600">\${studentActs}</div>
                                </td>
                                <td>
                                    <span class="badge \${isMoroso ? 'badge-moroso' : 'badge-active'}">
                                        \${isMoroso ? 'DEUDA / PEDN.' : 'AL DÃA'}
                                    </span>
                                </td>
                                <td>
                                    <div class="action-row" style="display:flex; gap:4px">
                                        <button class="btn btn-secondary btn-xs" onclick="window.showUserFicha('\${u.id}')" title="Ver Ficha">
                                            <i data-lucide="user" style="width:12px;height:12px"></i> Ficha
                                        </button>
                                        <button class="btn btn-ghost btn-xs" onclick="window.showAlumnoHistory('\${u.id}')" title="Historial de Pagos">
                                            <i data-lucide="history" style="width:12px;height:12px"></i> Pagos
                                        </button>
                                    </div>
                                </td>
                            </tr>`;
            }).join('')}
                </tbody>
            </table>
        </div>`;
    window.refreshIcons();
}

window.showUserFicha = async (userId) => {
    UI.showModal('Ficha de Alumno', '<div class="loader-wrapper"><i data-lucide="loader-2" class="spin-icon"></i></div>');
    const [user, statuses, activities, inscriptions] = await Promise.all([
        DB.getUserProfile(userId),
        DB.getUserStatuses(userId),
        DB.getActivities(),
        DB.getMyInscripciones(userId)
    ]);

    const myActivities = activities.filter(a => a.profesor_id === State.user.id || a.teacher === State.user.name);
    const myActIds = myActivities.map(a => a.id);

    // Actividades en las que estÃ¡ inscripto y son de este profesor
    const studentActIds = [...new Set(inscriptions.map(i => i.activity_id))].filter(aid => myActIds.includes(aid));

    document.getElementById('modal-content').querySelector('.modal-body').innerHTML = `
        <div style="display:flex; align-items:center; gap:20px; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border)">
            <div class="socio-avatar" style="width:64px; height:64px; font-size:24px">\${(user.name || 'A').charAt(0).toUpperCase()}</div>
            <div>
                <h3 style="margin:0">\${user.name}</h3>
                <p class="text-muted" style="margin:5px 0 0">@\${user.usuario}</p>
            </div>
        </div>
        
        <div class="form-stack">
            <div class="form-row-2">
                <div>
                    <label class="label">DNI</label>
                    <div class="input" style="background:#f8fafc">\${user.dni || 'â€”'}</div>
                </div>
                <div>
                    <label class="label">TelÃ©fono</label>
                    <div class="input" style="background:#f8fafc">\${user.phone || 'â€”'}</div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="label">Email Personal</label>
                <div class="input" style="background:#f8fafc">\${user.personal_email || 'â€”'}</div>
            </div>

            <div class="form-group">
                <label class="label">Contacto de Emergencia</label>
                <div class="input" style="background:#f8fafc; display:flex; flex-direction:column; gap:4px; padding:12px">
                    <div style="font-weight:700">\${user.emergency_name || 'â€”'} (\${user.emergency_relationship || 'Parentesco s/n'})</div>
                    <div class="text-xs text-muted">Tel: \${user.emergency_phone || 'â€”'}</div>
                </div>
            </div>

            <div class="form-group">
                <label class="label">Estado en mis actividades</label>
                <div class="list-stack mt-2">
                    \${studentActIds.length === 0 ? '<p class="text-muted text-sm">No tiene inscripciones activas.</p>' :
            studentActIds.map(aid => {
                const act = activities.find(a => a.id === aid);
                const s = statuses.find(st => st.activity_id === aid);
                const isMoroso = !s || s.status === 'moroso';
                return `
                            <div class="row-between" style="padding:10px; background:#f8fafc; border-radius:10px; margin-bottom:8px">
                                <span style="font-weight:600">\${act?.name || 'Actividad'}</span>
                                <span class="badge \${isMoroso ? 'badge-moroso' : 'badge-active'}">
                                    \${isMoroso ? (s ? 'MOROSO' : 'PAGO PEND.') : 'AL DÃA'}
                                </span>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>

            \${user.waiver_url ? `
            <div class="form-group">
                <label class="label">DocumentaciÃ³n</label>
                <a href="\${user.waiver_url}" target="_blank" class="btn btn-secondary btn-sm w-full">
                    <i data-lucide="file-text"></i> Ver Deslinde de Responsabilidad (PDF)
                </a>
            </div>` : ''}
        </div>
        
        <div class="modal-actions mt-6">
            <button class="btn btn-primary w-full" onclick="UI.hideModal()">Cerrar Ficha</button>
        </div>
    `;
    window.refreshIcons();
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SOCIOS â€” Admin
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderUsers(container) {
    const [users, allStatuses] = await Promise.all([
        DB.getUsers(),
        DB.getAllStatuses(),
    ]);

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">GestiÃ³n de Usuarios</h2>
            <div style="display:flex; gap:10px">
                <button class="btn btn-secondary" onclick="window.showConfigDeslinde()">
                    <i data-lucide="upload"></i> Subir Deslinde General
                </button>
                <button class="btn btn-primary" onclick="window.showUserModal()">
                    <i data-lucide="user-plus"></i> Nuevo Usuario
                </button>
            </div>
        </div>
        <div class="socios-table-wrap card" style="padding:0;overflow:hidden">
            <table class="turnos-table">
                <thead>
                    <tr><th>Usuario</th><th>Contacto / DNI</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                    \${users.length === 0 ? `
                        <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">
                            No hay usuarios registrados aÃºn.
                        </td></tr>` :
            users.map(u => {
                const userStats = allStatuses.filter(st => st.user_id === u.id);
                const isMoroso = userStats.some(st => st.status === 'moroso');
                const displayName = u.name || 'Sin nombre';
                const roles = { admin: 'Admin', profesor: 'Profe', alumno: 'Alumno', socio: 'Alumno' };
                return `
                            <tr>
                                <td>
                                    <div class="socio-avatar-wrap">
                                        <div class="socio-avatar">\${displayName.charAt(0).toUpperCase()}</div>
                                        <div>
                                            <div class="td-bold">\${displayName}</div>
                                            <div class="text-xs text-muted">@\${u.usuario || 'â€”'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="text-sm">\${u.phone || 'â€”'}</div>
                                    <div class="text-xs text-muted">DNI: \${u.dni || 'â€”'}</div>
                                </td>
                                <td>
                                    <span class="badge \${u.role === 'admin' ? 'badge-active' : u.role === 'profesor' ? 'badge-warning' : 'badge-secondary'}" style="background:var(--bg-muted); color:var(--text-main); border:1px solid var(--border)">
                                        \${roles[u.role] || u.role}
                                    </span>
                                </td>
                                <td>
                                    \${u.role === 'alumno' || u.role === 'socio' ? `
                                        <span class="badge \${isMoroso ? 'badge-moroso' : 'badge-active'}">
                                            \${isMoroso ? 'MOROSO' : 'AL DÃA'}
                                        </span>` : 'â€”'}
                                </td>
                                <td>
                                    <div class="action-row">
                                        <button class="btn btn-secondary btn-xs" onclick="window.showUserModal('\${u.id}')" title="Editar">
                                            <i data-lucide="pencil" style="width:12px;height:12px"></i>
                                        </button>
                                        \${u.role === 'alumno' || u.role === 'socio' ? `
                                        <button class="btn btn-secondary btn-xs" onclick="window.showAlumnoHistory('\${u.id}')" title="Pagos">
                                            <i data-lucide="history" style="width:12px;height:12px"></i>
                                        </button>` : ''}
                                        <button class="btn btn-danger-ghost btn-xs" onclick="window.deleteUser('\${u.id}')" title="Eliminar">
                                            <i data-lucide="trash-2" style="width:12px;height:12px"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>`;
            }).join('')}
                </tbody>
            </table>
        </div>`;
}

window.showUserModal = async (userId = null) => {
    let user = null;
    if (userId) user = await DB.getUserProfile(userId);

    UI.showModal(user ? 'Editar Usuario' : 'Nuevo Usuario', `
        <form id="user-form" class="form-stack">
            <div class="form-row-2">
                <div class="form-group">
                    <label class="label">Nombre Completo</label>
                    <input type="text" id="u-name" class="input" placeholder="Juan PÃ©rez" value="\${user?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label class="label">Rol</label>
                    <select id="u-role" class="input" required>
                        <option value="alumno" \${user?.role === 'alumno' || user?.role === 'socio' ? 'selected' : ''}>Alumno</option>
                        <option value="profesor" \${user?.role === 'profesor' ? 'selected' : ''}>Profesor</option>
                        <option value="admin" \${user?.role === 'admin' ? 'selected' : ''}>Administrador</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label class="label">Nombre de Usuario (Login)</label>
                <input type="text" id="u-usuario" class="input" placeholder="Ej: JuanP"
                    value="\${user?.usuario || ''}" \${user ? 'readonly style="background:#f1f5f9;cursor:not-allowed"' : ''} required>
                <span class="field-hint">Este serÃ¡ el identificador para entrar al sistema.</span>
            </div>

            \${!user ? `
            <div class="form-group">
                <label class="label">ContraseÃ±a Inicial</label>
                <input type="password" id="u-password" class="input" placeholder="MÃ­nimo 6 caracteres" required minlength="6">
            </div>` : ''}

            \${user ? `
            <hr class="mt-4 mb-4">
            <p class="text-xs text-muted mb-4">Campos adicionales (Opcionales - Se completan en el onboarding):</p>
            <div class="form-row-2">
                <div class="form-group">
                    <label class="label">DNI</label>
                    <input type="text" id="u-dni" class="input" placeholder="DNI sin puntos" value="\${user?.dni || ''}">
                </div>
                <div class="form-group">
                    <label class="label">Email Personal</label>
                    <input type="email" id="u-personal-email" class="input" placeholder="ejemplo@correo.com" value="\${user?.personal_email || ''}">
                </div>
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label class="label">TelÃ©fono</label>
                    <input type="tel" id="u-phone" class="input" placeholder="+54 9 ..." value="\${user?.phone || ''}">
                </div>
                <div class="form-group">
                    <label class="label">Tel. Emergencia</label>
                    <input type="tel" id="u-emergency" class="input" placeholder="Contacto de emergencia" value="\${user?.emergency_phone || ''}">
                </div>
            </div>
            ` : ''}

            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
                <button type="submit" id="u-submit" class="btn btn-primary">\${user ? 'Guardar Cambios' : 'Crear Usuario'}</button>
            </div>
        </form>`);

    document.getElementById('user-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('u-submit');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const data = {
            name: document.getElementById('u-name').value.trim(),
            role: document.getElementById('u-role').value,
            dni: document.getElementById('u-dni')?.value.trim() || '',
            personal_email: document.getElementById('u-personal-email')?.value.trim() || '',
            usuario: document.getElementById('u-usuario').value.trim(),
            phone: document.getElementById('u-phone')?.value.trim() || '',
            emergency_phone: document.getElementById('u-emergency')?.value.trim() || '',
            emergency_name: document.getElementById('u-emergency-name')?.value.trim() || '',
            emergency_relationship: document.getElementById('u-emergency-rel')?.value || '',
            waiver_url: user?.waiver_url || '',
            profile_completed: user ? true : false // Si es nuevo, forzamos onboarding
        };

        const runWithTimeout = (promise, ms, errorMsg) => {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms));
            return Promise.race([promise, timeout]);
        };

        try {
            const waiverFileInput = document.getElementById('u-waiver-file');
            const waiverFile = waiverFileInput ? waiverFileInput.files[0] : null;
            if (waiverFile) {
                try {
                    btn.textContent = 'Iniciando subida... (0%)';
                    UI.notify('Subiendo archivo...', 'info');

                    const ext = waiverFile.name.split('.').pop() || 'pdf';
                    const storageId = userId || data.usuario || Date.now();
                    const storageRef = storage.ref(`deslindes/\${storageId}_deslinde.\${ext}`);

                    const uploadTask = storageRef.put(waiverFile);

                    const uploadPromise = new Promise((resolve, reject) => {
                        uploadTask.on('state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                btn.textContent = `Subiendo: \${Math.round(progress)}%`;
                                console.log('Progreso de subida:', progress + '%');
                            },
                            (error) => {
                                console.error("Error en UploadTask:", error);
                                reject(error);
                            },
                            () => {
                                console.log("UploadTask completado satisfactoriamente.");
                                resolve();
                            }
                        );
                    });

                    // Timeout de 60 segundos
                    await runWithTimeout(uploadPromise, 60000, "Tiempo de subida agotado (60s). El archivo es muy grande o la conexiÃ³n es inestable.");

                    data.waiver_url = await storageRef.getDownloadURL();
                    console.log("URL de descarga obtenida:", data.waiver_url);
                } catch (storageErr) {
                    console.error('Error uploading file:', storageErr);
                    UI.notify(storageErr.message || 'Fallo en la subida del archivo. Guardando el resto de los datos...', 'warning');
                }
            }

            btn.textContent = 'Guardando perfil...';
            if (user) {
                await runWithTimeout(
                    DB.updateUserProfile(userId, data),
                    12000,
                    "Error al actualizar perfil (timeout base de datos)."
                );
                UI.notify('Usuario actualizado.');
            } else {
                const pass = document.getElementById('u-password').value;
                await runWithTimeout(
                    DB.createUserAccount(data, pass),
                    20000,
                    "Error al crear cuenta (timeout base de datos)."
                );
                UI.notify('Usuario creado correctamente.');
            }
            UI.hideModal();
            renderView('usuarios');
        } catch (err) {
            console.error('Error general en saveUser:', err);
            UI.notify(err.message || 'Error al procesar la solicitud.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = user ? 'Guardar Cambios' : 'Crear Usuario';
        }
    };
};

window.showAlumnoHistory = async (alumnoId) => {
    UI.showModal('Historial de Pagos', '<div class="loader-wrapper"><i data-lucide="loader-2" class="spin-icon"></i></div>');
    window.refreshIcons();
    const [profile, allPayments, activities] = await Promise.all([
        DB.getUserProfile(alumnoId),
        DB.getPayments({ user_id: alumnoId }),
        DB.getActivities(),
    ]);

    let payments = allPayments;
    if (State.user.role === 'profesor') {
        const myActIds = activities
            .filter(a => a.profesor_id === State.user.id || a.teacher === State.user.name)
            .map(a => a.id);
        payments = allPayments.filter(p => myActIds.includes(p.activity_id));
    }

    document.getElementById('modal-content').querySelector('.modal-body').innerHTML = `
        <h4 style="margin-bottom:12px">\${profile?.name}</h4>
        <div class="list-stack">
            \${payments.length === 0 ? '<p class="text-muted">Sin pagos registrados.</p>' :
            payments.map(p => {
                const act = activities.find(a => a.id === p.activity_id);
                return \`
                    <div class="list-row">
                        <div>
                            <div class="row-title">\${act?.name || p.activity_id}</div>
                            <div class="row-sub">\${p.date || 'â€”'} Â· \${p.method}</div>
                        </div>
                        <div style="text-align:right">
                            <div style="font-weight:700">$\${Number(p.amount).toLocaleString('es-AR')}</div>
                            <span class="badge \${p.status === 'approved' ? 'badge-active' : p.status === 'pending' ? 'badge-warning' : 'badge-moroso'}">
                                \${p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                            </span>
                        </div>
                    </div>\`;
            }).join('')}
        </div>\`;
    window.refreshIcons();
};

window.deleteUser = (userId) => {
    UI.showModal('Eliminar Usuario', `
        <div class="confirm-danger">
            <i data-lucide="alert-triangle" style="width:40px;height:40px;color:var(--overdue);margin-bottom:12px"></i>
            <p>Â¿EstÃ¡s seguro de que querÃ©s eliminar este usuario?</p>
            <p class="text-sm text-muted" style="margin-top:8px">
                Se eliminarÃ¡ el perfil en Firestore. La cuenta de acceso debe eliminarse manualmente en Firebase Console.
            </p>
        </div>
        <div class="modal-actions mt-4">
            <button class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
            <button class="btn btn-danger" id="confirm-del-user">Eliminar perfil</button>
        </div>`);

    document.getElementById('confirm-del-user').onclick = async () => {
        try {
            await db.collection('users').doc(userId).delete();
            UI.hideModal(); UI.notify('Perfil eliminado.'); renderView('usuarios');
        } catch (err) { UI.notify(err.message, 'error'); }
    };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PAGOS â€” Admin
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderPaymentsAdmin(container) {
    const isProfesor = State.user.role === 'profesor';
    const isAdmin = State.user.role === 'admin';

    let activityIds = null;
    if (isProfesor) {
        const activities = await DB.getActivities();
        activityIds = activities
            .filter(a => a.profesor_id === State.user.id || (State.user.name && a.teacher?.toLowerCase().includes(State.user.name.toLowerCase())))
            .map(a => a.id);
    }

    const [payments, users, activities] = await Promise.all([
        DB.getPayments({ status: 'pending', activity_ids: activityIds }),
        DB.getUsers(),
        DB.getActivities(),
    ]);

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">Pagos Pendientes de AprobaciÃ³n</h2>
            <span class="badge badge-warning" style="font-size:13px;padding:6px 14px">\${payments.length} pendiente(s)</span>
        </div>
        \${payments.length === 0 ? `
            <div class="empty-state">
                <i data-lucide="check-circle" style="width:48px;height:48px;color:var(--success);margin-bottom:16px"></i>
                <p>No hay pagos pendientes.</p>
            </div>` :
            payments.map(p => {
                const act = activities.find(a => a.id === p.activity_id);
                const socio = users.find(s => s.id === p.user_id);
                return `
                <div class="card payment-row mb-4">
                    <div class="payment-info">
                        <div class="payment-avatar">
                            <i data-lucide="file-text" style="width:20px;height:20px"></i>
                        </div>
                        <div>
                            <div class="row-title">\${socio?.name || 'Alumno desconocido'}</div>
                            <div class="row-sub">
                                \${act?.name || 'Actividad'} Â·
                                $\${Number(p.amount).toLocaleString('es-AR')} Â·
                                \${p.date || 'â€”'} Â· \${p.method}
                            </div>
                        </div>
                    </div>
                    <div class="action-row">
                        <button class="btn btn-primary btn-sm" onclick="window.approvePay('\${p.id}')">
                            <i data-lucide="check" style="width:13px;height:13px"></i> Aprobar
                        </button>
                        <button class="btn btn-danger-ghost btn-sm" onclick="window.rejectPay('\${p.id}')">
                            <i data-lucide="x" style="width:13px;height:13px"></i> Rechazar
                        </button>
                    </div>
                </div>`;
            }).join('')}`;
}

window.approvePay = async (payId) => {
    try {
        await DB.approvePayment(payId);
        UI.notify('Pago aprobado. SuscripciÃ³n renovada por 1 mes.');
        renderView('payments_admin');
    } catch (err) { UI.notify(err.message, 'error'); }
};

window.rejectPay = async (payId) => {
    try {
        await DB.rejectPayment(payId);
        UI.notify('Pago rechazado.', 'error');
        renderView('payments_admin');
    } catch (err) { UI.notify(err.message, 'error'); }
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HISTORIAL DE PAGOS â€” Admin
   Identificando socios, pagos y periodos.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderPaymentsHistory(container) {
    const isProfesor = State.user.role === 'profesor';

    let activityIds = null;
    if (isProfesor) {
        const allActs = await DB.getActivities();
        activityIds = allActs
            .filter(a => a.profesor_id === State.user.id || (State.user.name && a.teacher?.toLowerCase().includes(State.user.name.toLowerCase())))
            .map(a => a.id);
    }

    const [payments, users, activities, allStatuses] = await Promise.all([
        DB.getPayments({ activity_ids: activityIds }), // Filtrado si es profe
        DB.getUsers(),
        DB.getActivities(),
        DB.getAllStatuses()
    ]);

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">Registro de Cobranzas</h2>
            <button class="btn btn-secondary" onclick="window.generatePDFReport()">
                <i data-lucide="file-text"></i> Generar Reporte PDF
            </button>
        </div>
        <div class="card" style="padding:0; overflow:hidden">
            <table class="turnos-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Socio</th>
                        <th>Actividad</th>
                        <th>Periodo</th>
                        <th>Monto</th>
                        <th>MÃ©todo</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    \${payments.length === 0 ? `
                        <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">
                            No hay registros de pagos aÃºn.
                        </td></tr>` :
            payments.map(p => {
                const socio = users.find(s => s.id === (p.user_id || p.userId));
                const act = activities.find(a => a.id === p.activity_id);
                const dateStr = p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate().toISOString().split('T')[0] : 'â€”') : 'â€”';
                return `
                            <tr>
                                <td>\${dateStr !== 'â€”' ? UI.formatDate(dateStr) : 'â€”'}</td>
                                <td class="td-bold">\${socio?.name || 'Usuario Desconocido'}</td>
                                <td>\${act?.name || 'Actividad'}</td>
                                <td>\${p.month || p.Month || 'â€”'}</td>
                                <td>$\${Number(p.amount || p.Amount || 0).toLocaleString('es-AR')}</td>
                                <td>\${p.method === 'transfer' ? 'Transferencia' : p.method === 'digital' ? 'Mercado Pago' : 'Efectivo'}</td>
                                <td>
                                    <span class="badge \${p.status === 'approved' ? 'badge-active' : p.status === 'pending' ? 'badge-warning' : 'badge-moroso'}">
                                        \${p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                                    </span>
                                </td>
                            </tr>`;
            }).join('')}
                </tbody>
            </table>
        </div>
        
        <script>
            // Inyectamos esto para asegurarnos de que el botÃ³n de morosidad aparezca si se quiere
        </script>`;
    window.refreshIcons();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INSCRIPCIONES â€” Alumno
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderInscripcionesAlumno(container) {
    const targetUserId = State.activeProfileId || State.user.id;
    const [activities, turnos, countMap, myInscs, myStatuses] = await Promise.all([
        DB.getActivities().catch(e => { console.error(e); return []; }),
        DB.getTurnos().catch(e => { console.error(e); return []; }),
        DB.getInscripcionesCountMap().catch(e => { console.warn("Insc count denied"); return {}; }),
        DB.getMyInscripciones(targetUserId).catch(e => { console.error(e); return []; }),
        DB.getUserStatuses(targetUserId).catch(e => { console.error(e); return []; }),
    ]);

    const activeActs = activities.filter(a => a.status === 'active');
    const dayOrder = ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado', 'Domingo'];

    container.innerHTML = `
        <h2 class="view-title mb-6">InscripciÃ³n a Turnos</h2>
        <p class="text-sm text-muted mb-6">PodÃ©s inscribirte a mÃºltiples turnos de la misma actividad.</p>
        \${activeActs.length === 0 ? \`<div class="empty-state">No hay actividades disponibles.</div>\` : ''}
        <div class="list-stack">
            \${activeActs.map(act => {
        const actTurnos = turnos
            .filter(t => t.activity_id === act.id)
            .sort((a, b) => {
                const s1 = (a.slots && a.slots[0]) || a;
                const s2 = (b.slots && b.slots[0]) || b;
                const d1 = dayOrder.indexOf(s1.day);
                const d2 = dayOrder.indexOf(s2.day);
                if (d1 !== d2) return d1 - d2;
                return (s1.start || '').localeCompare(s2.start || '');
            });

        return \`
                    <div class="mb-6">
                        <h3 class="subsection-title">
                            <span class="act-indicator"></span>
                            \${act.name}
                            <div class="price-stack">
                                <span class="price-sup">Efectivo: $\${Number(act.price_cash || act.price || 0).toLocaleString('es-AR')}</span>
                                <span class="price-sup">Transf: $\${Number(act.price_digital || act.price || 0).toLocaleString('es-AR')}</span>
                            </div>
                        </h3>
                        \${actTurnos.length === 0 ? \`<div class="empty-inline">Sin turnos disponibles.</div>\` : \`
                            <div class="cards-grid-sm">
                                \${actTurnos.map(turno => {
            const used = countMap[turno.id] || 0;
            const avail = Math.max(0, turno.max_cupo - used);
            const myInsc = myInscs.find(i => i.turno_id === turno.id);
            const check = DB.canInscribe(targetUserId, turno, countMap, myInscs, myStatuses);
            return \`
                                        <div class="card turno-card \${myInsc ? 'turno-inscripto' : (!check.allowed ? 'turno-disabled' : '')}">
                                            <div class="row-between mb-2">
                                                <div class="td-bold" style="font-size:13px">
                                                    \${turno.slots ? turno.slots.map(s => \`\${s.day} \${s.start}-\${s.end}\`).join('<br>') : \`\${turno.day} \${turno.start}-\${turno.end}\`}
                                                </div>
                                            </div>
                                            <div class="cupo-info \${avail > 0 ? 'cupo-ok' : 'cupo-full'}">
                                                <i data-lucide="\${avail > 0 ? 'users' : 'user-x'}" style="width:13px;height:13px"></i>
                                                \${avail} / \${turno.max_cupo} libres
                                            </div>
                                            \${myInsc ? \`
                                                <div class="inscripto-badge mt-2">
                                                    <i data-lucide="check" style="width:12px;height:12px"></i> Inscripto
                                                </div>
                                                <button onclick="window.cancelInscripcion('\${myInsc.id}')"
                                                    class="btn btn-cancel w-full mt-3 btn-sm">
                                                    <i data-lucide="user-minus" style="width:13px;height:13px"></i> CANCELAR
                                                </button>\` : \`
                                                <button
                                                    onclick="window.inscribe('\${turno.id}','\${turno.activity_id}',\${turno.max_cupo})"
                                                    \${!check.allowed ? 'disabled' : ''}
                                                    class="btn \${check.allowed ? 'btn-primary' : 'btn-secondary'} w-full mt-3 btn-sm">
                                                    \${check.allowed ? 'INSCRIBIRME' : check.reason}
                                                </button>\`}
                                        </div>\`;
        }).join('')}
                            </div>\`}
                    </div>\`;
    }).join('')}
        </div>\`;
}

window.inscribe = async (turnoId, activityId, maxCupo) => {
    try {
        const targetUserId = State.activeProfileId || State.user.id;
        await DB.addInscripcion({
            user_id: targetUserId,
            turno_id: turnoId,
            activity_id: activityId,
        });
        UI.notify('Â¡InscripciÃ³n exitosa!');
        renderView('inscripciones');
    } catch (err) { UI.notify(err.message, 'error'); }
};

window.cancelInscripcion = (inscripcionId) => {
    UI.showModal('Solicitar Baja de Actividad', `
        <div class="confirm-danger">
            <i data-lucide="user-minus" style="width:40px;height:40px;color:var(--overdue);margin-bottom:12px"></i>
            <p>Â¿EstÃ¡s seguro de que querÃ©s solicitar la <strong>baja</strong> de esta actividad?</p>
            <p class="text-sm text-muted" style="margin-top:8px">La baja debe ser aprobada por el administrador.</p>
            <div class="form-group mt-4" style="text-align:left">
                <label class="label">Motivo (opcional)</label>
                <textarea id="baja-reason" class="input" style="height:80px" placeholder="Contanos por quÃ© dejas la actividad..."></textarea>
            </div>
        </div>
        <div class="modal-actions mt-4">
            <button class="btn btn-secondary" onclick="UI.hideModal()">Mantener</button>
            <button class="btn btn-danger" id="confirm-cancel-insc">
                <i data-lucide="send" style="width:14px;height:14px"></i> Enviar solicitud
            </button>
        </div>`);

    document.getElementById('confirm-cancel-insc').onclick = async () => {
        try {
            const reason = document.getElementById('baja-reason').value;
            await DB.requestBaja(inscripcionId, reason);
            UI.hideModal(); UI.notify('Solicitud de baja enviada.');
            renderView(State.currentView);
        } catch (err) { UI.notify(err.message, 'error'); }
    };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   REPORTE DE PAGO â€” Alumno
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderPagosAlumno(container) {
    const activities = await DB.getActivities();

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonthIndex = new Date().getMonth();

    container.innerHTML = `
        <div class="form-page">
            <div class="card form-card">
                <h2 class="view-title mb-6">Reportar Pago</h2>
                <form id="payment-form" class="form-stack">
                    <div class="form-row-2">
                        <div class="form-group">
                            <label class="label">Actividad</label>
                            <select id="pay-activity" class="input" required>
                                \${activities.map(a => `<option value="\${a.id}">\${a.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="label">Mes a Pagar</label>
                            <select id="pay-month" class="input" required>
                                \${months.map((m, i) => `<option value="\${m}" \${i === currentMonthIndex ? 'selected' : ''}>\${m}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row-2">
                        <div class="form-group">
                            <label class="label">Monto ($)</label>
                            <input type="number" id="pay-amount" class="input" placeholder="0" required>
                        </div>
                        <div class="form-group">
                            <label class="label">MÃ©todo</label>
                            <select id="pay-method" class="input" onchange="window.updatePayAmount()">
                                <option value="transfer">Transferencia</option>
                                <option value="digital">Mercado Pago</option>
                                <option value="cash">Efectivo</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="label">Comprobante (Imagen/PDF)</label>
                        <label class="upload-area" for="pay-file">
                            <i data-lucide="upload-cloud" style="width:32px;height:32px;color:var(--text-muted);margin-bottom:8px"></i>
                            <p style="font-weight:600;font-size:14px">Click para subir comprobante</p>
                            <p style="font-size:12px;color:var(--text-muted)">PNG, JPG, PDF hasta 5MB</p>
                            <input type="file" id="pay-file" accept="image/*,.pdf" style="display:none"
                                onchange="window.showFileName(this)">
                        </label>
                        <div id="file-name-display" class="file-name-display hidden"></div>
                    </div>

                    \${State.family.length > 0 ? `
                    <div class="form-group mt-4">
                        <label class="label">Â¿A quiÃ©nes corresponde este pago?</label>
                        <div style="display:flex; gap:15px; flex-wrap:wrap; background:rgba(0,0,0,0.02); padding:15px; border-radius:var(--radius-md); border:1px solid var(--border)">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
                                <input type="checkbox" class="fam-pay-check" value="\${State.user.id}" checked> 
                                <span>Yo (\${State.user.name.split(' ')[0]})</span>
                            </label>
                            \${State.family.map(f => `
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer">
                                    <input type="checkbox" class="fam-pay-check" value="\${f.id}"> 
                                    <span>\${f.name}</span>
                                </label>
                            `).join('')}
                        </div>
                        <span class="field-hint">MarcÃ¡ a todos los que cubre este Ãºnico comprobante.</span>
                    </div>
                    ` : ''}
                    <button type="submit" id="pay-submit" class="btn btn-primary w-full" style="padding:16px">
                        <i data-lucide="send"></i> ENVIAR REPORTE
                    </button>
                </form>
            </div>
        </div>
        
        <div class="mt-8">
            <h3 class="section-title">Mi Historial de Pagos</h3>
            <div class="card" style="padding:0; overflow:hidden">
                <table class="turnos-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Actividad</th>
                            <th>Periodo</th>
                            <th>Monto</th>
                            <th>MÃ©todo</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody id="member-payments-body">
                        <tr><td colspan="6" style="text-align:center;padding:20px">Cargando historial...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;

    // Cargar historial de pagos
    try {
        const [payments, activitiesList] = await Promise.all([
            DB.getPayments({ user_id: State.user.id }),
            DB.getActivities()
        ]);

        window.updatePayAmount = () => {
            const aid = document.getElementById('pay-activity').value;
            const method = document.getElementById('pay-method').value;
            const act = activitiesList.find(a => a.id === aid);
            if (act) {
                const price = (method === 'cash') ? (act.price_cash || act.price) : (act.price_digital || act.price);
                document.getElementById('pay-amount').value = price || 0;
            }
        };

        document.getElementById('pay-activity').onchange = window.updatePayAmount;
        window.updatePayAmount(); // Initial call

        const body = document.getElementById('member-payments-body');
        if (payments.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No tenÃ©s pagos registrados.</td></tr>';
        } else {
            body.innerHTML = payments.map(p => {
                const act = activitiesList.find(a => a.id === p.activity_id);
                return `
                    <tr>
                        <td>\${p.createdAt ? UI.formatDate(p.createdAt.toDate().toISOString().split('T')[0]) : 'â€”'}</td>
                        <td class="td-bold">\${act?.name || 'Actividad'}</td>
                        <td>\${p.month || 'â€”'}</td>
                        <td>$\${Number(p.amount).toLocaleString('es-AR')}</td>
                        <td>\${p.method === 'transfer' ? 'Transferencia' : p.method === 'digital' ? 'Mercado Pago' : 'Efectivo'}</td>
                        <td>
                            <span class="badge \${p.status === 'approved' ? 'badge-active' : p.status === 'pending' ? 'badge-warning' : 'badge-moroso'}">
                                \${p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                            </span>
                        </td>
                    </tr>`;
            }).join('');
        }
    } catch (err) {
        console.error(err);
    }
    window.refreshIcons();

    document.getElementById('payment-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('pay-submit');
        btn.disabled = true; btn.textContent = 'Enviando...';
        try {
            const selectedUserIds = Array.from(document.querySelectorAll('.fam-pay-check:checked')).map(cb => cb.value);
            const data = {
                user_id: State.user.id,
                user_name: State.user.name,
                family_ids: selectedUserIds.length > 0 ? selectedUserIds : [State.user.id],
                activity_id: document.getElementById('pay-activity').value,
                month: document.getElementById('pay-month').value,
                amount: parseFloat(document.getElementById('pay-amount').value),
                method: document.getElementById('pay-method').value,
                status: 'pending'
            };
            await DB.addPayment(data);
            UI.notify('Pago reportado. Pendiente de aprobaciÃ³n por el administrador.');
            navigateTo('dashboard');
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = 'ENVIAR REPORTE';
        }
    };
}

window.showFileName = (input) => {
    const display = document.getElementById('file-name-display');
    if (input.files.length > 0) {
        display.textContent = 'ðŸ“Ž ' + input.files[0].name;
        display.classList.remove('hidden');
    }
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LOGIN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function showLogin() {
    const container = document.getElementById('auth-container');
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="login-card card">
            <div class="text-center mb-8">
                <img src="Img/Punto Activo.jpeg" class="login-logo" alt="Logo Punto Activo">
                <h1 class="login-title">PUNTO ACTIVO</h1>
                <p class="login-sub">Centro de Entrenamiento</p>
            </div>
            <form id="l-form" class="form-stack">
                <div class="form-group">
                    <label class="label">Usuario</label>
                    <input type="text" id="l-user" class="input" placeholder="Tu nombre de usuario"
                        autocomplete="username" required>
                </div>
                <div class="form-group">
                    <label class="label">ContraseÃ±a</label>
                    <input type="password" id="l-pass" class="input" placeholder="ContraseÃ±a"
                        autocomplete="current-password" required>
                </div>
                <div id="l-error" class="hidden" style="background:#fff1f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;font-size:13px;color:var(--overdue);font-weight:600"></div>
                <button type="submit" id="l-submit" class="btn btn-primary w-full" style="padding:16px;font-size:15px;margin-top:4px">
                    INGRESAR
                </button>
            </form>
        </div>`;

    document.getElementById('l-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('l-submit');
        const errBox = document.getElementById('l-error');
        const usuario = document.getElementById('l-user').value.trim().toLowerCase();
        const password = document.getElementById('l-pass').value;

        btn.disabled = true; btn.textContent = 'Ingresando...';
        errBox.classList.add('hidden');

        try {
            const email = \`\${usuario}@espacioactivo.app\`;
            await auth.signInWithEmailAndPassword(email, password);
            // onAuthStateChanged se encargarÃ¡ del resto
        } catch (err) {
            const msgs = {
                'auth/user-not-found': 'Usuario no encontrado.',
                'auth/wrong-password': 'ContraseÃ±a incorrecta.',
                'auth/invalid-credential': 'Usuario o contraseÃ±a incorrectos.',
                'auth/too-many-requests': 'Demasiados intentos. EsperÃ¡ unos minutos.',
                'auth/invalid-email': 'Formato de usuario invÃ¡lido.',
                'auth/network-request-failed': 'Sin conexiÃ³n a internet.',
            };
            errBox.textContent = msgs[err.code] || 'Error al iniciar sesiÃ³n.';
            errBox.classList.remove('hidden');
            btn.disabled = false; btn.textContent = 'INGRESAR';
        }
    };
    window.refreshIcons();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MI PERFIL â€” General
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

window.showMyProfile = async () => {
    const user = State.user;
    UI.showModal('Mi Perfil', `
        <form id="profile-form" class="form-stack">
            <div class="form-group">
                <label class="label">Nombre para mostrar</label>
                <input type="text" id="p-name" class="input" value="\${user.name || ''}" required>
                <span class="field-hint">Este es el nombre que se ve en el tablero y reportes.</span>
            </div>
            
            <div class="form-group">
                <label class="label">Nombre de Usuario (Login)</label>
                <input type="text" id="p-usuario" class="input" value="\${user.usuario || ''}" required>
                <span class="field-hint">Se usa para ingresar al sistema (junto a @espacioactivo.app).</span>
            </div>

            <div id="re-login-warn" class="hidden mt-4 badge badge-warning" style="display:block; white-space:normal; line-height:1.4">
                âš ï¸ Si cambias tu Nombre de Usuario, deberÃ¡s usar el nuevo nombre la prÃ³xima vez que ingreses. TenÃ© en cuenta que para que funcione, el administrador tambiÃ©n debe actualizar tu email en la consola de Firebase.
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
                <button type="submit" id="p-submit" class="btn btn-primary">Guardar Cambios</button>
            </div>
        </form>
        <div class="mt-8 pt-6" style="border-top:1px solid var(--border)">
            <h3 class="section-title">Grupo Familiar</h3>
            <p class="text-xs text-muted mb-4">AgregÃ¡ a tus hijos o familiares para gestionar sus actividades desde tu cuenta.</p>
            
            <div id="family-list-container" class="list-stack mb-4">
                \${State.family.length === 0 ? '<p class="text-sm text-muted">No tenÃ©s familiares vinculados.</p>' : 
                    State.family.map(f => `
                        <div class="list-row" style="background:var(--bg-app); border-radius:10px; padding:10px 15px">
                            <div>
                                <div class="row-title" style="font-size:14px">\${f.name}</div>
                                <div class="text-xs text-muted">Familiar Directo</div>
                            </div>
                            <i data-lucide="user" style="width:16px; color:var(--text-muted)"></i>
                        </div>
                    `).join('')}
            </div>
            
            <button type="button" class="btn btn-ghost btn-sm w-full" style="border: 1px dashed var(--border)" onclick="window.showAddFamilyModal()">
                <i data-lucide="plus"></i> AGREGAR FAMILIAR
            </button>
        </div>`);

    const inputUser = document.getElementById('p-usuario');
    const origUser = user.usuario;
    inputUser.oninput = () => {
        const warn = document.getElementById('re-login-warn');
        if (inputUser.value.trim().toLowerCase() !== origUser.toLowerCase()) {
            warn.classList.remove('hidden');
        } else {
            warn.classList.add('hidden');
        }
    };

    document.getElementById('profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('p-submit');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const newName = document.getElementById('p-name').value.trim();
        const newUser = document.getElementById('p-usuario').value.trim().toLowerCase();

        try {
            await DB.updateUserProfile(user.id, {
                name: newName,
                usuario: newUser
            });

            // Actualizar estado local
            State.user.name = newName;
            State.user.usuario = newUser;

            UI.notify('Perfil actualizado correctamente.');
            updateUserInfo();
            UI.hideModal();

            if (newUser !== origUser) {
                UI.notify('CerrÃ¡ sesiÃ³n e ingresÃ¡ con tu nuevo usuario.', 'warning');
            }
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = 'Guardar Cambios';
        }
    };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   REPORTES PDF
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

window.generatePDFReport = async () => {
    UI.notify('Generando reporte PDF...');

    const isProfesor = State.user.role === 'profesor';
    let activityIds = null;
    if (isProfesor) {
        const allActs = await DB.getActivities();
        activityIds = allActs
            .filter(a => a.profesor_id === State.user.id || (State.user.name && a.teacher?.toLowerCase().includes(State.user.name.toLowerCase())))
            .map(a => a.id);
    }

    const [payments, users, activities, allStatuses] = await Promise.all([
        DB.getPayments({ status: 'approved', activity_ids: activityIds }),
        DB.getUsers(),
        DB.getActivities(),
        DB.getAllStatuses()
    ]);

    // Filtrar actividades para el PDF
    const filteredActivities = activities.filter(a => !activityIds || activityIds.includes(a.id));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const logoUrl = 'Img/Logo.jpg';

    // Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Primary color
    doc.text('PUNTO ACTIVO - Centro de Entrenamiento', 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Reporte de Cobranzas y Morosidad', 14, 30);
    doc.setFontSize(10);
    doc.text(\`Fecha de generaciÃ³n: \${new Date().toLocaleString()}\`, 14, 38);

    let yPos = 50;

    filteredActivities.forEach(act => {
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text(\`Actividad: \${act.name}\`, 14, yPos);
        yPos += 10;

        // Cobranzas Table
        const actPayments = payments.filter(p => p.activity_id === act.id);
        const approvedData = actPayments.map(p => {
            const u = users.find(usr => usr.id === p.user_id);
            return [
                p.date || 'â€”',
                u?.name || 'â€”',
                p.month || 'â€”',
                \`$\${p.amount.toLocaleString('es-AR')}\`,
                p.method
            ];
        });

        doc.autoTable({
            startY: yPos,
            head: [['Fecha', 'Alumno', 'Periodo', 'Monto', 'MÃ©todo']],
            body: approvedData.length > 0 ? approvedData : [['No hay cobranzas aprobadas', '', '', '', '']],
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Morosidad Table
        const actMorosos = allStatuses.filter(st => st.activity_id === act.id && st.status === 'moroso');
        const morososData = actMorosos.map(st => {
            const u = users.find(usr => usr.id === st.user_id);
            return [
                u?.name || 'â€”',
                u?.phone || 'â€”',
                st.expiration || 'â€”'
            ];
        });

        if (morososData.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(220, 38, 38); // Warning/Overdue color
            doc.text(\`Alumnos Morosos - \${act.name}\`, 14, yPos);
            yPos += 5;

            doc.autoTable({
                startY: yPos,
                head: [['Alumno', 'TelÃ©fono', 'Vencimiento']],
                body: morososData,
                theme: 'grid',
                headStyles: { fillColor: [220, 38, 38] }
            });
            yPos = doc.lastAutoTable.finalY + 15;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(22, 163, 74); // Success color
            doc.text(\`Sin alumnos morosos en \${act.name}\`, 14, yPos);
            yPos += 15;
        }
    });

    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalMorosos = allStatuses.filter(st => {
        if (activityIds && !activityIds.includes(st.activity_id)) return false;
        return st.status === 'moroso';
    }).length;

    // Resumen Final
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('RESUMEN GENERAL', 14, yPos + 10);
    doc.setFontSize(12);
    doc.text(\`Total Recaudado (Aprobado): $\${totalIncome.toLocaleString('es-AR')}\`, 14, yPos + 20);
    doc.text(\`Total Alumnos Morosos: \${totalMorosos}\`, 14, yPos + 30);

    doc.save(\`Reporte_Punto_Activo_\${new Date().toISOString().split('T')[0]}.pdf\`);
    UI.notify('Reporte generado correctamente.');
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GLOBAL LISTENERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function setupGlobalListeners() {
    document.getElementById('logout-btn').onclick = async () => {
        await auth.signOut();
    };

    document.querySelector('.user-profile').onclick = () => {
        window.showMyProfile();
    };

    const toggleSidebar = (show) => {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (show === undefined) show = !sidebar.classList.contains('mobile-open');
        
        sidebar.classList.toggle('mobile-open', show);
        overlay.classList.toggle('hidden', !show);
    };

    document.getElementById('mobile-menu-btn').onclick = () => toggleSidebar(true);
    document.getElementById('sidebar-close-btn').onclick = () => toggleSidebar(false);
    document.getElementById('sidebar-overlay').onclick = () => toggleSidebar(false);

    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const menuBtn = document.getElementById('mobile-menu-btn');
        if (window.innerWidth <= 1024 && 
            sidebar?.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) &&
            !menuBtn.contains(e.target)) {
            toggleSidebar(false);
        }
    });

    document.getElementById('modal-container').onclick = (e) => {
        if (e.target === document.getElementById('modal-container')) UI.hideModal();
    };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONFIGURACIÃ“N DESLINDE GENERAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

window.showConfigDeslinde = async () => {
    const config = await DB.getGlobalConfig('deslinde');
    UI.showModal('Configurar Deslinde General', `
        <form id="config-deslinde-form" class="form-stack">
            <p class="text-sm text-muted mb-4">Este es el PDF (Deslinde + Ficha MÃ©dica) que todos los alumnos podrÃ¡n descargar para completar.</p>
            
            <div class="form-group">
                <label class="label">Archivo PDF</label>
                <div class="\${config?.url ? 'row-between' : ''}" style="background:var(--bg-muted); padding:12px; border-radius:10px; border:1px dashed var(--border)">
                    <input type="file" id="cfg-file" class="input" accept=".pdf" style="border:none; background:transparent; padding:0">
                    \${config?.url ? `
                        <a href="\${config.url}" target="_blank" class="badge badge-active" style="text-decoration:none">
                            <i data-lucide="eye" style="width:12px; height:12px"></i> Ver Actual
                        </a>
                    ` : ''}
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
                <button type="submit" id="cfg-submit" class="btn btn-primary">Subir y Guardar</button>
            </div>
        </form>`);

    document.getElementById('config-deslinde-form').onsubmit = async (e) => {
        e.preventDefault();
        const file = document.getElementById('cfg-file').files[0];
        if (!file && !config?.url) return UI.notify('SeleccionÃ¡ un archivo.', 'error');

        const btn = document.getElementById('cfg-submit');
        btn.disabled = true; btn.textContent = 'Subiendo...';

        try {
            let url = config?.url || '';
            if (file) {
                const storageRef = storage.ref(\`config/deslinde_general_\${Date.now()}.pdf\`);
                await storageRef.put(file);
                url = await storageRef.getDownloadURL();
            }
            await DB.setGlobalConfig('deslinde', { url });
            UI.notify('ConfiguraciÃ³n guardada.');
            UI.hideModal();
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = 'Subir y Guardar';
        }
    };
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GESTIÃ“N DE BAJAS â€” Admin
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderBajasAdmin(container) {
    const isProfesor = State.user.role === 'profesor';
    let activityIds = null;
    if (isProfesor) {
        const allActs = await DB.getActivities();
        activityIds = allActs
            .filter(a => a.profesor_id === State.user.id || (State.user.name && a.teacher?.toLowerCase().includes(State.user.name.toLowerCase())))
            .map(a => a.id);
    }

    const [bajas, users, activities] = await Promise.all([
        DB.getPendingBajas(activityIds),
        DB.getUsers(),
        DB.getActivities(),
    ]);

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">Solicitudes de Baja</h2>
            <span class="badge \${bajas.length > 0 ? 'badge-warning' : 'badge-active'}">\${bajas.length} pendiente(s)</span>
        </div>
        \${bajas.length === 0 ? `
            <div class="empty-state">
                <i data-lucide="check-circle" style="width:48px;height:48px;color:var(--success);margin-bottom:16px"></i>
                <p>No hay solicitudes de baja pendientes.</p>
            </div>` :
            bajas.map(b => {
                const socio = users.find(u => u.id === b.user_id);
                const act = activities.find(a => a.id === b.activity_id);
                return `
                <div class="card mb-4">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start">
                        <div>
                            <div class="row-title">\${socio?.name || 'Socio'} (@\${socio?.usuario || 'â€”'})</div>
                            <div class="row-sub">Solicita baja de: <strong>\${act?.name || 'Actividad'}</strong></div>
                            \${b.baja_reason ? `
                                <div class="mt-4 p-3" style="background:var(--bg-muted); border-radius:8px; font-size:13px; border-left:4px solid var(--overdue)">
                                    " \${b.baja_reason} "
                                </div>
                            ` : ''}
                        </div>
                        <div class="text-xs text-muted">
                            \${b.baja_requested_at ? UI.formatDate(b.baja_requested_at.toDate().toISOString().split('T')[0]) : ''}
                        </div>
                    </div>
                    <div class="action-row mt-6">
                        <button class="btn btn-primary btn-sm" onclick="window.approveBajaBtn('\${b.id}')">
                            <i data-lucide="check"></i> Aprobar Baja
                        </button>
                        <button class="btn btn-danger-ghost btn-sm" onclick="window.rejectBajaBtn('\${b.id}')">
                            <i data-lucide="x"></i> Rechazar
                        </button>
                    </div>
                </div>`;
            }).join('')}`;
    window.refreshIcons();
}

window.approveBajaBtn = async (id) => {
    if (!confirm('Â¿Aprobar la baja? El alumno dejarÃ¡ de estar inscripto.')) return;
    try {
        await DB.approveBaja(id);
        UI.notify('Baja aprobada.');
        renderView('bajas_admin');
    } catch (err) { UI.notify(err.message, 'error'); }
};

window.rejectBajaBtn = async (id) => {
    if (!confirm('Â¿Rechazar la solicitud de baja?')) return;
    try {
        await DB.rejectBaja(id);
        UI.notify('Solicitud rechazada. La inscripciÃ³n sigue activa.');
        renderView('bajas_admin');
    } catch (err) { UI.notify(err.message, 'error'); }
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MOROSIDADES â€” Admin
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function renderMorosidades(container) {
    const isProfesor = State.user.role === 'profesor';
    let profesorId = null;
    let profesorName = null;

    if (isProfesor) {
        profesorId = State.user.id;
        profesorName = State.user.name;
    }

    const [morososList, users, activities] = await Promise.all([
        DB.getMorososList(profesorId, profesorName),
        DB.getUsers(),
        DB.getActivities(),
    ]);

    console.log("MOROSOS LIST:", morososList);
    console.log("USERS:", users.map(u => u.id));

    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">Registro de Morosidades</h2>
            <div style="display:flex; gap:10px">
                <button class="btn btn-secondary" onclick="window.generateMorososPDF()">
                    <i data-lucide="file-text"></i> REPORTE MOROSOS (PDF)
                </button>
            </div>
        </div>
        <div class="card" style="padding:0; overflow:hidden">
            <table class="turnos-table">
                <thead>
                    <tr>
                        <th>Socio</th>
                        <th>Actividad</th>
                        <th>Vencimiento</th>
                        <th>TelÃ©fono</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    \${morososList.length === 0 ? `
                        <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">
                            No hay socios morosos registrados.
                        </td></tr>` :
            morososList.map(st => {
                const socio = users.find(u => u.id === st.user_id);
                const act = activities.find(a => a.id === st.activity_id);
                return `
                            <tr>
                                <td class="td-bold">\${socio?.name || 'Desconocido'}</td>
                                <td>\${act?.name || 'Actividad'}</td>
                                <td style="color:var(--overdue); font-weight:700">\${st.expiration ? UI.formatDate(st.expiration) : 'â€”'}</td>
                                <td>\${socio?.phone || 'â€”'}</td>
                                <td>
                                    <button class="btn btn-secondary btn-xs" onclick="window.showUserFicha('\${st.user_id}')">
                                        <i data-lucide="eye" style="width:12px;height:12px"></i> Ver Ficha
                                    </button>
                                </td>
                            </tr>`;
            }).join('')}
                </tbody>
            </table>
        </div>\`;
    window.refreshIcons();
}

window.generateMorososPDF = async () => {
    UI.notify('Generando reporte morosos...');
    const isProfesor = State.user.role === 'profesor';
    let profesorId = null;
    let profesorName = null;
    if (isProfesor) {
        profesorId = State.user.id;
        profesorName = State.user.name;
    }
    const [morososList, users, activities] = await Promise.all([
        DB.getMorososList(profesorId, profesorName),
        DB.getUsers(),
        DB.getActivities()
    ]);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text('REPORTE DE MOROSIDAD', 14, 20);
    doc.autoTable({
        startY: 50,
        head: [['Alumno', 'TelÃ©fono', 'Vencimiento']],
        body: morososList.map(m => [
            users.find(u => u.id === m.user_id)?.name || 'â€”',
            users.find(u => u.id === m.user_id)?.phone || 'â€”',
            m.expiration ? UI.formatDate(m.expiration) : 'â€”'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] }
    });
    doc.save('Reporte_Morosidad.pdf');
    UI.notify('Reporte generado.');
};

async function renderAnnouncementsAdmin(container) {
    const announcements = await DB.getAnnouncements().catch(() => []);
    container.innerHTML = `
        <div class="view-header">
            <h2 class="view-title">GestiÃ³n del TablÃ³n</h2>
            <button class="btn btn-primary" onclick="showAnnouncementForm()">
                <i data-lucide="plus"></i> Nuevo Anuncio
            </button>
        </div>
        <div class="card" style="padding:16px">
            <div class="list-stack">
                \${announcements.length === 0 ? '<p class="text-muted p-4">No hay anuncios publicados.</p>' :
            announcements.map(a => `
                    <div class="admin-announcement-card">
                        <div>
                            <div class="row-title">\${a.title}</div>
                            <div class="announcement-meta">
                                <span class="announcement-tag tag-\${a.role}">\${a.role === 'all' ? 'Todos' : a.role}</span>
                                <span>Prioridad: \${a.priority === 'important' ? 'Alta' : 'Normal'}</span>
                            </div>
                        </div>
                        <div class="action-row">
                            <button class="btn btn-ghost btn-sm" onclick="showAnnouncementForm('\${a.id}')"><i data-lucide="edit-2"></i></button>
                            <button class="btn btn-ghost btn-sm text-overdue" onclick="window.deleteAnnouncement('\${a.id}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>\`).join('')}
            </div>
        </div>\`;
    window.refreshIcons();
}

window.showAnnouncementForm = async (id = null) => {
    let a = { title: '', content: '', role: 'all', priority: 'normal' };
    if (id) {
        const list = await DB.getAnnouncements();
        a = list.find(item => item.id === id);
    }
    const html = \`
        <form id="ann-form" class="form-stack">
            <div class="form-group"><label>TÃ­tulo</label><input type="text" id="ann-title" value="\${a.title}" required></div>
            <div class="form-group"><label>Contenido</label><textarea id="ann-content" rows="4" required>\${a.content}</textarea></div>
            <div class="form-row-2">
                <div class="form-group"><label>Rol</label><select id="ann-role"><option value="all">Todos</option><option value="alumno">Alumnos</option></select></div>
                <div class="form-group"><label>Prioridad</label><select id="ann-priority"><option value="normal">Normal</option><option value="important">Alta</option></select></div>
            </div>
            <div class="modal-actions"><button type="submit" class="btn btn-primary">Publicar</button></div>
        </form>\`;
    UI.showModal('Anuncio', html);
    document.getElementById('ann-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = { title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value, role: document.getElementById('ann-role').value, priority: document.getElementById('ann-priority').value };
        if (id) await DB.updateAnnouncement(id, data); else await DB.addAnnouncement(data);
        UI.hideModal(); renderView('announcements_admin');
    };
};

window.deleteAnnouncement = async (id) => { if (confirm('Â¿Eliminar?')) { await DB.deleteAnnouncement(id); renderView('announcements_admin'); } };

let currentAttendanceData = { turnoId: null, presents: new Set(), allStudents: [] };
window.showAttendanceModal = async (turnoId) => {
    const today = new Date().toISOString().split('T')[0];
    const [turnos, activities, users, inscriptions, existingAttendance] = await Promise.all([DB.getTurnos(), DB.getActivities(), DB.getUsers(), DB.getInscripciones(), DB.getAttendance(today, turnoId)]);
    const turno = turnos.find(t => t.id === turnoId);
    const activity = activities.find(a => a.id === turno.activity_id);
    const activeInscs = inscriptions.filter(i => i.activity_id === activity.id && i.status === 'active');
    const activityStudents = users.filter(u => activeInscs.some(i => i.user_id === u.id)).map(u => ({ ...u, isRegular: activeInscs.find(i => i.user_id === u.id).turno_id === turnoId }));
    currentAttendanceData = { turnoId, activityId: activity.id, date: today, presents: new Set(existingAttendance.map(a => a.user_id)), allStudents: activityStudents };
    renderAttendanceModal();
};

function renderAttendanceModal() {
    const { allStudents, presents, date } = currentAttendanceData;
    const html = \`
        <div class="attendance-list-container">
            <h3>Asistencia \${UI.formatDate(date)}</h3>
            <div id="attendance-list">\${renderAttendanceItems(allStudents)}</div>
            <button class="btn btn-primary w-full mt-4" onclick="window.saveAttendanceData()">Guardar</button>
        </div>\`;
    UI.showModal('Asistencia', html);
}

function renderAttendanceItems(students) {
    const { presents } = currentAttendanceData;
    return students.map(s => \`
        <div class="attendance-item \${presents.has(s.id) ? 'is-present' : ''}" onclick="window.toggleAttendance('\${s.id}')">
            <span>\${s.name}</span>
            <i data-lucide="\${presents.has(s.id) ? 'check-square' : 'square'}"></i>
        </div>\`).join('');
}

window.toggleAttendance = (id) => {
    if (currentAttendanceData.presents.has(id)) currentAttendanceData.presents.delete(id); else currentAttendanceData.presents.add(id);
    renderAttendanceModal();
};

window.saveAttendanceData = async () => {
    const { date, turnoId, activityId, presents, allStudents } = currentAttendanceData;
    const list = [...presents].map(id => ({ user_id: id, type: allStudents.find(u => u.id === id)?.isRegular ? 'regular' : 'extra' }));
    await DB.saveAttendance(date, turnoId, activityId, list);
    UI.hideModal(); UI.notify('Guardado');
};

document.addEventListener('DOMContentLoaded', initApp);

window.fetchBackgroundStats = async (profesorId) => {
    try {
        // Ejecutamos todo en paralelo para velocidad de "aviÃ³n"
        const [allInscs, allPayments, activities, turnos, morosos] = await Promise.all([
            DB.getInscripciones(),
            db.collection('payments').where('status', '==', 'pending').get(),
            DB.getActivities(),
            DB.getTurnos(),
            DB.getMorososList(profesorId)
        ]);

        // 1. Total Alumnos (Ãšnicos)
        const ids = profesorId ? allInscs.filter(i => i.profesor_id === profesorId).map(i => i.user_id) : allInscs.map(i => i.user_id);
        const uniqueCount = [...new Set(ids)].length;
        const elT = document.getElementById('stat-total-alumnos');
        if (elT) elT.innerText = uniqueCount;

        // 2. Cupos Libres
        const countMap = {};
        allInscs.forEach(i => {
            if (['active', 'pending_baja'].includes(i.status)) {
                countMap[i.turno_id] = (countMap[i.turno_id] || 0) + 1;
            }
        });
        
        let freeSlots = 0;
        turnos.forEach(t => {
            const used = countMap[t.id] || 0;
            freeSlots += Math.max(0, (t.max_cupo || 0) - used);
        });
        const elC = document.getElementById('stat-cupos-libres');
        if (elC) elC.innerText = freeSlots;

        // 3. Pagos Pendientes
        const elP = document.getElementById('stat-pagos-pendientes');
        if (elP) elP.innerText = allPayments.size;

        // 4. Alumnos Morosos
        const elM = document.getElementById('stat-alumnos-morosos');
        if (elM) elM.innerText = morosos.length + (morosos.length === 1 ? ' Moroso' : ' Morosos');

    } catch (err) {
        console.error("Error al cargar estadÃ­sticas de fondo:", err);
    }
}

window.showAddFamilyModal = () => {
    UI.showModal('Agregar Familiar', `
        <form id="add-family-form" class="form-stack">
            <p class="text-sm text-muted mb-4">IngresÃ¡ el nombre completo de tu familiar. No necesita email ni contraseÃ±a propia.</p>
            <div class="form-group">
                <label class="label">Nombre Completo</label>
                <input type="text" id="fam-name" class="input" placeholder="Ej: Juan Perez" required>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="window.showMyProfile()">AtrÃ¡s</button>
                <button type="submit" id="fam-submit" class="btn btn-primary">Vincular Familiar</button>
            </div>
        </form>
    `);

    document.getElementById('add-family-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('fam-submit');
        btn.disabled = true; btn.textContent = 'Vinculando...';

        const name = document.getElementById('fam-name').value.trim();
        try {
            await DB.addFamilyMember(State.user.id, { name });
            State.family = await DB.getFamilyMembers(State.user.id);
            UI.notify(\`Â¡\${name} vinculado correctamente!\`);
            window.showMyProfile(); // Volver al perfil
        } catch (err) {
            UI.notify(err.message, 'error');
            btn.disabled = false; btn.textContent = 'Vincular Familiar';
        }
    };
};

/* --- NOTIFICACIONES PUSH ----------------------------------------- */
async function initNotifications() {
    if (!("Notification" in window)) {
        console.log("Este navegador no soporta notificaciones.");
        return;
    }

    try {
        const messaging = firebase.messaging();
        
        // Pedir permiso
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            // Obtener Token
            const token = await messaging.getToken({
                vapidKey: "BF5KvXFPV1YH08ED2V7MSW7hoGEXdhOuKmScV0M-6OmaZFHr94fNa3vnrxeaAw9ZwBrPa9cGKWywkMIH8qNfTrE"
            });
            
            if (token) {
                console.log("Token de notificaciÃ³n obtenido:", token);
                await DB.saveFCMToken(State.user.id, token);
            } else {
                console.log("No se pudo obtener el token.");
            }
        } else {
            console.log("Permiso de notificaciones denegado.");
        }
    } catch (error) {
        console.error("Error al inicializar notificaciones:", error);
    }
}
