/* Спільний PDF-шаблон: підпис «Сформовано на sa-master.pro» з активним посиланням угорі (або внизу, при opts.footer:"bottom") кожної сторінки,
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
  function footerImage(wMm, ruleTop, quiet) {
    const px = 6, hMm = 7, w = Math.round(wMm * px * 3), h = Math.round(hMm * px * 3), c = document.createElement("canvas");
    c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.fillStyle = quiet ? "#6b7280" : "#0a64d6"; g.textBaseline = "middle"; g.textAlign = "center";
    const fs = Math.round(h * (quiet ? 0.42 : 0.5)); g.font = (quiet ? '500 ' : '700 ') + fs + 'px -apple-system,"Segoe UI",Arial,sans-serif';
    const t = "Сформовано на sa-master.pro", tw = g.measureText(t).width;
    g.fillText(t, w / 2, h * (ruleTop ? 0.54 : 0.46));
    if (quiet) { g.fillStyle = "#1b2a49"; const gap = tw / 2 + 28, ly = Math.round(h * (ruleTop ? 0.54 : 0.46)); g.fillRect(0, ly, w / 2 - gap, 3); g.fillRect(w / 2 + gap, ly, w / 2 - gap, 3); }
    else { g.fillStyle = "#d0d5dd"; g.fillRect(0, ruleTop ? 0 : h - 3, w, 3); }
    return { data: c.toDataURL("image/jpeg", 0.92), textW: tw / (px * 3), hMm };
  }
  /* paperEl — елемент з готовим вмістом документа (білий фон). Повертає Blob PDF. */
  /* фірмова смуга у шапці кожної сторінки (на всю ширину, з активним посиланням) — частина дизайну, а не штамп */
  function bandImage(wMm, hMm) {
    const k = 18, w = Math.round(wMm * k), h = Math.round(hMm * k), c = document.createElement("canvas");
    c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = "#0a1330"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#0a64d6"; g.fillRect(0, h - Math.round(h * 0.12), w, Math.round(h * 0.12));
    g.textBaseline = "middle"; g.fillStyle = "#fff"; g.textAlign = "left";
    g.font = '800 ' + Math.round(h * 0.46) + 'px -apple-system,"Segoe UI",Arial,sans-serif';
    g.fillText("SA-MASTER.PRO", Math.round(10 * k), h * 0.46);
    g.textAlign = "right"; g.fillStyle = "#b7c4e6"; g.font = '500 ' + Math.round(h * 0.36) + 'px -apple-system,"Segoe UI",Arial,sans-serif';
    g.fillText("Комплексний монтаж сантехніки · Київ", w - Math.round(10 * k), h * 0.46);
    return c.toDataURL("image/jpeg", 0.92);
  }
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
      const none = opts.footer === "none", bottom = opts.footer === "bottom";
      const signEl = opts.signSelector ? src.querySelector(opts.signSelector) : null;
      const signR = signEl ? signEl.getBoundingClientRect() : null;
      const mm = 10, cw = 210 - mm * 2, foot = footerImage(cw, bottom, opts.quiet), footH = none ? 0 : bottom ? foot.hMm + 3 : 9, ch = 297 - mm * 2 - footH, pxPerMm = canvas.width / cw, maxH = Math.floor(ch * pxPerMm);
      let off = 0, page = 0;
      while (off < canvas.height) {
        let target = Math.min(off + maxH, canvas.height), end = target;
        if (target < canvas.height) { const c = breaks.filter(v => v > off + 80 && v <= target); if (c.length) end = c[c.length - 1]; }
        const h = end - off, slice = document.createElement("canvas"); slice.width = canvas.width; slice.height = h;
        slice.getContext("2d").drawImage(canvas, 0, off, canvas.width, h, 0, 0, canvas.width, h);
        if (page > 0) doc.addPage();
        if (none) {
          doc.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", mm, mm, cw, h / pxPerMm);
          if (signR) { const t = Math.round((signR.top - sr.top) * scale), b = Math.round((signR.bottom - sr.top) * scale);
            if (t >= off && b <= end) doc.link(mm + (signR.left - sr.left) * scale / pxPerMm, mm + (t - off) / pxPerMm, signR.width * scale / pxPerMm, (b - t) / pxPerMm, { url: "https://sa-master.pro" }); }
        } else if (bottom) {
          /* підпис унизу кожної сторінки, з активним посиланням */
          doc.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", mm, mm, cw, h / pxPerMm);
          const fy = 297 - mm - foot.hMm;
          doc.addImage(foot.data, "JPEG", mm, fy, cw, foot.hMm);
          const lw = foot.textW + 4;
          doc.link(105 - lw / 2, fy, lw, foot.hMm, { url: "https://sa-master.pro" });
        } else {
          doc.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", mm, mm + footH, cw, h / pxPerMm);
          /* підпис зверху кожної сторінки, з активним посиланням */
          doc.addImage(foot.data, "JPEG", mm, mm, cw, foot.hMm);
          const lw = foot.textW + 4;
          doc.link(105 - lw / 2, mm, lw, foot.hMm, { url: "https://sa-master.pro" });
        }
        if (opts.band) { doc.addImage(bandImage(210, 7), "JPEG", 0, 0, 210, 7); doc.link(0, 0, 210, 7, { url: "https://sa-master.pro" }); }
        off = end; page++;
      }
      try { doc.setProperties({ title: opts.title || "Звіт sa-master.pro", subject: "Сформовано на sa-master.pro", author: "sa-master.pro", creator: "sa-master.pro", keywords: "sa-master.pro" }); } catch (e) {}
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
      try { await navigator.share(title === false ? { files: [file] } : { files: [file], title: title || name }); return "shared"; }
      catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
    }
    download(blob, name); return "downloaded";
  }
  root.SMDoc = { pdf, download, share, ensure };
})(window);
