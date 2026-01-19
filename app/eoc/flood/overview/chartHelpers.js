// Helper functions for disease charts
const getDiseaseBarChartData = (diseaseToday) => {
    if (!diseaseToday || diseaseToday.length === 0) return { labels: [], datasets: [] };

    const districts = [...new Set(diseaseToday.map(d => d.district_name))];
    const diseases = [...new Set(diseaseToday.map(d => d.disease_name))];

    const colors = [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)'
    ];

    const datasets = diseases.map((disease, index) => ({
        label: disease,
        data: districts.map(district => {
            const record = diseaseToday.find(d => d.district_name === district && d.disease_name === disease);
            return record ? parseInt(record.today_patients) : 0;
        }),
        backgroundColor: colors[index % colors.length]
    }));

    return { labels: districts, datasets };
};

const getDiseasePieChartData = (diseaseByType) => {
    if (!diseaseByType || diseaseByType.length === 0) return { labels: [], datasets: [] };

    const colors = [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)'
    ];

    return {
        labels: diseaseByType.map(d => d.disease_name),
        datasets: [{
            data: diseaseByType.map(d => parseInt(d.cumulative_total)),
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
};

const getVulnerablePieChartData = (summary) => {
    if (!summary) return { labels: [], datasets: [] };

    const data = [
        { label: 'ผู้สูงอายุ', value: parseInt(summary.total_elderly) || 0, color: 'rgba(255, 99, 132, 0.8)' },
        { label: 'เด็ก', value: parseInt(summary.total_children) || 0, color: 'rgba(54, 162, 235, 0.8)' },
        { label: 'คนพิการ', value: parseInt(summary.total_disabled) || 0, color: 'rgba(255, 206, 86, 0.8)' },
        { label: 'หญิงตั้งครรภ์', value: parseInt(summary.total_pregnant) || 0, color: 'rgba(75, 192, 192, 0.8)' },
        { label: 'ผู้ป่วยติดเตียง', value: parseInt(summary.total_bedridden) || 0, color: 'rgba(153, 102, 255, 0.8)' }
    ];

    return {
        labels: data.map(d => d.label),
        datasets: [{
            data: data.map(d => d.value),
            backgroundColor: data.map(d => d.color),
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
};

export { getDiseaseBarChartData, getDiseasePieChartData, getVulnerablePieChartData };
