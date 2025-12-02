// SMAAWA Dashboard Configuration
window.CONFIG = {
    // API Base URL
    API_BASE: 'https://imrnh5ugn0.execute-api.us-east-1.amazonaws.com/default/getData',
    
    // Dashboard Settings
    DEFAULT_REFRESH_INTERVAL: 10, // seconds
    AUTO_REFRESH_ENABLED: true,
    
    // Chart Settings
    MAX_HISTORY_POINTS: 100,
    DEFAULT_TIME_RANGE: 'realtime',
    
    // Device Settings
    DEFAULT_DEVICE: 'SMAAWA_001',
    
    // Theme Colors
    COLORS: {
        primary: '#3b82f6',      // Blue
        secondary: '#f97316',    // Orange
        success: '#10b981',      // Green
        warning: '#fbbf24',      // Yellow
        danger: '#ef4444',       // Red
        waterLevel: '#3b82f6',
        rate: '#f97316',
        battery: '#10b981'
    },
    
    // Battery Thresholds
    BATTERY: {
        HIGH: 70,  // >= 70% is good
        LOW: 30    // < 30% is critical
    },
    
    // Water Level Alerts (optional - can be used for future features)
    WATER_LEVEL: {
        HIGH_THRESHOLD: 200,  // cm
        LOW_THRESHOLD: 20     // cm
    },
    
    // Map Settings
    MAP: {
        DEFAULT_ZOOM: 15,
        DEFAULT_CENTER: {
            lat: 19.4326,  // Mexico City
            lng: -99.1332
        }
    },
    
    // Debug Mode
    DEBUG: true  // Set to true for console logs
};

// Helper function for logging
window.log = function(...args) {
    if (window.CONFIG.DEBUG) {
        console.log('[SMAAWA]', ...args);
    }
};

// Helper function for error logging
window.logError = function(...args) {
    console.error('[SMAAWA ERROR]', ...args);
};