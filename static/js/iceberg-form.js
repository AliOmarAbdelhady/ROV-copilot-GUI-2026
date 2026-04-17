const ROVCopilotForm = (() => {
    function init(onSubmit) {
        const form = document.getElementById('form-add-iceberg');
        const toggleBtn = document.getElementById('btn-toggle-form');
        const cancelBtn = document.getElementById('btn-cancel-form');
        const formContainer = document.getElementById('iceberg-form');

        toggleBtn.addEventListener('click', () => {
            formContainer.classList.toggle('hidden');
            if (!formContainer.classList.contains('hidden')) {
                form.querySelector('input[name="name"]').focus();
            }
        });

        cancelBtn.addEventListener('click', () => {
            formContainer.classList.add('hidden');
            form.reset();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: form.name.value,
                latitude: parseFloat(form.latitude.value),
                longitude: parseFloat(form.longitude.value),
                heading: parseFloat(form.heading.value),
                keel_depth_m: parseFloat(form.keel_depth_m.value),
            };

            try {
                const resp = await fetch('/api/icebergs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (!resp.ok) {
                    const err = await resp.json();
                    showToast(err.errors?.join(', ') || 'Failed to add iceberg', 'error');
                    return;
                }

                form.reset();
                formContainer.classList.add('hidden');
                showToast(`${data.name} added successfully`, 'success');
                if (onSubmit) onSubmit();
            } catch (err) {
                showToast('Network error: ' + err.message, 'error');
            }
        });
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
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

    return { init, showToast };
})();
