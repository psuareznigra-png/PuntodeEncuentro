
window.showAnnouncementForm = async (id = null) => {
    let a = { title: '', content: '', role: 'all', priority: 'normal' };
    if (id) {
        const list = await DB.getAnnouncements();
        a = list.find(item => item.id === id);
    }
    const html = `
        <form id="ann-form" class="form-stack">
            <input type="hidden" id="ann-id" value="${id || ''}">
            <div class="form-group">
                <label>Título</label>
                <input type="text" id="ann-title" value="${a.title}" required>
            </div>
            <div class="form-group">
                <label>Mensaje</label>
                <textarea id="ann-content" rows="4" required>${a.content}</textarea>
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label>Dirigido a</label>
                    <select id="ann-role">
                        <option value="all" ${a.role === 'all' ? 'selected' : ''}>Todos</option>
                        <option value="alumno" ${a.role === 'alumno' ? 'selected' : ''}>Alumnos</option>
                        <option value="profesor" ${a.role === 'profesor' ? 'selected' : ''}>Profesores</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Prioridad</label>
                    <select id="ann-priority">
                        <option value="normal" ${a.priority === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="important" ${a.priority === 'important' ? 'selected' : ''}>Importante</option>
                    </select>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Publicar</button>
            </div>
        </form>`;
    UI.showModal(id ? 'Editar Anuncio' : 'Nuevo Anuncio', html);
    document.getElementById('ann-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            title: document.getElementById('ann-title').value,
            content: document.getElementById('ann-content').value,
            role: document.getElementById('ann-role').value,
            priority: document.getElementById('ann-priority').value,
            createdAt: new Date().toISOString()
        };
        try {
            if (id) await DB.updateAnnouncement(id, data);
            else await DB.addAnnouncement(data);
            UI.hideModal();
            UI.notify('¡Anuncio publicado!');
            renderView('announcements_admin');
        } catch (err) { UI.notify('Error al guardar', 'error'); }
    };
};

window.deleteAnnouncement = async (id) => {
    if (confirm('¿Eliminar anuncio?')) {
        await DB.deleteAnnouncement(id);
        UI.notify('Eliminado');
        renderView('announcements_admin');
    }
};

function renderAttendanceModal() {
    const { allStudents, presents, date } = currentAttendanceData;
    const html = `
        <div class="attendance-header-info">
            <div><div style="font-size:12px;font-weight:700">FECHA</div><div style="font-weight:800">${UI.formatDate(date)}</div></div>
            <div style="text-align:right"><div style="font-size:12px;font-weight:700">PRESENTES</div><div id="attendance-count" style="font-weight:800;color:var(--primary)">${presents.size}</div></div>
        </div>
        <div class="attendance-search-box"><i data-lucide="search"></i><input type="text" placeholder="Buscar..." oninput="window.filterAttendanceList(this.value)"></div>
        <div class="attendance-list" id="attendance-list-container">${renderAttendanceItems(allStudents)}</div>
        <div class="modal-actions mt-6">
            <button class="btn btn-secondary" onclick="UI.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="window.saveAttendanceData()"><i data-lucide="save"></i> Guardar</button>
        </div>`;
    UI.showModal('Tomar Asistencia', html);
}

function renderAttendanceItems(students) {
    const { presents } = currentAttendanceData;
    return students.map(s => {
        const isPresent = presents.has(s.id);
        return `
            <div class="attendance-item ${isPresent ? 'is-present' : ''}" onclick="window.toggleAttendance('${s.id}')">
                <div class="attendance-student-info">
                    <span class="attendance-student-name">${s.name}</span>
                    <span class="attendance-student-tag">${s.isRegular ? 'Regular' : 'Extra'}</span>
                </div>
                <div class="check-indicator">${isPresent ? '<i data-lucide="check"></i>' : ''}</div>
            </div>`;
    }).join('');
}

window.toggleAttendance = (id) => {
    if (currentAttendanceData.presents.has(id)) currentAttendanceData.presents.delete(id);
    else currentAttendanceData.presents.add(id);
    document.getElementById('attendance-count').innerText = currentAttendanceData.presents.size;
    const query = document.querySelector('.attendance-search-box input')?.value || '';
    window.filterAttendanceList(query);
};

window.filterAttendanceList = (query) => {
    const filtered = currentAttendanceData.allStudents.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    document.getElementById('attendance-list-container').innerHTML = renderAttendanceItems(filtered);
    window.refreshIcons();
};

async function initNotifications() {
    if (!("Notification" in window)) return;
    try {
        const messaging = firebase.messaging();
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const token = await messaging.getToken({
                vapidKey: "BF5KvXFPV1YH08ED2V7MSW7hoGEXdhOuKmScV0M-6OmaZFHr94fNa3vnrxeaAw9ZwBrPa9cGKWywkMIH8qNfTrE"
            });
            if (token) await DB.saveFCMToken(State.user.id, token);
        }
    } catch (e) { console.error("Push Error:", e); }
}
