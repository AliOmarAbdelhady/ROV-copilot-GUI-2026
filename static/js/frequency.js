const FrequencyMission = (() => {
    function parseCount(value) {
        const normalized = String(value ?? '').trim();
        if (normalized === '') {
            return 0;
        }

        const parsed = Number(normalized);
        if (!Number.isInteger(parsed) || parsed < 0) {
            return 0;
        }
        return parsed;
    }

    function formatFrequency(value) {
        if (!Number.isFinite(value) || value <= 0) {
            return '0';
        }
        return value.toFixed(9).replace(/\.?0+$/, '');
    }

    function formatPercent(value) {
        if (!Number.isFinite(value) || value <= 0) {
            return '0%';
        }
        return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
    }

    function tokenizeCounts(text) {
        return String(text)
            .split(/[\s,;]+/)
            .map((token) => token.trim())
            .filter((token) => /^\d+$/.test(token))
            .map((token) => Number(token));
    }

    function focusInput(inputs, index) {
        if (index < 0 || index >= inputs.length) {
            return;
        }
        inputs[index].focus();
        inputs[index].select();
    }

    function applyCounts(inputs, counts, startIndex = 0) {
        counts.forEach((count, offset) => {
            const input = inputs[startIndex + offset];
            if (input) {
                input.value = count;
            }
        });
    }

    function updateView(inputs) {
        const outputs = document.querySelectorAll('[data-frequency-output]');
        const percents = document.querySelectorAll('[data-frequency-percent]');
        const lineOutput = document.getElementById('frequency-output-lines');
        const totalSeen = document.getElementById('total-seen');
        const rowsFilled = document.getElementById('rows-filled');

        const counts = inputs.map((input) => parseCount(input.value));
        const total = counts.reduce((sum, count) => sum + count, 0);
        const filled = inputs.filter((input) => input.value.trim() !== '').length;
        const formattedLines = [];

        counts.forEach((count, index) => {
            const frequency = total > 0 ? count / total : 0;
            const formattedFrequency = formatFrequency(frequency);
            outputs[index].textContent = formattedFrequency;
            percents[index].textContent = formatPercent(frequency);
            formattedLines.push(formattedFrequency);
        });

        totalSeen.textContent = total;
        rowsFilled.textContent = `${filled} / ${inputs.length}`;
        lineOutput.value = formattedLines.join('\n');
    }

    function copyOutput() {
        const lineOutput = document.getElementById('frequency-output-lines');
        if (!navigator.clipboard) {
            lineOutput.select();
            document.execCommand('copy');
            window.ROVCopilotBase?.showToast('Frequency output copied', 'success');
            return;
        }

        navigator.clipboard.writeText(lineOutput.value)
            .then(() => window.ROVCopilotBase?.showToast('Frequency output copied', 'success'))
            .catch(() => window.ROVCopilotBase?.showToast('Unable to copy output', 'error'));
    }

    function init() {
        const inputs = Array.from(document.querySelectorAll('[data-frequency-input]'));
        if (inputs.length === 0) {
            return;
        }

        const quickCounts = document.getElementById('quick-counts');
        const applyQuickCountsButton = document.getElementById('btn-apply-quick-counts');
        const clearButton = document.getElementById('btn-clear-frequency');
        const copyButton = document.getElementById('btn-copy-frequency-lines');

        inputs.forEach((input, index) => {
            input.addEventListener('focus', () => input.select());
            input.addEventListener('input', () => updateView(inputs));
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusInput(inputs, index + 1);
                }
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusInput(inputs, index - 1);
                }
            });
            input.addEventListener('paste', (event) => {
                const pastedCounts = tokenizeCounts(event.clipboardData?.getData('text'));
                if (pastedCounts.length <= 1) {
                    return;
                }

                event.preventDefault();
                applyCounts(inputs, pastedCounts, index);
                updateView(inputs);
                focusInput(inputs, Math.min(index + pastedCounts.length, inputs.length - 1));
            });
        });

        applyQuickCountsButton.addEventListener('click', () => {
            const counts = tokenizeCounts(quickCounts.value);
            if (counts.length === 0) {
                window.ROVCopilotBase?.showToast('Paste at least one valid count', 'error');
                return;
            }

            applyCounts(inputs, counts);
            updateView(inputs);
            focusInput(inputs, Math.min(counts.length, inputs.length - 1));
            window.ROVCopilotBase?.showToast('Counts applied', 'success');
        });

        clearButton.addEventListener('click', () => {
            inputs.forEach((input) => {
                input.value = '';
            });
            quickCounts.value = '';
            updateView(inputs);
            focusInput(inputs, 0);
        });

        copyButton.addEventListener('click', copyOutput);

        updateView(inputs);
        focusInput(inputs, 0);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    FrequencyMission.init();
});
