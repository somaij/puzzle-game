/**
 * Web only: the page's background, soft pools of colour drifting over the indigo, in the colours of the day's photo. Colours
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
/** Fast enough to notice (a pool crosses the screen in about 10 s), slow enough to ignore while playing. */
const SPEED = 1;
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
uniform vec3 base, first, second, third;

// How much of a colour reaches this point: full at its centre, gone by its edge.
float pool(vec2 p, vec2 centre, float radius) {
  float t = clamp(1.0 - length(p - centre) / radius, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  vec2 reach = 0.5 * size / min(size.x, size.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * size) / min(size.x, size.y);
  // A slight wobble, so the pools aren't perfect circles.
  p += 0.09 * sin(p.yx * 2.3 + vec2(time * 0.31, -time * 0.23));

  vec3 colour = base;
  colour += (first - base) * pool(p, reach * vec2(sin(time * 0.37), cos(time * 0.29)), 0.95);
  colour += (second - base) * pool(p, reach * vec2(cos(time * 0.31 + 2.0), sin(time * 0.41 + 1.0)), 0.85);
  colour += (third - base) * pool(p, reach * vec2(sin(time * 0.43 + 4.0), cos(time * 0.35 + 3.0)), 0.75);
  gl_FragColor = vec4(colour, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

// Added to the indigo like light, because a faint orange blended over indigo turns brown.
const paintColour = (rgb: string) => rgb.split(',').map((n, i) => BASE_COLOUR[i] + (Number(n) / 255) * COLOUR_STRENGTH);

/** Starts the background; returns a function that stops it. */
export function startBackdrop(glows: readonly string[]): () => void {
  const canvas = document.getElementById('backdrop');
  if (!(canvas instanceof HTMLCanvasElement)) return () => undefined;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return () => undefined;

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
    ['first', 'second', 'third'].forEach((name, i) => gl.uniform3fv(gl.getUniformLocation(program, name), paintColour(glows[i])));
    uniforms = { size: gl.getUniformLocation(program, 'size'), time: gl.getUniformLocation(program, 'time') };
    needsDraw = true;
  };

  const fitToWindow = () => {
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
    gl.uniform1f(uniforms.time, reduceMotion.matches ? 0 : (now / 1000) * SPEED);
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
