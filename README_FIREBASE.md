# 🌐 Ranking Global — Configuración Firebase

Sigue estos 6 pasos (5 minutos, gratis).

---

## Paso 1 — Crear proyecto Firebase

1. Ve a **https://console.firebase.google.com**
2. Clic en **"Agregar proyecto"**
3. Nombre: `shadow-survivor` (o cualquiera)
4. Desactiva Google Analytics (no es necesario)
5. Clic en **"Crear proyecto"** → espera ~20 segundos

---

## Paso 2 — Crear Realtime Database

1. En el menú izquierdo → **"Compilación"** → **"Realtime Database"**
2. Clic en **"Crear una base de datos"**
3. Selecciona la región más cercana (ej. `us-central1`)
4. En las reglas, selecciona **"Iniciar en modo de prueba"**
5. Clic en **"Habilitar"**

---

## Paso 3 — Copiar tu URL

En la página de Realtime Database verás algo como:

```
https://shadow-survivor-default-rtdb.firebaseio.com/
```

Copia esa URL (sin la barra final `/`).

---

## Paso 4 — Pegar la URL en el juego

Abre `js/auth.js` y reemplaza:

```js
FIREBASE_URL: 'YOUR_FIREBASE_URL',
```

por:

```js
FIREBASE_URL: 'https://TU-PROYECTO-default-rtdb.firebaseio.com',
```

---

## Paso 5 — Configurar reglas de seguridad (beta)

Para tus 2 beta testers, las reglas de "modo prueba" son suficientes.
Duran **30 días**. Antes de que expiren, ve a la pestaña **"Reglas"** y ponlas así:

```json
{
  "rules": {
    "scores": {
      ".read": true,
      ".write": true
    },
    "players": {
      ".read": true,
      ".write": true
    }
  }
}
```

Haz clic en **"Publicar"**.

---

## Paso 6 — ¡Listo!

Abre el juego, juega una partida y muere.  
Tu score aparecerá en el ranking con la etiqueta **🌐 global**.

Tus beta testers pueden jugar desde cualquier dispositivo y ver
el ranking compartido.

---

## Estructura de datos en Firebase

```
scores/
  NombreJugador/
    name:   "Nombre"
    avatar: "🧙"
    time:   327        ← segundos de supervivencia
    kills:  142
    level:  8
    mode:   "normal" | "frenetic"
    date:   1718000000000

players/
  NombreJugador/
    name:     "Nombre"
    avatar:   "🧙"
    joinedAt: 1718000000000
```

---

## Fallback sin conexión

Si Firebase no está configurado o hay un error de red,
el juego guarda los scores localmente en `localStorage`
y el ranking sigue funcionando en modo **📱 local**.
