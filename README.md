// SMAAWA Dashboard - Utility Functions and Helpers
// This file contains additional helper functions that can be used across the application

// API Helper Functions
const API = {
    /**
     * Fetch all devices
     */
    async getDevices() {
        try {
            const response = await fetch(`${window.CONFIG.API_BASE}?action=devices`);
            const data = await response.json();
            window.log('Devices fetched:', data);
            return data.devices || [];
        } catch (error) {
            window.logError('Error fetching devices:', error);
            return [];
        }
    },

    /**
     * Fetch latest data for a specific device
     */
    async getLatestData(deviceID) {
        try {
            const response = await fetch(`${window.CONFIG.API_BASE}?action=latest&deviceID=${deviceID}`);
            const data = await response.json();
            window.log('Latest data fetched for', deviceID, ':', data);
            return data;
        } catch (error) {
            window.logError('Error fetching latest data:', error);
            return null;
        }
    },

    /**
     * Fetch historical data
     */
    async getHistoryData(deviceID, hours = 24, limit = 100) {
        try {
            const response = await fetch(
                `${window.CONFIG.API_BASE}?action=history&deviceID=${deviceID}&hours=${hours}&limit=${limit}`
            );
            const data = await response.json();
            window.log('History data fetched:', data);
            return data.data || [];
        } catch (error) {
            window.logError('Error fetching history data:', error);
            return [];
        }
    },

    /**
     * Fetch hourly aggregated data
     */
    async getHourlyData(deviceID, days = 7) {
        try {
            const response = await fetch(
                `${window.CONFIG.API_BASE}?action=hourly_history&deviceID=${deviceID}&days=${days}`
            );
            const data = await response.json();
            window.log('Hourly data fetched:', data);
            return data.data || [];
        } catch (error) {
            window.logError('Error fetching hourly data:', error);
            return [];
        }
    }
};

// Data Formatting Helpers
const Formatters = {
    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp, format = 'time') {
        const date = new Date(timestamp);
        
        if (format === 'time') {
            return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        } else if (format === 'datetime') {
            return date.toLocaleString('en-US', { 
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (format === 'date') {
            return date.toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
            });
        }
        
        return date.toISOString();
    },

    /**
     * Format water level value
     */
    formatWaterLevel(value) {
        const val = parseFloat(value);
        if (isNaN(val)) return '0.00';
        return val.toFixed(2);
    },

    /**
     * Format rate value
     */
    formatRate(value) {
        const val = parseFloat(value);
        if (isNaN(val)) return '0.00';
        return val.toFixed(2);
    },

    /**
     * Format battery percentage
     */
    formatBattery(value) {
        const val = parseFloat(value);
        if (isNaN(val)) return '0';
        return Math.round(val);
    }
};

// Status Helpers
const Status = {
    /**
     * Get battery status
     */
    getBatteryStatus(battery) {
        const val = parseFloat(battery);
        if (val >= window.CONFIG.BATTERY.HIGH) {
            return { level: 'high', color: 'green', icon: '🔋', text: 'Good' };
        } else if (val >= window.CONFIG.BATTERY.LOW) {
            return { level: 'medium', color: 'yellow', icon: '🔋', text: 'Medium' };
        } else {
            return { level: 'low', color: 'red', icon: '🪫', text: 'Low' };
        }
    },

    /**
     * Get rate status (charging/discharging)
     */
    getRateStatus(rate) {
        const val = parseFloat(rate);
        if (val > 0) {
            return { status: 'charging', color: 'blue', icon: '📈', text: 'Charging' };
        } else if (val < 0) {
            return { status: 'discharging', color: 'orange', icon: '📉', text: 'Discharging' };
        } else {
            return { status: 'stable', color: 'gray', icon: '➖', text: 'Stable' };
        }
    },

    /**
     * Get device connection status
     */
    getConnectionStatus(lastUpdate) {
        if (!lastUpdate) return { status: 'offline', color: 'red', text: 'Offline' };
        
        const now = new Date();
        const last = new Date(lastUpdate);
        const diffMinutes = (now - last) / 1000 / 60;
        
        if (diffMinutes < 5) {
            return { status: 'online', color: 'green', text: 'Online' };
        } else if (diffMinutes < 30) {
            return { status: 'warning', color: 'yellow', text: 'Slow' };
        } else {
            return { status: 'offline', color: 'red', text: 'Offline' };
        }
    },

    /**
     * Get water level alert status
     */
    getWaterLevelAlert(level) {
        const val = parseFloat(level);
        
        if (val >= window.CONFIG.WATER_LEVEL.HIGH_THRESHOLD) {
            return { alert: 'high', color: 'red', text: 'High Water Level', icon: '⚠️' };
        } else if (val <= window.CONFIG.WATER_LEVEL.LOW_THRESHOLD) {
            return { alert: 'low', color: 'yellow', text: 'Low Water Level', icon: '⚠️' };
        } else {
            return { alert: 'normal', color: 'green', text: 'Normal', icon: '✓' };
        }
    }
};

// Local Storage Helpers
const Storage = {
    /**
     * Save device locations
     */
    saveLocations(locations) {
        try {
            localStorage.setItem('smaawa_device_locations', JSON.stringify(locations));
            window.log('Locations saved:', locations);
        } catch (error) {
            window.logError('Error saving locations:', error);
        }
    },

    /**
     * Load device locations
     */
    loadLocations() {
        try {
            const data = localStorage.getItem('smaawa_device_locations');
            if (data) {
                const locations = JSON.parse(data);
                window.log('Locations loaded:', locations);
                return locations;
            }
        } catch (error) {
            window.logError('Error loading locations:', error);
        }
        return {};
    },

    /**
     * Save user preferences
     */
    savePreferences(prefs) {
        try {
            localStorage.setItem('smaawa_preferences', JSON.stringify(prefs));
            window.log('Preferences saved:', prefs);
        } catch (error) {
            window.logError('Error saving preferences:', error);
        }
    },

    /**
     * Load user preferences
     */
    loadPreferences() {
        try {
            const data = localStorage.getItem('smaawa_preferences');
            if (data) {
                const prefs = JSON.parse(data);
                window.log('Preferences loaded:', prefs);
                return prefs;
            }
        } catch (error) {
            window.logError('Error loading preferences:', error);
        }
        return {
            refreshInterval: window.CONFIG.DEFAULT_REFRESH_INTERVAL,
            autoRefresh: window.CONFIG.AUTO_REFRESH_ENABLED,
            timeRange: window.CONFIG.DEFAULT_TIME_RANGE
        };
    }
};

// Export Helpers
const Export = {
    /**
     * Export data to CSV
     */
    toCSV(data, filename = 'smaawa_data.csv') {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }

        // Get headers from first object
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csv = headers.join(',') + '\n';
        
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                // Escape commas and quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += values.join(',') + '\n';
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        window.log('Data exported to CSV:', filename);
    },

    /**
     * Export current dashboard as JSON
     */
    toJSON(data, filename = 'smaawa_data.json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        window.log('Data exported to JSON:', filename);
    }
};

// Map Helpers
const MapUtils = {
    /**
     * Generate OpenStreetMap embed URL
     */
    getOSMEmbedURL(lat, lng, zoom = 15) {
        const bbox = [
            lng - 0.01,
            lat - 0.01,
            lng + 0.01,
            lat + 0.01
        ].join(',');
        
        return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
    },

    /**
     * Generate Google Maps URL
     */
    getGoogleMapsURL(lat, lng) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    },

    /**
     * Calculate distance between two points (Haversine formula)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        return distance.toFixed(2); // km
    }
};

// Make utilities available globally
window.API = API;
window.Formatters = Formatters;
window.Status = Status;
window.Storage = Storage;
window.Export = Export;
window.MapUtils = MapUtils;

// Log initialization
window.log('SMAAWA Dashboard utilities loaded successfully');