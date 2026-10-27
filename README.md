# SISMO-ALERT — El juego 🎮🌋

Juego web de **90 segundos** que demuestra por qué el dispositivo **SISMO-ALERT** es superior:
conteo de personas con filtrado IA de MACs falsas, alerta temprana por Onda P, red de nodos
por zonas y modo caja negra con batería de 48 h + LoRa Mesh.

## ▶️ Jugar ahora (GitHub Pages)

**https://nicolashg2004.github.io/juegoDiseno/**

![Dispositivo SISMO-ALERT](modelo.jpg)

## 🎮 Cómo jugar

| Mecánica (función real) | En el juego |
|---|---|
| 🧠 **Filtrado IA de MACs falsas** | Captura orbes **azules** (MAC válida = persona, +100). Deja pasar los **rojos** (MAC aleatoria iOS): la IA los filtra (+10). Tocarlos = falso positivo (−150) y cae tu **Precisión IA**. |
| 🌊 **Alerta temprana Onda P** | El MEMS detecta la Onda P **3 s antes** de la Onda S: el anillo LED se pone **amarillo** y el dispositivo vibra. Pulsa **PRE-ALERTA** (o `Espacio`) → +500 y bonus ×2. |
| 🗺️ **Red de nodos / mapa de calor** | El plano del mall tiene 4 zonas (Food Court, Tienda Norte, Entrada, Parking) con contador y cobertura que decae: mueve el escáner para balancearlas. |
| ⬛ **Caja negra: batería 48 h + LoRa** | Tras el sismo **MAG 5.4** se va la luz (modo e-ink B/N). Traza la ruta LoRa uniendo **3 nodos → ✚ RESCATE** para enviar `GENTE ATRAPADA: N`. |
| ⬜ **Display e-ink final** | Tu puntaje es lo que mostraría el equipo entre los escombros: `GENTE: N / SISMICO: ALERTA / BATERIA: 87% / LORA: ENVIADO`. |

**Controles:** ratón / dedo / flechas para el escáner · `Espacio` = PRE-ALERTA · `P` = pausa.
El **anillo LED del dispositivo es la UI de estado**: cian = OK · amarillo = Onda P · rojo = Onda S · blanco = caja negra.

## 🛠️ Tecnología

- **Un solo `index.html`** — Vanilla JS + Canvas 2D, **cero dependencias** (ni frameworks, ni build).
- `modelo.jpg` renderizado como héroe central en el canvas (con su anillo LED funcional y mini display e-ink en vivo).
- Sonido sintetizado con WebAudio (sin archivos), responsive + táctil, `prefers-reduced-motion` respetado.

## 💻 Ejecutar en local

```bash
# cualquier servidor estático sirve (rutas relativas, sin build)
python3 -m http.server 8000
# abre http://localhost:8000
```

## 🚀 Despliegue (GitHub Pages)

El sitio se publica automáticamente con **GitHub Actions** en cada push a `main`:

- Workflow: [`.github/workflows/static.yml`](.github/workflows/static.yml) (`upload-pages-artifact` → `deploy-pages`).
- `.nojekyll` evita el procesamiento Jekyll: los archivos se sirven tal cual.
- Todas las rutas son **relativas** (`modelo.jpg`, no `/modelo.jpg`) para funcionar bajo el subpath `/juegoDiseno/`.
- `404.html` personalizada con retorno al juego.

> Configuración en GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 📁 Estructura

```
├── index.html                    # juego completo (HTML + CSS + JS)
├── modelo.jpg                    # render del dispositivo (asset héroe)
├── 404.html                      # página 404 temática
├── .nojekyll                     # sirve los archivos sin Jekyll
└── .github/workflows/static.yml  # deploy automático a Pages
```
