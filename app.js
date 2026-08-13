const MODEL_URL = 'https://storage.googleapis.com/tm-model/vQdkmTTY_/model.json';
const METADATA_URL = 'https://storage.googleapis.com/tm-model/vQdkmTTY_/metadata.json';

const EXERCISES = {
  squat: { label: 'Squat', phaseA: 'squat_down', phaseB: 'Squats_up' },
  jumpingJacks: { label: 'Jumping Jacks', phaseA: 'Jumping_jacks_down', phaseB: 'Jumping_jacks_up' },
  sitUp: { label: 'Sit Up', phaseA: 'Sit_up_down', phaseB: 'Sit_up_up' },
  lunge: { label: 'Lunge', phaseA: 'Lunges_right', phaseB: 'Lunges_left' },
  toeTouch: { label: 'Toe Touch', phaseA: 'Toe_touch_right', phaseB: 'Toe_touch_left' },
  highKnees: { label: 'High Knees', phaseA: 'High_knees_right', phaseB: 'High_knees_left' }
};

const repCountEl = document.getElementById('rep-count');
const predictedLabelEl = document.getElementById('predicted-label');
const confidenceEl = document.getElementById('confidence');
const statusEl = document.getElementById('status');
const exerciseSelectEl = document.getElementById('exercise-select');
const phaseBadgeEl = document.getElementById('phase-badge');
const webcamEl = document.getElementById('webcam');

let model;
let repCount = 0;
let previousLabel = null;
let phaseASeen = false;
let activeExerciseKey = 'squat';

function updateRepDisplay() {
  repCountEl.textContent = String(repCount);
}

function updateStatus(message) {
  statusEl.textContent = message;
}

function setPhaseBadge(text, tone = 'normal') {
  phaseBadgeEl.textContent = text;
  phaseBadgeEl.style.borderColor = tone === 'success' ? 'rgba(34, 197, 94, 0.6)' : 'rgba(148, 163, 184, 0.3)';
  phaseBadgeEl.style.color = tone === 'success' ? '#a7f3d0' : '#e2e8f0';
}

function resetExerciseState() {
  previousLabel = null;
  phaseASeen = false;
  repCount = 0;
  updateRepDisplay();
  setPhaseBadge('Standby');
}

function getCurrentExercise() {
  return EXERCISES[activeExerciseKey];
}

function handleRepCounting(currentLabel) {
  const exercise = getCurrentExercise();
  if (!exercise) return;

  const { phaseA, phaseB } = exercise;

  if (currentLabel === 'Nothing/Resting') {
    phaseASeen = false;
    setPhaseBadge('Rest');
    previousLabel = currentLabel;
    return;
  }

  if (currentLabel === phaseA) {
    phaseASeen = true;
    setPhaseBadge('Phase A');
    previousLabel = currentLabel;
    return;
  }

  if (currentLabel === phaseB && phaseASeen && previousLabel !== phaseB) {
    repCount += 1;
    updateRepDisplay();
    phaseASeen = false;
    setPhaseBadge('Rep counted!', 'success');
    updateStatus(`${exercise.label} rep counted`);
    previousLabel = currentLabel;
    return;
  }

  if (currentLabel === phaseB) {
    setPhaseBadge('Phase B');
  }

  previousLabel = currentLabel;
}

async function startWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateStatus('Webcam access is not available in this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });

    webcamEl.srcObject = stream;
    await webcamEl.play();
    updateStatus('Webcam ready');
  } catch (error) {
    console.error(error);
    updateStatus('Camera permission was denied. Please allow webcam access.');
  }
}

async function loadModel() {
  try {
    updateStatus('Loading Teachable Machine model…');

    const modelResponse = await fetch(MODEL_URL);
    const metadataResponse = await fetch(METADATA_URL);

    console.log('Model fetch status:', modelResponse.status, modelResponse.statusText);
    console.log('Metadata fetch status:', metadataResponse.status, metadataResponse.statusText);

    if (!modelResponse.ok) {
      const modelText = await modelResponse.text();
      console.error('Model fetch failed:', {
        url: MODEL_URL,
        status: modelResponse.status,
        statusText: modelResponse.statusText,
        response: modelText
      });
      throw new Error(`Model fetch failed: ${modelResponse.status} ${modelResponse.statusText}`);
    }

    if (!metadataResponse.ok) {
      const metadataText = await metadataResponse.text();
      console.error('Metadata fetch failed:', {
        url: METADATA_URL,
        status: metadataResponse.status,
        statusText: metadataResponse.statusText,
        response: metadataText
      });
      throw new Error(`Metadata fetch failed: ${metadataResponse.status} ${metadataResponse.statusText}`);
    }

    model = await tmImage.load(MODEL_URL, METADATA_URL);
    updateStatus('Model loaded. Starting live detection…');
    await predictLoop();
  } catch (error) {
    console.error('Full model load error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    updateStatus('Could not load the model. Check the internet connection and try again.');
  }
}

function updateLabelUI(prediction) {
  predictedLabelEl.textContent = prediction.className;
  confidenceEl.textContent = `${Math.round(prediction.probability * 100)}%`;
}

async function predictLoop() {
  if (!model || !webcamEl.videoWidth) {
    requestAnimationFrame(predictLoop);
    return;
  }

  const prediction = await model.predict(webcamEl);
  const topPrediction = prediction
    .slice()
    .sort((a, b) => b.probability - a.probability)[0];

  updateLabelUI(topPrediction);

  if (topPrediction.probability > 0.5) {
    handleRepCounting(topPrediction.className);
  }

  previousLabel = topPrediction.className;
  setTimeout(predictLoop, 180);
}

exerciseSelectEl.addEventListener('change', (event) => {
  activeExerciseKey = event.target.value;
  const exercise = EXERCISES[activeExerciseKey];
  updateStatus(`${exercise.label} selected`);
  resetExerciseState();
});

async function init() {
  resetExerciseState();
  await startWebcam();
  await loadModel();
}

init();
