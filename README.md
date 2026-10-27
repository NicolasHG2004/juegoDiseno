# SISMO-ALERT CyT 3D — Operario VR 🥽🌋

Juego inmersivo en **primera persona / WebXR** ambientado en el **edificio CyT de la Universidad Nacional**: eres el operario del sistema. Los **sniffers colgados del techo** cuentan personas por Wi-Fi/BLE, detectan el terremoto y **avisan por voz en español**. Los conteos se resguardan en un **gateway montado en un poste de luz** exterior: tras el sismo debes bajarlo con la polea y descargar el reporte para saber **cuánta gente había y cuánta podría seguir dentro**.

## ▶️ Jugar ahora

**https://nicolashg2004.github.io/juegoDiseno/**

- 🥽 **Con gafas VR (Quest o compatibles):** abre la URL en el navegador de las gafas y pulsa **Entrar en VR**.
- 💻 Sin gafas funciona igual con ratón/teclado o pantalla táctil.
- 🎮 La versión arcade 2D anterior quedó en [`clasico.html`](clasico.html).

![Dispositivo SISMO-ALERT](modelo.jpg)

## 🎮 Cómo se juega

1. **Explora el CyT** (4 pisos + azotea, rampas exteriores en zigzag, campus y punto de encuentro). Los sniffers del techo emiten anillos de escaneo y van contando estudiantes; cada pocos segundos envían un *snapshot* al gateway del poste.
2. **Elige el escenario**: piso del sniffer principal, magnitud (3.0–7.8 Mw o presets) y fallas: sniffer dañado, nodo caído, gateway sin enlace, saturación de MACs falsas, apagón y réplica.
3. **Onda P:** el sniffer la detecta y lo anuncia por voz. Acércate al sniffer principal y pulsa **E** (o el botón 📢) para **emitir la alerta de evacuación por voz en español** antes de que llegue la Onda S.
4. **Terremoto:** temblor según magnitud, polvo, luces que fallan, zonas dañadas, personas atrapadas y, en el escenario de colapso 7.8, el sniffer principal puede quedar **sepultado** — su última telemetría ya está a salvo en el gateway.
5. **Ve al poste de luz** 💡 en la zona segura: acciona la **polea** para bajar el gateway de 4.65 m a 1.18 m, conéctalo y **descarga el reporte del operario**: había (t₀) por piso, evacuadas confirmadas, detectadas dentro, posibles atrapadas/no localizadas, prioridad de rescate por zona y nivel de confianza.
6. **Rescata:** acércate a las personas atrapadas (naranja) y pulsa **E** para liberarlas. Cierra con el **reporte final e-ink** y, si quieres, descarga el JSON del operario.

### Controles

| Acción | Escritorio | VR (WebXR) | Táctil |
|---|---|---|---|
| Mirar | Arrastrar ratón | Cabeza | Arrastrar |
| Caminar | `W A S D` / flechas · `Shift` correr · `Espacio` saltar · `C` agacharse | Stick izquierdo · stick derecho = giro por pasos | Joystick virtual |
| Interactuar | `E` o clic | Gatillo / *select* | Botón ✋ |
| Disparar sismo | `Q` o panel | Panel antes de entrar / objetivo por voz | Panel |
| Vista libre 360° | Botón 🛸 (`R`/`F` subir/bajar) | — | Botón 🛸 |

## 🔊 Audio en español

- **Voz del dispositivo** (Web Speech API, `es`): detección de Onda P, orden de evacuación y fin del movimiento.
- **Voz del operario/gateway:** resumen hablado del reporte al descargar el gateway.
- **Personas (NPC):** reacciones habladas durante el sismo y al ser liberadas, con subtítulos.
- Rumbo sísmico, sirena y tonos generados con WebAudio (sin archivos). Botones para silenciar voz o sonido.

> En el mundo 3D no hay pantallas holográficas gigantes: el edificio avisa **por voz y LED**, como el dispositivo real. Los datos se consultan físicamente en el gateway del poste.

## 🛰️ El sistema que demuestra

| Pieza | En el juego |
|---|---|
| 📡 **Sniffer de techo** | Escaneo pasivo Wi-Fi/BLE por piso/zona, filtrado de MAC aleatorias (fantasmas rojos), precisión IA en vivo |
| 🌊 **Sensor sísmico** | Detecta la Onda P segundos antes de la S; esa ventana sirve para evacuar con la alerta por voz |
| 💡 **Gateway en poste de luz** | Recibe snapshots periódicos fuera del radio de caída; 3 LEDs físicos (enlace / recibiendo / snapshot t₀); se baja con polea de 4.65 m a 1.18 m |
| ⛑️ **Operario/rescatista** | Descarga el reporte sin entrar: había, evacuadas, posibles dentro, atrapadas probables y confianza |
| 🛠️ **Fallas** | Sniffer dañado (conteo degradado), nodo caído, gateway sin enlace (store-and-forward con cola), MACs falsas, apagón en batería, réplica |

## 🛠️ Tecnología

- **Three.js (WebGL/WebXR)** vendorizado en `vendor/` — sin CDN ni build; HTML/CSS/JS con rutas relativas para GitHub Pages.
- Núcleo de simulación puro y testeable en [`js/sim-core.js`](js/sim-core.js) (personas, detección, sismo, snapshot t₀, reporte del gateway); mundo 3D y controles en [`js/app3d.js`](js/app3d.js).
- `modelo.jpg` se usa como la cara del dispositivo principal dentro del 3D.
- Inspirado en la arquitectura interior/exterior de [LPSBOX System](https://github.com/JuanF14-ui/Game-for-LPSBOX-System) (sniffer + gateway en poste), reimplementado para el edificio CyT.

## 💻 Ejecutar en local

```bash
python3 -m http.server 8000
# http://localhost:8000  (para VR se requiere HTTPS o localhost en las gafas)
```

## 🚀 Despliegue

GitHub Pages con GitHub Actions en cada push a `main` (`.github/workflows/static.yml`), `.nojekyll`, rutas relativas y `404.html`.

## 📁 Estructura

```
├── index.html              # experiencia 3D/VR (UI)
├── css/immersive.css       # estilos
├── js/sim-core.js          # simulación pura (testeable en Node)
├── js/app3d.js             # Three.js: CyT 3D, primera persona, WebXR, voz ES
├── vendor/three.module.min.js
├── clasico.html            # versión arcade 2D anterior
├── modelo.jpg              # dispositivo (textura del sniffer principal)
├── 404.html · .nojekyll
└── .github/workflows/static.yml
```
