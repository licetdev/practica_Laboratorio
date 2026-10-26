import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

import { GLTFLoader } from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

// ===========================================
// CONFIGURACIÓN
// ===========================================

const VIDA_MAXIMA = 100;
const DANIO_POR_ACIERTO = 10;
const PUNTOS_POR_ACIERTO = 100;
const RUTA_MODELO = "./models/objetivo.glb";

// ===========================================
// ELEMENTOS HTML
// ===========================================

const gameArea = document.getElementById("game-area");
const loading = document.getElementById("loading");
const crosshair = document.getElementById("crosshair");
const feedback = document.getElementById("feedback");
const victoryOverlay = document.getElementById("victory-overlay");

const hitsElement = document.getElementById("hits");
const scoreElement = document.getElementById("score");
const shotsElement = document.getElementById("shots");

const progressFill = document.getElementById("progress-fill");
const goalLabel = document.getElementById("goal-label");
const percentLabel = document.getElementById("percent");
const targetState = document.getElementById("target-state");
const coordsElement = document.getElementById("coords");

// ===========================================
// VARIABLES DEL JUEGO
// ===========================================

let aciertos = 0;
let vidaObjetivo = VIDA_MAXIMA;
let disparos = 0;
let puntaje = 0;
let partidaTerminada = false;
let modeloCargado = false;

let posicionObjetivoX = 0;
let posicionObjetivoY = 0;

const particulas = [];

// ===========================================
// ESCENA 3D
// ===========================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x09111e);
scene.fog = new THREE.FogExp2(0x09111e, 0.012);

const camera = new THREE.PerspectiveCamera(
    42,
    1,
    0.1,
    100
);

camera.position.set(0, 0, 8.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

renderer.domElement.id = "game-canvas";
renderer.domElement.setAttribute(
    "aria-label",
    "Campo de tiro 3D. Haz clic en el objeto para disparar."
);

gameArea.insertBefore(renderer.domElement, loading);

// ===========================================
// ILUMINACIÓN
// ===========================================

scene.add(new THREE.AmbientLight(0xffffff, 1.6));

const luzPrincipal = new THREE.DirectionalLight(0xffffff, 2.4);
luzPrincipal.position.set(4, 5, 7);
scene.add(luzPrincipal);

const luzCian = new THREE.PointLight(0x38e9e2, 45, 25);
luzCian.position.set(-4, 3, 5);
scene.add(luzCian);

const luzDorada = new THREE.PointLight(0xffa83e, 35, 20);
luzDorada.position.set(4, -2, 4);
scene.add(luzDorada);

// ===========================================
// FONDO DE ESTRELLAS
// ===========================================

const posicionesEstrellas = [];

for (let i = 0; i < 400; i++) {
    posicionesEstrellas.push(
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 16,
        -4 - Math.random() * 18
    );
}

const geometriaEstrellas = new THREE.BufferGeometry();

geometriaEstrellas.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posicionesEstrellas, 3)
);

const estrellas = new THREE.Points(
    geometriaEstrellas,
    new THREE.PointsMaterial({
        color: 0x8aaacb,
        size: 0.035,
        transparent: true,
        opacity: 0.65
    })
);

scene.add(estrellas);

// ===========================================
// OBJETIVO 3D
// ===========================================

const objetivo = new THREE.Group();
scene.add(objetivo);

objetivo.visible = false;

// ===========================================
// CARGAR EL MODELO 3D
// ===========================================

const loader = new GLTFLoader();

loader.load(
    RUTA_MODELO,

    function (gltf) {
        const modelo = gltf.scene;

        modelo.updateMatrixWorld(true);

        const caja = new THREE.Box3().setFromObject(modelo);
        const dimensiones = caja.getSize(new THREE.Vector3());
        const centro = caja.getCenter(new THREE.Vector3());

        const tamanoMaximo = Math.max(
            dimensiones.x,
            dimensiones.y,
            dimensiones.z
        );

        if (!Number.isFinite(tamanoMaximo) || tamanoMaximo <= 0) {
            mostrarErrorModelo(
                "El archivo 3D no contiene un modelo con dimensiones válidas."
            );
            return;
        }

        // Centrar el modelo.
        modelo.position.sub(centro);

        const contenedorModelo = new THREE.Group();
        contenedorModelo.add(modelo);

        const tamanoDeseado = 2.1;
        const escala = tamanoDeseado / tamanoMaximo;

        contenedorModelo.scale.setScalar(escala);

        objetivo.add(contenedorModelo);

        objetivo.position.set(0, 0, 0);
        objetivo.visible = true;

        modeloCargado = true;

        loading.classList.add("hidden");
        targetState.textContent = "OBJETO LISTO";

        console.log("Modelo 3D cargado correctamente:", RUTA_MODELO);
    },

    function (progreso) {
        if (progreso.total > 0) {
            const porcentaje = Math.round(
                progreso.loaded / progreso.total * 100
            );

            loading.querySelector("p").textContent =
                `Cargando tu objeto 3D... ${porcentaje}%`;
        }
    },

    function (error) {
        console.error("Error cargando el modelo 3D:", error);

        mostrarErrorModelo(
            "No se pudo cargar models/objetivo.glb. " +
            "Comprueba el nombre del archivo y su ubicación."
        );
    }
);

// ===========================================
// ERROR AL CARGAR EL MODELO
// ===========================================

function mostrarErrorModelo(mensaje) {
    modeloCargado = false;
    objetivo.visible = false;

    loading.classList.remove("hidden");
    loading.classList.add("error");

    loading.innerHTML = `
        <strong>Error al cargar el objetivo</strong>
        <p>${mensaje}</p>
        <p>Revisa la carpeta models y utiliza Live Server.</p>
    `;

    targetState.textContent = "ERROR DE CARGA";
    targetState.style.color = "#ff7184";
}

// ===========================================
// AJUSTAR EL CANVAS
// ===========================================

function ajustarTamanio() {
    const ancho = gameArea.clientWidth;
    const alto = gameArea.clientHeight;

    if (ancho === 0 || alto === 0) {
        return;
    }

    camera.aspect = ancho / alto;
    camera.fov = ancho < 520 ? 47 : 42;
    camera.position.z = ancho < 520 ? 9 : 8.5;

    camera.updateProjectionMatrix();

    renderer.setSize(ancho, alto, false);
}

const observador = new ResizeObserver(ajustarTamanio);
observador.observe(gameArea);

ajustarTamanio();

// ===========================================
// ACTUALIZAR MARCADORES
// ===========================================

function actualizarMarcador() {
    // El indicador de aciertos muestra la vida restante.
    // Los aciertos reales se siguen contando en la variable "aciertos".
    hitsElement.textContent = `${vidaObjetivo}%`;

    scoreElement.textContent = String(puntaje).padStart(4, "0");
    shotsElement.textContent = String(disparos).padStart(2, "0");

    const porcentaje = Math.max(
        0,
        Math.min(
            100,
            Math.round((vidaObjetivo / VIDA_MAXIMA) * 100)
        )
    );

    progressFill.style.width = `${porcentaje}%`;
    goalLabel.textContent = `${vidaObjetivo} / ${VIDA_MAXIMA}`;
    percentLabel.textContent = `${porcentaje}%`;
}

// ===========================================
// MOVER EL OBJETIVO
// ===========================================

function cambiarPosicionObjetivo() {
    const alturaVisible =
        2 * camera.position.z *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

    const anchuraVisible = alturaVisible * camera.aspect;

    const limiteX = Math.max(0.1, anchuraVisible / 2 - 1.5);
    const limiteY = Math.max(0.1, alturaVisible / 2 - 1.5);

    posicionObjetivoX =
        (Math.random() * 2 - 1) * limiteX;

    posicionObjetivoY =
        (Math.random() * 2 - 1) * limiteY;

    objetivo.position.x = posicionObjetivoX;
    objetivo.position.y = posicionObjetivoY;
}

// ===========================================
// MENSAJES DEL DISPARO
// ===========================================

function mostrarFeedback(x, y, mensaje, esFallo = false) {
    feedback.className = "feedback";

    feedback.textContent = mensaje;
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;

    if (esFallo) {
        feedback.classList.add("miss");
    }

    void feedback.offsetWidth;
    feedback.classList.add("show");
}

// ===========================================
// PARTÍCULAS AL ACERTAR
// ===========================================

function crearExplosion(posicion) {
    for (let i = 0; i < 15; i++) {
        const particula = new THREE.Mesh(
            new THREE.SphereGeometry(
                0.03 + Math.random() * 0.04,
                7,
                7
            ),
            new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0x5de7e4 : 0xffbb55,
                transparent: true
            })
        );

        particula.position.copy(posicion);
        scene.add(particula);

        particulas.push({
            mesh: particula,
            velocidad: new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 2
            ),
            vida: 0.45
        });
    }
}

// ===========================================
// SISTEMA DE DISPAROS
// ===========================================

const raycaster = new THREE.Raycaster();
const puntero = new THREE.Vector2();

function disparar(evento) {
    // No permitir disparos si el modelo no está listo,
    // la partida terminó o no es el botón izquierdo.
    if (!modeloCargado || partidaTerminada || evento.button !== 0) {
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();

    const x = evento.clientX - rect.left;
    const y = evento.clientY - rect.top;

    // Convertir la posición del clic a coordenadas normalizadas.
    puntero.x = (x / rect.width) * 2 - 1;
    puntero.y = -(y / rect.height) * 2 + 1;

    // Crear un rayo desde la cámara hacia el punto seleccionado.
    raycaster.setFromCamera(puntero, camera);

    // Actualizar las transformaciones antes de comprobar el impacto.
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    objetivo.updateMatrixWorld(true);

    // Detectar intersecciones con las mallas reales del objetivo.
    const impactos = raycaster.intersectObject(objetivo, true);

    // Todo clic izquierdo cuenta como un disparo.
    disparos++;

    const impactoValido = impactos.length > 0;

    if (impactoValido) {
        // Solo los impactos reales aumentan los aciertos y la puntuación.
        aciertos++;
        puntaje += PUNTOS_POR_ACIERTO;

        // La vida disminuye exclusivamente si hubo impacto.
        vidaObjetivo = Math.max(
            0,
            vidaObjetivo - DANIO_POR_ACIERTO
        );

        crearExplosion(impactos[0].point);

        mostrarFeedback(
            x,
            y,
            `¡ACIERTO! +${PUNTOS_POR_ACIERTO} · VIDA ${vidaObjetivo}%`
        );

        // Mover el objetivo solo si todavía tiene vida.
        if (vidaObjetivo > 0) {
            cambiarPosicionObjetivo();
        }

        // Finalizar cuando la vida llega a cero.
        if (vidaObjetivo <= 0) {
            actualizarMarcador();
            terminarPartida();
            return;
        }
    } else {
        // Un fallo no modifica la vida, los aciertos ni la puntuación.
        mostrarFeedback(x, y, "FALLO", true);
    }

    actualizarMarcador();
}

renderer.domElement.addEventListener("pointerdown", disparar);

renderer.domElement.addEventListener("contextmenu", evento => {
    evento.preventDefault();
});

// ===========================================
// MOVIMIENTO DE LA MIRA
// ===========================================

renderer.domElement.addEventListener("pointermove", evento => {
    const rect = renderer.domElement.getBoundingClientRect();

    crosshair.style.left = `${evento.clientX - rect.left}px`;
    crosshair.style.top = `${evento.clientY - rect.top}px`;

    crosshair.classList.add("visible");

    coordsElement.textContent =
        `X: ${Math.round(evento.clientX - rect.left)} · ` +
        `Y: ${Math.round(evento.clientY - rect.top)}`;
});

renderer.domElement.addEventListener("pointerleave", () => {
    crosshair.classList.remove("visible");
});

// ===========================================
// VICTORIA
// ===========================================

function terminarPartida() {
    partidaTerminada = true;

    targetState.textContent = "COMPLETADO";
    targetState.style.color = "#7bf0b2";

    document.getElementById("final-score").textContent = puntaje;
    document.getElementById("final-hits").textContent = aciertos;
    document.getElementById("final-shots").textContent = disparos;

    victoryOverlay.classList.add("active");
}

// ===========================================
// REINICIAR EL JUEGO
// ===========================================

function reiniciarPartida() {
    aciertos = 0;
    vidaObjetivo = VIDA_MAXIMA;
    disparos = 0;
    puntaje = 0;
    partidaTerminada = false;

    posicionObjetivoX = 0;
    posicionObjetivoY = 0;

    objetivo.position.set(0, 0, 0);

    targetState.textContent = "OBJETO LISTO";
    targetState.style.color = "";

    victoryOverlay.classList.remove("active");
    feedback.className = "feedback";

    // Eliminar partículas que todavía estén en pantalla.
    for (const particula of particulas) {
        scene.remove(particula.mesh);
        particula.mesh.geometry.dispose();
        particula.mesh.material.dispose();
    }

    particulas.length = 0;

    actualizarMarcador();
}

document.getElementById("reset").addEventListener(
    "click",
    reiniciarPartida
);

document.getElementById("play-again").addEventListener(
    "click",
    reiniciarPartida
);

// ===========================================
// ANIMACIÓN
// ===========================================

const reloj = new THREE.Clock();

function animar() {
    requestAnimationFrame(animar);

    const delta = Math.min(reloj.getDelta(), 0.05);
    const tiempo = reloj.elapsedTime;

    estrellas.rotation.z = Math.sin(tiempo * 0.05) * 0.02;

    if (modeloCargado) {
        // Girar el modelo.
        objetivo.rotation.y = tiempo * 0.5;
        objetivo.rotation.x = Math.sin(tiempo * 0.6) * 0.08;

        // Movimiento vertical suave.
        objetivo.position.y =
            posicionObjetivoY + Math.sin(tiempo * 1.5) * 0.08;
    }

    // Animar las partículas.
    for (let i = particulas.length - 1; i >= 0; i--) {
        const particula = particulas[i];

        particula.vida -= delta;

        particula.mesh.position.addScaledVector(
            particula.velocidad,
            delta
        );

        particula.mesh.material.opacity = Math.max(
            0,
            particula.vida / 0.45
        );

        if (particula.vida <= 0) {
            scene.remove(particula.mesh);
            particula.mesh.geometry.dispose();
            particula.mesh.material.dispose();

            particulas.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

// Inicializar el marcador y comenzar la animación.
actualizarMarcador();
animar();