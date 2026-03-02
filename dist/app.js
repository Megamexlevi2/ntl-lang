const http = require("ntl:http");

const server = http.createServer();

server.handle((req, res) => {
  if (req.url === "/" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("Bem-vindo ao servidor NTL!");
  }
  else if (req.url === "/api" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "API funcionando", timestamp: Date.now() }));
  }
  else {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end("Página não encontrada");
  }
});

server.listen(3000);

console.log("Servidor rodando em http://localhost:3000");
