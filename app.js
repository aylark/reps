const MODEL_URL =
  "https://storage.googleapis.com/tm-model/vQdkmTTY_/model.json";

const METADATA_URL =
  "https://storage.googleapis.com/tm-model/vQdkmTTY_/metadata.json";

const EXERCISES = {
  squat: {
    label: "Squat",
    phaseA: "squat_down",
    phaseB: "Squats_up"
  },

  jumpingJacks: {
    label: "Jumping Jacks",
    phaseA: "Jumping_jacks_down",
    phaseB: "Jumping_jacks_up"
  },

  sitUp: {
    label: "Sit Up",
    phaseA: "Sit_up_down",
    phaseB: "Sit_up_up"
  },

  lunge: {
    label: "Lunge",
    phaseA: "Lunges_right",
    phaseB: "Lunges_left"
  },

  toeTouch: {
    label: "Toe Touch",
    phaseA: "Toe_touch_right",
    phaseB: "Toe_touch_left"
  },

  highKnees: {
    label: "High Knees",
    phaseA: "High_knees_right",
    phaseB: "High_knees_left"
  }
};


/* -----------------------------
   DOM elements
----------------------------- */

const video =
  document.getElementById("webcam");

const status =
  document.getElementById("status");

const predictedLabel =
  document.getElementById("predicted-label");

const confidence =
  document.getElementById("confidence");

const exerciseSelect =
  document.getElementById("exercise-select");

const repCount =
  document.getElementById("rep-count");

const phaseBadge =
  document.getElementById("phase-badge");


/* -----------------------------
   State
----------------------------- */

let model = null;

let activeExercise = "squat";

let reps = 0;

/*
 * Has the first half of the movement
 * happened?
 */
let phaseASeen = false;

/*
 * Last accepted prediction.
 */
let previousLabel = null;

/*
 * Used to make the UI nicer.
 */
let lastRepTime = 0;


/* -----------------------------
   Settings
----------------------------- */

const CONFIDENCE_THRESHOLD = 0.50;

/*
 * Prevents a single rep from being
 * counted twice very quickly.
 */
const REP_COOLDOWN = 500;


/* -----------------------------
   UI helpers
----------------------------- */

function setStatus(message) {
  status.textContent = message;
  console.log(message);
}

function updateRepDisplay() {
  repCount.textContent = String(reps);
}

function setPhase(text, success = false) {
  phaseBadge.textContent = text;

  if (success) {
    phaseBadge.style.color = "#86efac";
    phaseBadge.style.borderColor =
      "rgba(34, 197, 94, 0.7)";
  } else {
    phaseBadge.style.color = "#e2e8f0";
    phaseBadge.style.borderColor =
      "rgba(148, 163, 184, 0.3)";
  }
}


/* -----------------------------
   Reset
----------------------------- */

function resetExercise() {
  reps = 0;

  phaseASeen = false;

  previousLabel = null;

  lastRepTime = 0;

  updateRepDisplay();

  setPhase("Standby");

  predictedLabel.textContent =
    "Waiting for movement...";

  confidence.textContent = "0%";

  const exercise =
    EXERCISES[activeExercise];

  setStatus(
    `${exercise.label} selected`
  );
}


/* -----------------------------
   Rep counting
----------------------------- */

function normalizeLabel(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function processPrediction(label) {

  const exercise =
    EXERCISES[activeExercise];

  if (!exercise) {
    return;
  }

  const phaseA =
    exercise.phaseA;

  const phaseB =
    exercise.phaseB;

  const normalizedLabel =
    normalizeLabel(label);

  const normalizedPhaseA =
    normalizeLabel(phaseA);

  const normalizedPhaseB =
    normalizeLabel(phaseB);

  const allowedLabels =
    new Set([
      normalizedPhaseA,
      normalizedPhaseB,
      "nothing_resting"
    ]);

  /*
   * Ignore any predictions that do
   * not belong to the selected exercise.
   */
  if (!allowedLabels.has(normalizedLabel)) {
    return;
  }


  /*
   * REST
   */
  if (normalizedLabel === "nothing_resting") {

    setPhase("Rest");

    /*
     * We don't want resting to count
     * as part of a rep.
     */
    previousLabel = label;

    return;
  }


  /*
   * PHASE A
   *
   * Example:
   *
   * squat_down
   */
  if (normalizedLabel === normalizedPhaseA) {

    phaseASeen = true;

    setPhase("Down");

    previousLabel = label;

    return;
  }


  /*
   * PHASE B
   *
   * Example:
   *
   * Squats_up
   */
  if (normalizedLabel === normalizedPhaseB) {

    const normalizedPreviousLabel =
      normalizeLabel(previousLabel);

    /*
     * Only count if we previously saw
     * Phase A.
     */
    if (
      phaseASeen &&
      normalizedPreviousLabel !== normalizedPhaseB
    ) {

      const now =
        Date.now();

      /*
       * Safety cooldown.
       */
      if (
        now - lastRepTime >
        REP_COOLDOWN
      ) {

        reps++;

        updateRepDisplay();

        lastRepTime = now;

        setPhase(
          "REP +1",
          true
        );

        setStatus(
          `${exercise.label}: ${reps} rep${reps === 1 ? "" : "s"}`
        );

        /*
         * Reset Phase A so another
         * rep requires another down.
         */
        phaseASeen = false;
      }

    } else {

      setPhase("Up");
    }

    previousLabel = label;

    return;
  }


  /*
   * Unknown class for this exercise.
   */
  previousLabel = label;
}


/* -----------------------------
   Camera
----------------------------- */

async function startCamera() {

  try {

    setStatus(
      "Starting camera..."
    );

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: false
        });

    video.srcObject = stream;

    await video.play();

    setStatus(
      "Camera working. Loading AI model..."
    );

  } catch (error) {

    console.error(
      "CAMERA ERROR:",
      error
    );

    setStatus(
      "Camera error: " +
      (error.message || error)
    );
  }
}


/* -----------------------------
   Load model
----------------------------- */

async function loadModel() {

  try {

    setStatus(
      "Loading AI model..."
    );

    /*
     * Keep this exactly like the
     * working version.
     */
    model = await tmImage.load(
      MODEL_URL,
      METADATA_URL
    );

    console.log(
      "MODEL LOADED:",
      model
    );

    setStatus(
      "MODEL LOADED! Detecting exercise..."
    );

    predict();

  } catch (error) {

    console.error(
      "MODEL ERROR:",
      error
    );

    setStatus(
      "MODEL ERROR: " +
      (error.message || error)
    );
  }
}


/* -----------------------------
   Prediction
----------------------------- */

async function predict() {

  if (!model) {
    return;
  }

  try {

    const predictions =
      await model.predict(video);


    /*
     * Find highest probability class.
     */
    let bestPrediction =
      predictions[0];

    for (
      const prediction
      of predictions
    ) {

      if (
        prediction.probability >
        bestPrediction.probability
      ) {

        bestPrediction =
          prediction;
      }
    }


    /*
     * Update display.
     */
    predictedLabel.textContent =
      bestPrediction.className;

    confidence.textContent =
      Math.round(
        bestPrediction.probability * 100
      ) + "%";


    /*
     * Only process predictions
     * above our basic threshold.
     */
    if (
      bestPrediction.probability >=
      CONFIDENCE_THRESHOLD
    ) {

      processPrediction(
        bestPrediction.className
      );
    }


  } catch (error) {

    console.error(
      "PREDICTION ERROR:",
      error
    );

    setStatus(
      "Prediction error: " +
      (error.message || error)
    );

    return;
  }


  /*
   * Keep predicting.
   */
  requestAnimationFrame(
    predict
  );
}


/* -----------------------------
   Exercise selector
----------------------------- */

exerciseSelect.addEventListener(
  "change",
  function () {

    activeExercise =
      this.value;

    resetExercise();
  }
);


/* -----------------------------
   Initialize
----------------------------- */

async function init() {

  resetExercise();

  await startCamera();

  await loadModel();
}

init();