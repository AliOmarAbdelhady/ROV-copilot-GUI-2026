(() => {
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) {
            return;
        }

        const colors = {
            success: 'border-green-500 bg-green-500/10 text-green-400',
            error: 'border-red-500 bg-red-500/10 text-red-400',
            info: 'border-blue-500 bg-blue-500/10 text-blue-400',
        };

        const toast = document.createElement('div');
        toast.className = `rounded-md border px-4 py-2.5 text-sm font-medium shadow-lg ${colors[type] || colors.info}`;
        toast.style.animation = 'fadeIn 0.2s ease-out';
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function initThemeToggle() {
        const button = document.getElementById('btn-theme-toggle');
        if (!button) {
            return;
        }

        button.addEventListener('click', () => {
            const darkEnabled = document.documentElement.classList.toggle('dark');
            localStorage.setItem('rov-theme', darkEnabled ? 'dark' : 'light');
            document.dispatchEvent(new CustomEvent('theme:changed', { detail: { darkEnabled } }));
        });
    }

    window.ROVCopilotBase = { showToast };

    document.addEventListener('DOMContentLoaded', initThemeToggle);
})();
