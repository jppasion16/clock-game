const MINUTES_PER_HOUR = 60;
const MINUTES_PER_CLOCK = 12 * MINUTES_PER_HOUR;
const MINUTE_STEP = 5;
const ROUND_COUNT = 10;
const CORRECT_FEEDBACK_MS = 650;
const INSTRUCTION_CLIP = "audios/set the clock to.mp3";
const AUDIO_CLIP_TIMEOUT_MS = 8000;
const CLOCK_CENTER_X = 724;
const CLOCK_CENTER_Y = 550;
const POINTER_DEAD_ZONE_RADIUS = 35;
const HAND_DEGREES_PER_MINUTE = { hour: 0.5, minute: 6 };

function formatElapsedTime(elapsedMs, format = "stopwatch") {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (format === "duration") return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

class ClockFace {
  constructor(element, onRelease) {
    this.element = element;
    this.hourHand = element.querySelector("#hour-hand");
    this.minuteHand = element.querySelector("#minute-hand");
    this.onRelease = onRelease;
    this.drag = null;
    this.setTime(4 * MINUTES_PER_HOUR);

    element.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    element.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    element.addEventListener("pointerup", (event) => this.handlePointerUp(event));
    element.addEventListener("pointercancel", (event) => this.cancelDrag(event));
    element.addEventListener("lostpointercapture", (event) => this.cancelDrag(event));
  }

  setTime(minutes) {
    this.totalMinutes = minutes;
    this.render();
  }

  getTime() {
    return ((this.totalMinutes % MINUTES_PER_CLOCK) + MINUTES_PER_CLOCK) % MINUTES_PER_CLOCK;
  }

  render() {
    this.hourHand.setAttribute("transform", `rotate(${this.totalMinutes * HAND_DEGREES_PER_MINUTE.hour})`);
    this.minuteHand.setAttribute("transform", `rotate(${this.totalMinutes * HAND_DEGREES_PER_MINUTE.minute})`);
  }

  setInteractive(enabled) {
    this.element.classList.toggle("is-interactive", enabled);
    if (!enabled) this.cancelDrag();
  }

  pointerAngle(event) {
    const bounds = this.element.getBoundingClientRect();
    const viewBox = this.element.viewBox.baseVal;
    const x = ((event.clientX - bounds.left) * viewBox.width) / bounds.width - CLOCK_CENTER_X;
    const y = ((event.clientY - bounds.top) * viewBox.height) / bounds.height - CLOCK_CENTER_Y;

    // The direction is ambiguous close to the center pivot.
    return Math.hypot(x, y) < POINTER_DEAD_ZONE_RADIUS ? null : (Math.atan2(x, -y) * 180) / Math.PI;
  }

  handlePointerDown(event) {
    const hand = event.target.dataset.hand;
    if (!this.element.classList.contains("is-interactive") || !hand || this.drag || event.button !== 0) return;

    this.element.setPointerCapture(event.pointerId);
    this.drag = {
      pointerId: event.pointerId,
      angle: this.pointerAngle(event),
      startMinutes: this.totalMinutes,
      degreesPerMinute: HAND_DEGREES_PER_MINUTE[hand],
    };
    this.element.classList.add("is-dragging");
  }

  handlePointerMove(event) {
    const drag = this.drag;
    if (event.pointerId !== drag?.pointerId) return;

    const angle = this.pointerAngle(event);
    if (angle !== null && drag.angle !== null) {
      // Unwrap the angles so crossing 12 or 6 continues in the same direction.
      const delta = ((angle - drag.angle + 540) % 360) - 180;
      this.setTime(this.totalMinutes + delta / drag.degreesPerMinute);
    }
    drag.angle = angle;
  }

  handlePointerUp(event) {
    if (event.pointerId !== this.drag?.pointerId) return;

    this.handlePointerMove(event);
    this.endDrag();
    this.setTime(Math.round(this.totalMinutes / MINUTE_STEP) * MINUTE_STEP);
    this.onRelease(this.getTime());
  }

  cancelDrag(event) {
    if (!this.drag || (event && event.pointerId !== this.drag.pointerId)) return;

    this.setTime(this.drag.startMinutes);
    this.endDrag();
  }

  endDrag() {
    const { pointerId } = this.drag;
    this.drag = null;
    this.element.classList.remove("is-dragging");
    if (this.element.hasPointerCapture(pointerId)) this.element.releasePointerCapture(pointerId);
  }
}

class AudioManager {
  constructor() {
    this.audio = new Audio();
    this.muted = false;
    this.sequence = null;
  }

  prepare() {
    if (this.muted) return;

    // Load during the Play gesture so WebKit can authorize this element before the intro.
    this.audio.src = INSTRUCTION_CLIP;
    this.audio.load();
  }

  playTime(hour, minute) {
    if (this.sequence) this.stop();
    if (this.muted) return Promise.resolve();

    const clips = [INSTRUCTION_CLIP];
    if (minute === "00") {
      clips.push(`audios/oclock/${hour} oclock.mp3`);
    } else {
      clips.push(`audios/hours/${hour}.mp3`, `audios/minutes/${minute}.mp3`);
    }

    return new Promise((resolve) => {
      const sequence = new AbortController();
      const { signal } = sequence;
      this.sequence = sequence;
      let nextClip = 0;
      let timeout;

      const finish = () => {
        if (this.sequence === sequence) this.stop();
      };
      const playNext = () => {
        clearTimeout(timeout);
        if (nextClip === clips.length) {
          finish();
          return;
        }

        const clip = clips[nextClip++];
        if (this.audio.getAttribute("src") !== clip) this.audio.src = clip;
        // A stalled or interrupted clip must eventually release the round.
        timeout = setTimeout(finish, AUDIO_CLIP_TIMEOUT_MS);
        this.audio.play().catch(finish);
      };

      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.audio.addEventListener("ended", playNext, { signal });
      this.audio.addEventListener("error", finish, { signal });
      this.audio.addEventListener(
        "pause",
        () => {
          if (this.audio.paused && !this.audio.ended) finish();
        },
        { signal },
      );
      playNext();
    });
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stop();
  }

  stop() {
    this.sequence?.abort();
    this.sequence = null;
    if (!this.audio.hasAttribute("src")) return;

    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}

class ClockGame {
  constructor() {
    this.clock = new ClockFace(document.querySelector("#clock-face"), (time) => this.checkAnswer(time));
    this.display = createSevenSegmentClock(document.querySelector("#target-time"));
    this.audio = new AudioManager();
    this.playScreen = document.querySelector("#play-screen");
    this.screenTitle = document.querySelector("#screen-title");
    this.screenMessage = document.querySelector("#screen-message");
    this.playButton = document.querySelector("#play-button");
    this.soundButton = document.querySelector("#sound-button");
    this.hud = document.querySelector("#round-hud");
    this.roundLabel = document.querySelector("#round-label");
    this.progress = document.querySelector("#round-progress");
    this.status = document.querySelector("#round-status");
    this.timer = document.querySelector("#game-timer");
    this.state = "ready";
    this.elapsedMs = 0;
    this.activeSince = null;

    this.playButton.addEventListener("click", () => this.start());
    this.soundButton.addEventListener("click", () => this.toggleSound());
  }

  start() {
    this.pauseTimer();
    this.elapsedMs = 0;
    this.updateTimer();
    this.round = 0;
    this.progress.value = 0;
    this.availableTimes = [];
    for (let time = 0; time < MINUTES_PER_CLOCK; time += MINUTE_STEP) {
      this.availableTimes.push(time);
    }

    this.playScreen.hidden = true;
    this.hud.hidden = false;
    this.soundButton.disabled = false;
    this.nextRound();
  }

  generateRandomTime() {
    const index = Math.floor(Math.random() * this.availableTimes.length);
    return this.availableTimes.splice(index, 1)[0];
  }

  async nextRound() {
    this.roundController?.abort();
    clearTimeout(this.roundTransition);
    this.audio.stop();
    this.roundController = new AbortController();
    const { signal } = this.roundController;

    this.state = "round-intro";
    this.pauseTimer();
    this.clock.setInteractive(false);
    this.round += 1;
    this.target = this.generateRandomTime();
    if (this.round === 1) {
      const initialHour = this.target === 4 * MINUTES_PER_HOUR ? 3 : 4;
      this.clock.setTime(initialHour * MINUTES_PER_HOUR);
      this.audio.prepare();
    }

    const hour = Math.floor(this.target / MINUTES_PER_HOUR) || 12;
    const minute = String(this.target % MINUTES_PER_HOUR).padStart(2, "0");
    this.roundLabel.textContent = `Round ${this.round} of ${ROUND_COUNT}`;
    this.status.textContent = "Get ready…";
    this.status.classList.remove("is-correct");
    const reveal = this.display.startShuffle(`${hour}:${minute}`, signal);

    if (this.audio.muted) {
      await reveal({ brief: true });
    } else {
      this.state = "narrating";
      this.status.textContent = "Listen…";
      await this.audio.playTime(hour, minute);
      if (signal.aborted) return;

      this.state = "revealing";
      this.status.textContent = "Get ready…";
      await reveal({ immediate: this.audio.muted });
    }
    if (signal.aborted) return;

    this.state = "playing";
    this.status.textContent = "Your turn!";
    this.clock.setInteractive(true);
    this.resumeTimer();
  }

  checkAnswer(time) {
    if (this.state !== "playing") return;
    if (time !== this.target) {
      this.status.textContent = "Try again!";
      return;
    }

    this.state = "correct-feedback";
    this.pauseTimer();
    this.clock.setInteractive(false);
    this.progress.value = this.round;
    this.status.textContent = "Great job!";
    this.status.classList.add("is-correct");
    const { signal } = this.roundController;
    this.roundTransition = setTimeout(() => {
      if (signal.aborted) return;
      if (this.round === ROUND_COUNT) this.finishGame();
      else this.nextRound();
    }, CORRECT_FEEDBACK_MS);
  }

  resumeTimer() {
    if (this.activeSince !== null) return;

    this.activeSince = performance.now();
    this.updateTimer();
  }

  pauseTimer() {
    if (this.activeSince === null) return;

    this.elapsedMs += performance.now() - this.activeSince;
    this.activeSince = null;
    clearTimeout(this.timerUpdate);
    this.updateTimer();
  }

  updateTimer() {
    const activeMs = this.activeSince === null ? 0 : performance.now() - this.activeSince;
    const elapsed = this.elapsedMs + activeMs;
    const formatted = formatElapsedTime(elapsed);
    if (this.timer.textContent !== formatted) this.timer.textContent = formatted;

    if (this.activeSince !== null) {
      this.timerUpdate = setTimeout(() => this.updateTimer(), 1000 - (elapsed % 1000));
    }
  }

  finishGame() {
    this.roundController?.abort();
    this.state = "completed";
    const duration = formatElapsedTime(this.elapsedMs, "duration");

    this.hud.hidden = true;
    this.soundButton.disabled = true;
    this.screenTitle.textContent = "Great job!";
    this.screenMessage.textContent = `You set all ${ROUND_COUNT} clocks in ${duration}.`;
    this.playButton.setAttribute("aria-label", "Play again");
    this.playScreen.hidden = false;
    this.playButton.focus();
  }

  toggleSound() {
    const muted = !this.audio.muted;
    this.audio.setMuted(muted);
    this.soundButton.setAttribute("aria-pressed", String(muted));
    this.soundButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  }
}

new ClockGame();
