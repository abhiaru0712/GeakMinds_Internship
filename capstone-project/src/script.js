let currentChart = null;

async function loadRandomTransaction(type) {
    const textarea = document.getElementById('transactionData');
    textarea.value = "Loading...";
    try {
        const response = await fetch(`/random_transaction?type=${type}`);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        
        // Format beautifully
        textarea.value = JSON.stringify(data, null, 4);
    } catch (e) {
        textarea.value = '{"error": "Failed to load transaction data."}';
        console.error(e);
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            document.getElementById('transactionData').value = JSON.stringify(data, null, 4);
        } catch (error) {
            alert("Invalid JSON file. Please upload a valid JSON file containing transaction data.");
        }
    };
    reader.readAsText(file);
    // Reset file input so the same file can be uploaded again if needed
    event.target.value = '';
}

function clearTransaction() {
    document.getElementById('transactionData').value = '';
    
    // Reset UI
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('activeState').style.display = 'none';
    if(currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

async function analyzeTransaction() {
    const rawData = document.getElementById('transactionData').value;
    if (!rawData || rawData.trim() === '') return alert('Please enter or load transaction data.');

    let payload;
    try {
        payload = JSON.parse(rawData);
    } catch (e) {
        return alert('Invalid JSON. Please fix syntax errors before submission.');
    }

    const btn = document.getElementById('analyzeBtn');
    const loader = document.getElementById('loader');
    
    btn.disabled = true;
    loader.style.display = 'block';

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Prediction failed');
        }

        const result = await response.json();
        displayResults(result);

    } catch (e) {
        console.error(e);
        alert('Error during analysis: ' + e.message);
    } finally {
        btn.disabled = false;
        loader.style.display = 'none';
    }
}

function displayResults(data) {
    document.getElementById('emptyState').style.display = 'none';
    const activeState = document.getElementById('activeState');
    activeState.style.display = 'block';

    // 1. Update Verdict Banner
    const banner = document.getElementById('verdictBanner');
    const title = document.getElementById('predictionText');
    const subtitle = document.getElementById('probabilityText');

    title.innerText = data.prediction;
    const probabilityAmount = (data.fraud_probability * 100).toFixed(2);
    subtitle.innerText = `${probabilityAmount}% Probability of Fraud`;

    if (data.prediction === "Fraud") {
        banner.className = 'verdict-banner verdict-fraud';
    } else {
        banner.className = 'verdict-banner verdict-legit';
    }

    // 2. Render SHAP Chart
    renderChart(data.shap_explanation);
}

function renderChart(shapData) {
    const ctx = document.getElementById('shapChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }

    // Extract axes arrays
    const labels = shapData.map(d => `${d.feature} (= ${d.value})`);
    const values = shapData.map(d => d.shap_value);
    
    // Map colors based on positive / negative impact on fraud
    // Positive means it pushed the model towards predicting "Fraud"
    // Negative means it pushed the model towards predicting "Legitimate"
    const backgroundColors = values.map(v => v > 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)');
    const borderColors = values.map(v => v > 0 ? 'rgba(239, 68, 68, 1)' : 'rgba(16, 185, 129, 1)');

    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'SHAP Value (Impact on prediction)',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#f3f4f6',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}
