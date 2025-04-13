// Configuration
const GOOGLE_MAPS_API_KEY = 'AIzaSyDsnO8p4A4SWCZOzTqJuQ_hJYTDx2jwXiE'; // Google Maps API key
const IQAIR_API_KEY = 'YOUR_IQAIR_API_KEY'; // Replace with your IQAir API key
const WAQI_API_KEY = '76e7c4e972a0889d8c5b6c7a2d1fadefa1464e38'; // WAQI API key
const UPDATE_INTERVAL = 300000; // 5 minutes in milliseconds
const USE_IQAIR = false; // Set to true when you have an IQAir API key
const USE_WAQI = true; // Set to true to use WAQI API

// Global variables
let currentLocation = null;
let historicalData = [];
let updateInterval = null;
let airQualityChart = null;
let healthImpactChart = null;

// Function to load and process CSV data
async function loadCSVData() {
    try {
        const response = await fetch('air_quality_health_impact_data.csv');
        const data = await response.text();
        const rows = data.split('\n').slice(1); // Skip header row
        return rows.map(row => {
            const [recordId, aqi, pm10, pm25, no2, so2, o3, temperature, humidity, windSpeed, 
                   respiratoryCases, cardiovascularCases, hospitalAdmissions, healthImpactScore, healthImpactClass] = row.split(',');
            
            return {
                date: `Record ${recordId}`,
                aqi: parseFloat(aqi),
                pm25: parseFloat(pm25),
                healthRisk: getHealthRiskClass(parseFloat(healthImpactClass)),
                trend: calculateTrend(parseFloat(aqi)),
                respiratoryCases: parseInt(respiratoryCases),
                cardiovascularCases: parseInt(cardiovascularCases),
                hospitalAdmissions: parseInt(hospitalAdmissions),
                healthImpactScore: parseFloat(healthImpactScore)
            };
        });
    } catch (error) {
        console.error('Error loading CSV data:', error);
        return [];
    }
}

// Function to determine health risk class
function getHealthRiskClass(aqi) {
    if (aqi === undefined || aqi === null) return 'Unknown';
    
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

// Function to calculate trend (simplified version)
function calculateTrend(currentAQI) {
    const change = Math.random() * 20 - 10; // For demo purposes
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

// Update metrics with real data
function updateMetrics(data) {
    if (data.length === 0) return;
    
    const latestData = data[data.length - 1];
    document.getElementById('aqi-value').textContent = latestData.aqi.toFixed(1);
    document.getElementById('pm25-value').textContent = latestData.pm25.toFixed(1);
    document.getElementById('health-risk').textContent = latestData.healthRisk;
    document.getElementById('trend-value').textContent = latestData.trend;
}

// Create Air Quality Trend Chart with real data
function createAirQualityChart(data) {
    const ctx = document.getElementById('airQualityChart').getContext('2d');
    const last30Records = data.slice(-30); // Show last 30 records

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Records.map(d => d.date),
            datasets: [{
                label: 'AQI',
                data: last30Records.map(d => d.aqi),
                borderColor: '#0d6efd',
                tension: 0.4,
                fill: false
            }, {
                label: 'PM2.5',
                data: last30Records.map(d => d.pm25),
                borderColor: '#198754',
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update Health Impact Chart
function updateHealthImpactChart() {
    const healthImpactCtx = document.getElementById('healthImpactChart');
    if (!healthImpactCtx) {
        console.error('Health impact chart canvas not found');
        return;
    }
    
    const context = healthImpactCtx.getContext('2d');
    if (healthImpactChart) {
        healthImpactChart.destroy();
    }

    const healthRisks = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];
    
    // Count occurrences of each risk category in the historical data
    const riskCounts = healthRisks.map(risk => 
        historicalData.filter(d => d.healthRisk === risk).length
    );
    
    // Get current health risk based on latest data
    let currentRisk = 'Unknown';
    if (historicalData.length > 0) {
        const currentRecord = historicalData[historicalData.length - 1];
        if (currentRecord.aqi) {
            currentRisk = getHealthRiskClass(currentRecord.aqi);
        }
    }
    
    // If all counts are zero or we only have the current record, add at least one for the current risk
    const totalCounts = riskCounts.reduce((a, b) => a + b, 0);
    if (totalCounts === 0 && currentRisk !== 'Unknown') {
        const currentRiskIndex = healthRisks.indexOf(currentRisk);
        if (currentRiskIndex !== -1) {
            riskCounts[currentRiskIndex] = 1;
        }
    }

    // Generate different colors for the chart
    const backgroundColors = [
        '#198754', // Good - green
        '#ffc107', // Moderate - yellow
        '#fd7e14', // Unhealthy for Sensitive Groups - orange
        '#dc3545', // Unhealthy - red
        '#9c27b0', // Very Unhealthy - purple
        '#6f42c1'  // Hazardous - deep purple
    ];

    healthImpactChart = new Chart(context, {
        type: 'doughnut',
        data: {
            labels: healthRisks,
            datasets: [{
                data: riskCounts,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value} readings`;
                        }
                    }
                }
            }
        }
    });
    
    console.log('Health impact chart updated with data:', riskCounts);
}

// For backwards compatibility
function createHealthImpactChart(data) {
    // Just update the historical data chart instead
    updateHealthImpactChart();
}

// Populate Data Table with real data
function populateDataTable(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    // Show last 10 records
    data.slice(-10).forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${record.aqi.toFixed(1)}</td>
            <td>${record.pm25.toFixed(1)}</td>
            <td>${record.healthRisk}</td>
            <td>${record.trend}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Update API selection UI to show active API
function updateApiSelectionUI() {
    const waqiToggle = document.getElementById('waqiApiToggle');
    const iqairToggle = document.getElementById('iqairApiToggle');
    const openaqToggle = document.getElementById('openaqApiToggle');
    
    // Clear any existing badges
    document.querySelectorAll('.api-active-badge').forEach(badge => badge.remove());
    
    // Add badge to active API
    let activeLabel = null;
    if (USE_WAQI) {
        activeLabel = waqiToggle.nextElementSibling;
    } else if (USE_IQAIR) {
        activeLabel = iqairToggle.nextElementSibling;
    } else {
        activeLabel = openaqToggle.nextElementSibling;
    }
    
    if (activeLabel) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-success ms-2 api-active-badge';
        badge.textContent = 'Active';
        activeLabel.appendChild(badge);
    }
}

// Initialize API toggle
function initializeAPIToggle() {
    const apiToggle = document.getElementById('USE_WAQI_TOGGLE');
    const apiKeyInput = document.getElementById('WAQI_API_KEY');
    const apiKeyContainer = document.getElementById('apiKeyContainer');
    
    if (!apiToggle || !apiKeyInput || !apiKeyContainer) {
        console.error('API toggle elements not found in DOM');
        return;
    }
    
    // Load saved preferences
    const savedUseWAQI = localStorage.getItem('aqDashboard_useWAQI') === 'true';
    const savedApiKey = localStorage.getItem('aqDashboard_waqi_api_key') || '';
    
    // Set initial values
    USE_WAQI = savedUseWAQI;
    WAQI_API_KEY = savedApiKey;
    apiToggle.checked = USE_WAQI;
    apiKeyInput.value = WAQI_API_KEY;
    
    // Show/hide API key input based on toggle state
    if (USE_WAQI) {
        apiKeyContainer.classList.remove('d-none');
    } else {
        apiKeyContainer.classList.add('d-none');
    }
    
    // Event listeners
    apiToggle.addEventListener('change', function() {
        USE_WAQI = this.checked;
        localStorage.setItem('aqDashboard_useWAQI', USE_WAQI.toString());
        
        if (USE_WAQI) {
            apiKeyContainer.classList.remove('d-none');
        } else {
            apiKeyContainer.classList.add('d-none');
        }
        
        // Refresh data with new API setting
        loadAndDisplayData();
    });
    
    apiKeyInput.addEventListener('change', function() {
        WAQI_API_KEY = this.value.trim();
        localStorage.setItem('aqDashboard_waqi_api_key', WAQI_API_KEY);
        
        // Refresh data with new API key
        if (USE_WAQI) {
            loadAndDisplayData();
        }
    });
}

// Initialize info panel toggle for mobile views
function initializeInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    
    // Make sure the info panel is always visible on desktop
    if (window.innerWidth >= 992) { // lg breakpoint in Bootstrap
        if (infoPanel) {
            infoPanel.classList.remove('d-none');
            infoPanel.classList.add('d-block');
        }
    }
    
    // Add resize listener to handle responsive behavior
    window.addEventListener('resize', function() {
        if (window.innerWidth >= 992) { // lg breakpoint in Bootstrap
            if (infoPanel) {
                infoPanel.classList.remove('d-none');
                infoPanel.classList.add('d-block');
            }
        } else {
            if (infoPanel) {
                infoPanel.classList.add('d-none');
                infoPanel.classList.remove('d-block');
            }
        }
    });
}

// Save historical data to localStorage
function saveHistoricalData() {
    try {
        localStorage.setItem('aqDashboard_historicalData', JSON.stringify(historicalData));
        console.log('Historical data saved to localStorage');
    } catch (error) {
        console.error('Error saving historical data:', error);
    }
}

// Load historical data from localStorage
function loadHistoricalData() {
    try {
        const savedData = localStorage.getItem('aqDashboard_historicalData');
        if (savedData) {
            historicalData = JSON.parse(savedData);
            console.log(`Loaded ${historicalData.length} historical records from localStorage`);
            return true;
        }
    } catch (error) {
        console.error('Error loading historical data:', error);
    }
    return false;
}

// Load and display air quality data
async function loadAndDisplayData() {
    let data;
    let dataConfidence = 'Low';
    let sourceName = '';
    let loadError = false;
    let errorMessage = '';
    
    // Show loading indicator in AQI section
    const aqiValue = document.getElementById('aqi-value');
    const pm25Value = document.getElementById('pm25-value');
    const healthRisk = document.getElementById('health-risk');
    const originalAqiText = aqiValue.textContent;
    const originalPm25Text = pm25Value.textContent;
    const originalHealthRiskText = healthRisk.textContent;
    
    aqiValue.textContent = 'Loading...';
    pm25Value.textContent = 'Loading...';
    
    // Try to get data from a real API first
    try {
        if (USE_WAQI) {
            if (!WAQI_API_KEY || WAQI_API_KEY === 'your-waqi-token-here') {
                throw new Error("No valid WAQI API key provided");
            }
            
            let location = '';
            if (currentLocation && currentLocation.lat && currentLocation.lng) {
                location = `geo:${currentLocation.lat};${currentLocation.lng}`;
                sourceName = 'WAQI API (Nearest Station)';
                dataConfidence = 'High';
            } else if (currentLocation && currentLocation.city) {
                location = currentLocation.city;
                sourceName = 'WAQI API (City)';
                dataConfidence = 'Medium';
            } else {
                throw new Error("No location data available");
            }
            
            // Create a fetch request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const response = await fetch(
                    `https://api.waqi.info/feed/${location}/?token=${WAQI_API_KEY}`, 
                    { signal: controller.signal }
                );
                clearTimeout(timeoutId);
                
                const result = await response.json();
                
                if (result.status === 'ok' && result.data && result.data.aqi) {
                    const aqi = result.data.aqi;
                    data = {
                        time: new Date().toLocaleTimeString(),
                        aqi: aqi,
                        pm25: result.data.iaqi && result.data.iaqi.pm25 ? result.data.iaqi.pm25.v : Math.round(aqi / 2.1),
                        healthRisk: getHealthRiskClass(aqi),
                        trend: calculateTrend(aqi),
                        temperature: result.data.iaqi && result.data.iaqi.t ? result.data.iaqi.t.v : null,
                        humidity: result.data.iaqi && result.data.iaqi.h ? result.data.iaqi.h.v : null,
                        windSpeed: result.data.iaqi && result.data.iaqi.w ? result.data.iaqi.w.v : null,
                        source: `${sourceName} - ${result.data.city?.name || 'Unknown Station'}`
                    };
                    
                    // If we have station data, update our location information to match
                    if (result.data.city && result.data.city.name) {
                        document.getElementById('stationInfo').textContent = `Nearest Station: ${result.data.city.name}`;
                        document.getElementById('stationInfo').classList.remove('d-none');
                    }
                    
                    console.log("AQI Data:", data);
                } else {
                    throw new Error(result.data && result.data.message ? result.data.message : "No air quality data available from API");
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error("API request timed out. Please try again later.");
                } else {
                    throw fetchError;
                }
            }
        } else {
            throw new Error("WAQI API not enabled");
        }
    } catch (error) {
        console.warn("Error loading real data:", error);
        loadError = true;
        errorMessage = error.message;
        
        // Reset loading indicators if we're going to use simulated data
        aqiValue.textContent = originalAqiText;
        pm25Value.textContent = originalPm25Text;
        healthRisk.textContent = originalHealthRiskText;
        
        // Fall back to simulated data
        data = generateSimulatedData();
        sourceName = 'Simulated Data';
        if (loadError) {
            sourceName += ` (Error: ${errorMessage})`;
        }
        data.source = sourceName;
        dataConfidence = 'Low';
        
        // Show an error message about falling back to simulated data
        showErrorMessage(`Could not get real air quality data: ${errorMessage}. Using simulated data instead.`, 5000);
    }
    
    // Ensure health risk is properly set based on AQI
    if (data.aqi && (!data.healthRisk || data.healthRisk === 'Unknown')) {
        data.healthRisk = getHealthRiskClass(data.aqi);
    }
    
    // Push the new data to historical data
    historicalData.push(data);
    
    // Limit historical data to the last 24 records
    if (historicalData.length > 24) {
        historicalData.shift();
    }
    
    // Save the updated historical data
    saveHistoricalData();
    
    // Update the dashboard with the new data
    updateDashboard(data, dataConfidence);
    
    // Update the charts with the historical data
    updateCharts();
    
    // Update the data table
    updateTable();
    
    return data;
}

// Initialize the dashboard
function initializeDashboard() {
    // Load saved historical data if available
    const hasHistoricalData = loadHistoricalData();
    
    // Initialize the UI
    initializeInfoPanel();
    setupLocationHandlers();
    
    // Set up API toggle
    initializeAPIToggle();
    
    // Set up auto-refresh
    initializeAutoRefresh();
    
    // If we have historical data, update the charts and dashboard
    if (hasHistoricalData && historicalData.length > 0) {
        const latestData = historicalData[historicalData.length - 1];
        updateDashboard(latestData, 'Medium');  // Assume medium confidence for loaded data
        updateCharts();
        updateTable();
    }
    
    // Load fresh data
    loadAndDisplayData();
    
    console.log("Dashboard initialized");
}

// Setup location handlers
function setupLocationHandlers() {
    const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
    const citySearchForm = document.getElementById('citySearchForm');
    const cityNameInput = document.getElementById('cityName');
    const useCoordinatesBtn = document.getElementById('useCoordinates');
    
    if (!useCurrentLocationBtn || !citySearchForm || !cityNameInput) {
        console.error('Location handler elements not found in DOM');
        return;
    }
    
    // Attempt to restore last used location from localStorage
    const savedLocation = localStorage.getItem('aqDashboard_lastLocation');
    if (savedLocation) {
        try {
            currentLocation = JSON.parse(savedLocation);
            document.getElementById('locationDisplay').textContent = currentLocation.formattedAddress || currentLocation.city || 'Unknown Location';
        } catch (e) {
            console.error('Error restoring saved location:', e);
        }
    }
    
    // Use current location
    useCurrentLocationBtn.addEventListener('click', function() {
        const loadingIndicator = document.getElementById('locationLoading');
        if (loadingIndicator) loadingIndicator.classList.remove('d-none');
        
        // Clear any previous error messages
        const errorContainer = document.getElementById('errorMessageContainer');
        if (errorContainer) errorContainer.innerHTML = '';
        
        if (navigator.geolocation) {
            // Set a timeout to handle cases where geolocation hangs
            const geolocationTimeout = setTimeout(() => {
                if (loadingIndicator) loadingIndicator.classList.add('d-none');
                showErrorMessage("Location request is taking too long. Please try searching for your city instead.", 8000);
            }, 15000); // 15 seconds timeout
            
            navigator.geolocation.getCurrentPosition(
                // Success callback
                async function(position) {
                    clearTimeout(geolocationTimeout); // Clear the timeout
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    try {
                        // Show immediate feedback that we got coordinates
                        document.getElementById('locationDisplay').textContent = `Coordinates received: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                        
                        // Set basic location info immediately
                        currentLocation = { lat, lng };
                        
                        // Start loading data with just the coordinates while we fetch address details
                        loadAndDisplayData();
                        
                        // Get formatted address using reverse geocoding
                        try {
                            const geocoder = new google.maps.Geocoder();
                            const latlng = { lat, lng };
                            
                            // Set a timeout for geocoding
                            const geocodePromise = new Promise((resolve, reject) => {
                                const geocodeTimeout = setTimeout(() => {
                                    reject(new Error("Geocoding timed out"));
                                }, 5000); // 5 second timeout for geocoding
                                
                                geocoder.geocode({ 'location': latlng }, (results, status) => {
                                    clearTimeout(geocodeTimeout);
                                    if (status === 'OK' && results[0]) {
                                        resolve(results);
                                    } else {
                                        reject(new Error(`Geocoder failed: ${status}`));
                                    }
                                });
                            });
                            
                            const response = await geocodePromise;
                            
                            // Extract address components
                            const addressComponents = response[0].address_components;
                            let city = '';
                            let country = '';
                            
                            for (const component of addressComponents) {
                                if (component.types.includes('locality')) {
                                    city = component.long_name;
                                } else if (component.types.includes('administrative_area_level_1')) {
                                    if (!city) city = component.long_name;
                                } else if (component.types.includes('country')) {
                                    country = component.long_name;
                                }
                            }
                            
                            // Update currentLocation and UI
                            currentLocation = {
                                lat,
                                lng,
                                city,
                                country,
                                formattedAddress: response[0].formatted_address
                            };
                            
                            // Save to localStorage
                            localStorage.setItem('aqDashboard_lastLocation', JSON.stringify(currentLocation));
                            
                            // Update location display
                            document.getElementById('locationDisplay').textContent = currentLocation.formattedAddress;
                            
                            // Hide station info initially
                            const stationInfo = document.getElementById('stationInfo');
                            if (stationInfo) stationInfo.classList.add('d-none');
                            
                            // Refresh data with the enhanced location info
                            await loadAndDisplayData();
                        } catch (geocodeError) {
                            console.warn("Error during reverse geocoding, continuing with coordinates only:", geocodeError);
                            // We already started loading data with just the coordinates, so no need to do it again
                        }
                        
                    } catch (error) {
                        console.error("Error processing location:", error);
                        showErrorMessage(`Error processing location: ${error.message}`, 5000);
                    } finally {
                        if (loadingIndicator) loadingIndicator.classList.add('d-none');
                    }
                },
                // Error callback
                function(error) {
                    clearTimeout(geolocationTimeout); // Clear the timeout
                    console.error("Geolocation error:", error);
                    
                    let errorMsg = "Could not get your location. ";
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg += "You denied the request for geolocation. Please check your browser permissions.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg += "Location information is unavailable. Please try searching for your city instead.";
                            break;
                        case error.TIMEOUT:
                            errorMsg += "The request to get your location timed out. Please try searching for your city instead.";
                            break;
                        case error.UNKNOWN_ERROR:
                            errorMsg += "An unknown error occurred. Please try searching for your city instead.";
                            break;
                    }
                    
                    showErrorMessage(errorMsg, 8000);
                    if (loadingIndicator) loadingIndicator.classList.add('d-none');
                },
                // Options
                {
                    timeout: 10000,        // 10 seconds timeout for the geolocation API
                    enableHighAccuracy: false,  // Set to false for faster response
                    maximumAge: 60000      // Accept cached position up to 1 minute old
                }
            );
        } else {
            showErrorMessage("Geolocation is not supported by this browser. Please search for your city instead.", 5000);
            if (loadingIndicator) loadingIndicator.classList.add('d-none');
        }
    });
    
    // City search form
    citySearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLocationSearch();
    });
    
    // Coordinates search button
    if (useCoordinatesBtn) {
        useCoordinatesBtn.addEventListener('click', function() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lng = parseFloat(document.getElementById('longitude').value);

            if (isNaN(lat) || isNaN(lng)) {
                showErrorMessage('Please enter valid coordinates');
                return;
            }

            // Show loading indicator
            const loadingIndicator = document.getElementById('locationLoading');
            if (loadingIndicator) loadingIndicator.classList.remove('d-none');

            // Update the current location
            currentLocation = {
                lat: lat,
                lng: lng,
                formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            };
            
            // Save to localStorage
            localStorage.setItem('aqDashboard_lastLocation', JSON.stringify(currentLocation));
            
            // Update display
            document.getElementById('locationDisplay').textContent = currentLocation.formattedAddress;
            
            // Load data with coordinates
            loadAndDisplayData().then(() => {
                if (loadingIndicator) loadingIndicator.classList.add('d-none');
            });
        });
    }
}

// Handle location search
async function handleLocationSearch() {
    const cityName = document.getElementById('cityName').value.trim();
    const loadingIndicator = document.getElementById('locationLoading');
    
    if (loadingIndicator) loadingIndicator.classList.remove('d-none');
    
    if (!cityName) {
        showErrorMessage("Please enter a city name", 5000);
        if (loadingIndicator) loadingIndicator.classList.add('d-none');
        return;
    }
    
    try {
        // First try to search directly with WAQI API if enabled
        if (USE_WAQI && WAQI_API_KEY && WAQI_API_KEY !== 'your-waqi-token-here') {
            try {
                const response = await fetch(`https://api.waqi.info/search/?token=${WAQI_API_KEY}&keyword=${encodeURIComponent(cityName)}`);
                const result = await response.json();
                
                if (result.status === 'ok' && result.data && result.data.length > 0) {
                    // Use the first station that has valid AQI data
                    let stationFound = false;
                    
                    for (const station of result.data) {
                        if (station.aqi && station.aqi !== '-') {
                            // Extract station location components
                            const stationName = station.station.name;
                            
                            // Update currentLocation with the station information
                            currentLocation = {
                                lat: station.lat,
                                lng: station.lon,
                                city: cityName,
                                formattedAddress: stationName
                            };
                            
                            // Save to localStorage
                            localStorage.setItem('aqDashboard_lastLocation', JSON.stringify(currentLocation));
                            
                            // Update location display
                            document.getElementById('locationDisplay').textContent = stationName;
                            
                            // Update station info
                            const stationInfo = document.getElementById('stationInfo');
                            if (stationInfo) {
                                stationInfo.textContent = `Nearest Station: ${stationName}`;
                                stationInfo.classList.remove('d-none');
                            }
                            
                            // Load data for this station
                            await loadAndDisplayData();
                            stationFound = true;
                            break;
                        }
                    }
                    
                    if (!stationFound) {
                        throw new Error("No active air quality monitoring stations found in this area");
                    }
                } else {
                    throw new Error("No stations found for this location");
                }
            } catch (wapiError) {
                console.warn("WAQI search failed, falling back to geocoding:", wapiError);
                // Fall back to geocoding approach
                await geocodeAndLoadData(cityName);
            }
        } else {
            // Use geocoding approach
            await geocodeAndLoadData(cityName);
        }
    } catch (error) {
        console.error("Error searching for location:", error);
        showErrorMessage(`Could not find location "${cityName}". Please try a different city name.`, 5000);
    }
    
    if (loadingIndicator) loadingIndicator.classList.add('d-none');
}

// Helper function to geocode a city name and load data
async function geocodeAndLoadData(cityName) {
    // Use Google Geocoding API to get coordinates for the city
    const geocoder = new google.maps.Geocoder();
    const response = await new Promise((resolve, reject) => {
        geocoder.geocode({ 'address': cityName }, (results, status) => {
            if (status === 'OK' && results[0]) {
                resolve(results);
            } else {
                reject(new Error(`Geocoder failed: ${status}`));
            }
        });
    });
    
    // Extract location information
    const location = response[0].geometry.location;
    const formattedAddress = response[0].formatted_address;
    
    // Extract city and country from address components
    let city = cityName;
    let country = '';
    
    for (const component of response[0].address_components) {
        if (component.types.includes('locality')) {
            city = component.long_name;
        } else if (component.types.includes('country')) {
            country = component.long_name;
        }
    }
    
    // Update currentLocation and UI
    currentLocation = {
        lat: location.lat(),
        lng: location.lng(),
        city,
        country,
        formattedAddress
    };
    
    // Save to localStorage
    localStorage.setItem('aqDashboard_lastLocation', JSON.stringify(currentLocation));
    
    // Update location display
    document.getElementById('locationDisplay').textContent = formattedAddress;
    
    // Hide station info initially
    const stationInfo = document.getElementById('stationInfo');
    if (stationInfo) stationInfo.classList.add('d-none');
    
    // Load data for the new location
    await loadAndDisplayData();
}

// Handle coordinate search
function handleCoordinateSearch() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);

    if (isNaN(lat) || isNaN(lng)) {
        alert('Please enter valid coordinates');
        return;
    }

    currentLocation = {
        lat: lat,
        lng: lng,
        name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };
    console.log('Using coordinates:', currentLocation);
    updateSelectedLocation();
    startDataCollection();
}

// Handle current location
function handleCurrentLocation() {
    if (!navigator.geolocation) {
        showErrorMessage('Geolocation is not supported by your browser');
        return;
    }

    // Show loading indicator
    const locationDiv = document.getElementById('selectedLocation');
    locationDiv.innerHTML = `
        <div class="alert alert-info">
            <i class="bi bi-geo-alt"></i> Getting your current location...
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;

    const options = {
        enableHighAccuracy: true,  // Try to get the most accurate position
        timeout: 15000,            // Longer timeout for better accuracy (15 seconds)
        maximumAge: 0              // Don't use a cached position
    };

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            console.log('Geolocation successful:', lat, lng);
            
            // Save raw coordinates for later use
            const rawCoordinates = {
                lat: lat,
                lng: lng
            };
            
            // Default name if all reverse geocoding fails
            currentLocation = {
                lat: lat,
                lng: lng,
                name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                rawCoordinates: rawCoordinates
            };

            // Get precise location name first (ignoring air quality stations)
            try {
                const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
                const response = await fetch(geocodeUrl);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    // Look for address components to extract precise location data
                    const result = data.results[0];
                    
                    // Extract the most relevant components for a precise address
                    let locality = result.address_components.find(
                        component => component.types.includes('locality')
                    );
                    
                    let subLocality = result.address_components.find(
                        component => component.types.includes('sublocality') || component.types.includes('neighborhood')
                    );
                    
                    let administrativeArea = result.address_components.find(
                        component => component.types.includes('administrative_area_level_1')
                    );
                    
                    let country = result.address_components.find(
                        component => component.types.includes('country')
                    );
                    
                    // Build a precise location name
                    let locationParts = [];
                    
                    if (subLocality) locationParts.push(subLocality.long_name);
                    if (locality) locationParts.push(locality.long_name);
                    if (administrativeArea && (!locality || administrativeArea.long_name !== locality.long_name)) 
                        locationParts.push(administrativeArea.long_name);
                    if (country) locationParts.push(country.long_name);
                    
                    // Set a precise location name
                    if (locationParts.length > 0) {
                        currentLocation.name = locationParts.join(', ');
                        currentLocation.preciseName = true; // Flag that we have a precise name
                    } else {
                        currentLocation.name = result.formatted_address;
                        currentLocation.preciseName = true;
                    }
                    
                    console.log('Precise location name:', currentLocation.name);
                    
                    // Update UI with precise location immediately
                    updateSelectedLocation(true);
                }
            } catch (error) {
                console.error('Error getting precise location:', error);
            }

            // Now find the nearest air quality station
            if (USE_WAQI && WAQI_API_KEY) {
                try {
                    // Get all stations within a reasonable radius
                    const mapUrl = `https://api.waqi.info/map/bounds/?token=${WAQI_API_KEY}&latlng=${lat-0.5},${lng-0.5},${lat+0.5},${lng+0.5}`;
                    const mapResponse = await fetch(mapUrl);
                    const mapData = await mapResponse.json();
                    
                    console.log('WAQI stations map response:', mapData);
                    
                    if (mapData.status === 'ok' && mapData.data && mapData.data.length > 0) {
                        // Calculate distances to find the closest station
                        const stations = mapData.data.map(station => {
                            const distance = calculateDistance(lat, lng, station.lat, station.lon);
                            return {
                                ...station,
                                distance: distance
                            };
                        });
                        
                        // Sort by distance
                        stations.sort((a, b) => a.distance - b.distance);
                        
                        // Get the closest station with valid AQI data
                        const closestStation = stations.find(s => s.aqi !== '-' && s.aqi !== undefined && s.aqi !== null);
                        
                        if (closestStation) {
                            // Store closest station info but keep the precise location name
                            const stationName = closestStation.station.name;
                            const preciseName = currentLocation.preciseName ? currentLocation.name : null;
                            
                            currentLocation = {
                                lat: closestStation.lat,
                                lng: closestStation.lon,
                                name: preciseName || stationName,
                                stationName: stationName,
                                stationDistance: closestStation.distance.toFixed(2),
                                rawCoordinates: rawCoordinates
                            };
                            
                            console.log('Using nearby air quality station:', currentLocation);
                            showNotification(`Using air quality data from nearest station: ${stationName} (${closestStation.distance.toFixed(2)} km away)`, 'info');
                        }
                    }
                } catch (error) {
                    console.error('Error finding nearby air quality stations:', error);
                }
            }

            // Final update with all collected information
            updateSelectedLocation();
            startDataCollection();
        },
        (error) => {
            let errorMessage = 'Unknown error getting your location. Please try again.';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location permission denied. Please enable location services in your browser.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information is unavailable. Try searching for your city instead.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out. Please try again or search for your city.';
                    break;
            }
            
            console.error('Geolocation error:', error);
            showErrorMessage(errorMessage);
            
            // Clear the loading indicator
            locationDiv.innerHTML = '';
        },
        options
    );
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Show notification message
function showNotification(message, type = 'info', duration = 5000) {
    // Check if notification container exists, if not, create it
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'position-fixed bottom-0 end-0 p-3';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }
    
    // Determine the class based on type
    let alertClass = 'alert-info';
    switch(type) {
        case 'success':
            alertClass = 'alert-success';
            break;
        case 'warning':
            alertClass = 'alert-warning';
            break;
        case 'danger':
            alertClass = 'alert-danger';
            break;
    }
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to container
    notificationContainer.appendChild(alertDiv);
    
    // Auto dismiss after duration
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            alertDiv.remove();
        }, 150);
    }, duration);
}

// Update selected location display
function updateSelectedLocation(precise = false) {
    const locationDiv = document.getElementById('selectedLocation');
    let locationHtml = '';
    
    if (currentLocation) {
        // Show the name of the location
        locationHtml = `<div class="alert alert-info">
            <i class="bi bi-geo-alt"></i> <strong>${currentLocation.name}</strong>`;
        
        // If we're using a monitoring station, show that information
        if (currentLocation.stationName && currentLocation.stationDistance) {
            locationHtml += `
            <div class="mt-2 small">
                <i class="bi bi-info-circle"></i> Using data from air quality station: 
                <strong>${currentLocation.stationName}</strong> (${currentLocation.stationDistance} km away)
            </div>`;
        }
        
        locationHtml += `
                <div class="mt-2 small text-muted">
                    Last updated: ${new Date().toLocaleString()}
                </div>
            </div>`;
        
        locationDiv.innerHTML = locationHtml;
    }
}

// Update dashboard with new data
function updateDashboard(record) {
    // Make sure we actually have data
    if (!record) {
        console.error('No record data to update dashboard with');
        return;
    }

    // Update AQI and PM2.5 values with data validation
    const aqiValue = document.getElementById('aqi-value');
    aqiValue.textContent = record.aqi ? record.aqi.toFixed(1) : '--';
    if (record.aqi) {
        aqiValue.className = getAqiColorClass(record.aqi);
    }

    const pm25Value = document.getElementById('pm25-value');
    pm25Value.textContent = record.pm25 ? record.pm25.toFixed(1) : '--';
    
    // Update health risk based on AQI
    const healthRisk = document.getElementById('health-risk');
    const healthRiskValue = record.aqi ? getHealthRiskClass(record.aqi) : 'Unknown';
    healthRisk.textContent = healthRiskValue;
    if (healthRiskValue !== 'Unknown') {
        healthRisk.className = getHealthRiskColorClass(healthRiskValue);
    }
    
    // Store the correct health risk in the record for chart display
    if (record.healthRisk === 'Unknown' && record.aqi) {
        record.healthRisk = healthRiskValue;
    }
    
    document.getElementById('trend-value').textContent = record.trend || '--';

    // Update weather information with better null handling
    document.getElementById('temperature-value').textContent = 
        record.temperature !== null && record.temperature !== undefined ? record.temperature : '--';
    document.getElementById('humidity-value').textContent = 
        record.humidity !== null && record.humidity !== undefined ? record.humidity : '--';
    document.getElementById('wind-speed-value').textContent = 
        record.windSpeed !== null && record.windSpeed !== undefined ? record.windSpeed : '--';
    
    // Update data source with clear indication and confidence level
    const dataSource = document.getElementById('data-source');
    let sourceText = 'Data source: ';
    let confidenceLevel = 'low';
    
    if (record.source) {
        sourceText += record.source;
        if (record.source.includes('WAQI')) {
            confidenceLevel = 'high';
        } else if (record.source.includes('IQAir')) {
            confidenceLevel = 'high';
        } else if (record.source.includes('OpenAQ')) {
            confidenceLevel = 'medium';
        }
    } else if (record.location && record.location.includes('WAQI')) {
        sourceText += 'WAQI API';
        confidenceLevel = 'high';
    } else if (record.location && record.location.includes('IQAir')) {
        sourceText += 'IQAir AirVisual API';
        confidenceLevel = 'high';
    } else if (record.aqi > 0) {
        sourceText += 'OpenAQ API';
        confidenceLevel = 'medium';
    } else {
        sourceText += 'Simulated Data';
        confidenceLevel = 'very low';
    }
    
    // Add distance info if available to the data source text
    if (currentLocation && currentLocation.stationDistance) {
        sourceText += ` (${currentLocation.stationDistance} km)`;
    }
    
    // Add a badge indicating confidence
    let confidenceBadge = '';
    switch (confidenceLevel) {
        case 'high':
            confidenceBadge = '<span class="badge bg-success ms-1">High Confidence</span>';
            break;
        case 'medium':
            confidenceBadge = '<span class="badge bg-warning text-dark ms-1">Medium Confidence</span>';
            break;
        case 'low':
            confidenceBadge = '<span class="badge bg-danger ms-1">Low Confidence</span>';
            break;
        case 'very low':
            confidenceBadge = '<span class="badge bg-danger ms-1">Simulated</span>';
            break;
    }
    
    dataSource.innerHTML = `${sourceText} ${confidenceBadge}`;
    
    // Add a "Request Update" button if using real data
    const weatherSection = document.querySelector('.card-body:has(#data-source)');
    if (weatherSection && !document.getElementById('refreshDataBtn') && confidenceLevel !== 'very low') {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshDataBtn';
        refreshBtn.className = 'btn btn-sm btn-outline-primary mt-2';
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Data';
        refreshBtn.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Updating...';
            fetchAirQualityData().then(() => {
                this.disabled = false;
                this.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Data';
            });
        });
        
        weatherSection.appendChild(refreshBtn);
    }
    
    // Update location display to show data freshness
    const locationDiv = document.getElementById('selectedLocation');
    // Only update if we're not currently in the middle of a location search
    if (!locationDiv.innerHTML.includes('spinner-border')) {
        const timestamp = new Date().toLocaleString();
        let locationHtml = `
            <div class="alert alert-info">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-geo-alt"></i> <strong>${record.location || currentLocation.name}</strong>
                    </div>
                    <span class="badge bg-primary">${getHealthRiskClass(record.aqi)}</span>
                </div>`;
        
        // If we're using a monitoring station, show that information
        if (currentLocation && currentLocation.stationName && currentLocation.stationDistance) {
            locationHtml += `
                <div class="mt-2 small">
                    <i class="bi bi-info-circle"></i> Data from: <strong>${currentLocation.stationName}</strong> 
                    (${currentLocation.stationDistance} km away)
                </div>`;
        }
        
        locationHtml += `
                <div class="mt-2 small text-muted">
                    Last updated: ${timestamp}
                </div>
            </div>`;
        
        locationDiv.innerHTML = locationHtml;
    }

    // Update charts and table
    updateCharts();
    updateTable();
}

// Update charts with historical data
function updateCharts() {
    // Update Air Quality Chart
    const airQualityCtx = document.getElementById('airQualityChart').getContext('2d');
    if (airQualityChart) {
        airQualityChart.destroy();
    }

    airQualityChart = new Chart(airQualityCtx, {
        type: 'line',
        data: {
            labels: historicalData.map(d => d.time),
            datasets: [{
                label: 'AQI',
                data: historicalData.map(d => d.aqi),
                borderColor: '#0d6efd',
                tension: 0.4,
                fill: false
            }, {
                label: 'PM2.5',
                data: historicalData.map(d => d.pm25),
                borderColor: '#198754',
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Update Health Impact Chart
    updateHealthImpactChart();
}

// Simulate air quality data for demo purposes
function generateSimulatedData() {
    // Get the current date and time
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    
    // Generate a realistic AQI based on the current air quality level
    // If we have previous data, use it as a base
    let aqi, pm25;
    
    if (historicalData.length > 0 && historicalData[historicalData.length - 1].aqi) {
        // Base the new values on the last known values (with some variation)
        const lastRecord = historicalData[historicalData.length - 1];
        const variation = Math.random() * 20 - 10; // -10 to +10 variation
        aqi = Math.max(0, Math.round(lastRecord.aqi + variation));
        pm25 = Math.max(0, Math.round(lastRecord.pm25 + (variation / 2)));
    } else {
        // Generate random values - weighted towards moderate levels
        aqi = Math.floor(Math.random() * 150 + 50); // 50-200 range
        pm25 = Math.floor(aqi / 2.1); // Approximate PM2.5 from AQI
    }
    
    // Always calculate health risk directly from AQI
    const healthRisk = getHealthRiskClass(aqi);
    
    // Generate realistic weather data based on location and season if we have location info
    let temperature, humidity, windSpeed;
    
    // Default to reasonable values if we don't have season data
    const month = now.getMonth(); // 0-11 (Jan-Dec)
    const isNorthernHemisphere = true; // Default assumption
    
    // Seasonal temperature variations
    if ((month >= 11 || month <= 1) && isNorthernHemisphere) { // Winter (Dec-Feb)
        temperature = Math.floor(Math.random() * 10) - 5; // -5°C to 5°C
        humidity = Math.floor(Math.random() * 20) + 60; // 60-80%
        windSpeed = Math.floor(Math.random() * 8) + 2; // 2-10 m/s
    } else if ((month >= 5 && month <= 7) && isNorthernHemisphere) { // Summer (Jun-Aug)
        temperature = Math.floor(Math.random() * 15) + 20; // 20-35°C
        humidity = Math.floor(Math.random() * 30) + 50; // 50-80%
        windSpeed = Math.floor(Math.random() * 5) + 1; // 1-6 m/s
    } else { // Spring/Fall
        temperature = Math.floor(Math.random() * 15) + 10; // 10-25°C
        humidity = Math.floor(Math.random() * 30) + 40; // 40-70%
        windSpeed = Math.floor(Math.random() * 6) + 2; // 2-8 m/s
    }
    
    // If we have location data, adjust temperatures based on latitude
    if (currentLocation && currentLocation.lat) {
        // Crude adjustment based on latitude (higher = colder)
        const latitudeAdjustment = Math.abs(currentLocation.lat) / 10;
        if (currentLocation.lat > 0) { // Northern hemisphere
            if (month >= 5 && month <= 7) { // Summer in north
                temperature += (5 - latitudeAdjustment);
            } else if (month >= 11 || month <= 1) { // Winter in north
                temperature -= latitudeAdjustment;
            }
        } else { // Southern hemisphere
            if (month >= 11 || month <= 1) { // Summer in south
                temperature += (5 - latitudeAdjustment);
            } else if (month >= 5 && month <= 7) { // Winter in south
                temperature -= latitudeAdjustment;
            }
        }
    }
    
    return {
        time: timestamp,
        aqi: aqi,
        pm25: pm25,
        healthRisk: healthRisk,
        trend: calculateTrend(aqi),
        temperature: Math.round(temperature),
        humidity: Math.round(humidity),
        windSpeed: Math.round(windSpeed),
        source: 'Simulated Data'
    };
}

// Initialize auto refresh functionality
function initializeAutoRefresh() {
    let refreshInterval = null;
    const DEFAULT_REFRESH_INTERVAL = 5; // Minutes
    const refreshToggle = document.getElementById('autoRefreshToggle');
    const refreshIntervalSelect = document.getElementById('refreshInterval');
    
    if (!refreshToggle || !refreshIntervalSelect) {
        console.error('Auto-refresh elements not found in DOM');
        return;
    }
    
    // Load saved preference
    const savedAutoRefresh = localStorage.getItem('aqDashboard_autoRefresh') === 'true';
    const savedInterval = parseInt(localStorage.getItem('aqDashboard_refreshInterval')) || DEFAULT_REFRESH_INTERVAL;
    
    // Set initial values
    refreshToggle.checked = savedAutoRefresh;
    refreshIntervalSelect.value = savedInterval;
    
    // Function to start auto refresh
    function startAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        
        const minutes = parseInt(refreshIntervalSelect.value) || DEFAULT_REFRESH_INTERVAL;
        const milliseconds = minutes * 60 * 1000;
        
        refreshInterval = setInterval(() => {
            console.log(`Auto-refreshing data (interval: ${minutes} minutes)`);
            
            // Add visual indicator that refresh is happening
            const refreshIndicator = document.getElementById('refreshIndicator');
            if (refreshIndicator) {
                refreshIndicator.classList.remove('d-none');
                setTimeout(() => {
                    refreshIndicator.classList.add('d-none');
                }, 2000);
            }
            
            loadAndDisplayData();
        }, milliseconds);
        
        console.log(`Auto-refresh started with interval of ${minutes} minutes`);
        localStorage.setItem('aqDashboard_autoRefresh', 'true');
        localStorage.setItem('aqDashboard_refreshInterval', minutes.toString());
    }
    
    // Function to stop auto refresh
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
            console.log('Auto-refresh stopped');
            localStorage.setItem('aqDashboard_autoRefresh', 'false');
        }
    }
    
    // Event listeners
    refreshToggle.addEventListener('change', function() {
        if (this.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
    
    refreshIntervalSelect.addEventListener('change', function() {
        if (refreshToggle.checked) {
            startAutoRefresh(); // Restart with new interval
        }
        localStorage.setItem('aqDashboard_refreshInterval', this.value);
    });
    
    // Initialize based on saved preference
    if (savedAutoRefresh) {
        startAutoRefresh();
    }
    
    // Add manual refresh button handler
    const refreshButton = document.getElementById('manualRefresh');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            const refreshIndicator = document.getElementById('refreshIndicator');
            if (refreshIndicator) {
                refreshIndicator.classList.remove('d-none');
                setTimeout(() => {
                    refreshIndicator.classList.add('d-none');
                }, 2000);
            }
            
            loadAndDisplayData();
        });
    }
}

// Update the data table with historical data
function updateTable() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Display the last 10 records in reverse chronological order
    const recordsToShow = historicalData.slice(-10).reverse();
    
    recordsToShow.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.time || 'N/A'}</td>
            <td>${record.aqi ? record.aqi.toFixed(1) : 'N/A'}</td>
            <td>${record.pm25 ? record.pm25.toFixed(1) : 'N/A'}</td>
            <td>${record.healthRisk || 'N/A'}</td>
            <td>${record.trend || 'N/A'}</td>
            <td>${record.source || 'Unknown'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Get appropriate color class for AQI value
function getAqiColorClass(aqi) {
    if (aqi <= 50) return 'text-success';
    if (aqi <= 100) return 'text-warning';
    if (aqi <= 150) return 'text-orange';
    if (aqi <= 200) return 'text-danger';
    if (aqi <= 300) return 'text-purple';
    return 'text-dark';
}

// Get appropriate color class for health risk
function getHealthRiskColorClass(risk) {
    switch (risk) {
        case 'Good':
            return 'text-success';
        case 'Moderate':
            return 'text-warning';
        case 'Unhealthy for Sensitive Groups':
            return 'text-orange';
        case 'Unhealthy':
            return 'text-danger';
        case 'Very Unhealthy':
            return 'text-purple';
        case 'Hazardous':
            return 'text-dark';
        default:
            return '';
    }
}

// Initialize the dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document ready, initializing dashboard...');
    initializeDashboard();
});

// Show error message in a user-friendly way
function showErrorMessage(message, duration = 5000) {
    // Create error message container if it doesn't exist
    let errorContainer = document.getElementById('errorMessageContainer');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'errorMessageContainer';
        errorContainer.className = 'error-message-container';
        document.body.appendChild(errorContainer);
    }
    
    // Create the alert element
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-danger alert-dismissible fade show';
    alertElement.role = 'alert';
    
    // Add message content
    alertElement.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to container
    errorContainer.appendChild(alertElement);
    
    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => {
                alertElement.remove();
            }, 300);
        }, duration);
    }
    
    // Add click handler for close button
    const closeButton = alertElement.querySelector('.btn-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            alertElement.classList.remove('show');
            setTimeout(() => {
                alertElement.remove();
            }, 300);
        });
    }
}