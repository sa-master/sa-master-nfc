/* Бібліотека систем (розширювана). Кольори — попередні, палітру погодити окремо. */
(function (root, f) { var m = f(); if (typeof module === "object" && module.exports) module.exports = m; else { root.HID = root.HID || {}; for (var k in m) root.HID[k] = m[k]; } })(this, function () {
  var LIB = [
    { id: "cold", group: "Водопостачання", name: "Холодна вода", color: "#0a64d6" },
    { id: "hot", group: "Водопостачання", name: "Гаряча вода", color: "#e5392b" },
    { id: "recirc", group: "Водопостачання", name: "Рециркуляція", color: "#b5179e" },
    { id: "sewer", group: "Каналізація", name: "Каналізація", color: "#8d6e63" },
    { id: "heat_s", group: "Опалення", name: "Опалення, подача", color: "#f08a00" },
    { id: "heat_r", group: "Опалення", name: "Опалення, зворот", color: "#8a5a00" },
    { id: "power", group: "Електрика", name: "Силовий кабель", color: "#c9a100" },
    { id: "low", group: "Електрика", name: "Слабкострумові мережі", color: "#6a5acd" },
    { id: "ac_f", group: "Кондиціонування", name: "Фреонопровід", color: "#12a37f" },
    { id: "ac_d", group: "Кондиціонування", name: "Дренаж", color: "#4aa3c7" },
    { id: "other", group: "Інше", name: "Інше", color: "#6b7280" }
  ];
  return { LIB: LIB, sysOf: function (id) { return LIB.filter(function (s) { return s.id === id; })[0] || LIB[LIB.length - 1]; } };
});
