/**
 * Punto Activo "Centro de Entrenamiento"
 * Real toast notifications + modal helpers
 */

const UI = {

    /* ── MODAL ─────────────────────────────────────────────────────── */

    showModal(title, contentHtml) {
        const modal = document.getElementById('modal-container');
        const modalContent = document.getElementById('modal-content');

        modalContent.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button onclick="UI.hideModal()" class="modal-close-btn" aria-label="Cerrar">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">
                ${contentHtml}
            </div>
        `;

        modal.classList.remove('hidden');
        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modalContent.classList.remove('modal-enter');
                modalContent.classList.add('modal-visible');
            });
        });
        modalContent.classList.add('modal-enter');

        window.refreshIcons();
    },

    hideModal() {
        const modal = document.getElementById('modal-container');
        const modalContent = document.getElementById('modal-content');

        modalContent.classList.remove('modal-visible');
        modalContent.classList.add('modal-enter');

        setTimeout(() => {
            modal.classList.add('hidden');
            modalContent.classList.remove('modal-enter');
        }, 250);
    },

    /* ── TOAST NOTIFICATIONS ────────────────────────────────────────── */

    notify(message, type = 'success') {
        // Ensure toast container exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
        const icon = icons[type] || 'check-circle';

        toast.innerHTML = `
            <i data-lucide="${icon}" style="width:18px;height:18px;flex-shrink:0"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        window.refreshIcons();

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('toast-show'));
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    },

    /* ── HELPERS ────────────────────────────────────────────────────── */

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr + 'T00:00:00'); // avoid timezone shift
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    },
};

window.UI = UI;
