"use strict";
(function () {
  const cs = new CSInterface();
  const extension = cs.getSystemPath(SystemPath.EXTENSION);
  const nodeRequire = window.cep_node ? window.cep_node.require : require;
  const path = nodeRequire("path"),
    fs = nodeRequire("fs"),
    os = nodeRequire("os"),
    crypto = nodeRequire("crypto");
  const receiverModule = nodeRequire(path.join(extension, "receiver.js"));
  const $ = (id) => document.getElementById(id);
  const defaults = {
    newComp: true,
    frameRate: 60,
    duration: 5,
    compScale: 1,
    precompGroups: true,
    parametrics: true,
    assetPath: path.join(os.homedir(), "Documents", "AEUX Modern", "Transfers")
  };
  let prefs = Object.assign({}, defaults),
    importing = false,
    connected = false;
  try {
    Object.assign(
      prefs,
      JSON.parse(localStorage.getItem("aeux-modern.prefs") || "{}")
    );
  } catch (e) {}
  function save() {
    localStorage.setItem("aeux-modern.prefs", JSON.stringify(prefs));
  }
  function settings() {
    const fps = Number($("fps").value),
      duration = Number($("duration").value),
      scale = Number($("scale").value);
    if (
      !Number.isFinite(fps) ||
      fps < 1 ||
      fps > 120 ||
      !Number.isFinite(duration) ||
      duration < 1 ||
      duration > 3600 ||
      ![1, 2, 3, 4].includes(scale)
    )
      throw new Error("Use 1–120 fps, 1–3600 seconds, and a scale of 1×–4×.");
    Object.assign(prefs, {
      frameRate: fps,
      duration: duration,
      compScale: scale
    });
    save();
    return prefs;
  }
  function renderPrefs() {
    $("fps").value = prefs.frameRate;
    $("duration").value = prefs.duration;
    $("scale").value = prefs.compScale;
    $("new-comp").classList.toggle("selected", prefs.newComp);
    $("current-comp").classList.toggle("selected", !prefs.newComp);
    $("new-comp").setAttribute("aria-pressed", String(prefs.newComp));
    $("current-comp").setAttribute("aria-pressed", String(!prefs.newComp));
    $("asset-path").textContent = prefs.assetPath;
    $("asset-path").title = prefs.assetPath;
  }
  function feedback(title, messages) {
    $("feedback").hidden = !messages.length;
    $("result-title").textContent = title;
    $("messages").textContent = "";
    messages.forEach((message) => {
      const li = document.createElement("li");
      li.textContent = message;
      $("messages").appendChild(li);
    });
  }
  function onUpdate(job) {
    if (job.status === "offline") {
      connected = false;
      $("connection").className = "pill error";
      $("connection").textContent = "Offline";
      feedback("Receiver unavailable", [job.error]);
      return;
    }
    if (job.status === "queued" || job.status === "importing") {
      $("status-title").textContent = "Building editable layers…";
      $("status-detail").textContent =
        "Keep After Effects open while the transfer finishes.";
      return;
    }
    if (job.status === "completed") {
      $("status-title").textContent =
        job.result.layerCount + " layers imported";
      $("status-detail").textContent =
        "Ready for your next selection from Sketch.";
      feedback(
        "Transfer notes",
        job.result.warnings.map((w) => w.layer + ": " + w.message)
      );
    } else if (job.status === "failed") {
      $("status-title").textContent = "Import needs attention";
      $("status-detail").textContent =
        "Fix the issue below before sending again.";
      feedback("Import failed", [job.error]);
    }
  }
  function evalHost(script) {
    return new Promise((resolve, reject) =>
      cs.evalScript(script, (result) => {
        try {
          const value = JSON.parse(result);
          if (!value || !value.ok)
            throw new Error(
              (value && value.error) ||
                "After Effects returned an invalid response"
            );
          resolve(value);
        } catch (e) {
          reject(
            new Error(
              e.message +
                " · If needed, enable Allow Scripts to Write Files and Access Network in AE Scripting & Expressions preferences."
            )
          );
        }
      })
    );
  }
  async function importTransfer(data, id) {
    if (importing) throw new Error("An import is already running.");
    importing = true;
    $("import-file").disabled = true;
    try {
      const options = settings();
      if (!options.newComp && data.batches.length > 1)
        throw new Error(
          "Use New composition when sending more than one Sketch frame."
        );
      data.batches.forEach((b) => {
        if (b[0].size.some((n) => n * options.compScale > 30000))
          throw new Error(
            "Scaled composition exceeds AE’s 30,000 pixel limit."
          );
      });
      const file = receiverModule.prepareTransfer(data, options.assetPath, id);
      const script =
        "AEUXModern.importFile(" +
        JSON.stringify(file) +
        "," +
        JSON.stringify(JSON.stringify(options)) +
        ")";
      return await evalHost(script);
    } finally {
      importing = false;
      $("import-file").disabled = false;
    }
  }
  const receiver = receiverModule.createReceiver({
    importTransfer: importTransfer,
    onUpdate: onUpdate
  });
  receiver.server.on("listening", () => {
    connected = true;
    $("connection").className = "pill ready";
    $("connection").textContent = "Connected";
  });
  async function importPortable(file) {
    const job = { id: crypto.randomUUID(), status: "importing" };
    onUpdate(job);
    try {
      const stat = fs.statSync(file);
      if (stat.size > receiverModule.MAX_BYTES)
        throw new Error("Transfer exceeds 128 MB");
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      receiverModule.validateTransfer(data);
      job.result = await importTransfer(data, job.id);
      job.status = "completed";
    } catch (e) {
      job.status = "failed";
      job.error = e.message;
    }
    onUpdate(job);
  }
  $("new-comp").onclick = () => {
    prefs.newComp = true;
    save();
    renderPrefs();
  };
  $("current-comp").onclick = () => {
    prefs.newComp = false;
    save();
    renderPrefs();
  };
  ["fps", "duration", "scale"].forEach((id) => {
    $(id).onchange = () => {
      try {
        settings();
      } catch (e) {
        feedback("Check settings", [e.message]);
      }
    };
  });
  $("choose-folder").onclick = () => {
    const result = window.cep.fs.showOpenDialogEx(
      false,
      true,
      "Choose a permanent image asset folder"
    );
    if (!result.err && result.data.length) {
      prefs.assetPath = result.data[0];
      save();
      renderPrefs();
    }
  };
  $("import-file").onclick = () => {
    const result = window.cep.fs.showOpenDialogEx(
      false,
      false,
      "Choose an AEUX Modern transfer",
      "",
      "json"
    );
    if (!result.err && result.data.length) importPortable(result.data[0]);
  };
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length === 1)
      importPortable(event.dataTransfer.files[0].path);
  });
  window.addEventListener("beforeunload", () => receiver.server.close());
  renderPrefs();
  receiver.listen();
})();
