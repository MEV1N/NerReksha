/**
 * GPS handling for offline and online scenarios
 */

const GPS = {
    currentPosition: null,
    watchId: null,
    lastUpdate: 0,
    callbacks: [],

    init: function() {
        // Stop existing watch if any
        if (this.watchId) navigator.geolocation.clearWatch(this.watchId);

        if ('geolocation' in navigator) {
            this.watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    this.currentPosition = {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        timestamp: pos.timestamp
                    };
                    this.lastUpdate = Date.now();
                    this._notify();
                },
                (err) => {
                    console.warn("GPS error:", err.message);
                    // Do not clear position on error, just log it. Stale data might still be useful.
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 10000,
                    timeout: 5000
                }
            );
        } else {
            console.warn("Geolocation API not available in this browser.");
        }
    },

    getPosition: async function(forceRefresh = false) {
        if (!forceRefresh && this.currentPosition && (Date.now() - this.lastUpdate < 30000)) {
            return this.currentPosition;
        }

        return new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) {
                return reject(new Error("Geolocation not supported"));
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.currentPosition = {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        timestamp: pos.timestamp
                    };
                    this.lastUpdate = Date.now();
                    this._notify();
                    resolve(this.currentPosition);
                },
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    },

    subscribe: function(callback) {
        this.callbacks.push(callback);
    },
    
    unsubscribe: function(callback) {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    },

    _notify: function() {
        for (const cb of this.callbacks) {
            cb(this.currentPosition);
        }
    }
};

window.GPS = GPS;
