// Particle Saturn — Originkit
"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const PERSPECTIVE = 0.15;
const VIEW_SPAN = 6.4;
const CORE_RADIUS = 1;
const MAX_MOTES = 90000;
const RING_THICKNESS = 0.011;
const RING_MOTE_FACTOR = 1.35;
const TAU = Math.PI * 2;

const DEFAULTS = {
  coreColor: "#FFD600",
  ringColor: "#FFD400",
  density: 20,
  particleSize: 20,
  glow: 20,
  tilt: 6,
  roll: -3,
  spinSpeed: 7,
  ringOptions: {
    defaultValue: {
      gaps: 1,
      orbitSpeed: 20,
      innerRadius: 117,
      outerRadius: 262,
    },
    innerRadius: 138,
    outerRadius: 262,
    gaps: 2,
    orbitSpeed: 9,
  },
  dragSensitivity: 2,
  sizePercent: 134,
};

export type RingOptions = {
  innerRadius?: number;
  outerRadius?: number;
  gaps?: number;
  orbitSpeed?: number;
  defaultValue?: {
    gaps: number;
    orbitSpeed: number;
    innerRadius: number;
    outerRadius: number;
  };
};

export type Config = {
  coreColor: string;
  ringColor: string;
  density: number;
  particleSize: number;
  glow: number;
  tilt: number;
  roll: number;
  spinSpeed: number;
  ringOptions: RingOptions;
  dragSensitivity: number;
  sizePercent: number;
};

function clamp(v: number, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function settingsFor(cfg: Config) {
  const ring = cfg.ringOptions ?? DEFAULTS.ringOptions;
  const density = clamp(cfg.density, 1, 20, DEFAULTS.density);
  const baseMotes = 600 + density * density * 95;
  const coreMotes = Math.min(MAX_MOTES, Math.round(baseMotes));
  const ringMotes = Math.min(
    MAX_MOTES,
    Math.round(baseMotes * RING_MOTE_FACTOR),
  );

  const innerFraction =
    clamp(
      ring.innerRadius ?? DEFAULTS.ringOptions.innerRadius,
      105,
      200,
      DEFAULTS.ringOptions.innerRadius,
    ) / 100;
  const outerFraction =
    clamp(
      ring.outerRadius ?? DEFAULTS.ringOptions.outerRadius,
      110,
      300,
      DEFAULTS.ringOptions.outerRadius,
    ) / 100;

  return {
    coreMotes,
    ringMotes,
    moteSize:
      0.5 + clamp(cfg.particleSize, 1, 20, DEFAULTS.particleSize) * 0.13,
    glow: 0.15 + clamp(cfg.glow, 1, 20, DEFAULTS.glow) * 0.055,
    tiltRadians: (clamp(cfg.tilt, -80, 80, DEFAULTS.tilt) * Math.PI) / 180,
    rollRadians: (clamp(cfg.roll, -90, 90, DEFAULTS.roll) * Math.PI) / 180,
    spinRate: clamp(cfg.spinSpeed, 0, 20, DEFAULTS.spinSpeed) * 0.05,
    innerRadius: innerFraction * CORE_RADIUS,
    outerRadius: Math.max(innerFraction + 0.08, outerFraction) * CORE_RADIUS,
    gapCount: Math.round(
      clamp(
        ring.gaps ?? DEFAULTS.ringOptions.gaps,
        0,
        4,
        DEFAULTS.ringOptions.gaps,
      ),
    ),
    ringThickness: RING_THICKNESS,
    orbitRate:
      clamp(
        ring.orbitSpeed ?? DEFAULTS.ringOptions.orbitSpeed,
        0,
        20,
        DEFAULTS.ringOptions.orbitSpeed,
      ) * 0.11,
  };
}

type Settings = ReturnType<typeof settingsFor>;

function insideGap(S: Settings, radius: number, span: number): boolean {
  for (let g = 0; g < S.gapCount; g++) {
    const centre = S.innerRadius + span * ((g + 1) / (S.gapCount + 1));
    const halfWidth = span * (0.075 - g * 0.011);
    if (Math.abs(radius - centre) < halfWidth) return true;
  }
  return false;
}

function pickRingRadius(S: Settings, span: number): number {
  for (let attempt = 0; attempt < 10; attempt++) {
    const u = Math.sqrt(Math.random());
    const radius = S.innerRadius + u * span;
    if (!insideGap(S, radius, span)) return radius;
  }
  return S.outerRadius;
}

function buildCloud(S: Settings): THREE.BufferGeometry {
  const count = S.coreMotes + S.ringMotes;
  const position = new Float32Array(count * 3);
  const kind = new Float32Array(count);
  const along = new Float32Array(count);
  const seed = new Float32Array(count);
  const radius = new Float32Array(count);

  for (let i = 0; i < S.coreMotes; i++) {
    kind[i] = 0;
    along[i] = (i + 0.5) / S.coreMotes;
    seed[i] = Math.random();
    radius[i] = 0;
  }

  const span = S.outerRadius - S.innerRadius;
  for (let i = 0; i < S.ringMotes; i++) {
    const k = S.coreMotes + i;
    kind[k] = 1;
    along[k] = i / Math.max(1, S.ringMotes - 1);
    seed[k] = Math.random();
    radius[k] = pickRingRadius(S, span);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
  return geometry;
}

const SATURN_VERTEX = `
  attribute float aKind;
  attribute float aAlong;
  attribute float aSeed;
  attribute float aRadius;
  uniform float uTime;
  uniform float uMoteSize;
  uniform float uOrbitRate;
  uniform float uRingThickness;
  uniform float uCoreRadius;
  uniform float uPixelRatio;
  varying float vKind;
  varying float vBright;
  const float TAU = 6.28318530718;

  float hash11(float n) {
    return fract(sin(n * 78.233) * 43758.5453);
  }

  void main() {
    vec3 modelPos;
    float bright = 1.0;
    if (aKind < 0.5) {
      float y = 1.0 - aAlong * 2.0;
      float ringRadius = sqrt(max(0.0, 1.0 - y * y));
      float theta = aAlong * 2399.96;
      modelPos = vec3(cos(theta) * ringRadius, y, sin(theta) * ringRadius) * uCoreRadius;
      modelPos *= 1.0 + (hash11(aSeed * 91.7) - 0.5) * 0.012;
      bright = 0.55 + hash11(aSeed * 13.1) * 0.6;
    } else {
      float orbitRadius = aRadius;
      float rate = uOrbitRate / pow(max(orbitRadius, 0.2), 1.5);
      float theta = aSeed * TAU + uTime * rate;
      float lift = (hash11(aSeed * 37.9) - 0.5) * 2.0 * uRingThickness;
      modelPos = vec3(cos(theta) * orbitRadius, lift, sin(theta) * orbitRadius);
      float lane = hash11(floor(orbitRadius * 46.0));
      bright = (0.35 + lane * 0.95) * (0.6 + hash11(aSeed * 5.3) * 0.7);
    }

    vec4 viewPos = modelViewMatrix * vec4(modelPos, 1.0);
    vec3 modelCentre = modelViewMatrix[3].xyz;
    vec3 fromCamera = viewPos.xyz;
    float rayLength = max(length(fromCamera), 1e-5);
    vec3 rayDir = fromCamera / rayLength;
    float alongRay = dot(modelCentre, rayDir);
    float offAxis = length(modelCentre - rayDir * alongRay);
    bool occluded;
    if (aKind < 0.5) {
      occluded = dot(viewPos.xyz - modelCentre, rayDir) > 0.0;
    } else {
      float inside = uCoreRadius * uCoreRadius - offAxis * offAxis;
      float nearHit = alongRay - sqrt(max(inside, 0.0));
      occluded = inside > 0.0 && rayLength > nearHit;
    }

    if (occluded) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vKind = aKind;
      vBright = 0.0;
      return;
    }

    gl_Position = projectionMatrix * viewPos;
    gl_PointSize = uMoteSize * uPixelRatio * (9.0 / max(0.001, -viewPos.z));
    vKind = aKind;
    vBright = bright;
  }
`;

const SATURN_FRAGMENT = `
  precision highp float;
  uniform vec3 uCoreColor;
  uniform vec3 uRingColor;
  uniform float uGlow;
  varying float vKind;
  varying float vBright;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float fall = 1.0 - d;
    float shape = pow(fall, 5.0) + pow(fall, 1.6) * 0.3;
    vec3 col = vKind < 0.5 ? uCoreColor : uRingColor;
    float a = shape * vBright * (0.35 + uGlow);
    gl_FragColor = vec4(col * a, a);
  }
`;

export class SaturnScene {
  private container: HTMLElement;
  private cfg: Config;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);
  private group = new THREE.Group();
  private cloudGeometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private cloud: THREE.Points;
  private time = 0;
  private spinAngle = 0;
  private dragYaw = 0;
  private dragPitch = 0;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private width = 0;
  private height = 0;
  private frameId = 0;
  private lastT = 0;
  private disposed = false;

  constructor(container: HTMLElement, cfg: Config) {
    this.container = container;
    this.cfg = cfg;
    const S = settingsFor(cfg);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    );
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    const el = this.renderer.domElement;
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.cursor = "grab";
    el.style.touchAction = "none";
    container.appendChild(el);

    this.material = new THREE.ShaderMaterial({
      vertexShader: SATURN_VERTEX,
      fragmentShader: SATURN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uMoteSize: { value: S.moteSize },
        uOrbitRate: { value: S.orbitRate },
        uRingThickness: { value: S.ringThickness },
        uCoreRadius: { value: CORE_RADIUS },
        uPixelRatio: { value: dpr },
        uCoreColor: { value: new THREE.Color(cfg.coreColor) },
        uRingColor: { value: new THREE.Color(cfg.ringColor) },
        uGlow: { value: S.glow },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.cloudGeometry = buildCloud(S);
    this.cloud = new THREE.Points(this.cloudGeometry, this.material);
    this.cloud.frustumCulled = false;
    this.group.add(this.cloud);
    this.group.rotation.order = "ZXY";
    this.scene.add(this.group);

    this.bindEvents();
  }

  private bindEvents() {
    const el = this.renderer.domElement;
    const down = (e: PointerEvent) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.velocityYaw = 0;
      this.velocityPitch = 0;
      el.style.cursor = "grabbing";
    };

    const move = (e: PointerEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const s = clamp(this.cfg.dragSensitivity, 0, 10, 3) * 0.007;
      this.dragYaw += dx * s;
      this.dragPitch += dy * s;
      this.velocityYaw = dx * s;
      this.velocityPitch = dy * s;
    };

    const up = () => {
      this.isDragging = false;
      el.style.cursor = "grab";
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    this.unbind = () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }

  private unbind = () => {};

  start() {
    this.lastT = performance.now();
    const loop = () => {
      this.frameId = requestAnimationFrame(loop);
      this.step();
    };
    loop();
  }

  setSize(width: number, height: number) {
    if (this.disposed || width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.updateCamera();
  }

  updateConfig(cfg: Config) {
    if (this.disposed) return;
    const prev = this.cfg;
    this.cfg = cfg;
    const S = settingsFor(cfg);
    const u = this.material.uniforms;
    u.uMoteSize.value = S.moteSize;
    u.uOrbitRate.value = S.orbitRate;
    u.uRingThickness.value = S.ringThickness;
    u.uGlow.value = S.glow;
    u.uCoreColor.value.set(cfg.coreColor || "#ffffff");
    u.uRingColor.value.set(cfg.ringColor || "#ffffff");

    const prevRing = prev.ringOptions ?? DEFAULTS.ringOptions;
    const nextRing = cfg.ringOptions ?? DEFAULTS.ringOptions;
    const cloudChanged =
      cfg.density !== prev.density ||
      (nextRing.innerRadius ?? DEFAULTS.ringOptions.innerRadius) !==
        (prevRing.innerRadius ?? DEFAULTS.ringOptions.innerRadius) ||
      (nextRing.outerRadius ?? DEFAULTS.ringOptions.outerRadius) !==
        (prevRing.outerRadius ?? DEFAULTS.ringOptions.outerRadius) ||
      (nextRing.gaps ?? DEFAULTS.ringOptions.gaps) !==
        (prevRing.gaps ?? DEFAULTS.ringOptions.gaps);

    if (cloudChanged) {
      const next = buildCloud(S);
      this.cloudGeometry.dispose();
      this.cloudGeometry = next;
      this.cloud.geometry = next;
    }
    this.updateCamera();
  }

  private updateCamera() {
    const w = Math.max(1, this.width);
    const h = Math.max(1, this.height);
    const aspect = w / h;
    const distance = 1 / PERSPECTIVE;
    const sizePct = clamp(this.cfg.sizePercent, 20, 200, 90);
    const span = VIEW_SPAN * (100 / sizePct);
    const visibleHeight = aspect < 1 ? span / aspect : span;

    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov =
      2 * Math.atan(visibleHeight / 2 / distance) * (180 / Math.PI);
    this.camera.near = Math.max(0.1, distance - 20);
    this.camera.far = distance + 20;
    this.camera.updateProjectionMatrix();
  }

  private step() {
    if (this.disposed) return;
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;

    const S = settingsFor(this.cfg);

    this.time += dt;

    if (!this.isDragging) {
      const decay = Math.exp(-dt * 3);
      this.dragYaw += this.velocityYaw;
      this.dragPitch += this.velocityPitch;
      this.velocityYaw *= decay;
      this.velocityPitch *= decay;
      this.spinAngle += S.spinRate * dt;
    }

    const pitch = Math.max(-1.2, Math.min(1.2, this.dragPitch));
    this.group.rotation.set(
      S.tiltRadians + pitch,
      this.dragYaw + this.spinAngle,
      S.rollRadians,
    );

    this.material.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.unbind();
    this.cloudGeometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    const el = this.renderer.domElement;
    if (el.parentNode === this.container) this.container.removeChild(el);
  }
}

export interface ParticleSaturnProps {
  coreColor?: string;
  ringColor?: string;
  density?: number;
  particleSize?: number;
  glow?: number;
  tilt?: number;
  roll?: number;
  spinSpeed?: number;
  ringOptions?: RingOptions;
  dragSensitivity?: number;
  sizePercent?: number;
  style?: React.CSSProperties;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

function __OriginkitBase_ParticleSaturn(props: ParticleSaturnProps) {
  const {
    coreColor = DEFAULTS.coreColor,
    ringColor = DEFAULTS.ringColor,
    density = DEFAULTS.density,
    particleSize = DEFAULTS.particleSize,
    glow = DEFAULTS.glow,
    tilt = DEFAULTS.tilt,
    roll = DEFAULTS.roll,
    spinSpeed = DEFAULTS.spinSpeed,
    ringOptions = {
      gaps: 1,
      orbitSpeed: 9,
      innerRadius: 105,
      outerRadius: 262,
    },
    dragSensitivity = DEFAULTS.dragSensitivity,
    sizePercent = DEFAULTS.sizePercent,
    style,
    className,
    "aria-hidden": ariaHidden,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SaturnScene | null>(null);
  const cfgRef = useRef<Config>(null as any);

  cfgRef.current = {
    coreColor,
    ringColor,
    density,
    particleSize,
    glow,
    tilt,
    roll,
    spinSpeed,
    ringOptions,
    dragSensitivity,
    sizePercent,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let scene: SaturnScene;
    try {
      scene = new SaturnScene(container, cfgRef.current);
    } catch {
      return;
    }
    sceneRef.current = scene;
    scene.setSize(container.clientWidth, container.clientHeight);
    scene.start();

    const ro = new ResizeObserver(() => {
      scene.setSize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.updateConfig(cfgRef.current);
  }, [
    coreColor,
    ringColor,
    density,
    particleSize,
    glow,
    tilt,
    roll,
    spinSpeed,
    ringOptions?.innerRadius,
    ringOptions?.outerRadius,
    ringOptions?.gaps,
    ringOptions?.orbitSpeed,
    dragSensitivity,
    sizePercent,
  ]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="A ringed planet drawn entirely in particles"
      aria-hidden={ariaHidden}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 120,
        minHeight: 120,
        overflow: "hidden",
        ...style,
      }}
    />
  );
}

const __originkitPresetProps = {
  coreColor: "#FFD600",
  ringColor: "#FFD400",
  density: 20,
  particleSize: 20,
  glow: 20,
  tilt: 6,
  roll: -3,
  spinSpeed: 7,
  dragSensitivity: 2,
  sizePercent: 134,
};

export default function ParticleSaturn(props: ParticleSaturnProps) {
  return (
    <__OriginkitBase_ParticleSaturn
      {...(__originkitPresetProps as ParticleSaturnProps)}
      {...props}
    />
  );
}

export { ParticleSaturn };
