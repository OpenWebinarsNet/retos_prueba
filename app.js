// Configuración de formaciones disponibles.
// Añadir una formación nueva = añadir una línea aquí + su fichero JSON en /retos.
const FORMACIONES = [
  { id: "python-basico", nombre: "Python básico", archivo: "retos/python-basico.json" },
  { id: "js-basico", nombre: "JavaScript básico", archivo: "retos/js-basico.json" },
  { id: "spring-ai-prompts", nombre: "Ingeniería de prompts (Spring AI)", archivo: "retos/spring-ai-prompts.json" },
];

const STORAGE_PREFIX = "retos-progreso::";

const el = {
  listaFormaciones: document.getElementById("lista-formaciones"),
  tira: document.getElementById("tira-retos"),
  zonaReto: document.getElementById("zona-reto"),
  zonaVacia: document.getElementById("zona-vacia"),
  zonaCompleto: document.getElementById("zona-completo"),
  indice: document.getElementById("reto-indice"),
  titulo: document.getElementById("reto-titulo"),
  descripcion: document.getElementById("reto-descripcion"),
  cuerpo: document.getElementById("reto-cuerpo"),
  sello: document.getElementById("sello"),
  btnComprobar: document.getElementById("btn-comprobar"),
  btnPista: document.getElementById("btn-pista"),
  btnSiguiente: document.getElementById("btn-siguiente"),
  btnReset: document.getElementById("btn-reset"),
  feedback: document.getElementById("feedback"),
};

let estado = {
  formacion: null, // objeto de FORMACIONES
  retos: [],        // retos cargados del JSON
  actual: 0,         // índice del reto mostrado
  match: null,       // estado interno del tipo "emparejar"
  quizSeleccion: null, // índice elegido en el tipo "quiz"
};

init();

function init() {
  renderListaFormaciones();
  el.btnReset.addEventListener("click", reiniciarProgreso);
  el.btnComprobar.addEventListener("click", comprobarReto);
  el.btnSiguiente.addEventListener("click", () => irARetoSiguientePendiente());
  el.btnPista.addEventListener("click", mostrarPista);
}

function renderListaFormaciones() {
  el.listaFormaciones.innerHTML = "";
  FORMACIONES.forEach((f) => {
    const btn = document.createElement("button");
    btn.className = "course-item";
    btn.type = "button";
    btn.setAttribute("aria-current", String(estado.formacion?.id === f.id));
    btn.innerHTML = `<span>${f.nombre}</span>`;
    btn.addEventListener("click", () => seleccionarFormacion(f));
    el.listaFormaciones.appendChild(btn);
  });
}

async function seleccionarFormacion(formacion) {
  try {
    const resp = await fetch(formacion.archivo);
    if (!resp.ok) throw new Error("No se pudo cargar " + formacion.archivo);
    const retos = await resp.json();

    estado.formacion = formacion;
    estado.retos = retos;
    estado.actual = primerPendiente(retos, formacion.id);

    renderListaFormaciones();
    renderTira();
    renderReto();
  } catch (err) {
    el.zonaVacia.hidden = false;
    el.zonaVacia.textContent =
      "No se han podido cargar los retos. Si has abierto este archivo con doble clic, ábrelo con un servidor local o desde GitHub Pages en su lugar.";
  }
}

function primerPendiente(retos, formacionId) {
  const idx = retos.findIndex((r) => !estaCompletado(formacionId, r.id));
  return idx === -1 ? 0 : idx;
}

function estaCompletado(formacionId, retoId) {
  return localStorage.getItem(STORAGE_PREFIX + formacionId + "::" + retoId) === "1";
}

function marcarCompletado(formacionId, retoId) {
  localStorage.setItem(STORAGE_PREFIX + formacionId + "::" + retoId, "1");
}

function reiniciarProgreso() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  if (estado.formacion) {
    estado.actual = 0;
    renderTira();
    renderReto();
  }
}

function renderTira() {
  el.tira.innerHTML = "";
  el.zonaVacia.hidden = true;

  estado.retos.forEach((reto, i) => {
    const done = estaCompletado(estado.formacion.id, reto.id);
    const b = document.createElement("button");
    b.className = "thumb";
    b.type = "button";
    b.textContent = String(i + 1).padStart(2, "0");
    b.dataset.done = String(done);
    b.setAttribute("aria-current", String(i === estado.actual));
    b.title = reto.titulo;
    b.addEventListener("click", () => {
      estado.actual = i;
      renderReto();
    });
    el.tira.appendChild(b);
  });
}

function irARetoSiguientePendiente() {
  const idx = estado.retos.findIndex(
    (r, i) => i > estado.actual && !estaCompletado(estado.formacion.id, r.id)
  );
  estado.actual = idx !== -1 ? idx : primerPendiente(estado.retos, estado.formacion.id);
  renderTira();
  renderReto();
}

function tipoDe(reto) {
  return reto.tipo || "codigo";
}

function renderReto() {
  const total = estado.retos.length;
  const todosHechos = estado.retos.every((r) => estaCompletado(estado.formacion.id, r.id));

  if (todosHechos) {
    el.zonaReto.hidden = true;
    el.zonaCompleto.hidden = false;
    return;
  }
  el.zonaCompleto.hidden = true;
  el.zonaReto.hidden = false;

  const reto = estado.retos[estado.actual];
  const done = estaCompletado(estado.formacion.id, reto.id);
  const tipo = tipoDe(reto);

  el.indice.textContent = `${estado.actual + 1} / ${total}`;
  el.titulo.textContent = reto.titulo;
  el.descripcion.textContent = reto.descripcion || "";
  el.sello.classList.toggle("visible", done);
  el.feedback.textContent = "";
  el.feedback.removeAttribute("data-state");
  el.btnSiguiente.hidden = !done;
  el.btnComprobar.hidden = tipo === "emparejar";
  el.btnComprobar.disabled = done;
  el.btnComprobar.textContent = done ? "Ya resuelto" : "Comprobar";

  estado.quizSeleccion = null;
  estado.match = null;

  el.cuerpo.innerHTML = "";
  if (tipo === "codigo") renderCuerpoCodigo(reto, done);
  else if (tipo === "quiz") renderCuerpoQuiz(reto, done);
  else if (tipo === "emparejar") renderCuerpoEmparejar(reto, done);
  else if (tipo === "detectar") renderCuerpoDetectar(reto, done);
}

/* ---------- Tipo: código con huecos ---------- */

function renderCuerpoCodigo(reto, deshabilitado) {
  const pre = document.createElement("pre");
  pre.className = "code";
  const partes = reto.codigo.split("____");

  partes.forEach((parte, i) => {
    pre.appendChild(document.createTextNode(parte));
    if (i < partes.length - 1) {
      const input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.dataset.blank = String(i);
      input.disabled = deshabilitado;
      if (deshabilitado) {
        input.value = (reto.soluciones[i] && reto.soluciones[i][0]) || "";
        input.classList.add("ok");
      }
      pre.appendChild(input);
    }
  });
  el.cuerpo.appendChild(pre);
}

function comprobarCodigo(reto) {
  const inputs = [...el.cuerpo.querySelectorAll("input")];
  let todoCorrecto = true;

  inputs.forEach((input) => {
    const i = Number(input.dataset.blank);
    const aceptadas = (reto.soluciones[i] || []).map((s) => s.trim().toLowerCase());
    const valor = input.value.trim().toLowerCase();
    const correcto = aceptadas.includes(valor);
    input.classList.toggle("ok", correcto);
    input.classList.toggle("bad", !correcto);
    if (!correcto) todoCorrecto = false;
  });

  if (todoCorrecto) {
    completarReto(reto, "Correcto. Reto marcado como resuelto.");
    inputs.forEach((input) => (input.disabled = true));
  } else {
    mostrarFeedback("Todavía no. Revisa los huecos en rojo.", "bad");
  }
}

/* ---------- Tipo: quiz de opción múltiple ---------- */

function renderCuerpoQuiz(reto, deshabilitado) {
  const wrap = document.createElement("div");
  wrap.className = "quiz-list";

  const pregunta = document.createElement("p");
  pregunta.className = "quiz-question";
  pregunta.textContent = reto.pregunta;
  wrap.appendChild(pregunta);

  reto.opciones.forEach((opcion, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quiz-option";
    b.textContent = opcion;
    b.dataset.index = String(i);
    b.disabled = deshabilitado;
    if (deshabilitado && i === reto.correcta) b.classList.add("correct");
    b.addEventListener("click", () => {
      estado.quizSeleccion = i;
      wrap.querySelectorAll(".quiz-option").forEach((o) => o.classList.remove("selected"));
      b.classList.add("selected");
    });
    wrap.appendChild(b);
  });

  el.cuerpo.appendChild(wrap);
}

function comprobarQuiz(reto) {
  if (estado.quizSeleccion === null) {
    mostrarFeedback("Elige una opción antes de comprobar.", "hint");
    return;
  }
  const opciones = [...el.cuerpo.querySelectorAll(".quiz-option")];
  const correcto = estado.quizSeleccion === reto.correcta;

  opciones.forEach((o, i) => {
    if (i === reto.correcta) o.classList.add("correct");
    else if (i === estado.quizSeleccion) o.classList.add("incorrect");
  });

  if (correcto) {
    opciones.forEach((o) => (o.disabled = true));
    completarReto(reto, reto.explicacion || "Correcto.");
  } else {
    mostrarFeedback("Esa no es la respuesta. Prueba otra vez.", "bad");
  }
}

/* ---------- Tipo: emparejar concepto ↔ definición ---------- */

function mezclar(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function renderCuerpoEmparejar(reto, deshabilitado) {
  const pares = reto.pares;
  estado.match = {
    seleccion: null, // {lado: 'concepto'|'definicion', valor, elemento}
    resueltos: new Set(),
  };

  const grid = document.createElement("div");
  grid.className = "match-grid";

  const colConceptos = document.createElement("div");
  colConceptos.className = "match-col";
  const colDefiniciones = document.createElement("div");
  colDefiniciones.className = "match-col";

  const conceptosMezclados = mezclar(pares.map((p, i) => ({ texto: p.concepto, i })));
  const definicionesMezcladas = mezclar(pares.map((p, i) => ({ texto: p.definicion, i })));

  conceptosMezclados.forEach(({ texto, i }) => {
    const item = crearMatchItem(texto, i, "concepto", deshabilitado);
    colConceptos.appendChild(item);
  });
  definicionesMezcladas.forEach(({ texto, i }) => {
    const item = crearMatchItem(texto, i, "definicion", deshabilitado);
    colDefiniciones.appendChild(item);
  });

  grid.appendChild(colConceptos);
  grid.appendChild(colDefiniciones);
  el.cuerpo.appendChild(grid);

  const progreso = document.createElement("p");
  progreso.className = "match-progress";
  progreso.id = "match-progreso";
  const totalHechos = deshabilitado ? pares.length : 0;
  progreso.textContent = `${totalHechos} / ${pares.length} emparejados`;
  el.cuerpo.appendChild(progreso);

  if (deshabilitado) {
    el.cuerpo.querySelectorAll(".match-item").forEach((it) => it.classList.add("matched"));
  }
}

function crearMatchItem(texto, indicePar, lado, deshabilitado) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "match-item";
  b.textContent = texto;
  b.dataset.par = String(indicePar);
  b.dataset.lado = lado;
  b.disabled = deshabilitado;
  b.addEventListener("click", () => clicMatchItem(b));
  return b;
}

function clicMatchItem(item) {
  const reto = estado.retos[estado.actual];
  const m = estado.match;
  if (item.classList.contains("matched")) return;

  if (!m.seleccion) {
    el.cuerpo.querySelectorAll(".match-item").forEach((it) => it.classList.remove("selected"));
    item.classList.add("selected");
    m.seleccion = item;
    return;
  }

  if (m.seleccion === item) {
    item.classList.remove("selected");
    m.seleccion = null;
    return;
  }

  if (m.seleccion.dataset.lado === item.dataset.lado) {
    // mismo lado: cambia la selección
    m.seleccion.classList.remove("selected");
    item.classList.add("selected");
    m.seleccion = item;
    return;
  }

  const aciertoPar = m.seleccion.dataset.par === item.dataset.par;
  if (aciertoPar) {
    m.seleccion.classList.remove("selected");
    m.seleccion.classList.add("matched");
    item.classList.add("matched");
    m.resueltos.add(item.dataset.par);
    m.seleccion = null;

    const progreso = document.getElementById("match-progreso");
    progreso.textContent = `${m.resueltos.size} / ${reto.pares.length} emparejados`;

    if (m.resueltos.size === reto.pares.length) {
      completarReto(reto, "Todos los pares están correctamente emparejados.");
    }
  } else {
    [m.seleccion, item].forEach((it) => it.classList.add("shake"));
    setTimeout(() => {
      [m.seleccion, item].forEach((it) => it && it.classList.remove("shake", "selected"));
    }, 350);
    mostrarFeedback("Esos dos no van juntos. Sigue probando.", "bad");
    m.seleccion = null;
  }
}

/* ---------- Tipo: detectar (qué le falta a un prompt) ---------- */

function renderCuerpoDetectar(reto, deshabilitado) {
  const bloquePrompt = document.createElement("pre");
  bloquePrompt.className = "code detect-prompt";
  bloquePrompt.textContent = reto.prompt_malo;
  el.cuerpo.appendChild(bloquePrompt);

  const lista = document.createElement("div");
  lista.className = "detect-list";

  reto.opciones.forEach((opcion, i) => {
    const label = document.createElement("label");
    label.className = "detect-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.index = String(i);
    input.disabled = deshabilitado;
    if (deshabilitado) input.checked = opcion.correcta;

    const span = document.createElement("span");
    span.textContent = opcion.texto;

    label.appendChild(input);
    label.appendChild(span);
    if (deshabilitado && opcion.correcta) label.classList.add("correct");
    lista.appendChild(label);
  });

  el.cuerpo.appendChild(lista);
}

function comprobarDetectar(reto) {
  const labels = [...el.cuerpo.querySelectorAll(".detect-option")];
  let todoCorrecto = true;

  labels.forEach((label, i) => {
    const input = label.querySelector("input");
    const marcada = input.checked;
    const esCorrecta = reto.opciones[i].correcta;

    label.classList.remove("correct", "incorrect", "missed");
    if (marcada && esCorrecta) label.classList.add("correct");
    else if (marcada && !esCorrecta) label.classList.add("incorrect");
    else if (!marcada && esCorrecta) label.classList.add("missed");

    if (marcada !== esCorrecta) todoCorrecto = false;
  });

  if (todoCorrecto) {
    labels.forEach((label) => (label.querySelector("input").disabled = true));
    completarReto(reto, "Exacto, esos son los problemas del prompt.");
  } else {
    mostrarFeedback("No es del todo correcto: revisa lo marcado en rojo o naranja.", "bad");
  }
}

/* ---------- Comprobación genérica ---------- */

function comprobarReto() {
  const reto = estado.retos[estado.actual];
  const tipo = tipoDe(reto);
  if (tipo === "codigo") comprobarCodigo(reto);
  else if (tipo === "quiz") comprobarQuiz(reto);
  else if (tipo === "detectar") comprobarDetectar(reto);
  // "emparejar" se autocomprueba con cada clic, no usa este botón
}

function completarReto(reto, mensaje) {
  marcarCompletado(estado.formacion.id, reto.id);
  mostrarFeedback(mensaje, "ok");
  el.sello.classList.add("visible");
  el.btnSiguiente.hidden = false;
  el.btnComprobar.disabled = true;
  el.btnComprobar.hidden = true;
  el.btnComprobar.textContent = "Ya resuelto";
  renderTira();
}

function mostrarFeedback(texto, estadoTipo) {
  el.feedback.textContent = texto;
  el.feedback.dataset.state = estadoTipo;
}

function mostrarPista() {
  const reto = estado.retos[estado.actual];
  mostrarFeedback(reto.pista ? `Pista: ${reto.pista}` : "Este reto no tiene pista.", "hint");
}
