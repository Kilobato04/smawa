// SMAAWA Dashboard - Main Application Logic

// Global variables
let currentDevice = null;
let allDevices = [];
let autoRefreshInterval = null;
let autoRefreshEnabled = true;
let refreshCountdown = 10;
let currentChartMode = 'realtime';
let currentChartHours = 3;
let deviceLocations = {};

// Chart instances
let waterLevelChart = null;
let rateChart = null;
let fixedMap = null;
let fixedMarker = null;

// Initialize dashboard
window.addEventListener('DOMContentLoaded', function() {
    console.log('SMAAWA Dashboard initializing...');
    
    // Load saved locations from localStorage
    loadSavedLocations();
    
    // Initialize dashboard
    initDashboard();
    
    // Set up auto-refresh
    startAutoRefresh();
    
    // Hide loading overlay
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.display = 'none';
    }, 500);
});

// Initialize dashboard
async function initDashboard() {
    try {
        await fetchDeviceList();
        if (currentDevice) {
            await fetchData();
            initCharts();
        }
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        updateStatus('offline', 'Connection Error');
    }
}

// Fetch device list
async function fetchDeviceList() {
    try {
        const response = await fetch(`${window.CONFIG.API_BASE}?action=devices`);
        const data = await response.json();
        
        if (data.devices && data.devices.length > 0) {
            allDevices = data.devices;
            
            // Populate device selects
            const deviceSelect = document.getElementById('deviceSelect');
            const locationDeviceSelect = document.getElementById('locationDeviceSelect');
            
            deviceSelect.innerHTML = '';
            locationDeviceSelect.innerHTML = '<option value="">Select Device</option>';
            
            allDevices.forEach(device => {
                // Calculate last seen time
                let lastSeenText = '';
                let isOffline = false;
                
                if (device.last_seen_seconds !== undefined) {
                    const seconds = device.last_seen_seconds;
                    // Consider online if last seen within 10 minutes (600 seconds)
                    if (seconds < 600) {
                        isOffline = false;
                    } else if (seconds < 3600) {
                        const minutes = Math.floor(seconds / 60);
                        lastSeenText = ` (${minutes} ${minutes === 1 ? 'min' : 'mins'} ago)`;
                        isOffline = true;
                    } else if (seconds < 86400) {
                        const hours = Math.floor(seconds / 3600);
                        lastSeenText = ` (${hours} ${hours === 1 ? 'hour' : 'hours'} ago)`;
                        isOffline = true;
                    } else {
                        const days = Math.floor(seconds / 86400);
                        lastSeenText = ` (${days} ${days === 1 ? 'day' : 'days'} ago)`;
                        isOffline = true;
                    }
                }
                
                // Update device status in the array
                device.actualStatus = isOffline ? 'offline' : 'online';
                
                const option1 = document.createElement('option');
                option1.value = device.deviceID;
                option1.textContent = `${!isOffline ? '🟢' : '🟡'} ${device.deviceID}${lastSeenText}`;
                if (isOffline) {
                    option1.style.color = '#ef4444';
                    option1.classList.add('offline');
                }
                deviceSelect.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = device.deviceID;
                option2.textContent = device.deviceID;
                locationDeviceSelect.appendChild(option2);
            });
            
            // Set first device as current
            if (!currentDevice) {
                currentDevice = allDevices[0].deviceID;
                deviceSelect.value = currentDevice;
            }
            
            // Update device summary
            updateDeviceSummary();
            
            console.log('Devices loaded:', allDevices.length);
        }
    } catch (error) {
        console.error('Error fetching devices:', error);
    }
}

// Update device summary
function updateDeviceSummary() {
    const total = allDevices.length;
    const online = allDevices.filter(d => d.actualStatus === 'online' || (d.last_seen_seconds && d.last_seen_seconds < 600)).length;
    const offline = total - online;
    
    document.getElementById('totalDevices').textContent = total;
    document.getElementById('onlineDevices').textContent = online;
    document.getElementById('offlineDevices').textContent = offline;
}

// Fetch latest data
async function fetchData() {
    if (!currentDevice) return;
    
    try {
        // Update status
        updateStatus('online', 'Connected');
        
        // Fetch latest data
        const response = await fetch(`${window.CONFIG.API_BASE}?action=latest&deviceID=${currentDevice}`);
        const data = await response.json();
        
        console.log('Raw API response for latest data:', data);
        
        if (data) {
            // Check if data is nested or direct
            const latestData = data.data || data;
            console.log('Latest data to display:', latestData);
            
            // Update last update time based on device's last_seen_seconds
            if (latestData.last_seen_seconds !== undefined) {
                const seconds = latestData.last_seen_seconds;
                let timeText = 'Just now';
                
                // Time Formatting Logic
                if (seconds < 60) {
                    timeText = 'Just now';
                } else if (seconds < 3600) {
                    const minutes = Math.floor(seconds / 60);
                    timeText = `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
                } else if (seconds < 86400) {
                    const hours = Math.floor(seconds / 3600);
                    timeText = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
                } else if (seconds < 604800) { 
                    const days = Math.floor(seconds / 86400);
                    timeText = `${days} ${days === 1 ? 'day' : 'days'} ago`;
                } else if (seconds < 2592000) { 
                    const weeks = Math.floor(seconds / 604800);
                    timeText = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
                } else {
                    const months = Math.floor(seconds / 2592000); 
                    timeText = `${months} ${months === 1 ? 'month' : 'months'} ago`;
                }
                
                document.getElementById('lastUpdate').textContent = timeText;
                lastUpdateTimestamp = Date.now() - (seconds * 1000);
            } else {
                updateLastUpdateTime();
            }
            
            updateDashboard(latestData);
        }
        
        // Fetch chart data based on current mode
        await updateChartData();
        
    } catch (error) {
        console.error('Error fetching data:', error);
        updateStatus('offline', 'Error');
    }
}

// Update dashboard with latest data
function updateDashboard(data) {
    console.log('Updating dashboard with data:', data);
    
    // Update device name
    document.getElementById('deviceName').textContent = currentDevice;
    
    // Water Level
    const waterLevel = parseFloat(data.distance) || 0;
    document.getElementById('waterLevelValue').textContent = waterLevel.toFixed(1);
    
    // Charge/Discharge Rate 
    // UPDATED: Device reports rate/cycle approx every 278 seconds (5 mins)
    const rateCycle = parseFloat(data.rate) || 0;
    const ratePerHour = (rateCycle / 278) * 3600; // Corrected divisor from 65 to 278
    document.getElementById('rateValue').textContent = ratePerHour.toFixed(2);
    
    // Update rate status
    const rateStatus = document.getElementById('rateStatus');
    if (ratePerHour > 0) {
        rateStatus.textContent = 'Charging';
        rateStatus.style.color = '#3b82f6';
    } else if (ratePerHour < 0) {
        rateStatus.textContent = 'Discharging';
        rateStatus.style.color = '#f97316';
    } else {
        rateStatus.textContent = 'Stable';
        rateStatus.style.color = '#9ca3af';
    }
    
    // Battery
    const battery = parseFloat(data.battery) || 0;
    console.log('Battery value:', battery);
    document.getElementById('batteryValue').textContent = Math.round(battery);
    
    // Update battery fill
    const batteryFill = document.getElementById('batteryFill');
    batteryFill.style.width = `${battery}%`;
    
    if (battery >= 70) {
        batteryFill.style.background = '#10b981';
    } else if (battery >= 30) {
        batteryFill.style.background = '#fbbf24';
    } else {
        batteryFill.style.background = '#ef4444';
    }
    
    // Update System Health metrics
    updateSystemHealth(data);
    
    // Update additional metrics
    updateAdditionalMetrics(data);
    
    // Update map readings if on Fixed Location tab
    document.getElementById('mapWaterLevel').textContent = waterLevel.toFixed(1);
    document.getElementById('mapRate').textContent = ratePerHour.toFixed(2);
    document.getElementById('mapBattery').textContent = Math.round(battery);
}

// Update System Health Card
function updateSystemHealth(data) {
    // Calculate metrics
    const lastSeen = data.last_seen_seconds || 0;
    let lastSeenText = 'Just now';
    
    // Fixed Logic
    if (lastSeen < 60) {
        lastSeenText = 'Just now';
    } else if (lastSeen < 3600) {
        const minutes = Math.floor(lastSeen / 60);
        lastSeenText = `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
    } else if (lastSeen < 86400) {
        const hours = Math.floor(lastSeen / 3600);
        lastSeenText = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        const days = Math.floor(lastSeen / 86400);
        lastSeenText = `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    document.getElementById('lastSeenValue').textContent = lastSeenText;
    
    // Device uptime calculation (if online within 5 minutes, consider online)
    const isOnline = lastSeen < 300;
    const uptimePercent = isOnline ? 100 : Math.max(0, 100 - (lastSeen / 864) * 10); // Rough estimate
    document.getElementById('uptimeValue').textContent = `${uptimePercent.toFixed(1)}%`;
    
    // Data points per hour will be calculated from history
    calculateDataPointsPerHour();
}

// Calculate data points per hour
async function calculateDataPointsPerHour() {
    if (!currentDevice) return;
    
    try {
        const response = await fetch(`${window.CONFIG.API_BASE}?action=history&deviceID=${currentDevice}&hours=1&limit=100`);
        const result = await response.json();
        
        if (result.data) {
            const dataPoints = result.data.length;
            document.getElementById('dataPointsValue').textContent = dataPoints;
        }
    } catch (error) {
        console.error('Error calculating data points:', error);
    }
}

// Update additional metrics (min/max water level, avg rate)
async function updateAdditionalMetrics(data) {
    if (!currentDevice) return;
    
    try {
        const response = await fetch(`${window.CONFIG.API_BASE}?action=history&deviceID=${currentDevice}&hours=1&limit=100`);
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
            // Calculate min/max water level
            const levels = result.data.map(item => parseFloat(item.distance) || 0).filter(v => !isNaN(v));
            const minLevel = levels.length > 0 ? Math.min(...levels) : 0;
            const maxLevel = levels.length > 0 ? Math.max(...levels) : 0;
            
            document.getElementById('minWaterLevel').textContent = minLevel.toFixed(1);
            document.getElementById('maxWaterLevel').textContent = maxLevel.toFixed(1);
            
            // Calculate average rate per hour
            // UPDATED: Use 278 seconds (approx 5 min) as cycle base
            const ratesPerHour = result.data
                .map(item => {
                    const rateCycle = parseFloat(item.rate);
                    // Corrected divisor from 65 to 278
                    return isNaN(rateCycle) ? null : (rateCycle / 278) * 3600;
                })
                .filter(v => v !== null);
            
            const avgRatePerHour = ratesPerHour.length > 0 
                ? ratesPerHour.reduce((a, b) => a + b, 0) / ratesPerHour.length 
                : 0;
            
            document.getElementById('avgRateValue').textContent = avgRatePerHour.toFixed(2);
        }
    } catch (error) {
        console.error('Error calculating additional metrics:', error);
    }
}

// Update chart data
async function updateChartData() {
    if (!currentDevice) return;
    
    try {
        let data = [];
        let url = '';
        
        // Real-Time: 3 hours of raw data
        if (currentChartMode === 'realtime') {
            url = `${window.CONFIG.API_BASE}?action=history&deviceID=${currentDevice}&hours=3&limit=100`;
        } 
        // For 1H: use raw history data instead of hourly aggregation
        else if (currentChartMode === 'hourly' && currentChartHours === 1) {
            url = `${window.CONFIG.API_BASE}?action=history&deviceID=${currentDevice}&hours=1&limit=100`;
        }
        // Hourly aggregated data for other time ranges
        else if (currentChartMode === 'hourly') {
            const days = Math.max(1, Math.ceil(currentChartHours / 24));
            url = `${window.CONFIG.API_BASE}?action=hourly_history&deviceID=${currentDevice}&days=${days}`;
        }
        
        console.log('Fetching chart data from:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        console.log('API Response:', result);
        
        if (result.data) {
            data = result.data;
            console.log('Received data points:', data.length);
            console.log('Sample data:', data.slice(0, 2));
        } else {
            console.warn('No data returned from API');
        }
        
        updateCharts(data);
        
    } catch (error) {
        console.error('Error updating chart data:', error);
    }
}

// Initialize charts
function initCharts() {
    const waterLevelCtx = document.getElementById('waterLevelChart');
    const rateCtx = document.getElementById('rateChart');
    
    // Water Level Chart (will switch between line and bar)
    waterLevelChart = new Chart(waterLevelCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Water Level (cm)',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                fill: false,
                spanGaps: false // Breaks line on null
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Water Level Over Time'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Depth (cm)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            }
        }
    });
    
    // Rate Chart (will switch between line and bar)
    rateChart = new Chart(rateCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Charge/Discharge Rate (cm/hr)',
                data: [],
                borderColor: '#f97316',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                fill: false,
                spanGaps: false // Breaks line on null
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Charge/Discharge Rate Over Time'
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Rate (cm/hr)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            }
        }
    });
}

// Update charts with new data - INCLUDING GAP DETECTION AND DYNAMIC RATE
function updateCharts(data) {
    if (!waterLevelChart || !rateChart || !data || data.length === 0) {
        console.warn('Cannot update charts - missing data or chart not initialized');
        return;
    }
    
    // 1. Sort data by time ascending (Oldest -> Newest)
    const sortedData = [...data].sort((a, b) => {
        const timeA = a.receivedAt || a.hour_timestamp_utc || 0;
        const timeB = b.receivedAt || b.hour_timestamp_utc || 0;
        return timeA - timeB;
    });
    
    // Determine chart type
    const chartType = (currentChartMode === 'hourly' && currentChartHours >= 1) ? 'bar' : 'line';
    
    const labels = [];
    const waterLevelData = [];
    const rateData = [];
    
    // Helper to format timestamp
    const formatTime = (seconds, isHourly) => {
        const date = new Date(seconds * 1000);
        if (isHourly) {
            return date.toLocaleString('en-US', { 
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                timeZone: 'America/Mexico_City'
            });
        } else {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZone: 'America/Mexico_City'
            });
        }
    };
    
    // 2. Iterate through sorted data and detect gaps
    for (let i = 0; i < sortedData.length; i++) {
        const item = sortedData[i];
        const isHourlyData = item.hour_timestamp_utc !== undefined;
        
        let timestamp;
        let distanceVal = null;
        let calculatedRate = 0;
        let currentSeconds = 0;

        if (isHourlyData) {
            currentSeconds = item.hour_timestamp_utc;
            timestamp = formatTime(currentSeconds, true);
            const dist = parseFloat(item.avg_distance);
            distanceVal = isNaN(dist) ? null : dist;
        } else {
            currentSeconds = item.receivedAt;
            timestamp = formatTime(currentSeconds, false);
            const dist = parseFloat(item.distance);
            distanceVal = isNaN(dist) ? null : dist;
        }

        // --- NEW DYNAMIC RATE CALCULATION ---
        // Instead of using the device's reported rate, we calculate d(Distance)/d(Time)
        // This ensures the chart magnitude is correct regardless of reporting interval
        if (i > 0) {
            const prevItem = sortedData[i-1];
            const prevSeconds = isHourlyData ? prevItem.hour_timestamp_utc : prevItem.receivedAt;
            const prevDist = parseFloat(isHourlyData ? prevItem.avg_distance : prevItem.distance);

            // Calculate differences
            const timeDiff = currentSeconds - prevSeconds; // Seconds
            const distDiff = distanceVal - prevDist;       // CM

            // Avoid division by zero and massive jumps
            if (timeDiff > 0 && !isNaN(distDiff) && !isNaN(timeDiff)) {
                // Formula: (Change in CM / Change in Seconds) * 3600 = CM/Hr
                calculatedRate = (distDiff / timeDiff) * 3600;
            } else {
                calculatedRate = 0; // Default to 0 if timeDiff is 0
            }
        } else {
            // First point has no previous reference, default to 0 (or null)
            calculatedRate = 0;
        }

        // Add Valid Point
        labels.push(timestamp);
        waterLevelData.push(distanceVal);
        rateData.push(calculatedRate);

        // --- GAP DETECTION Logic ---
        // Check if there is a next item to compare with
        if (i < sortedData.length - 1) {
            const nextItem = sortedData[i+1];
            const nextSeconds = nextItem.hour_timestamp_utc || nextItem.receivedAt;
            const diffSeconds = nextSeconds - currentSeconds;
            
            // Define threshold based on data type
            // Realtime: Expect every ~278s. Gap if > 900s (15m)
            // Hourly: Expect every 3600s (1h). Gap if > 5400s (1.5h)
            const threshold = isHourlyData ? 5400 : 900; 

            if (diffSeconds > threshold) {
                // Determine offline duration string
                let durationStr = "";
                if (diffSeconds < 3600) {
                    durationStr = `${Math.floor(diffSeconds/60)}m`;
                } else if (diffSeconds < 86400) {
                    durationStr = `${(diffSeconds/3600).toFixed(1)}h`;
                } else {
                    durationStr = `${(diffSeconds/86400).toFixed(1)} days`;
                }

                // Insert a "null" point to break the line
                const gapLabel = `OFFLINE (${durationStr})`;
                
                labels.push(gapLabel);
                waterLevelData.push(null); // Null breaks the line
                rateData.push(null);       // Null breaks the line
            }
        }
    }
    
    // Update Water Level Chart
    waterLevelChart.config.type = chartType;
    waterLevelChart.data.labels = labels;
    waterLevelChart.data.datasets[0].data = waterLevelData;
    waterLevelChart.update();
    
    // Update Rate Chart
    rateChart.config.type = chartType;
    rateChart.data.labels = labels;
    rateChart.data.datasets[0].data = rateData;
    rateChart.update();
}

// Update chart range
function updateChartRange(mode, hours) {
    currentChartMode = mode;
    currentChartHours = hours;
    
    console.log('Chart range updated:', mode, hours, 'hours');
    
    // Update active button
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Fetch new data
    updateChartData();
}

// Change device
function changeDevice() {
    const select = document.getElementById('deviceSelect');
    currentDevice = select.value;
    if (currentDevice) {
        fetchData();
    }
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefreshEnabled) {
        btn.innerHTML = '<span class="btn-icon">⏸️</span> Pause Auto-Refresh';
        startAutoRefresh();
    } else {
        btn.innerHTML = '<span class="btn-icon">▶️</span> Resume Auto-Refresh';
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    }
}

// Start auto-refresh
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    refreshCountdown = 10;
    
    autoRefreshInterval = setInterval(() => {
        if (autoRefreshEnabled) {
            refreshCountdown--;
            document.getElementById('refreshCounter').textContent = `${refreshCountdown}s`;
            
            // Update relative time display every 30 seconds (not every second)
            if (refreshCountdown % 30 === 0) {
                updateRelativeTime();
            }
            
            if (refreshCountdown <= 0) {
                fetchData();
                refreshCountdown = 10;
            }
        }
    }, 1000);
}

// Update status
function updateStatus(status, text) {
    const indicator = document.getElementById('apiStatus');
    const statusText = document.getElementById('apiStatusText');
    
    indicator.className = 'status-indicator';
    
    if (status === 'online') {
        indicator.classList.add('online');
    } else if (status === 'offline') {
        indicator.classList.add('offline');
    }
    
    statusText.textContent = text;
}

// Global variable to track last update time
let lastUpdateTimestamp = null;
let lastUpdateInterval = null;

// Update last update time
function updateLastUpdateTime() {
    lastUpdateTimestamp = Date.now();
    document.getElementById('lastUpdate').textContent = 'Just now';
    
    // Clear existing interval if any
    if (lastUpdateInterval) {
        clearInterval(lastUpdateInterval);
    }
    
    // Update the display every 10 seconds
    lastUpdateInterval = setInterval(updateRelativeTime, 10000);
}

// Update relative time display
function updateRelativeTime() {
    if (!lastUpdateTimestamp) return;
    
    const secondsAgo = Math.floor((Date.now() - lastUpdateTimestamp) / 1000);
    const lastUpdateEl = document.getElementById('lastUpdate');
    
    // Updated Logic
    if (secondsAgo < 60) {
        lastUpdateEl.textContent = 'Just now';
    } else if (secondsAgo < 3600) {
        const minutes = Math.floor(secondsAgo / 60);
        lastUpdateEl.textContent = `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
    } else if (secondsAgo < 86400) {
        const hours = Math.floor(secondsAgo / 3600);
        lastUpdateEl.textContent = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (secondsAgo < 604800) { 
        const days = Math.floor(secondsAgo / 86400);
        lastUpdateEl.textContent = `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else if (secondsAgo < 2592000) { 
        const weeks = Math.floor(secondsAgo / 604800);
        lastUpdateEl.textContent = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
        const months = Math.floor(secondsAgo / 2592000); 
        lastUpdateEl.textContent = `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
}

// Switch tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'dashboard') {
        document.getElementById('dashboard-tab').classList.add('active');
        document.querySelector('.tab-btn').classList.add('active');
    } else if (tabName === 'fixed-map') {
        document.getElementById('fixed-map-tab').classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        
        // Load device location if available
        if (currentDevice) {
            const locationSelect = document.getElementById('locationDeviceSelect');
            locationSelect.value = currentDevice;
            loadDeviceLocation();
        }
    }
}

// Load saved locations from localStorage
function loadSavedLocations() {
    try {
        const saved = localStorage.getItem('smaawa_device_locations');
        if (saved) {
            deviceLocations = JSON.parse(saved);
            console.log('Loaded saved locations:', deviceLocations);
        }
    } catch (error) {
        console.error('Error loading saved locations:', error);
    }
}

// Save locations to localStorage
function saveLocations() {
    try {
        localStorage.setItem('smaawa_device_locations', JSON.stringify(deviceLocations));
        console.log('Saved locations:', deviceLocations);
    } catch (error) {
        console.error('Error saving locations:', error);
    }
}

// Load device location
function loadDeviceLocation() {
    const deviceID = document.getElementById('locationDeviceSelect').value;
    
    if (deviceID && deviceLocations[deviceID]) {
        const location = deviceLocations[deviceID];
        document.getElementById('locationName').value = location.name || '';
        document.getElementById('latitude').value = location.lat;
        document.getElementById('longitude').value = location.lng;
        
        // Show saved location info
        document.getElementById('savedLocationName').textContent = location.name || 'Not set';
        document.getElementById('savedLat').textContent = location.lat;
        document.getElementById('savedLng').textContent = location.lng;
        document.getElementById('locationSaved').style.display = 'block';
        
        // Show map
        showDeviceOnMap(location.lat, location.lng, deviceID);
    } else {
        // Clear form
        document.getElementById('locationName').value = '';
        document.getElementById('latitude').value = '';
        document.getElementById('longitude').value = '';
        document.getElementById('locationSaved').style.display = 'none';
        document.getElementById('mapSection').style.display = 'none';
    }
}

// Save device location
function saveDeviceLocation() {
    const deviceID = document.getElementById('locationDeviceSelect').value;
    const name = document.getElementById('locationName').value;
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    
    if (!deviceID) {
        alert('Please select a device');
        return;
    }
    
    if (isNaN(lat) || isNaN(lng)) {
        alert('Please enter valid latitude and longitude');
        return;
    }
    
    // Save location
    deviceLocations[deviceID] = {
        name: name,
        lat: lat,
        lng: lng
    };
    
    // IMPORTANT: Save to localStorage so it persists across page refreshes
    saveLocations();
    
    // Show saved location
    document.getElementById('savedLocationName').textContent = name || 'Not set';
    document.getElementById('savedLat').textContent = lat;
    document.getElementById('savedLng').textContent = lng;
    document.getElementById('locationSaved').style.display = 'block';
    
    // Show map
    showDeviceOnMap(lat, lng, deviceID);
    
    alert('✅ Location saved successfully! It will persist across page refreshes.');
}

// Show device on map
async function showDeviceOnMap(lat, lng, deviceID) {
    document.getElementById('mapSection').style.display = 'block';
    
    // Fetch latest data for the device
    let deviceData = null;
    try {
        const response = await fetch(`${window.CONFIG.API_BASE}?action=latest&deviceID=${deviceID}`);
        const result = await response.json();
        deviceData = result.data || result;
    } catch (error) {
        console.error('Error fetching device data for map:', error);
    }
    
    // Initialize map if not exists
    if (!fixedMap) {
        fixedMap = L.map('fixedMap').setView([lat, lng], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(fixedMap);
    } else {
        fixedMap.setView([lat, lng], 15);
    }
    
    // Remove existing marker
    if (fixedMarker) {
        fixedMap.removeLayer(fixedMarker);
    }
    
    // Create popup content with device readings
    let popupContent = `<div style="min-width: 220px;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 1.1em;"><b>${deviceID}</b></h3>
        <p style="margin: 5px 0; color: #6b7280; font-size: 0.9em;">${deviceLocations[deviceID]?.name || 'Water Monitoring Station'}</p>`;
    
    if (deviceData) {
        // Format timestamp
        const timestamp = new Date(deviceData.receivedAt * 1000 || deviceData.timestamp * 1000);
        const timeStr = timestamp.toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Mexico_City'
        });
        
        popupContent += `
        <hr style="margin: 10px 0; border: none; border-top: 1px solid #e5e7eb;">
        <div style="margin-bottom: 10px; padding: 5px; background: #f3f4f6; border-radius: 4px;">
            <div style="font-size: 0.75em; color: #6b7280;">📅 Last Measurement</div>
            <div style="font-size: 0.85em; color: #374151; font-weight: 600;">${timeStr}</div>
        </div>
        <div style="display: grid; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6b7280; font-size: 0.85em;">💧 Water Level:</span>
                <strong style="color: #3b82f6; font-size: 1em;">${parseFloat(deviceData.distance || 0).toFixed(1)} cm</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6b7280; font-size: 0.85em;">📈 Rate:</span>
                <strong style="color: #f97316; font-size: 1em;">${((parseFloat(deviceData.rate || 0) / 278) * 3600).toFixed(2)} cm/hr</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #6b7280; font-size: 0.85em;">🔋 Battery:</span>
                <strong style="color: #10b981; font-size: 1em;">${Math.round(deviceData.battery || 0)}%</strong>
            </div>
        </div>`;
    }
    
    popupContent += `</div>`;
    
    // Add new marker with popup
    fixedMarker = L.marker([lat, lng]).addTo(fixedMap);
    fixedMarker.bindPopup(popupContent).openPopup();
}

// Show about dialog
function showAbout() {
    alert('SMAAWA Water Monitoring System v2.0\n\nA real-time IoT dashboard for monitoring water levels, charge/discharge rates, and battery status.\n\nPowered by AWS IoT Core');
}

// Show help dialog
function showHelp() {
    alert('SMAAWA Dashboard Help\n\n1. Select a device from the dropdown\n2. View real-time water level, rate, and battery data\n3. Use the Fixed Location tab to set device coordinates\n4. Charts update automatically every 10 seconds\n5. Click Refresh Now to update immediately');
}

// Export data to CSV
function exportData() {
    alert('Export functionality coming soon!\nYou will be able to export historical data to CSV format.');
}

console.log('SMAAWA Dashboard loaded successfully');