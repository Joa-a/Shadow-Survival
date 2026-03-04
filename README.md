# SHADOW SURVIVOR: ETERNAL NIGHT — v2.0

Juego de supervivencia roguelite tipo Vampire Survivors sobre canvas HTML5 puro.
Abre `index.html` en cualquier navegador moderno. No requiere servidor ni instalación.

## Controles

| Tecla | Acción |
|---|---|
| WASD / Flechas | Mover |
| Espacio | Ultra (habilidad especial) |
| P | Pausar |
| Joystick + botón | Móvil |

## Personajes

| | Nombre | Arma | Fortaleza |
|---|---|---|---|
| ☠ | Alaric | Látigo | ATK alto |
| 🔮 | Seraphel | Varita Mágica | ATK máximo |
| 🗡 | Kael | Cuchillo | Velocidad |
| ✨ | Elora | Golpe Santo (melee) | HP alto |
| 🏹 | Ryxa | Ballesta | ATK / VEL |
| ⚡ | Vorath | Rayo | ATK / HP |

## Cambios v2.0

### Pantallas nuevas
- Pantalla de **carga animada** (canvas, barra de progreso, partículas)
- Pantalla de **título con lore** (estrellas, luna, texto con máquina de escribir)

### Armas rediseñadas
- **Látigo (Alaric)** — Curva bezier real, apunta al enemigo, se adelgaza hasta la punta
- **Cuchillo (Kael)** — Daga dibujada con hoja/guarda/empuñadura, gira al volar
- **Golpe Santo (Elora)** — Cono melee divino, rango estricto ≤125px, cooldown rápido
- **Rayo (Vorath)** — Rango máximo 350px al primer objetivo, indicador visual si no hay rango
- **Ballesta (Ryxa)** — Rango máximo 480px exacto (ya no vuela al infinito)

### Logros persistentes (localStorage)
- 12 logros guardados una sola vez por dispositivo
- Popup con icono + contador global al ganar uno
- Galería completa en pantalla de pausa (con barra de progreso en los bloqueados)
- Resumen de logros ganados esta partida en Game Over

## Archivos

```
index.html    css/  js/
  main.css hud.css overlays.css
  config.js utils.js audio.js data.js
  entity.js player.js enemy.js
  weapons.js intro.js game.js
```
