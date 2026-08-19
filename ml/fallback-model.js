/**
 * Fallback Rule-Based Risk Predictor
 * Used if the ML model fails to load or throws an error.
 */

const MLFallbackModel = {
    /**
     * Predicts risk (0.0 to 1.0) using heuristics
     * @param {Object} features 
     * @returns {Number}
     */
    predict: function(features) {
        if (features.hazardCount === 0) return 0.0;
        
        let risk = 0.0;

        // Floods
        if (features.floodDistance < 50) {
            risk = Math.max(risk, features.floodSeverity >= 3 ? 0.9 : 0.6);
        } else if (features.floodDistance < 150) {
            risk = Math.max(risk, features.floodSeverity >= 3 ? 0.6 : 0.3);
        }

        // Landslides
        if (features.landslideDistance < 100) {
            risk = Math.max(risk, features.landslideSeverity >= 3 ? 0.8 : 0.5);
        } else if (features.landslideDistance < 300) {
            risk = Math.max(risk, 0.4);
        }

        // Time decay (heuristic)
        if (features.reportAgeHours > 48 && features.confirmationCount === 0) {
            risk *= 0.2; // Severely discount old unconfirmed reports
        } else if (features.reportAgeHours > 12) {
            risk *= 0.6;
        }

        // Confirmation boost
        if (features.confirmationCount > 2) {
            risk = Math.min(1.0, risk * 1.5);
        }

        return risk;
    }
};

window.MLFallbackModel = MLFallbackModel;
