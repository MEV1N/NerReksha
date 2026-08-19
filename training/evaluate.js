const fs = require('fs');
const path = require('path');

// Load the model by injecting a dummy window global
const window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'ml', 'model.js'), 'utf8'));
const MLModel = window.MLModel;

// Load dataset
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset', 'synthetic_data.json'), 'utf8'));

let tp = 0, tn = 0, fp = 0, fn = 0;
// Safety-first: threshold of 0.25 so the model errs on the side of caution.
// A road scoring >= 0.25 is treated as potentially unsafe.
const THRESHOLD = 0.25;

for (const sample of dataset) {
    const predicted = MLModel.predict(sample) >= THRESHOLD ? 1 : 0;
    const actual = sample.label;

    if (predicted === 1 && actual === 1) tp++;
    else if (predicted === 0 && actual === 0) tn++;
    else if (predicted === 1 && actual === 0) fp++;
    else if (predicted === 0 && actual === 1) fn++;
}

const total = tp + tn + fp + fn;
const accuracy = (tp + tn) / total;
const precision = tp / (tp + fp) || 0;
const recall = tp / (tp + fn) || 0; // True Positive Rate
const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

console.log("====================================================");
console.log("   NerReksha ML Road Risk Predictor - Evaluation");
console.log("====================================================");
console.log(`Dataset size       : ${total} samples`);
console.log(`Threshold          : ${THRESHOLD}`);
console.log("----------------------------------------------------");
console.log(`True Positives     : ${tp}`);
console.log(`True Negatives     : ${tn}`);
console.log(`False Positives    : ${fp}`);
console.log(`False Negatives    : ${fn}`);
console.log("----------------------------------------------------");
console.log(`Accuracy           : ${(accuracy * 100).toFixed(2)}%`);
console.log(`Precision          : ${(precision * 100).toFixed(2)}%`);
console.log(`Recall (TPR)       : ${(recall * 100).toFixed(2)}%`);
console.log(`F1 Score           : ${f1.toFixed(4)}`);
console.log("----------------------------------------------------");
console.log("");
console.log("⚠  FALSE NEGATIVES (most critical metric):");
console.log("   False negatives (FN) mean the model predicted a");
console.log("   road as SAFE but it was actually UNSAFE.");
console.log(`   FN count : ${fn} out of ${tp + fn} actual unsafe samples`);
if (tp + fn > 0) {
    const fnRate = (fn / (tp + fn) * 100).toFixed(2);
    console.log(`   FN Rate  : ${fnRate}% (lower is better for safety)`);
    if (parseFloat(fnRate) > 10) {
        console.log("   ⚠  WARNING: FN Rate is above 10%. Consider lowering the threshold.");
    } else {
        console.log("   ✓  FN Rate is acceptable.");
    }
}
console.log("====================================================");
