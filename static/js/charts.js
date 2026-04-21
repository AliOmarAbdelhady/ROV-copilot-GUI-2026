const ROVCopilotCharts = (() => {
    let pieChart = null;
    let barChart = null;

    const threatColors = {
        red: '#ef4444',
        yellow: '#eab308',
        green: '#22c55e',
    };

    function isDark() {
        return document.documentElement.classList.contains('dark');
    }

    function textColor() {
        return isDark() ? '#94a3b8' : '#64748b';
    }

    function gridColor() {
        return isDark() ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.1)';
    }

    function init() {
        const ctxPie = document.getElementById('chart-pie').getContext('2d');
        pieChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['Red', 'Yellow', 'Green'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [threatColors.red, threatColors.yellow, threatColors.green],
                    borderWidth: 0,
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor(),
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                            font: { size: 12 },
                        },
                    },
                },
                cutout: '65%',
            },
        });

        const ctxBar = document.getElementById('chart-bar').getContext('2d');
        barChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Red', data: [], backgroundColor: threatColors.red, borderRadius: 3 },
                    { label: 'Yellow', data: [], backgroundColor: threatColors.yellow, borderRadius: 3 },
                    { label: 'Green', data: [], backgroundColor: threatColors.green, borderRadius: 3 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor(),
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                            font: { size: 12 },
                        },
                    },
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: textColor(), font: { size: 11 } },
                        grid: { display: false },
                    },
                    y: {
                        stacked: true,
                        ticks: { color: textColor(), stepSize: 1, font: { size: 11 } },
                        grid: { color: gridColor() },
                    },
                },
            },
        });
    }

    function update(summary) {
        if (!summary) return;

        // Update pie chart
        const total = summary.total;
        pieChart.data.datasets[0].data = [total.red, total.yellow, total.green];
        pieChart.options.plugins.legend.labels.color = textColor();
        pieChart.update();

        // Update bar chart
        const perPlatform = summary.per_platform;
        const platformOrder = ['hibernia', 'hebron', 'sea_rose', 'terra_nova'];
        const labels = platformOrder.map(id => perPlatform[id]?.name || id);
        const redData = platformOrder.map(id => perPlatform[id]?.red || 0);
        const yellowData = platformOrder.map(id => perPlatform[id]?.yellow || 0);
        const greenData = platformOrder.map(id => perPlatform[id]?.green || 0);

        barChart.data.labels = labels;
        barChart.data.datasets[0].data = redData;
        barChart.data.datasets[1].data = yellowData;
        barChart.data.datasets[2].data = greenData;
        barChart.options.plugins.legend.labels.color = textColor();
        barChart.options.scales.x.ticks.color = textColor();
        barChart.options.scales.y.ticks.color = textColor();
        barChart.options.scales.y.grid.color = gridColor();
        barChart.update();
    }

    return { init, update };
})();
