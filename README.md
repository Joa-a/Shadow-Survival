# Shadow Survivor: Eternal Night

## Estructura del Proyecto

```
shadow-survivor/
├── index.html          ← Punto de entrada principal
├── README.md           ← Este archivo
│
├── css/
│   ├── main.css        ← Estilos base, efectos, controles móviles
│   ├── hud.css         ← Barras de HP/XP, top bar, boss bar, buffs
│   └── overlays.css    ← Pantallas de inicio, nivel, pausa, game over
│
└── js/
    ├── config.js       ← Constantes y configuración global
    ├── audio.js        ← Motor de audio (Web Audio API)
    ├── utils.js        ← Funciones matemáticas (M.dist, M.lerp, etc.)
    ├── data.js         ← Datos del juego: personajes, upgrades, logros, enemigos
    ├── entity.js       ← Clase base Entity
    ├── player.js       ← Clase Player (movimiento, trail, dibujo)
    ├── enemy.js        ← Clase Enemy (IA, patrones de boss, dibujo)
    ├── weapons.js      ← Clase Weapon base + WeaponFactory (todas las armas)
    └── game.js         ← Controlador principal del juego (update/draw loop)
```

## Cómo Jugar

Abre `index.html` en tu navegador. No requiere servidor — funciona desde archivo local.

> ⚠️ Algunos navegadores bloquean módulos JS desde `file://`. Si tienes problemas, usa un servidor local:
> ```bash
> # Python
> python -m http.server 8080
> # Node.js
> npx serve .
> ```

## Controles

| Acción      | Teclado          | Móvil           |
|-------------|------------------|-----------------|
| Mover       | WASD / Flechas   | Joystick izq.   |
| Ultra Burst | Espacio          | Botón ULTRA     |
| Pausa       | Click en PAUSA   | Click en PAUSA  |

## Personajes

| Nombre  | Arma Inicial | Descripción              |
|---------|-------------|--------------------------|
| Alaric  | Látigo      | Tanque resistente        |
| Zale    | Varita      | Alto daño, frágil        |
| Kael    | Daga        | Muy rápido               |
| Elora   | Orbe        | Equilibrado              |
| Ryxa    | Ballesta    | Largo alcance            |
| Vorath  | Rayo        | Cadenas eléctricas       |

## Armas Disponibles

- 〰️ Látigo — perforante horizontal
- 🪄 Varita mágica — teledirigida (multi-objetivo en niveles altos)
- 🔪 Daga — velocísima
- 📖 Orbe sagrado — orbita al jugador (hasta 3 orbes)
- 🧄 Aura de ajo — daño constante en área
- ⚡ Rayo en cadena — salta entre enemigos
- 🏹 Ballesta — flecha penetrante
- 🔥 Llama — zona de fuego persistente

## Tipos de Enemigos

- **Swarm** 🟣 — Zigzag, rápidos en grupo
- **Chase** 🟣 — Persecución directa
- **Ranged** 🔵 — Mantiene distancia y dispara
- **Charger** 🟠 — Carga embestidas
- **Exploder** 🟢 — Explota al morir
- **Phantom** 🟣 — Se teleporta
- **Élite** ⭐ — Versiones mejoradas con aura dorada
- **Boss** 🔴 — Aparece cada minuto, 3 patrones de ataque

## Para Desarrolladores

### Añadir un nuevo personaje

En `js/data.js`, añade un objeto al array `CHARACTERS`:
```js
{ id:'nuevo', name:'Nombre', icon:'🆕', hp:50, speed:200, weapon:'MagicWand', desc:'Descripción.', stats:{hp:'●●●○○',spd:'●●●○○',atk:'●●●○○'} }
```

### Añadir un nuevo arma

1. En `js/data.js`, añade la entrada a `UPGRADES_DB`.
2. En `js/weapons.js`, añade la clase a `WeaponFactory`:
```js
'MiArma': class extends Weapon {
    constructor(p) { super(p, 'MiArma', 15, 1.0); }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.cooldown;
            // Lógica del arma aquí
        }
    }
    // Opcional: draw(ctx, off) para armas persistentes
}
```

### Añadir un nuevo tipo de enemigo

1. Añade los datos a `ENEMY_TYPES` en `js/data.js`.
2. En `js/enemy.js`, añade el método `_updateNuevoTipo(dt, ang)` y el case en `update()`.
