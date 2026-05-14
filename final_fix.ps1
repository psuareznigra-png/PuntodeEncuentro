$headerLines = Get-Content -Path "app.js" -TotalCount 2583
$header = $headerLines -join "`r`n"
$footer = @'

                    <tr>
                        <th>Socio</th>
                        <th>Actividad</th>
                        <th>Vencimiento</th>
                        <th>Teléfono</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${morososList.length === 0 ? `
                        <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">
                            No hay socios morosos registrados.
                        </td></tr>` :
            morososList.map(st => {
                const socio = users.find(u => u.id === st.user_id);
                const act = activities.find(a => a.id === st.activity_id);
                return `
                            <tr>
                                <td class="td-bold">${socio?.name || 'Desconocido'}</td>
                                <td>${act?.name || 'Actividad'}</td>
                                <td style="color:var(--overdue); font-weight:700">${st.expiration ? UI.formatDate(st.expiration) : '—'}</td>
                                <td>${socio?.phone || '—'}</td>
                                <td>
                                    <button class="btn btn-secondary btn-xs" onclick="window.showUserFicha('${st.user_id}')">
                                        <i data-lucide="eye" style="width:12px;height:12px"></i> Ver Ficha
                                    </button>
                                </td>
                            </tr>`;
            }).join('')}
                </tbody>
            </table>
        </div>`;
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
        head: [['Alumno', 'Teléfono', 'Vencimiento']],
        body: morososList.map(m => [
            users.find(u => u.id === m.user_id)?.name || '—',
            users.find(u => u.id === m.user_id)?.phone || '—',
            m.expiration ? UI.formatDate(m.expiration) : '—'
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
            <h2 class="view-title">Gestión del Tablón</h2>
            <button class="btn btn-primary" onclick="showAnnouncementForm()">
                <i data-lucide="plus"></i> Nuevo Anuncio
            </button>
        </div>
        <div class="card" style="padding:16px">
            <div class="list-stack">
                ${announcements.length === 0 ? '<p class="text-muted p-4">No hay anuncios publicados.</p>' :
            announcements.map(a => `
                    <div class="admin-announcement-card">
                        <div>
                            <div class="row-title">${a.title}</div>
                            <div class="announcement-meta">
                                <span class="announcement-tag tag-${a.role}">${a.role === 'all' ? 'Todos' : a.role}</span>
                                <span>Prioridad: ${a.priority === 'important' ? 'Alta' : 'Normal'}</span>
                            </div>
                        </div>
                        <div class="action-row">
                            <button class="btn btn-ghost btn-sm" onclick="showAnnouncementForm('${a.id}')"><i data-lucide="edit-2"></i></button>
                            <button class="btn btn-ghost btn-sm text-overdue" onclick="window.deleteAnnouncement('${a.id}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>`;
    window.refreshIcons();
}

window.showAnnouncementForm = async (id = null) => {
    let a = { title: '', content: '', role: 'all', priority: 'normal' };
    if (id) {
        const list = await DB.getAnnouncements();
        a = list.find(item => item.id === id);
    }
    const html = `
        <form id="ann-form" class="form-stack">
            <div class="form-group"><label>Título</label><input type="text" id="ann-title" value="${a.title}" required></div>
            <div class="form-group"><label>Contenido</label><textarea id="ann-content" rows="4" required>${a.content}</textarea></div>
            <div class="form-row-2">
                <div class="form-group"><label>Rol</label><select id="ann-role"><option value="all">Todos</option><option value="alumno">Alumnos</option></select></div>
                <div class="form-group"><label>Prioridad</label><select id="ann-priority"><option value="normal">Normal</option><option value="important">Alta</option></select></div>
            </div>
            <div class="modal-actions"><button type="submit" class="btn btn-primary">Publicar</button></div>
        </form>`;
    UI.showModal('Anuncio', html);
    document.getElementById('ann-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = { title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value, role: document.getElementById('ann-role').value, priority: document.getElementById('ann-priority').value };
        if (id) await DB.updateAnnouncement(id, data); else await DB.addAnnouncement(data);
        UI.hideModal(); renderView('announcements_admin');
    };
};

window.deleteAnnouncement = async (id) => { if (confirm('¿Eliminar?')) { await DB.deleteAnnouncement(id); renderView('announcements_admin'); } };

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
    const html = `
        <div class="attendance-list-container">
            <h3>Asistencia ${UI.formatDate(date)}</h3>
            <div id="attendance-list">${renderAttendanceItems(allStudents)}</div>
            <button class="btn btn-primary w-full mt-4" onclick="window.saveAttendanceData()">Guardar</button>
        </div>`;
    UI.showModal('Asistencia', html);
}

function renderAttendanceItems(students) {
    const { presents } = currentAttendanceData;
    return students.map(s => `
        <div class="attendance-item ${presents.has(s.id) ? 'is-present' : ''}" onclick="window.toggleAttendance('${s.id}')">
            <span>${s.name}</span>
            <i data-lucide="${presents.has(s.id) ? 'check-square' : 'square'}"></i>
        </div>`).join('');
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
    const [allInscs, allPayments, morosos] = await Promise.all([DB.getInscripciones(), db.collection('payments').where('status', '==', 'pending').get(), DB.getMorososList(profesorId)]);
    const count = [...new Set(allInscs.map(i => i.user_id))].length;
    if (document.getElementById('stat-total-alumnos')) document.getElementById('stat-total-alumnos').innerText = count;
    if (document.getElementById('stat-pagos-pendientes')) document.getElementById('stat-pagos-pendientes').innerText = allPayments.size;
    if (document.getElementById('stat-alumnos-morosos')) document.getElementById('stat-alumnos-morosos').innerText = morosos.length;
};

window.showAddFamilyModal = () => {
    UI.showModal('Agregar Familiar', `
        <form id="add-family-form" class="form-stack">
            <input type="text" id="fam-name" class="input" placeholder="Nombre completo" required>
            <button type="submit" class="btn btn-primary w-full mt-4">Vincular</button>
        </form>`);
    document.getElementById('add-family-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('fam-name').value.trim();
        await DB.addFamilyMember(State.user.id, { name });
        State.family = await DB.getFamilyMembers(State.user.id);
        UI.hideModal(); window.showMyProfile();
    };
};

async function initNotifications() {
    if (!("Notification" in window)) return;
    try {
        const messaging = firebase.messaging();
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const token = await messaging.getToken({ vapidKey: "BF5KvXFPV1YH08ED2V7MSW7hoGEXdhOuKmScV0M-6OmaZFHr94fNa3vnrxeaAw9ZwBrPa9cGKWywkMIH8qNfTrE" });
            if (token) await DB.saveFCMToken(State.user.id, token);
        }
    } catch (error) { console.error("Notification Init Error:", error); }
}
'@
$header + $footer | Set-Content -Path "app.js" -Encoding utf8
