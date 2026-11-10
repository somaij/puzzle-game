/**
 * Web only: the page's background, one soft blob pulsing over the indigo, in the main colour of the day's photo. Colours
 * and never the photo's layout, so it can't hint at where a piece goes.
 *
 * It's a small WebGL shader drawn into a tiny canvas that CSS stretches to the window: the shapes are
 * soft, so the low resolution doesn't show and a phone has very little to do. Without WebGL the page
 * just stays plain indigo.
 */

/** The canvas's short side in pixels. */
const RESOLUTION = 180;
const FRAME_MS = 1000 / 30;
/** How much of each photo colour lights the indigo. Low, so the paint stays behind the game. */
const COLOUR_STRENGTH = 0.34;
const BASE_COLOUR = [31 / 255, 36 / 255, 66 / 255];

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 size;
uniform float time;
uniform vec3 base, blob;

// How much of a colour reaches this point: full at its centre, gone by its edge.
float pool(vec2 p, vec2 centre, float radius) {
  float t = clamp(1.0 - length(p - centre) / radius, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  vec2 reach = 0.5 * size / min(size.x, size.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * size) / min(size.x, size.y);
  // A slight wobble, so it isn't a perfect circle.
  p += 0.07 * sin(p.yx * 2.3 + vec2(time * 0.2, -time * 0.15));

  // Breathes in and out over about 8 seconds, wide enough to show around the panels.
  float breath = 0.5 + 0.5 * sin(time * 0.8);
  float glow = pool(p, vec2(0.0), length(reach) * (0.85 + 0.3 * breath));
  gl_FragColor = vec4(base + (blob - base) * glow * (0.65 + 0.35 * breath), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

const toUnit = (rgb: string) => rgb.split(',').map((n) => Number(n) / 255);

/**
 * Keeps each scanline a whole number of screen pixels. Many phones have a fractional pixel ratio
 * (2.625, say), where a line of exactly 1 CSS pixel comes out unevenly spaced and bands visibly.
 */
function fitScanlines() {
  const ratio = window.devicePixelRatio || 1;
  document.getElementById('backdrop-overlay')?.style.setProperty('--line', `${Math.max(1, Math.round(ratio)) / ratio}px`);
}

/** Starts the background; returns a function that stops it. */
export function startBackdrop(colour: string): () => void {
  const canvas = document.getElementById('backdrop');
  if (!(canvas instanceof HTMLCanvasElement)) return () => undefined;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return () => undefined;

  // Added to the indigo like light, because a faint orange blended over indigo turns brown.
  const blob = toUnit(colour).map((c, i) => BASE_COLOUR[i] + c * COLOUR_STRENGTH);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uniforms: { size: WebGLUniformLocation | null; time: WebGLUniformLocation | null } | null = null;
  let frame = 0;
  let lastDraw = 0;
  let needsDraw = true;

  const setUp = () => {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // One triangle that covers the whole canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3fv(gl.getUniformLocation(program, 'base'), BASE_COLOUR);
    gl.uniform3fv(gl.getUniformLocation(program, 'blob'), blob);
    uniforms = { size: gl.getUniformLocation(program, 'size'), time: gl.getUniformLocation(program, 'time') };
    needsDraw = true;
  };

  const fitToWindow = () => {
    fitScanlines();
    const scale = RESOLUTION / Math.min(window.innerWidth, window.innerHeight);
    canvas.width = Math.round(window.innerWidth * scale);
    canvas.height = Math.round(window.innerHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    needsDraw = true;
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (!uniforms) return;
    if (reduceMotion.matches ? !needsDraw : now - lastDraw < FRAME_MS) return;
    lastDraw = now;
    needsDraw = false;
    gl.uniform2f(uniforms.size, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, reduceMotion.matches ? 0 : now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('on');
  };

  // Phones can take the graphics context away while the app is in the background.
  const onLost = (event: Event) => {
    event.preventDefault();
    uniforms = null;
  };

  setUp();
  fitToWindow();
  frame = requestAnimationFrame(loop);
  window.addEventListener('resize', fitToWindow);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', setUp);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', fitToWindow);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', setUp);
  };
}
