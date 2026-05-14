/**
 * Punto Activo "Centro de Entrenamiento"
 * Capa de datos Firestore — v3.0
 *
 * Colecciones:
 *   users               → perfiles de usuarios (admin / socio)
 *   activities          → actividades del gimnasio
 *   turnos              → horarios por actividad
 *   inscripciones       → inscripciones de socios a turnos
 *   payments            → pagos reportados
 *   user_activity_status → estado activo/moroso por socio×actividad
 */

const DB = {

    /* ══════════════════════════════════════════════════════════════
       ACTIVIDADES
    ══════════════════════════════════════════════════════════════ */

    _cache: {
        activities: null,
        turnos: null,
        lastFetch: 0
    },

    async getActivities() {
        if (this._cache.activities && (Date.now() - this._cache.lastFetch < 300000)) {
            return this._cache.activities;
        }
        const snap = await db.collection('activities').orderBy('name').get();
        this._cache.activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.lastFetch = Date.now();
        return this._cache.activities;
    },

    async addActivity(data) {
        const ref = await db.collection('activities').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return ref.id;
    },

    async updateActivity(id, data) {
        await db.collection('activities').doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    },

    async deleteActivity(id) {
        await db.collection('activities').doc(id).delete();
    },

    /* ══════════════════════════════════════════════════════════════
       TURNOS
    ══════════════════════════════════════════════════════════════ */

    async getTurnos() {
        if (this._cache.turnos && (Date.now() - this._cache.lastFetch < 300000)) {
            return this._cache.turnos;
        }
        const snap = await db.collection('turnos').get();
        this._cache.turnos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return this._cache.turnos;
    },

    async addTurno(data) {
        const ref = await db.collection('turnos').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return ref.id;
    },

    async updateTurno(id, data) {
        await db.collection('turnos').doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    },

    async deleteTurno(id) {
        await db.collection('turnos').doc(id).delete();
    },

    /* ══════════════════════════════════════════════════════════════
       INSCRIPCIONES
    ══════════════════════════════════════════════════════════════ */

    /**
     * Devuelve todas las inscripciones activas.
     * Escanea todos los usuarios para recolectar sus inscripciones (bypass de permisos).
     */
    async getInscripciones() {
        const users = await this.getUsers();
        let allInscs = [];
        users.forEach(u => {
            if (u.inscriptions && Array.isArray(u.inscriptions)) {
                u.inscriptions.forEach(i => allInscs.push({ ...i }));
            }
        });
        return allInscs;
    },

    async getInscripcionesCountMap() {
        const inscs = await this.getInscripciones();
        const map = {};
        inscs.forEach(i => {
            if (['active', 'pending_baja'].includes(i.status)) {
                map[i.turno_id] = (map[i.turno_id] || 0) + 1;
            }
        });
        return map;
    },

    async getMyInscripciones(userId) {
        const isDependent = userId.includes('_fam_');
        const parentId = isDependent ? userId.split('_fam_')[0] : userId;
        
        const snap = await db.collection('users').doc(parentId).get();
        if (!snap.exists) return [];
        
        const allInscs = snap.data().inscriptions || [];
        return allInscs.filter(i => i.user_id === userId && ['active', 'pending_baja'].includes(i.status));
    },

    async addInscripcion(data) {
        const isDependent = data.user_id.includes('_fam_');
        const parentId = isDependent ? data.user_id.split('_fam_')[0] : data.user_id;
        
        const inscId = `insc_${Date.now()}`;
        const newInsc = {
            ...data,
            id: inscId,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        await db.collection('users').doc(parentId).update({
            inscriptions: firebase.firestore.FieldValue.arrayUnion(newInsc)
        });
        return inscId;
    },

    async cancelInscripcion(inscId) {
        const users = await this.getUsers();
        for (const u of users) {
            if (u.inscriptions) {
                const idx = u.inscriptions.findIndex(i => i.id === inscId);
                if (idx !== -1) {
                    const parentId = u.isDependent ? u.parent_id : u.id;
                    const newInscs = [...u.inscriptions];
                    newInscs[idx].status = 'cancelled';
                    newInscs[idx].cancelledAt = new Date().toISOString();
                    await db.collection('users').doc(parentId).update({ inscriptions: newInscs });
                    return;
                }
            }
        }
    },

    async requestBaja(inscId, reason) {
        const users = await this.getUsers();
        for (const u of users) {
            if (u.inscriptions) {
                const idx = u.inscriptions.findIndex(i => i.id === inscId);
                if (idx !== -1) {
                    const parentId = u.isDependent ? u.parent_id : u.id;
                    const newInscs = [...u.inscriptions];
                    newInscs[idx].status = 'pending_baja';
                    newInscs[idx].baja_reason = reason || '';
                    newInscs[idx].baja_requested_at = new Date().toISOString();
                    await db.collection('users').doc(parentId).update({ inscriptions: newInscs });
                    return;
                }
            }
        }
    },

    async getPendingBajas(activityIds = null) {
        const inscs = await this.getInscripciones();
        let list = inscs.filter(i => i.status === 'pending_baja');
        if (activityIds && activityIds.length > 0) {
            list = list.filter(i => activityIds.includes(i.activity_id));
        }
        return list;
    },

    async approveBaja(inscId) {
        const users = await this.getUsers();
        for (const u of users) {
            if (u.inscriptions) {
                const idx = u.inscriptions.findIndex(i => i.id === inscId);
                if (idx !== -1) {
                    const parentId = u.isDependent ? u.parent_id : u.id;
                    const newInscs = [...u.inscriptions];
                    newInscs[idx].status = 'cancelled';
                    newInscs[idx].status_baja = 'approved';
                    newInscs[idx].baja_approved_at = new Date().toISOString();
                    
                    await db.collection('users').doc(parentId).update({ inscriptions: newInscs });
                    return;
                }
            }
        }
    },

    async rejectBaja(inscId) {
        const users = await this.getUsers();
        for (const u of users) {
            if (u.inscriptions) {
                const idx = u.inscriptions.findIndex(i => i.id === inscId);
                if (idx !== -1) {
                    const parentId = u.isDependent ? u.parent_id : u.id;
                    const newInscs = [...u.inscriptions];
                    newInscs[idx].status = 'active';
                    newInscs[idx].status_baja = 'rejected';
                    newInscs[idx].baja_rejected_at = new Date().toISOString();
                    
                    await db.collection('users').doc(parentId).update({ inscriptions: newInscs });
                    return;
                }
            }
        }
    },

    /* ══════════════════════════════════════════════════════════════
       CONFIGURACIÓN GLOBAL
    ══════════════════════════════════════════════════════════════ */

    async getGlobalConfig(key) {
        const doc = await db.collection('_config').doc(key).get();
        return doc.exists ? doc.data() : null;
    },

    async setGlobalConfig(key, data) {
        await db.collection('_config').doc(key).set({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    },

    /**
     * Verifica si un usuario puede inscribirse en un turno.
     * Recibe datos pre-cargados para evitar lecturas extra.
     */
    canInscribe(userId, turno, countMap, myInscs, myStatuses) {
        // 1. Cupo
        const used = countMap[turno.id] || 0;
        const avail = Math.max(0, turno.max_cupo - used);
        if (avail <= 0) return { allowed: false, reason: 'Sin cupo.' };

        // 2. ¿Moroso en esa actividad?
        const st = myStatuses.find(s => s.activity_id === turno.activity_id);
        if (st && st.status === 'moroso') return { allowed: false, reason: 'Deuda pendiente.' };

        // 3. ¿Ya inscripto en ESTE turno específico?
        const exists = myInscs.find(i => i.turno_id === turno.id);
        if (exists) return { allowed: false, reason: 'Ya inscripto.' };

        return { allowed: true };
    },

    /* ══════════════════════════════════════════════════════════════
       PAGOS
    ══════════════════════════════════════════════════════════════ */

    async getPayments(filters = {}) {
        let query = db.collection('payments');

        if (filters.status) {
            query = query.where('status', '==', filters.status.toLowerCase());
        }
        if (filters.user_id) {
            query = query.where('user_id', '==', filters.user_id);
        }
        // Note: activity_ids filter might require composite indices in Firestore.
        // We'll apply it in JS if status/user_id are already filtering significantly,
        // but if no other filters exist, Alumnos might fail here if they try to read all.
        // However, Alumnos usually call this with user_id, which is safe.

        const snap = await query.get();
        let list = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                status: (data.status || data.Status || 'pending').toLowerCase(),
                user_id: data.user_id || data.User_id || data.userId,
                activity_id: data.activity_id
            };
        });

        if (filters.activity_ids) {
            list = list.filter(p => filters.activity_ids.includes(p.activity_id));
        }

        return list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    },

    async addPayment(data) {
        const ref = await db.collection('payments').add({
            ...data,
            // Soporte para pagos grupales: data.family_ids (array de ids de familiares beneficiados)
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return ref.id;
    },

    async approvePayment(paymentId) {
        const payRef = db.collection('payments').doc(paymentId);
        const paySnap = await payRef.get();
        if (!paySnap.exists) throw new Error('Pago no encontrado.');

        const pay = paySnap.data();

        // Calcular vencimiento: hoy + 1 mes
        const now = new Date();
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);

        const batch = db.batch();

        // 1. Actualizar pago
        batch.update(payRef, {
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Actualizar / crear estado del socio (o socios familiares beneficiados)
        const userIds = pay.family_ids || [pay.user_id];
        userIds.forEach(uid => {
            const statusId = `${uid}_${pay.activity_id}`;
            const statusRef = db.collection('user_activity_status').doc(statusId);
            batch.set(statusRef, {
                user_id: uid,
                activity_id: pay.activity_id,
                status: 'active',
                last_payment: now.toISOString().split('T')[0],
                expiration: exp.toISOString().split('T')[0],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });

        await batch.commit();
    },

    async rejectPayment(paymentId) {
        await db.collection('payments').doc(paymentId).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    },

    /* ══════════════════════════════════════════════════════════════
       USUARIOS / SOCIOS
    ══════════════════════════════════════════════════════════════ */

    async getUsers() {
        const snap = await db.collection('users').get();
        let users = [];
        snap.docs.forEach(d => {
            const data = d.data();
            const mainUser = {
                id: d.id,
                ...data,
                name: data.name || data.Name || '',
                role: (data.role || data.Role || 'alumno').toLowerCase(),
                usuario: data.usuario || data.Usuario || ''
            };
            users.push(mainUser);
            
            // Si tiene familiares, los sumamos como usuarios independientes para la administración
            if (data.family_members && Array.isArray(data.family_members)) {
                data.family_members.forEach(f => {
                    users.push({ 
                        ...f, 
                        isDependent: true,
                        name: f.name || '',
                        role: 'alumno'
                    });
                });
            }
        });
        return users.sort((a, b) => a.name.localeCompare(b.name));
    },

    async getUserProfile(uid) {
        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) return null;
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            name: data.name || data.Name || '',
            role: data.role || data.Role || 'alumno',
            usuario: data.usuario || data.Usuario || ''
        };
    },

    /* ══════════════════════════════════════════════════════════════
       CUENTAS FAMILIARES (DEPENDIENTES)
    ══════════════════════════════════════════════════════════════ */

    async getFamilyMembers(parentId) {
        const snap = await db.collection('users').doc(parentId).get();
        if (!snap.exists) return [];
        return snap.data().family_members || [];
    },

    async addFamilyMember(parentId, userData) {
        const famId = `${parentId}_fam_${Date.now()}`;
        const member = {
            ...userData,
            id: famId,
            parent_id: parentId,
            role: 'alumno',
            createdAt: new Date().toISOString()
        };
        
        await db.collection('users').doc(parentId).update({
            family_members: firebase.firestore.FieldValue.arrayUnion(member)
        });
        return famId;
    },

    async updateUserProfile(uid, data) {
        await db.collection('users').doc(uid).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    },

    async saveFCMToken(uid, token) {
        if (!uid || !token) return;
        await db.collection('users').doc(uid).update({
            fcm_tokens: firebase.firestore.FieldValue.arrayUnion(token),
            last_token_update: new Date().toISOString()
        });
    },

    /**
     * Crea cuenta Firebase Auth del usuario usando la app secundaria
     */
    async createUserAccount(userData, password) {
        const email = `${userData.usuario.toLowerCase()}@espacioactivo.app`;
        const userCred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;

        await db.collection('users').doc(uid).set({
            name: userData.name,
            dni: userData.dni || '',
            personal_email: userData.personal_email || '',
            usuario: userData.usuario.toLowerCase(),
            phone: userData.phone || '',
            emergency_phone: userData.emergency_phone || '',
            emergency_name: userData.emergency_name || '',
            emergency_relationship: userData.emergency_relationship || '',
            waiver_url: userData.waiver_url || '',
            role: userData.role || 'alumno',
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        await secondaryAuth.signOut();
        return uid;
    },

    /* ══════════════════════════════════════════════════════════════
       ESTADO MOROSIDAD
    ══════════════════════════════════════════════════════════════ */

    async getUserStatuses(userId) {
        const snap = await db.collection('user_activity_status')
            .where('user_id', '==', userId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getAllStatuses() {
        const snap = await db.collection('user_activity_status').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /**
     * REGLA: si fecha_actual > fecha_vencimiento → marcar MOROSO.
     * Se ejecuta al login del socio.
     */
    async checkAndUpdateMorosidad(userId) {
        const statuses = await this.getUserStatuses(userId);
        const now = new Date();
        const batch = db.batch();
        let changed = false;

        const nowStr = now.toISOString().split('T')[0];
        statuses.forEach(st => {
            if (!st.expiration) return;
            if (nowStr > st.expiration && st.status !== 'moroso') {
                const ref = db.collection('user_activity_status').doc(st.id);
                batch.update(ref, { status: 'moroso' });
                changed = true;
            }
        });

        if (changed) {
            try {
                await batch.commit();
            } catch (e) {
                console.warn("No se pudo actualizar morosidad automáticamente (falta de permisos).", e);
            }
        }
        return await this.getUserStatuses(userId);
    },


    /* ══════════════════════════════════════════════════════════════
       ANUNCIOS (Almacenados en _config para evitar bloqueos)
    ══════════════════════════════════════════════════════════════ */

    async getAnnouncements() {
        const doc = await db.collection('_config').doc('announcements').get();
        if (!doc.exists) return [];
        const data = doc.data();
        return (data.list || []).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    },

    async addAnnouncement(ann) {
        const docRef = db.collection('_config').doc('announcements');
        const snap = await docRef.get();
        let list = [];
        if (snap.exists) list = snap.data().list || [];

        const newAnn = {
            id: 'ann_' + Date.now(),
            ...ann,
            createdAt: { seconds: Math.floor(Date.now() / 1000) } // Simulación de timestamp
        };

        list.push(newAnn);
        await docRef.set({ list }, { merge: true });
        return newAnn.id;
    },

    async deleteAnnouncement(id) {
        const docRef = db.collection('_config').doc('announcements');
        const snap = await docRef.get();
        if (!snap.exists) return;

        const list = (snap.data().list || []).filter(a => a.id !== id);
        await docRef.set({ list }, { merge: true });
    },

    async updateAnnouncement(id, ann) {
        const docRef = db.collection('_config').doc('announcements');
        const snap = await docRef.get();
        if (!snap.exists) return;

        const list = (snap.data().list || []).map(a => {
            if (a.id === id) return { ...a, ...ann, updatedAt: Date.now() };
            return a;
        });
        await docRef.set({ list }, { merge: true });
    },


    /* ══════════════════════════════════════════════════════════════
       ASISTENCIA
    ══════════════════════════════════════════════════════════════ */

    /**
     * Obtiene la asistencia de un turno en una fecha específica
     */
    async getAttendance(date, turnoId) {
        try {
            const snap = await db.collection('attendance')
                .where('date', '==', date)
                .where('turno_id', '==', turnoId)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error getAttendance:", e);
            return [];
        }
    },

    /**
     * Guarda la asistencia de un grupo de alumnos
     */
    async saveAttendance(date, turnoId, activityId, presents) {
        // presents: Array de { user_id, type: 'regular'|'extra' }
        const batch = db.batch();
        
        // Primero borramos la asistencia previa de ese turno/día para no duplicar
        const existing = await db.collection('attendance')
            .where('date', '==', date)
            .where('turno_id', '==', turnoId)
            .get();
            
        existing.docs.forEach(doc => batch.delete(doc.ref));

        // Insertamos los nuevos presentes
        presents.forEach(p => {
            const ref = db.collection('attendance').doc();
            batch.set(ref, {
                date,
                turno_id: turnoId,
                activity_id: activityId,
                user_id: p.user_id,
                type: p.type,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    },

    /* ══════════════════════════════════════════════════════════════
       DASHBOARD STATS (admin)
    ══════════════════════════════════════════════════════════════ */

    async getQuickStats(profesorId = null, profesorName = null) {
        // Traemos solo lo esencial para que el panel aparezca rápido
        const promises = [
            db.collection('activities').get().catch(() => ({ docs: [] })),
            db.collection('turnos').get().catch(() => ({ docs: [] })),
        ];
        const [actSnap, turnosSnap] = await Promise.all(promises);
        return {
            activities: actSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            turnos: turnosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };
    },

    async getCounter(collection, field = null, value = null) {
        let query = db.collection(collection);
        if (field && value) query = query.where(field, '==', value);
        const snap = await query.get().catch(() => ({ size: 0 }));
        return snap.size;
    },


    async getMorososList(profesorId = null, profesorName = null) {
        console.log("DB: getMorososList - Start...");
        
        // 1. Cargamos todo en paralelo para velocidad máxima
        const [allInscs, allStatuses, allPayments, activities] = await Promise.all([
            this.getInscripciones(),
            this.getAllStatuses(),
            db.collection('payments').where('status', '==', 'pending').get(),
            this.getActivities()
        ]);

        let myActIds = null;
        if (profesorId) {
            myActIds = activities
                .filter(a => a.profesor_id === profesorId || (profesorName && a.teacher === profesorName))
                .map(a => a.id);
        }

        const nowStr = new Date().toISOString().split('T')[0];
        
        // Mapas para búsqueda O(1)
        const statusMap = new Map();
        allStatuses.forEach(s => statusMap.set(`${s.user_id}_${s.activity_id}`, s));

        const pendingPaymentSet = new Set();
        allPayments.docs.forEach(d => {
            const p = d.data();
            const uid = p.user_id || p.userId;
            pendingPaymentSet.add(`${uid}_${p.activity_id}`);
        });

        const morosos = [];
        const processedPairs = new Set();

        allInscs.forEach(insc => {
            // Filtro por profesor si aplica
            if (myActIds && !myActIds.includes(insc.activity_id)) return;

            const pairKey = `${insc.user_id}_${insc.activity_id}`;
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);

            // Si tiene pago pendiente de aprobación, NO es moroso todavía
            if (pendingPaymentSet.has(pairKey)) return;

            const st = statusMap.get(pairKey);
            let isMoroso = false;

            if (!st) {
                // Si no tiene registro de estado, asumimos deuda si tiene inscripción activa
                isMoroso = true;
            } else {
                const s = (st.status || '').toLowerCase();
                const exp = st.expiration;
                if (s === 'moroso' || (s === 'active' && exp && exp < nowStr)) {
                    isMoroso = true;
                }
            }

            if (isMoroso) {
                morosos.push({
                    user_id: insc.user_id,
                    activity_id: insc.activity_id,
                    expiration: st?.expiration || null
                });
            }
        });

        return morosos;
    },

    async getAllStatuses() {
        const snap = await db.collection('user_activity_status').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
};

window.DB = DB;
