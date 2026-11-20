/* Спільний PDF-шаблон: підпис «Сформовано на sa-master.pro» з активним посиланням на кожній сторінці,
   завантаження та «Поділитися» (Web Share API, якщо браузер уміє ділитися файлами). */
(function (root) {
  "use strict";
  const LIBS = {
    html2canvas: { test: () => typeof root.html2canvas === "function", src: ["/tools/vendor/html2canvas.min.js", "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"] },
    jspdf: { test: () => !!(root.jspdf && root.jspdf.jsPDF), src: ["/tools/vendor/jspdf.umd.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"] }
  };
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(); }; document.head.appendChild(s); }); }
  async function ensure(name) {
    const l = LIBS[name]; if (l.test()) return true;
    for (const src of l.src) { try { await loadScript(src); if (l.test()) return true; } catch (e) {} }
    return false;
  }
  function footerImage(wMm) {
    const px = 6, w = Math.round(wMm * px * 3), h = Math.round(5 * px * 3), c = document.createElement("canvas");
    c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#8a8f98"; g.textBaseline = "middle"; g.textAlign = "center";
    const fs = Math.round(h * 0.5); g.font = fs + 'px -apple-system,"Segoe UI",Arial,sans-serif';
    const t = "Сформовано на sa-master.pro", tw = g.measureText(t).width;
    g.fillText(t, w / 2, h / 2);
    return { data: c.toDataURL("image/jpeg", 0.92), textW: tw / (px * 3) };
  }
  /* paperEl — елемент з готовим вмістом документа (білий фон). Повертає Blob PDF. */
  async function pdf(paperEl, opts) {
    opts = opts || {};
    if (!(await ensure("html2canvas")) || !(await ensure("jspdf"))) throw new Error("libs");
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;pointer-events:none";
    const src = paperEl.cloneNode(true); src.removeAttribute("id"); src.classList.add("pdf"); host.appendChild(src); document.body.appendChild(host);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const scale = 1.5;
      const canvas = await root.html2canvas(src, { backgroundColor: "#ffffff", scale, useCORS: true, logging: false, windowWidth: 794, windowHeight: src.scrollHeight });
      const sr = src.getBoundingClientRect();
      const sel = opts.breakSelector || ".qaMeta,.qaRow,.qaConcl,.qaNote,.qaPhT,.qaPhotos figure,.docRow,.docBlock,.docHead";
      const breaks = Array.from(src.querySelectorAll(sel)).map(el => Math.round((el.getBoundingClientRect().bottom - sr.top) * scale)).filter(v => v > 0 && v < canvas.height).sort((a, b) => a - b);
      const { jsPDF } = root.jspdf, doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
      const mm = 10, footH = 8, cw = 210 - mm * 2, ch = 297 - mm * 2 - footH, pxPerMm = canvas.width / cw, maxH = Math.floor(ch * pxPerMm);
      const foot = footerImage(cw);
      let off = 0, page = 0;
      while (off < canvas.height) {
        let target = Math.min(off + maxH, canvas.height), end = target;
        if (target < canvas.height) { const c = breaks.filter(v => v > off + 80 && v <= target); if (c.length) end = c[c.length - 1]; }
        const h = end - off, slice = document.createElement("canvas"); slice.width = canvas.width; slice.height = h;
        slice.getContext("2d").drawImage(canvas, 0, off, canvas.width, h, 0, 0, canvas.width, h);
        if (page > 0) doc.addPage();
        doc.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", mm, mm, cw, h / pxPerMm);
        const fy = 297 - mm - 5;
        doc.addImage(foot.data, "JPEG", mm, fy, cw, 5);
        const lw = foot.textW + 2;
        doc.link(105 - lw / 2, fy, lw, 5, { url: "https://sa-master.pro" });
        off = end; page++;
      }
      return doc.output("blob");
    } finally { host.remove(); }
  }
  function download(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  async function share(blob, name, title) {
    const file = new File([blob], name, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file], title: title || name }); return "shared"; }
      catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
    }
    download(blob, name); return "downloaded";
  }
  root.SMDoc = { pdf, download, share, ensure };
})(window);
