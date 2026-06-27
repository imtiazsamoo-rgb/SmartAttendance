/**
 * BFS Smart Attendance - FaceAuth.js
 * Admin Registration (3 distinct descriptors) & Teacher Daily (Passive 3-descriptor matching)
 */

const faceAuth = {
  videoEl: null, canvasEl: null, stream: null, isModelsLoaded: false, detectionLoop: null,
  
  regState: { stage: 'front', captures: { front: null, left: null, right: null }, stageStartTime: 0, forceCaptureFlag: false },
  
  async init() {
    try {
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      this.isModelsLoaded = true;
    } catch (e) {
      // Models failed to load, usually a network issue. Handled by generic failure downstream.
    }
  },

  async startCamera(videoId, canvasId, deviceId = null) {
    console.log("[Camera Audit] Starting startCamera. videoId:", videoId, "deviceId:", deviceId);
    if (!this.isModelsLoaded) throw new Error("Models loading.");
    
    // Stop existing stream if any to prevent blocking
    this.stopCamera();
    
    this.videoEl = document.getElementById(videoId); 
    this.canvasEl = document.getElementById(canvasId);
    
    if (!this.videoEl) {
      console.error("[Camera Audit] Video element not found in DOM.");
      throw new Error("Video element missing.");
    }

    if (!window.isSecureContext) {
      console.error("[Camera Audit] Not running in a secure context (HTTPS). getUserMedia requires HTTPS.");
      throw new Error("Insecure context (HTTP). Camera requires HTTPS.");
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("[Camera Audit] navigator.mediaDevices.getUserMedia is undefined. Browser may not support it or iframe is missing allow='camera'.");
      throw new Error("getUserMedia not supported or disabled in iframe.");
    }

    const constraintsToTry = [
      { video: true },
      { video: { facingMode: "user" } },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } } }
    ];

    if (deviceId) {
      // If a specific device is selected, override constraints
      constraintsToTry.unshift({ video: { deviceId: { exact: deviceId } } });
    }

    let lastError = null;

    for (let i = 0; i < constraintsToTry.length; i++) {
      try {
        console.log(`[Camera Audit] Attempt ${i+1}: Requesting camera with constraints:`, JSON.stringify(constraintsToTry[i]));
        this.stream = await navigator.mediaDevices.getUserMedia(constraintsToTry[i]);
        console.log("[Camera Audit] Stream acquired successfully. Tracks:", this.stream.getTracks().map(t => t.label).join(", "));
        
        this.videoEl.srcObject = this.stream;
        await this.videoEl.play(); // Force play
        console.log("[Camera Audit] Video playback started.");
        
        return new Promise((res) => { 
          this.videoEl.onloadedmetadata = () => {
            console.log("[Camera Audit] Video metadata loaded.");
            res(); 
          };
        });
      } catch (e) {
        console.warn(`[Camera Audit] Attempt ${i+1} failed:`, e.name, e.message);
        lastError = e;
        // Stop any partial tracks if it failed during play
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      }
    }

    // If we reach here, all fallbacks failed
    console.error("[Camera Audit] All fallback constraints failed. Last error caught:");
    console.error("- Name:", lastError.name);
    console.error("- Message:", lastError.message);
    console.error("- Stack:", lastError.stack);
    
    let errorDesc = "Unknown error";
    switch(lastError.name) {
      case 'NotAllowedError': errorDesc = "Permission denied by system or browser"; break;
      case 'NotFoundError': errorDesc = "No camera hardware found"; break;
      case 'NotReadableError': errorDesc = "Camera is already in use by another application"; break;
      case 'OverconstrainedError': errorDesc = "Requested constraints cannot be satisfied by the camera"; break;
      case 'SecurityError': errorDesc = "Security error (e.g. iframe policy)"; break;
      case 'AbortError': errorDesc = "Hardware error occurred"; break;
      default: errorDesc = lastError.message || "Unknown error";
    }
    
    // Throw the raw error info so App.html can catch it
    const enhancedError = new Error(`[${lastError.name}] ${errorDesc}`);
    enhancedError.originalName = lastError.name;
    enhancedError.originalMessage = lastError.message;
    throw enhancedError;
  },

  stopCamera() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.detectionLoop) cancelAnimationFrame(this.detectionLoop);
  },

  // ------------------------------------------------------------------
  // ADMIN REGISTRATION: Captures 3 distinct descriptors
  // ------------------------------------------------------------------
  forceManualCapture() { this.regState.forceCaptureFlag = true; },

  beginRegistrationLoop() {
    const displaySize = { width: this.videoEl.videoWidth, height: this.videoEl.videoHeight };
    faceapi.matchDimensions(this.canvasEl, displaySize);
    const uiInst = document.getElementById('reg-instruction');
    const btnManual = document.getElementById('btn-manual-capture');
    
    this.regState.stage = 'front'; this.regState.captures = { front: null, left: null, right: null };
    this.regState.stageStartTime = Date.now(); this.regState.forceCaptureFlag = false;
    uiInst.textContent = "Look straight";
    
    const updateRegUI = (stage, status) => {
      const el = document.getElementById(`reg-${stage}`);
      if(el) { el.className = status; el.querySelector('.material-icons-round').textContent = status === 'success' ? 'check_circle' : 'pending'; }
    };

    const processCapture = (descriptor) => {
      const stage = this.regState.stage;
      this.regState.captures[stage] = descriptor;
      updateRegUI(stage, 'success');
      this.regState.forceCaptureFlag = false;
      this.regState.stageStartTime = Date.now();
      
      if (stage === 'front') { this.regState.stage = 'left'; uiInst.textContent = "Turn slightly left"; } 
      else if (stage === 'left') { this.regState.stage = 'right'; uiInst.textContent = "Turn slightly right"; } 
      else if (stage === 'right') {
        this.regState.stage = 'done'; uiInst.textContent = "Registration Complete!"; btnManual.style.display = 'none';
        // Pass the object containing all 3 arrays instead of averaging
        setTimeout(() => app.completeRegistration(this.regState.captures), 800);
      }
    };

    const detectFrame = async () => {
      if (this.videoEl.paused || this.videoEl.ended) return;
      const detections = await faceapi.detectAllFaces(this.videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
      const ctx = this.canvasEl.getContext('2d'); ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      
      if (Date.now() - this.regState.stageStartTime > 5000) btnManual.style.display = 'block';
      else btnManual.style.display = 'none';

      if (detections && detections.length > 0) {
        const resized = faceapi.resizeResults(detections, displaySize); faceapi.draw.drawDetections(this.canvasEl, resized);
        if (this.regState.forceCaptureFlag) {
          if (detections.length > 1) { uiInst.textContent = "Multiple faces detected!"; this.regState.forceCaptureFlag = false; } 
          else {
            const det = detections[0];
            if (det.detection.box.width < 100) { uiInst.textContent = "Move closer."; this.regState.forceCaptureFlag = false; } 
            else if (!det.descriptor) { this.regState.forceCaptureFlag = false; } 
            else processCapture(det.descriptor);
          }
        } else {
          if (detections.length === 1) {
            const det = detections[0]; const ratio = (det.landmarks.getNose()[0].x - det.landmarks.getJawOutline()[0].x) / ((det.landmarks.getJawOutline()[16].x - det.landmarks.getNose()[0].x) || 1);
            let isAngleMet = false; const stage = this.regState.stage;
            if (stage === 'front' && ratio > 0.6 && ratio < 1.4) isAngleMet = true;
            if (stage === 'left' && ratio > 1.2) isAngleMet = true;
            if (stage === 'right' && ratio < 0.8) isAngleMet = true;
            if (isAngleMet && det.descriptor) processCapture(det.descriptor);
          }
        }
      } else if (this.regState.forceCaptureFlag) { uiInst.textContent = "No face."; this.regState.forceCaptureFlag = false; }
      this.detectionLoop = requestAnimationFrame(detectFrame);
    };
    detectFrame();
  },

  // ------------------------------------------------------------------
  // DAILY ATTENDANCE LOOP: 3-Descriptor Match + Passive Liveness
  // ------------------------------------------------------------------
  beginPassiveValidationLoop(descriptorsObj, threshold) {
    const displaySize = { width: this.videoEl.videoWidth, height: this.videoEl.videoHeight };
    faceapi.matchDimensions(this.canvasEl, displaySize);
    
    const uiInst = document.getElementById('liveness-instruction');
    const history = []; const MAX_FRAMES = 15; let weakFramesCount = 0;

    const detectFrame = async () => {
      if (this.videoEl.paused || this.videoEl.ended) return;
      const detection = await faceapi.detectSingleFace(this.videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })).withFaceLandmarks().withFaceDescriptor();
      const ctx = this.canvasEl.getContext('2d'); ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

      if (detection) {
        // Find best match among the 3 stored descriptors
        const distFront = faceapi.euclideanDistance(detection.descriptor, descriptorsObj.front);
        const distLeft = faceapi.euclideanDistance(detection.descriptor, descriptorsObj.left);
        const distRight = faceapi.euclideanDistance(detection.descriptor, descriptorsObj.right);
        const bestDistance = Math.min(distFront, distLeft, distRight);

        if (bestDistance > threshold) {
          weakFramesCount++;
          if (weakFramesCount > 10) uiInst.textContent = "Please look clearly at the camera and try again.";
        } else {
          const noseTip = detection.landmarks.getNose()[3];
          history.push({ x: noseTip.x, y: noseTip.y });
          if (history.length > MAX_FRAMES) history.shift();
          
          if (history.length === MAX_FRAMES) {
            const sumX = history.reduce((acc, val) => acc + val.x, 0); const meanX = sumX / MAX_FRAMES;
            const varianceX = history.reduce((acc, val) => acc + Math.pow(val.x - meanX, 2), 0) / MAX_FRAMES;
            
            if (varianceX < 0.2) uiInst.textContent = "Please look clearly at the camera and try again.";
            else if (varianceX > 100) uiInst.textContent = "Hold the camera steady.";
            else {
              uiInst.textContent = "Attendance Confirmed.";
              setTimeout(() => app.finalizeAttendance(bestDistance, "PASSIVE_LIVENESS_OK"), 400);
              return; 
            }
          }
          weakFramesCount = 0;
        }
      } else uiInst.textContent = "Please look clearly at the camera.";
      this.detectionLoop = requestAnimationFrame(detectFrame);
    };
    detectFrame();
  }
};
