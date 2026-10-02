# One rack. One machine.

A silent, guided 3D tour of a **Blackwell-class GPU server**: from the liquid-cooled cabinet, through a compute tray, to the dual-die package and the path a single step of a reply takes across the rack.

It is an original educational model. Geometry, lighting, and copy are built for this page. It does not use NVIDIA product renders, logos, or other brand assets. Figures such as 72 GPUs, 18 compute trays, 192 GB HBM3e-class memory, and 10 TB/s die-to-die are the public GB200-class story, simplified so the mechanism is visible. It is not a teardown and not affiliated with NVIDIA.

## Tour

The film starts on the cabinet. Lights come up, then the door opens.

1. **Rack** — seventy-two GPUs that behave as one machine
2. **Open** — compute trays, switch trays, power, coolant
3. **Tray** — CPUs schedule, GPUs multiply
4. **GPU** — one accelerator comes off the board
5. **Package** — cold plate, two dies, die-to-die link, HBM, interposer
6. **Die** — tensor cores, cache, memory controllers, NVLink
7. **Path** — request, weights, math, then the switch fabric
8. **Scale** — the rack exists to feed the transistors: wires, bandwidth, and watts

Nothing important is said only in audio. The chapter card is the narration.

## Run it

```bash
npm install
npm run dev
```

Open the local URL. Then:

- **Play / pause** or the space bar
- **Arrows** step chapters
- **Drag** the picture to look around
- **Scroll** or drag the scrubber to move through the film
- **Tap a label** to jump to that part

`?chapter=die` opens on a chapter. `?autoplay=0` starts paused. If motion is reduced in the OS, autoplay stays off.

```bash
npm test
npm run build
npm run preview
```

## Deploy

Static Vite build. On Vercel, the framework preset is Vite, the build command is `npm run build`, and the output directory is `dist`. This repo is `kkcandc/blackwell-gpu-explainer`. Deploy it only on Kenny Kline’s personal Vercel account.

No paid APIs. The scene is procedural Three.js.
