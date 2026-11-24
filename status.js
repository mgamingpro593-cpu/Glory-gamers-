// Diagnostic — /api/status
// Dit si le serveur, la base de données et l'accès admin fonctionnent
const { hasDb, redis, readBody, inspectAdmin } = require("../lib/server");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const body = req.method === "POST" ? readBody(req) : {};
    const admin = await inspectAdmin(body.idToken);

    const out = {
      api: true,
      dbConfigured: hasDb,
      dbRead: false,
      dbWrite: null,
      dbError: "",
      adminOk: admin.ok,
      adminReason: admin.reason
    };

    if (hasDb) {
      try {
        await redis(["PING"]);
        out.dbRead = true;
        if (admin.ok) {
          await redis(["SET", "glory_health", "ok", "EX", "30"]);
          out.dbWrite = true;
        }
      } catch (e) {
        out.dbError = e.message;
        if (admin.ok) out.dbWrite = false;
      }
    }

    return res.status(200).json(out);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};
