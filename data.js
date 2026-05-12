/**
 * Punto Activo "Centro de Entrenamiento" - Data & Logic Layer
 * v2.0 – Includes socios table and full mock data
 */

const DataManager = {

    // ── SOCIOS ──────────────────────────────────────────────────────
    socios: [
        { id: 's1', name: 'Sofía Ramírez', usuario: 'SofiaR', phone: '+54 9 2920 001122', role: 'socio' },
        { id: 's2', name: 'Marcos González', usuario: 'MarcosG', phone: '+54 9 2920 334455', role: 'socio' },
        { id: 's3', name: 'Laura Fernández', usuario: 'LauraF', phone: '+54 9 2920 667788', role: 'socio' },
    ],

    // ── ACTIVIDADES ──────────────────────────────────────────────────
    activities: [
        { id: 'a1', name: 'Crossfit', teacher: 'Carlos Ruiz', price: 4500, status: 'active' },
        { id: 'a2', name: 'Yoga', teacher: 'Ana Belén', price: 3800, status: 'active' },
        { id: 'a3', name: 'Spinning', teacher: 'Laura Gómez', price: 4200, status: 'active' },
        { id: 'a4', name: 'Pilates', teacher: 'Sofía Martí', price: 5000, status: 'inactive' },
    ],

    // ── TURNOS ───────────────────────────────────────────────────────
    turnos: [
        { id: 't1', activity_id: 'a1', day: 'Lunes', start: '18:00', end: '19:30', max_cupo: 20 },
        { id: 't2', activity_id: 'a1', day: 'Miércoles', start: '18:00', end: '19:30', max_cupo: 20 },
        { id: 't3', activity_id: 'a2', day: 'Martes', start: '09:00', end: '10:30', max_cupo: 15 },
        { id: 't4', activity_id: 'a3', day: 'Lunes', start: '20:00', end: '21:00', max_cupo: 12 },
        { id: 't5', activity_id: 'a3', day: 'Jueves', start: '20:00', end: '21:00', max_cupo: 12 },
    ],

    // ── INSCRIPCIONES ────────────────────────────────────────────────
    inscripciones: [
        { id: 'i1', user_id: 's1', turno_id: 't1', activity_id: 'a1', status: 'active' },
        { id: 'i2', user_id: 's1', turno_id: 't4', activity_id: 'a3', status: 'active' },
        { id: 'i3', user_id: 's2', turno_id: 't1', activity_id: 'a1', status: 'active' },
        { id: 'i4', user_id: 's3', turno_id: 't3', activity_id: 'a2', status: 'active' },
    ],

    // ── PAYMENTS ─────────────────────────────────────────────────────
    payments: [
        { id: 'p1', user_id: 's1', activity_id: 'a1', amount: 4500, method: 'cash', status: 'approved', date: '2026-02-10' },
        { id: 'p2', user_id: 's1', activity_id: 'a3', amount: 4200, method: 'transfer', status: 'pending', date: '2026-02-25' },
        { id: 'p3', user_id: 's2', activity_id: 'a1', amount: 4500, method: 'digital', status: 'pending', date: '2026-02-24' },
        { id: 'p4', user_id: 's3', activity_id: 'a2', amount: 3800, method: 'transfer', status: 'approved', date: '2026-02-15' },
    ],

    // ── USER_ACTIVITY_STATUS ─────────────────────────────────────────
    status: [
        { user_id: 's1', activity_id: 'a1', last_payment: '2026-02-10', expiration: '2026-03-10', status: 'active' },
        { user_id: 's1', activity_id: 'a3', last_payment: '2026-01-15', expiration: '2026-02-15', status: 'moroso' },
        { user_id: 's3', activity_id: 'a2', last_payment: '2026-02-15', expiration: '2026-03-15', status: 'active' },
    ],

    /* ─ REGLAS DE NEGOCIO ─────────────────────────────────────────── */

    /**
     * Cupo disponible = max_cupo – inscripciones activas.
     * REGLA: Nunca se almacena, siempre se calcula en tiempo real.
     */
    getAvailableCupo(turnoId) {
        const turno = this.turnos.find(t => t.id === turnoId);
        if (!turno) return 0;
        const active = this.inscripciones.filter(i => i.turno_id === turnoId && i.status === 'active').length;
        return Math.max(0, turno.max_cupo - active);
    },

    /**
     * REGLA: fecha_actual > fecha_vencimiento → MOROSO automático.
     */
    checkMorosidad() {
        const now = new Date();
        this.status.forEach(st => {
            const expDate = new Date(st.expiration);
            if (now > expDate && st.status !== 'moroso') {
                st.status = 'moroso';
                console.log(`[MOROSIDAD] Usuario ${st.user_id} marcado como MOROSO en actividad ${st.activity_id}`);
            }
        });
    },

    /**
     * Reglas de Inscripción:
     *  1. Sin cupo → no inscribir
     *  2. Moroso en esa actividad → no inscribir
     *  3. Ya tiene turno activo en esa actividad → no inscribir
     */
    canInscribe(userId, turnoId) {
        const turno = this.turnos.find(t => t.id === turnoId);
        if (!turno) return { allowed: false, reason: 'Turno no encontrado.' };

        if (this.getAvailableCupo(turnoId) <= 0)
            return { allowed: false, reason: 'Sin cupo disponible.' };

        const userStatus = this.status.find(st => st.user_id === userId && st.activity_id === turno.activity_id);
        if (userStatus && userStatus.status === 'moroso')
            return { allowed: false, reason: 'Socio moroso.' };

        const existing = this.inscripciones.find(i =>
            i.user_id === userId && i.activity_id === turno.activity_id && i.status === 'active'
        );
        if (existing) return { allowed: false, reason: 'Ya inscripto.' };

        return { allowed: true };
    },

    /**
     * Aprobar pago:
     *  - Marca el pago como 'approved'
     *  - Actualiza / crea el status del socio: last_payment = hoy, expiration = hoy + 1 mes, status = 'active'
     */
    approvePayment(paymentId) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return;

        payment.status = 'approved';
        const now = new Date();
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);

        let userStatus = this.status.find(st =>
            st.user_id === payment.user_id && st.activity_id === payment.activity_id
        );

        if (!userStatus) {
            this.status.push({
                user_id: payment.user_id,
                activity_id: payment.activity_id,
                status: 'active',
                last_payment: now.toISOString().split('T')[0],
                expiration: exp.toISOString().split('T')[0],
            });
        } else {
            userStatus.last_payment = now.toISOString().split('T')[0];
            userStatus.expiration = exp.toISOString().split('T')[0];
            userStatus.status = 'active';
        }
    },
};

window.DataManager = DataManager;
