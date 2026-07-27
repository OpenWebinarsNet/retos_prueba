// Configuración de formaciones disponibles.
// Añadir una formación nueva = añadir una línea aquí + su fichero JSON en /retos.
const FORMACIONES = [
  { id: "python-basico", nombre: "Python básico", archivo: "retos/python-basico.json" },
  { id: "js-basico", nombre: "JavaScript básico", archivo: "retos/js-basico.json" },
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
  codigo: document.getElementById("reto-codigo"),
  sello: document.getElementById("sello"),
  btnComprobar: document.getElementById("btn-comprobar"),
  btnPista: document.getElementById("btn-pista"),
  btnSiguiente: document.getElementById("btn-siguiente"),
  btnReset: document.getElementById("btn-reset"),
  feedback: document.getElementById("feedback"),
};

let estado = {
  formacion: null,   // objeto de FORMACIONES
  retos: [],         // retos cargados del JSON
  actual: 0,          // índice del reto mostrado
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
  if (idx !== -1) {
    estado.actual = idx;
  } else {
    const cualquiera = primerPendiente(estado.retos, estado.formacion.id);
    estado.actual = cualquiera;
  }
  renderTira();
  renderReto();
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

  el.indice.textContent = `${estado.actual + 1} / ${total}`;
  el.titulo.textContent = reto.titulo;
  el.descripcion.textContent = reto.descripcion || "";
  el.sello.classList.toggle("visible", done);
  el.feedback.textContent = "";
  el.feedback.removeAttribute("data-state");
  el.btnSiguiente.hidden = !done;
  el.btnComprobar.disabled = done;
  el.btnComprobar.textContent = done ? "Ya resuelto" : "Comprobar";

  renderCodigoConHuecos(reto, done);
}

function renderCodigoConHuecos(reto, deshabilitado) {
  el.codigo.innerHTML = "";
  const partes = reto.codigo.split("____");

  partes.forEach((parte, i) => {
    el.codigo.appendChild(document.createTextNode(parte));
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
      el.codigo.appendChild(input);
    }
  });
}

function comprobarReto() {
  const reto = estado.retos[estado.actual];
  const inputs = [...el.codigo.querySelectorAll("input")];
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
    marcarCompletado(estado.formacion.id, reto.id);
    el.feedback.textContent = "Correcto. Reto marcado como resuelto.";
    el.feedback.dataset.state = "ok";
    el.sello.classList.add("visible");
    el.btnSiguiente.hidden = false;
    el.btnComprobar.disabled = true;
    el.btnComprobar.textContent = "Ya resuelto";
    inputs.forEach((input) => (input.disabled = true));
    renderTira();
  } else {
    el.feedback.textContent = "Todavía no. Revisa los huecos en rojo.";
    el.feedback.dataset.state = "bad";
  }
}

function mostrarPista() {
  const reto = estado.retos[estado.actual];
  el.feedback.textContent = reto.pista ? `Pista: ${reto.pista}` : "Este reto no tiene pista.";
  el.feedback.dataset.state = "hint";
}
