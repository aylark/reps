# Reps

A lightweight web app that uses the exported Teachable Machine model to detect exercise phases from the webcam and count reps in real time.

## Features

- Webcam feed is displayed in the browser
- You can pick the exercise type from a dropdown
- Reps count when the model detects the exercise phase sequence, such as squat down then squat up = 1 rep

## Run locally

From this project folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Notes

- The app loads the exported model from the Teachable Machine URL provided for this project.
- Allow webcam access when the browser prompts for permission.
- For best results, stand clearly in frame and use a single exercise at a time.
