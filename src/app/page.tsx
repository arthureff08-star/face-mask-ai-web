"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Eye,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

const classes = [
  {
    name: "Masque",
    description: "A face mask is detected and appears to be worn correctly.",
    status: "Correctly worn",
  },
  {
    name: "Notcorrect",
    description: "A face mask is detected but appears to be worn incorrectly.",
    status: "Incorrectly worn",
  },
  {
    name: "PasMasque",
    description: "No face mask is detected on the person's face.",
    status: "No mask",
  },
];

const metrics = [
  { value: "72.90%", label: "Precision" },
  { value: "59.54%", label: "Recall" },
  { value: "68.10%", label: "mAP@50" },
  { value: "37.63%", label: "mAP@50–95" },
];

const applications = [
  { title: "Healthcare", text: "Potential support for monitoring mask-use requirements in controlled healthcare environments." },
  { title: "Manufacturing", text: "Potential PPE-compliance monitoring in industrial and controlled production environments." },
  { title: "Food Processing", text: "Potential support for face-covering requirements in controlled food-production environments." },
  { title: "Education", text: "A practical demonstration of computer vision, object detection and machine learning." },
  { title: "Research", text: "A foundation for experimenting with computer vision, evaluation and model generalization." },
  { title: "Public Facilities", text: "Potential monitoring support in environments where mask requirements are applicable." },
];

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------- LIVE CAMERA STATE ----------
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const runningRef = useRef<boolean>(false); // guards overlapping requests

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveRunning, setLiveRunning] = useState(false);
  const [liveResult, setLiveResult] = useState<any>(null);
  const [liveDetections, setLiveDetections] = useState<any[]>([]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- IMAGE UPLOAD ----------
  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setFileName(file.name);
    setDetectionResult(null);
    setError(null);
  }

  async function runDetection() {
    const fileInput = fileInputRef.current;
    if (!fileInput?.files?.[0]) {
      setError("Please select an image first.");
      return;
    }

    const file = fileInput.files[0];
    setDetecting(true);
    setError(null);
    setDetectionResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Detection failed with status ${response.status}`);
      }

      const data = await response.json();
      setDetectionResult(data);
    } catch (err) {
      console.error("Detection error:", err);
      setError("Could not connect to the AI backend. Make sure the FastAPI server is running.");
    } finally {
      setDetecting(false);
    }
  }

  function clearImage() {
    if (selectedImage) URL.revokeObjectURL(selectedImage);
    setSelectedImage(null);
    setFileName(null);
    setDetectionResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---------- LIVE CAMERA ----------
  async function openCamera() {
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      // Wait for the video element to actually mount
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.error("video.play:", e));
        }
      });

      setCameraOpen(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(
        "Could not access the camera. Check permissions or use HTTPS/localhost."
      );
    }
  }

  function stopCamera() {
    // stop detection loop
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runningRef.current = false;
    setLiveRunning(false);

    // stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) videoRef.current.srcObject = null;

    setCameraOpen(false);
    setLiveResult(null);
    setLiveDetections([]);
  }

  // Grab one frame, send to backend, update state
  async function captureAndDetect() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (runningRef.current) return; // prevent overlapping requests
    if (video.videoWidth === 0 || video.videoHeight === 0) return; // video not ready

    runningRef.current = true;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      runningRef.current = false;
      return;
    }

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          runningRef.current = false;
          return;
        }

        try {
          const formData = new FormData();
          formData.append("file", blob, "frame.jpg");

          const res = await fetch(`${API_BASE}/predict`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error(`Status ${res.status}`);

          const data = await res.json();
          setLiveResult(data);
          setLiveDetections(data.detections || []);
        } catch (err) {
          console.error("Live detect error:", err);
        } finally {
          runningRef.current = false;
        }
      },
      "image/jpeg",
      0.8
    );
  }

  function startLiveDetection() {
    if (intervalRef.current !== null) return; // already running
    setLiveRunning(true);

    // fire one immediately
    captureAndDetect();

    // then every 800 ms
    intervalRef.current = window.setInterval(() => {
      captureAndDetect();
    }, 800);
  }

  function stopLiveDetection() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runningRef.current = false;
    setLiveRunning(false);
  }

  function toggleLiveDetection() {
    if (liveRunning) {
      stopLiveDetection();
    } else {
      startLiveDetection();
    }
  }

  // ---------- RENDER ----------
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbff] text-slate-900">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden canvas used to grab frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* NAVIGATION */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-blue-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
              <img src="/logo.png" alt="Face Mask AI" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wide text-slate-900">FACE MASK AI</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Computer Vision</div>
            </div>
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            <a href="#how-it-works" className="transition hover:text-blue-600">How it works</a>
            <a href="#test" className="transition hover:text-blue-600">Test model</a>
            <a href="#performance" className="transition hover:text-blue-600">Performance</a>
            <a href="#about" className="transition hover:text-blue-600">About</a>
          </div>

          <a
            href="#test"
            className="hidden rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:block"
          >
            Try the model
          </a>
        </div>
      </nav>

            {/* HERO */}
      <section className="relative flex min-h-screen items-center px-6 pb-20 pt-28 lg:px-10">
        <div className="pointer-events-none absolute left-1/4 top-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-blue-300/20 blur-[140px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              <Sparkles size={14} />
              AI-powered computer vision
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl lg:text-8xl">
              Smarter
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-500 bg-clip-text text-transparent">
                mask detection.
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-500">
              Face Mask AI uses computer vision to detect whether a face mask is worn correctly, incorrectly, or not at all.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#test"
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-blue-600 px-7 py-4 font-bold text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Test the model
                <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </a>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-7 py-4 font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
              >
                Explore the system
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-500" />
                YOLO-based detection
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-500" />
                3 detection classes
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-500" />
                Image & camera testing
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="absolute inset-8 rounded-[3rem] bg-blue-300/30 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-2xl shadow-blue-900/10">
              <div className="relative aspect-square">
                <img
                  src="/hero-nurse.jpg"
                  alt="Healthcare worker wearing a face mask"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: "center 25%" }}
                />

                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

                <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/40 bg-white/85 p-3 shadow-lg backdrop-blur-md">
                    <div className="text-xs font-semibold text-slate-500">Classes</div>
                    <div className="mt-1 text-xl font-black text-slate-900">03</div>
                  </div>

                  <div className="rounded-2xl border border-white/40 bg-white/85 p-3 shadow-lg backdrop-blur-md">
                    <div className="text-xs font-semibold text-slate-500">mAP@50</div>
                    <div className="mt-1 text-xl font-black text-slate-900">68%</div>
                  </div>

                  <div className="rounded-2xl border border-white/40 bg-white/85 p-3 shadow-lg backdrop-blur-md">
                    <div className="text-xs font-semibold text-slate-500">Model</div>
                    <div className="mt-1 text-xl font-black text-slate-900">YOLO</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <a
          href="#how-it-works"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-300 transition hover:text-blue-500"
        >
          <ChevronDown className="animate-bounce" />
        </a>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="border-t border-blue-100 bg-white px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="HOW IT WORKS"
            title="From image to prediction."
            description="The system takes a visual input, processes it through a trained YOLO object-detection model, and returns the detected mask-wearing state."
          />

          <div className="mt-14 grid gap-4 md:grid-cols-4">
            <ProcessCard number="01" icon={<ImageIcon size={22} />} title="Input" text="Upload an image or provide a camera frame." />
            <ProcessCard number="02" icon={<Cpu size={22} />} title="AI processing" text="The trained YOLO model analyzes the visual information." />
            <ProcessCard number="03" icon={<Eye size={22} />} title="Detection" text="The model identifies faces and mask-wearing states." />
            <ProcessCard number="04" icon={<CheckCircle2 size={22} />} title="Result" text="The system returns classes and confidence scores." />
          </div>
        </div>
      </section>

      {/* TEST */}
      <section id="test" className="bg-[#f7fbff] px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="INTERACTIVE TESTING"
            title="Put the model to work."
            description="Test the computer-vision system with your own images or use the live camera interface."
          />

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {/* ---------- IMAGE UPLOAD ---------- */}
            <motion.div
              whileHover={{ y: -5 }}
              className="rounded-[2rem] border border-blue-100 bg-white p-8 shadow-sm transition hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
            >
              {!selectedImage ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Upload size={28} />
                  </div>
                  <h3 className="mt-8 text-2xl font-bold text-slate-900">Upload an image</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
                    Choose a JPG, JPEG or PNG image to prepare it for AI detection.
                  </p>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                  >
                    Upload image
                    <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Image selected</p>
                      <p className="mt-1 max-w-xs truncate text-sm font-semibold text-slate-900">{fileName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-slate-50">
                    <img src={selectedImage} alt="Selected image" className="max-h-[360px] w-full object-contain" />
                  </div>

                  <button
                    onClick={runDetection}
                    disabled={detecting}
                    className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {detecting ? "Detecting..." : "Run detection"}
                  </button>

                  {detectionResult && (
                    <div className="mt-6">
                      <img
                        src={detectionResult.annotated_image}
                        alt="Face mask detection result"
                        className="w-full rounded-2xl border border-slate-200 shadow-sm"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">{error}</div>
                  )}

                  {detectionResult && (
                    <div className="mt-6 space-y-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Detection Results</h3>
                        <p className="text-sm text-slate-500">
                          {detectionResult.detections?.length ?? 0} detection(s) found
                        </p>
                      </div>

                      {(!detectionResult.detections || detectionResult.detections.length === 0) ? (
                        <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-700">
                          No face-mask detection was found.
                        </div>
                      ) : (
                        detectionResult.detections.map((detection: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{detection.class}</p>
                              <p className="text-sm text-slate-500">Detection #{index + 1}</p>
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                              {(detection.confidence * 100).toFixed(1)}%
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* ---------- LIVE CAMERA ---------- */}
            <motion.div
              whileHover={{ y: -5 }}
              className="rounded-[2rem] border border-blue-100 bg-white p-8 shadow-sm transition hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-900/5"
            >
              {!cameraOpen ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                    <Camera size={28} />
                  </div>
                  <h3 className="mt-8 text-2xl font-bold text-slate-900">Live camera</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
                    Use your device camera to test the model in a real-time environment.
                  </p>
                  <button
                    type="button"
                    onClick={openCamera}
                    className="mt-8 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-600 transition hover:bg-blue-100"
                  >
                    Open camera
                    <ArrowRight size={16} />
                  </button>

                  {cameraError && (
                    <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">{cameraError}</div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Live camera</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {liveRunning ? "Detection running" : "Camera ready"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="relative mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-black">
                    <video
  ref={videoRef}
  autoPlay
  playsInline
  muted
  className="w-full"
/>

                   {liveResult?.annotated_image && (
  <img
    src={liveResult.annotated_image}
    alt="Live annotated frame"
    className="absolute inset-0 h-full w-full object-cover"
  />
)}
                    <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                      <span className={`h-2 w-2 rounded-full ${liveRunning ? "bg-red-500 animate-pulse" : "bg-slate-400"}`} />
                      {liveRunning ? "LIVE" : "IDLE"}
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={toggleLiveDetection}
                      className={`flex-1 rounded-2xl px-5 py-3 font-bold transition ${
                        liveRunning
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                      }`}
                    >
                      {liveRunning ? "Stop detection" : "Start detection"}
                    </button>
                  </div>

                  {liveDetections.length > 0 && (
                    <div className="mt-5 space-y-2">
                      {liveDetections.map((d: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                        >
                          <span className="font-semibold text-slate-900">{d.class}</span>
                          <span className="font-bold text-blue-600">
                            {(d.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>

          <div className="mt-6 rounded-3xl border border-blue-100 bg-white p-7 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">AI inference runs through the Face Mask AI backend.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Make sure your FastAPI server is running on{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{API_BASE}</code>.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                <ShieldCheck size={18} />
                Secure inference
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLASSES */}
      <section className="bg-white px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="DETECTION CLASSES"
            title="Three states. One vision system."
            description="The trained model distinguishes three mask-wearing conditions."
          />

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {classes.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Eye size={22} />
                  </div>
                  <span className="rounded-full border border-blue-100 px-3 py-1 text-xs font-semibold text-slate-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{item.name}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.description}</p>
                <div className="mt-6 border-t border-blue-100 pt-5 text-xs font-bold uppercase tracking-widest text-blue-600">
                  {item.status}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PERFORMANCE */}
      <section id="performance" className="bg-[#f7fbff] px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="MODEL PERFORMANCE"
            title="Measured, not guessed."
            description="These results were obtained from the independent test split of Dataset A. They are detection metrics, not simple accuracy."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm"
              >
                <div className="text-4xl font-black tracking-tight text-blue-600">{metric.value}</div>
                <div className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-7 shadow-sm">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Precision</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">How often the model's positive detections are correct.</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Recall</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">How much of the actual target objects the model finds.</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600">mAP</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">A standard object-detection evaluation measure based on precision, recall and intersection-over-union thresholds.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DATASET B */}
      <section className="bg-white px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-8 shadow-sm md:p-12">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="relative grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">INDEPENDENT GENERALIZATION TEST</div>
                <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  Tested beyond the training dataset.
                </h2>
                <p className="mt-6 max-w-3xl text-base leading-8 text-slate-500">
                  The frozen model was tested on a separate Kaggle dataset containing 2,079 images. The dataset was used strictly for independent inference testing and was not used for retraining or fine-tuning.
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
                  Because Dataset B does not contain bounding-box annotations, formal precision, recall and mAP values were not calculated for this dataset.
                </p>
              </div>
              <div className="flex h-40 w-40 shrink-0 flex-col items-center justify-center rounded-full border border-blue-200 bg-white shadow-lg shadow-blue-900/5">
                <span className="text-4xl font-black text-blue-600">2,079</span>
                <span className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">images tested</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* APPLICATIONS */}
      <section id="about" className="bg-[#f7fbff] px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="POTENTIAL APPLICATIONS"
            title="Where computer vision can help."
            description="This prototype demonstrates how visual AI can be adapted to controlled environments where mask compliance matters."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {applications.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm"
              >
                <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* LIMITATIONS */}
      <section className="bg-white px-6 py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">LIMITATIONS</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  A computer-vision prototype, not a certified compliance system.
                </h2>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-500">
                  Detection performance can be affected by lighting, camera quality, motion blur, occlusion, viewing angle and image composition. The independent Dataset B also does not contain bounding-box annotations, so qualitative inference testing was used rather than claiming unsupported mAP or accuracy values.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-blue-100 bg-white px-6 py-12 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="font-bold text-slate-700">FACE MASK AI</span>
            <span className="mx-2">•</span>
            Computer Vision Prototype
          </div>
          <div>YOLO-based face mask detection</div>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">{title}</h2>
      <p className="mt-5 text-base leading-8 text-slate-500">{description}</p>
    </div>
  );
}

function ProcessCard({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div whileHover={{ y: -5 }} className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
        <span className="text-xs font-bold tracking-widest text-blue-200">{number}</span>
      </div>
      <h3 className="mt-8 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
    </motion.div>
  );
}