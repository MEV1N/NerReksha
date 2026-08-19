/**
 * ML Risk Predictor Orchestrator
 */

const MLRiskPredictor = {
    /**
     * Tries to predict risk using the ML model, falls back to rule-based on failure
     * @param {Object} features 
     * @returns {Object} { risk, source }
     */
    predict: function(features) {
        let risk = 0.0;
        let source = 'ml';

        try {
            if (typeof window.MLModel !== 'undefined' && window.MLModel.predict) {
                risk = window.MLModel.predict(features);
            } else {
                throw new Error("MLModel not loaded");
            }
        } catch (e) {
            console.warn("ML prediction failed, using fallback rule-based model.", e);
            source = 'fallback';
            if (typeof window.MLFallbackModel !== 'undefined') {
                risk = window.MLFallbackModel.predict(features);
            } else {
                risk = 0.0; // Ultimate safety net if nothing loaded
            }
        }

        // Clamp risk to 0-1
        risk = Math.max(0, Math.min(1.0, risk));

        return { risk, source };
    }
};

window.MLRiskPredictor = MLRiskPredictor;
